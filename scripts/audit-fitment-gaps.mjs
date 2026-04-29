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

// First, understand the catalog_models structure
const sampleCatalog = await client.query(`
  SELECT * FROM catalog_models LIMIT 3
`);
console.log('catalog_models columns:', Object.keys(sampleCatalog.rows[0] || {}).join(', '));

// Get all YMM combinations from catalog_models
// The 'years' column might be a range or array
const catalogData = await client.query(`
  SELECT make, model, years FROM catalog_models
  ORDER BY make, model
`);

console.log(`\nFound ${catalogData.rows.length} models in catalog_models`);

// Get all YMM from vehicle_fitments
const fitmentData = await client.query(`
  SELECT DISTINCT year, make, model FROM vehicle_fitments
  WHERE certification_status = 'certified'
`);

// Build a set of existing fitments
const fitmentSet = new Set();
for (const row of fitmentData.rows) {
  const key = `${row.year}|${row.make.toLowerCase()}|${row.model.toLowerCase()}`;
  fitmentSet.add(key);
}
console.log(`Found ${fitmentSet.size} unique year/make/model combinations in vehicle_fitments\n`);

// Parse years from catalog and find gaps
const gaps = [];
let totalYmmInCatalog = 0;
let totalCovered = 0;

for (const row of catalogData.rows) {
  const make = row.make;
  const model = row.model;
  let years = [];
  
  // Parse years - could be "2020-2025" or "[2020,2021,2022]" or just numbers
  const yearsRaw = row.years;
  if (typeof yearsRaw === 'string') {
    if (yearsRaw.includes('-')) {
      const [start, end] = yearsRaw.split('-').map(y => parseInt(y.trim()));
      for (let y = start; y <= end; y++) years.push(y);
    } else if (yearsRaw.includes(',')) {
      years = yearsRaw.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));
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
    const key = `${year}|${make.toLowerCase()}|${model.toLowerCase()}`;
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
      missingCount: missingYears.length
    });
  }
}

// Sort by number of missing years (worst first)
gaps.sort((a, b) => b.missingCount - a.missingCount);

console.log('=== GAPS FOUND ===\n');
console.log(`Total YMM in catalog: ${totalYmmInCatalog}`);
console.log(`Covered by fitments: ${totalCovered}`);
console.log(`Missing: ${totalYmmInCatalog - totalCovered}`);
console.log(`Coverage: ${Math.round(totalCovered/totalYmmInCatalog*100)}%\n`);

console.log('--- Top 30 Vehicles with Missing Years ---\n');
for (const gap of gaps.slice(0, 30)) {
  const yearsStr = gap.missingYears.length <= 10 
    ? gap.missingYears.join(', ')
    : gap.missingYears.slice(0, 5).join(', ') + ` ... +${gap.missingYears.length - 5} more`;
  console.log(`${gap.make} ${gap.model}: ${gap.missingCount}/${gap.totalYears} years missing`);
  console.log(`  Missing: ${yearsStr}`);
}

// Save full report
const reportPath = path.join(__dirname, 'fitment-gap-report.json');
fs.writeFileSync(reportPath, JSON.stringify(gaps, null, 2));
console.log(`\nFull report saved to: ${reportPath}`);

await client.end();
