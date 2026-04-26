/**
 * PHASE 4: Admin Review Queue API
 * 
 * GET /api/admin/certification/status
 * 
 * Returns current certification status and needs_review breakdown.
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  try {
    const client = await pool.connect();
    
    try {
      // Get totals
      const { rows: totals } = await client.query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE certification_status = 'certified')::int as certified,
          COUNT(*) FILTER (WHERE certification_status = 'needs_review')::int as needs_review,
          COUNT(*) FILTER (WHERE certification_status = 'quarantined')::int as quarantined,
          MAX(certified_by_script_version) as latest_version,
          MAX(certified_at) as last_certified_at
        FROM vehicle_fitments
      `);
      
      const t = totals[0];
      
      // Get error type breakdown
      const { rows: byError } = await client.query(`
        SELECT 
          err->>'type' as error_type,
          COUNT(DISTINCT id)::int as count
        FROM vehicle_fitments,
             jsonb_array_elements(CASE WHEN jsonb_array_length(certification_errors) > 0 
                                       THEN certification_errors 
                                       ELSE '[{"type":"UNKNOWN"}]'::jsonb END) as err
        WHERE certification_status = 'needs_review'
        GROUP BY err->>'type'
        ORDER BY count DESC
      `);
      
      // Get top offender families
      const { rows: offenders } = await client.query(`
        SELECT make, model, COUNT(*)::int as count
        FROM vehicle_fitments
        WHERE certification_status = 'needs_review'
        GROUP BY make, model
        ORDER BY count DESC
        LIMIT 20
      `);
      
      // Get recent needs_review records
      const { rows: recent } = await client.query(`
        SELECT id, year, make, model, raw_trim, certification_errors, updated_at
        FROM vehicle_fitments
        WHERE certification_status = 'needs_review'
        ORDER BY updated_at DESC
        LIMIT 10
      `);
      
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        totals: {
          total: t.total,
          certified: t.certified,
          needsReview: t.needs_review,
          quarantined: t.quarantined,
          certifiedPct: t.total > 0 ? ((t.certified / t.total) * 100).toFixed(2) : '0',
        },
        version: {
          current: t.latest_version || 'unknown',
          lastCertifiedAt: t.last_certified_at,
        },
        byErrorType: byError.reduce((acc, r) => {
          acc[r.error_type] = r.count;
          return acc;
        }, {} as Record<string, number>),
        topOffenders: offenders,
        recentNeedsReview: recent,
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[certification/status] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch certification status' },
      { status: 500 }
    );
  }
}
