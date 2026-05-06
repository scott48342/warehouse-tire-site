import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Delete tier-a-import records for vehicles where we have better tiresize.com data
// For 2022-2023, the tier-a-import records are missing staggered data

const result = await pool.query(`
  DELETE FROM vehicle_fitments 
  WHERE source = 'tier-a-import'
  AND make = 'Dodge' 
  AND model = 'challenger'
  AND year IN (2022, 2023)
  AND modification_id LIKE 'dodge-challenger-hellcat%'
  RETURNING year, modification_id, display_trim
`);

console.log('Deleted', result.rowCount, 'bad tier-a-import records:');
for (const row of result.rows) {
  console.log(`  ${row.year} ${row.display_trim} (${row.modification_id})`);
}

await pool.end();
