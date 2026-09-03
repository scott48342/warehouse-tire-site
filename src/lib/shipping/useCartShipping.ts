"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  calculateShipping,
  isValidZipCode,
  normalizeZipCode,
  isOversizedItem,
  type ShippingItem,
  type ShippingEstimate,
} from "./shippingService";
import { type CartItem } from "@/lib/cart/CartContext";

const ZIP_STORAGE_KEY = "wt_shipping_zip";

/** Weight threshold for FedEx live lookup (matches fedexRates.ts) */
const FEDEX_WEIGHT_THRESHOLD = 40;

/**
 * Get stored ZIP code from localStorage
 */
export function getStoredZipCode(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ZIP_STORAGE_KEY) || "";
}

/**
 * Store ZIP code in localStorage
 */
export function setStoredZipCode(zip: string): void {
  if (typeof window === "undefined") return;
  if (zip) {
    localStorage.setItem(ZIP_STORAGE_KEY, normalizeZipCode(zip));
  } else {
    localStorage.removeItem(ZIP_STORAGE_KEY);
  }
}

/**
 * Convert cart items to shipping items
 */
function cartItemsToShippingItems(cartItems: CartItem[]): ShippingItem[] {
  return cartItems.map(item => ({
    type: item.type,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    // Pass through freeShipping flag (set for Wheel-1 landed-cost items)
    freeShipping: (item as { freeShipping?: boolean }).freeShipping === true || undefined,
    // Tire size label for oversized/heavy detection (LT, flotation, large metric)
    sizeLabel: item.type === "tire" ? (item as { size?: string }).size : undefined,
    // Pass weight if available
    weightLbs: (item as { weightLbs?: number }).weightLbs,
  }));
}

/**
 * Check if cart has items heavy enough for FedEx lookup
 */
function shouldFetchFedExRate(items: ShippingItem[]): boolean {
  for (const item of items) {
    if (item.freeShipping) continue;
    if (item.type === "accessory") continue;
    
    // Check explicit weight
    if (item.weightLbs && item.weightLbs >= FEDEX_WEIGHT_THRESHOLD) {
      return true;
    }
    
    // Check if oversized (LT tires, flotation, large metric)
    if (isOversizedItem(item)) {
      return true;
    }
  }
  return false;
}

/**
 * Build API request body from cart items
 */
function buildApiRequestBody(
  zipCode: string,
  cartItems: CartItem[],
  subtotal: number
): Record<string, unknown> {
  const items = cartItems.map(item => ({
    type: item.type,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    freeShipping: (item as { freeShipping?: boolean }).freeShipping,
    sizeLabel: item.type === "tire" ? (item as { size?: string }).size : undefined,
    weightLbs: (item as { weightLbs?: number }).weightLbs,
    diameterInches: (item as { diameterInches?: number }).diameterInches,
    source: (item as { source?: string }).source,
  }));

  return { zipCode, items, subtotal };
}

interface LiveRateResult {
  amount: number | null;
  rateSource: "fedex" | "zone" | "unavailable";
  transitDays: { min: number; max: number } | null;
  serviceName: string | null;
  fedexError?: string;
  requiresQuote?: boolean;
  quoteReason?: string;
}

/**
 * Hook to manage shipping estimation with cart integration
 * 
 * For heavy/oversized items (40+ lbs), fetches live FedEx rates.
 * Falls back to zone-based calculation for lighter items or if API fails.
 */
