import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const resultsDir = './results';

// Analyze batch result files
console.log('=== BATCH RESULTS QUALITY ANALYSIS ===\n');

const files = readdirSync(resultsDir).filter(f => f.endsWith('.json'));
let totalComplete = 0;
let totalDNE = 0;
let totalFailed = 0;
let highConf = 0;
let medConf = 0;
let lowConf = 0;

const makeStats = {};

for (const file of files.sort()) {
  const data = JSON.parse(readFileSync(join(resultsDir, file), 'utf-8'));
  const results = data.results || [];
  
  let complete = 0, dne = 0, failed = 0;
  
  for (const r of results) {
    if (r.status === 'complete') {
      complete++;
      if (r.confidence === 'high') highConf++;
      else if (r.confidence === 'medium') medConf++;
      else lowConf++;
      
      // Track by make
      const make = r.make;
      if (!makeStats[make]) makeStats[make] = { complete: 0, dne: 0 };
      makeStats[make].complete++;
    } else if (r.status === 'dne' || r.status === 'not_produced') {
      dne++;
      const make = r.make;
      if (!makeStats[make]) makeStats[make] = { complete: 0, dne: 0 };
      makeStats[make].dne++;
    } else {
      failed++;
    }
  }
  
  totalComplete += complete;
  totalDNE += dne;
  totalFailed += failed;
  
  console.log(`${file}: ${complete} complete, ${dne} DNE, ${failed} failed`);
}

console.log('\n=== TOTALS ===');
console.log(`Complete: ${totalComplete}`);
console.log(`DNE (vehicle didn't exist): ${totalDNE}`);
console.log(`Failed: ${totalFailed}`);
console.log(`Total researched: ${totalComplete + totalDNE + totalFailed}`);

const successRate = ((totalComplete / (totalComplete + totalFailed)) * 100).toFixed(1);
console.log(`\nSuccess rate (excluding DNE): ${successRate}%`);

console.log('\n=== CONFIDENCE BREAKDOWN ===');
console.log(`High confidence: ${highConf} (${((highConf/totalComplete)*100).toFixed(1)}%)`);
console.log(`Medium confidence: ${medConf} (${((medConf/totalComplete)*100).toFixed(1)}%)`);
console.log(`Low confidence: ${lowConf} (${((lowConf/totalComplete)*100).toFixed(1)}%)`);

console.log('\n=== BY MAKE (top 15) ===');
const sortedMakes = Object.entries(makeStats)
  .sort((a, b) => b[1].complete - a[1].complete)
  .slice(0, 15);
for (const [make, stats] of sortedMakes) {
  console.log(`${make}: ${stats.complete} complete, ${stats.dne} DNE`);
}

// Now query database for coverage
console.log('\n\n=== DATABASE COVERAGE (90s) ===\n');

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Total records
const totalRes = await client.query(`
  SELECT COUNT(*) as count FROM vehicle_fitments WHERE year >= 1990 AND year <= 1999
`);
console.log(`Total 90s records in DB: ${totalRes.rows[0].count}`);

// By year
const byYear = await client.query(`
  SELECT year, COUNT(*) as count 
  FROM vehicle_fitments 
  WHERE year >= 1990 AND year <= 1999 
  GROUP BY year ORDER BY year
`);
console.log('\nBy Year:');
for (const row of byYear.rows) {
  console.log(`  ${row.year}: ${row.count}`);
}

// Unique YMM
const uniqueYMM = await client.query(`
  SELECT COUNT(DISTINCT (year, make, model)) as count 
  FROM vehicle_fitments 
  WHERE year >= 1990 AND year <= 1999
`);
console.log(`\nUnique YMM combinations: ${uniqueYMM.rows[0].count}`);

// By make
const byMake = await client.query(`
  SELECT make, COUNT(*) as count 
  FROM vehicle_fitments 
  WHERE year >= 1990 AND year <= 1999 
  GROUP BY make ORDER BY count DESC LIMIT 20
`);
console.log('\nTop makes in DB:');
for (const row of byMake.rows) {
  console.log(`  ${row.make}: ${row.count}`);
}

// Check for gaps - makes with low coverage
const gapCheck = await client.query(`
  SELECT make, COUNT(DISTINCT model) as models, COUNT(*) as records
  FROM vehicle_fitments 
  WHERE year >= 1990 AND year <= 1999 
  GROUP BY make 
  HAVING COUNT(*) < 20
  ORDER BY make
`);
if (gapCheck.rows.length > 0) {
  console.log('\n=== POTENTIAL GAPS (< 20 records) ===');
  for (const row of gapCheck.rows) {
    console.log(`  ${row.make}: ${row.models} models, ${row.records} records`);
  }
}

await client.end();
