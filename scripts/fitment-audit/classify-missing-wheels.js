/**
 * Classify Missing Wheel Specs from Audit Results
 * 
 * Uses the audit JSON to classify records into actionable buckets.
 */

const fs = require('fs');
const path = require('path');

// Load audit results
const data = require('./wheel-audit-results.json');
const missing = data.records.filter(r => r.issueTypes.includes('missing_wheel_specs'));

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║       PHASE 2 MISSING WHEEL SPECS CLASSIFICATION              ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log(`Total missing_wheel_specs: ${missing.length}\n`);

// Year range breakdown
const legacy = missing.filter(r => r.year < 2015);
const modern = missing.filter(r => r.year >= 2015);
console.log('BY YEAR RANGE:');
console.log(`  Legacy (2000-2014): ${legacy.length}`);
console.log(`  Modern (2015-2026): ${modern.length}`);

// By model
const byModel = {};
missing.forEach(r => {
  const key = `${r.make}/${r.model}`;
  if (!byModel[key]) byModel[key] = { records: [], years: new Set(), make: r.make, model: r.model };
  byModel[key].records.push(r);
  byModel[key].years.add(r.year);
});

console.log('\nTOP 20 AFFECTED MODELS:');
Object.entries(byModel)
  .sort((a, b) => b[1].records.length - a[1].records.length)
  .slice(0, 20)
  .forEach(([model, info]) => {
    const yearArr = [...info.years].sort();
    const yearRange = yearArr.length > 2 
      ? `${yearArr[0]}-${yearArr[yearArr.length-1]}` 
      : yearArr.join(', ');
    console.log(`  ${model}: ${info.records.length} (${yearRange})`);
  });

// Identify naming inconsistencies
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                  MODEL NAMING ANALYSIS                        ');
console.log('═══════════════════════════════════════════════════════════════\n');

const modelVariants = {};
missing.forEach(r => {
  // Normalize model name
  const normalized = r.model.toLowerCase().replace(/-/g, '').replace(/\s+/g, '');
  if (!modelVariants[normalized]) modelVariants[normalized] = new Set();
  modelVariants[normalized].add(r.model);
});

const duplicateNames = Object.entries(modelVariants)
  .filter(([_, variants]) => variants.size > 1)
  .map(([norm, variants]) => ({
    normalized: norm,
    variants: [...variants],
    count: [...variants].reduce((sum, v) => sum + (byModel[Object.keys(byModel).find(k => k.endsWith('/' + v))]?.records.length || 0), 0)
  }))
  .sort((a, b) => b.count - a.count);

console.log('NAMING INCONSISTENCIES (same model, different slugs):');
duplicateNames.forEach(d => {
  console.log(`  ${d.variants.join(' vs ')}: ~${d.count} records affected`);
});

// Classification buckets
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                     CLASSIFICATION                            ');
console.log('═══════════════════════════════════════════════════════════════\n');

// HD Trucks (commercial relevance, need special handling)
const hdTrucks = missing.filter(r => 
  r.model.match(/2500|3500|hd|super-duty|heavy-duty/i)
);

// Light trucks/SUVs
const lightTrucks = missing.filter(r => 
  ['silverado-1500', 'sierra-1500', 'f-150', '1500', 'tahoe', 'yukon', 'suburban', 
   'expedition', 'explorer', 'wrangler', 'grand-cherokee', '4runner', 'tacoma', 'tundra']
    .some(t => r.model.toLowerCase().includes(t))
);

// Performance vehicles
const performance = missing.filter(r =>
  ['corvette', 'camaro', 'mustang', 'challenger', 'charger', 'viper', 'gt-r', 'supra', 'wrx']
    .some(t => r.model.toLowerCase().includes(t))
);

// Luxury
const luxury = missing.filter(r =>
  ['cadillac', 'lincoln', 'lexus', 'infiniti', 'acura', 'genesis', 'mercedes', 'bmw', 'audi']
    .some(t => r.make.toLowerCase().includes(t))
);

// Discontinued brands
const discontinued = missing.filter(r =>
  ['pontiac', 'saturn', 'oldsmobile', 'hummer', 'mercury', 'plymouth', 'geo']
    .some(t => r.make.toLowerCase().includes(t))
);

// Vans
const vans = missing.filter(r =>
  r.model.toLowerCase().match(/van|caravan|sienna|odyssey|pacifica|transit|sprinter|promaster/)
);

// Count unique records per category (some overlap)
const categories = {
  hd_trucks: { records: hdTrucks, desc: 'Heavy-duty trucks (2500/3500)' },
  light_trucks: { records: lightTrucks, desc: 'Light trucks & SUVs' },
  performance: { records: performance, desc: 'Performance vehicles' },
  luxury: { records: luxury, desc: 'Luxury brands' },
  discontinued: { records: discontinued, desc: 'Discontinued brands' },
  vans: { records: vans, desc: 'Vans & minivans' },
};

