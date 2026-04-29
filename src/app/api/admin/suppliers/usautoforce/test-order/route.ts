/**
 * Test US AutoForce order placement (TEST MODE ONLY)
 * 
 * POST /api/admin/suppliers/usautoforce/test-order
 * 
 * ⚠️ Only works in test mode - will not place real orders
 */

import { NextResponse } from "next/server";
import { placeOrder, serviceCheck, getStatus } from "@/lib/usautoforce/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Safety check: Only allow in test mode
  const status = getStatus();
  if (!status.isTestMode) {
    return NextResponse.json({
      ok: false,
      error: "Test orders only allowed in test mode",
      hint: "Set USAUTOFORCE_USERNAME to test credentials",
    }, { status: 403 });
  }
  
  const body = await req.json().catch(() => ({}));
  
  // Default test order if not provided
  const testOrder = {
    purchaseOrderNumber: body.poNumber || `TEST-${Date.now()}`,
    items: body.items || [
      {
        partNumber: "356260",  // Toyo Open Country A/T III
        quantity: body.quantity || 4,
      }
    ],
    shipTo: body.shipTo || {
      name: "Test Customer",
      address1: "123 Test Street",
      city: "Appleton",
      state: "WI",
      zip: "54913",
      phone: "555-555-5555",
    },
    notes: "TEST ORDER - DO NOT SHIP",
  };
  
  console.log("[test-order] Placing test order:", testOrder);
  
  // First verify connection
  const check = await serviceCheck();
  if (!check.success) {
    return NextResponse.json({
      ok: false,
      error: "Connection check failed",
      details: check.errorMessage,
    }, { status: 500 });
  }
  
  // Place order
  const result = await placeOrder(testOrder);
  
  return NextResponse.json({
    ok: result.success,
    testMode: true,
    orderRequest: testOrder,
    result: {
      success: result.success,
      orderNumber: result.orderNumber,
      poNumber: result.poNumber,
      status: result.status,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    },
  });
}
