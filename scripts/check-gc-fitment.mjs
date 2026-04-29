import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
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

// Check all fitment-related tables
const tables = [
  'vehicle_fitments',
  'vehicle_fitment_rules',
  'vehicle_configs',
  'unified_fitments'
];

for (const table of tables) {
  try {
    const res = await client.query(`
      SELECT * FROM ${table} 
      WHERE (make ILIKE 'Jeep' OR make ILIKE '%Jeep%')
        AND (model ILIKE 'Grand Cherokee' OR model ILIKE '%Grand Cherokee%')
        AND (year = 2014 OR year IS NULL)
      LIMIT 3
    `);
    if (res.rows.length > 0) {
      console.log(`\n=== ${table} ===`);
      for (const row of res.rows) {
        console.log(JSON.stringify(row, null, 2));
      }
    }
  } catch (e) {
    // Table might not exist
  }
}

// Also check what bolt patterns are being searched
console.log('\n=== Grand Cherokee wheel search logic ===');
const gcSearch = await client.query(`
  SELECT DISTINCT bolt_pattern, hub_bore 
  FROM vehicle_fitments 
  WHERE make ILIKE 'Jeep' 
    AND model ILIKE '%Grand Cherokee%'
  LIMIT 10
`);
console.log('Bolt patterns in vehicle_fitments for Grand Cherokee:', gcSearch.rows);

// Check vehicle_fitment_rules for Jeep
const rulesSearch = await client.query(`
  SELECT * FROM vehicle_fitment_rules 
  WHERE make ILIKE 'Jeep'
  LIMIT 5
`);
console.log('\nJeep fitment rules:', rulesSearch.rows);

await client.end();
