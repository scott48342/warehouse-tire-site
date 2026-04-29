import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const { Client } = pg;
const dbUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').replace(/^["']|["']$/g, '');
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

await client.connect();

console.log('=== FITMENT GAP AUDIT ===\n');

// Get catalog data with make name from catalog_makes
const catalogData = await client.query(`
  SELECT m.name as make, cm.name as model, cm.years 
  FROM catalog_models cm
  JOIN catalog_makes m ON cm.make_slug = m.slug
  ORDER BY m.name, cm.name
`);

console.log(`Found ${catalogData.rows.length} models in catalog\n`);

// Get all YMM from vehicle_fitments
const fitmentData = await client.query(`
  SELECT DISTINCT year, make, model FROM vehicle_fitments
  WHERE certification_status = 'certified'
`);

// Build a set of existing fitments (normalized)
const fitmentSet = new Set();
for (const row of fitmentData.rows) {
  const key = `${row.year}|${row.make.toLowerCase().trim()}|${row.model.toLowerCase().trim()}`;
  fitmentSet.add(key);
}
console.log(`Found ${fitmentSet.size} unique year/make/model in vehicle_fitments\n`);

// Parse years from catalog and find gaps
const gaps = [];
let totalYmmInCatalog = 0;
let totalCovered = 0;

for (const row of catalogData.rows) {
  const make = row.make;
  const model = row.model;
  let years = [];
  
  // Parse years - could be "2020-2025" or array or JSON
  const yearsRaw = row.years;
  if (typeof yearsRaw === 'string') {
    if (yearsRaw.includes('-')) {
      const [start, end] = yearsRaw.split('-').map(y => parseInt(y.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        for (let y = start; y <= end; y++) years.push(y);
      }
    } else if (yearsRaw.startsWith('[')) {
      try {
        years = JSON.parse(yearsRaw);
      } catch {}
    } else {
      const parsed = parseInt(yearsRaw);
      if (!isNaN(parsed)) years.push(parsed);
    }
  } else if (Array.isArray(yearsRaw)) {
    years = yearsRaw.map(y => parseInt(y)).filter(y => !isNaN(y));
  }
  
  if (years.length === 0) continue;
  
  const missingYears = [];
  for (const year of years) {
    totalYmmInCatalog++;
    const key = `${year}|${make.toLowerCase().trim()}|${model.toLowerCase().trim()}`;
    if (fitmentSet.has(key)) {
      totalCovered++;
    } else {
      missingYears.push(year);
    }
  }
  
  if (missingYears.length > 0) {
    gaps.push({
      make,
      model,
      totalYears: years.length,
      missingYears: missingYears.sort((a,b) => a-b),
      missingCount: missingYears.length,
      coveragePercent: Math.round((years.length - missingYears.length) / years.length * 100)
    });
  }
}

// Sort by number of missing years (worst first)
gaps.sort((a, b) => b.missingCount - a.missingCount);

console.log('=== SUMMARY ===\n');
console.log(`Total YMM in catalog: ${totalYmmInCatalog}`);
console.log(`Covered by fitments: ${totalCovered}`);
console.log(`Missing: ${totalYmmInCatalog - totalCovered}`);
console.log(`Overall Coverage: ${Math.round(totalCovered/totalYmmInCatalog*100)}%\n`);

console.log(`Vehicles with gaps: ${gaps.length}`);
console.log('\n--- Top 40 Vehicles with Missing Years ---\n');

for (const gap of gaps.slice(0, 40)) {
  const yearsStr = gap.missingYears.length <= 8 
    ? gap.missingYears.join(', ')
    : gap.missingYears.slice(0, 4).join(', ') + ` ... +${gap.missingYears.length - 4} more`;
  console.log(`${gap.make} ${gap.model}: ${gap.missingCount} missing (${gap.coveragePercent}% covered)`);
  console.log(`  → ${yearsStr}`);
}

// Save full report
const reportPath = path.join(__dirname, 'fitment-gap-report.json');
fs.writeFileSync(reportPath, JSON.stringify(gaps, null, 2));
console.log(`\n✅ Full report saved to: scripts/fitment-gap-report.json`);
console.log(`   Total vehicles with gaps: ${gaps.length}`);

await client.end();
