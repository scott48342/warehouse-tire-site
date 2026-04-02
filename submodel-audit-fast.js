/**
 * Submodel Completeness Audit (Optimized)
 * Fetches all data in one query, processes in memory
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Known multi-trim vehicles
const KNOWN_MULTI_TRIM_MODELS = new Set([
  'mustang', 'camaro', 'challenger', 'charger', 'corvette', 'gt-r', 'supra',
  '370z', '350z', 'brz', '86', 'gr86', 'wrx', 'sti', 'civic-type-r', 'civic-si',
  'golf-r', 'golf-gti', 'm3', 'm4', 'm5', 'c63', 'amg-gt', 'rs3', 'rs5', 'rs7',
  'f-150', 'f-250', 'f-350', 'f-250-super-duty', 'f-350-super-duty',
  'silverado-1500', 'silverado-2500', 'silverado-2500hd', 'silverado-3500',
  'ram-1500', 'ram-2500', 'ram-3500', '1500', '2500', '3500',
  'sierra-1500', 'sierra-2500', 'sierra-2500hd', 'sierra-3500',
  'tundra', 'titan', 'titan-xd', 'wrangler', 'grand-cherokee', 'bronco',
  '4runner', 'tacoma', '3-series', '5-series', 'c-class', 'e-class', 
  's-class', 'a4', 'a6', 's4', 's6', '300', '300c',
]);

const TIER_A_MODELS = new Set(['mustang', 'camaro', 'challenger', 'charger']);

const SPECIAL_FOCUS = ['300', '300c', 'mustang', 'camaro', 'challenger', 'charger', 
  'f-250', 'f-250-super-duty', 'f-350', 'f-350-super-duty'];

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(80));
  console.log('SUBMODEL COMPLETENESS AUDIT');
  console.log('='.repeat(80));

  // Fetch ALL fitment data in one query
  const allData = await pool.query(`
    SELECT year, make, model, display_trim, source
    FROM vehicle_fitments
    ORDER BY make, model, year DESC, display_trim
  `);

  console.log(`Total records: ${allData.rows.length}\n`);

  // Group by Y/M/M
  const ymmMap = new Map();
  for (const row of allData.rows) {
    const key = `${row.year}|${row.make}|${row.model}`;
    if (!ymmMap.has(key)) {
      ymmMap.set(key, {
        year: row.year,
        make: row.make,
        model: row.model,
        trims: [],
        sources: new Set(),
      });
    }
    const entry = ymmMap.get(key);
    entry.trims.push(row.display_trim);
    entry.sources.add(row.source);
  }

  console.log(`Total Y/M/M combinations: ${ymmMap.size}\n`);

  const results = {
    A_complete_multi: [],
    B_safe_single: [],
    C_likely_missing: [],
    D_collapsed_filtered: [],
    E_broken: [],
  };

  const specialFocusResults = [];

  for (const [key, data] of ymmMap) {
    const { year, make, model, trims, sources } = data;
    const dbTrimCount = trims.length;
    const hasOnlyBase = dbTrimCount === 1 && trims[0] === 'Base';
    const hasMultipleTrims = dbTrimCount > 1;
    const isKnownMultiTrim = KNOWN_MULTI_TRIM_MODELS.has(model);
    const isTierA = TIER_A_MODELS.has(model);

    // Customer-visible: if we have real trims, they show; otherwise WheelPros fallback
    const hasRealTrims = dbTrimCount > 1 || (dbTrimCount === 1 && trims[0] !== 'Base');
    const customerVisibleCount = hasRealTrims ? dbTrimCount : 0;

    let classification, classKey;

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
      classification = 'B: Safe single-trim (Base)';
      classKey = 'B_safe_single';
    } else if (dbTrimCount === 1 && isKnownMultiTrim) {
      classification = 'C: Likely missing trims';
      classKey = 'C_likely_missing';
    } else if (dbTrimCount === 0) {
      classification = 'E: Broken';
      classKey = 'E_broken';
    } else {
      classification = 'B: Safe single-trim';
      classKey = 'B_safe_single';
    }

    const record = {
      year, make, model, dbTrimCount, 
      customerVisibleCount, trims, 
      sources: [...sources], classification, isKnownMultiTrim, isTierA
    };

    results[classKey].push(record);

    if (SPECIAL_FOCUS.some(m => model === m || model.includes(m))) {
      specialFocusResults.push(record);
    }
  }

  // Summary
  console.log('─'.repeat(80));
  console.log('CLASSIFICATION SUMMARY');
  console.log('─'.repeat(80));
  console.log(`A: Complete multi-trim:        ${results.A_complete_multi.length}`);
  console.log(`B: Safe single-trim:           ${results.B_safe_single.length}`);
  console.log(`C: Likely missing trims:       ${results.C_likely_missing.length}`);
  console.log(`D: Collapsed/filtered in UI:   ${results.D_collapsed_filtered.length}`);
  console.log(`E: Broken/unexpected:          ${results.E_broken.length}`);
  console.log(`Total:                         ${ymmMap.size}`);

  // Top models with likely missing trims
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
    .slice(0, 25);

  for (const m of sortedMissing) {
    const yearRange = m.years.length > 1 
      ? `${Math.min(...m.years)}-${Math.max(...m.years)}`
      : `${m.years[0]}`;
    console.log(`  ${m.make} ${m.model}: ${m.count} year(s) [${yearRange}]`);
  }

  // Examples of acceptable single-trim
  console.log('\n' + '─'.repeat(80));
  console.log('EXAMPLES OF ACCEPTABLE SINGLE-TRIM (Class B, non-Base)');
  console.log('─'.repeat(80));

  const singleExamples = results.B_safe_single
    .filter(r => r.trims[0] !== 'Base')
    .slice(0, 12);

  for (const r of singleExamples) {
    console.log(`  ${r.year} ${r.make} ${r.model}: "${r.trims[0]}"`);
  }

  // Special Focus Section
  console.log('\n' + '='.repeat(80));
  console.log('SPECIAL FOCUS MODELS');
  console.log('='.repeat(80));

  const focusGroups = {};
  for (const r of specialFocusResults) {
    const key = `${r.make}/${r.model}`;
    if (!focusGroups[key]) focusGroups[key] = [];
    focusGroups[key].push(r);
  }

  for (const [key, records] of Object.entries(focusGroups).sort()) {
    const sorted = records.sort((a, b) => b.year - a.year);
    const classA = sorted.filter(r => r.classification.startsWith('A')).length;
    const classC = sorted.filter(r => r.classification.startsWith('C')).length;
    
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`${key.toUpperCase()} — ${sorted.length} years (${classA} complete, ${classC} gaps)`);
    console.log(`${'─'.repeat(60)}`);

    // Show summary by classification
    const byClass = {};
    for (const r of sorted) {
      const cls = r.classification.split(':')[0];
      if (!byClass[cls]) byClass[cls] = [];
      byClass[cls].push(r.year);
    }
    for (const [cls, years] of Object.entries(byClass)) {
      const range = years.length > 3 
        ? `${Math.max(...years)}-${Math.min(...years)}` 
        : years.join(', ');
      console.log(`  Class ${cls}: ${years.length} years [${range}]`);
    }

    // Sample trims for most recent complete year
    const recentComplete = sorted.find(r => r.classification.startsWith('A'));
    if (recentComplete) {
      const trimList = recentComplete.trims.length > 5
        ? `${recentComplete.trims.slice(0, 5).join(', ')} +${recentComplete.trims.length - 5} more`
        : recentComplete.trims.join(', ');
      console.log(`  Sample (${recentComplete.year}): ${trimList}`);
    }
  }

  // Prioritized Cleanup
  console.log('\n' + '='.repeat(80));
  console.log('PRIORITIZED CLEANUP LIST');
  console.log('='.repeat(80));

  // P1: Tier A
  const tierAIssues = results.C_likely_missing.filter(r => r.isTierA);
  console.log(`\n🔴 PRIORITY 1: Tier A models with gaps (${tierAIssues.length})`);
  if (tierAIssues.length === 0) {
    console.log('   ✅ None — all Tier A years have multi-trim coverage');
  } else {
    const byModel = {};
    for (const r of tierAIssues) {
      if (!byModel[r.model]) byModel[r.model] = [];
      byModel[r.model].push(r.year);
    }
    for (const [model, years] of Object.entries(byModel)) {
      console.log(`   ${model}: ${years.length} years (${years.slice(0, 5).join(', ')}${years.length > 5 ? '...' : ''})`);
    }
  }

  // P2: Trucks
  const truckModels = ['f-150', 'f-250', 'f-350', 'silverado', 'ram', 'sierra', 'tundra', 'titan'];
  const truckIssues = results.C_likely_missing.filter(r => 
    truckModels.some(t => r.model.includes(t))
  );
  console.log(`\n🟡 PRIORITY 2: Trucks with gaps (${truckIssues.length})`);
  const truckGrouped = {};
  for (const r of truckIssues) {
    const key = `${r.make}/${r.model}`;
    if (!truckGrouped[key]) truckGrouped[key] = [];
    truckGrouped[key].push(r.year);
  }
  for (const [key, years] of Object.entries(truckGrouped).slice(0, 8)) {
    console.log(`   ${key}: ${years.length} years`);
  }

  // P3: Other
  const otherIssues = results.C_likely_missing.filter(r => 
    !r.isTierA && !truckModels.some(t => r.model.includes(t))
  );
  console.log(`\n🟢 PRIORITY 3: Other performance models (${otherIssues.length})`);
  const otherGrouped = {};
  for (const r of otherIssues) {
    const key = `${r.make}/${r.model}`;
    if (!otherGrouped[key]) otherGrouped[key] = [];
    otherGrouped[key].push(r.year);
  }
  for (const [key, years] of Object.entries(otherGrouped).slice(0, 8)) {
    console.log(`   ${key}: ${years.length} years`);
  }

  // Write JSON report
  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalRecords: allData.rows.length,
      totalYMM: ymmMap.size,
      A_complete_multi: results.A_complete_multi.length,
      B_safe_single: results.B_safe_single.length,
      C_likely_missing: results.C_likely_missing.length,
      D_collapsed_filtered: results.D_collapsed_filtered.length,
      E_broken: results.E_broken.length,
    },
    likelyMissingByModel: sortedMissing,
    specialFocus: Object.fromEntries(
      Object.entries(focusGroups).map(([k, v]) => [
        k,
        v.sort((a, b) => b.year - a.year).map(r => ({
          year: r.year,
          trimCount: r.dbTrimCount,
          trims: r.trims,
          classification: r.classification,
        }))
      ])
    ),
    cleanupPriorities: {
      tierA: [...new Set(tierAIssues.map(r => `${r.make}/${r.model}`))],
      trucks: Object.keys(truckGrouped),
      other: Object.keys(otherGrouped).slice(0, 15),
    },
  };
  fs.writeFileSync('submodel-audit-report.json', JSON.stringify(report, null, 2));
  console.log('\n\n📄 Full report: submodel-audit-report.json');

  await pool.end();
}

main().catch(console.error);
