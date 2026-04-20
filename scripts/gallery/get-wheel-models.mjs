import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function run() {
  // Get distinct brands
  const brands = await pool.query(`
    SELECT DISTINCT brand_desc, COUNT(*) as count
    FROM wp_wheels
    GROUP BY brand_desc
    ORDER BY count DESC
    LIMIT 20
  `);
  console.log('Brands in inventory:');
  brands.rows.forEach(r => console.log(`  ${r.brand_desc}: ${r.count} SKUs`));
  
  // Get models for target brands using ILIKE
  const targetBrands = ['KMC', 'XD', 'Moto Metal', 'Black Rhino', 'Asanti'];
  
  for (const brand of targetBrands) {
    console.log(`\n=== ${brand} Models ===`);
    
    const res = await pool.query(`
      SELECT DISTINCT style, COUNT(*) as count
      FROM wp_wheels
      WHERE brand_desc ILIKE $1
      GROUP BY style
      ORDER BY style
      LIMIT 50
    `, [`%${brand}%`]);
    
    if (res.rows.length === 0) {
      console.log('  (no models found)');
    } else {
      console.log(`  Found ${res.rows.length} models:`);
      res.rows.forEach(r => console.log(`    ${r.style} (${r.count})`));
    }
  }
  
  await pool.end();
}

run().catch(console.error);
