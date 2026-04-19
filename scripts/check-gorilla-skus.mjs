/**
 * Check Gorilla SKU patterns in our DB
 */
import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

async function main() {
  // Get sample Gorilla SKUs without images
  const result = await pool.query(`
    SELECT sku, title, sub_type FROM accessories 
    WHERE brand = 'Gorilla Automotive' AND image_url IS NULL 
    ORDER BY sku LIMIT 30
  `);
  
  console.log('=== Gorilla SKUs without images ===\n');
  for (const row of result.rows) {
    console.log(`${row.sku}: ${row.title}`);
  }
  
  // Get Gorilla SKUs WITH images to compare
  console.log('\n\n=== Gorilla SKUs WITH images ===\n');
  const withImages = await pool.query(`
    SELECT sku, title, image_url FROM accessories 
    WHERE brand = 'Gorilla Automotive' AND image_url IS NOT NULL 
    ORDER BY sku LIMIT 10
  `);
  
  for (const row of withImages.rows) {
    console.log(`${row.sku}: ${row.title}`);
    console.log(`  -> ${row.image_url}\n`);
  }
  
  await pool.end();
}

main().catch(console.error);
