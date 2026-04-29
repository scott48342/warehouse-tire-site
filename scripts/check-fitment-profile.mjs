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
      let val = m[2].replace(/^["']|["']$/g, '');
      process.env[m[1]] = val;
    }
  }
}

const { Client } = pg;

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl.replace(/^["']|["']$/g, ''), ssl: { rejectUnauthorized: false } });
await client.connect();

const year = parseInt(process.argv[2]) || 2014;
const make = process.argv[3] || 'Jeep';
const model = process.argv[4] || 'Grand Cherokee';

console.log(`Looking up fitment profile for: ${year} ${make} ${model}\n`);

// Check vehicle_fitments table
const res = await client.query(`
  SELECT * FROM vehicle_fitments 
  WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
  LIMIT 5
`, [year, make, model]);

if (res.rows.length === 0) {
  console.log('No fitment records found in vehicle_fitments table');
} else {
  console.log(`Found ${res.rows.length} fitment records:`);
  for (const row of res.rows) {
    console.log(`\nTrim: ${row.trim || 'Base'}`);
    console.log(`  Bolt Pattern: ${row.bolt_pattern}`);
    console.log(`  Hub Bore: ${row.hub_bore}`);
    console.log(`  OEM Sizes: ${row.oem_wheel_sizes}`);
    console.log(`  Tire Sizes: ${row.oem_tire_sizes}`);
    console.log(`  Source: ${row.source}`);
  }
}

// Now check if FC403 wheel specs match
const fc403 = {
  diameter: 20,
  width: 9,
  offset: 1,
  centerbore: 71.5,
  boltPattern: '5x127'
};

console.log(`\n--- FC403 BURN Specs ---`);
console.log(JSON.stringify(fc403, null, 2));

if (res.rows.length > 0) {
  const profile = res.rows[0];
  console.log(`\n--- Fitment Check ---`);
  console.log(`Bolt pattern match: ${profile.bolt_pattern === fc403.boltPattern ? '✅' : '❌'} (${profile.bolt_pattern})`);
  console.log(`Hub bore clearance: ${parseFloat(profile.hub_bore) <= fc403.centerbore ? '✅' : '❌'} (vehicle: ${profile.hub_bore}mm, wheel: ${fc403.centerbore}mm)`);
}

await client.end();
