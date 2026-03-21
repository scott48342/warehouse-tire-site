/**
 * Test 2009 Jeep Wrangler Rubicon fitment import
 * Direct database test (bypasses HTTP server)
 */

import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const WHEELSIZE_API_KEY = process.env.WHEELSIZE_API_KEY;

async function fetchWheelSizeApi(year, make, model) {
  if (!WHEELSIZE_API_KEY) {
    throw new Error('WHEELSIZE_API_KEY not set');
  }
  
  const url = `https://api.wheel-size.com/v2/search/by_model/?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}&user_key=${WHEELSIZE_API_KEY}`;
  
  console.log('Fetching from Wheel-Size API...');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function test() {
  console.log('='.repeat(60));
  console.log('Testing 2009 Jeep Wrangler fitment import');
  console.log('='.repeat(60));
  
  const client = await pool.connect();
  
  try {
    // Step 1: Check if already in DB
    console.log('\n1. Checking database for existing records...');
    const existing = await client.query(`
      SELECT id, modification_id, display_trim, bolt_pattern, offset_min_mm, offset_max_mm
      FROM vehicle_fitments 
      WHERE year = 2009 AND make = 'jeep' AND model = 'wrangler'
      LIMIT 5
    `);
    
    if (existing.rows.length > 0) {
      console.log('✅ DB HIT! Found', existing.rows.length, 'records:');
      existing.rows.forEach(r => {
        console.log(`   - ${r.display_trim}: ${r.bolt_pattern}, offset ${r.offset_min_mm}-${r.offset_max_mm}mm`);
      });
      return;
    }
    
    console.log('   No records found (will import from API)');
    
    // Step 2: Test INSERT with decimal offset (the actual fix)
    console.log('\n4. Testing INSERT with decimal offset (44.45)...');
    
    const testInsert = await client.query(`
      INSERT INTO vehicle_fitments (
        year, make, model, modification_id, display_trim,
        bolt_pattern, center_bore_mm, offset_min_mm, offset_max_mm,
        oem_wheel_sizes, oem_tire_sizes, source
      ) VALUES (
        2009, 'jeep', 'wrangler', 'test_decimal_offset', 'Test Rubicon',
        '5x127', '71.5', '44.45', '54.45',
        '[]', '[]', 'test'
      )
      RETURNING id, offset_min_mm, offset_max_mm
    `);
    
    console.log('✅ INSERT SUCCESS!');
    console.log('   Inserted:', testInsert.rows[0]);
    
    // Clean up test record
    await client.query(`DELETE FROM vehicle_fitments WHERE modification_id = 'test_decimal_offset'`);
    console.log('   (test record cleaned up)');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ DECIMAL OFFSET FIX VERIFIED');
    console.log('='.repeat(60));
    
  } finally {
    client.release();
    pool.end();
  }
}

test().catch(e => {
  console.error('\n❌ ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});
