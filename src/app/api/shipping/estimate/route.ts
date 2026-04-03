/**
 * Shipping Estimate API
 * 
 * POST /api/shipping/estimate
 * Calculate shipping estimate for a cart
 * 
 * This is a lightweight, fast endpoint that uses zone-based
 * calculation without external API calls.
 * 
 * @created 2026-04-03
 */

import { NextResponse } from "next/server";
import {
  calculateShipping,
  isValidZipCode,
  FREE_SHIPPING_THRESHOLD,
  type ShippingItem,
} from "@/lib/shipping/shippingService";

export const runtime = "edge"; // Fast edge runtime - no external calls

/**
 * POST /api/shipping/estimate
 * 
 * Body:
 * - zipCode: string (required)
 * - items: Array<{ type: "wheel" | "tire" | "accessory", quantity: number }>
 * - subtotal: number
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { zipCode, items, subtotal } = body;

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

    // Validate subtotal
    const numSubtotal = Number(subtotal) || 0;

    // Calculate shipping
    const shippingItems: ShippingItem[] = items.map((item: any) => ({
      type: item.type || "wheel",
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
    }));

    const estimate = calculateShipping({
      zipCode,
      items: shippingItems,
      subtotal: numSubtotal,
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
        isEstimate: true,
      },
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      amountToFreeShipping: estimate.amountToFreeShipping,
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
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const zipCode = url.searchParams.get("zip") || url.searchParams.get("zipCode");
  const subtotal = Number(url.searchParams.get("subtotal")) || 0;

  if (!zipCode) {
    return NextResponse.json({
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
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
    },
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    amountToFreeShipping: estimate.amountToFreeShipping,
  });
}
