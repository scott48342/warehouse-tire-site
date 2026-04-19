/**
 * Check remaining products without images for target brands
 */
import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

async function main() {
  const targetBrands = [
    'Morimoto Offroad', 'Morimoto', 'Morimoto - Non XB',
    'Gorilla Automotive', 'GTR Lighting', 
    'Teraflex', 'Teraflex Axles & Shafts',
    'Fox Shocks', 'Bilstein'
  ];
  
  console.log('=== Products Still Missing Images ===\n');
  
  for (const brand of targetBrands) {
    const result = await pool.query(`
      SELECT sku, title FROM accessories 
      WHERE brand = $1 AND image_url IS NULL
      ORDER BY sku
    `, [brand]);
    
    if (result.rows.length > 0) {
      console.log(`${brand} (${result.rows.length} remaining):`);
      result.rows.slice(0, 10).forEach(r => console.log(`  ${r.sku}: ${r.title}`));
      if (result.rows.length > 10) console.log(`  ... and ${result.rows.length - 10} more`);
      console.log('');
    }
  }
  
  await pool.end();
}

main().catch(console.error);
