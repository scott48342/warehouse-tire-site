import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Check where our BAR-xROW products are categorized
const result = await pool.query(`
  SELECT category, sub_type, COUNT(*) as count, COUNT(*) FILTER (WHERE image_url IS NOT NULL) as with_images
  FROM accessories 
  WHERE sku LIKE 'BAR-%ROW%' OR sku LIKE 'BAF08%'
  GROUP BY category, sub_type
`);
console.log('BAR-xROW and BAF08x products:');
console.table(result.rows);

// Total light bars with images
const total = await pool.query(`
  SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE image_url IS NOT NULL) as with_images
  FROM accessories 
  WHERE sub_type = 'light_bar' OR title ILIKE '%banger bar%' OR title ILIKE '%bangerbar%'
`);
console.log('\nAll light bar products:');
console.table(total.rows);

await pool.end();
