import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const { Pool } = pg;
const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

const result = await pool.query(`
  SELECT DISTINCT wheel_model, COUNT(*) as count 
  FROM gallery_assets 
  WHERE wheel_brand = 'KMC' 
  GROUP BY wheel_model 
  ORDER BY count DESC 
  LIMIT 25
`);

console.log('KMC wheel models in DB:');
result.rows.forEach(row => console.log(`  ${row.wheel_model}: ${row.count}`));

// Also check a sample of album names vs parsed wheel models
const sample = await pool.query(`
  SELECT DISTINCT source_album_name, wheel_model 
  FROM gallery_assets 
  WHERE wheel_brand = 'KMC' 
  LIMIT 15
`);

console.log('\nSample album → wheel model mappings:');
sample.rows.forEach(row => console.log(`  "${row.source_album_name}" → ${row.wheel_model}`));

await pool.end();
