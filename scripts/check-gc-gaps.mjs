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

// Grand Cherokee production years: 1993-present
const allYears = [];
for (let y = 1993; y <= 2026; y++) allYears.push(y);

// Get years in fitments
const fitmentYears = await client.query(`
  SELECT DISTINCT year FROM vehicle_fitments 
  WHERE make ILIKE 'Jeep' AND model ILIKE 'Grand Cherokee'
  ORDER BY year
`);
const existingYears = new Set(fitmentYears.rows.map(r => r.year));

console.log('Grand Cherokee fitment coverage:');
console.log('Existing years:', [...existingYears].sort((a,b) => a-b).join(', '));

const missingYears = allYears.filter(y => !existingYears.has(y));
console.log('\nMissing years:', missingYears.join(', '));
console.log(`\nCoverage: ${existingYears.size}/${allYears.length} years (${Math.round(existingYears.size/allYears.length*100)}%)`);

// Check where YMM data actually comes from
const catalogCheck = await client.query(`
  SELECT DISTINCT year FROM catalog_models 
  WHERE make ILIKE 'Jeep' AND model ILIKE '%Grand Cherokee%'
  ORDER BY year
`);
if (catalogCheck.rows.length > 0) {
  console.log('\nYears in catalog_models:', catalogCheck.rows.map(r => r.year).join(', '));
}

await client.end();
