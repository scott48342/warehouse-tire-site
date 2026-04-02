const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Classic muscle/sports cars that should have trim coverage
const CLASSIC_MODELS = [
  'mustang', 'camaro', 'challenger', 'charger', 'corvette', 'firebird', 'trans-am',
  'cuda', 'barracuda', 'gto', 'chevelle', 'nova', 'impala', 'monte-carlo',
  'roadrunner', 'road-runner', 'gtx', 'super-bee', 'dart', 'duster',
  'el-camino', 'ranchero', 'torino', 'fairlane', 'galaxie', 'maverick',
  '442', 'cutlass', 'toronado', 'riviera', 'skylark', 'gs', 'grand-national',
  'bronco', 'blazer', 'jimmy', 'scout', 
];

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  // Get all pre-2000 data
  const result = await pool.query(`
    SELECT year, make, model, COUNT(DISTINCT display_trim) as trim_count,
           array_agg(DISTINCT display_trim ORDER BY display_trim) as trims
    FROM vehicle_fitments
    WHERE year < 2000
    GROUP BY year, make, model
    ORDER BY make, model, year
  `);

  console.log('='.repeat(70));
  console.log('CLASSIC VEHICLE COVERAGE (pre-2000)');
  console.log('='.repeat(70));
  console.log(`\nTotal pre-2000 Y/M/M combinations: ${result.rows.length}\n`);

  // Group by make/model
  const modelCoverage = {};
  for (const row of result.rows) {
    const key = `${row.make}/${row.model}`;
    if (!modelCoverage[key]) {
      modelCoverage[key] = { years: [], multiTrimYears: 0, singleTrimYears: 0, minYear: 9999, maxYear: 0 };
    }
    modelCoverage[key].years.push({ year: row.year, trims: row.trim_count });
    if (row.trim_count > 1) modelCoverage[key].multiTrimYears++;
    else modelCoverage[key].singleTrimYears++;
    modelCoverage[key].minYear = Math.min(modelCoverage[key].minYear, row.year);
    modelCoverage[key].maxYear = Math.max(modelCoverage[key].maxYear, row.year);
  }

  // Find classic models in our data
  console.log('─'.repeat(70));
  console.log('CLASSIC MUSCLE/SPORTS CARS IN DATABASE');
  console.log('─'.repeat(70));

  const classicsFound = [];
  const classicsComplete = [];
  const classicsIncomplete = [];

  for (const [key, data] of Object.entries(modelCoverage)) {
    const model = key.split('/')[1];
    if (CLASSIC_MODELS.includes(model)) {
      classicsFound.push({ key, ...data });
      if (data.multiTrimYears > 0 || data.singleTrimYears <= 3) {
        classicsComplete.push({ key, ...data });
      } else {
        classicsIncomplete.push({ key, ...data });
      }
    }
  }

  for (const c of classicsFound.sort((a, b) => a.key.localeCompare(b.key))) {
    const status = c.multiTrimYears > 0 ? '✅' : '⚠️';
    console.log(`\n${status} ${c.key} (${c.minYear}-${c.maxYear})`);
    console.log(`   ${c.years.length} years | ${c.multiTrimYears} multi-trim | ${c.singleTrimYears} single-trim`);
  }

  // Show what classic models we DON'T have
  console.log('\n' + '─'.repeat(70));
  console.log('CLASSIC MODELS NOT IN DATABASE (pre-2000)');
  console.log('─'.repeat(70));

  const foundModels = new Set(classicsFound.map(c => c.key.split('/')[1]));
  const missing = CLASSIC_MODELS.filter(m => !foundModels.has(m));
  if (missing.length > 0) {
    console.log('\n' + missing.join(', '));
  } else {
    console.log('\nAll tracked classic models have some coverage!');
  }

  // Summary by decade
  console.log('\n' + '─'.repeat(70));
  console.log('COVERAGE BY DECADE');
  console.log('─'.repeat(70));

  const decades = { '1950s': 0, '1960s': 0, '1970s': 0, '1980s': 0, '1990s': 0 };
  for (const row of result.rows) {
    if (row.year >= 1950 && row.year < 1960) decades['1950s']++;
    else if (row.year >= 1960 && row.year < 1970) decades['1960s']++;
    else if (row.year >= 1970 && row.year < 1980) decades['1970s']++;
    else if (row.year >= 1980 && row.year < 1990) decades['1980s']++;
    else if (row.year >= 1990 && row.year < 2000) decades['1990s']++;
  }
  
  for (const [decade, count] of Object.entries(decades)) {
    console.log(`  ${decade}: ${count} Y/M/M combinations`);
  }

  // Top models by year coverage
  console.log('\n' + '─'.repeat(70));
  console.log('TOP 20 MODELS BY YEAR COVERAGE (pre-2000)');
  console.log('─'.repeat(70));

  const sorted = Object.entries(modelCoverage)
    .map(([key, data]) => ({ key, ...data }))
    .sort((a, b) => b.years.length - a.years.length)
    .slice(0, 20);

  for (const m of sorted) {
    const status = m.multiTrimYears > m.singleTrimYears ? '✅' : (m.multiTrimYears > 0 ? '🔶' : '⚠️');
    console.log(`  ${status} ${m.key}: ${m.years.length} years (${m.minYear}-${m.maxYear}) | ${m.multiTrimYears} multi / ${m.singleTrimYears} single`);
  }

  await pool.end();
}

main().catch(console.error);
