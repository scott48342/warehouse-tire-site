import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const { rows } = await pool.query(`
  SELECT source_url, cdn_url, thumbnail_url 
  FROM gallery_assets 
  WHERE wheel_brand = 'Fuel' 
  LIMIT 3
`);

console.log('Fuel URL samples:');
rows.forEach(row => {
  console.log('  source:', row.source_url?.slice(0,80) || 'NULL');
  console.log('  cdn:', row.cdn_url?.slice(0,80) || 'NULL');
  console.log('  thumb:', row.thumbnail_url?.slice(0,80) || 'NULL');
  console.log('');
});

await pool.end();
