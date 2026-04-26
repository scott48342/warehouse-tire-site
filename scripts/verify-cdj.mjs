import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// Check remaining missing for Chrysler, Dodge, Jeep
const missing = await pool.query(`
  SELECT COUNT(*) as count, make
  FROM vehicle_fitments
  WHERE make IN ('Chrysler', 'Dodge', 'Jeep')
    AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
  GROUP BY make
`);

console.log('=== REMAINING MISSING ===');
if (missing.rows.length === 0) {
  console.log('✅ ALL Chrysler, Dodge, Jeep records now have fitment data!');
} else {
  missing.rows.forEach(r => console.log(`${r.make}: ${r.count} missing`));
}

// Count total fixed
const fixed = await pool.query(`
  SELECT make, COUNT(*) as count
  FROM vehicle_fitments
  WHERE make IN ('Chrysler', 'Dodge', 'Jeep')
    AND oem_tire_sizes IS NOT NULL 
    AND oem_tire_sizes::text != '[]'
  GROUP BY make
  ORDER BY make
`);

console.log('\n=== TOTAL WITH FITMENT DATA ===');
fixed.rows.forEach(r => console.log(`${r.make}: ${r.count} records`));

// Sample some Viper data to verify staggered setup
const viperSample = await pool.query(`
  SELECT year, model, oem_wheel_sizes, oem_tire_sizes
  FROM vehicle_fitments
  WHERE make = 'Dodge' AND model ILIKE 'viper'
  ORDER BY year
  LIMIT 3
`);

console.log('\n=== VIPER SAMPLE (STAGGERED) ===');
viperSample.rows.forEach(r => {
  console.log(`${r.year} Viper:`);
  console.log(`  Wheels: ${r.oem_wheel_sizes}`);
  console.log(`  Tires: ${r.oem_tire_sizes}`);
});

// Sample Crossfire to verify staggered
const crossfireSample = await pool.query(`
  SELECT year, model, oem_wheel_sizes, oem_tire_sizes
  FROM vehicle_fitments
  WHERE make = 'Chrysler' AND model ILIKE 'crossfire'
  LIMIT 1
`);

console.log('\n=== CROSSFIRE SAMPLE (STAGGERED) ===');
crossfireSample.rows.forEach(r => {
  console.log(`${r.year} Crossfire:`);
  console.log(`  Wheels: ${r.oem_wheel_sizes}`);
  console.log(`  Tires: ${r.oem_tire_sizes}`);
});

await pool.end();
