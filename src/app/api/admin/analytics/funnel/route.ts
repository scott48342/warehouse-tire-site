/**
 * Funnel Analytics API
 * 
 * GET /api/admin/analytics/funnel?period=7d|30d&segment=device|storeMode|trafficSource
 * 
 * Returns funnel data for dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { FUNNEL_STEPS, POPUP_STEPS } from '@/lib/analytics/types';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7d';
    const segment = searchParams.get('segment'); // device, storeMode, trafficSource
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    if (period === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else {
      startDate.setFullYear(startDate.getFullYear() - 1); // 1 year max
    }
    
    const client = await pool.connect();
    
    try {
      // Get main funnel counts
      const allSteps = [...FUNNEL_STEPS, ...POPUP_STEPS];
      const eventNames = allSteps.map(s => s.name);
      
      const { rows: counts } = await client.query(`
        SELECT 
          event_name,
          COUNT(DISTINCT session_id)::int as unique_sessions,
          COUNT(*)::int as total_events
        FROM funnel_events
        WHERE created_at >= $1 AND created_at <= $2
          AND event_name = ANY($3)
        GROUP BY event_name
      `, [startDate, endDate, eventNames]);
      
      const countMap: Record<string, { sessions: number; events: number }> = {};
      for (const row of counts) {
        countMap[row.event_name] = {
          sessions: row.unique_sessions,
          events: row.total_events,
        };
      }
      
      // Build funnel with rates
      const sessionCount = countMap['session_start']?.sessions || 1;
      
      const buildSteps = (steps: typeof FUNNEL_STEPS) => {
        let prevCount = sessionCount;
        return steps.map(step => {
          const count = countMap[step.name]?.sessions || 0;
          const rate = prevCount > 0 ? (count / prevCount) * 100 : 0;
          const overallRate = sessionCount > 0 ? (count / sessionCount) * 100 : 0;
          prevCount = count || prevCount; // Don't let it go to 0
          return {
            name: step.name,
            label: step.label,
            count,
            rate: Math.round(rate * 10) / 10,
            overallRate: Math.round(overallRate * 10) / 10,
          };
        });
      };
      
      const mainFunnel = buildSteps(FUNNEL_STEPS);
      const popupFunnel = buildSteps(POPUP_STEPS);
      
      // Get segments if requested
      let segments: any = {};
      
      if (segment === 'device') {
        const { rows: deviceRows } = await client.query(`
          SELECT 
            device_type,
            event_name,
            COUNT(DISTINCT session_id)::int as count
          FROM funnel_events
          WHERE created_at >= $1 AND created_at <= $2
            AND event_name = ANY($3)
            AND device_type IS NOT NULL
          GROUP BY device_type, event_name
        `, [startDate, endDate, eventNames]);
        
        segments.byDevice = {};
        for (const row of deviceRows) {
          if (!segments.byDevice[row.device_type]) {
            segments.byDevice[row.device_type] = {};
          }
          segments.byDevice[row.device_type][row.event_name] = row.count;
        }
      }
      
      if (segment === 'storeMode') {
        const { rows: modeRows } = await client.query(`
          SELECT 
            store_mode,
            event_name,
            COUNT(DISTINCT session_id)::int as count
          FROM funnel_events
          WHERE created_at >= $1 AND created_at <= $2
            AND event_name = ANY($3)
            AND store_mode IS NOT NULL
          GROUP BY store_mode, event_name
        `, [startDate, endDate, eventNames]);
        
        segments.byStoreMode = {};
        for (const row of modeRows) {
          if (!segments.byStoreMode[row.store_mode]) {
            segments.byStoreMode[row.store_mode] = {};
          }
          segments.byStoreMode[row.store_mode][row.event_name] = row.count;
        }
      }
      
      if (segment === 'trafficSource') {
        const { rows: sourceRows } = await client.query(`
          SELECT 
            traffic_source,
            event_name,
            COUNT(DISTINCT session_id)::int as count
          FROM funnel_events
          WHERE created_at >= $1 AND created_at <= $2
            AND event_name = ANY($3)
            AND traffic_source IS NOT NULL
          GROUP BY traffic_source, event_name
          ORDER BY COUNT(DISTINCT session_id) DESC
        `, [startDate, endDate, eventNames]);
        
        segments.byTrafficSource = {};
        for (const row of sourceRows) {
          if (!segments.byTrafficSource[row.traffic_source]) {
            segments.byTrafficSource[row.traffic_source] = {};
          }
          segments.byTrafficSource[row.traffic_source][row.event_name] = row.count;
        }
      }
      
      // Get top drop-off points
      const dropOffs = mainFunnel.slice(1).map((step, i) => ({
        from: mainFunnel[i].label,
        to: step.label,
        dropRate: 100 - step.rate,
        lost: mainFunnel[i].count - step.count,
      })).sort((a, b) => b.dropRate - a.dropRate);
      
      return NextResponse.json({
        ok: true,
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        mainFunnel,
        popupFunnel,
        segments,
        dropOffs: dropOffs.slice(0, 5),
        summary: {
          totalSessions: sessionCount,
          totalPurchases: countMap['purchase']?.sessions || 0,
          conversionRate: sessionCount > 0 
            ? ((countMap['purchase']?.sessions || 0) / sessionCount * 100).toFixed(2)
            : '0',
          avgCartValue: 0, // TODO: Calculate from purchase events
        },
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[admin/analytics/funnel] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch funnel data' },
      { status: 500 }
    );
  }
}
