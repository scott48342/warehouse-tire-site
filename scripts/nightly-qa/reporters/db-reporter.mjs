/**
 * Database Reporter
 * 
 * Writes QA results to PostgreSQL database.
 */

import pg from 'pg';
import { config } from '../config.mjs';

const { Pool } = pg;

/**
 * Create a new QA run record
 */
export async function createRun(pool, metadata = {}) {
  const result = await pool.query(`
    INSERT INTO qa_runs (
      started_at, status, commit_hash, deployment_version, 
      environment, base_url, trigger_source
    ) VALUES (
      NOW(), 'running', $1, $2, $3, $4, $5
    )
    RETURNING run_id
  `, [
    metadata.commitHash || null,
    metadata.deploymentVersion || null,
    metadata.environment || 'production',
    config.baseUrl,
    metadata.triggerSource || 'scheduled',
  ]);
  
  return result.rows[0].run_id;
}

/**
 * Save individual vehicle result
 */
export async function saveResult(pool, runId, result) {
  const v = result.vehicle;
  const wr = result.wheelResult || {};
  const tr = result.tireResult || {};
  const sr = result.staggeredResult || {};
  const pr = result.packageResult || {};
  
  await pool.query(`
    INSERT INTO qa_results (
      run_id, year, make, model, trim, category,
      is_performance, is_canary, status, severity, failure_type,
      wheel_test_passed, wheel_count, wheel_pre_filter_count, wheel_post_filter_count,
      bolt_pattern, bolt_pattern_expected, bolt_pattern_match,
      center_bore, offset_min, offset_max, wheel_diameter_min, wheel_diameter_max,
      staggered_detected, staggered_expected, staggered_mismatch,
      front_wheel_width, rear_wheel_width, front_offset, rear_offset,
      tire_test_passed, tire_count, tire_pre_filter_count, tire_post_filter_count,
      tire_diameter, tire_diameter_expected, tire_diameter_valid,
      front_tire_size, rear_tire_size,
      lifted_tests,
      package_test_passed, package_viable, package_wheel_count, package_tire_count,
      wheel_suppliers, tire_suppliers,
      error_message, duration_ms
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13, $14, $15,
      $16, $17, $18,
      $19, $20, $21, $22, $23,
      $24, $25, $26,
      $27, $28, $29, $30,
      $31, $32, $33, $34,
      $35, $36, $37,
      $38, $39,
      $40,
      $41, $42, $43, $44,
      $45, $46,
      $47, $48
    )
  `, [
    runId, v.year, v.make, v.model, v.trim, v.category,
    v.isPerformance, v.isCanary, result.status, result.severity, result.failureType,
    wr.passed, wr.wheelCount, wr.preFilterCount, wr.postFilterCount,
    wr.boltPattern, wr.boltPatternExpected, wr.boltPatternMatch,
    wr.centerBore, wr.offsetMin, wr.offsetMax, wr.wheelDiameterMin, wr.wheelDiameterMax,
    wr.staggeredDetected || sr.staggeredDetected, sr.staggeredExpected, sr.staggeredMismatch,
    wr.frontWheelWidth || sr.frontWheelWidth, wr.rearWheelWidth || sr.rearWheelWidth, 
    wr.frontOffset, wr.rearOffset,
    tr.passed, tr.tireCount, tr.preFilterCount, tr.postFilterCount,
    tr.tireDiameter, tr.tireDiameterExpected, tr.tireDiameterValid,
    tr.frontTireSize || sr.frontTireSize, tr.rearTireSize || sr.rearTireSize,
    JSON.stringify(result.liftedResults || []),
    pr.passed, pr.viable, pr.wheelCount, pr.tireCount,
    JSON.stringify(wr.suppliers || {}), JSON.stringify(tr.suppliers || {}),
    result.errors?.slice(0, 5)?.join('\n') || null, result.durationMs,
  ]);
}

/**
 * Complete a QA run with summary stats
 */
