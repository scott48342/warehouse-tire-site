/**
 * Admin Abandoned Carts API
 * 
 * GET /api/admin/abandoned-carts
 * List carts with filters, get stats, email status
 * 
 * POST /api/admin/abandoned-carts
 * Actions: process, expire, test-abandon, send-email, send-all-emails
 * 
 * @created 2026-03-25
 * @updated 2026-04-03 - Full email tracking visibility
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
import {
  sendRecoveryEmail,
  processAbandonedCartEmails,
  getCartEmailStatus,
  EMAIL_SAFE_MODE,
  EMAIL_SCHEDULE,
  type EmailStep,
} from "@/lib/cart/abandonedCartEmail";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts } from "@/lib/fitment-db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/admin/abandoned-carts
 * 
 * Query params:
 * - status: filter by status
 * - includeTest: "1" to show test data (default: hidden)
 * - stats: "1" to include stats
 * - emailStatus: "1" to include email status for each cart
 * - recoverable: "1" to show only recoverable carts
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") || "all";
  const limit = Math.min(200, Number(url.searchParams.get("limit") || "50") || 50);
  const offset = Number(url.searchParams.get("offset") || "0") || 0;
  const includeStats = url.searchParams.get("stats") === "1";
  const includeEmailStatus = url.searchParams.get("emailStatus") === "1";
  const includeTest = url.searchParams.get("includeTest") === "1";
  const cartId = url.searchParams.get("cartId");
  const recoverableOnly = url.searchParams.get("recoverable") === "1";

  try {
    // Single cart lookup with email status
    if (cartId) {
      const cart = await getCart(cartId);
      if (!cart) {
        return NextResponse.json({ error: "Cart not found" }, { status: 404 });
      }

      const emailStatus = await getCartEmailStatus(cartId);
      
      return NextResponse.json({ 
        cart,
        emailStatus,
        recoveryLink: `${process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com"}/cart/recover/${cartId}`,
      });
    }

    // Determine status filter
    let statusFilter: CartStatus[] | undefined;
    if (recoverableOnly) {
      statusFilter = ["abandoned"];
    } else if (statusParam !== "all") {
      const validStatuses: CartStatus[] = ["active", "abandoned", "recovered", "expired"];
      const statuses = statusParam.split(",").filter(s => validStatuses.includes(s as CartStatus)) as CartStatus[];
      if (statuses.length > 0) {
        statusFilter = statuses;
      }
    }

    const { carts, total } = await listCarts({
      status: statusFilter,
      limit,
      offset,
      includeTest,
    });

    // Format carts with full email tracking
    const formattedCarts = await Promise.all(carts.map(async cart => {
      const emailStatus = includeEmailStatus && cart.customerEmail
        ? await getCartEmailStatus(cart.cartId)
        : null;

      return {
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
        emailTracking: {
          firstSentAt: cart.firstEmailSentAt,
          secondSentAt: cart.secondEmailSentAt,
          thirdSentAt: cart.thirdEmailSentAt,
          sentCount: cart.emailSentCount || 0,
          lastStatus: cart.lastEmailStatus,
          recoveredAfterEmail: cart.recoveredAfterEmail || false,
          unsubscribed: cart.unsubscribed || false,
        },
        // Computed status
        emailStatus: emailStatus ? {
          hasConsent: emailStatus.hasConsent,
          nextEmailStep: emailStatus.nextEmailStep,
          nextEmailDue: emailStatus.nextEmailDue,
          canSendMore: emailStatus.canSendMore,
        } : null,
        // Test data
        isTest: cart.isTest || false,
        testReason: cart.testReason || null,
      };
    }));

    const response: any = {
      carts: formattedCarts,
      total,
      limit,
      offset,
      emailConfig: {
        safeMode: EMAIL_SAFE_MODE,
        schedule: EMAIL_SCHEDULE,
      },
    };

    if (includeStats) {
      response.stats = await getStats(includeTest);
    }

    // Include test data filter state
    response.testDataFilter = {
      includeTest,
      hint: includeTest ? "Showing all data including test" : "Test data hidden (add includeTest=1 to show)",
    };

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
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, cartId, step } = body;

    switch (action) {
      case "process": {
        const count = await processAbandonedCarts();
        return NextResponse.json({
          success: true,
          action: "process",
          abandonedCount: count,
        });
      }

      case "expire": {
        const count = await expireOldCarts();
        return NextResponse.json({
          success: true,
          action: "expire",
          expiredCount: count,
        });
      }

      case "test-abandon": {
        if (!cartId) {
          return NextResponse.json(
            { error: "cartId required" },
            { status: 400 }
          );
        }

        const [updated] = await db
          .update(abandonedCarts)
          .set({
            status: "abandoned",
            abandonedAt: new Date(),
            updatedAt: new Date(),
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

      case "send-email": {
        // Send a specific email to a cart (for testing)
        if (!cartId) {
          return NextResponse.json(
            { error: "cartId required" },
            { status: 400 }
          );
        }

        const emailStep = (step || "first") as EmailStep;
        if (!["first", "second", "third"].includes(emailStep)) {
          return NextResponse.json(
            { error: "step must be first, second, or third" },
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

        const result = await sendRecoveryEmail(cart, emailStep);

        return NextResponse.json({
          success: result.success,
          action: "send-email",
          safeMode: EMAIL_SAFE_MODE,
          result,
        });
      }

      case "send-all-emails": {
        // Process all pending emails
        const result = await processAbandonedCartEmails();
        return NextResponse.json({
          success: true,
          action: "send-all-emails",
          safeMode: EMAIL_SAFE_MODE,
          ...result,
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