console.log('CATEGORY BREAKDOWN:');
Object.entries(categories).forEach(([key, info]) => {
  const legacyCount = info.records.filter(r => r.year < 2015).length;
  const modernCount = info.records.filter(r => r.year >= 2015).length;
  console.log(`  ${info.desc}: ${info.records.length} (legacy: ${legacyCount}, modern: ${modernCount})`);
});

// Unique models needing data
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                ACTIONABLE BUCKETS                              ');
console.log('═══════════════════════════════════════════════════════════════\n');

// Bucket 1: HD Trucks - need platform templates
console.log('🔧 BUCKET 1: HD TRUCKS (NEED PLATFORM TEMPLATES)');
console.log(`   Total: ${hdTrucks.length} records`);
const hdByModel = {};
hdTrucks.forEach(r => {
  const key = `${r.make}/${r.model}`;
  hdByModel[key] = (hdByModel[key] || 0) + 1;
});
console.log('   Models:');
Object.entries(hdByModel).sort((a,b) => b[1]-a[1]).forEach(([m, c]) => console.log(`     ${m}: ${c}`));

// Bucket 2: Light trucks with existing data (check for donors)
console.log('\n🔧 BUCKET 2: LIGHT TRUCKS (CHECK FOR DONORS)');
console.log(`   Total: ${lightTrucks.length} records`);
const ltByModel = {};
lightTrucks.forEach(r => {
  const key = `${r.make}/${r.model}`;
  ltByModel[key] = (ltByModel[key] || 0) + 1;
});
console.log('   Models:');
Object.entries(ltByModel).sort((a,b) => b[1]-a[1]).slice(0, 10).forEach(([m, c]) => console.log(`     ${m}: ${c}`));

// Bucket 3: Discontinued brands (low priority)
console.log('\n⏸️  BUCKET 3: DISCONTINUED BRANDS (LOW PRIORITY)');
console.log(`   Total: ${discontinued.length} records`);
const discByMake = {};
discontinued.forEach(r => {
  discByMake[r.make] = (discByMake[r.make] || 0) + 1;
});
console.log('   Makes:');
Object.entries(discByMake).sort((a,b) => b[1]-a[1]).forEach(([m, c]) => console.log(`     ${m}: ${c}`));

// Recommendations
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('              PHASE 2 RECOMMENDATIONS                          ');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('✅ SAFE INHERITANCE CANDIDATES:');
console.log('   Light trucks/SUVs with existing data in other years.');
console.log('   Action: Expand generation definitions + fill');
console.log(`   Est. fixable: ${lightTrucks.length - (lightTrucks.filter(r => hdByModel[`${r.make}/${r.model}`]).length)} records\n`);

console.log('📋 NEEDS PLATFORM TEMPLATES:');
console.log('   HD trucks have complex wheel data (dually, SRW/DRW options).');
console.log('   Action: Import OEM wheel specs for 2500/3500 models');
console.log(`   Est. records: ${hdTrucks.length}\n`);

console.log('🔗 NAMING CONSOLIDATION NEEDED:');
console.log('   Fix model slug inconsistencies (e.g., silverado-2500hd vs silverado-2500-hd)');
console.log(`   Affected: ${duplicateNames.reduce((s, d) => s + d.count, 0)} records\n`);

console.log('⏸️  DEFER (LOW PRIORITY):');
console.log('   Discontinued brands (Pontiac, Saturn, etc.)');
console.log(`   Records: ${discontinued.length}\n`);

console.log('⛔ DO NOT AUTO-FILL:');
console.log('   - HD trucks without verified dually/SRW specs');
console.log('   - Cross-generation inheritance');
console.log('   - Models with naming inconsistencies until fixed');

// Save analysis
const output = {
  timestamp: new Date().toISOString(),
  summary: {
    total: missing.length,
    legacy: legacy.length,
    modern: modern.length,
  },
  categories: Object.fromEntries(
    Object.entries(categories).map(([k, v]) => [k, {
      total: v.records.length,
      legacy: v.records.filter(r => r.year < 2015).length,
      modern: v.records.filter(r => r.year >= 2015).length,
    }])
  ),
  namingIssues: duplicateNames,
  topAffectedModels: Object.entries(byModel)
    .sort((a, b) => b[1].records.length - a[1].records.length)
    .slice(0, 30)
    .map(([model, info]) => ({
      model,
      count: info.records.length,
      years: [...info.years].sort(),
    })),
  hdTruckModels: Object.entries(hdByModel).sort((a,b) => b[1]-a[1]),
  recommendations: {
    safeInheritance: lightTrucks.length,
    needsTemplates: hdTrucks.length,
    namingFixes: duplicateNames.reduce((s, d) => s + d.count, 0),
    lowPriority: discontinued.length,
  },
};

fs.writeFileSync(
  path.join(__dirname, 'missing-wheel-classification.json'),
  JSON.stringify(output, null, 2)
);
console.log('📄 Results saved to: missing-wheel-classification.json');
