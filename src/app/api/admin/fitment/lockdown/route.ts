/**
 * Fitment Lockdown Status API
 * 
 * GET /api/admin/fitment/lockdown
 * 
 * Returns current lockdown status, versions, and recent changes.
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
      // Get current stats
      const { rows: stats } = await client.query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE certification_status = 'certified')::int as certified,
          COUNT(*) FILTER (WHERE certification_status = 'needs_review')::int as needs_review,
          COUNT(*) FILTER (WHERE is_locked = TRUE)::int as locked
        FROM vehicle_fitments
      `);
      
      // Get active version
      const { rows: versions } = await client.query(`
        SELECT * FROM fitment_dataset_versions 
        WHERE status = 'active' 
        LIMIT 1
      `);
      
      // Get recent changes
      const { rows: recentChanges } = await client.query(`
        SELECT 
          fcl.id, fcl.operation, fcl.source_script, fcl.reason,
          fcl.performed_by, fcl.performed_at,
          vf.year, vf.make, vf.model
        FROM fitment_change_log fcl
        LEFT JOIN vehicle_fitments vf ON vf.id = fcl.fitment_id
        ORDER BY fcl.performed_at DESC
        LIMIT 20
      `);
      
      // Get staging stats
      const { rows: stagingStats } = await client.query(`
        SELECT 
          staging_status,
          COUNT(*)::int as count
        FROM vehicle_fitments_staging
        GROUP BY staging_status
      `);
      
      // Get version history
      const { rows: versionHistory } = await client.query(`
        SELECT version, status, certified_records, certification_pct, activated_at
        FROM fitment_dataset_versions
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      const s = stats[0];
      
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        
        lockdownStatus: {
          isLocked: s.locked === s.certified,
          lockedRecords: s.locked,
          totalRecords: s.total,
          certifiedRecords: s.certified,
          needsReviewRecords: s.needs_review,
          certificationPct: s.total > 0 ? ((s.certified / s.total) * 100).toFixed(2) : '0',
        },
        
        activeVersion: versions[0] || null,
        versionHistory,
        
        staging: {
          byStatus: stagingStats.reduce((acc, r) => {
            acc[r.staging_status] = r.count;
            return acc;
          }, {} as Record<string, number>),
        },
        
        recentChanges,
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[admin/fitment/lockdown] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch lockdown status' },
      { status: 500 }
    );
  }
}
