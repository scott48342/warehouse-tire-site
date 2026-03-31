import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const vehicles = [
  {year: 2010, make: 'ford', model: 'mustang'},
  {year: 2021, make: 'ford', model: 'mustang'},
  {year: 2014, make: 'gmc', model: 'yukon-xl'},
  {year: 2020, make: 'mercedes-benz', model: 'amg-gt'},
  {year: 2024, make: 'chevrolet', model: 'silverado-3500-hd'},
  {year: 2022, make: 'toyota', model: 'sienna'},
  {year: 2005, make: 'chrysler', model: '300c'},
  {year: 2013, make: 'dodge', model: 'avenger'},
  {year: 1999, make: 'nissan', model: 'maxima'},
  {year: 2026, make: 'rivian', model: 'r1s'}
];

async function check() {
  for (const v of vehicles) {
    const result = await pool.query(
      `SELECT modification_id, display_trim, bolt_pattern, oem_tire_sizes, oem_wheel_sizes
       FROM vehicle_fitments WHERE year = $1 AND make = $2 AND model = $3 LIMIT 3`,
      [v.year, v.make, v.model]
    );
    if (result.rows.length > 0) {
      console.log(`\n${v.year} ${v.make} ${v.model}: ${result.rows.length} trims found`);
      for (const row of result.rows) {
        console.log(`  ${row.display_trim}: bolt=${row.bolt_pattern}, tires=${JSON.stringify(row.oem_tire_sizes)}, wheels=${JSON.stringify(row.oem_wheel_sizes)}`);
      }
    } else {
      console.log(`\n${v.year} ${v.make} ${v.model}: NOT FOUND`);
    }
  }
  await pool.end();
}
check();
