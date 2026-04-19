/**
 * Get sample Morimoto products from our DB
 */
import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

async function main() {
  // Get distinct product types by parsing titles
  console.log('=== Morimoto SKU Patterns (no images) ===\n');
  
  const result = await pool.query(`
    SELECT sku, title, sub_type FROM accessories 
    WHERE brand = 'Morimoto Offroad' AND image_url IS NULL 
    ORDER BY sku LIMIT 100
  `);
  
  // Group by SKU prefix
  const byPrefix = {};
  for (const row of result.rows) {
    const prefix = row.sku.replace(/\d+$/, '');
    if (!byPrefix[prefix]) byPrefix[prefix] = [];
    byPrefix[prefix].push(row);
  }
  
  for (const [prefix, items] of Object.entries(byPrefix)) {
    console.log(`\n${prefix} (${items.length} items):`);
    items.slice(0, 3).forEach(r => console.log(`  ${r.sku}: ${r.title}`));
  }
  
  // Get products that already HAVE images to see the pattern
  console.log('\n\n=== Morimoto Products WITH Images ===\n');
  const withImages = await pool.query(`
    SELECT sku, title, image_url FROM accessories 
    WHERE brand = 'Morimoto Offroad' AND image_url IS NOT NULL 
    ORDER BY sku LIMIT 20
  `);
  
  for (const row of withImages.rows) {
    console.log(`${row.sku}: ${row.title}`);
    console.log(`  -> ${row.image_url}\n`);
  }
  
  await pool.end();
}

main().catch(console.error);
