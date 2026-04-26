/**
 * Fitment Lockdown System
 * 
 * Enforces read-only access to production fitment data.
 * All mutations must go through staging + certification + promotion.
 */

import { Pool } from 'pg';

export const CURRENT_DATASET_VERSION = 'v1.0.0-initial';

// ============================================================================
// READ-ONLY QUERIES (Safe for app runtime)
// ============================================================================

/**
 * Get certified fitment by YMM - READ ONLY
 * This is the ONLY way the app should query fitment data.
 */
export async function getCertifiedFitment(
  pool: Pool,
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<any | null> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT * FROM certified_vehicle_fitments
      WHERE year = $1 
        AND LOWER(make) = LOWER($2) 
        AND LOWER(model) = LOWER($3)
        ${trim ? "AND LOWER(raw_trim) = LOWER($4)" : ""}
      LIMIT 1
    `, trim ? [year, make, model, trim] : [year, make, model]);
    
    return rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Get all certified fitments for a make/model - READ ONLY
 */
export async function getCertifiedFitmentsByModel(
  pool: Pool,
  make: string,
  model: string
): Promise<any[]> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT * FROM certified_vehicle_fitments
      WHERE LOWER(make) = LOWER($1) 
        AND LOWER(model) = LOWER($2)
      ORDER BY year DESC
    `, [make, model]);
    
    return rows;
  } finally {
    client.release();
  }
}

/**
 * Check if fitment exists and is certified - READ ONLY
 */
export async function isFitmentCertified(
  pool: Pool,
  year: number,
  make: string,
  model: string
): Promise<boolean> {
  const fitment = await getCertifiedFitment(pool, year, make, model);
  return fitment !== null;
}

// ============================================================================
// STAGING OPERATIONS (For approved import scripts only)
// ============================================================================

export interface StagingRecord {
  year: number;
  make: string;
  model: string;
  rawTrim?: string;
  boltPattern?: string;
  centerBoreMm?: number;
  oemWheelSizes: any[];
  oemTireSizes: string[];
  isStaggered?: boolean;
  liveFitmentId?: string;
  sourceScript: string;
  sourceVersion: string;
}

/**
 * Stage a fitment record for review and certification.
 * Does NOT affect production data.
 */
export async function stageFitment(
  pool: Pool,
  record: StagingRecord,
  batchId: string
): Promise<string> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      INSERT INTO vehicle_fitments_staging (
        year, make, model, raw_trim, bolt_pattern, center_bore_mm,
        oem_wheel_sizes, oem_tire_sizes, is_staggered,
        staging_status, source_script, source_version, batch_id, live_fitment_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11, $12, $13)
      RETURNING id
    `, [
      record.year,
      record.make,
      record.model,
      record.rawTrim || null,
      record.boltPattern || null,
      record.centerBoreMm || null,
      JSON.stringify(record.oemWheelSizes),
      JSON.stringify(record.oemTireSizes),
      record.isStaggered || false,
      record.sourceScript,
      record.sourceVersion,
      batchId,
      record.liveFitmentId || null,
    ]);
    
    return rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * Stage multiple fitment records in batch.
 */
export async function stageFitmentBatch(
  pool: Pool,
  records: StagingRecord[],
  batchId: string
): Promise<string[]> {
  const ids: string[] = [];
  for (const record of records) {
    const id = await stageFitment(pool, record, batchId);
    ids.push(id);
  }
  return ids;
}

// ============================================================================
// PROMOTION OPERATIONS (Admin only, requires certification)
// ============================================================================

/**
 * Promote certified staged records to production.
 * This is the ONLY way to add/update production fitment data.
 */
export async function promoteStagedRecords(
  pool: Pool,
  batchId: string,
  promotedBy: string,
  newVersion: string,
  reason: string
): Promise<{ promoted: number; skipped: number }> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get certified staged records
    const { rows: staged } = await client.query(`
      SELECT * FROM vehicle_fitments_staging
      WHERE batch_id = $1 AND staging_status = 'certified'
    `, [batchId]);
    
    let promoted = 0;
    let skipped = 0;
    
    for (const record of staged) {
      // Log the change
      await client.query(`
        INSERT INTO fitment_change_log (
          fitment_id, operation, old_data, new_data,
          source_script, source_version, reason, performed_by, batch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        record.live_fitment_id || record.id,
        record.live_fitment_id ? 'UPDATE' : 'INSERT',
        null, // TODO: Fetch old data if updating
        JSON.stringify(record),
        record.source_script,
        record.source_version,
        reason,
        promotedBy,
        batchId,
      ]);
      
      if (record.live_fitment_id) {
        // Update existing record
        await client.query(`
          UPDATE vehicle_fitments SET
            bolt_pattern = $1,
            oem_wheel_sizes = $2,
            oem_tire_sizes = $3,
            is_staggered = $4,
            certification_status = 'certified',
            certification_errors = '[]'::jsonb,
            is_locked = TRUE,
            dataset_version = $5,
            last_modified_by = $6,
            last_modified_reason = $7,
            updated_at = NOW()
          WHERE id = $8
        `, [
          record.bolt_pattern,
          record.oem_wheel_sizes,
          record.oem_tire_sizes,
          record.is_staggered,
          newVersion,
          promotedBy,
          reason,
          record.live_fitment_id,
        ]);
      } else {
        // Insert new record
        await client.query(`
          INSERT INTO vehicle_fitments (
            year, make, model, raw_trim, bolt_pattern, center_bore_mm,
            oem_wheel_sizes, oem_tire_sizes, is_staggered,
            certification_status, certification_errors,
            is_locked, dataset_version, last_modified_by, last_modified_reason
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'certified', '[]'::jsonb, TRUE, $10, $11, $12)
        `, [
          record.year,
          record.make,
          record.model,
          record.raw_trim,
          record.bolt_pattern,
          record.center_bore_mm,
          record.oem_wheel_sizes,
          record.oem_tire_sizes,
          record.is_staggered,
          newVersion,
          promotedBy,
          reason,
        ]);
      }
      
      // Mark staged record as promoted
      await client.query(`
        UPDATE vehicle_fitments_staging SET
          staging_status = 'promoted',
          promoted_at = NOW(),
          promoted_by = $1
        WHERE id = $2
      `, [promotedBy, record.id]);
      
      promoted++;
    }
    
    await client.query('COMMIT');
    
    return { promoted, skipped };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// VERSION MANAGEMENT
