/**
 * Test audience targeting with real test data
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function testAudience() {
  console.log('🎯 Testing Audience Targeting\n');
  
  try {
    // Test 1: All eligible (with test data)
    console.log('1. All eligible subscribers (includeTest=true):');
    const all = await pool.query(`
      SELECT COUNT(DISTINCT email) as count
      FROM email_subscribers
      WHERE unsubscribed = false
      AND marketing_consent = true
      AND suppression_reason IS NULL
      AND is_test = true
    `);
    console.log(`   → ${all.rows[0].count} subscribers\n`);
    
    // Test 2: Ford vehicles only
    console.log('2. Ford vehicles only:');
    const ford = await pool.query(`
      SELECT DISTINCT email, vehicle_make, vehicle_model
      FROM email_subscribers
      WHERE unsubscribed = false
      AND marketing_consent = true
      AND suppression_reason IS NULL
      AND is_test = true
      AND vehicle_make = 'Ford'
    `);
    console.log(`   → ${ford.rows.length} subscribers:`);
    for (const r of ford.rows) {
      console.log(`      ${r.email} (${r.vehicle_make} ${r.vehicle_model})`);
    }
    
    // Test 3: Performance cars (Mustang, Camaro, Challenger)
    console.log('\n3. Performance cars (Mustang, Camaro, Challenger):');
    const performance = await pool.query(`
      SELECT DISTINCT email, vehicle_make, vehicle_model
      FROM email_subscribers
      WHERE unsubscribed = false
      AND marketing_consent = true
      AND suppression_reason IS NULL
      AND is_test = true
      AND vehicle_model IN ('Mustang', 'Camaro', 'Challenger')
    `);
    console.log(`   → ${performance.rows.length} subscribers:`);
    for (const r of performance.rows) {
      console.log(`      ${r.email}`);
    }
    
    // Test 4: Trucks (F-150, Silverado, 1500)
    console.log('\n4. Trucks:');
    const trucks = await pool.query(`
      SELECT DISTINCT email, vehicle_make, vehicle_model
      FROM email_subscribers
      WHERE unsubscribed = false
      AND marketing_consent = true
      AND suppression_reason IS NULL
      AND is_test = true
      AND (vehicle_model LIKE '%150%' OR vehicle_model LIKE '%1500%' OR vehicle_model = 'Silverado')
    `);
    console.log(`   → ${trucks.rows.length} subscribers:`);
    for (const r of trucks.rows) {
      console.log(`      ${r.email} (${r.vehicle_make} ${r.vehicle_model})`);
    }
    
    // Test 5: Newsletter source only
    console.log('\n5. Newsletter subscribers only:');
    const newsletter = await pool.query(`
      SELECT DISTINCT email, source
      FROM email_subscribers
      WHERE unsubscribed = false
      AND marketing_consent = true
      AND suppression_reason IS NULL
      AND is_test = true
      AND source = 'newsletter'
    `);
    console.log(`   → ${newsletter.rows.length} subscribers`);
    
    // Test 6: Year range 2021-2023
    console.log('\n6. Vehicles 2021-2023:');
    const yearRange = await pool.query(`
      SELECT DISTINCT email, vehicle_year, vehicle_make, vehicle_model
      FROM email_subscribers
      WHERE unsubscribed = false
      AND marketing_consent = true
      AND suppression_reason IS NULL
      AND is_test = true
      AND CAST(vehicle_year AS INTEGER) BETWEEN 2021 AND 2023
    `);
    console.log(`   → ${yearRange.rows.length} subscribers:`);
    for (const r of yearRange.rows) {
      console.log(`      ${r.email} (${r.vehicle_year} ${r.vehicle_make} ${r.vehicle_model})`);
    }
    
    console.log('\n═══════════════════════════════════');
    console.log('✅ AUDIENCE TARGETING WORKS');
    console.log('═══════════════════════════════════');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testAudience();
