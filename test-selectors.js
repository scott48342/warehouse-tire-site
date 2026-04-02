/**
 * Test selector queries - simulates what the API does
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prisma = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

  console.log('Testing Selector Queries (simulating API behavior)\n');
  console.log('='.repeat(60));

  // Test 1: Years selector
  console.log('\n1. Years Selector:');
  const years = await prisma.query(`
    SELECT DISTINCT year FROM vehicle_fitments ORDER BY year DESC LIMIT 10
  `);
  console.log(`   Recent years: ${years.rows.map(r => r.year).join(', ')}`);

  // Test 2: Makes for a year
  console.log('\n2. Makes for 2024:');
  const makes = await prisma.query(`
    SELECT DISTINCT make FROM vehicle_fitments WHERE year = 2024 ORDER BY make LIMIT 15
  `);
  console.log(`   Makes: ${makes.rows.map(r => r.make).join(', ')}`);

  // Test 3: Models for a year/make
  console.log('\n3. Models for 2024 Ford:');
  const models = await prisma.query(`
    SELECT DISTINCT model FROM vehicle_fitments WHERE year = 2024 AND make = 'ford' ORDER BY model
  `);
  console.log(`   Models: ${models.rows.map(r => r.model).join(', ')}`);

  // Test 4: Trims for a YMM
  console.log('\n4. Trims for 2024 Ford F-150:');
  const trims = await prisma.query(`
    SELECT display_trim, modification_id, source FROM vehicle_fitments 
    WHERE year = 2024 AND make = 'ford' AND model = 'f-150'
    ORDER BY display_trim
  `);
  for (const t of trims.rows) {
    console.log(`   ${t.display_trim} (${t.source})`);
  }

  // Test 5: Full fitment data for a vehicle
  console.log('\n5. Full fitment for 2025 BMW 3 Series 330i xDrive (Railway import):');
  const fitment = await prisma.query(`
    SELECT * FROM vehicle_fitments 
    WHERE year = 2025 AND make = 'bmw' AND model = '3 series' AND display_trim = '330i xDrive'
  `);
  if (fitment.rows.length > 0) {
    const f = fitment.rows[0];
    console.log(`   Bolt Pattern: ${f.bolt_pattern}`);
    console.log(`   Center Bore: ${f.center_bore_mm}mm`);
    console.log(`   Thread: ${f.thread_size}`);
    console.log(`   Offset Range: ${f.offset_min_mm} - ${f.offset_max_mm}mm`);
    console.log(`   OEM Wheel Sizes: ${JSON.stringify(f.oem_wheel_sizes).slice(0, 100)}...`);
    console.log(`   OEM Tire Sizes: ${JSON.stringify(f.oem_tire_sizes)}`);
    console.log(`   Source: ${f.source}`);
  }

  // Test 6: Existing vehicle still works
  console.log('\n6. Existing vehicle (2024 Toyota Tacoma) - regression check:');
  const existing = await prisma.query(`
    SELECT * FROM vehicle_fitments 
    WHERE year = 2024 AND make = 'toyota' AND model = 'tacoma'
    LIMIT 1
  `);
  if (existing.rows.length > 0) {
    const e = existing.rows[0];
    console.log(`   Trim: ${e.display_trim}`);
    console.log(`   Bolt Pattern: ${e.bolt_pattern}`);
    console.log(`   Source: ${e.source}`);
    console.log(`   ✅ Existing record intact`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('All selector tests completed');

  await prisma.end();
}

main().catch(console.error);
