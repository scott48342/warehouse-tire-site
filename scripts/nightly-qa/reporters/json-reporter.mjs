/**
 * JSON Reporter
 * 
 * Writes QA results to JSON files.
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config.mjs';

/**
 * Create JSON reporter
 */
export function createJsonReporter(runId, outputDir = config.outputDir) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const runDir = path.join(outputDir, dateStr);
  
  // Ensure directory exists
  fs.mkdirSync(runDir, { recursive: true });
  
  const resultsFile = path.join(runDir, `run-${runId}.json`);
  const summaryFile = path.join(runDir, `run-${runId}-summary.json`);
  
  // Create/update "latest" symlink directory
  const latestDir = path.join(outputDir, 'latest');
  fs.mkdirSync(latestDir, { recursive: true });
  
  return {
    async writeResults(results, metadata = {}) {
      const output = {
        run_id: runId,
        started_at: metadata.startedAt || new Date().toISOString(),
        completed_at: new Date().toISOString(),
        environment: {
          base_url: config.baseUrl,
          commit_hash: metadata.commitHash || process.env.COMMIT_SHA || null,
          deployment_version: metadata.deploymentVersion || process.env.VERCEL_GIT_COMMIT_SHA || null,
        },
        summary: this.buildSummary(results),
        results: results.map(r => ({
          vehicle: r.vehicle,
          status: r.status,
          severity: r.severity,
          failureType: r.failureType,
          wheelCount: r.wheelResult?.wheelCount,
          tireCount: r.tireResult?.tireCount,
          boltPattern: r.wheelResult?.boltPattern,
          boltPatternMatch: r.wheelResult?.boltPatternMatch,
          staggeredDetected: r.staggeredResult?.staggeredDetected,
          staggeredMismatch: r.staggeredResult?.staggeredMismatch,
          liftedPassed: r.liftedResults?.filter(l => l.passed).length,
          liftedFailed: r.liftedResults?.filter(l => !l.passed).length,
          packageViable: r.packageResult?.viable,
          errors: r.errors?.slice(0, 5),
          durationMs: r.durationMs,
        })),
      };
      
      fs.writeFileSync(resultsFile, JSON.stringify(output, null, 2));
      console.log(`[json-reporter] Wrote ${resultsFile}`);
      
      // Also write to latest/
      fs.writeFileSync(path.join(latestDir, 'results.json'), JSON.stringify(output, null, 2));
      
      return resultsFile;
    },
    
    async writeSummary(results, metadata = {}) {
      const summary = this.buildSummary(results);
      
      const output = {
        run_id: runId,
        timestamp: new Date().toISOString(),
        environment: {
          base_url: config.baseUrl,
          commit_hash: metadata.commitHash || null,
        },
        ...summary,
      };
      
      fs.writeFileSync(summaryFile, JSON.stringify(output, null, 2));
      console.log(`[json-reporter] Wrote ${summaryFile}`);
      
      // Also write to latest/
      fs.writeFileSync(path.join(latestDir, 'summary.json'), JSON.stringify(output, null, 2));
      
      return summaryFile;
    },
    
    buildSummary(results) {
      const total = results.length;
      const passed = results.filter(r => r.status === 'pass').length;
      const failed = results.filter(r => r.status === 'fail').length;
      const warnings = results.filter(r => r.status === 'warning').length;
      const skipped = results.filter(r => r.status === 'skip').length;
      
      const bySeverity = {
        critical: results.filter(r => r.severity === 'critical').length,
        high: results.filter(r => r.severity === 'high').length,
        medium: results.filter(r => r.severity === 'medium').length,
        low: results.filter(r => r.severity === 'low').length,
      };
      
      const byFailureType = {
        logic: results.filter(r => r.failureType === 'logic').length,
        inventory: results.filter(r => r.failureType === 'inventory').length,
        supplier: results.filter(r => r.failureType === 'supplier').length,
        data_gap: results.filter(r => r.failureType === 'data_gap').length,
        test_harness: results.filter(r => r.failureType === 'test_harness').length,
        regression: results.filter(r => r.failureType === 'regression').length,
      };
      
      const byCategory = {};
      for (const r of results) {
        const cat = r.vehicle?.category || 'unknown';
        if (!byCategory[cat]) {
          byCategory[cat] = { total: 0, passed: 0, failed: 0, passRate: 0 };
        }
        byCategory[cat].total++;
        if (r.status === 'pass') byCategory[cat].passed++;
        if (r.status === 'fail') byCategory[cat].failed++;
      }
      for (const cat of Object.keys(byCategory)) {
        const c = byCategory[cat];
        c.passRate = c.total > 0 ? Math.round((c.passed / c.total) * 100) : 0;
      }
      
      const totalDuration = results.reduce((sum, r) => sum + (r.durationMs || 0), 0);
      
      return {
        total_vehicles: total,
        passed,
        failed,
        warnings,
        skipped,
        pass_rate: total > 0 ? Math.round((passed / total) * 100) : 0,
        duration_ms: totalDuration,
        by_severity: bySeverity,
        by_failure_type: byFailureType,
        by_category: byCategory,
      };
    },
    
    getResultsFile() {
      return resultsFile;
    },
    
    getSummaryFile() {
      return summaryFile;
    },
  };
}

export default { createJsonReporter };
