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

// First check the table structure
const cols = await client.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'vehicle_fitments'
  ORDER BY ordinal_position
`);
console.log('vehicle_fitments columns:');
for (const c of cols.rows) {
  console.log(`  ${c.column_name}: ${c.data_type}`);
}

// Now search for Grand Cherokee
console.log('\n--- Grand Cherokee fitments ---');
const gc = await client.query(`
  SELECT * FROM vehicle_fitments 
  WHERE make ILIKE 'Jeep' 
    AND model ILIKE '%Grand Cherokee%'
  ORDER BY year DESC
  LIMIT 5
`);
if (gc.rows.length === 0) {
  console.log('No Grand Cherokee fitments found');
  
  // Check what Jeep models exist
  const jeepModels = await client.query(`
    SELECT DISTINCT model FROM vehicle_fitments WHERE make ILIKE 'Jeep' ORDER BY model LIMIT 20
  `);
  console.log('\nJeep models in database:', jeepModels.rows.map(r => r.model));
} else {
  for (const row of gc.rows) {
    console.log(JSON.stringify(row, null, 2));
  }
}

await client.end();
