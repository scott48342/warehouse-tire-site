import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function run() {
  const res = await pool.query(`
    SELECT wheel_brand, COUNT(*) as count 
    FROM gallery_assets 
    GROUP BY wheel_brand 
    ORDER BY count DESC
  `);
  console.log('Current gallery assets by brand:');
  res.rows.forEach(r => console.log(`  ${r.wheel_brand}: ${r.count}`));
  
  const total = await pool.query('SELECT COUNT(*) FROM gallery_assets');
  console.log(`\nTotal assets: ${total.rows[0].count}`);
  
  // Check vehicle types
  const types = await pool.query(`
    SELECT vehicle_type, COUNT(*) as count 
    FROM gallery_assets 
    WHERE vehicle_type IS NOT NULL
    GROUP BY vehicle_type 
    ORDER BY count DESC
  `);
  console.log('\nBy vehicle type:');
  types.rows.forEach(r => console.log(`  ${r.vehicle_type}: ${r.count}`));
  
  await pool.end();
}

run().catch(console.error);
