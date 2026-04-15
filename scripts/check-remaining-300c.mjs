import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const db = drizzle(pool);

const rows = await db.execute(sql`
  SELECT year, model, raw_trim, modification_id
  FROM vehicle_fitments 
  WHERE make ILIKE 'chrysler' AND model = '300c'
  ORDER BY year, raw_trim
`);

console.log('Remaining 300c records:');
for (const row of rows.rows) {
  console.log(`  ${row.year} | ${row.raw_trim || '(base)'} | ${row.modification_id}`);
}

await pool.end();