export function useCartShipping(cartItems: CartItem[], subtotal: number) {
  const [zipCode, setZipCodeState] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [liveRate, setLiveRate] = useState<LiveRateResult | null>(null);
  
  // Track last fetch to avoid duplicate calls
  const lastFetchKey = useRef<string>("");

  // Load stored ZIP on mount
  useEffect(() => {
    const stored = getStoredZipCode();
    if (stored) {
      setZipCodeState(stored);
    }
    setIsLoaded(true);
  }, []);

  // Convert cart items to shipping items
  const shippingItems = useMemo(() => cartItemsToShippingItems(cartItems), [cartItems]);

  // Calculate local zone-based estimate (instant, always available)
  const zoneEstimate = useMemo((): ShippingEstimate => {
    return calculateShipping({
      zipCode,
      items: shippingItems,
      subtotal,
    });
  }, [zipCode, shippingItems, subtotal]);

  // Determine if we should fetch FedEx rates
  const needsFedExLookup = useMemo(() => {
    if (!zipCode || !isValidZipCode(zipCode)) return false;
    return shouldFetchFedExRate(shippingItems);
  }, [zipCode, shippingItems]);

  // Fetch live FedEx rate when needed
  useEffect(() => {
    if (!needsFedExLookup || !zipCode) {
      setLiveRate(null);
      return;
    }

    // Create a cache key to avoid refetching for same cart/zip
    const fetchKey = `${zipCode}:${JSON.stringify(
      cartItems.map(i => ({
        t: i.type,
        q: i.quantity,
        w: (i as any).weightLbs,
        s: (i as any).size,
      }))
    )}`;

    if (fetchKey === lastFetchKey.current) {
      return; // Already fetched this
    }

    const controller = new AbortController();

    async function fetchRate() {
      setIsLoadingRate(true);
      try {
        const body = buildApiRequestBody(zipCode, cartItems, subtotal);
        const res = await fetch("/api/shipping/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          console.warn("[useCartShipping] API error:", res.status);
          setLiveRate(null);
          return;
        }

        const data = await res.json();
        
        if (data.success && data.estimate) {
          lastFetchKey.current = fetchKey;
          setLiveRate({
            amount: data.estimate.amount,
            rateSource: data.estimate.rateSource || "zone",
            transitDays: data.estimate.estimatedDays,
            serviceName: data.estimate.fedexServiceName,
            fedexError: data.estimate.fedexError,
            requiresQuote: data.estimate.requiresQuote,
            quoteReason: data.estimate.quoteReason,
          });
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("[useCartShipping] Fetch error:", err);
        }
        setLiveRate(null);
      } finally {
        setIsLoadingRate(false);
      }
    }

    fetchRate();

    return () => {
      controller.abort();
    };
  }, [needsFedExLookup, zipCode, cartItems, subtotal]);

  // Final estimate combines live rate (if available) with zone estimate
  const estimate = useMemo((): ShippingEstimate & { 
    rateSource: "fedex" | "zone" | "unavailable";
    serviceName?: string | null;
    requiresQuote?: boolean;
    quoteReason?: string;
  } => {
    // If FedEx couldn't quote heavy items, require a call
    if (liveRate && liveRate.requiresQuote) {
      return {
        ...zoneEstimate,
        amount: 0, // Can't proceed without quote
        displayAmount: "Call for Quote",
        isEstimate: false,
        estimatedDays: { min: 0, max: 0 },
        rateSource: "unavailable",
        requiresQuote: true,
        quoteReason: liveRate.quoteReason || "Shipping to this location requires a custom quote. Please call (248) 332-4120.",
      };
    }
    
    if (liveRate && liveRate.rateSource === "fedex" && liveRate.amount !== null) {
      return {
        ...zoneEstimate,
        amount: liveRate.amount,
        displayAmount: `$${liveRate.amount}`,
        isEstimate: false, // FedEx rate is accurate
        estimatedDays: liveRate.transitDays || zoneEstimate.estimatedDays,
        rateSource: "fedex",
        serviceName: liveRate.serviceName,
        requiresQuote: false,
      };
    }
    
    // Use zone estimate (for non-heavy items only)
    return {
      ...zoneEstimate,
      rateSource: "zone",
      requiresQuote: false,
    };
  }, [zoneEstimate, liveRate]);

  // Derived values
  //
  // The $1,500 free-shipping threshold was REMOVED (2026-08-31).
  // The only $0-shipping case: ALL items have freeShipping=true (Wheel-1
  // landed-cost strategy: freight is baked into the per-unit price).
  // Mixed carts (Wheel-1 + WheelPros) get standard shipping on everything else.
  const allItemsFreeShipping =
    cartItems.length > 0 &&
    cartItems.every((item) => (item as { freeShipping?: boolean }).freeShipping === true);

  const isFreeShipping = allItemsFreeShipping;

  // Set ZIP code and persist
  const setZipCode = useCallback((zip: string) => {
    const normalized = normalizeZipCode(zip);
    // Only update if ZIP actually changed
    if (normalized === zipCode) {
      return; // No change, skip re-fetch
    }
    setZipCodeState(normalized);
    setStoredZipCode(normalized);
    // Clear live rate when ZIP changes - will refetch
    setLiveRate(null);
    lastFetchKey.current = "";
  }, [zipCode]);

  // Clear ZIP code
  const clearZipCode = useCallback(() => {
    setZipCodeState("");
    setStoredZipCode("");
    setLiveRate(null);
    lastFetchKey.current = "";
  }, []);

  // Calculated total (subtotal + shipping)
  const estimatedTotal = useMemo(() => {
    if (isFreeShipping) return subtotal;
    if (!zipCode || !isValidZipCode(zipCode)) return subtotal;
    return subtotal + estimate.amount;
  }, [subtotal, isFreeShipping, zipCode, estimate.amount]);

  return {
    // ZIP state
    zipCode,
    setZipCode,
    clearZipCode,
    isValidZip: zipCode ? isValidZipCode(zipCode) : false,
    isLoaded,

    // Estimate
    estimate,
    shippingAmount: estimate.amount,
    isLoadingRate,
    rateSource: estimate.rateSource,
    
    // Quote required (FedEx can't service this route for heavy items)
    requiresQuote: estimate.requiresQuote || false,
    quoteReason: estimate.quoteReason,
    
    // Free shipping (Wheel-1 landed-cost only; site-wide offer removed)
    isFreeShipping,
    oversizedCount: estimate.oversizedCount,

    // Totals
    subtotal,
    estimatedTotal,
  };
}

export default useCartShipping;
