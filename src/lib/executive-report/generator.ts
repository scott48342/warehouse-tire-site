/**
 * Executive Report Generator
 * 
 * Generates daily executive summary data by reusing revenue dashboard queries.
 * 
 * @created 2026-06-11
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExecutiveReportData {
  generatedAt: string;
  reportDate: string; // The date being reported on (yesterday)
  
  // Executive Summary
  summary: {
    revenueYesterday: number;
    ordersYesterday: number;
    aovYesterday: number;
    revenue7d: number;
    revenue30d: number;
    orders7d: number;
    orders30d: number;
    aov7d: number;
    aov30d: number;
  };
  
  // Package Performance
  packages: {
    orders: number;
    revenue: number;
    aov: number;
    percentageOfTotal: number;
    topPackage: {
      wheel: string;
      tire: string;
      orders: number;
      revenue: number;
    } | null;
  };
  
  // Attribution
  attribution: {
    jake: { orders: number; revenue: number };
    garage: { orders: number; revenue: number };
    quickView: { orders: number; revenue: number };
  };
  
  // Conversion Funnel
  funnel: {
    vehicleSaves: number;
    vehicleRestores: number;
    garageUsers: number;
    quickViewOpens: number;
    packageBuilderEntries: number;
    cartAdds: number;
    checkoutStarts: number;
    orders: number;
  };
  
  // Top Performers
  topVehicles: Array<{ vehicle: string; orders: number; revenue: number }>;
  topPackages: Array<{ wheel: string; tire: string; orders: number; revenue: number }>;
  topTireSizes: Array<{ size: string; orders: number; revenue: number }>;
  
  // Alerts
  alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    metric: string;
    value: string;
  }>;
  
  // Query errors (if any)
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDaysAgo(days: number): Date {
  const date = getStartOfDay(new Date());
  date.setDate(date.getDate() - days);
  return date;
}

function getYesterday(): { start: Date; end: Date } {
  const today = getStartOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return { start: yesterday, end: today };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateExecutiveReport(): Promise<ExecutiveReportData> {
  const client = await pool.connect();
  const errors: string[] = [];
  
  try {
    const { start: yesterdayStart, end: yesterdayEnd } = getYesterday();
    const days7 = getDaysAgo(7);
    const days30 = getDaysAgo(30);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // REVENUE & ORDERS
    // ═══════════════════════════════════════════════════════════════════════════
    
    let summary = {
      revenueYesterday: 0,
      ordersYesterday: 0,
      aovYesterday: 0,
      revenue7d: 0,
      revenue30d: 0,
      orders7d: 0,
      orders30d: 0,
      aov7d: 0,
      aov30d: 0,
    };
    
    try {
      const { rows } = await client.query(`
        SELECT 
          SUM(CASE WHEN created_at >= $1 AND created_at < $2 THEN amount_paid_cents ELSE 0 END)::bigint as revenue_yesterday,
          SUM(CASE WHEN created_at >= $3 THEN amount_paid_cents ELSE 0 END)::bigint as revenue_7d,
          SUM(CASE WHEN created_at >= $4 THEN amount_paid_cents ELSE 0 END)::bigint as revenue_30d,
          COUNT(CASE WHEN created_at >= $1 AND created_at < $2 THEN 1 END)::int as orders_yesterday,
          COUNT(CASE WHEN created_at >= $3 THEN 1 END)::int as orders_7d,
          COUNT(CASE WHEN created_at >= $4 THEN 1 END)::int as orders_30d
        FROM orders
        WHERE status != 'cancelled'
      `, [yesterdayStart, yesterdayEnd, days7, days30]);
      
      const r = rows[0] || {};
      summary = {
        revenueYesterday: (r.revenue_yesterday || 0) / 100,
        ordersYesterday: r.orders_yesterday || 0,
        aovYesterday: r.orders_yesterday > 0 ? ((r.revenue_yesterday || 0) / 100) / r.orders_yesterday : 0,
        revenue7d: (r.revenue_7d || 0) / 100,
        revenue30d: (r.revenue_30d || 0) / 100,
        orders7d: r.orders_7d || 0,
        orders30d: r.orders_30d || 0,
        aov7d: r.orders_7d > 0 ? ((r.revenue_7d || 0) / 100) / r.orders_7d : 0,
        aov30d: r.orders_30d > 0 ? ((r.revenue_30d || 0) / 100) / r.orders_30d : 0,
      };
    } catch (e: any) {
      errors.push(`Revenue query failed: ${e.message}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PACKAGE PERFORMANCE
    // ═══════════════════════════════════════════════════════════════════════════
    
    let packages = {
      orders: 0,
      revenue: 0,
      aov: 0,
      percentageOfTotal: 0,
      topPackage: null as { wheel: string; tire: string; orders: number; revenue: number } | null,
    };
    
    try {
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
      
      packages.orders = packageRows[0]?.package_orders || 0;
      packages.revenue = (packageRows[0]?.package_revenue || 0) / 100;
      packages.aov = packages.orders > 0 ? packages.revenue / packages.orders : 0;
      packages.percentageOfTotal = summary.revenue30d > 0 
        ? (packages.revenue / summary.revenue30d) * 100 
        : 0;
      
      // Top package
      const { rows: topPkgRows } = await client.query(`
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
        LIMIT 1
      `, [days30]);
      
      if (topPkgRows[0]) {
        packages.topPackage = {
          wheel: `${topPkgRows[0].wheel_brand} ${topPkgRows[0].wheel_model}`,
          tire: `${topPkgRows[0].tire_brand} ${topPkgRows[0].tire_model}`,
          orders: topPkgRows[0].order_count,
          revenue: (topPkgRows[0].revenue || 0) / 100,
        };
      }
    } catch (e: any) {
      errors.push(`Package query failed: ${e.message}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ATTRIBUTION
    // ═══════════════════════════════════════════════════════════════════════════
    
    const attribution = {
      jake: { orders: 0, revenue: 0 },
      garage: { orders: 0, revenue: 0 },
      quickView: { orders: 0, revenue: 0 },
    };
    
    // Jake
    try {
      const { rows } = await client.query(`
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
      attribution.jake.orders = rows[0]?.jake_orders || 0;
      attribution.jake.revenue = (rows[0]?.jake_revenue || 0) / 100;
    } catch (e: any) {
      errors.push(`Jake attribution query failed: ${e.message}`);
    }
    
    // Garage
    try {
      const { rows } = await client.query(`
        SELECT 
          COUNT(DISTINCT o.id)::int as garage_orders,
          COALESCE(SUM(o.amount_paid_cents), 0)::bigint as garage_revenue
        FROM orders o
        INNER JOIN funnel_events fe ON fe.session_id = (o.snapshot_json->>'sessionId')
        WHERE o.status != 'cancelled'
          AND o.created_at >= $1
          AND fe.event_name = 'garage_vehicle_save'
      `, [days30]);
      attribution.garage.orders = rows[0]?.garage_orders || 0;
      attribution.garage.revenue = (rows[0]?.garage_revenue || 0) / 100;
    } catch (e: any) {
      errors.push(`Garage attribution query failed: ${e.message}`);
    }
    
    // Quick View
    try {
      const { rows } = await client.query(`
        SELECT 
          COUNT(DISTINCT o.id)::int as qv_orders,
          COALESCE(SUM(o.amount_paid_cents), 0)::bigint as qv_revenue
        FROM orders o
        INNER JOIN funnel_events fe ON fe.session_id = (o.snapshot_json->>'sessionId')
        WHERE o.status != 'cancelled'
          AND o.created_at >= $1
          AND fe.event_name = 'quick_view_open'
      `, [days30]);
      attribution.quickView.orders = rows[0]?.qv_orders || 0;
      attribution.quickView.revenue = (rows[0]?.qv_revenue || 0) / 100;
    } catch (e: any) {
      errors.push(`Quick view attribution query failed: ${e.message}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CONVERSION FUNNEL
    // ═══════════════════════════════════════════════════════════════════════════
    
    const funnel = {
      vehicleSaves: 0,
      vehicleRestores: 0,
      garageUsers: 0,
      quickViewOpens: 0,
      packageBuilderEntries: 0,
      cartAdds: 0,
      checkoutStarts: 0,
      orders: summary.orders30d,
    };
    
    try {
      const { rows } = await client.query(`
        SELECT 
          event_name,
          COUNT(*)::int as total,
          COUNT(DISTINCT session_id)::int as unique_sessions
        FROM funnel_events
        WHERE created_at >= $1
          AND event_name IN (
            'garage_vehicle_save',
            'garage_vehicle_restore',
            'quick_view_open',
            'package_builder_enter',
            'add_to_cart',
            'begin_checkout'
          )
        GROUP BY event_name
      `, [days30]);
      
      for (const row of rows) {
        switch (row.event_name) {
          case 'garage_vehicle_save':
            funnel.vehicleSaves = row.total;
            funnel.garageUsers = row.unique_sessions;
            break;
          case 'garage_vehicle_restore':
            funnel.vehicleRestores = row.total;
            break;
          case 'quick_view_open':
            funnel.quickViewOpens = row.total;
            break;
          case 'package_builder_enter':
            funnel.packageBuilderEntries = row.total;
            break;
          case 'add_to_cart':
            funnel.cartAdds = row.total;
            break;
          case 'begin_checkout':
            funnel.checkoutStarts = row.total;
            break;
        }
      }
    } catch (e: any) {
      errors.push(`Funnel query failed: ${e.message}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // TOP PERFORMERS
    // ═══════════════════════════════════════════════════════════════════════════
    
    let topVehicles: Array<{ vehicle: string; orders: number; revenue: number }> = [];
    let topPackages: Array<{ wheel: string; tire: string; orders: number; revenue: number }> = [];
    let topTireSizes: Array<{ size: string; orders: number; revenue: number }> = [];
    
    try {
      const { rows } = await client.query(`
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
        LIMIT 5
      `, [days30]);
      
      topVehicles = rows.map(v => ({
        vehicle: `${v.year} ${v.make} ${v.model}`,
        orders: v.order_count,
        revenue: (v.revenue || 0) / 100,
      }));
    } catch (e: any) {
      errors.push(`Top vehicles query failed: ${e.message}`);
    }
    
    try {
      const { rows } = await client.query(`
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
        LIMIT 5
      `, [days30]);
      
      topPackages = rows.map(p => ({
        wheel: `${p.wheel_brand} ${p.wheel_model}`,
        tire: `${p.tire_brand} ${p.tire_model}`,
        orders: p.order_count,
        revenue: (p.revenue || 0) / 100,
      }));
    } catch (e: any) {
      errors.push(`Top packages query failed: ${e.message}`);
    }
    
    try {
      const { rows } = await client.query(`
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
        LIMIT 5
      `, [days30]);
      
      topTireSizes = rows.map(t => ({
        size: t.tire_size,
        orders: t.order_count,
        revenue: (t.revenue || 0) / 100,
      }));
    } catch (e: any) {
      errors.push(`Top tire sizes query failed: ${e.message}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ALERTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    const alerts: ExecutiveReportData['alerts'] = [];
    
    // Check for low revenue
    const dailyAverage7d = summary.revenue7d / 7;
    if (summary.revenueYesterday < dailyAverage7d * 0.7 && dailyAverage7d > 0) {
      const percentBelow = ((dailyAverage7d - summary.revenueYesterday) / dailyAverage7d * 100).toFixed(0);
      alerts.push({
        type: 'warning',
        message: `Revenue yesterday was ${percentBelow}% below 7-day average`,
        metric: 'Revenue',
        value: `$${summary.revenueYesterday.toLocaleString()} vs $${dailyAverage7d.toLocaleString()} avg`,
      });
    }
    
    // Checkout to order drop-off
    if (funnel.checkoutStarts > 0 && funnel.orders > 0) {
      const checkoutConversion = (funnel.orders / funnel.checkoutStarts) * 100;
      if (checkoutConversion < 30) {
        alerts.push({
          type: 'warning',
          message: `Low checkout completion rate: only ${checkoutConversion.toFixed(0)}% of checkout starts converted`,
          metric: 'Checkout Conversion',
          value: `${funnel.orders} orders from ${funnel.checkoutStarts} checkouts`,
        });
      }
    }
    
    // Package builder drop-off
    if (funnel.packageBuilderEntries > 10 && packages.orders < funnel.packageBuilderEntries * 0.05) {
      alerts.push({
        type: 'warning',
        message: `Low package builder conversion: many entries but few package orders`,
        metric: 'Package Builder',
        value: `${packages.orders} orders from ${funnel.packageBuilderEntries} entries`,
      });
    }
    
    // Jake low conversion
    const jakeConversations = funnel.garageUsers; // Proxy metric
    if (attribution.jake.orders === 0 && jakeConversations > 20) {
      alerts.push({
        type: 'warning',
        message: `Jake conversations happening but no Jake-assisted orders`,
        metric: 'Jake Conversion',
        value: `0 orders from Jake sessions`,
      });
    }
    
    // Query errors
    if (errors.length > 0) {
      alerts.push({
        type: 'critical',
        message: `${errors.length} data query(s) failed - report may be incomplete`,
        metric: 'Data Quality',
        value: errors.join('; '),
      });
    }
    
    return {
      generatedAt: new Date().toISOString(),
      reportDate: yesterdayStart.toISOString().split('T')[0],
      summary,
      packages,
      attribution,
      funnel,
      topVehicles,
      topPackages,
      topTireSizes,
      alerts,
      errors,
    };
    
  } finally {
    client.release();
  }
}
