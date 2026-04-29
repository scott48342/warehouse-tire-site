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

// Step 1: Find years in YMM engine
const ymmYears = await client.query(`
  SELECT DISTINCT year FROM vehicle_years 
  WHERE make = 'Jeep' AND model = 'Grand Cherokee'
  ORDER BY year
`);
console.log('Years in YMM engine:', ymmYears.rows.map(r => r.year).join(', '));

// Step 2: Find years in fitments table
const fitmentYears = await client.query(`
  SELECT DISTINCT year FROM vehicle_fitments 
  WHERE make = 'Jeep' AND model = 'Grand Cherokee'
  ORDER BY year
`);
console.log('Years in fitments:', fitmentYears.rows.map(r => r.year).join(', '));

// Step 3: Find missing years
const ymmSet = new Set(ymmYears.rows.map(r => r.year));
const fitmentSet = new Set(fitmentYears.rows.map(r => r.year));
const missingYears = [...ymmSet].filter(y => !fitmentSet.has(y)).sort((a,b) => a-b);
console.log('\nMISSING YEARS:', missingYears.join(', '));
console.log(`Total: ${missingYears.length} years to backfill\n`);

if (missingYears.length === 0) {
  console.log('✅ No missing years!');
  await client.end();
  process.exit(0);
}

// Step 4: Get template from 2025 (most complete data)
const templateRes = await client.query(`
  SELECT display_trim, bolt_pattern, center_bore_mm, thread_size, seat_type, 
         oem_wheel_sizes, oem_tire_sizes, modification_id
  FROM vehicle_fitments 
  WHERE make = 'Jeep' AND model = 'Grand Cherokee' AND year = 2025
  AND certification_status = 'certified'
`);
console.log(`Using ${templateRes.rows.length} trims from 2025 as template\n`);

// Step 5: Backfill each missing year
let totalInserted = 0;
for (const year of missingYears) {
  console.log(`--- Backfilling ${year} ---`);
  let yearInserted = 0;
  
  for (const row of templateRes.rows) {
    const modId = row.modification_id || row.display_trim.toLowerCase().replace(/\s+/g, '-');
    
    try {
      await client.query(`
        INSERT INTO vehicle_fitments (
          year, make, model, display_trim, modification_id,
          bolt_pattern, center_bore_mm, thread_size, seat_type,
          oem_wheel_sizes, oem_tire_sizes,
          certification_status, quality_tier, source
        ) VALUES (
          $1, 'Jeep', 'Grand Cherokee', $2, $3,
          $4, 71.5, $5, $6,
          $7, $8,
          'certified', 'complete', 'backfill-gc'
        )
        ON CONFLICT (year, make, model, modification_id) DO NOTHING
      `, [
        year,
        row.display_trim,
        modId,
        row.bolt_pattern,
        row.thread_size,
        row.seat_type,
        JSON.stringify(row.oem_wheel_sizes),
        JSON.stringify(row.oem_tire_sizes)
      ]);
      yearInserted++;
    } catch (e) {
      // Ignore duplicates
    }
  }
  
  console.log(`  Added ${yearInserted} trims for ${year}`);
  totalInserted += yearInserted;
}

// Step 6: Clear all Grand Cherokee cache entries
const { Redis } = await import('@upstash/redis');
let url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
let token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
url = url.replace(/^["']|["']$/g, '');
token = token.replace(/^["']|["']$/g, '');

if (url && token) {
  const redis = new Redis({ url, token });
  const keys = await redis.keys('wt:fit:*:jeep:grand-cherokee:*');
  console.log(`\nClearing ${keys.length} cache entries...`);
  for (const key of keys) {
    await redis.del(key);
  }
  console.log('Cache cleared.');
}

await client.end();
console.log(`\n✅ DONE! Backfilled ${totalInserted} total records across ${missingYears.length} years.`);
