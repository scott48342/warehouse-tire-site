import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

// Load .env.local
const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();

const pool = new Pool({ connectionString: pgUrl });

const result = await pool.query(`
  SELECT sku, title, brand, image_url 
  FROM accessories 
  WHERE sub_type = 'light_bar' OR title ILIKE '%light bar%' OR title ILIKE '%bangerbar%' OR title ILIKE '%banger bar%'
  ORDER BY title
`);

console.log('Total light bars:', result.rows.length);
console.log('With images:', result.rows.filter(x => x.image_url).length);
console.log('Without images:', result.rows.filter(x => !x.image_url).length);
console.log('\nProducts without images:');
result.rows.filter(x => !x.image_url).forEach(x => console.log(`${x.sku} | ${x.brand} | ${x.title}`));

await pool.end();
