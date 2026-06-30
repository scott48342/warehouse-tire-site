import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Spot-check: fitment queries that would actually run in production
const queries = [
  { label: '20" 5x127 (GM truck)', q: `SELECT sku, brand, wheel_width, pcd1, pcd2, offset_mm, finish, msrp, has_map FROM wheel1_products WHERE diameter=20 AND (pcd1='5x127' OR pcd2='5x127') AND is_discontinued=FALSE ORDER BY msrp LIMIT 5` },
  { label: '18" 5x114.3 (import cars)', q: `SELECT sku, brand, wheel_width, pcd1, pcd2, offset_mm, finish, msrp FROM wheel1_products WHERE diameter=18 AND (pcd1='5x114.3' OR pcd2='5x114.3') AND is_discontinued=FALSE ORDER BY msrp LIMIT 5` },
  { label: '20" 6x135 (Ford F-150)', q: `SELECT sku, brand, wheel_width, pcd1, pcd2, offset_mm, finish, msrp FROM wheel1_products WHERE diameter=20 AND (pcd1='6x135' OR pcd2='6x135') AND is_discontinued=FALSE ORDER BY msrp LIMIT 5` },
  { label: '22" 8x165.1 (HD truck)', q: `SELECT sku, brand, wheel_width, pcd1, pcd2, offset_mm, finish, msrp FROM wheel1_products WHERE diameter=22 AND (pcd1='8x165.1' OR pcd2='8x165.1') AND is_discontinued=FALSE ORDER BY msrp LIMIT 5` },
  { label: 'MAP items sample', q: `SELECT sku, brand, finish, msrp, map_price FROM wheel1_products WHERE has_map=TRUE ORDER BY RANDOM() LIMIT 3` },
  { label: 'Dual bolt pattern (pcd2) sample', q: `SELECT sku, brand, pcd1, pcd2, diameter, offset_mm FROM wheel1_products WHERE pcd2 IS NOT NULL LIMIT 5` },
  { label: 'Schema verify', q: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='wheel1_products' ORDER BY ordinal_position` },
];

for (const { label, q } of queries) {
  try {
    const r = await pool.query(q);
    console.log(`\n=== ${label} (${r.rows.length} rows) ===`);
    r.rows.forEach(row => console.log(' ', JSON.stringify(row)));
  } catch(e) {
    console.log(`\n=== ${label} ERROR: ${e.message} ===`);
  }
}

await pool.end();
