/**
 * Submodel Completeness Audit
 * 
 * For every selector-reachable Y/M/M, determines:
 * 1. DB trim count
 * 2. Trims API count (what API would return)
 * 3. Customer-visible count (what UI shows)
 * 4. Classification: A/B/C/D/E
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Known multi-trim vehicles (performance cars, trucks with packages, etc.)
const KNOWN_MULTI_TRIM_MODELS = new Set([
  // Performance cars
  'mustang', 'camaro', 'challenger', 'charger', 'corvette', 'gt-r', 'supra',
  '370z', '350z', 'brz', '86', 'gr86', 'wrx', 'sti', 'civic-type-r', 'civic-si',
  'golf-r', 'golf-gti', 'm3', 'm4', 'm5', 'c63', 'amg-gt', 'rs3', 'rs5', 'rs7',
  // Trucks with significant trim differences
  'f-150', 'f-250', 'f-350', 'f-250-super-duty', 'f-350-super-duty',
  'silverado-1500', 'silverado-2500', 'silverado-2500hd', 'silverado-3500',
  'ram-1500', 'ram-2500', 'ram-3500', '1500', '2500', '3500',
  'sierra-1500', 'sierra-2500', 'sierra-2500hd', 'sierra-3500',
  'tundra', 'titan', 'titan-xd',
  // Luxury with performance variants
  '3-series', '5-series', 'c-class', 'e-class', 's-class', 'a4', 'a6', 's4', 's6',
  // SUVs with significant variants
  'wrangler', 'grand-cherokee', 'bronco', '4runner', 'tacoma',
]);

// Tier A models we specifically curated
const TIER_A_MODELS = new Set([
  'mustang', 'camaro', 'challenger', 'charger'
]);

// Special focus models for detailed report
const SPECIAL_FOCUS = [
  { make: 'chrysler', model: '300' },
  { make: 'chrysler', model: '300c' },
  { make: 'ford', model: 'mustang' },
  { make: 'chevrolet', model: 'camaro' },
  { make: 'dodge', model: 'challenger' },
  { make: 'dodge', model: 'charger' },
  { make: 'ford', model: 'f-250' },
  { make: 'ford', model: 'f-250-super-duty' },
  { make: 'ford', model: 'f-350' },
  { make: 'ford', model: 'f-350-super-duty' },
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(80));
  console.log('SUBMODEL COMPLETENESS AUDIT');
  console.log('='.repeat(80));
  console.log('Analyzing all selector-reachable Y/M/M combinations...\n');

  // Get all unique Y/M/M combinations
  const ymmResult = await pool.query(`
    SELECT DISTINCT year, make, model
    FROM vehicle_fitments
    ORDER BY make, model, year DESC
  `);

  const allYMM = ymmResult.rows;
  console.log(`Total Y/M/M combinations: ${allYMM.length}\n`);

  const results = {
    A_complete_multi: [],
    B_safe_single: [],
    C_likely_missing: [],
    D_collapsed_filtered: [],
    E_broken: [],
  };

  const makeModelStats = {};
  const specialFocusResults = [];

  for (const ymm of allYMM) {
    const { year, make, model } = ymm;
    const key = `${make}/${model}`;

    // 1. Get DB trim count
    const dbTrims = await pool.query(`
      SELECT display_trim, modification_id, source
      FROM vehicle_fitments
      WHERE year = $1 AND make = $2 AND model = $3
      ORDER BY display_trim
    `, [year, make, model]);

    const dbTrimCount = dbTrims.rows.length;
    const dbTrimLabels = dbTrims.rows.map(r => r.display_trim);
    const sources = [...new Set(dbTrims.rows.map(r => r.source))];

    // 2. Trims API count (what the coverage query returns)
    // This is the same as DB since we query vehicle_fitments directly
    const apiTrimCount = dbTrimCount;

    // 3. Customer-visible count (after our fix: fitment DB first)
    // The UI shows all trims from fitment DB if it has "real" trims
    const hasRealTrims = dbTrimCount > 1 || 
      (dbTrimCount === 1 && dbTrimLabels[0] !== 'Base');
    const customerVisibleCount = hasRealTrims ? dbTrimCount : 0; // 0 means fallback to WheelPros

    // 4. Classification
    const isKnownMultiTrim = KNOWN_MULTI_TRIM_MODELS.has(model);
    const isTierA = TIER_A_MODELS.has(model);
    const hasOnlyBase = dbTrimCount === 1 && dbTrimLabels[0] === 'Base';
    const hasMultipleTrims = dbTrimCount > 1;

    let classification;
    let classKey;

    if (hasMultipleTrims) {
      classification = 'A: Complete multi-trim';
      classKey = 'A_complete_multi';
    } else if (dbTrimCount === 1 && !hasOnlyBase && !isKnownMultiTrim) {
      classification = 'B: Safe single-trim';
      classKey = 'B_safe_single';
    } else if (hasOnlyBase && isKnownMultiTrim) {
      classification = 'C: Likely missing trims';
      classKey = 'C_likely_missing';
    } else if (hasOnlyBase && !isKnownMultiTrim) {
      classification = 'B: Safe single-trim (Base fallback)';
      classKey = 'B_safe_single';
    } else if (dbTrimCount === 1 && isKnownMultiTrim) {
      classification = 'C: Likely missing trims';
      classKey = 'C_likely_missing';
    } else if (dbTrimCount === 0) {
      classification = 'E: Broken (no trims)';
      classKey = 'E_broken';
    } else {
      classification = 'B: Safe single-trim';
      classKey = 'B_safe_single';
    }

    const record = {
      year,
      make,
      model,
      dbTrimCount,
      apiTrimCount,
      customerVisibleCount,
      trims: dbTrimLabels,
      sources,
      classification,
      isKnownMultiTrim,
      isTierA,
    };

    results[classKey].push(record);

    // Track make/model stats
    if (!makeModelStats[key]) {
      makeModelStats[key] = { 
        make, 
        model, 
        years: [], 
        classifications: {},
        isKnownMultiTrim,
        isTierA,
      };
    }
    makeModelStats[key].years.push(year);
    makeModelStats[key].classifications[classification] = 
      (makeModelStats[key].classifications[classification] || 0) + 1;

    // Check if this is a special focus model
    const isSpecialFocus = SPECIAL_FOCUS.some(sf => 
      sf.make === make && (sf.model === model || model.includes(sf.model))
    );
    if (isSpecialFocus) {
      specialFocusResults.push(record);
    }
  }

  // Summary statistics
  console.log('─'.repeat(80));
  console.log('CLASSIFICATION SUMMARY');
  console.log('─'.repeat(80));
  console.log(`A: Complete multi-trim:        ${results.A_complete_multi.length}`);
  console.log(`B: Safe single-trim:           ${results.B_safe_single.length}`);
  console.log(`C: Likely missing trims:       ${results.C_likely_missing.length}`);
  console.log(`D: Collapsed/filtered in UI:   ${results.D_collapsed_filtered.length}`);
  console.log(`E: Broken/unexpected:          ${results.E_broken.length}`);
  console.log(`Total:                         ${allYMM.length}`);

  // Top makes/models with likely missing trims
  console.log('\n' + '─'.repeat(80));
  console.log('TOP MODELS WITH LIKELY MISSING TRIMS (Class C)');
  console.log('─'.repeat(80));
  
  const missingByModel = {};
  for (const r of results.C_likely_missing) {
    const key = `${r.make}/${r.model}`;
    if (!missingByModel[key]) {
      missingByModel[key] = { make: r.make, model: r.model, count: 0, years: [] };
    }
    missingByModel[key].count++;
    missingByModel[key].years.push(r.year);
  }
  
  const sortedMissing = Object.values(missingByModel)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  for (const m of sortedMissing) {
    const yearRange = `${Math.min(...m.years)}-${Math.max(...m.years)}`;
    console.log(`  ${m.make} ${m.model}: ${m.count} year(s) (${yearRange})`);
  }

  // Examples of acceptable single-trim vehicles
  console.log('\n' + '─'.repeat(80));
  console.log('EXAMPLES OF ACCEPTABLE SINGLE-TRIM VEHICLES (Class B)');
  console.log('─'.repeat(80));
  
  const singleTrimExamples = results.B_safe_single
    .filter(r => r.trims[0] !== 'Base')
    .slice(0, 15);
  
  for (const r of singleTrimExamples) {
    console.log(`  ${r.year} ${r.make} ${r.model}: "${r.trims[0]}"`);
  }

  // Special focus section
  console.log('\n' + '='.repeat(80));
  console.log('SPECIAL FOCUS MODELS');
  console.log('='.repeat(80));

  const focusGroups = {};
  for (const r of specialFocusResults) {
    const key = `${r.make}/${r.model}`;
    if (!focusGroups[key]) {
      focusGroups[key] = [];
    }
    focusGroups[key].push(r);
  }

  for (const [key, records] of Object.entries(focusGroups)) {
    const sorted = records.sort((a, b) => b.year - a.year);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`${key.toUpperCase()}`);
    console.log(`${'─'.repeat(60)}`);
    
    for (const r of sorted.slice(0, 5)) {
      const trimsDisplay = r.trims.length > 3 
        ? `${r.trims.slice(0, 3).join(', ')} +${r.trims.length - 3} more`
        : r.trims.join(', ');
      console.log(`  ${r.year}: ${r.dbTrimCount} trims [${r.classification}]`);
      console.log(`         ${trimsDisplay}`);
    }
    if (sorted.length > 5) {
      console.log(`  ... and ${sorted.length - 5} more years`);
    }
  }

  // Prioritized cleanup list
  console.log('\n' + '='.repeat(80));
  console.log('PRIORITIZED CLEANUP LIST');
  console.log('='.repeat(80));
  
  // Priority 1: Tier A models with issues
  const tierAIssues = results.C_likely_missing.filter(r => r.isTierA);
  if (tierAIssues.length > 0) {
    console.log('\n🔴 PRIORITY 1: Tier A models with likely missing trims');
    for (const r of tierAIssues) {
      console.log(`   ${r.year} ${r.make} ${r.model}: only "${r.trims.join(', ')}"`);
    }
  } else {
    console.log('\n✅ PRIORITY 1: All Tier A models have complete trims');
  }

  // Priority 2: Popular trucks missing trims
  const truckModels = ['f-150', 'f-250', 'f-350', 'silverado', 'ram', 'sierra', 'tundra'];
  const truckIssues = results.C_likely_missing.filter(r => 
    truckModels.some(t => r.model.includes(t))
  );
  if (truckIssues.length > 0) {
    console.log('\n🟡 PRIORITY 2: Trucks with likely missing trims');
    const grouped = {};
    for (const r of truckIssues) {
      const key = `${r.make}/${r.model}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r.year);
    }
    for (const [key, years] of Object.entries(grouped).slice(0, 10)) {
      console.log(`   ${key}: ${years.length} years (${Math.min(...years)}-${Math.max(...years)})`);
    }
  }

  // Priority 3: Other performance models
  const otherPerf = results.C_likely_missing.filter(r => 
    r.isKnownMultiTrim && !r.isTierA && !truckModels.some(t => r.model.includes(t))
  );
  if (otherPerf.length > 0) {
    console.log('\n🟢 PRIORITY 3: Other performance models with likely missing trims');
    const grouped = {};
    for (const r of otherPerf) {
      const key = `${r.make}/${r.model}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r.year);
    }
    for (const [key, years] of Object.entries(grouped).slice(0, 10)) {
      console.log(`   ${key}: ${years.length} years`);
    }
  }

  // Write detailed report to file
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: allYMM.length,
      A_complete_multi: results.A_complete_multi.length,
      B_safe_single: results.B_safe_single.length,
      C_likely_missing: results.C_likely_missing.length,
      D_collapsed_filtered: results.D_collapsed_filtered.length,
      E_broken: results.E_broken.length,
    },
    likelyMissingByModel: sortedMissing,
    tierAStatus: {
      mustang: specialFocusResults.filter(r => r.model === 'mustang').map(r => ({
        year: r.year, trims: r.trims, classification: r.classification
      })),
      camaro: specialFocusResults.filter(r => r.model === 'camaro').map(r => ({
        year: r.year, trims: r.trims, classification: r.classification
      })),
      challenger: specialFocusResults.filter(r => r.model === 'challenger').map(r => ({
        year: r.year, trims: r.trims, classification: r.classification
      })),
      charger: specialFocusResults.filter(r => r.model === 'charger').map(r => ({
        year: r.year, trims: r.trims, classification: r.classification
      })),
    },
    cleanupPriorities: {
      tierA: tierAIssues.map(r => `${r.year} ${r.make} ${r.model}`),
      trucks: [...new Set(truckIssues.map(r => `${r.make}/${r.model}`))],
      otherPerformance: [...new Set(otherPerf.map(r => `${r.make}/${r.model}`))],
    },
  };

  const fs = require('fs');
  fs.writeFileSync('submodel-audit-report.json', JSON.stringify(report, null, 2));
  console.log('\n\nDetailed report written to: submodel-audit-report.json');

  await pool.end();
}

main().catch(console.error);
