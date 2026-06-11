/**
 * Conversion Dashboard API
 * 
 * GET /api/admin/conversions?period=7d|30d
 * 
 * Returns aggregated conversion metrics for the admin dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

interface ConversionMetrics {
  vehicleSaves: number;
  vehicleRestores: number;
  garageUsers: number;
  quickViewOpens: number;
  jakeConversations: number;
  packageBuilderEntries: number;
  cartAdds: number;
  checkoutStarts: number;
  orders: number;
  orderValue: number;
}

interface DailyTrend {
  date: string;
  vehicleSaves: number;
  quickViews: number;
  packageBuilder: number;
  cartAdds: number;
  orders: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get("period") || "7d";

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  if (period === "7d") {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === "30d") {
    startDate.setDate(startDate.getDate() - 30);
  } else {
    startDate.setDate(startDate.getDate() - 7);
  }

  const client = await pool.connect();

  try {
    // Get funnel event counts
    const { rows: funnelCounts } = await client.query(`
      SELECT 
        event_name,
        COUNT(*)::int as total,
        COUNT(DISTINCT session_id)::int as unique_sessions
      FROM funnel_events
      WHERE created_at >= $1 AND created_at <= $2
        AND event_name IN (
          'garage_vehicle_save',
          'garage_vehicle_restore',
          'quick_view_open',
          'package_builder_enter',
          'add_to_cart',
          'begin_checkout',
          'purchase'
        )
      GROUP BY event_name
    `, [startDate, endDate]);

    const eventMap: Record<string, { total: number; unique: number }> = {};
    for (const row of funnelCounts) {
      eventMap[row.event_name] = {
        total: row.total,
        unique: row.unique_sessions,
      };
    }

    // Get unique garage users (users who saved at least one vehicle)
    const { rows: garageUsersRows } = await client.query(`
      SELECT COUNT(DISTINCT session_id)::int as count
      FROM funnel_events
      WHERE created_at >= $1 AND created_at <= $2
        AND event_name = 'garage_vehicle_save'
    `, [startDate, endDate]);
    const garageUsers = garageUsersRows[0]?.count || 0;

    // Get Jake conversations from jake_events table
    let jakeConversations = 0;
    try {
      const { rows: jakeRows } = await client.query(`
        SELECT COUNT(DISTINCT session_id)::int as count
        FROM jake_events
        WHERE created_at >= $1 AND created_at <= $2
          AND event_type = 'conversation_started'
      `, [startDate, endDate]);
      jakeConversations = jakeRows[0]?.count || 0;
    } catch (e) {
      // jake_events table may not exist
      console.log("[conversions] jake_events table not found");
    }

    // Get order value
    const { rows: orderValueRows } = await client.query(`
      SELECT COALESCE(SUM((metadata->>'cartValue')::numeric), 0)::numeric as total_value
      FROM funnel_events
      WHERE created_at >= $1 AND created_at <= $2
        AND event_name = 'purchase'
        AND metadata->>'cartValue' IS NOT NULL
    `, [startDate, endDate]);
    const orderValue = parseFloat(orderValueRows[0]?.total_value || '0');

    // Get daily trend (last 14 days)
    const { rows: dailyRows } = await client.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN event_name = 'garage_vehicle_save' THEN 1 ELSE 0 END)::int as vehicle_saves,
        SUM(CASE WHEN event_name = 'quick_view_open' THEN 1 ELSE 0 END)::int as quick_views,
        SUM(CASE WHEN event_name = 'package_builder_enter' THEN 1 ELSE 0 END)::int as package_builder,
        SUM(CASE WHEN event_name = 'add_to_cart' THEN 1 ELSE 0 END)::int as cart_adds,
        SUM(CASE WHEN event_name = 'purchase' THEN 1 ELSE 0 END)::int as orders
      FROM funnel_events
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `, [startDate, endDate]);

    const dailyTrend: DailyTrend[] = dailyRows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      vehicleSaves: row.vehicle_saves,
      quickViews: row.quick_views,
      packageBuilder: row.package_builder,
      cartAdds: row.cart_adds,
      orders: row.orders,
    }));

    const metrics: ConversionMetrics = {
      vehicleSaves: eventMap['garage_vehicle_save']?.total || 0,
      vehicleRestores: eventMap['garage_vehicle_restore']?.total || 0,
      garageUsers,
      quickViewOpens: eventMap['quick_view_open']?.total || 0,
      jakeConversations,
      packageBuilderEntries: eventMap['package_builder_enter']?.total || 0,
      cartAdds: eventMap['add_to_cart']?.total || 0,
      checkoutStarts: eventMap['begin_checkout']?.total || 0,
      orders: eventMap['purchase']?.total || 0,
      orderValue,
    };

    // Calculate conversion rates
    const conversionRates = {
      garageToCart: metrics.vehicleSaves > 0 
        ? ((metrics.cartAdds / metrics.vehicleSaves) * 100).toFixed(1) 
        : '0',
      quickViewToCart: metrics.quickViewOpens > 0 
        ? ((metrics.cartAdds / metrics.quickViewOpens) * 100).toFixed(1) 
        : '0',
      packageBuilderToCart: metrics.packageBuilderEntries > 0 
        ? ((metrics.cartAdds / metrics.packageBuilderEntries) * 100).toFixed(1) 
        : '0',
      cartToCheckout: metrics.cartAdds > 0 
        ? ((metrics.checkoutStarts / metrics.cartAdds) * 100).toFixed(1) 
        : '0',
      checkoutToOrder: metrics.checkoutStarts > 0 
        ? ((metrics.orders / metrics.checkoutStarts) * 100).toFixed(1) 
        : '0',
    };

    return NextResponse.json({
      ok: true,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      metrics,
      conversionRates,
      dailyTrend,
    });

  } catch (error) {
    console.error("[conversions] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch conversion data" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
