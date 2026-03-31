import pg from 'pg';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const dbMatch = envContent.match(/DATABASE_URL=(.+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

try {
  // Check for non-empty tire sizes
  const r = await pool.query(`
    SELECT year, make, model, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE oem_tire_sizes::text != '{}' 
    LIMIT 5
  `);
  console.log('Non-empty oem_tire_sizes:', r.rows.length);
  for (const row of r.rows) {
    console.log(`${row.year} ${row.make} ${row.model}:`, JSON.stringify(row.oem_tire_sizes));
  }

  // Check column type
  const typeCheck = await pool.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments' AND column_name = 'oem_tire_sizes'
  `);
  console.log('\nColumn type:', typeCheck.rows[0]);

} finally {
  await pool.end();
}
