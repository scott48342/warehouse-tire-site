"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  calculateShipping,
  isValidZipCode,
  normalizeZipCode,
  FREE_SHIPPING_THRESHOLD,
  type ShippingItem,
  type ShippingEstimate,
} from "./shippingService";
import { type CartItem } from "@/lib/cart/CartContext";

const ZIP_STORAGE_KEY = "wt_shipping_zip";

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
  }));
}

/**
 * Hook to manage shipping estimation with cart integration
 */
export function useCartShipping(cartItems: CartItem[], subtotal: number) {
  const [zipCode, setZipCodeState] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

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

  // Calculate shipping estimate
  const estimate = useMemo((): ShippingEstimate => {
    return calculateShipping({
      zipCode,
      items: shippingItems,
      subtotal,
    });
  }, [zipCode, shippingItems, subtotal]);

  // Derived values
  //
  // Free-shipping rules (in priority order):
  //   1. Order subtotal >= $1,500 threshold (site-wide policy)
  //   2. ALL items in cart have freeShipping=true (Wheel-1 landed-cost strategy:
  //      freight is baked into the per-unit price, so no additional charge).
  //      Mixed carts (Wheel-1 + WheelPros) get standard shipping on WheelPros portion.
  const allItemsFreeShipping =
    cartItems.length > 0 &&
    cartItems.every((item) => (item as { freeShipping?: boolean }).freeShipping === true);

  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || allItemsFreeShipping;
  const amountToFreeShipping = allItemsFreeShipping ? 0 : Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeShippingProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  // Set ZIP code and persist
  const setZipCode = useCallback((zip: string) => {
    const normalized = normalizeZipCode(zip);
    setZipCodeState(normalized);
    setStoredZipCode(normalized);
  }, []);

  // Clear ZIP code
  const clearZipCode = useCallback(() => {
    setZipCodeState("");
    setStoredZipCode("");
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
    
    // Free shipping
    isFreeShipping,
    amountToFreeShipping,
    freeShippingProgress,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,

    // Totals
    subtotal,
    estimatedTotal,
  };
}

export default useCartShipping;
