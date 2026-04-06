/**
 * Cart Add Event Tracking API
 * 
 * POST /api/cart/add-event
 * Tracks add-to-cart events for product popularity analytics.
 * 
 * Designed to be lightweight and non-blocking for cart UX.
 * 
 * @created 2026-04-05
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { 
  trackAddToCart, 
  markCartEventsPurchased,
  type CartAddEventData,
  type ProductType
} from "@/lib/cart/cartAddEventService";
import { 
  hasTestModeParam, 
  hasTestModeCookie, 
  hasTestModeHeader, 
  TEST_MODE_HEADER 
} from "@/lib/testData";

export const runtime = "nodejs";

/**
 * Parse cookies into a Record
 */
function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  cookieHeader.split(";").forEach(cookie => {
    const [key, value] = cookie.trim().split("=");
    if (key && value) result[key] = value;
  });
  return result;
}

interface AddEventBody {
  productType: ProductType;
  sku: string;
  rearSku?: string;
  productName: string;
  brand: string;
  price: number;
  quantity?: number;
  size?: string;
  specs?: Record<string, unknown>;
  cartId: string;
  sessionId?: string;
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  source?: string;
  referrer?: string;
  // Allow explicit test flag from client
  isTest?: boolean;
  testReason?: string;
}

/**
 * POST /api/cart/add-event
 * 
 * Track a single add-to-cart event
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as AddEventBody;
    const url = new URL(req.url);
    
    // Validate required fields
    if (!body.productType || !["tire", "wheel"].includes(body.productType)) {
      return NextResponse.json(
        { error: "productType must be 'tire' or 'wheel'" },
        { status: 400 }
      );
    }
    
    if (!body.sku || !body.productName || !body.brand || !body.cartId) {
      return NextResponse.json(
        { error: "sku, productName, brand, and cartId are required" },
        { status: 400 }
      );
    }
    
    if (typeof body.price !== "number" || body.price < 0) {
      return NextResponse.json(
        { error: "price must be a non-negative number" },
        { status: 400 }
      );
    }

    // Get request metadata
    const hdrs = await headers();
    const userAgent = hdrs.get("user-agent") || undefined;
    const forwardedFor = hdrs.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || undefined;
    
    // Build test detection context
    const cookieHeader = hdrs.get("cookie");
    const cookieRecord = parseCookies(cookieHeader);
    const headerRecord: Record<string, string> = {};
    const testHeader = hdrs.get(TEST_MODE_HEADER);
    if (testHeader) headerRecord[TEST_MODE_HEADER] = testHeader;
    
    // Detect test mode from URL, cookies, or headers
    let isTest = body.isTest || false;
    let testReason = body.testReason || null;
    
    if (!isTest) {
      if (hasTestModeParam(url)) {
        isTest = true;
        testReason = "manual_override";
      } else if (hasTestModeCookie(cookieRecord)) {
        isTest = true;
        testReason = "test_cookie";
      } else if (hasTestModeHeader(headerRecord)) {
        isTest = true;
        testReason = "test_header";
      }
    }

    // Track the event
    const eventData: CartAddEventData = {
      productType: body.productType,
      sku: body.sku,
      rearSku: body.rearSku,
      productName: body.productName,
      brand: body.brand,
      priceAtTime: body.price,
      quantity: body.quantity || 1,
      size: body.size,
      specs: body.specs,
      cartId: body.cartId,
      sessionId: body.sessionId,
      vehicle: body.vehicle,
      source: body.source,
      referrer: body.referrer,
      ipAddress,
      userAgent,
      testContext: {
        cookies: cookieRecord,
        headers: headerRecord,
        ipAddress,
      },
      isTest,
      testReason: testReason || undefined,
    };

    const event = await trackAddToCart(eventData);

    return NextResponse.json({
      success: true,
      tracked: event !== null,
      isTest: event?.isTest || isTest,
    });
  } catch (err: any) {
    console.error("[cart/add-event] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to track event" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/cart/add-event
 * 
 * Mark cart events as purchased (call from order completion)
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { cartId, orderId } = body;
    
    if (!cartId || !orderId) {
      return NextResponse.json(
        { error: "cartId and orderId are required" },
        { status: 400 }
      );
    }

    const count = await markCartEventsPurchased(cartId, orderId);

    return NextResponse.json({
      success: true,
      markedCount: count,
    });
  } catch (err: any) {
    console.error("[cart/add-event] PATCH Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to mark purchased" },
      { status: 500 }
    );
  }
}
