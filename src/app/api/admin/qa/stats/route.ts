/**
 * QA Stats API
 * 
 * GET /api/admin/qa/stats
 * Returns aggregated QA statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';

export async function GET(req: NextRequest) {
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    // Get recent runs
    const runsResult = await pool.query(`
      SELECT 
        run_id,
        started_at,
        completed_at,
        status,
        vehicle_count,
        passed_count,
        failed_count,
        warning_count,
        critical_failures,
        high_failures,
        pass_rate,
        category_stats,
        commit_hash,
        duration_ms
      FROM qa_runs
      WHERE started_at > NOW() - INTERVAL '${days} days'
      ORDER BY started_at DESC
      LIMIT 30
    `);

    // Get latest run details
    const latestRun = runsResult.rows[0] || null;

    // Get failure breakdown for latest run
    let failureBreakdown = null;
    if (latestRun) {
      const breakdownResult = await pool.query(`
        SELECT 
          failure_type,
          severity,
          COUNT(*) as count
        FROM qa_results
        WHERE run_id = $1 AND status = 'fail'
        GROUP BY failure_type, severity
      `, [latestRun.run_id]);
      failureBreakdown = breakdownResult.rows;
    }

    // Get trend data (pass rate over time)
    const trendResult = await pool.query(`
      SELECT 
        DATE(started_at) as date,
        AVG(pass_rate) as avg_pass_rate,
        SUM(vehicle_count) as total_vehicles,
        SUM(critical_failures) as critical_failures
      FROM qa_runs
      WHERE started_at > NOW() - INTERVAL '${days} days'
        AND status = 'completed'
      GROUP BY DATE(started_at)
      ORDER BY date DESC
    `);

    // Get unresolved anomalies count
    const anomaliesResult = await pool.query(`
      SELECT 
        severity,
        COUNT(*) as count
      FROM qa_anomalies
      WHERE resolved = FALSE
      GROUP BY severity
    `);

    // Get top failing vehicles
    const topFailuresResult = await pool.query(`
      SELECT 
        year,
        make,
        model,
        trim,
        category,
        COUNT(*) as failure_count,
        array_agg(DISTINCT failure_type) as failure_types
      FROM qa_results
      WHERE status = 'fail'
        AND created_at > NOW() - INTERVAL '${days} days'
      GROUP BY year, make, model, trim, category
      ORDER BY failure_count DESC
      LIMIT 10
    `);

    return NextResponse.json({
      latestRun,
      runs: runsResult.rows,
      failureBreakdown,
      trend: trendResult.rows,
      unresolvedAnomalies: anomaliesResult.rows,
      topFailingVehicles: topFailuresResult.rows,
      queryDays: days,
    });
  } catch (err) {
    console.error('[qa/stats] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch QA stats' }, { status: 500 });
  }
}
