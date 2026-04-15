import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const db = drizzle(pool);

// For 2011+ (2nd gen 300), merge model="300c" into model="300"
// The "300c" model records have trims like AWD, RWD, Platinum, etc.
// These should become "300C AWD", "300C RWD", etc. under model="300"

console.log('=== Checking 300c records for 2011+ ===\n');
const records = await db.execute(sql`
  SELECT year, model, raw_trim, display_trim, modification_id
  FROM vehicle_fitments 
  WHERE make ILIKE 'chrysler' 
    AND model = '300c'
    AND year >= 2011
  ORDER BY year DESC, raw_trim
`);

console.log(`Found ${records.rows.length} records to merge:\n`);
for (const row of records.rows) {
  const newTrim = row.raw_trim ? `300C ${row.raw_trim}` : '300C';
  console.log(`${row.year} 300c ${row.raw_trim || '(base)'} → 300 "${newTrim}"`);
}

// Perform the merge - update model to "300" and prepend "300C" to trim
console.log('\n=== Merging... ===\n');
const result = await db.execute(sql`
  UPDATE vehicle_fitments 
  SET 
    model = '300',
    raw_trim = CASE 
      WHEN raw_trim IS NULL OR raw_trim = '' THEN '300C'
      ELSE '300C ' || raw_trim
    END,
    display_trim = CASE 
      WHEN display_trim IS NULL OR display_trim = '' THEN '300C'
      ELSE '300C ' || display_trim
    END
  WHERE make ILIKE 'chrysler' 
    AND model = '300c'
    AND year >= 2011
  RETURNING year, raw_trim, modification_id
`);

console.log(`Merged ${result.rows.length} records`);

// Now delete duplicate "300C" trim records that overlap
// (e.g., model="300" trim="300C" vs merged model="300" trim="300C")
console.log('\n=== Checking for duplicates to clean up ===');
const dupes = await db.execute(sql`
  SELECT year, raw_trim, COUNT(*) as cnt
  FROM vehicle_fitments 
  WHERE make ILIKE 'chrysler' AND model = '300' AND year >= 2011
  GROUP BY year, raw_trim
  HAVING COUNT(*) > 1
  ORDER BY year DESC
`);

if (dupes.rows.length > 0) {
  console.log('Duplicates found:');
  for (const row of dupes.rows) {
    console.log(`  ${row.year} "${row.raw_trim}": ${row.cnt} copies`);
  }
} else {
  console.log('No duplicates found');
}

await pool.end();
console.log('\n✅ Done!');
