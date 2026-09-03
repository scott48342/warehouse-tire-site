/**
 * Shipping Estimate API
 * 
 * POST /api/shipping/estimate
 * Calculate shipping estimate for a cart
 * 
 * Uses FedEx live rates for heavy/oversized items (40+ lbs),
 * falls back to zone-based calculation for lighter items or if FedEx fails.
 * 
 * @created 2026-04-03
 * @updated 2026-09-03 - Added FedEx live rate integration for heavy items
 */

import { NextResponse } from "next/server";
import {
  calculateShipping,
  isValidZipCode,
  getZoneFromZip,
  normalizeZipCode,
  type ShippingItem,
} from "@/lib/shipping/shippingService";
import {
  getFedExShippingRate,
  shouldUseFedExLookup,
  type CartItemForShipping,
} from "@/lib/shipping/fedexRates";

// Changed from edge to nodejs runtime - FedEx API calls need full Node
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/shipping/estimate
 * 
 * Body:
 * - zipCode: string (required)
 * - stateCode: string (optional, improves FedEx accuracy)
 * - items: Array<{ type, quantity, weightLbs?, sizeLabel?, diameterInches? }>
 * - subtotal: number
 * - useFedEx: boolean (optional, force FedEx lookup even for light items)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { zipCode, stateCode, items, subtotal, useFedEx } = body;

    // Validate ZIP
    if (!zipCode || typeof zipCode !== "string") {
      return NextResponse.json(
        { error: "zipCode is required" },
        { status: 400 }
      );
    }

    if (!isValidZipCode(zipCode)) {
      return NextResponse.json(
        { error: "Invalid ZIP code format" },
        { status: 400 }
      );
    }

    // Validate items
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "items must be an array" },
        { status: 400 }
      );
    }

    const numSubtotal = Number(subtotal) || 0;
    const normalizedZip = normalizeZipCode(zipCode);

    // Build shipping items for zone-based calc
    const shippingItems: ShippingItem[] = items.map((item: any) => ({
      type: item.type || "wheel",
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      sizeLabel: typeof item.sizeLabel === "string" ? item.sizeLabel : (typeof item.size === "string" ? item.size : undefined),
      weightLbs: Number(item.weightLbs) > 0 ? Number(item.weightLbs) : undefined,
      freeShipping: item.freeShipping === true,
    }));

    // Calculate zone-based estimate (fast, always available)
    const zoneEstimate = calculateShipping({
      zipCode: normalizedZip,
      items: shippingItems,
      subtotal: numSubtotal,
    });

    // Build cart items for FedEx lookup
    const cartItems: CartItemForShipping[] = items.map((item: any) => ({
      type: item.type || "wheel",
      quantity: Number(item.quantity) || 1,
      weightLbs: Number(item.weightLbs) > 0 ? Number(item.weightLbs) : undefined,
      diameterInches: Number(item.diameterInches) > 0 ? Number(item.diameterInches) : undefined,
      freeShipping: item.freeShipping === true,
      source: item.source,
    }));

    // Check if we should use FedEx (heavy items present)
    const shouldUseFedEx = useFedEx === true || shouldUseFedExLookup(cartItems);

    let fedexRate: number | null = null;
    let fedexTransitDays: number | null = null;
    let fedexServiceName: string | null = null;
    let rateSource: "fedex" | "zone" = "zone";
    let fedexError: string | undefined;

    if (shouldUseFedEx) {
      // Derive state from ZIP if not provided
      const state = stateCode || deriveStateFromZip(normalizedZip);
      
      const fedexResult = await getFedExShippingRate(normalizedZip, state, cartItems);
      
      if (fedexResult.success && fedexResult.groundRate !== null) {
        fedexRate = Math.ceil(fedexResult.groundRate);
        fedexTransitDays = fedexResult.transitDays;
        fedexServiceName = fedexResult.serviceName;
        rateSource = "fedex";
      } else {
        fedexError = fedexResult.error;
        console.warn("[shipping/estimate] FedEx lookup failed:", fedexError);
        
        // NO FALLBACK for heavy items - require call for quote
        // This prevents undercharging on routes FedEx can't quote
        return NextResponse.json({
          success: true,
          estimate: {
            amount: null,
            isFree: false,
            zone: zoneEstimate.zone,
            zoneName: zoneEstimate.zoneName,
            displayAmount: "Call for Quote",
            estimatedDays: null,
            isEstimate: false,
            oversizedCount: zoneEstimate.oversizedCount,
            rateSource: "unavailable",
            fedexServiceName: null,
            requiresQuote: true,
            quoteReason: "Shipping to this location requires a custom quote. Please call (248) 332-4120.",
            fedexError: fedexError,
          },
        });
      }
    }

    // Use FedEx rate if available, otherwise zone estimate (for non-heavy items only)
    const finalAmount = fedexRate !== null ? fedexRate : zoneEstimate.amount;
    const finalDays = fedexTransitDays !== null 
      ? { min: fedexTransitDays, max: fedexTransitDays + 2 }
      : zoneEstimate.estimatedDays;

    return NextResponse.json({
      success: true,
      estimate: {
        amount: finalAmount,
        isFree: zoneEstimate.isFree,
        zone: zoneEstimate.zone,
        zoneName: zoneEstimate.zoneName,
        displayAmount: zoneEstimate.isFree ? "FREE" : `$${finalAmount}`,
        estimatedDays: finalDays,
        isEstimate: rateSource === "zone",
        oversizedCount: zoneEstimate.oversizedCount,
        rateSource,
        fedexServiceName,
        requiresQuote: false,
      },
    });
  } catch (err: any) {
    console.error("[shipping/estimate] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to calculate shipping" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/shipping/estimate?zip=12345&subtotal=1000
 * Quick estimate without items (assumes typical wheel+tire set)
 * Note: This uses zone-based only (no FedEx) for speed
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const zipCode = url.searchParams.get("zip") || url.searchParams.get("zipCode");
  const subtotal = Number(url.searchParams.get("subtotal")) || 0;

  if (!zipCode) {
    return NextResponse.json({
      message: "Provide ?zip=12345&subtotal=1000 for estimate",
    });
  }

  if (!isValidZipCode(zipCode)) {
    return NextResponse.json(
      { error: "Invalid ZIP code format" },
      { status: 400 }
    );
  }

  // Assume typical 4 wheel + 4 tire package
  const items: ShippingItem[] = [
    { type: "wheel", quantity: 4 },
    { type: "tire", quantity: 4 },
  ];

  const estimate = calculateShipping({
    zipCode,
    items,
    subtotal,
  });

  return NextResponse.json({
    success: true,
    estimate: {
      amount: estimate.amount,
      isFree: estimate.isFree,
      zone: estimate.zone,
      zoneName: estimate.zoneName,
      displayAmount: estimate.displayAmount,
      estimatedDays: estimate.estimatedDays,
      rateSource: "zone",
    },
  });
}

/**
 * Derive state code from ZIP prefix
 * Not perfect but good enough for FedEx rate requests
 */
function deriveStateFromZip(zip: string): string {
  const prefix = zip.substring(0, 3);
  const firstDigit = parseInt(prefix[0], 10);
  
  // Michigan (our primary region)
  if (prefix >= "480" && prefix <= "499") return "MI";
  
  // Ohio
  if (prefix >= "430" && prefix <= "458") return "OH";
  
  // Indiana
  if (prefix >= "460" && prefix <= "479") return "IN";
  
  // Illinois
  if (prefix >= "600" && prefix <= "629") return "IL";
  
  // Wisconsin  
  if (prefix >= "530" && prefix <= "549") return "WI";
  
  // Florida
  if (prefix >= "320" && prefix <= "349") return "FL";
  
  // Texas
  if (prefix >= "750" && prefix <= "799") return "TX";
  
  // California
  if (prefix >= "900" && prefix <= "961") return "CA";
  
  // New York
  if (prefix >= "100" && prefix <= "149") return "NY";
  
  // Default by region
  if (firstDigit === 0 || firstDigit === 1) return "NY"; // Northeast
  if (firstDigit === 2) return "VA"; // Mid-Atlantic
  if (firstDigit === 3) return "FL"; // Southeast
  if (firstDigit === 4) return "MI"; // Midwest
  if (firstDigit === 5) return "MN"; // Central
  if (firstDigit === 6) return "IL"; // Midwest/Plains
  if (firstDigit === 7) return "TX"; // Southwest
  if (firstDigit === 8) return "CO"; // Mountain
  if (firstDigit === 9) return "CA"; // West Coast
  
  return "MI"; // Default
}
