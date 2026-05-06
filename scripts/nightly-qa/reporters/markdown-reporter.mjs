/**
 * Markdown Reporter
 * 
 * Generates human-readable QA reports.
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config.mjs';

function formatVehicle(v) {
  return `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ''}`;
}

function severityEmoji(severity) {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

/**
 * Create Markdown reporter
 */
export function createMarkdownReporter(runId, outputDir = config.outputDir) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const runDir = path.join(outputDir, dateStr);
  
  fs.mkdirSync(runDir, { recursive: true });
  
  const reportFile = path.join(runDir, `run-${runId}-report.md`);
  const failuresFile = path.join(runDir, `run-${runId}-failures.md`);
  const latestDir = path.join(outputDir, 'latest');
  fs.mkdirSync(latestDir, { recursive: true });
  
  return {
    async writeReport(results, metadata = {}) {
      const total = results.length;
      const passed = results.filter(r => r.status === 'pass').length;
      const failed = results.filter(r => r.status === 'fail').length;
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
      
      const criticalCount = results.filter(r => r.severity === 'critical').length;
      const highCount = results.filter(r => r.severity === 'high').length;
      
      const lines = [
        `# QA Sweep Report`,
        ``,
        `**Run ID:** \`${runId}\`  `,
        `**Date:** ${new Date().toISOString()}  `,
        `**Environment:** ${config.baseUrl}  `,
        metadata.commitHash ? `**Commit:** \`${metadata.commitHash}\`  ` : '',
        ``,
        `---`,
        ``,
        `## Summary`,
        ``,
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Total Vehicles | ${total} |`,
        `| Passed | ${passed} |`,
        `| Failed | ${failed} |`,
        `| **Pass Rate** | **${passRate}%** |`,
        ``,
      ];
      
      if (criticalCount > 0 || highCount > 0) {
        lines.push(`### ⚠️ Attention Required`);
        lines.push(``);
        if (criticalCount > 0) {
          lines.push(`- 🔴 **${criticalCount} critical failures** requiring immediate attention`);
        }
        if (highCount > 0) {
          lines.push(`- 🟠 **${highCount} high-severity failures**`);
        }
        lines.push(``);
      }
      
      // Category breakdown
      lines.push(`## Results by Category`);
      lines.push(``);
      lines.push(`| Category | Total | Passed | Failed | Pass Rate |`);
      lines.push(`|----------|-------|--------|--------|-----------|`);
      
      const byCategory = {};
      for (const r of results) {
        const cat = r.vehicle?.category || 'unknown';
        if (!byCategory[cat]) byCategory[cat] = { total: 0, passed: 0, failed: 0 };
        byCategory[cat].total++;
        if (r.status === 'pass') byCategory[cat].passed++;
        if (r.status === 'fail') byCategory[cat].failed++;
      }
      
      for (const [cat, stats] of Object.entries(byCategory).sort((a, b) => a[0].localeCompare(b[0]))) {
        const rate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
        const emoji = rate === 100 ? '✅' : rate >= 80 ? '🟡' : '🔴';
        lines.push(`| ${cat} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${emoji} ${rate}% |`);
      }
      
      lines.push(``);
      
      // Failure type breakdown
      lines.push(`## Failures by Type`);
      lines.push(``);
      
      const byType = {
        logic: results.filter(r => r.failureType === 'logic').length,
        inventory: results.filter(r => r.failureType === 'inventory').length,
        supplier: results.filter(r => r.failureType === 'supplier').length,
        data_gap: results.filter(r => r.failureType === 'data_gap').length,
        test_harness: results.filter(r => r.failureType === 'test_harness').length,
      };
      
      lines.push(`| Type | Count | Description |`);
      lines.push(`|------|-------|-------------|`);
      lines.push(`| Logic | ${byType.logic} | Fitment logic bugs |`);
      lines.push(`| Inventory | ${byType.inventory} | Valid fitment, no stock |`);
      lines.push(`| Supplier | ${byType.supplier} | API/feed issues |`);
      lines.push(`| Data Gap | ${byType.data_gap} | Missing fitment data |`);
      lines.push(`| Test Harness | ${byType.test_harness} | Test expectation errors |`);
      lines.push(``);
      
      // Critical failures detail
      const criticals = results.filter(r => r.severity === 'critical');
      if (criticals.length > 0) {
        lines.push(`## 🔴 Critical Failures`);
        lines.push(``);
        for (const r of criticals) {
          lines.push(`### ${formatVehicle(r.vehicle)}`);
          lines.push(``);
          lines.push(`- **Category:** ${r.vehicle.category}`);
          lines.push(`- **Failure Type:** ${r.failureType}`);
          for (const err of (r.errors || []).slice(0, 3)) {
            lines.push(`- ${err}`);
          }
          lines.push(``);
        }
      }
      
      fs.writeFileSync(reportFile, lines.join('\n'));
      console.log(`[md-reporter] Wrote ${reportFile}`);
      
      fs.writeFileSync(path.join(latestDir, 'report.md'), lines.join('\n'));
      
      return reportFile;
    },
    
    async writeFailures(results) {
      const failures = results.filter(r => r.status === 'fail');
      
      if (failures.length === 0) {
        const content = `# No Failures 🎉\n\nAll ${results.length} vehicles passed QA checks.\n`;
        fs.writeFileSync(failuresFile, content);
        return failuresFile;
      }
      
      const lines = [
        `# QA Failures Report`,
        ``,
        `**Total Failures:** ${failures.length} / ${results.length}`,
        `**Run ID:** \`${results[0]?.runId || 'unknown'}\``,
        ``,
        `---`,
        ``,
      ];
      
      // Group by severity
      const bySeverity = {
        critical: failures.filter(r => r.severity === 'critical'),
        high: failures.filter(r => r.severity === 'high'),
        medium: failures.filter(r => r.severity === 'medium'),
        low: failures.filter(r => r.severity === 'low'),
      };
      
      for (const [severity, items] of Object.entries(bySeverity)) {
        if (items.length === 0) continue;
        
        lines.push(`## ${severityEmoji(severity)} ${severity.toUpperCase()} (${items.length})`);
        lines.push(``);
        
        for (const r of items) {
          lines.push(`### ${formatVehicle(r.vehicle)}`);
          lines.push(``);
          lines.push(`| Field | Value |`);
          lines.push(`|-------|-------|`);
          lines.push(`| Category | ${r.vehicle.category} |`);
          lines.push(`| Failure Type | ${r.failureType} |`);
          if (r.wheelResult?.boltPattern) {
            lines.push(`| Bolt Pattern | ${r.wheelResult.boltPattern} ${r.wheelResult.boltPatternMatch === false ? '❌' : '✅'} |`);
          }
          if (r.staggeredResult?.staggeredMismatch) {
            lines.push(`| Staggered | Expected: ${r.staggeredResult.staggeredExpected}, Got: ${r.staggeredResult.staggeredDetected} ❌ |`);
          }
          lines.push(``);
          
          if (r.errors?.length) {
            lines.push(`**Errors:**`);
            for (const err of r.errors.slice(0, 5)) {
              lines.push(`- ${err}`);
            }
            lines.push(``);
          }
        }
      }
      
      fs.writeFileSync(failuresFile, lines.join('\n'));
      console.log(`[md-reporter] Wrote ${failuresFile}`);
      
      fs.writeFileSync(path.join(latestDir, 'failures.md'), lines.join('\n'));
      
      return failuresFile;
    },
    
    getReportFile() {
      return reportFile;
    },
    
    getFailuresFile() {
      return failuresFile;
    },
  };
}

export default { createMarkdownReporter };
