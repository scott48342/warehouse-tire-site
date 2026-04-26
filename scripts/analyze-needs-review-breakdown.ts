/**
 * Analyze remaining needs_review records by error type
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function analyze() {
  console.log('='.repeat(70));
  console.log('NEEDS_REVIEW BREAKDOWN ANALYSIS');
  console.log('='.repeat(70));
  
  // Total counts
  const totals = await pool.query(`
    SELECT certification_status, COUNT(*) as cnt
    FROM vehicle_fitments
    GROUP BY certification_status
  `);
  
  console.log('\n=== OVERALL STATUS ===');
  for (const r of totals.rows) {
    console.log(`  ${r.certification_status}: ${r.cnt}`);
  }
  
  // Get all needs_review records with their error types
  const needsReview = await pool.query(`
    SELECT id, year, make, model, raw_trim, certification_errors
    FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
  `);
  
  console.log(`\nTotal needs_review: ${needsReview.rows.length}`);
  
  // Parse and categorize by error type
  const byErrorType: Record<string, number> = {};
  const byMakeModel: Record<string, { count: number; errors: Record<string, number> }> = {};
  const errorDetails: Record<string, any[]> = {};
  
  for (const record of needsReview.rows) {
    const errors = record.certification_errors || [];
    const makeModel = `${record.make} ${record.model}`;
    
    if (!byMakeModel[makeModel]) {
      byMakeModel[makeModel] = { count: 0, errors: {} };
    }
    byMakeModel[makeModel].count++;
    
    if (errors.length === 0) {
      byErrorType['NO_ERROR_RECORDED'] = (byErrorType['NO_ERROR_RECORDED'] || 0) + 1;
      byMakeModel[makeModel].errors['NO_ERROR_RECORDED'] = (byMakeModel[makeModel].errors['NO_ERROR_RECORDED'] || 0) + 1;
    } else {
      for (const err of errors) {
        const errType = err.type || 'UNKNOWN';
        byErrorType[errType] = (byErrorType[errType] || 0) + 1;
        byMakeModel[makeModel].errors[errType] = (byMakeModel[makeModel].errors[errType] || 0) + 1;
        
        // Store sample for each error type
        if (!errorDetails[errType]) errorDetails[errType] = [];
        if (errorDetails[errType].length < 5) {
          errorDetails[errType].push({
            year: record.year,
            make: record.make,
            model: record.model,
            trim: record.raw_trim,
            message: err.message?.substring(0, 80)
          });
        }
      }
    }
  }
  
  // Sort error types by count
  const sortedErrors = Object.entries(byErrorType).sort((a, b) => b[1] - a[1]);
  
  console.log('\n' + '='.repeat(70));
  console.log('1. BREAKDOWN BY ERROR TYPE');
  console.log('='.repeat(70));
  console.log('\n| Error Type | Count | % |');
  console.log('|------------|-------|---|');
  
  const totalErrors = Object.values(byErrorType).reduce((a, b) => a + b, 0);
  for (const [errType, count] of sortedErrors) {
    const pct = ((count / needsReview.rows.length) * 100).toFixed(1);
    console.log(`| ${errType.padEnd(30)} | ${String(count).padStart(5)} | ${pct.padStart(5)}% |`);
  }
  
  // Sample records for each error type
  console.log('\n=== SAMPLE RECORDS BY ERROR TYPE ===');
  for (const [errType, samples] of Object.entries(errorDetails)) {
    console.log(`\n${errType} (${byErrorType[errType]}):`);
    for (const s of samples.slice(0, 3)) {
      console.log(`  - ${s.year} ${s.make} ${s.model} "${s.trim}": ${s.message}`);
    }
  }
  
  // Sort make/model by count
  const sortedMakeModel = Object.entries(byMakeModel).sort((a, b) => b[1].count - a[1].count);
  
  console.log('\n' + '='.repeat(70));
  console.log('2. TOP OFFENDER MAKE/MODEL FAMILIES');
  console.log('='.repeat(70));
  console.log('\n| Make/Model | Count | Primary Error |');
  console.log('|------------|-------|---------------|');
  
  for (const [mm, data] of sortedMakeModel.slice(0, 30)) {
    const primaryError = Object.entries(data.errors).sort((a, b) => b[1] - a[1])[0];
    const primaryErrStr = primaryError ? `${primaryError[0]} (${primaryError[1]})` : 'none';
    console.log(`| ${mm.padEnd(30)} | ${String(data.count).padStart(5)} | ${primaryErrStr} |`);
  }
  
  // ROI Analysis
  console.log('\n' + '='.repeat(70));
  console.log('3. ROI ANALYSIS BY ERROR LANE');
  console.log('='.repeat(70));
  
  const lanes = [
    { name: 'FUTURE_TRIM', count: byErrorType['FUTURE_TRIM'] || 0 },
    { name: 'DATA_MISMATCH', count: byErrorType['DATA_MISMATCH'] || 0 },
    { name: 'AFTERMARKET_TIRES', count: byErrorType['AFTERMARKET_TIRES'] || 0 },
    { name: 'AFTERMARKET_WHEELS', count: byErrorType['AFTERMARKET_WHEELS'] || 0 },
    { name: 'WHEEL_SPREAD', count: byErrorType['WHEEL_SPREAD'] || 0 },
    { name: 'MODERN_TIRES_ON_CLASSIC', count: byErrorType['MODERN_TIRES_ON_CLASSIC'] || 0 },
    { name: 'NO_ERROR_RECORDED', count: byErrorType['NO_ERROR_RECORDED'] || 0 },
  ];
  
  // Add any other error types
  for (const [errType, count] of sortedErrors) {
    if (!lanes.find(l => l.name === errType)) {
      lanes.push({ name: errType, count });
    }
  }
  
  lanes.sort((a, b) => b.count - a.count);
  
  console.log('\n| Lane | Records | % of Total | Bulk-Correctable? |');
  console.log('|------|---------|------------|-------------------|');
  
  const bulkCorrectable: Record<string, string> = {
    'FUTURE_TRIM': '✅ Yes - FutureTrimConfig pattern',
    'DATA_MISMATCH': '⚠️ Partial - need specs validation',
    'AFTERMARKET_TIRES': '⚠️ Partial - remove non-OEM tires',
    'AFTERMARKET_WHEELS': '⚠️ Partial - remove non-OEM wheels',
    'WHEEL_SPREAD': '❌ Manual - data quality issue',
    'MODERN_TIRES_ON_CLASSIC': '⚠️ Partial - filter anachronistic sizes',
    'NO_ERROR_RECORDED': '❓ Unknown - need investigation',
  };
  
  for (const lane of lanes) {
    if (lane.count === 0) continue;
    const pct = ((lane.count / needsReview.rows.length) * 100).toFixed(1);
    const correctable = bulkCorrectable[lane.name] || '❓ Unknown';
    console.log(`| ${lane.name.padEnd(25)} | ${String(lane.count).padStart(7)} | ${pct.padStart(9)}% | ${correctable} |`);
  }
  
  // Recommendation
  console.log('\n' + '='.repeat(70));
  console.log('4. RECOMMENDED NEXT LANE');
  console.log('='.repeat(70));
  
  const topLane = lanes[0];
  console.log(`\n🎯 Highest ROI: ${topLane.name} (${topLane.count} records, ${((topLane.count / needsReview.rows.length) * 100).toFixed(1)}%)`);
  
  // Get top families for the top lane
  const topLaneFamilies = Object.entries(byMakeModel)
    .filter(([_, data]) => data.errors[topLane.name])
    .sort((a, b) => (b[1].errors[topLane.name] || 0) - (a[1].errors[topLane.name] || 0))
    .slice(0, 10);
  
  console.log(`\nTop families for ${topLane.name}:`);
  for (const [mm, data] of topLaneFamilies) {
    console.log(`  - ${mm}: ${data.errors[topLane.name]}`);
  }
  
  // Second highest lane
  if (lanes[1] && lanes[1].count > 0) {
    console.log(`\n🥈 Second: ${lanes[1].name} (${lanes[1].count} records)`);
  }
  
  await pool.end();
}

analyze().catch(console.error);