// ============================================================================

/**
 * Create a new dataset version.
 */
export async function createDatasetVersion(
  pool: Pool,
  version: string,
  description: string,
  createdBy: string
): Promise<void> {
  const client = await pool.connect();
  try {
    // Get current stats
    const { rows: stats } = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE certification_status = 'certified') as certified,
        COUNT(*) FILTER (WHERE certification_status = 'needs_review') as needs_review
      FROM vehicle_fitments
    `);
    
    const s = stats[0];
    
    await client.query(`
      INSERT INTO fitment_dataset_versions (
        version, status, total_records, certified_records, needs_review_records,
        certification_pct, source_description, created_by
      ) VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7)
    `, [
      version,
      s.total,
      s.certified,
      s.needs_review,
      s.total > 0 ? (s.certified / s.total * 100).toFixed(2) : 0,
      description,
      createdBy,
    ]);
  } finally {
    client.release();
  }
}

/**
 * Activate a dataset version (marks it as production).
 */
export async function activateDatasetVersion(
  pool: Pool,
  version: string,
  activatedBy: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Archive current active version
    await client.query(`
      UPDATE fitment_dataset_versions 
      SET status = 'archived', archived_at = NOW()
      WHERE status = 'active'
    `);
    
    // Activate new version
    await client.query(`
      UPDATE fitment_dataset_versions 
      SET status = 'active', activated_at = NOW(), activated_by = $1
      WHERE version = $2
    `, [activatedBy, version]);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get current active dataset version.
 */
export async function getActiveDatasetVersion(pool: Pool): Promise<any | null> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT * FROM fitment_dataset_versions WHERE status = 'active' LIMIT 1
    `);
    return rows[0] || null;
  } finally {
    client.release();
  }
}

// ============================================================================
// AUDIT QUERIES
// ============================================================================

/**
 * Get change history for a fitment record.
 */
export async function getFitmentChangeHistory(
  pool: Pool,
  fitmentId: string
): Promise<any[]> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT * FROM fitment_change_log
      WHERE fitment_id = $1
      ORDER BY performed_at DESC
    `, [fitmentId]);
    return rows;
  } finally {
    client.release();
  }
}

/**
 * Get recent changes across all fitments.
 */
export async function getRecentFitmentChanges(
  pool: Pool,
  limit: number = 50
): Promise<any[]> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT * FROM fitment_change_log
      ORDER BY performed_at DESC
      LIMIT $1
    `, [limit]);
    return rows;
  } finally {
    client.release();
  }
}
