import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Check light bars
const bars = await pool.query(`SELECT sku, title, image_url FROM accessories WHERE sku LIKE 'BAR-1ROW%' LIMIT 3`);
console.log('Light bars:');
bars.rows.forEach(r => console.log(r.sku, '-', r.image_url ? r.image_url.slice(0,70) : 'NULL'));

// Check center caps with images
const caps = await pool.query(`SELECT sku, title, image_url FROM accessories WHERE category = 'center_cap' AND image_url IS NOT NULL LIMIT 5`);
console.log('\nCenter caps WITH images:');
caps.rows.forEach(r => console.log(r.sku, '-', r.image_url ? r.image_url.slice(0,70) : 'NULL'));

// Total center caps with images
const capCount = await pool.query(`SELECT COUNT(*) FROM accessories WHERE category = 'center_cap' AND image_url IS NOT NULL`);
console.log('\nTotal center caps with images:', capCount.rows[0].count);

// Check if production has same data - test one URL
console.log('\nTest image URL accessibility:');
const testUrl = bars.rows[0]?.image_url;
if (testUrl) {
  try {
    const resp = await fetch(testUrl, { method: 'HEAD' });
    console.log('Image URL status:', resp.status, resp.ok ? 'OK' : 'FAIL');
  } catch (e) {
    console.log('Image URL error:', e.message);
  }
}

await pool.end();
