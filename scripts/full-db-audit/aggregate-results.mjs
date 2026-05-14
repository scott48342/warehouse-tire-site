/**
 * Aggregate Results from All Batch Audits
 * 
 * Usage: node aggregate-results.mjs
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, 'output');

function loadBatchResults() {
  const batches = [];
  const files = readdirSync(outputDir).filter(f => f.startsWith('batch-') && f.endsWith('.json'));
  
  for (const file of files) {
    const content = readFileSync(resolve(outputDir, file), 'utf-8');
    batches.push(JSON.parse(content));
  }
  
  return batches;
}

function aggregateResults(batches) {
  const aggregate = {
    timestamp: new Date().toISOString(),
    batchCount: batches.length,
    summary: {
      totalRecords: 0,
      completeRecords: 0,
      completionPct: 0,
      missingTireSpec: 0,
      missingWheelSpec: 0,
      malformedTireSpec: 0,
      malformedWheelSpec: 0,
      staggeredIncomplete: 0,
      fakeGroupedTrim: 0,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
    },
    issuesByCode: {},
    highSeverityRecords: [],
    customerImpactingGaps: [],
    byYearRange: [],
    byMake: {},
  };
  
  for (const batch of batches) {
    // Sum up summary stats
    aggregate.summary.totalRecords += batch.summary.totalRecords;
    aggregate.summary.completeRecords += batch.summary.completeRecords;
    aggregate.summary.missingTireSpec += batch.summary.missingTireSpec;
    aggregate.summary.missingWheelSpec += batch.summary.missingWheelSpec;
    aggregate.summary.malformedTireSpec += batch.summary.malformedTireSpec;
    aggregate.summary.malformedWheelSpec += batch.summary.malformedWheelSpec;
    aggregate.summary.staggeredIncomplete += batch.summary.staggeredIncomplete;
    aggregate.summary.fakeGroupedTrim += batch.summary.fakeGroupedTrim;
    aggregate.summary.highSeverity += batch.summary.highSeverity;
    aggregate.summary.mediumSeverity += batch.summary.mediumSeverity;
    aggregate.summary.lowSeverity += batch.summary.lowSeverity;
    
    // Merge issues by code
    for (const [code, count] of Object.entries(batch.issuesByCode)) {
      aggregate.issuesByCode[code] = (aggregate.issuesByCode[code] || 0) + count;
    }
    
    // Collect high severity records (limit to 100 total)
    if (aggregate.highSeverityRecords.length < 100) {
      const toAdd = batch.highSeverityRecords.slice(0, 100 - aggregate.highSeverityRecords.length);
      aggregate.highSeverityRecords.push(...toAdd);
    }
    
    // Collect customer impacting gaps (limit to 100 total)
    if (aggregate.customerImpactingGaps.length < 100) {
      const toAdd = batch.customerImpactingGaps.slice(0, 100 - aggregate.customerImpactingGaps.length);
      aggregate.customerImpactingGaps.push(...toAdd);
    }
    
    // Track by year range
    aggregate.byYearRange.push({
      range: `${batch.yearRange.start}-${batch.yearRange.end}`,
      totalRecords: batch.summary.totalRecords,
      completeRecords: batch.summary.completeRecords,
      completionPct: batch.summary.completionPct,
      highSeverity: batch.summary.highSeverity,
    });
    
    // Merge by make
    for (const [makeKey, makeData] of Object.entries(batch.sampleByMake || {})) {
      if (!aggregate.byMake[makeKey]) {
        aggregate.byMake[makeKey] = {
          make: makeData.make,
          totalRecords: 0,
          completeRecords: 0,
          sampleRecord: makeData.sampleRecord,
        };
      }
      aggregate.byMake[makeKey].totalRecords += makeData.totalRecords;
      aggregate.byMake[makeKey].completeRecords += makeData.completeRecords;
    }
  }
  
  // Calculate overall completion percentage
  aggregate.summary.completionPct = ((aggregate.summary.completeRecords / aggregate.summary.totalRecords) * 100).toFixed(2);
  
  // Sort issues by count
  aggregate.issuesByCodeSorted = Object.entries(aggregate.issuesByCode)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }));
  
  // Convert byMake to sorted array
  aggregate.byMakeSorted = Object.values(aggregate.byMake)
    .map(m => ({
      ...m,
      completionPct: ((m.completeRecords / m.totalRecords) * 100).toFixed(1),
    }))
    .sort((a, b) => b.totalRecords - a.totalRecords);
  
  return aggregate;
}

function generateReport(aggregate) {
  let report = [];
  
  report.push('╔════════════════════════════════════════════════════════════════════╗');
  report.push('║   FULL DATABASE COMPLETENESS AUDIT - FINAL REPORT                  ║');
  report.push('╚════════════════════════════════════════════════════════════════════╝');
  report.push('');
  report.push(`Generated: ${aggregate.timestamp}`);
  report.push(`Batches processed: ${aggregate.batchCount}`);
  report.push('');
  report.push('═══════════════════════════════════════════════════════════════════════');
  report.push('SUMMARY');
  report.push('═══════════════════════════════════════════════════════════════════════');
  report.push(`1.  Total records checked:        ${aggregate.summary.totalRecords.toLocaleString()}`);
  report.push(`2.  Total complete records:       ${aggregate.summary.completeRecords.toLocaleString()}`);
  report.push(`3.  Completion percentage:        ${aggregate.summary.completionPct}%`);
  report.push(`4.  Missing tire spec count:      ${aggregate.summary.missingTireSpec.toLocaleString()}`);
  report.push(`5.  Missing wheel spec count:     ${aggregate.summary.missingWheelSpec.toLocaleString()}`);
  report.push(`6.  Malformed tire spec count:    ${aggregate.summary.malformedTireSpec.toLocaleString()}`);
  report.push(`7.  Malformed wheel spec count:   ${aggregate.summary.malformedWheelSpec.toLocaleString()}`);
  report.push(`8.  Staggered incomplete count:   ${aggregate.summary.staggeredIncomplete.toLocaleString()}`);
  report.push(`9.  Fake/grouped trim count:      ${aggregate.summary.fakeGroupedTrim.toLocaleString()}`);
  report.push(`10. High severity failures:       ${aggregate.summary.highSeverity.toLocaleString()}`);
  report.push(`11. Medium severity failures:     ${aggregate.summary.mediumSeverity.toLocaleString()}`);
  report.push(`12. Low severity failures:        ${aggregate.summary.lowSeverity.toLocaleString()}`);
  report.push('');
  report.push('═══════════════════════════════════════════════════════════════════════');
  report.push('ISSUES BY CODE (Top 20)');
  report.push('═══════════════════════════════════════════════════════════════════════');
  for (const { code, count } of aggregate.issuesByCodeSorted.slice(0, 20)) {
    report.push(`  ${code.padEnd(35)} ${count.toLocaleString()}`);
  }
  report.push('');
  report.push('═══════════════════════════════════════════════════════════════════════');
  report.push('BY YEAR RANGE');
  report.push('═══════════════════════════════════════════════════════════════════════');
  for (const yr of aggregate.byYearRange) {
    report.push(`  ${yr.range}: ${yr.completeRecords.toLocaleString()}/${yr.totalRecords.toLocaleString()} (${yr.completionPct}%) - ${yr.highSeverity} HIGH`);
  }
  report.push('');
  report.push('═══════════════════════════════════════════════════════════════════════');
  report.push('TOP 100 CUSTOMER-IMPACTING GAPS');
  report.push('═══════════════════════════════════════════════════════════════════════');
  for (let i = 0; i < Math.min(100, aggregate.customerImpactingGaps.length); i++) {
    const gap = aggregate.customerImpactingGaps[i];
    report.push(`  ${i + 1}. ${gap.year} ${gap.make} ${gap.model} "${gap.trim}" - ${gap.tireFormat}`);
  }
  report.push('');
  report.push('═══════════════════════════════════════════════════════════════════════');
  report.push('FULL JSON REPORT PATH');
  report.push('═══════════════════════════════════════════════════════════════════════');
  report.push(`  ${resolve(outputDir, 'full-audit-report.json')}`);
  report.push('');
  
  return report.join('\n');
}

// Main
const batches = loadBatchResults();
if (batches.length === 0) {
  console.log('No batch results found in output directory');
  process.exit(1);
}

console.log(`Found ${batches.length} batch results to aggregate`);

const aggregate = aggregateResults(batches);
const report = generateReport(aggregate);

console.log(report);

// Write JSON report
mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, 'full-audit-report.json'), JSON.stringify(aggregate, null, 2));
writeFileSync(resolve(outputDir, 'full-audit-report.txt'), report);

console.log(`\nJSON report: ${resolve(outputDir, 'full-audit-report.json')}`);
console.log(`Text report: ${resolve(outputDir, 'full-audit-report.txt')}`);
