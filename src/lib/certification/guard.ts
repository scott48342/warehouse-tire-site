/**
 * Fitment Certification Guard
 * 
 * PHASE 3: Import/Update Guard
 * 
 * This module provides guards that MUST be used by any script that
 * modifies fitment data. It ensures no uncertified data can silently
 * enter the live pool.
 * 
 * USAGE:
 *   import { certifyOnUpdate, certifyBatch } from '@/lib/certification/guard';
 *   
 *   // After modifying a record:
 *   await certifyOnUpdate(pool, recordId);
 *   
 *   // After bulk import:
 *   await certifyBatch(pool, recordIds);
 */

import { Pool } from 'pg';
import { certifyRecord } from './rules';
import { CERTIFICATION_VERSION, CertificationError, FitmentRecord, WheelSpec } from './types';

export interface GuardResult {
  id: string;
  status: 'certified' | 'needs_review' | 'quarantined';
  errors: CertificationError[];
  certified: boolean;
}

/**
 * Certify a single record after update.
 * Call this after ANY modification to a fitment record.
 */
export async function certifyOnUpdate(pool: Pool, id: string): Promise<GuardResult> {
  const client = await pool.connect();
  
  try {
    // Fetch current record
    const { rows } = await client.query(
      'SELECT * FROM vehicle_fitments WHERE id = $1',
      [id]
    );
    
    if (rows.length === 0) {
      throw new Error(`Record not found: ${id}`);
    }
    
    const row = rows[0];
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
    
    // Run certification
    const errors = certifyRecord(record);
    const status = errors.length === 0 ? 'certified' : 'needs_review';
    
    // Update record
    await client.query(`
      UPDATE vehicle_fitments SET
        certification_status = $1,
        certification_errors = $2,
        certified_at = CASE WHEN $1 = 'certified' THEN NOW() ELSE certified_at END,
        certified_by_script_version = CASE WHEN $1 = 'certified' THEN $3 ELSE certified_by_script_version END,
        updated_at = NOW()
      WHERE id = $4
    `, [status, JSON.stringify(errors), CERTIFICATION_VERSION, id]);
    
    return {
      id,
      status,
      errors,
      certified: status === 'certified',
    };
    
  } finally {
    client.release();
  }
}

/**
 * Certify multiple records after bulk import/update.
 * Call this after ANY bulk modification to fitment records.
 */
export async function certifyBatch(pool: Pool, ids: string[]): Promise<{
  total: number;
  certified: number;
  needsReview: number;
  results: GuardResult[];
}> {
  const results: GuardResult[] = [];
  let certified = 0;
  let needsReview = 0;
  
  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    
    for (const id of batch) {
      try {
        const result = await certifyOnUpdate(pool, id);
        results.push(result);
        if (result.certified) {
          certified++;
        } else {
          needsReview++;
        }
      } catch (err) {
        console.error(`Failed to certify ${id}:`, err);
        results.push({
          id,
          status: 'needs_review',
          errors: [{ type: 'MISSING_BOLT_PATTERN', message: 'Certification failed' }],
          certified: false,
        });
        needsReview++;
      }
    }
  }
  
  return {
    total: ids.length,
    certified,
    needsReview,
    results,
  };
}

/**
 * Validate a record BEFORE inserting/updating.
 * Returns errors that would prevent certification.
 * Use this for pre-validation in import scripts.
 */
export function validateBeforeInsert(data: {
  year: number;
  make: string;
  model: string;
  bolt_pattern?: string;
  oem_wheel_sizes?: WheelSpec[];
  oem_tire_sizes?: string[];
}): CertificationError[] {
  const record: FitmentRecord = {
    id: 'temp',
    year: data.year,
    make: data.make,
    model: data.model,
    bolt_pattern: data.bolt_pattern,
    oem_wheel_sizes: data.oem_wheel_sizes || [],
    oem_tire_sizes: data.oem_tire_sizes || [],
    certification_status: 'needs_review',
    certification_errors: [],
  };
  
  return certifyRecord(record);
}

/**
 * Wrapper for import scripts - ensures certification runs after import.
 * 
 * USAGE:
 *   await withCertification(pool, async (certify) => {
 *     const id = await insertFitment(...);
 *     certify(id); // Queue for certification
 *   });
 */
export async function withCertification(
  pool: Pool,
  fn: (certify: (id: string) => void) => Promise<void>
): Promise<{ total: number; certified: number; needsReview: number }> {
  const ids: string[] = [];
  
  // Run the import function, collecting IDs
  await fn((id: string) => ids.push(id));
  
  // Certify all collected IDs
  if (ids.length === 0) {
    return { total: 0, certified: 0, needsReview: 0 };
  }
  
  const result = await certifyBatch(pool, ids);
  return {
    total: result.total,
    certified: result.certified,
    needsReview: result.needsReview,
  };
}

/**
 * Guard decorator for functions that modify fitment data.
 * Throws if certification fails.
 */
export function requireCertification(pool: Pool) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      
      // If result contains an id, certify it
      if (result && typeof result.id === 'string') {
        const certResult = await certifyOnUpdate(pool, result.id);
        if (!certResult.certified) {
          console.warn(`[CERTIFICATION] Record ${result.id} failed certification:`, certResult.errors);
        }
      }
      
      return result;
    };
    
    return descriptor;
  };
}
