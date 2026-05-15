/**
 * Jake Analytics Admin API
 * 
 * Provides aggregated analytics data for the Jake dashboard.
 * 
 * @created 2026-05-14
 */

import { NextRequest, NextResponse } from "next/server";
import { analyticsDb, schema } from "@/lib/analytics/db";
import { sql, eq, gte, and, desc, count, countDistinct, sum } from "drizzle-orm";

// Date range helpers
function getDateRange(range: string): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (range) {
    case "today":
      return today;
    case "7d":
      return new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "all":
    default:
      return new Date(0); // Beginning of time
  }
}

export async function GET(request: NextRequest) {
  try {
    const includeTest = request.nextUrl.searchParams.get("includeTest") === "1";
    const range = request.nextUrl.searchParams.get("range") || "7d";
    const hostname = request.nextUrl.searchParams.get("hostname"); // Optional site filter
    
    const startDate = getDateRange(range);
    
    // Build base filter
    const filters: any[] = [
      gte(schema.jakeAnalyticsEvents.createdAt, startDate),
    ];
    if (!includeTest) {
      filters.push(eq(schema.jakeAnalyticsEvents.isTest, false));
    }
    if (hostname) {
      filters.push(eq(schema.jakeAnalyticsEvents.hostname, hostname));
    }
    const baseFilter = and(...filters);

    // ═══════════════════════════════════════════════════════════════════════════
    // KPI METRICS
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Total conversations (unique sessions with conversation_started)
    const conversationsResult = await analyticsDb
      .select({ count: countDistinct(schema.jakeAnalyticsEvents.sessionId) })
      .from(schema.jakeAnalyticsEvents)
      .where(and(baseFilter, eq(schema.jakeAnalyticsEvents.eventName, "conversation_started")));
    
    // Jake-assisted carts
    const cartsResult = await analyticsDb
      .select({ count: count() })
      .from(schema.jakeAnalyticsEvents)
      .where(and(baseFilter, eq(schema.jakeAnalyticsEvents.eventName, "cart_created")));
    
    // Checkout starts
    const checkoutsResult = await analyticsDb
      .select({ count: count() })
      .from(schema.jakeAnalyticsEvents)
      .where(and(baseFilter, eq(schema.jakeAnalyticsEvents.eventName, "checkout_started")));
    
    // Product clicks
    const productClicksResult = await analyticsDb
      .select({ count: count() })
      .from(schema.jakeAnalyticsEvents)
      .where(and(baseFilter, eq(schema.jakeAnalyticsEvents.eventName, "product_clicked")));
    
    // Product recommendations
    const recommendationsResult = await analyticsDb
      .select({ count: count() })
      .from(schema.jakeAnalyticsEvents)
      .where(and(baseFilter, eq(schema.jakeAnalyticsEvents.eventName, "product_recommended")));
    
    // Jake opened (total opens)
    const opensResult = await analyticsDb
      .select({ count: count() })
      .from(schema.jakeAnalyticsEvents)
      .where(and(baseFilter, eq(schema.jakeAnalyticsEvents.eventName, "jake_opened")));
    
    // Total cart value
    const cartValueResult = await analyticsDb
      .select({ total: sum(schema.jakeAnalyticsEvents.cartValue) })
      .from(schema.jakeAnalyticsEvents)
      .where(and(baseFilter, eq(schema.jakeAnalyticsEvents.eventName, "cart_created")));
    
    // Order value (if available)
    const orderValueResult = await analyticsDb
      .select({ total: sum(schema.jakeAnalyticsEvents.orderValue) })
      .from(schema.jakeAnalyticsEvents)
      .where(and(baseFilter, eq(schema.jakeAnalyticsEvents.eventName, "purchase_completed")));

    // ═══════════════════════════════════════════════════════════════════════════
    // FUNNEL DATA
    // ═══════════════════════════════════════════════════════════════════════════
    
    const funnelSteps = [
      "jake_opened",
      "conversation_started",
      "product_recommended",
      "product_clicked",
      "cart_created",
      "checkout_started",
      "purchase_completed",
    ];
    
    const funnelCounts: Record<string, number> = {};
    for (const step of funnelSteps) {
      const result = await analyticsDb
        .select({ count: count() })
        .from(schema.jakeAnalyticsEvents)
        .where(and(baseFilter, eq(schema.jakeAnalyticsEvents.eventName, step)));
      funnelCounts[step] = result[0]?.count || 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOP PROMPTS/INTENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    const topIntents = await analyticsDb
      .select({
        intent: schema.jakeAnalyticsEvents.intent,
        count: count(),
      })
      .from(schema.jakeAnalyticsEvents)
      .where(and(
        baseFilter,
        eq(schema.jakeAnalyticsEvents.eventName, "conversation_started"),
        sql`${schema.jakeAnalyticsEvents.intent} IS NOT NULL`
      ))
      .groupBy(schema.jakeAnalyticsEvents.intent)
      .orderBy(desc(count()))
      .limit(10);
    
    // Recent prompts (for viewing actual customer questions)
    const recentPrompts = await analyticsDb
      .select({
        prompt: schema.jakeAnalyticsEvents.prompt,
        intent: schema.jakeAnalyticsEvents.intent,
        createdAt: schema.jakeAnalyticsEvents.createdAt,
        sessionId: schema.jakeAnalyticsEvents.sessionId,
      })
      .from(schema.jakeAnalyticsEvents)
      .where(and(
        baseFilter,
        eq(schema.jakeAnalyticsEvents.eventName, "conversation_started"),
        sql`${schema.jakeAnalyticsEvents.prompt} IS NOT NULL`
      ))
      .orderBy(desc(schema.jakeAnalyticsEvents.createdAt))
      .limit(20);

    // ═══════════════════════════════════════════════════════════════════════════
    // TOP VEHICLES
    // ═══════════════════════════════════════════════════════════════════════════
    
    const topVehicles = await analyticsDb
      .select({
        year: schema.jakeAnalyticsEvents.vehicleYear,
        make: schema.jakeAnalyticsEvents.vehicleMake,
        model: schema.jakeAnalyticsEvents.vehicleModel,
        count: count(),
      })
      .from(schema.jakeAnalyticsEvents)
      .where(and(
        baseFilter,
        sql`${schema.jakeAnalyticsEvents.vehicleMake} IS NOT NULL`
      ))
      .groupBy(
        schema.jakeAnalyticsEvents.vehicleYear,
        schema.jakeAnalyticsEvents.vehicleMake,
        schema.jakeAnalyticsEvents.vehicleModel
      )
      .orderBy(desc(count()))
      .limit(10);

    // ═══════════════════════════════════════════════════════════════════════════
    // PRODUCT PERFORMANCE
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Get recommended products with their performance
    const productRecommendations = await analyticsDb
      .select({
        sku: schema.jakeAnalyticsEvents.productSku,
        brand: schema.jakeAnalyticsEvents.productBrand,
        model: schema.jakeAnalyticsEvents.productModel,
        type: schema.jakeAnalyticsEvents.productType,
        count: count(),
      })
      .from(schema.jakeAnalyticsEvents)
      .where(and(
        baseFilter,
        eq(schema.jakeAnalyticsEvents.eventName, "product_recommended"),
        sql`${schema.jakeAnalyticsEvents.productSku} IS NOT NULL`
      ))
      .groupBy(
        schema.jakeAnalyticsEvents.productSku,
        schema.jakeAnalyticsEvents.productBrand,
        schema.jakeAnalyticsEvents.productModel,
        schema.jakeAnalyticsEvents.productType
      )
      .orderBy(desc(count()))
      .limit(20);
    
    // Get click counts per product
    const productClicks = await analyticsDb
      .select({
        sku: schema.jakeAnalyticsEvents.productSku,
        count: count(),
      })
      .from(schema.jakeAnalyticsEvents)
      .where(and(
        baseFilter,
        eq(schema.jakeAnalyticsEvents.eventName, "product_clicked"),
        sql`${schema.jakeAnalyticsEvents.productSku} IS NOT NULL`
      ))
      .groupBy(schema.jakeAnalyticsEvents.productSku);
    
    const clicksMap = Object.fromEntries(productClicks.map(p => [p.sku, p.count]));
    
    // Merge product data
    const productPerformance = productRecommendations.map(p => ({
      sku: p.sku,
      brand: p.brand,
      model: p.model,
      type: p.type,
      recommended: p.count,
      clicks: clicksMap[p.sku || ""] || 0,
      clickRate: p.count > 0 ? ((clicksMap[p.sku || ""] || 0) / p.count * 100).toFixed(1) : "0",
    }));

    // ═══════════════════════════════════════════════════════════════════════════
    // PACKAGE ANALYTICS
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Package carts (type = package or multiple items)
    const packageCarts = await analyticsDb
      .select({ count: count() })
      .from(schema.jakeAnalyticsEvents)
      .where(and(
        baseFilter,
        eq(schema.jakeAnalyticsEvents.eventName, "cart_created"),
        eq(schema.jakeAnalyticsEvents.productType, "package")
      ));
    
    // Cart type breakdown
    const cartsByType = await analyticsDb
      .select({
        type: schema.jakeAnalyticsEvents.productType,
        count: count(),
        totalValue: sum(schema.jakeAnalyticsEvents.cartValue),
      })
      .from(schema.jakeAnalyticsEvents)
      .where(and(
        baseFilter,
        eq(schema.jakeAnalyticsEvents.eventName, "cart_created")
      ))
      .groupBy(schema.jakeAnalyticsEvents.productType);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERROR LOG
    // ═══════════════════════════════════════════════════════════════════════════
    
    const recentErrors = await analyticsDb
      .select({
        id: schema.jakeAnalyticsEvents.id,
        errorType: schema.jakeAnalyticsEvents.errorType,
        errorMessage: schema.jakeAnalyticsEvents.errorMessage,
        requestId: schema.jakeAnalyticsEvents.requestId,
        prompt: schema.jakeAnalyticsEvents.prompt,
        createdAt: schema.jakeAnalyticsEvents.createdAt,
      })
      .from(schema.jakeAnalyticsEvents)
      .where(and(
        baseFilter,
        sql`${schema.jakeAnalyticsEvents.errorType} IS NOT NULL`
      ))
      .orderBy(desc(schema.jakeAnalyticsEvents.createdAt))
      .limit(50);
    
    // Error counts by type
    const errorsByType = await analyticsDb
      .select({
        type: schema.jakeAnalyticsEvents.errorType,
        count: count(),
      })
      .from(schema.jakeAnalyticsEvents)
      .where(and(
        baseFilter,
        sql`${schema.jakeAnalyticsEvents.errorType} IS NOT NULL`
      ))
      .groupBy(schema.jakeAnalyticsEvents.errorType)
      .orderBy(desc(count()));

    // ═══════════════════════════════════════════════════════════════════════════
    // DAILY TREND (last 7 days)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const dailyTrend = await analyticsDb.execute(sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE event_name = 'jake_opened') as opens,
        COUNT(*) FILTER (WHERE event_name = 'conversation_started') as conversations,
        COUNT(*) FILTER (WHERE event_name = 'cart_created') as carts,
        COUNT(*) FILTER (WHERE event_name = 'checkout_started') as checkouts
      FROM jake_analytics_events
      WHERE created_at >= ${startDate}
        ${!includeTest ? sql`AND is_test = false` : sql``}
        ${hostname ? sql`AND hostname = ${hostname}` : sql``}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    // ═══════════════════════════════════════════════════════════════════════════
    // BUILD RESPONSE
    // ═══════════════════════════════════════════════════════════════════════════
    
    const totalConversations = conversationsResult[0]?.count || 0;
    const totalCarts = cartsResult[0]?.count || 0;
    const totalCheckouts = checkoutsResult[0]?.count || 0;
    const totalOpens = opensResult[0]?.count || 0;
    
    return NextResponse.json({
      kpis: {
        opens: totalOpens,
        conversations: totalConversations,
        carts: totalCarts,
        checkouts: totalCheckouts,
        productClicks: productClicksResult[0]?.count || 0,
        recommendations: recommendationsResult[0]?.count || 0,
        cartValue: Number(cartValueResult[0]?.total || 0) / 100, // Convert cents to dollars
        orderValue: Number(orderValueResult[0]?.total || 0) / 100,
        conversionRates: {
          conversationToCart: totalConversations > 0 
            ? ((totalCarts / totalConversations) * 100).toFixed(1) 
            : "0",
          cartToCheckout: totalCarts > 0 
            ? ((totalCheckouts / totalCarts) * 100).toFixed(1) 
            : "0",
          openToConversation: totalOpens > 0
            ? ((totalConversations / totalOpens) * 100).toFixed(1)
            : "0",
        },
      },
      funnel: {
        steps: funnelSteps,
        counts: funnelCounts,
      },
      intents: {
        top: topIntents,
        recentPrompts,
      },
      vehicles: topVehicles,
      products: productPerformance,
      packages: {
        total: packageCarts[0]?.count || 0,
        byType: cartsByType.map(c => ({
          type: c.type || "unknown",
          count: c.count,
          avgValue: c.count > 0 && c.totalValue 
            ? (Number(c.totalValue) / c.count / 100).toFixed(2) 
            : "0",
        })),
      },
      errors: {
        recent: recentErrors,
        byType: errorsByType,
      },
      dailyTrend: dailyTrend.rows,
      meta: {
        range,
        startDate: startDate.toISOString(),
        includeTest,
        hostname,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Jake Analytics Admin] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
