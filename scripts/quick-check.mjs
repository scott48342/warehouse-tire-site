import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const r = await pool.query(`SELECT year, make, model, display_trim, oem_tire_sizes FROM vehicle_fitments WHERE model ILIKE '%f-150 lightning%' OR model ILIKE '%f150 lightning%' ORDER BY year`);
console.log('F-150 Lightning tire sizes:');
for (const row of r.rows) {
  console.log(`${row.year} ${row.make} ${row.model} (${row.display_trim})`);
  console.log(`  Data: ${JSON.stringify(row.oem_tire_sizes)}`);
}
await pool.end();
