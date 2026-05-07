import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check Challenger trims
const { rows } = await pool.query(`
  SELECT display_trim, modification_id, oem_wheel_sizes, oem_tire_sizes
  FROM vehicle_fitments 
  WHERE year = 2023 AND make = 'Dodge' AND model = 'Challenger'
  ORDER BY display_trim
`);

console.log('2023 Dodge Challenger trims:');
for (const row of rows) {
  console.log(`\n${row.display_trim}:`);
  console.log(`  mod_id: ${row.modification_id}`);
  console.log(`  wheels: ${JSON.stringify(row.oem_wheel_sizes)}`);
  console.log(`  tires: ${JSON.stringify(row.oem_tire_sizes)}`);
}

await pool.end();
