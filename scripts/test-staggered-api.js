/**
 * Test staggered detection in wheel fitment search
 * 
 * Verifies that:
 * 1. Staggered vehicles return isStaggered: true
 * 2. Non-staggered vehicles return isStaggered: false
 * 3. Front/rear specs are properly returned for staggered vehicles
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  console.log('\n=== Staggered Detection Test ===\n');

  // Test cases: vehicles that should be staggered
  const staggeredTests = [
    { year: 2024, make: 'ford', model: 'mustang', trim: 'Shelby GT500' },
    { year: 2024, make: 'ford', model: 'mustang', trim: 'GT Performance Pack' },
    { year: 2024, make: 'ford', model: 'mustang', trim: 'Dark Horse' },
    { year: 2024, make: 'chevrolet', model: 'camaro', trim: 'SS' },
    { year: 2024, make: 'chevrolet', model: 'camaro', trim: 'ZL1' },
    { year: 2018, make: 'dodge', model: 'challenger', trim: 'SRT Demon' },
  ];

  // Test cases: vehicles that should NOT be staggered
  const nonStaggeredTests = [
    { year: 2024, make: 'ford', model: 'mustang', trim: 'EcoBoost' },
    { year: 2024, make: 'ford', model: 'mustang', trim: 'GT' },
    { year: 2024, make: 'chevrolet', model: 'camaro', trim: 'LS' },
    { year: 2024, make: 'chevrolet', model: 'camaro', trim: 'LT' },
    { year: 2023, make: 'dodge', model: 'challenger', trim: 'SXT' },
    { year: 2023, make: 'dodge', model: 'charger', trim: 'R/T' },
  ];

  let passed = 0;
  let failed = 0;

  // Test staggered vehicles
  console.log('--- STAGGERED VEHICLES ---');
  for (const test of staggeredTests) {
    const result = await client.query(
      `SELECT display_trim, oem_wheel_sizes 
       FROM vehicle_fitments 
       WHERE year = $1 AND make = $2 AND model = $3 AND display_trim = $4`,
      [test.year, test.make, test.model, test.trim]
    );

    if (result.rows.length === 0) {
      console.log(`❌ NOT FOUND: ${test.year} ${test.make} ${test.model} ${test.trim}`);
      failed++;
      continue;
    }

    const wheelSizes = result.rows[0].oem_wheel_sizes || [];
    const hasFront = wheelSizes.some(w => w.axle === 'front');
    const hasRear = wheelSizes.some(w => w.axle === 'rear');
    const isStaggered = hasFront && hasRear;

    if (isStaggered) {
      const frontSpec = wheelSizes.find(w => w.axle === 'front');
      const rearSpec = wheelSizes.find(w => w.axle === 'rear');
      console.log(`✅ ${test.year} ${test.make} ${test.model} ${test.trim}`);
      console.log(`   Front: ${frontSpec.diameter}x${frontSpec.width} (${frontSpec.tireSize})`);
      console.log(`   Rear:  ${rearSpec.diameter}x${rearSpec.width} (${rearSpec.tireSize})`);
      passed++;
    } else {
      console.log(`❌ SHOULD BE STAGGERED: ${test.year} ${test.make} ${test.model} ${test.trim}`);
      console.log(`   Wheel sizes: ${JSON.stringify(wheelSizes)}`);
      failed++;
    }
  }

  // Test non-staggered vehicles
  console.log('\n--- NON-STAGGERED VEHICLES ---');
  for (const test of nonStaggeredTests) {
    const result = await client.query(
      `SELECT display_trim, oem_wheel_sizes 
       FROM vehicle_fitments 
       WHERE year = $1 AND make = $2 AND model = $3 AND display_trim = $4`,
      [test.year, test.make, test.model, test.trim]
    );

    if (result.rows.length === 0) {
      console.log(`❌ NOT FOUND: ${test.year} ${test.make} ${test.model} ${test.trim}`);
      failed++;
      continue;
    }

    const wheelSizes = result.rows[0].oem_wheel_sizes || [];
    const hasFront = wheelSizes.some(w => w.axle === 'front');
    const hasRear = wheelSizes.some(w => w.axle === 'rear');
    const isStaggered = hasFront && hasRear;

    if (!isStaggered) {
      const specs = wheelSizes.map(w => `${w.diameter}x${w.width}`).join(', ');
      console.log(`✅ ${test.year} ${test.make} ${test.model} ${test.trim} - ${specs}`);
      passed++;
    } else {
      console.log(`❌ SHOULD NOT BE STAGGERED: ${test.year} ${test.make} ${test.model} ${test.trim}`);
      console.log(`   Wheel sizes: ${JSON.stringify(wheelSizes)}`);
      failed++;
    }
  }

  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed === 0) {
    console.log('\n✅ All staggered detection tests PASSED!\n');
  } else {
    console.log('\n❌ Some tests FAILED!\n');
    process.exitCode = 1;
  }

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
