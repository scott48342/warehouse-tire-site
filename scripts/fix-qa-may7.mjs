#!/usr/bin/env node
/**
 * Fix QA failures from 2026-05-07 run
 * 
 * 1. Add tire sizes for Navigator and Gladiator trims
 */

import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  console.log('=== QA Fix Script - May 7, 2026 ===\n');

  // 1. Update Navigator trims with tire sizes
  console.log('1. Updating Lincoln Navigator tire sizes...');
  
  const navigatorTrims = [
    { trim: 'Reserve', tireSizes: ['285/45R22'], wheelDiameters: [22] },
    { trim: 'Premiere', tireSizes: ['275/55R20', '285/45R22'], wheelDiameters: [20, 22] },
    { trim: 'Black Label', tireSizes: ['285/45R22'], wheelDiameters: [22] },
    { trim: 'L Reserve', tireSizes: ['285/45R22'], wheelDiameters: [22] },
    { trim: 'L Black Label', tireSizes: ['285/45R22'], wheelDiameters: [22] },
  ];

  for (const spec of navigatorTrims) {
    const result = await pool.query(`
      UPDATE vehicle_fitments 
      SET oem_tire_sizes = $1::jsonb
      WHERE year = 2024 AND make = 'Lincoln' AND model = 'Navigator' AND display_trim = $2
    `, [JSON.stringify(spec.tireSizes), spec.trim]);
    console.log(`  Updated ${spec.trim}: ${spec.tireSizes.join(', ')} (${result.rowCount} rows)`);
  }

  // 2. Update Gladiator trims with tire sizes
  console.log('\n2. Updating Jeep Gladiator tire sizes...');
  
  const gladiatorTrims = [
    { trim: 'Sport', tireSizes: ['245/75R17'], wheelDiameters: [17] },
    { trim: 'Sport S', tireSizes: ['245/75R17'], wheelDiameters: [17] },
    { trim: 'Rubicon', tireSizes: ['LT285/70R17'], wheelDiameters: [17] },
    { trim: 'Rubicon X', tireSizes: ['LT285/70R17'], wheelDiameters: [17] },
    { trim: 'Mojave', tireSizes: ['LT285/70R17'], wheelDiameters: [17] },
    { trim: 'Mojave X', tireSizes: ['LT285/70R17'], wheelDiameters: [17] },
    { trim: 'Nighthawk', tireSizes: ['275/55R20'], wheelDiameters: [20] },
    { trim: 'Willys', tireSizes: ['LT255/75R17'], wheelDiameters: [17] },
    { trim: 'Texas Trail', tireSizes: ['LT255/75R17'], wheelDiameters: [17] },
    { trim: 'High Tide', tireSizes: ['LT255/75R17'], wheelDiameters: [17] },
  ];

  for (const spec of gladiatorTrims) {
    const result = await pool.query(`
      UPDATE vehicle_fitments 
      SET oem_tire_sizes = $1::jsonb
      WHERE year = 2024 AND make = 'Jeep' AND model = 'Gladiator' AND display_trim = $2
    `, [JSON.stringify(spec.tireSizes), spec.trim]);
    console.log(`  Updated ${spec.trim}: ${spec.tireSizes.join(', ')} (${result.rowCount} rows)`);
  }

  // 3. Verify the updates
  console.log('\n3. Verifying updates...');
  
  const { rows: navCheck } = await pool.query(`
    SELECT display_trim, oem_tire_sizes FROM vehicle_fitments 
    WHERE year = 2024 AND make = 'Lincoln' AND model = 'Navigator'
  `);
  
  console.log('\nNavigator 2024 trims:');
  for (const row of navCheck) {
    console.log(`  ${row.display_trim}: ${row.oem_tire_sizes?.join(', ') || 'NO TIRE SIZES'}`);
  }

  const { rows: gladCheck } = await pool.query(`
    SELECT display_trim, oem_tire_sizes FROM vehicle_fitments 
    WHERE year = 2024 AND make = 'Jeep' AND model = 'Gladiator'
  `);
  
  console.log('\nGladiator 2024 trims:');
  for (const row of gladCheck) {
    console.log(`  ${row.display_trim}: ${row.oem_tire_sizes?.join(', ') || 'NO TIRE SIZES'}`);
  }

  await pool.end();
  console.log('\n✅ Done!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
