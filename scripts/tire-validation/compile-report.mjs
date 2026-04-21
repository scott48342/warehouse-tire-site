import { readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const resultsDir = './results';

async function compileReport() {
  const files = await readdir(resultsDir);
  const batchFiles = files.filter(f => f.match(/^batch-\d+-results\.json$/)).sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)[0]);
    const numB = parseInt(b.match(/\d+/)[0]);
    return numA - numB;
  });

  console.log(`Processing ${batchFiles.length} batch files...\n`);

  const allFindings = {
    phantomYears: [],
    nonUSVehicles: [],
    wrongSizes: [],
    emptySizes: [],
    generationMismatch: [],
    otherIssues: []
  };

  let totalVehicles = 0;
  let totalDiscrepancies = 0;
  let totalValidated = 0;
  let totalNotFound = 0;

  for (const file of batchFiles) {
    try {
      const content = await readFile(path.join(resultsDir, file), 'utf-8');
      const data = JSON.parse(content);
      
      // Aggregate summary stats
      if (data.summary) {
        totalVehicles += data.summary.total || 0;
        totalDiscrepancies += data.summary.discrepancies || 0;
        totalValidated += data.summary.validated || data.summary.matched || 0;
        totalNotFound += data.summary.notFound || 0;
      }

      // Extract findings
      if (data.findings && Array.isArray(data.findings)) {
        for (const finding of data.findings) {
          const text = JSON.stringify(finding).toLowerCase();
          
          if (text.includes('phantom') || text.includes('invalid year') || text.includes("doesn't exist") || 
              text.includes('discontinued') || text.includes('pre-launch') || text.includes('gap year')) {
            allFindings.phantomYears.push({ batch: file, finding });
          } else if (text.includes('jdm') || text.includes('international') || text.includes('not sold in us') ||
                     text.includes('non-us') || text.includes('europe') || text.includes('china') ||
                     text.includes('asia') || text.includes('regional')) {
            allFindings.nonUSVehicles.push({ batch: file, finding });
          } else if (text.includes('wrong') || text.includes('should be') || text.includes('incorrect')) {
            allFindings.wrongSizes.push({ batch: file, finding });
          } else if (text.includes('empty') || text.includes('missing')) {
            allFindings.emptySizes.push({ batch: file, finding });
          } else if (text.includes('generation') || text.includes('gen ')) {
            allFindings.generationMismatch.push({ batch: file, finding });
          } else {
            allFindings.otherIssues.push({ batch: file, finding });
          }
        }
      }

      // Also check recommendations
      if (data.recommendations && Array.isArray(data.recommendations)) {
        for (const rec of data.recommendations) {
          const text = (typeof rec === 'string' ? rec : JSON.stringify(rec)).toLowerCase();
          
          if (text.includes('remove') && (text.includes('year') || text.includes('phantom'))) {
            allFindings.phantomYears.push({ batch: file, recommendation: rec });
          } else if (text.includes('remove') && (text.includes('jdm') || text.includes('international') || text.includes('non-us'))) {
            allFindings.nonUSVehicles.push({ batch: file, recommendation: rec });
          }
        }
      }
    } catch (err) {
      console.error(`Error processing ${file}: ${err.message}`);
    }
  }

  // Generate report
  const report = {
    generatedAt: new Date().toISOString(),
    overallStats: {
      totalBatches: batchFiles.length,
      totalVehicles,
      totalValidated,
      totalDiscrepancies,
      totalNotFound,
      discrepancyRate: ((totalDiscrepancies / totalVehicles) * 100).toFixed(1) + '%'
    },
    issueCategories: {
      phantomYears: allFindings.phantomYears.length,
      nonUSVehicles: allFindings.nonUSVehicles.length,
      wrongSizes: allFindings.wrongSizes.length,
      emptySizes: allFindings.emptySizes.length,
      generationMismatch: allFindings.generationMismatch.length,
      otherIssues: allFindings.otherIssues.length
    },
    detailedFindings: allFindings
  };

  await writeFile('./validation-report.json', JSON.stringify(report, null, 2));
  
  // Print summary
  console.log('=' .repeat(60));
  console.log('TIRE VALIDATION REPORT - SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nTotal Batches Processed: ${batchFiles.length}`);
  console.log(`Total Vehicles: ${totalVehicles}`);
  console.log(`Validated OK: ${totalValidated}`);
  console.log(`Discrepancies Found: ${totalDiscrepancies}`);
  console.log(`Not Found on Source: ${totalNotFound}`);
  console.log(`Discrepancy Rate: ${report.overallStats.discrepancyRate}`);
  console.log('\nIssue Categories:');
  console.log(`  - Phantom Years: ${allFindings.phantomYears.length} findings`);
  console.log(`  - Non-US Vehicles: ${allFindings.nonUSVehicles.length} findings`);
  console.log(`  - Wrong Tire Sizes: ${allFindings.wrongSizes.length} findings`);
  console.log(`  - Empty/Missing Data: ${allFindings.emptySizes.length} findings`);
  console.log(`  - Generation Mismatch: ${allFindings.generationMismatch.length} findings`);
  console.log(`  - Other Issues: ${allFindings.otherIssues.length} findings`);
  console.log('\nFull report saved to: validation-report.json');
}

compileReport().catch(console.error);
