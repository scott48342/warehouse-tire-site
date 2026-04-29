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

console.log('=== INVESTIGATING FORD EDGE ===\n');

// Check all Ford models in fitments
const fordModels = await client.query(`
  SELECT DISTINCT model FROM vehicle_fitments
  WHERE make ILIKE 'Ford'
  ORDER BY model
`);
console.log('Ford models in vehicle_fitments:');
fordModels.rows.forEach(r => console.log(`  - ${r.model}`));

// Check for anything Edge-like
const edgeLike = await client.query(`
  SELECT DISTINCT model, year FROM vehicle_fitments
  WHERE make ILIKE 'Ford' AND (model ILIKE '%edge%' OR model ILIKE '%explorer%')
  ORDER BY model, year
`);
console.log('\nFord Edge or Explorer in fitments:');
if (edgeLike.rows.length === 0) {
  console.log('  NONE FOUND');
} else {
  const byModel = {};
  edgeLike.rows.forEach(r => {
    if (!byModel[r.model]) byModel[r.model] = [];
    byModel[r.model].push(r.year);
  });
  Object.entries(byModel).forEach(([model, years]) => {
    console.log(`  ${model}: ${years.join(', ')}`);
  });
}

console.log('\n\n=== INVESTIGATING NISSAN FRONTIER ===\n');

// Check all Nissan models
const nissanModels = await client.query(`
  SELECT DISTINCT model FROM vehicle_fitments
  WHERE make ILIKE 'Nissan'
  ORDER BY model
`);
console.log('Nissan models in vehicle_fitments:');
nissanModels.rows.forEach(r => console.log(`  - ${r.model}`));

// Check Frontier specifically
const frontier = await client.query(`
  SELECT year, display_trim, certification_status, source
  FROM vehicle_fitments
  WHERE make ILIKE 'Nissan' AND model ILIKE '%frontier%'
  ORDER BY year
`);
console.log('\nNissan Frontier records:');
if (frontier.rows.length === 0) {
  console.log('  NONE FOUND');
} else {
  frontier.rows.forEach(r => {
    console.log(`  ${r.year} ${r.display_trim || 'Base'} - ${r.certification_status} (source: ${r.source})`);
  });
}

// Check what years ARE covered for Frontier
const frontierYears = await client.query(`
  SELECT DISTINCT year FROM vehicle_fitments
  WHERE make ILIKE 'Nissan' AND model ILIKE '%frontier%'
  ORDER BY year
`);
const coveredYears = frontierYears.rows.map(r => r.year);
const allYears = [];
for (let y = 1998; y <= 2026; y++) allYears.push(y);
const missingYears = allYears.filter(y => !coveredYears.includes(y));

console.log('\nFrontier year coverage:');
console.log('  Covered:', coveredYears.join(', '));
console.log('  Missing:', missingYears.join(', '));

// Check if there's a different model name for those years
const nissanTrucks = await client.query(`
  SELECT DISTINCT model, year FROM vehicle_fitments
  WHERE make ILIKE 'Nissan' 
    AND year BETWEEN 2000 AND 2019
    AND (model ILIKE '%truck%' OR model ILIKE '%pickup%' OR model ILIKE '%titan%' OR model ILIKE '%d21%' OR model ILIKE '%hardbody%')
  ORDER BY model, year
`);
console.log('\nOther Nissan trucks 2000-2019:');
if (nissanTrucks.rows.length === 0) {
  console.log('  NONE FOUND');
} else {
  nissanTrucks.rows.forEach(r => console.log(`  ${r.year} ${r.model}`));
}

await client.end();
