import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const result = await pool.query(`
  SELECT year, modification_id, display_trim, source
  FROM vehicle_fitments
  WHERE make = 'Dodge' AND model = 'Challenger'
    AND year IN (2022, 2023)
    AND display_trim ILIKE '%Scat Pack%'
  ORDER BY year DESC, display_trim
`);

console.log('Scat Pack modification_ids:');
for (const row of result.rows) {
  console.log(`  ${row.year} "${row.display_trim}"`);
  console.log(`    mod_id: "${row.modification_id}"`);
  console.log(`    source: ${row.source}`);
}

await pool.end();
