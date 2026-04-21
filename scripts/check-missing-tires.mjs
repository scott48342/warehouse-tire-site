import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const result = await pool.query(`
  SELECT year, make, model, COUNT(*) as trims
  FROM vehicle_fitments 
  WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    AND year BETWEEN 2010 AND 2024
    AND make IN ('Ford', 'Chevrolet', 'Toyota', 'Honda', 'Dodge', 'Ram', 'GMC', 'Jeep')
  GROUP BY year, make, model
  ORDER BY trims DESC, year DESC
  LIMIT 20
`);

console.log('Vehicles with most trims missing tire sizes:');
result.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model}: ${r.trims} trims`));

console.log('\n--- By Make ---');
const byMake = await pool.query(`
  SELECT make, COUNT(DISTINCT(year || make || model)) as vehicles, COUNT(*) as total_trims
  FROM vehicle_fitments 
  WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    AND year BETWEEN 2000 AND 2024
  GROUP BY make
  ORDER BY total_trims DESC
  LIMIT 15
`);
byMake.rows.forEach(r => console.log(`  ${r.make}: ${r.vehicles} vehicles (${r.total_trims} trims)`));

pool.end();