export async function completeRun(pool, runId, results) {
  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    warnings: results.filter(r => r.status === 'warning').length,
    skipped: results.filter(r => r.status === 'skip').length,
    critical: results.filter(r => r.severity === 'critical').length,
    high: results.filter(r => r.severity === 'high').length,
    medium: results.filter(r => r.severity === 'medium').length,
    low: results.filter(r => r.severity === 'low').length,
    logic: results.filter(r => r.failureType === 'logic').length,
    inventory: results.filter(r => r.failureType === 'inventory').length,
    supplier: results.filter(r => r.failureType === 'supplier').length,
    dataGap: results.filter(r => r.failureType === 'data_gap').length,
    testHarness: results.filter(r => r.failureType === 'test_harness').length,
    regression: results.filter(r => r.failureType === 'regression').length,
    // New metrics
    logicPassed: results.filter(r => r.logicStatus === 'pass').length,
    knownGaps: results.filter(r => r.isKnownGap).length,
  };
  
  // Multiple pass rates
  const rawPassRate = summary.total > 0 
    ? Math.round((summary.passed / summary.total) * 10000) / 100 
    : 0;
  const logicPassRate = summary.total > 0 
    ? Math.round((summary.logicPassed / summary.total) * 10000) / 100 
    : 0;
  
  // Critical regressions = real issues to fix (not data gaps)
  const criticalRegressions = results.filter(r => 
    r.logicStatus === 'fail' && 
    !r.isKnownGap && 
    (r.severity === 'critical' || r.severity === 'high')
  ).length;
  
  // Category breakdown with logic pass rate
  const categoryStats = {};
  for (const r of results) {
    const cat = r.vehicle?.category || 'unknown';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { total: 0, passed: 0, failed: 0, warnings: 0, logicPassed: 0, passRate: 0, logicPassRate: 0 };
    }
    categoryStats[cat].total++;
    if (r.status === 'pass') categoryStats[cat].passed++;
    if (r.status === 'fail') categoryStats[cat].failed++;
    if (r.status === 'warning') categoryStats[cat].warnings++;
    if (r.logicStatus === 'pass') categoryStats[cat].logicPassed++;
  }
  for (const cat of Object.keys(categoryStats)) {
    const c = categoryStats[cat];
    c.passRate = c.total > 0 ? Math.round((c.passed / c.total) * 10000) / 100 : 0;
    c.logicPassRate = c.total > 0 ? Math.round((c.logicPassed / c.total) * 10000) / 100 : 0;
  }
  
  const totalDuration = results.reduce((sum, r) => sum + (r.durationMs || 0), 0);
  
  // Include logic pass rate in notes for easy reference
  const notes = `Logic: ${logicPassRate}%, Raw: ${rawPassRate}%, Regressions: ${criticalRegressions}`;
  
  await pool.query(`
    UPDATE qa_runs SET
      completed_at = NOW(),
      status = 'completed',
      vehicle_count = $2,
      passed_count = $3,
      failed_count = $4,
      warning_count = $5,
      skipped_count = $6,
      critical_failures = $7,
      high_failures = $8,
      medium_failures = $9,
      low_failures = $10,
      logic_failures = $11,
      inventory_failures = $12,
      supplier_failures = $13,
      data_gap_failures = $14,
      test_harness_failures = $15,
      regression_failures = $16,
      category_stats = $17,
      pass_rate = $18,
      duration_ms = $19,
      notes = $20
    WHERE run_id = $1
  `, [
    runId,
    summary.total, summary.passed, summary.failed, summary.warnings, summary.skipped,
    summary.critical, summary.high, summary.medium, summary.low,
    summary.logic, summary.inventory, summary.supplier, 
    summary.dataGap, summary.testHarness, summary.regression,
    JSON.stringify(categoryStats),
    rawPassRate,  // Keep raw pass rate in the main column
    totalDuration,
    notes,
  ]);
  
  return { 
    ...summary, 
    passRate: rawPassRate, 
    logicPassRate, 
    criticalRegressions,
    categoryStats 
  };
}

/**
 * Create database reporter
 */
export function createDbReporter() {
  let pool = null;
  let runId = null;
  
  return {
    async init(metadata = {}) {
      if (!config.databaseUrl) {
        console.warn('[db-reporter] No database URL configured, skipping DB writes');
        return null;
      }
      
      pool = new Pool({
        connectionString: config.databaseUrl,
        max: 5,
        idleTimeoutMillis: 30000,
        ssl: { rejectUnauthorized: false },
      });
      
      runId = await createRun(pool, metadata);
      console.log(`[db-reporter] Created run ${runId}`);
      return runId;
    },
    
    async saveResult(result) {
      if (!pool || !runId) return;
      await saveResult(pool, runId, result);
    },
    
    async saveBatch(results) {
      if (!pool || !runId) return;
      for (const result of results) {
        await saveResult(pool, runId, result);
      }
    },
    
    async complete(results) {
      if (!pool || !runId) return null;
      const summary = await completeRun(pool, runId, results);
      return summary;
    },
    
    async close() {
      if (pool) {
        await pool.end();
        pool = null;
      }
    },
    
    getRunId() {
      return runId;
    },
  };
}

export default { createDbReporter };
