import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  // Check for tire/inventory related tables
  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log('All tables:');
  const tireRelated = tables.rows.filter(r => 
    r.table_name.includes('tire') || 
    r.table_name.includes('inventory') ||
    r.table_name.includes('usaf') ||
    r.table_name.includes('map')
  );
  
  tireRelated.forEach(r => console.log(' -', r.table_name));
  
  // Check tire_map_cache if it exists
  try {
    const mapCache = await pool.query(`
      SELECT COUNT(*) as cnt, COUNT(DISTINCT part_number) as parts
      FROM tire_map_cache
    `);
    console.log('\ntire_map_cache:', mapCache.rows[0]);
  } catch (e) {
    console.log('\ntire_map_cache: does not exist');
  }
  
  await pool.end();
}

main();
