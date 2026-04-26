import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Get all Mercedes-Benz vehicles with missing tire/wheel data
  const result = await pool.query(`
    SELECT model, COUNT(*) as count
    FROM vehicle_fitments
    WHERE make ILIKE 'Mercedes%'
      AND (
        oem_tire_sizes IS NULL 
        OR oem_tire_sizes = '[]'::jsonb
        OR oem_tire_sizes = 'null'::jsonb
        OR oem_wheel_sizes IS NULL
        OR oem_wheel_sizes = '[]'::jsonb
      )
    GROUP BY model
    ORDER BY count DESC
  `);

  console.log('Mercedes-Benz models missing fitment data:');
  console.log('='.repeat(50));
  
  let total = 0;
  for (const row of result.rows) {
    console.log(`${row.model}: ${row.count} records`);
    total += parseInt(row.count);
  }
  
  console.log('='.repeat(50));
  console.log(`Total missing: ${total}`);

  // Get sample records
  console.log('\n\nSample records by model:');
  
  for (const row of result.rows.slice(0, 5)) {
    const samples = await pool.query(`
      SELECT year, model, display_trim, modification_id, oem_tire_sizes
      FROM vehicle_fitments
      WHERE make ILIKE 'Mercedes%'
        AND model = $1
        AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
      ORDER BY year DESC
      LIMIT 5
    `, [row.model]);
    
    console.log(`\n--- ${row.model} ---`);
    for (const s of samples.rows) {
      console.log(`  ${s.year} ${s.model} - ${s.display_trim || 'Base'} (${s.modification_id})`);
    }
  }

  await pool.end();
}

main();
