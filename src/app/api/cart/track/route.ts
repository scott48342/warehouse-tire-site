/**
 * Cart Tracking API
 * 
 * POST /api/cart/track
 * Syncs cart state to server for abandoned cart tracking.
 * 
 * Called from client when:
 * - Cart items change
 * - User enters checkout
 * - Customer info is captured
 * 
 * @created 2026-03-25
 * @updated 2026-04-05 - Added test data detection via ?test=1, cookie, header
 */

import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { trackCart, getCart, markCartRecovered, type CartTrackingData } from "@/lib/cart/abandonedCartService";
import { hasTestModeParam, hasTestModeCookie, hasTestModeHeader, TEST_MODE_HEADER } from "@/lib/testData";

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    
    const {
      cartId,
      sessionId,
      customer,
      vehicle,
      items,
      subtotal,
      estimatedTotal,
      source = "web",
      recovered,
      orderId,
      // Allow explicit test flag from client
      isTest: clientIsTest,
      testReason: clientTestReason,
    } = body as Partial<CartTrackingData & { 
      recovered?: boolean; 
      orderId?: string;
      isTest?: boolean;
      testReason?: string;
    }>;

    if (!cartId) {
      return NextResponse.json(
        { error: "cartId is required" },
        { status: 400 }
      );
    }

    // Handle recovery signal
    if (recovered && orderId) {
      const cart = await markCartRecovered(cartId, orderId);
      return NextResponse.json({
        success: true,
        cartId,
        status: cart?.status || "recovered",
        recovered: true,
      });
    }

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "items must be an array" },
        { status: 400 }
      );
    }

    // Get request metadata
    const hdrs = await headers();
    const userAgent = hdrs.get("user-agent") || undefined;
    const forwardedFor = hdrs.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || undefined;
    
    // Extract hostname for site tracking (national vs local vs POS)
    const hostname = hdrs.get("host") || hdrs.get("x-forwarded-host") || undefined;
    
    // Build test detection context from request
    const cookieHeader = hdrs.get("cookie");
    const cookieRecord = parseCookies(cookieHeader);
    const headerRecord: Record<string, string> = {};
    const testHeader = hdrs.get(TEST_MODE_HEADER);
    if (testHeader) headerRecord[TEST_MODE_HEADER] = testHeader;
    
    // Detect test mode from URL, cookies, or headers
    let isTest = clientIsTest || false;
    let testReason = clientTestReason || null;
    
    if (!isTest) {
      // Check URL param (?test=1)
      if (hasTestModeParam(url)) {
        isTest = true;
        testReason = "manual_override";
      }
      // Check cookie
      else if (hasTestModeCookie(cookieRecord)) {
        isTest = true;
        testReason = "test_cookie";
      }
      // Check header
      else if (hasTestModeHeader(headerRecord)) {
        isTest = true;
        testReason = "test_header";
      }
    }

    // Track the cart with test detection context
    const cart = await trackCart({
      cartId,
      sessionId,
      customer,
      vehicle,
      items,
      subtotal: subtotal || 0,
      estimatedTotal: estimatedTotal || 0,
      source,
      userAgent,
      ipAddress,
      // Site/hostname tracking for national vs local vs POS
      hostname,
      // Pass test context for additional detection (email pattern, etc.)
      testContext: {
        cookies: cookieRecord,
        headers: headerRecord,
      },
      // Explicit test flags if detected from URL/cookie/header
      isTest,
      testReason: testReason || undefined,
    });

    return NextResponse.json({
      success: true,
      cartId: cart.cartId,
      status: cart.status,
      itemCount: cart.itemCount,
      tracked: cart.id !== "", // False for skipped empty carts
      isTest: cart.isTest || false,
    });
  } catch (err: any) {
    console.error("[cart/track] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to track cart" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cart/track?cartId=xxx
 * Get cart tracking status (for recovery links)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cartId = url.searchParams.get("cartId");

    if (!cartId) {
      return NextResponse.json(
        { error: "cartId is required" },
        { status: 400 }
      );
    }

    const cart = await getCart(cartId);

    if (!cart) {
      return NextResponse.json(
        { error: "Cart not found" },
        { status: 404 }
      );
    }

    // Don't expose sensitive info, just status
    return NextResponse.json({
      cartId: cart.cartId,
      status: cart.status,
      itemCount: cart.itemCount,
      hasEmail: Boolean(cart.customerEmail),
      createdAt: cart.createdAt,
      lastActivityAt: cart.lastActivityAt,
    });
  } catch (err: any) {
    console.error("[cart/track] GET Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to get cart" },
      { status: 500 }
    );
  }
}
