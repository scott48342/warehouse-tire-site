/**
 * Admin Test Data Management API
 * 
 * GET /api/admin/test-data
 * Get test data statistics
 * 
 * POST /api/admin/test-data
 * Mark records as test/production
 * 
 * @created 2026-04-03
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts, emailSubscribers } from "@/lib/fitment-db/schema";
import { eq, and, count, sql } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/admin/test-data
 * Get test data statistics
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const detailed = url.searchParams.get("detailed") === "1";

    // Count test carts
    const [testCartsResult] = await db
      .select({ count: count() })
      .from(abandonedCarts)
      .where(eq(abandonedCarts.isTest, true));

    // Count production carts
    const [prodCartsResult] = await db
      .select({ count: count() })
      .from(abandonedCarts)
      .where(eq(abandonedCarts.isTest, false));

    // Count test subscribers
    const [testSubsResult] = await db
      .select({ count: count() })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.isTest, true));

    // Count production subscribers
    const [prodSubsResult] = await db
      .select({ count: count() })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.isTest, false));

    const response: any = {
      carts: {
        test: Number(testCartsResult?.count || 0),
        production: Number(prodCartsResult?.count || 0),
      },
      subscribers: {
        test: Number(testSubsResult?.count || 0),
        production: Number(prodSubsResult?.count || 0),
      },
    };

    // Include detailed test records if requested
    if (detailed) {
      // Get test carts
      const testCarts = await db
        .select({
          cartId: abandonedCarts.cartId,
          email: abandonedCarts.customerEmail,
          value: abandonedCarts.estimatedTotal,
          testReason: abandonedCarts.testReason,
          createdAt: abandonedCarts.createdAt,
        })
        .from(abandonedCarts)
        .where(eq(abandonedCarts.isTest, true))
        .limit(50);

      // Get test subscribers
      const testSubs = await db
        .select({
          id: emailSubscribers.id,
          email: emailSubscribers.email,
          source: emailSubscribers.source,
          testReason: emailSubscribers.testReason,
          createdAt: emailSubscribers.createdAt,
        })
        .from(emailSubscribers)
        .where(eq(emailSubscribers.isTest, true))
        .limit(50);

      response.testCarts = testCarts;
      response.testSubscribers = testSubs;
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[admin/test-data] GET Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to get test data stats" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/test-data
 * 
 * Body:
 * - action: "mark-test" | "mark-production" | "detect-all"
 * - type: "cart" | "subscriber"
 * - id: record id (cartId for carts, id for subscribers)
 * - reason: (for mark-test) reason for marking as test
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, type, id, reason } = body;

    switch (action) {
      case "mark-test": {
        if (!type || !id) {
          return NextResponse.json(
            { error: "type and id required" },
            { status: 400 }
          );
        }

        if (type === "cart") {
          const [updated] = await db
            .update(abandonedCarts)
            .set({
              isTest: true,
              testReason: reason || "admin_marked",
              updatedAt: new Date(),
            })
            .where(eq(abandonedCarts.cartId, id))
            .returning();

          if (!updated) {
            return NextResponse.json({ error: "Cart not found" }, { status: 404 });
          }

          return NextResponse.json({
            success: true,
            action: "mark-test",
            type: "cart",
            cartId: id,
          });
        }

        if (type === "subscriber") {
          const [updated] = await db
            .update(emailSubscribers)
            .set({
              isTest: true,
              testReason: reason || "admin_marked",
              updatedAt: new Date(),
            })
            .where(eq(emailSubscribers.id, id))
            .returning();

          if (!updated) {
            return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
          }

          return NextResponse.json({
            success: true,
            action: "mark-test",
            type: "subscriber",
            id,
          });
        }

        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
      }

      case "mark-production": {
        if (!type || !id) {
          return NextResponse.json(
            { error: "type and id required" },
            { status: 400 }
          );
        }

        if (type === "cart") {
          await db
            .update(abandonedCarts)
            .set({
              isTest: false,
              testReason: null,
              updatedAt: new Date(),
            })
            .where(eq(abandonedCarts.cartId, id));

          return NextResponse.json({
            success: true,
            action: "mark-production",
            type: "cart",
            cartId: id,
          });
        }

        if (type === "subscriber") {
          await db
            .update(emailSubscribers)
            .set({
              isTest: false,
              testReason: null,
              updatedAt: new Date(),
            })
            .where(eq(emailSubscribers.id, id));

          return NextResponse.json({
            success: true,
            action: "mark-production",
            type: "subscriber",
            id,
          });
        }

        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
      }

      case "detect-all": {
        // Re-run detection on all records and mark as test where appropriate
        const internalPatterns = [
          '%@warehousetiredirect.com',
          '%@wtd.com',
          'test%',
          'dev%',
          '%@example.com',
          '%@test.com',
          'scott@%',
        ];

        let cartsMarked = 0;
        let subsMarked = 0;

        for (const pattern of internalPatterns) {
          const cartResult = await db.execute(sql`
            UPDATE abandoned_carts 
            SET is_test = true, test_reason = 'internal_email', updated_at = NOW()
            WHERE customer_email ILIKE ${pattern}
            AND is_test = false
          `);
          cartsMarked += (cartResult as any).rowCount || 0;

          const subResult = await db.execute(sql`
            UPDATE email_subscribers 
            SET is_test = true, test_reason = 'internal_email', updated_at = NOW()
            WHERE email ILIKE ${pattern}
            AND is_test = false
          `);
          subsMarked += (subResult as any).rowCount || 0;
        }

        return NextResponse.json({
          success: true,
          action: "detect-all",
          cartsMarked,
          subscribersMarked: subsMarked,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("[admin/test-data] POST Error:", err);
    return NextResponse.json(
      { error: err?.message || "Action failed" },
      { status: 500 }
    );
  }
}
