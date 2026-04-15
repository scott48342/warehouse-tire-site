import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const db = drizzle(pool);

// Find records where model is "300" but trim contains "300c"
console.log('=== Records with model="300" and trim containing "300c" ===\n');
const confused = await db.execute(sql`
  SELECT year, model, raw_trim, display_trim, modification_id
  FROM vehicle_fitments 
  WHERE make ILIKE 'chrysler' 
    AND model = '300' 
    AND (raw_trim ILIKE '%300c%' OR display_trim ILIKE '%300c%')
  ORDER BY year DESC
  LIMIT 30
`);

console.log(`Found ${confused.rows.length} records:\n`);
for (const row of confused.rows) {
  console.log(`${row.year} | model="${row.model}" | raw_trim="${row.raw_trim}" | display="${row.display_trim}"`);
  console.log(`  → ${row.modification_id}\n`);
}

// Also check what models exist
console.log('\n=== Distinct models for Chrysler 300 ===');
const models = await db.execute(sql`
  SELECT DISTINCT model, COUNT(*) as cnt
  FROM vehicle_fitments 
  WHERE make ILIKE 'chrysler' AND model ILIKE '%300%'
  GROUP BY model
  ORDER BY model
`);
for (const row of models.rows) {
  console.log(`  "${row.model}": ${row.cnt} records`);
}

await pool.end();
