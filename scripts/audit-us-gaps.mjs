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

console.log('=== US-MARKET FITMENT GAP AUDIT (2000-2026) ===\n');

// US-market makes
const usMakes = new Set([
  'Ford', 'Chevrolet', 'GMC', 'Dodge', 'Ram', 'Jeep', 'Chrysler', 'Buick', 'Cadillac',
  'Lincoln', 'Toyota', 'Honda', 'Nissan', 'Mazda', 'Subaru', 'Mitsubishi', 'Lexus',
  'Acura', 'Infiniti', 'Hyundai', 'Kia', 'Genesis', 'BMW', 'Mercedes-Benz', 'Audi',
  'Volkswagen', 'Porsche', 'Volvo', 'Land Rover', 'Tesla', 'Rivian'
]);

// Get catalog data
const catalogData = await client.query(`
  SELECT m.name as make, cm.name as model, cm.years 
  FROM catalog_models cm
  JOIN catalog_makes m ON cm.make_slug = m.slug
  ORDER BY m.name, cm.name
`);

// Get fitments
const fitmentData = await client.query(`
  SELECT DISTINCT year, make, model FROM vehicle_fitments
  WHERE certification_status = 'certified'
`);

const fitmentSet = new Set();
for (const row of fitmentData.rows) {
  const key = `${row.year}|${row.make.toLowerCase().trim()}|${row.model.toLowerCase().trim()}`;
  fitmentSet.add(key);
}

const gaps = [];

for (const row of catalogData.rows) {
  const make = row.make;
  const model = row.model;
  
  // Skip non-US makes
  if (!usMakes.has(make)) continue;
  
  let years = [];
  const yearsRaw = row.years;
  if (typeof yearsRaw === 'string') {
    if (yearsRaw.includes('-')) {
      const [start, end] = yearsRaw.split('-').map(y => parseInt(y.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        for (let y = start; y <= end; y++) years.push(y);
      }
    } else if (yearsRaw.startsWith('[')) {
      try { years = JSON.parse(yearsRaw); } catch {}
    }
  } else if (Array.isArray(yearsRaw)) {
    years = yearsRaw.map(y => parseInt(y)).filter(y => !isNaN(y));
  }
  
  // Only 2000+ years
  years = years.filter(y => y >= 2000 && y <= 2026);
  if (years.length === 0) continue;
  
  const missingYears = [];
  for (const year of years) {
    const key = `${year}|${make.toLowerCase().trim()}|${model.toLowerCase().trim()}`;
    if (!fitmentSet.has(key)) {
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

// Sort by missing count
gaps.sort((a, b) => b.missingCount - a.missingCount);

// Group by severity
const critical = gaps.filter(g => g.missingCount >= 10);
const moderate = gaps.filter(g => g.missingCount >= 5 && g.missingCount < 10);
const minor = gaps.filter(g => g.missingCount < 5);

console.log('=== SUMMARY (US Market 2000-2026) ===\n');
console.log(`Vehicles with gaps: ${gaps.length}`);
console.log(`  Critical (10+ years missing): ${critical.length}`);
console.log(`  Moderate (5-9 years missing): ${moderate.length}`);
console.log(`  Minor (<5 years missing): ${minor.length}`);

console.log('\n=== CRITICAL GAPS (10+ years missing) ===\n');
for (const gap of critical.slice(0, 50)) {
  const yearsStr = gap.missingYears.length <= 10 
    ? gap.missingYears.join(', ')
    : gap.missingYears.slice(0, 5).join(', ') + ` ... +${gap.missingYears.length - 5} more`;
  console.log(`${gap.make} ${gap.model}: ${gap.missingCount} missing (${gap.coveragePercent}% covered)`);
  console.log(`  → ${yearsStr}`);
}

if (moderate.length > 0) {
  console.log('\n=== MODERATE GAPS (5-9 years missing) ===\n');
  for (const gap of moderate.slice(0, 30)) {
    console.log(`${gap.make} ${gap.model}: ${gap.missingCount} missing → ${gap.missingYears.join(', ')}`);
  }
}

// Save report
const reportPath = path.join(__dirname, 'us-fitment-gaps.json');
fs.writeFileSync(reportPath, JSON.stringify({ critical, moderate, minor }, null, 2));
console.log(`\n✅ Full report: scripts/us-fitment-gaps.json`);

await client.end();
