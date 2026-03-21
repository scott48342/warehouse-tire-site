import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Running migration: 0002_offset_decimal.sql');
    
    // Check current column types first
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vehicle_fitments' 
      AND column_name IN ('offset_min_mm', 'offset_max_mm')
    `);
    console.log('Current types:', res.rows);
    
    // Run migration for vehicle_fitments
    await client.query(`
      ALTER TABLE vehicle_fitments 
        ALTER COLUMN offset_min_mm TYPE decimal(5,2) USING offset_min_mm::decimal(5,2)
    `);
    await client.query(`
      ALTER TABLE vehicle_fitments 
        ALTER COLUMN offset_max_mm TYPE decimal(5,2) USING offset_max_mm::decimal(5,2)
    `);
    
    // Run migration for fitment_overrides (if table exists)
    try {
      await client.query(`
        ALTER TABLE fitment_overrides 
          ALTER COLUMN offset_min_mm TYPE decimal(5,2) USING offset_min_mm::decimal(5,2)
      `);
      await client.query(`
        ALTER TABLE fitment_overrides 
          ALTER COLUMN offset_max_mm TYPE decimal(5,2) USING offset_max_mm::decimal(5,2)
      `);
      console.log('fitment_overrides table updated');
    } catch (e) {
      console.log('fitment_overrides table not found or already migrated');
    }
    
    // Verify
    const verify = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vehicle_fitments' 
      AND column_name IN ('offset_min_mm', 'offset_max_mm')
    `);
    console.log('After migration:', verify.rows);
    console.log('Migration successful!');
  } finally {
    client.release();
    pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
