import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const { rows } = await pool.query(`
  SELECT id, source_url, thumbnail_url, wheel_model, vehicle_make, vehicle_model
  FROM gallery_assets 
  WHERE wheel_brand = 'Fuel' 
    AND source_url IS NOT NULL
  LIMIT 3
`);

console.log('Fuel full URLs:');
rows.forEach(row => {
  console.log(`[${row.id}] ${row.wheel_model} on ${row.vehicle_make} ${row.vehicle_model}`);
  console.log('  source:', row.source_url);
  console.log('  thumb:', row.thumbnail_url);
  console.log('');
});

await pool.end();
