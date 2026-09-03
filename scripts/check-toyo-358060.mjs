import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  // Check tireweb_sku_cache for both part numbers
  const cacheResult = await pool.query(`
    SELECT part_number, brand, model, size, source, cost, last_seen_at
    FROM tireweb_sku_cache 
    WHERE part_number IN ('358060', '355530')
  `);
  
  console.log('=== tireweb_sku_cache ===');
  console.log(cacheResult.rows);
  
  // Also search for any Toyo RT Pro
  const rtProResult = await pool.query(`
    SELECT part_number, brand, model, size, source, cost, last_seen_at
    FROM tireweb_sku_cache 
    WHERE model ILIKE '%RT%Pro%' OR model ILIKE '%Open%Country%R/T%'
    LIMIT 10
  `);
  
  console.log('\n=== Toyo RT Pro patterns ===');
  console.log(rtProResult.rows);
  
  await pool.end();
}

check().catch(console.error);
