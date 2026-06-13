/**
 * Check Mercedes makes and test specific failing cases
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

// Check what makes exist for Mercedes vehicles
const makes = await db.execute(sql`
  SELECT DISTINCT make 
  FROM vehicle_fitments 
  WHERE certification_status = 'certified'
    AND (make ILIKE '%Mercedes%' OR make ILIKE '%Benz%')
  ORDER BY make
`);

console.log('Mercedes makes in DB:');
makes.rows.forEach(r => console.log('  -', r.make));

// Check specific failing case - 1987 e-class
const test1987 = await db.execute(sql`
  SELECT year, make, model, display_trim
  FROM vehicle_fitments 
  WHERE certification_status = 'certified'
    AND year = 1987
    AND (model ILIKE '%e-class%' OR model ILIKE '%e class%')
  LIMIT 5
`);

console.log('\n1987 E-Class matches:');
if (test1987.rows.length === 0) {
  console.log('  (none found)');
} else {
  test1987.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model} - ${r.display_trim}`));
}

// Check what Mercedes models exist for 1987
const models1987 = await db.execute(sql`
  SELECT DISTINCT model 
  FROM vehicle_fitments 
  WHERE certification_status = 'certified'
    AND year = 1987
    AND (make ILIKE '%Mercedes%' OR make ILIKE '%Benz%')
  ORDER BY model
`);

console.log('\nAll Mercedes models for 1987:');
if (models1987.rows.length === 0) {
  console.log('  (none found)');
} else {
  models1987.rows.forEach(r => console.log(`  - ${r.model}`));
}

// Check 1991 s-class
const test1991 = await db.execute(sql`
  SELECT year, make, model, display_trim
  FROM vehicle_fitments 
  WHERE certification_status = 'certified'
    AND year = 1991
    AND model ILIKE '%s-class%'
  LIMIT 5
`);

console.log('\n1991 S-Class matches:');
if (test1991.rows.length === 0) {
  console.log('  (none found)');
} else {
  test1991.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model} - ${r.display_trim}`));
}

await pool.end();
