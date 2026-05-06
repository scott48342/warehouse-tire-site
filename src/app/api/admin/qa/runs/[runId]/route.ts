/**
 * QA Run Details API
 * 
 * GET /api/admin/qa/runs/[runId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const category = searchParams.get('category');
    const failureType = searchParams.get('failureType');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get run summary
    const runResult = await pool.query(`
      SELECT * FROM qa_runs WHERE run_id = $1
    `, [runId]);

    if (runResult.rows.length === 0) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const run = runResult.rows[0];

    // Build results query with filters
    let query = `
      SELECT 
        id,
        year,
        make,
        model,
        trim,
        category,
        is_performance,
        is_canary,
        status,
        severity,
        failure_type,
        wheel_test_passed,
        wheel_count,
        bolt_pattern,
        bolt_pattern_expected,
        bolt_pattern_match,
        staggered_detected,
        staggered_expected,
        staggered_mismatch,
        tire_test_passed,
        tire_count,
        tire_diameter,
        lifted_tests,
        package_test_passed,
        package_viable,
        error_message,
        duration_ms
      FROM qa_results
      WHERE run_id = $1
    `;

    const params: any[] = [runId];
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (severity) {
      params.push(severity);
      query += ` AND severity = $${params.length}`;
    }
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    if (failureType) {
      params.push(failureType);
      query += ` AND failure_type = $${params.length}`;
    }

    // Count total matching
    const countQuery = query.replace(/SELECT[\s\S]+FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Add pagination
    query += ` ORDER BY 
      CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        ELSE 5 
      END,
      status DESC,
      make, model, year
    `;
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const resultsResult = await pool.query(query, params);

    // Get category breakdown
    const categoryBreakdown = await pool.query(`
      SELECT 
        category,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pass') as passed,
        COUNT(*) FILTER (WHERE status = 'fail') as failed,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical
      FROM qa_results
      WHERE run_id = $1
      GROUP BY category
      ORDER BY category
    `, [runId]);

    return NextResponse.json({
      run,
      results: resultsResult.rows,
      categoryBreakdown: categoryBreakdown.rows,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[qa/runs/[runId]] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch run details' }, { status: 500 });
  }
}
