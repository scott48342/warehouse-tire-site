/**
 * Final Analysis: Remaining 826 needs_review records
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

function extractWheelDiameter(wheel: any): number | null {
  if (typeof wheel === 'object' && wheel.diameter) return Number(wheel.diameter);
  if (typeof wheel === 'string') {
    const match = wheel.match(/(\d+)x/);
    return match ? parseInt(match[1]) : null;
  }
  return null;
}

function extractTireDiameter(tire: string): number | null {
  if (!tire || typeof tire !== 'string') return null;
  const match = tire.match(/R(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

async function analyze() {
  console.log('='.repeat(70));
  console.log('FINAL NEEDS_REVIEW BREAKDOWN ANALYSIS');
  console.log('='.repeat(70));
  
  // Get all needs_review records
  const result = await pool.query(`
    SELECT id, year, make, model, raw_trim,
           oem_wheel_sizes, oem_tire_sizes, bolt_pattern, center_bore_mm,
           certification_errors
    FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
    ORDER BY make, model, year
  `);
  
  console.log(`\nTotal needs_review: ${result.rows.length}\n`);
  
  // === 1. BREAKDOWN BY ERROR TYPE ===
  const byErrorType: Record<string, number> = {};
  const byErrorTypeDetails: Record<string, any[]> = {};
  
  for (const r of result.rows) {
    const errors = r.certification_errors || [];
    if (errors.length === 0) {
      byErrorType['NO_ERROR_RECORDED'] = (byErrorType['NO_ERROR_RECORDED'] || 0) + 1;
      if (!byErrorTypeDetails['NO_ERROR_RECORDED']) byErrorTypeDetails['NO_ERROR_RECORDED'] = [];
      if (byErrorTypeDetails['NO_ERROR_RECORDED'].length < 5) byErrorTypeDetails['NO_ERROR_RECORDED'].push(r);
    } else {
      for (const err of errors) {
        const errType = err.type || 'UNKNOWN';
        byErrorType[errType] = (byErrorType[errType] || 0) + 1;
        if (!byErrorTypeDetails[errType]) byErrorTypeDetails[errType] = [];
        if (byErrorTypeDetails[errType].length < 5) byErrorTypeDetails[errType].push(r);
      }
    }
  }
  
  const sortedErrors = Object.entries(byErrorType).sort((a, b) => b[1] - a[1]);
  
  console.log('='.repeat(70));
  console.log('1. BREAKDOWN BY ERROR TYPE');
  console.log('='.repeat(70));
  console.log('\n| Error Type | Count | % |');
  console.log('|------------|-------|---|');
  
  for (const [errType, count] of sortedErrors) {
    const pct = ((count / result.rows.length) * 100).toFixed(1);
    console.log(`| ${errType.padEnd(30)} | ${String(count).padStart(5)} | ${pct.padStart(5)}% |`);
  }
  
  // === 2. TOP OFFENDER FAMILIES ===
  const byFamily: Record<string, { count: number; errors: Record<string, number>; samples: any[] }> = {};
  
  for (const r of result.rows) {
    const family = `${r.make} ${r.model}`;
    if (!byFamily[family]) {
      byFamily[family] = { count: 0, errors: {}, samples: [] };
    }
    byFamily[family].count++;
    if (byFamily[family].samples.length < 3) byFamily[family].samples.push(r);
    
    const errors = r.certification_errors || [];
    for (const err of errors) {
      const errType = err.type || 'UNKNOWN';
      byFamily[family].errors[errType] = (byFamily[family].errors[errType] || 0) + 1;
    }
  }
  
  const sortedFamilies = Object.entries(byFamily).sort((a, b) => b[1].count - a[1].count);
  
  console.log('\n' + '='.repeat(70));
  console.log('2. TOP OFFENDER FAMILIES');
  console.log('='.repeat(70));
  console.log('\n| Family | Count | Primary Error |');
  console.log('|--------|-------|---------------|');
  
  for (const [family, data] of sortedFamilies.slice(0, 25)) {
    const primaryErr = Object.entries(data.errors).sort((a, b) => b[1] - a[1])[0];
    const errStr = primaryErr ? `${primaryErr[0]} (${primaryErr[1]})` : 'none';
    console.log(`| ${family.padEnd(30)} | ${String(data.count).padStart(5)} | ${errStr} |`);
  }
  
  // === 3. CATEGORIZE FIXABILITY ===
  console.log('\n' + '='.repeat(70));
  console.log('3. FIXABILITY ANALYSIS');
  console.log('='.repeat(70));
  
  let bulkFixable = 0;
  let semiBulk = 0;
  let manualOnly = 0;
  
  const bulkFixableTypes = ['FUTURE_TRIM', 'AFTERMARKET_TIRES', 'AFTERMARKET_WHEEL', 'AFTERMARKET_WHEELS', 'SUSPICIOUS_FALLBACK'];
  const semiBulkTypes = ['DATA_MISMATCH', 'MODERN_TIRES_ON_CLASSIC', 'TIRE_SOUP', 'WHEEL_SOUP'];
  const manualTypes = ['WHEEL_SPREAD', 'NO_ERROR_RECORDED'];
  
  const fixabilityDetails: Record<string, any[]> = {
    bulk: [],
    semiBulk: [],
    manual: []
  };
  
  for (const r of result.rows) {
    const errors = r.certification_errors || [];
    const errTypes = errors.map((e: any) => e.type);
    
    if (errTypes.length === 0) {
      manualOnly++;
      if (fixabilityDetails.manual.length < 10) fixabilityDetails.manual.push(r);
    } else if (errTypes.some((t: string) => bulkFixableTypes.includes(t))) {
      bulkFixable++;
      if (fixabilityDetails.bulk.length < 10) fixabilityDetails.bulk.push(r);
    } else if (errTypes.some((t: string) => semiBulkTypes.includes(t))) {
      semiBulk++;
      if (fixabilityDetails.semiBulk.length < 10) fixabilityDetails.semiBulk.push(r);
    } else {
      manualOnly++;
      if (fixabilityDetails.manual.length < 10) fixabilityDetails.manual.push(r);
    }
  }
  
  console.log('\n| Category | Count | % | Description |');
  console.log('|----------|-------|---|-------------|');
  console.log(`| Bulk-fixable | ${bulkFixable} | ${((bulkFixable/result.rows.length)*100).toFixed(1)}% | Residual FUTURE_TRIM, AFTERMARKET, SUSPICIOUS_FALLBACK |`);
  console.log(`| Semi-bulk | ${semiBulk} | ${((semiBulk/result.rows.length)*100).toFixed(1)}% | DATA_MISMATCH, MODERN_TIRES, SOUP issues |`);
  console.log(`| Manual only | ${manualOnly} | ${((manualOnly/result.rows.length)*100).toFixed(1)}% | WHEEL_SPREAD, NO_ERROR, edge cases |`);
  
  // === 4. ESTIMATE REALISTIC RECERTIFICATION ===
  console.log('\n' + '='.repeat(70));
  console.log('4. REALISTIC RECERTIFICATION ESTIMATE');
  console.log('='.repeat(70));
  
  // Analyze each error type for fixability
  const estimates: { type: string; count: number; canFix: number; method: string }[] = [];
  
  for (const [errType, count] of sortedErrors) {
    let canFix = 0;
    let method = '';
    
    switch (errType) {
      case 'FUTURE_TRIM':
        canFix = Math.floor(count * 0.8); // 80% can be fixed with extended configs
        method = 'Extend FutureTrimConfig for remaining families';
        break;
      case 'DATA_MISMATCH':
        canFix = Math.floor(count * 0.5); // 50% can be cleaned
        method = 'Diameter alignment, remove mismatched sizes';
        break;
      case 'WHEEL_SPREAD':
        canFix = Math.floor(count * 0.3); // 30% - pick primary size
        method = 'Pick dominant wheel size, remove outliers';
        break;
      case 'TIRE_SOUP':
      case 'WHEEL_SOUP':
        canFix = Math.floor(count * 0.7); // 70% - simplify
        method = 'Reduce to 2-3 OEM options per trim';
        break;
      case 'MODERN_TIRES_ON_CLASSIC':
        canFix = Math.floor(count * 0.9); // 90% - filter obvious
        method = 'Remove anachronistic tire sizes';
        break;
      case 'SUSPICIOUS_FALLBACK':
        canFix = count; // 100% - these need manual correction
        method = 'Research correct OEM specs';
        break;
      case 'NO_ERROR_RECORDED':
        canFix = Math.floor(count * 0.5); // 50% - investigate
        method = 'Validate data, re-run certification';
        break;
      default:
        canFix = Math.floor(count * 0.3);
        method = 'Case-by-case analysis';
    }
    
    estimates.push({ type: errType, count, canFix, method });
  }
  
  console.log('\n| Error Type | Count | Est. Fixable | Method |');
  console.log('|------------|-------|--------------|--------|');
  
  let totalEstFixable = 0;
  for (const e of estimates) {
    totalEstFixable += e.canFix;
    console.log(`| ${e.type.padEnd(25)} | ${String(e.count).padStart(5)} | ${String(e.canFix).padStart(12)} | ${e.method.substring(0, 40)} |`);
  }
  
  console.log(`\nTotal estimated fixable: ${totalEstFixable} / ${result.rows.length} (${((totalEstFixable/result.rows.length)*100).toFixed(1)}%)`);
  
  // === 5. SAMPLE RECORDS BY ERROR TYPE ===
  console.log('\n' + '='.repeat(70));
  console.log('5. SAMPLE RECORDS BY ERROR TYPE');
  console.log('='.repeat(70));
  
  for (const [errType, samples] of Object.entries(byErrorTypeDetails)) {
    if (samples.length === 0) continue;
    console.log(`\n### ${errType} (${byErrorType[errType]}):`);
    for (const s of samples.slice(0, 3)) {
      const wheels = Array.isArray(s.oem_wheel_sizes) ? s.oem_wheel_sizes : [s.oem_wheel_sizes];
      const tires = Array.isArray(s.oem_tire_sizes) ? s.oem_tire_sizes : [s.oem_tire_sizes];
      const wheelDiams = wheels.map((w: any) => extractWheelDiameter(w)).filter((d: any) => d);
      const tireDiams = tires.map((t: any) => extractTireDiameter(t)).filter((d: any) => d);
      
      console.log(`  ${s.year} ${s.make} ${s.model} "${s.raw_trim}":`);
      console.log(`    Wheels: ${wheelDiams.join('/')}"`);
      console.log(`    Tires: ${tires.slice(0, 3).join(', ')}${tires.length > 3 ? '...' : ''}`);
    }
  }
  
  // === 6. RECOMMENDATION ===
  console.log('\n' + '='.repeat(70));
  console.log('6. RECOMMENDED FINAL CLEANUP STRATEGY');
  console.log('='.repeat(70));
  
  console.log(`
PRIORITY ORDER:

1. FUTURE_TRIM residual (${byErrorType['FUTURE_TRIM'] || 0} records)
   - Quick win: Extend configs for remaining families
   - Estimated fix: ${Math.floor((byErrorType['FUTURE_TRIM'] || 0) * 0.8)}
   
2. DATA_MISMATCH (${byErrorType['DATA_MISMATCH'] || 0} records)
   - Align wheel/tire diameters
   - Remove non-matching sizes
   - Estimated fix: ${Math.floor((byErrorType['DATA_MISMATCH'] || 0) * 0.5)}

3. MODERN_TIRES_ON_CLASSIC (${byErrorType['MODERN_TIRES_ON_CLASSIC'] || 0} records)
   - Filter R19+ from pre-1990 vehicles
   - Filter R20+ from pre-2000 vehicles
   - Estimated fix: ${Math.floor((byErrorType['MODERN_TIRES_ON_CLASSIC'] || 0) * 0.9)}

4. TIRE_SOUP + WHEEL_SOUP (${(byErrorType['TIRE_SOUP'] || 0) + (byErrorType['WHEEL_SOUP'] || 0)} records)
   - Reduce to 2-3 OEM-plausible options
   - Estimated fix: ${Math.floor(((byErrorType['TIRE_SOUP'] || 0) + (byErrorType['WHEEL_SOUP'] || 0)) * 0.7)}

5. WHEEL_SPREAD (${byErrorType['WHEEL_SPREAD'] || 0} records)
   - Manual: Pick dominant wheel size
   - Low priority - data quality issues
   - Estimated fix: ${Math.floor((byErrorType['WHEEL_SPREAD'] || 0) * 0.3)}

6. Remainder
   - Manual review or accept as-is
   
TOTAL ESTIMATED FIXABLE WITH ONE MORE PASS: ~${totalEstFixable} records
RESULTING CERTIFICATION RATE: ${((35120 + totalEstFixable) / (35120 + result.rows.length) * 100).toFixed(1)}%
`);
  
  await pool.end();
}

analyze().catch(console.error);
