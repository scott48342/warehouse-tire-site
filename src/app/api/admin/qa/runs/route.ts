/**
 * QA Runs API
 * 
 * GET /api/admin/qa/runs - List runs
 * POST /api/admin/qa/runs - Trigger new run
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
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status');

    let query = `
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
        medium_failures,
        low_failures,
        logic_failures,
        inventory_failures,
        supplier_failures,
        data_gap_failures,
        pass_rate,
        category_stats,
        commit_hash,
        deployment_version,
        environment,
        base_url,
        trigger_source,
        duration_ms
      FROM qa_runs
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM qa_runs';
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    return NextResponse.json({
      runs: result.rows,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[qa/runs] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Trigger a new QA run
  // For now, return instructions - in production, this would spawn a background job
  return NextResponse.json({
    message: 'To trigger a QA run, execute: node scripts/nightly-qa/index.mjs',
    instructions: [
      'Run locally: cd warehouse-tire-site && node scripts/nightly-qa/index.mjs',
      'Quick mode: node scripts/nightly-qa/index.mjs --quick',
      'Specific category: node scripts/nightly-qa/index.mjs --category staggered',
    ],
  });
}
