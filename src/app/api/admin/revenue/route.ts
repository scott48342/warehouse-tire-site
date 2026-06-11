/**
 * Revenue Dashboard API
 * 
 * GET /api/admin/revenue
 * 
 * Returns comprehensive revenue analytics including:
 * - Revenue by period (today, 7d, 30d)
 * - Orders and AOV
 * - Attribution (Jake, Garage, Quick View, Package)
 * - Top performers (vehicles, packages, tire sizes)
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

// Date helpers
function getStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDaysAgo(days: number): Date {
  const date = getStartOfDay(new Date());
  date.setDate(date.getDate() - days);
  return date;
}

export async function GET(request: NextRequest) {
  const client = await pool.connect();

  try {
    const today = getStartOfDay(new Date());
    const days7 = getDaysAgo(7);
    const days30 = getDaysAgo(30);

    // ═══════════════════════════════════════════════════════════════════════════
    // REVENUE BY PERIOD
    // ═══════════════════════════════════════════════════════════════════════════

    const { rows: revenueRows } = await client.query(`
      SELECT 
        SUM(CASE WHEN created_at >= $1 THEN amount_paid_cents ELSE 0 END)::bigint as revenue_today,
        SUM(CASE WHEN created_at >= $2 THEN amount_paid_cents ELSE 0 END)::bigint as revenue_7d,
        SUM(CASE WHEN created_at >= $3 THEN amount_paid_cents ELSE 0 END)::bigint as revenue_30d,
        COUNT(CASE WHEN created_at >= $1 THEN 1 END)::int as orders_today,
        COUNT(CASE WHEN created_at >= $2 THEN 1 END)::int as orders_7d,
        COUNT(CASE WHEN created_at >= $3 THEN 1 END)::int as orders_30d
      FROM orders
      WHERE status != 'cancelled'
    `, [today, days7, days30]);

    const revenue = revenueRows[0] || {};
    const revenueToday = (revenue.revenue_today || 0) / 100;
    const revenue7d = (revenue.revenue_7d || 0) / 100;
    const revenue30d = (revenue.revenue_30d || 0) / 100;
    const ordersToday = revenue.orders_today || 0;
    const orders7d = revenue.orders_7d || 0;
    const orders30d = revenue.orders_30d || 0;

    const aov7d = orders7d > 0 ? revenue7d / orders7d : 0;
    const aov30d = orders30d > 0 ? revenue30d / orders30d : 0;

    // ═══════════════════════════════════════════════════════════════════════════
    // PACKAGE REVENUE (orders with package items)
    // ═══════════════════════════════════════════════════════════════════════════

    const { rows: packageRows } = await client.query(`
      SELECT 
        COUNT(*)::int as package_orders,
        SUM(amount_paid_cents)::bigint as package_revenue
      FROM orders
      WHERE status != 'cancelled'
        AND created_at >= $1
        AND (
          snapshot_json::text ILIKE '%"type":"package"%' 
          OR snapshot_json::text ILIKE '%package%'
        )
    `, [days30]);

    const packageOrders = packageRows[0]?.package_orders || 0;
    const packageRevenue = (packageRows[0]?.package_revenue || 0) / 100;

    // ═══════════════════════════════════════════════════════════════════════════
    // JAKE ASSISTED REVENUE
    // ═══════════════════════════════════════════════════════════════════════════

    let jakeRevenue = 0;
    let jakeOrders = 0;
    try {
      // Get sessions that had Jake interaction and then made a purchase
      const { rows: jakeRows } = await client.query(`
        SELECT 
          COUNT(DISTINCT o.id)::int as jake_orders,
          COALESCE(SUM(o.amount_paid_cents), 0)::bigint as jake_revenue
        FROM orders o
        WHERE o.status != 'cancelled'
          AND o.created_at >= $1
          AND EXISTS (
            SELECT 1 FROM jake_events je 
            WHERE je.session_id = (o.snapshot_json->>'sessionId')
              OR je.cart_id = o.quote_id
          )
      `, [days30]);
      jakeOrders = jakeRows[0]?.jake_orders || 0;
      jakeRevenue = (jakeRows[0]?.jake_revenue || 0) / 100;
    } catch (e) {
      // jake_events table may not exist
      console.log("[revenue] jake_events query failed:", e);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GARAGE USER REVENUE (users who saved vehicles)
    // ═══════════════════════════════════════════════════════════════════════════

    let garageRevenue = 0;
    let garageOrders = 0;
    try {
      const { rows: garageRows } = await client.query(`
        SELECT 
          COUNT(DISTINCT o.id)::int as garage_orders,
          COALESCE(SUM(o.amount_paid_cents), 0)::bigint as garage_revenue
        FROM orders o
        INNER JOIN funnel_events fe ON fe.session_id = (o.snapshot_json->>'sessionId')
        WHERE o.status != 'cancelled'
          AND o.created_at >= $1
          AND fe.event_name = 'garage_vehicle_save'
      `, [days30]);
      garageOrders = garageRows[0]?.garage_orders || 0;
      garageRevenue = (garageRows[0]?.garage_revenue || 0) / 100;
    } catch (e) {
      console.log("[revenue] garage query failed:", e);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUICK VIEW REVENUE
    // ═══════════════════════════════════════════════════════════════════════════

    let quickViewRevenue = 0;
    let quickViewOrders = 0;
    try {
      const { rows: qvRows } = await client.query(`
        SELECT 
          COUNT(DISTINCT o.id)::int as qv_orders,
          COALESCE(SUM(o.amount_paid_cents), 0)::bigint as qv_revenue
        FROM orders o
        INNER JOIN funnel_events fe ON fe.session_id = (o.snapshot_json->>'sessionId')
        WHERE o.status != 'cancelled'
          AND o.created_at >= $1
          AND fe.event_name = 'quick_view_open'
      `, [days30]);
      quickViewOrders = qvRows[0]?.qv_orders || 0;
      quickViewRevenue = (qvRows[0]?.qv_revenue || 0) / 100;
    } catch (e) {
      console.log("[revenue] quick view query failed:", e);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOP VEHICLES (by order count)
    // ═══════════════════════════════════════════════════════════════════════════

    const { rows: topVehicles } = await client.query(`
      SELECT 
        snapshot_json->'vehicle'->>'year' as year,
        snapshot_json->'vehicle'->>'make' as make,
        snapshot_json->'vehicle'->>'model' as model,
        COUNT(*)::int as order_count,
        SUM(amount_paid_cents)::bigint as revenue
      FROM orders
      WHERE status != 'cancelled'
        AND created_at >= $1
        AND snapshot_json->'vehicle'->>'make' IS NOT NULL
      GROUP BY 
        snapshot_json->'vehicle'->>'year',
        snapshot_json->'vehicle'->>'make',
        snapshot_json->'vehicle'->>'model'
      ORDER BY order_count DESC
      LIMIT 10
    `, [days30]);

    // ═══════════════════════════════════════════════════════════════════════════
    // TOP PACKAGES (wheel + tire combos)
    // ═══════════════════════════════════════════════════════════════════════════

    const { rows: topPackages } = await client.query(`
      SELECT 
        item->>'wheelBrand' as wheel_brand,
        item->>'wheelModel' as wheel_model,
        item->>'tireBrand' as tire_brand,
        item->>'tireModel' as tire_model,
        COUNT(*)::int as order_count,
        SUM((item->>'subtotalCents')::int)::bigint as revenue
      FROM orders,
        jsonb_array_elements(snapshot_json->'items') as item
      WHERE status != 'cancelled'
        AND created_at >= $1
        AND item->>'type' = 'package'
      GROUP BY 
        item->>'wheelBrand',
        item->>'wheelModel',
        item->>'tireBrand',
        item->>'tireModel'
      ORDER BY order_count DESC
      LIMIT 10
    `, [days30]);

    // ═══════════════════════════════════════════════════════════════════════════
    // TOP TIRE SIZES
    // ═══════════════════════════════════════════════════════════════════════════

    const { rows: topTireSizes } = await client.query(`
      SELECT 
        item->>'size' as tire_size,
        COUNT(*)::int as order_count,
        SUM((item->>'subtotalCents')::int)::bigint as revenue
      FROM orders,
        jsonb_array_elements(snapshot_json->'items') as item
      WHERE status != 'cancelled'
        AND created_at >= $1
        AND (item->>'type' = 'tire' OR item->>'type' = 'package')
        AND item->>'size' IS NOT NULL
      GROUP BY item->>'size'
      ORDER BY order_count DESC
      LIMIT 10
    `, [days30]);

    // ═══════════════════════════════════════════════════════════════════════════
    // DAILY REVENUE TREND (last 30 days)
    // ═══════════════════════════════════════════════════════════════════════════

    const { rows: dailyTrend } = await client.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*)::int as orders,
        SUM(amount_paid_cents)::bigint as revenue
      FROM orders
      WHERE status != 'cancelled'
        AND created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days30]);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      
      // Revenue metrics
      revenue: {
        today: revenueToday,
        days7: revenue7d,
        days30: revenue30d,
      },
      
      // Order metrics
      orders: {
        today: ordersToday,
        days7: orders7d,
        days30: orders30d,
      },
      
      // AOV
      aov: {
        days7: Math.round(aov7d * 100) / 100,
        days30: Math.round(aov30d * 100) / 100,
      },
      
      // Package metrics
      packages: {
        orders: packageOrders,
        revenue: packageRevenue,
      },
      
      // Attribution
      attribution: {
        jake: { orders: jakeOrders, revenue: jakeRevenue },
        garage: { orders: garageOrders, revenue: garageRevenue },
        quickView: { orders: quickViewOrders, revenue: quickViewRevenue },
      },
      
      // Top performers
      topVehicles: topVehicles.map(v => ({
        vehicle: `${v.year} ${v.make} ${v.model}`,
        orders: v.order_count,
        revenue: (v.revenue || 0) / 100,
      })),
      
      topPackages: topPackages.map(p => ({
        wheel: `${p.wheel_brand} ${p.wheel_model}`,
        tire: `${p.tire_brand} ${p.tire_model}`,
        orders: p.order_count,
        revenue: (p.revenue || 0) / 100,
      })),
      
      topTireSizes: topTireSizes.map(t => ({
        size: t.tire_size,
        orders: t.order_count,
        revenue: (t.revenue || 0) / 100,
      })),
      
      // Daily trend
      dailyTrend: dailyTrend.map(d => ({
        date: d.date.toISOString().split('T')[0],
        orders: d.orders,
        revenue: (d.revenue || 0) / 100,
      })),
    });

  } catch (error: any) {
    console.error("[revenue] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch revenue data" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
