/**
 * Admin Abandoned Carts API
 * 
 * GET /api/admin/abandoned-carts
 * List carts with filters, get stats
 * 
 * POST /api/admin/abandoned-carts
 * Actions: process (mark abandoned), expire (old carts), test-abandon (dev)
 * 
 * @created 2026-03-25
 */

import { NextResponse } from "next/server";
import {
  listCarts,
  getStats,
  processAbandonedCarts,
  expireOldCarts,
  getCart,
  type CartStatus,
} from "@/lib/cart/abandonedCartService";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts } from "@/lib/fitment-db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/admin/abandoned-carts
 * 
 * Query params:
 * - status: "active" | "abandoned" | "recovered" | "expired" | "all"
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - stats: "1" to include stats
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") || "all";
  const limit = Math.min(200, Number(url.searchParams.get("limit") || "50") || 50);
  const offset = Number(url.searchParams.get("offset") || "0") || 0;
  const includeStats = url.searchParams.get("stats") === "1";
  const cartId = url.searchParams.get("cartId");

  try {
    // Single cart lookup
    if (cartId) {
      const cart = await getCart(cartId);
      if (!cart) {
        return NextResponse.json({ error: "Cart not found" }, { status: 404 });
      }
      return NextResponse.json({ cart });
    }

    // Determine status filter
    let statusFilter: CartStatus[] | undefined;
    if (statusParam !== "all") {
      const validStatuses: CartStatus[] = ["active", "abandoned", "recovered", "expired"];
      const statuses = statusParam.split(",").filter(s => validStatuses.includes(s as CartStatus)) as CartStatus[];
      if (statuses.length > 0) {
        statusFilter = statuses;
      }
    }

    // Get carts
    const { carts, total } = await listCarts({
      status: statusFilter,
      limit,
      offset,
    });

    // Format carts for admin display
    const formattedCarts = carts.map(cart => ({
      id: cart.id,
      cartId: cart.cartId,
      customer: cart.customerEmail 
        ? `${cart.customerFirstName || ""} ${cart.customerLastName || ""}`.trim() || cart.customerEmail
        : null,
      email: cart.customerEmail,
      phone: cart.customerPhone,
      vehicle: cart.vehicleYear 
        ? `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel}${cart.vehicleTrim ? ` ${cart.vehicleTrim}` : ""}`
        : null,
      itemCount: cart.itemCount,
      value: Number(cart.estimatedTotal),
      status: cart.status,
      recoveredOrderId: cart.recoveredOrderId,
      createdAt: cart.createdAt,
      lastActivityAt: cart.lastActivityAt,
      abandonedAt: cart.abandonedAt,
      recoveredAt: cart.recoveredAt,
      // Email tracking
      firstEmailSentAt: cart.firstEmailSentAt,
      secondEmailSentAt: cart.secondEmailSentAt,
      emailSentCount: cart.emailSentCount || 0,
      recoveredAfterEmail: cart.recoveredAfterEmail || false,
    }));

    const response: any = {
      carts: formattedCarts,
      total,
      limit,
      offset,
    };

    // Include stats if requested
    if (includeStats) {
      response.stats = await getStats();
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[admin/abandoned-carts] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch carts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/abandoned-carts
 * 
 * Body:
 * - action: "process" | "expire" | "test-abandon" | "stats"
 * - cartId: (for test-abandon) cart to mark as abandoned
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, cartId } = body;

    switch (action) {
      case "process": {
        // Process abandoned carts (mark inactive as abandoned)
        const count = await processAbandonedCarts();
        return NextResponse.json({
          success: true,
          action: "process",
          abandonedCount: count,
        });
      }

      case "expire": {
        // Expire old carts
        const count = await expireOldCarts();
        return NextResponse.json({
          success: true,
          action: "expire",
          expiredCount: count,
        });
      }

      case "test-abandon": {
        // For testing: immediately mark a cart as abandoned
        if (!cartId) {
          return NextResponse.json(
            { error: "cartId required for test-abandon" },
            { status: 400 }
          );
        }

        const [updated] = await db
          .update(abandonedCarts)
          .set({
            status: "abandoned",
            abandonedAt: new Date(),
            updatedAt: new Date(),
            // Set lastActivityAt to 2 hours ago to simulate abandonment
            lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          })
          .where(eq(abandonedCarts.cartId, cartId))
          .returning();

        if (!updated) {
          return NextResponse.json(
            { error: "Cart not found" },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          action: "test-abandon",
          cart: {
            cartId: updated.cartId,
            status: updated.status,
            abandonedAt: updated.abandonedAt,
          },
        });
      }

      case "stats": {
        const stats = await getStats();
        return NextResponse.json({ stats });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("[admin/abandoned-carts] POST Error:", err);
    return NextResponse.json(
      { error: err?.message || "Action failed" },
      { status: 500 }
    );
  }
}
