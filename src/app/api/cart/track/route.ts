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
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { trackCart, getCart, markCartRecovered, type CartTrackingData } from "@/lib/cart/abandonedCartService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
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
    } = body as Partial<CartTrackingData & { recovered?: boolean; orderId?: string }>;

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

    // Track the cart
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
    });

    return NextResponse.json({
      success: true,
      cartId: cart.cartId,
      status: cart.status,
      itemCount: cart.itemCount,
      tracked: cart.id !== "", // False for skipped empty carts
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
