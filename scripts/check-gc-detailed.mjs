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

// Check for 2014 with various trim patterns
const res = await client.query(`
  SELECT year, display_trim, raw_trim, modification_id, center_bore_mm, bolt_pattern, certification_status
  FROM vehicle_fitments 
  WHERE make ILIKE 'Jeep' 
    AND model ILIKE '%Grand Cherokee%'
    AND (year = 2014 OR display_trim ILIKE '%limited%')
  ORDER BY year, display_trim
  LIMIT 20
`);

console.log('Grand Cherokee fitments (2014 or Limited trim):');
for (const row of res.rows) {
  console.log(`  ${row.year} ${row.display_trim}: hub=${row.center_bore_mm}mm, status=${row.certification_status}`);
}

// Check total count
const countRes = await client.query(`
  SELECT COUNT(*) as cnt FROM vehicle_fitments 
  WHERE make ILIKE 'Jeep' AND model ILIKE '%Grand Cherokee%'
`);
console.log('\nTotal Grand Cherokee records:', countRes.rows[0].cnt);

// Check for fitment rules
const rulesRes = await client.query(`
  SELECT * FROM vehicle_fitment_rules 
  WHERE make ILIKE 'Jeep' AND model ILIKE '%Grand Cherokee%'
  LIMIT 5
`);
console.log('\nFitment rules:', rulesRes.rows.length);
for (const row of rulesRes.rows) {
  console.log(`  ${JSON.stringify(row)}`);
}

await client.end();
