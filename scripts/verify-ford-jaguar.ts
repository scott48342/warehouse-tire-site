import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  // Check a few samples
  const samples = await pool.query(`
    SELECT year, make, model, display_trim, bolt_pattern, 
           oem_wheel_sizes, oem_tire_sizes, quality_tier, source
    FROM vehicle_fitments
    WHERE make IN ('Ford', 'Jaguar')
      AND source = 'google-ai-overview'
    ORDER BY make, model, year
    LIMIT 10
  `);
  
  console.log('=== Sample Updated Records ===\n');
  for (const row of samples.rows) {
    console.log(`${row.year} ${row.make} ${row.model} (${row.display_trim})`);
    console.log(`  Bolt: ${row.bolt_pattern}`);
    console.log(`  Wheels: ${JSON.stringify(row.oem_wheel_sizes)}`);
    console.log(`  Tires: ${JSON.stringify(row.oem_tire_sizes)}`);
    console.log(`  Quality: ${row.quality_tier}`);
    console.log('');
  }
  
  // Count remaining incomplete
  const incomplete = await pool.query(`
    SELECT COUNT(*) as count
    FROM vehicle_fitments
    WHERE make IN ('Ford', 'Jaguar')
      AND (
        oem_wheel_sizes IS NULL 
        OR oem_wheel_sizes = '[]'::jsonb
        OR oem_tire_sizes IS NULL 
        OR oem_tire_sizes = '[]'::jsonb
      )
  `);
  
  console.log(`Remaining incomplete Ford/Jaguar records: ${incomplete.rows[0].count}`);
  
  await pool.end();
}

verify();
