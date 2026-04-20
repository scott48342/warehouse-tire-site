import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL
});

// Check wp_wheels columns
const { rows: wpCols } = await pool.query(`
  SELECT column_name FROM information_schema.columns WHERE table_name = 'wp_wheels'
`);
console.log('wp_wheels columns:', wpCols.map(r => r.column_name).join(', '));

// Check gallery_assets columns
const { rows: gaCols } = await pool.query(`
  SELECT column_name FROM information_schema.columns WHERE table_name = 'gallery_assets'
`);
console.log('\ngallery_assets columns:', gaCols.map(r => r.column_name).join(', '));

await pool.end();
