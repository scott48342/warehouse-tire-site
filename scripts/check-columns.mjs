import pg from 'pg';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const dbMatch = envContent.match(/DATABASE_URL=(.+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

try {
  // List all columns
  const cols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments'
    ORDER BY ordinal_position
  `);
  console.log('Columns in vehicle_fitments:');
  for (const c of cols.rows) {
    console.log(`  ${c.column_name}: ${c.data_type}`);
  }

  // Get a sample row with all data
  const sample = await pool.query(`
    SELECT * FROM vehicle_fitments 
    WHERE make = 'ford' AND model = 'f-150' AND year = 2024
    LIMIT 1
  `);
  console.log('\nSample row (2024 Ford F-150):');
  console.log(JSON.stringify(sample.rows[0], null, 2));

} finally {
  await pool.end();
}
