import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const make = process.argv[2] || 'Mazda';

const result = await pool.query(
  `SELECT DISTINCT model, COUNT(*) as count FROM vehicle_fitments WHERE make ILIKE $1 GROUP BY model ORDER BY model`,
  [make]
);

console.log(`Models for ${make}:`);
result.rows.forEach(row => console.log(`  ${row.model} (${row.count} records)`));

// Also check a specific vehicle
const check = await pool.query(
  `SELECT year, make, model, oem_tire_sizes FROM vehicle_fitments 
   WHERE make ILIKE $1 AND model ILIKE '%6%' LIMIT 5`,
  [make]
);
console.log('\nSample Mazda6-like records:');
check.rows.forEach(row => console.log(`  ${row.year} ${row.make} ${row.model}: ${JSON.stringify(row.oem_tire_sizes)}`));

await pool.end();
