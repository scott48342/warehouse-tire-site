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

// Check all Grand Cherokee years
const res = await client.query(`
  SELECT DISTINCT year, center_bore_mm 
  FROM vehicle_fitments 
  WHERE make ILIKE 'Jeep' AND model ILIKE 'Grand Cherokee'
  ORDER BY year
`);

console.log('Grand Cherokee center bore by year:');
for (const row of res.rows) {
  console.log(`  ${row.year}: ${row.center_bore_mm}mm`);
}

// Also check 2014 specifically
const res2014 = await client.query(`
  SELECT * FROM vehicle_fitments 
  WHERE make ILIKE 'Jeep' 
    AND model ILIKE 'Grand Cherokee'
    AND year = 2014
  LIMIT 1
`);
if (res2014.rows.length > 0) {
  console.log('\n2014 Grand Cherokee record:');
  console.log(JSON.stringify(res2014.rows[0], null, 2));
} else {
  console.log('\nNo 2014 Grand Cherokee record found - using fallback');
}

await client.end();
