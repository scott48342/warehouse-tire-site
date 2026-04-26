/**
 * Fitment Certification Runner
 * 
 * PHASE 2: Centralized canonical certification script.
 * This is the SINGLE SOURCE OF TRUTH validator for fitment data.
 * 
 * All imports, updates, and patches MUST go through this runner.
 */

import { Pool, PoolClient } from 'pg';
import { certifyRecord } from './rules';
import { CERTIFICATION_VERSION, CertificationStatus, CertificationError, FitmentRecord } from './types';

export interface CertificationOptions {
  /** Database pool */
  pool: Pool;
  /** Only process specific IDs (null = all needs_review) */
  ids?: string[];
  /** Dry run - don't write changes */
  dryRun?: boolean;
  /** Batch size for processing */
  batchSize?: number;
  /** Verbose logging */
  verbose?: boolean;
  /** Process all records, not just needs_review */
  processAll?: boolean;
}

export interface CertificationStats {
  version: string;
  timestamp: Date;
  processed: number;
  certified: number;
  needsReview: number;
  quarantined: number;
  skipped: number;
  errors: Record<string, number>;
}

/**
 * Run certification on a single record.
 * Returns the updated record data to be written.
 */
export function certifySingleRecord(record: FitmentRecord): {
  status: CertificationStatus;
  errors: CertificationError[];
  modified: boolean;
} {
  const errors = certifyRecord(record);
  
  if (errors.length === 0) {
    return { status: 'certified', errors: [], modified: true };
  } else {
    return { status: 'needs_review', errors, modified: true };
  }
}

/**
 * Run certification batch on all specified records.
 */
export async function runCertification(options: CertificationOptions): Promise<CertificationStats> {
  const { pool, ids, dryRun = false, batchSize = 100, verbose = false, processAll = false } = options;
  
  const stats: CertificationStats = {
    version: CERTIFICATION_VERSION,
    timestamp: new Date(),
    processed: 0,
    certified: 0,
    needsReview: 0,
    quarantined: 0,
    skipped: 0,
    errors: {},
  };
  
  const client = await pool.connect();
  
  try {
    // Build query
    let query: string;
    let params: any[] = [];
    
    if (ids && ids.length > 0) {
      query = `SELECT * FROM vehicle_fitments WHERE id = ANY($1)`;
      params = [ids];
    } else if (processAll) {
      query = `SELECT * FROM vehicle_fitments ORDER BY make, model, year`;
    } else {
      query = `SELECT * FROM vehicle_fitments WHERE certification_status = 'needs_review' OR certification_status IS NULL`;
    }
    
    const { rows } = await client.query(query, params);
    
    if (verbose) {
      console.log(`Processing ${rows.length} records...`);
    }
    
    // Process in batches
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      if (!dryRun) {
        await client.query('BEGIN');
      }
      
      for (const row of batch) {
        const record: FitmentRecord = {
          id: row.id,
          year: row.year,
          make: row.make,
          model: row.model,
          raw_trim: row.raw_trim,
          bolt_pattern: row.bolt_pattern,
          oem_wheel_sizes: row.oem_wheel_sizes || [],
          oem_tire_sizes: row.oem_tire_sizes || [],
          is_staggered: row.is_staggered,
          certification_status: row.certification_status,
          certification_errors: row.certification_errors || [],
          audit_original_data: row.audit_original_data,
        };
        
        const result = certifySingleRecord(record);
        stats.processed++;
        
        if (result.status === 'certified') {
          stats.certified++;
        } else if (result.status === 'needs_review') {
          stats.needsReview++;
          // Track error types
          for (const err of result.errors) {
            stats.errors[err.type] = (stats.errors[err.type] || 0) + 1;
          }
        } else {
          stats.quarantined++;
        }
        
        if (!dryRun && result.modified) {
          await client.query(`
            UPDATE vehicle_fitments SET
              certification_status = $1,
              certification_errors = $2,
              certified_at = CASE WHEN $1 = 'certified' THEN NOW() ELSE certified_at END,
              certified_by_script_version = CASE WHEN $1 = 'certified' THEN $3 ELSE certified_by_script_version END,
              updated_at = NOW()
            WHERE id = $4
          `, [
            result.status,
            JSON.stringify(result.errors),
            CERTIFICATION_VERSION,
            record.id,
          ]);
        }
      }
      
      if (!dryRun) {
        await client.query('COMMIT');
      }
      
      if (verbose && (i + batchSize) % 500 === 0) {
        console.log(`  Processed ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
      }
    }
    
    return stats;
    
  } finally {
    client.release();
  }
}

/**
 * Get current certification report without modifying data.
 */
export async function getCertificationReport(pool: Pool): Promise<{
  version: string;
  totals: { total: number; certified: number; needsReview: number; quarantined: number; certifiedPct: number };
  byErrorType: Record<string, number>;
  topOffenders: Array<{ make: string; model: string; count: number }>;
}> {
  const client = await pool.connect();
  
  try {
    // Get totals
    const { rows: totals } = await client.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE certification_status = 'certified')::int as certified,
        COUNT(*) FILTER (WHERE certification_status = 'needs_review')::int as needs_review,
        COUNT(*) FILTER (WHERE certification_status = 'quarantined')::int as quarantined
      FROM vehicle_fitments
    `);
    
    const t = totals[0];
    
    // Get error type breakdown
    const { rows: errRows } = await client.query(`
      SELECT 
        err->>'type' as error_type,
        COUNT(*)::int as count
      FROM vehicle_fitments,
           jsonb_array_elements(certification_errors) as err
      WHERE certification_status = 'needs_review'
      GROUP BY err->>'type'
      ORDER BY count DESC
    `);
    
    const byErrorType: Record<string, number> = {};
    for (const r of errRows) {
      byErrorType[r.error_type] = r.count;
    }
    
    // Get top offenders
    const { rows: offenders } = await client.query(`
      SELECT make, model, COUNT(*)::int as count
      FROM vehicle_fitments
      WHERE certification_status = 'needs_review'
      GROUP BY make, model
      ORDER BY count DESC
      LIMIT 15
    `);
    
    return {
      version: CERTIFICATION_VERSION,
      totals: {
        total: t.total,
        certified: t.certified,
        needsReview: t.needs_review,
        quarantined: t.quarantined,
        certifiedPct: t.total > 0 ? (t.certified / t.total) * 100 : 0,
      },
      byErrorType,
      topOffenders: offenders,
    };
    
  } finally {
    client.release();
  }
}
