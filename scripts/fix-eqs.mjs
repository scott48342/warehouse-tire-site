#!/usr/bin/env node
/**
 * Fix 2024 Mercedes-Benz EQS 450 fitment data
 * Correct bolt pattern from 5x114.3 to 5x112
 */

import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  console.log('=== Fixing EQS Fitment Data ===\n');

  // Check current data
  const { rows: before } = await pool.query(`
    SELECT display_trim, bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE make = 'Mercedes-Benz' AND model = 'EQS'
  `);
  
  console.log('Before fix:');
  for (const row of before) {
    console.log(`  ${row.display_trim}: bolt=${row.bolt_pattern}, hub=${row.center_bore_mm}`);
  }

  // Update to correct specs
  const result = await pool.query(`
    UPDATE vehicle_fitments 
    SET 
      bolt_pattern = '5x112',
      center_bore_mm = 66.6,
      thread_size = 'M14x1.5',
      offset_min_mm = 33,
      offset_max_mm = 33,
      oem_wheel_sizes = $1::jsonb,
      oem_tire_sizes = $2::jsonb,
      updated_at = NOW()
    WHERE make = 'Mercedes-Benz' AND model = 'EQS'
  `, [
    JSON.stringify([
      { diameter: 20, width: 8.5, offset: 33, boltPattern: '5x112' },
      { diameter: 21, width: 9.5, offset: 33, boltPattern: '5x112' },
      { diameter: 22, width: 9.5, offset: 33, boltPattern: '5x112' }
    ]),
    JSON.stringify(['255/45R20', '265/40R21', '265/35R22'])
  ]);
  
  console.log(`\nUpdated ${result.rowCount} rows`);

  // Verify
  const { rows: after } = await pool.query(`
    SELECT display_trim, bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE make = 'Mercedes-Benz' AND model = 'EQS'
  `);
  
  console.log('\nAfter fix:');
  for (const row of after) {
    console.log(`  ${row.display_trim}: bolt=${row.bolt_pattern}, hub=${row.center_bore_mm}`);
    console.log(`    wheels: ${JSON.stringify(row.oem_wheel_sizes)}`);
    console.log(`    tires: ${row.oem_tire_sizes?.join(', ')}`);
  }

  await pool.end();
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
