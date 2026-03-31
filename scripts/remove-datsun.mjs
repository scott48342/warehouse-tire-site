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
  // Remove Datsun vehicles
  const result = await pool.query(`
    DELETE FROM vehicle_fitments 
    WHERE make = 'datsun'
    RETURNING year, make, model
  `);
  console.log(`Deleted ${result.rowCount} Datsun vehicles`);
  
  // List what was deleted
  for (const row of result.rows) {
    console.log(`  - ${row.year} ${row.make} ${row.model}`);
  }

} finally {
  await pool.end();
}
