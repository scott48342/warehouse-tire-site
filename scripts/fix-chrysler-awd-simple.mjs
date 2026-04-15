import pg from 'pg';
import * as dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

// Load .env.local using dotenv
dotenv.config({ path: '.env.local' });
console.log('POSTGRES_URL starts with:', process.env.POSTGRES_URL?.substring(0, 50));

// Clear Redis cache for this vehicle
async function clearCache() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.log('No Redis credentials, skipping cache clear');
    return;
  }
  
  const redis = new Redis({ url, token });
  
  // Clear all fitment cache keys for this vehicle
  const keys = [
    'wt:fit:2015:chrysler:300:chrysler-300c-awd-35b75a9f',
    'wt:fit:2015:Chrysler:300:chrysler-300c-awd-35b75a9f',
  ];
  
  for (const key of keys) {
    await redis.del(key);
    console.log(`Cleared cache: ${key}`);
  }
}

const { Pool } = pg;
const connString = process.env.POSTGRES_URL;
// Prisma DB uses sslmode in the connection string, not a separate ssl option
const pool = new Pool({
  connectionString: connString,
});

async function fix() {
  console.log('Connecting to database...');
  
  // First, check what columns exist
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments' 
    ORDER BY ordinal_position
  `);
  console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));
  
  // First check all 2015 Chrysler 300 records
  const all300 = await pool.query(`
    SELECT id, modification_id, display_trim, make, model
    FROM vehicle_fitments 
    WHERE year = 2015 
      AND LOWER(make) = 'chrysler' 
      AND model = '300'
  `);
  console.log('All 2015 Chrysler 300 records:', all300.rows.length);
  for (const r of all300.rows) {
    console.log(`  ${r.id}: ${r.modification_id} (${r.display_trim}) - make=${r.make}, model=${r.model}`);
  }
  
  // Check for the specific modification ID from the URL
  const specificMod = await pool.query(`
    SELECT id, modification_id, display_trim, make, model, year, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE modification_id = 'chrysler-300c-awd-35b75a9f'
  `);
  console.log('Specific chrysler-300c-awd-35b75a9f:', specificMod.rows.length);
  if (specificMod.rows.length > 0) {
    const r = specificMod.rows[0];
    console.log('  Year/Make/Model:', r.year, r.make, r.model);
    console.log('  Current tire sizes:', JSON.stringify(r.oem_tire_sizes));
    console.log('  Current wheel sizes:', JSON.stringify(r.oem_wheel_sizes));
    
    // FIX IT - AWD only has 19" wheels
    const correctTireSizes = JSON.stringify(['235/55R19']);
    const correctWheelSizes = JSON.stringify([{
      diameter: 19,
      width: 7.5,
      offset: null,
      tireSize: '235/55R19',
      axle: 'both',
      isStock: true
    }]);
    
    console.log('\n  FIXING to:');
    console.log('    Tire sizes:', correctTireSizes);
    
    const update = await pool.query(`
      UPDATE vehicle_fitments 
      SET oem_tire_sizes = $1::jsonb, oem_wheel_sizes = $2::jsonb
      WHERE modification_id = 'chrysler-300c-awd-35b75a9f'
    `, [correctTireSizes, correctWheelSizes]);
    
    console.log(`  ✅ Updated ${update.rowCount} row(s)`);
    
    // Verify
    const verify = await pool.query(`
      SELECT oem_tire_sizes FROM vehicle_fitments 
      WHERE modification_id = 'chrysler-300c-awd-35b75a9f'
    `);
    console.log('  Verified:', JSON.stringify(verify.rows[0]?.oem_tire_sizes));
  }
  
  // Also check vehicle_fitment_configurations table
  const configs = await pool.query(`
    SELECT * FROM vehicle_fitment_configurations 
    WHERE year = 2015 AND make_key = 'chrysler' AND model_key = '300'
    LIMIT 5
  `);
  console.log('Configs for 2015 Chrysler 300:', configs.rows.length);
  
  // Now check for AWD specifically  
  const check = await pool.query(`
    SELECT id, modification_id, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE year = 2015 
      AND LOWER(make) = 'chrysler' 
      AND model = '300' 
      AND (modification_id LIKE '%awd%' OR LOWER(display_trim) LIKE '%awd%')
  `);
  
  console.log(`Found ${check.rows.length} AWD records:`);
  for (const row of check.rows) {
    console.log(`  ${row.id}: ${row.modification_id} (${row.display_trim}) → ${JSON.stringify(row.oem_tire_sizes)}`);
  }
  
  if (check.rows.length === 0) {
    console.log('No records to update!');
    process.exit(0);
  }
  
  // Update to correct AWD-only sizes
  const correctTireSizes = JSON.stringify(['235/55R19']);
  const correctWheelSizes = JSON.stringify([{
    diameter: 19,
    width: 7.5,
    offset: null,
    tireSize: '235/55R19',
    axle: 'both',
    isStock: true
  }]);
  
  console.log(`\nUpdating to: ${correctTireSizes}`);
  
  const result = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_tire_sizes = $1::jsonb, oem_wheel_sizes = $2::jsonb
    WHERE year = 2015 
      AND make_key = 'chrysler' 
      AND model_key = '300' 
      AND modification_id LIKE '%awd%'
  `, [correctTireSizes, correctWheelSizes]);
  
  console.log(`✅ Updated ${result.rowCount} rows`);
  
  // Verify
  const verify = await pool.query(`
    SELECT modification_id, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE year = 2015 
      AND make_key = 'chrysler' 
      AND model_key = '300' 
      AND modification_id LIKE '%awd%'
  `);
  
  console.log('\nVerification:');
  for (const row of verify.rows) {
    console.log(`  ${row.modification_id} → ${JSON.stringify(row.oem_tire_sizes)}`);
  }
  
  // Clear cache
  console.log('\nClearing cache...');
  await clearCache();
  
  await pool.end();
  console.log('\n✅ Done!');
  process.exit(0);
}

fix().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
