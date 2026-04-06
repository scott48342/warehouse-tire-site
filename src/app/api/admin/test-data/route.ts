/**
 * Admin Test Data Management API
 * 
 * GET /api/admin/test-data
 * Get test data statistics with 7-day breakdown
 * 
 * POST /api/admin/test-data
 * Mark records as test/production
 * 
 * @created 2026-04-03
 * @updated 2026-04-05 - Added 7-day summary, analytics test count
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts, emailSubscribers } from "@/lib/fitment-db/schema";
import { analyticsDb, schema as analyticsSchema } from "@/lib/analytics/db";
import { eq, and, count, sql, gte, desc } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/admin/test-data
 * Get test data statistics with 7-day breakdown
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const detailed = url.searchParams.get("detailed") === "1";
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Count test carts (total)
    const [testCartsResult] = await db
      .select({ count: count() })
      .from(abandonedCarts)
      .where(eq(abandonedCarts.isTest, true));

    // Count production carts
    const [prodCartsResult] = await db
      .select({ count: count() })
      .from(abandonedCarts)
      .where(eq(abandonedCarts.isTest, false));
      
    // Count test carts (last 7 days)
    const [testCartsWeekResult] = await db
      .select({ count: count() })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, true),
        gte(abandonedCarts.createdAt, sevenDaysAgo)
      ));

    // Count test subscribers (total)
    const [testSubsResult] = await db
      .select({ count: count() })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.isTest, true));

    // Count production subscribers
    const [prodSubsResult] = await db
      .select({ count: count() })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.isTest, false));
      
    // Count test subscribers (last 7 days)
    const [testSubsWeekResult] = await db
      .select({ count: count() })
      .from(emailSubscribers)
      .where(and(
        eq(emailSubscribers.isTest, true),
        gte(emailSubscribers.createdAt, sevenDaysAgo)
      ));

    // Count test analytics sessions (last 7 days)
    let testSessionsWeek = 0;
    try {
      const [testSessionsResult] = await analyticsDb
        .select({ count: count() })
        .from(analyticsSchema.analyticsSessions)
        .where(and(
          eq(analyticsSchema.analyticsSessions.isTest, true),
          gte(analyticsSchema.analyticsSessions.firstSeenAt, sevenDaysAgo)
        ));
      testSessionsWeek = Number(testSessionsResult?.count || 0);
    } catch {
      // Analytics table may not have is_test column yet
    }

    const response: any = {
      summary: {
        last7Days: {
          testCarts: Number(testCartsWeekResult?.count || 0),
          testSubscribers: Number(testSubsWeekResult?.count || 0),
          testSessions: testSessionsWeek,
        },
      },
      carts: {
        test: Number(testCartsResult?.count || 0),
        production: Number(prodCartsResult?.count || 0),
      },
      subscribers: {
        test: Number(testSubsResult?.count || 0),
        production: Number(prodSubsResult?.count || 0),
      },
    };

    // Include detailed test records if requested (or always for last 7 days)
    if (detailed) {
      // Get test carts (last 7 days, most recent first)
      const testCarts = await db
        .select({
          cartId: abandonedCarts.cartId,
          email: abandonedCarts.customerEmail,
          value: abandonedCarts.estimatedTotal,
          testReason: abandonedCarts.testReason,
          status: abandonedCarts.status,
          createdAt: abandonedCarts.createdAt,
        })
        .from(abandonedCarts)
        .where(and(
          eq(abandonedCarts.isTest, true),
          gte(abandonedCarts.createdAt, sevenDaysAgo)
        ))
        .orderBy(desc(abandonedCarts.createdAt))
        .limit(50);

      // Get test subscribers (last 7 days, most recent first)
      const testSubs = await db
        .select({
          id: emailSubscribers.id,
          email: emailSubscribers.email,
          source: emailSubscribers.source,
          testReason: emailSubscribers.testReason,
          createdAt: emailSubscribers.createdAt,
        })
        .from(emailSubscribers)
        .where(and(
          eq(emailSubscribers.isTest, true),
          gte(emailSubscribers.createdAt, sevenDaysAgo)
        ))
        .orderBy(desc(emailSubscribers.createdAt))
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
