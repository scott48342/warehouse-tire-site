import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const db = drizzle(pool);

// List ALL Chrysler 300 mods for 2015
const rows = await db.execute(sql`
  SELECT modification_id, year, make, model, raw_trim, display_trim, oem_tire_sizes, oem_wheel_sizes
  FROM vehicle_fitments 
  WHERE make ILIKE 'chrysler' AND model ILIKE '%300%' AND year = 2015
  ORDER BY modification_id
`);

console.log(`Found ${rows.rows.length} records for 2015 Chrysler 300:\n`);

for (const row of rows.rows) {
  console.log(`${row.modification_id}`);
  console.log(`  raw_trim: ${row.raw_trim || '(null)'}`);
  console.log(`  display_trim: ${row.display_trim || '(null)'}`);
  console.log(`  tires: ${row.oem_tire_sizes}`);
  console.log('');
}

await pool.end();
