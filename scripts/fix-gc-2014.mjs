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

// Get trims from 2025 Grand Cherokee as template
const templateRes = await client.query(`
  SELECT display_trim, bolt_pattern, center_bore_mm, thread_size, seat_type, 
         oem_wheel_sizes, oem_tire_sizes, modification_id
  FROM vehicle_fitments 
  WHERE make = 'Jeep' AND model = 'Grand Cherokee' AND year = 2025
  AND certification_status = 'certified'
`);

console.log(`Found ${templateRes.rows.length} template trims from 2025 Grand Cherokee`);

// Insert 2014 records based on 2025 templates
let inserted = 0;
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
        2014, 'Jeep', 'Grand Cherokee', $1, $2,
        $3, 71.5, $4, $5,
        $6, $7,
        'certified', 'complete', 'backfill-2014'
      )
      ON CONFLICT (year, make, model, modification_id) DO UPDATE SET
        center_bore_mm = 71.5,
        certification_status = 'certified'
    `, [
      row.display_trim,
      modId,
      row.bolt_pattern,
      row.thread_size,
      row.seat_type,
      JSON.stringify(row.oem_wheel_sizes),
      JSON.stringify(row.oem_tire_sizes)
    ]);
    inserted++;
    console.log(`  ✅ Added/updated 2014 ${row.display_trim}`);
  } catch (e) {
    console.log(`  ❌ Failed ${row.display_trim}: ${e.message}`);
  }
}

console.log(`\nInserted/updated ${inserted} records for 2014 Grand Cherokee`);

// Clear the bad cache
const { Redis } = await import('@upstash/redis');
let url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
let token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
url = url.replace(/^["']|["']$/g, '');
token = token.replace(/^["']|["']$/g, '');

if (url && token) {
  const redis = new Redis({ url, token });
  
  // Delete all 2014 Grand Cherokee cache entries
  const keys = await redis.keys('wt:fit:2014:jeep:grand-cherokee:*');
  console.log(`\nClearing ${keys.length} cache entries...`);
  for (const key of keys) {
    await redis.del(key);
    console.log(`  Deleted: ${key}`);
  }
}

await client.end();
console.log('\n✅ Done! 2014 Grand Cherokee now has correct 71.5mm hub bore.');
