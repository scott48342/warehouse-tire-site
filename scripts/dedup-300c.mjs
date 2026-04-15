import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const db = drizzle(pool);

// Find duplicate 300C records and keep the one with the better modification_id
console.log('=== Finding duplicate 300C records ===\n');

for (let year = 2011; year <= 2026; year++) {
  const dupes = await db.execute(sql`
    SELECT id, modification_id, raw_trim, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE make ILIKE 'chrysler' 
      AND model = '300' 
      AND raw_trim = '300C'
      AND year = ${year}
    ORDER BY modification_id
  `);
  
  if (dupes.rows.length > 1) {
    console.log(`${year}: ${dupes.rows.length} duplicates`);
    
    // Keep first, delete rest one by one
    for (let i = 1; i < dupes.rows.length; i++) {
      const row = dupes.rows[i];
      console.log(`  Deleting: ${row.modification_id}`);
      await db.execute(sql`
        DELETE FROM vehicle_fitments WHERE id = ${row.id}
      `);
    }
    console.log(`  → Kept: ${dupes.rows[0].modification_id}\n`);
  }
}

// Verify
console.log('=== Verifying model structure ===');
const models = await db.execute(sql`
  SELECT DISTINCT model, COUNT(*) as cnt
  FROM vehicle_fitments 
  WHERE make ILIKE 'chrysler' AND model ILIKE '%300%'
  GROUP BY model
`);
for (const row of models.rows) {
  console.log(`  "${row.model}": ${row.cnt} records`);
}

await pool.end();
console.log('\n✅ Done!');
