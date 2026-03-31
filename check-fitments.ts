import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

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
    const rows = await db.execute(sql`SELECT tire_size, front_tire_size, rear_tire_size, is_staggered, is_lifted, bolt_pattern
      FROM vehicle_fitments WHERE year = ${v.year} AND make = ${v.make} AND model = ${v.model} LIMIT 1`);
    if (rows.rows[0]) {
      console.log(`${v.year} ${v.make} ${v.model}:`, JSON.stringify(rows.rows[0]));
    } else {
      console.log(`${v.year} ${v.make} ${v.model}: NOT FOUND`);
    }
  }
  process.exit(0);
}
check();
