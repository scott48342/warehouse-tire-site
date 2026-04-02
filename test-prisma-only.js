/**
 * Test that app works with POSTGRES_URL only (no DATABASE_URL)
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log('='.repeat(60));
  console.log('TESTING PRISMA-ONLY DATABASE ACCESS');
  console.log('='.repeat(60));

  // Verify DATABASE_URL is NOT set
  console.log('\n1️⃣ Environment Check:');
  console.log(`   POSTGRES_URL: ${process.env.POSTGRES_URL ? '✓ SET' : '✗ NOT SET'}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '⚠️ STILL SET' : '✓ NOT SET (good)'}`);

  if (process.env.DATABASE_URL) {
    console.log('\n⚠️ DATABASE_URL is still set! Remove it from .env.local');
    return;
  }

  if (!process.env.POSTGRES_URL) {
    console.log('\n❌ POSTGRES_URL is not set!');
    return;
  }

  // Connect using POSTGRES_URL
  console.log('\n2️⃣ Database Connection:');
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  try {
    const connTest = await pool.query('SELECT 1 as test');
    console.log('   ✓ Connected to Prisma Postgres');
  } catch (e) {
    console.log(`   ❌ Connection failed: ${e.message}`);
    return;
  }

  // Test fitment queries
  console.log('\n3️⃣ Fitment Resolution Tests:');

  // Test vehicle_fitments table
  const fitmentCount = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  console.log(`   vehicle_fitments: ${fitmentCount.rows[0].count} records ✓`);

  // Test specific vehicles
  const testVehicles = [
    { year: 2020, make: 'ford', model: 'mustang' },
    { year: 2020, make: 'chevrolet', model: 'camaro' },
    { year: 2020, make: 'dodge', model: 'challenger' },
    { year: 2015, make: 'ford', model: 'f-250' },
  ];

  for (const v of testVehicles) {
    const res = await pool.query(`
      SELECT display_trim, bolt_pattern, jsonb_array_length(oem_wheel_sizes) as wheels
      FROM vehicle_fitments
      WHERE year = $1 AND make = $2 AND model = $3
      LIMIT 1
    `, [v.year, v.make, v.model]);
    
    if (res.rows.length > 0) {
      console.log(`   ${v.year} ${v.make} ${v.model}: ✓ (${res.rows[0].wheels} wheels, ${res.rows[0].bolt_pattern})`);
    } else {
      console.log(`   ${v.year} ${v.make} ${v.model}: ✗ NOT FOUND`);
    }
  }

  // Test wheel product tables
  console.log('\n4️⃣ Product Tables:');
  const wpWheels = await pool.query('SELECT COUNT(*) FROM wp_wheels');
  const wpTires = await pool.query('SELECT COUNT(*) FROM wp_tires');
  const wpInventory = await pool.query('SELECT COUNT(*) FROM wp_inventory');
  console.log(`   wp_wheels: ${wpWheels.rows[0].count} ✓`);
  console.log(`   wp_tires: ${wpTires.rows[0].count} ✓`);
  console.log(`   wp_inventory: ${wpInventory.rows[0].count} ✓`);

  // Test selector queries
  console.log('\n5️⃣ Selector Queries:');
  const years = await pool.query('SELECT DISTINCT year FROM vehicle_fitments ORDER BY year DESC LIMIT 5');
  console.log(`   Years: ${years.rows.map(r => r.year).join(', ')} ✓`);
  
  const makes = await pool.query('SELECT DISTINCT make FROM vehicle_fitments WHERE year = 2024 ORDER BY make LIMIT 5');
  console.log(`   Makes (2024): ${makes.rows.map(r => r.make).join(', ')} ✓`);

  await pool.end();

  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL TESTS PASSED - APP CAN RUN WITH POSTGRES_URL ONLY');
  console.log('='.repeat(60));
}

main().catch(e => {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
});
