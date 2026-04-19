/**
 * Check accessory image status by brand
 */
import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

async function main() {
  // Get counts by brand
  const counts = await pool.query(`
    SELECT brand, 
           COUNT(*) FILTER (WHERE image_url IS NULL) as needs_image,
           COUNT(*) FILTER (WHERE image_url IS NOT NULL) as has_image,
           COUNT(*) as total
    FROM accessories
    WHERE brand IN ('Morimoto Offroad', 'Gorilla Automotive', 'GTR Lighting', 'Teraflex', 'Fox Shocks', 'Bilstein')
    GROUP BY brand
    ORDER BY needs_image DESC
  `);
  
  console.log('=== Accessory Image Status by Brand ===\n');
  for (const row of counts.rows) {
    console.log(`${row.brand}:`);
    console.log(`  Needs image: ${row.needs_image}`);
    console.log(`  Has image: ${row.has_image}`);
    console.log(`  Total: ${row.total}\n`);
  }
  
  // Sample SKUs from Morimoto that need images
  console.log('\n=== Sample Morimoto SKUs (no images) ===\n');
  const morimoto = await pool.query(`
    SELECT sku, title, sub_type FROM accessories 
    WHERE brand = 'Morimoto Offroad' AND image_url IS NULL 
    ORDER BY title LIMIT 20
  `);
  for (const row of morimoto.rows) {
    console.log(`${row.sku}: ${row.title} [${row.sub_type || 'no type'}]`);
  }
  
  // Get sub_types breakdown for Morimoto
  console.log('\n=== Morimoto Sub-Types (no images) ===\n');
  const subtypes = await pool.query(`
    SELECT sub_type, COUNT(*) as cnt FROM accessories 
    WHERE brand = 'Morimoto Offroad' AND image_url IS NULL 
    GROUP BY sub_type ORDER BY cnt DESC
  `);
  for (const row of subtypes.rows) {
    console.log(`${row.sub_type || 'NULL'}: ${row.cnt}`);
  }
  
  await pool.end();
}

main().catch(console.error);
