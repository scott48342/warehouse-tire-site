/**
 * Fitment Pipeline Runner
 * 
 * Orchestrates the discovery → validation → promotion pipeline
 * for new model year fitment data.
 * 
 * Usage:
 *   npx tsx scripts/fitment-pipeline/run-pipeline.ts discover --year 2027
 *   npx tsx scripts/fitment-pipeline/run-pipeline.ts validate
 *   npx tsx scripts/fitment-pipeline/run-pipeline.ts promote [--dry-run]
 *   npx tsx scripts/fitment-pipeline/run-pipeline.ts report
 * 
 * NON-NEGOTIABLE: NO AUTO-PUBLISH TO PRODUCTION
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { validateStagedRecord } from "../../src/lib/fitment-pipeline/validation-rules";

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PipelineRun {
  id: string;
  runType: string;
  targetYear?: number;
  startedAt: Date;
  recordsDiscovered: number;
  recordsValidated: number;
  recordsFlagged: number;
  recordsPromoted: number;
  recordsSkipped: number;
}

interface PipelineSummary {
  runId: string;
  runType: string;
  timestamp: string;
  duration: number;
  counts: {
    discovered: number;
    validated: number;
    flagged: number;
    promoted: number;
    skipped: number;
  };
  flaggedRecords: Array<{
    year: number;
    make: string;
    model: string;
    trim: string;
    flags: string[];
  }>;
  promotedRecords: Array<{
    year: number;
    make: string;
    model: string;
    trim: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// DISCOVERY PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

async function runDiscovery(pool: pg.Pool, targetYear: number): Promise<PipelineRun> {
  const runId = uuidv4();
  const startedAt = new Date();
  
  console.log(`\n═══ DISCOVERY PIPELINE ═══`);
  console.log(`Run ID: ${runId}`);
  console.log(`Target Year: ${targetYear}\n`);
  
  const client = await pool.connect();
  let discovered = 0;
  let skipped = 0;
  
  try {
    // Start pipeline run record
    await client.query(`
      INSERT INTO fitment_pipeline_runs (id, run_type, target_year, started_at, status)
      VALUES ($1, 'discovery', $2, $3, 'running')
    `, [runId, targetYear, startedAt]);
    
    // Check for new records in source tables that aren't in staging or production
    // This is a placeholder - actual discovery would query external APIs or source tables
    
    // For now, check fitment_source_records for new 2027 data
    const { rows: sourceRecords } = await client.query(`
      SELECT fsr.id, fsr.source, fsr.source_id, fsr.year, fsr.make, fsr.model, fsr.raw_payload
      FROM fitment_source_records fsr
      WHERE fsr.year = $1
        AND NOT EXISTS (
          SELECT 1 FROM fitment_staging fs 
          WHERE fs.source = fsr.source AND fs.source_record_id = fsr.source_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM vehicle_fitments vf
          WHERE vf.year = fsr.year AND vf.make = fsr.make AND vf.model = fsr.model
        )
      LIMIT 1000
    `, [targetYear]);
    
    console.log(`Found ${sourceRecords.length} new source records for ${targetYear}`);
    
    for (const record of sourceRecords) {
      try {
        // Parse raw payload and extract fitment data
        const payload = record.raw_payload as any;
        
        // Insert into staging
        await client.query(`
          INSERT INTO fitment_staging (
            year, make, model, raw_trim, display_trim, source, source_record_id,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
            raw_payload, status, discovered_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pending', NOW())
          ON CONFLICT (source, source_record_id) DO NOTHING
        `, [
          record.year,
          record.make,
          record.model,
          payload.trim || payload.raw_trim,
          payload.display_trim || payload.trim || 'Base',
          record.source,
          record.source_id,
          payload.bolt_pattern,
          payload.center_bore_mm,
          payload.thread_size,
          payload.seat_type,
          payload.offset_min_mm,
          payload.offset_max_mm,
          JSON.stringify(payload.oem_wheel_sizes || []),
          JSON.stringify(payload.oem_tire_sizes || []),
          JSON.stringify(payload),
        ]);
        
        discovered++;
        
        // Log discovery
        await client.query(`
          INSERT INTO fitment_change_log (staging_id, action, year, make, model, trim, timestamp)
          SELECT id, 'discovered', year, make, model, display_trim, NOW()
          FROM fitment_staging
          WHERE source = $1 AND source_record_id = $2
        `, [record.source, record.source_id]);
        
      } catch (err: any) {
        console.error(`  Error staging ${record.make}/${record.model}:`, err.message);
        skipped++;
      }
    }
    
    // Update run record
    await client.query(`
      UPDATE fitment_pipeline_runs
      SET completed_at = NOW(),
          duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
          records_discovered = $2,
          records_skipped = $3,
          status = 'completed'
      WHERE id = $1
    `, [runId, discovered, skipped]);
    
    console.log(`\n✅ Discovery complete: ${discovered} new records staged, ${skipped} skipped`);
    
  } finally {
    client.release();
  }
  
  return {
    id: runId,
    runType: 'discovery',
    targetYear,
    startedAt,
    recordsDiscovered: discovered,
    recordsValidated: 0,
    recordsFlagged: 0,
    recordsPromoted: 0,
    recordsSkipped: skipped,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

async function runValidation(pool: pg.Pool): Promise<PipelineRun> {
  const runId = uuidv4();
  const startedAt = new Date();
  
  console.log(`\n═══ VALIDATION PIPELINE ═══`);
  console.log(`Run ID: ${runId}\n`);
  
  const client = await pool.connect();
  let validated = 0;
  let flagged = 0;
  
  try {
    // Start pipeline run record
    await client.query(`
      INSERT INTO fitment_pipeline_runs (id, run_type, started_at, status)
      VALUES ($1, 'validation', $2, 'running')
    `, [runId, startedAt]);
    
    // Get all pending staged records
    const { rows: pendingRecords } = await client.query(`
      SELECT id, year, make, model, display_trim, bolt_pattern, center_bore_mm,
             thread_size, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes
      FROM fitment_staging
      WHERE status = 'pending'
      ORDER BY year, make, model
    `);
    
    console.log(`Found ${pendingRecords.length} pending records to validate\n`);
    
    for (const record of pendingRecords) {
      // Run validation
      const result = validateStagedRecord({
        id: record.id,
        year: record.year,
        make: record.make,
        model: record.model,
        displayTrim: record.display_trim,
        boltPattern: record.bolt_pattern,
        centerBoreMm: parseFloat(record.center_bore_mm),
        threadSize: record.thread_size,
        offsetMinMm: parseFloat(record.offset_min_mm),
        offsetMaxMm: parseFloat(record.offset_max_mm),
        oemWheelSizes: record.oem_wheel_sizes,
        oemTireSizes: record.oem_tire_sizes,
      });
      
      // Store audit results
      for (const check of result.checks) {
        await client.query(`
          INSERT INTO fitment_staging_audit (staging_id, run_id, run_timestamp, check_name, check_passed, check_severity, check_message, check_details)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [record.id, runId, startedAt, check.name, check.passed, check.severity, check.message, JSON.stringify(check.details || {})]);
      }
      
      // Update staging record
      const newStatus = result.passed ? 'validated' : 'flagged';
      await client.query(`
        UPDATE fitment_staging
        SET status = $2,
            validation_passed = $3,
            validation_flags = $4,
            validation_notes = $5,
            confidence = $6,
            validated_at = NOW()
        WHERE id = $1
      `, [
        record.id,
        newStatus,
        result.passed,
        JSON.stringify(result.flags),
        result.checks.filter(c => !c.passed).map(c => c.message).join('; '),
        result.confidence,
      ]);
      
      // Log validation result
      await client.query(`
        INSERT INTO fitment_change_log (staging_id, action, year, make, model, trim, reason, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        record.id,
        newStatus === 'validated' ? 'validated' : 'flagged',
        record.year,
        record.make,
        record.model,
        record.display_trim,
        result.passed ? 'All checks passed' : result.flags.join(', '),
      ]);
      
      if (result.passed) {
        validated++;
      } else {
        flagged++;
        console.log(`  ⚠️ ${record.year} ${record.make} ${record.model}: ${result.flags.join(', ')}`);
      }
    }
    
    // Update run record
    await client.query(`
      UPDATE fitment_pipeline_runs
      SET completed_at = NOW(),
          duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
          records_validated = $2,
          records_flagged = $3,
          status = 'completed'
      WHERE id = $1
    `, [runId, validated, flagged]);
    
    console.log(`\n✅ Validation complete: ${validated} passed, ${flagged} flagged`);
    
  } finally {
    client.release();
  }
  
  return {
    id: runId,
    runType: 'validation',
    startedAt,
    recordsDiscovered: 0,
    recordsValidated: validated,
    recordsFlagged: flagged,
    recordsPromoted: 0,
    recordsSkipped: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMOTION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

async function runPromotion(pool: pg.Pool, dryRun: boolean): Promise<PipelineRun> {
  const runId = uuidv4();
  const startedAt = new Date();
  
  console.log(`\n═══ PROMOTION PIPELINE ═══`);
  console.log(`Run ID: ${runId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : '🔴 LIVE'}\n`);
  
  const client = await pool.connect();
  let promoted = 0;
  let skipped = 0;
  
  try {
    if (!dryRun) {
      await client.query(`
        INSERT INTO fitment_pipeline_runs (id, run_type, started_at, status)
        VALUES ($1, 'promotion', $2, 'running')
      `, [runId, startedAt]);
    }
    
    // Get all validated records ready for promotion
    const { rows: validatedRecords } = await client.query(`
      SELECT id, year, make, model, display_trim, modification_id, bolt_pattern, center_bore_mm,
             thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
             source, source_record_id, confidence
      FROM fitment_staging
      WHERE status = 'validated'
        AND confidence IN ('high', 'medium')
      ORDER BY year, make, model
    `);
    
    console.log(`Found ${validatedRecords.length} validated records ready for promotion\n`);
    
    for (const record of validatedRecords) {
      // Check if record already exists in production
      const { rows: existing } = await client.query(`
        SELECT id FROM vehicle_fitments
        WHERE year = $1 AND make = $2 AND model = $3 AND modification_id = $4
      `, [record.year, record.make, record.model, record.modification_id || `staged_${record.id.substring(0, 8)}`]);
      
      if (existing.length > 0) {
        console.log(`  ⏭️ ${record.year} ${record.make} ${record.model}: Already exists`);
        skipped++;
        continue;
      }
      
      if (!dryRun) {
        // Insert into production
        const modId = record.modification_id || `pipeline_${record.id.substring(0, 12)}`;
        
        await client.query(`
          INSERT INTO vehicle_fitments (
            year, make, model, modification_id, raw_trim, display_trim,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
            source, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        `, [
          record.year,
          record.make,
          record.model,
          modId,
          record.display_trim,
          record.display_trim,
          record.bolt_pattern,
          record.center_bore_mm,
          record.thread_size,
          record.seat_type,
          record.offset_min_mm,
          record.offset_max_mm,
          JSON.stringify(record.oem_wheel_sizes),
          JSON.stringify(record.oem_tire_sizes),
          `${record.source} [pipeline:${runId.substring(0, 8)}]`,
        ]);
        
        // Update staging status
        await client.query(`
          UPDATE fitment_staging
          SET status = 'promoted', promoted_at = NOW()
          WHERE id = $1
        `, [record.id]);
        
        // Log promotion
        await client.query(`
          INSERT INTO fitment_change_log (staging_id, action, year, make, model, trim, timestamp)
          VALUES ($1, 'promoted', $2, $3, $4, $5, NOW())
        `, [record.id, record.year, record.make, record.model, record.display_trim]);
      }
      
      promoted++;
      console.log(`  ✅ ${record.year} ${record.make} ${record.model} "${record.display_trim}"`);
    }
    
    if (!dryRun) {
      await client.query(`
        UPDATE fitment_pipeline_runs
        SET completed_at = NOW(),
            duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
            records_promoted = $2,
            records_skipped = $3,
            status = 'completed'
        WHERE id = $1
      `, [runId, promoted, skipped]);
    }
    
    console.log(`\n✅ Promotion complete: ${promoted} promoted, ${skipped} skipped`);
    
  } finally {
    client.release();
  }
  
  return {
    id: runId,
    runType: 'promotion',
    startedAt,
    recordsDiscovered: 0,
    recordsValidated: 0,
    recordsFlagged: 0,
    recordsPromoted: promoted,
    recordsSkipped: skipped,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════════════════════════

async function generateReport(pool: pg.Pool): Promise<PipelineSummary> {
  console.log(`\n═══ PIPELINE REPORT ═══\n`);
  
  const client = await pool.connect();
  
  try {
    // Get staging summary by status
    const { rows: statusSummary } = await client.query(`
      SELECT status, COUNT(*) as count
      FROM fitment_staging
      GROUP BY status
      ORDER BY status
    `);
    
    console.log(`STAGING STATUS:`);
    statusSummary.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });
    
    // Get flagged records
    const { rows: flagged } = await client.query(`
      SELECT year, make, model, display_trim, validation_flags, confidence
      FROM fitment_staging
      WHERE status = 'flagged'
      ORDER BY year, make, model
      LIMIT 50
    `);
    
    if (flagged.length > 0) {
      console.log(`\nFLAGGED RECORDS (${flagged.length}):`);
      flagged.forEach(row => {
        console.log(`  ${row.year} ${row.make} ${row.model} "${row.display_trim}": ${JSON.stringify(row.validation_flags)}`);
      });
    }
    
    // Get recent promotions
    const { rows: promotions } = await client.query(`
      SELECT year, make, model, display_trim, promoted_at
      FROM fitment_staging
      WHERE status = 'promoted'
      ORDER BY promoted_at DESC
      LIMIT 20
    `);
    
    if (promotions.length > 0) {
      console.log(`\nRECENT PROMOTIONS (${promotions.length}):`);
      promotions.forEach(row => {
        console.log(`  ${row.year} ${row.make} ${row.model} "${row.display_trim}"`);
      });
    }
    
    // Get pipeline run history
    const { rows: runs } = await client.query(`
      SELECT run_type, target_year, started_at, duration_ms, status,
             records_discovered, records_validated, records_flagged, records_promoted
      FROM fitment_pipeline_runs
      ORDER BY started_at DESC
      LIMIT 10
    `);
    
    if (runs.length > 0) {
      console.log(`\nRECENT PIPELINE RUNS:`);
      runs.forEach(row => {
        console.log(`  ${row.run_type} (${row.target_year || 'all'}) @ ${row.started_at}: ${row.status}`);
        console.log(`    Discovered: ${row.records_discovered}, Validated: ${row.records_validated}, Flagged: ${row.records_flagged}, Promoted: ${row.records_promoted}`);
      });
    }
    
    // Build summary
    const pending = statusSummary.find(s => s.status === 'pending')?.count || 0;
    const validated = statusSummary.find(s => s.status === 'validated')?.count || 0;
    const flaggedCount = statusSummary.find(s => s.status === 'flagged')?.count || 0;
    const promotedCount = statusSummary.find(s => s.status === 'promoted')?.count || 0;
    
    return {
      runId: 'report',
      runType: 'report',
      timestamp: new Date().toISOString(),
      duration: 0,
      counts: {
        discovered: parseInt(pending) + parseInt(validated) + parseInt(flaggedCount) + parseInt(promotedCount),
        validated: parseInt(validated),
        flagged: parseInt(flaggedCount),
        promoted: parseInt(promotedCount),
        skipped: 0,
      },
      flaggedRecords: flagged.map(r => ({
        year: r.year,
        make: r.make,
        model: r.model,
        trim: r.display_trim,
        flags: r.validation_flags || [],
      })),
      promotedRecords: promotions.map(r => ({
        year: r.year,
        make: r.make,
        model: r.model,
        trim: r.display_trim,
      })),
    };
    
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || !['discover', 'validate', 'promote', 'report'].includes(command)) {
    console.log(`
Usage:
  npx tsx scripts/fitment-pipeline/run-pipeline.ts discover --year 2027
  npx tsx scripts/fitment-pipeline/run-pipeline.ts validate
  npx tsx scripts/fitment-pipeline/run-pipeline.ts promote [--dry-run]
  npx tsx scripts/fitment-pipeline/run-pipeline.ts report
    `);
    process.exit(1);
  }
  
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  try {
    switch (command) {
      case 'discover': {
        const yearIdx = args.indexOf('--year');
        const year = yearIdx >= 0 ? parseInt(args[yearIdx + 1]) : new Date().getFullYear() + 1;
        await runDiscovery(pool, year);
        break;
      }
      
      case 'validate': {
        await runValidation(pool);
        break;
      }
      
      case 'promote': {
        const dryRun = args.includes('--dry-run');
        await runPromotion(pool, dryRun);
        break;
      }
      
      case 'report': {
        const summary = await generateReport(pool);
        // Save report to file
        const reportPath = path.resolve(__dirname, `pipeline-report-${new Date().toISOString().split('T')[0]}.json`);
        await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
        console.log(`\n📄 Report saved to: ${reportPath}`);
        break;
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
