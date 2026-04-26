import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';

const { Pool } = pg;

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) {
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  // Get all Toyota records with incomplete data
  const result = await pool.query(`
    SELECT id, year, make, model, display_trim, modification_id,
           oem_wheel_sizes, oem_tire_sizes, quality_tier, source
    FROM vehicle_fitments
    WHERE LOWER(make) = 'toyota'
      AND (
        oem_wheel_sizes IS NULL 
        OR oem_tire_sizes IS NULL 
        OR quality_tier IS NULL 
        OR quality_tier != 'complete'
        OR jsonb_array_length(COALESCE(oem_tire_sizes, '[]'::jsonb)) < 1
      )
    ORDER BY model, year, display_trim
  `);
  
  console.log('Total Toyota records needing data:', result.rows.length);
  
  const byModel: Record<string, any[]> = {};
  for (const r of result.rows) {
    if (!byModel[r.model]) byModel[r.model] = [];
    byModel[r.model].push(r);
  }
  
  for (const [model, records] of Object.entries(byModel)) {
    console.log(`\n=== ${model} (${records.length} records) ===`);
    const years = [...new Set(records.map(r => r.year))].sort();
    console.log(`  Years: ${years.join(', ')}`);
    const trims = [...new Set(records.map(r => r.display_trim).filter(Boolean))];
    console.log(`  Trims: ${trims.join(', ')}`);
  }
  
  // Write full data to JSON file
  writeFileSync('scripts/toyota-missing.json', JSON.stringify(result.rows, null, 2));
  console.log('\nWrote full data to scripts/toyota-missing.json');
  
  await pool.end();
}
check().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
