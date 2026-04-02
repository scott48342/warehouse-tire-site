const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  // Delete erroneous 2025-2026 Challenger records (discontinued after 2024)
  const res = await pool.query(
    `DELETE FROM vehicle_fitments WHERE make = 'dodge' AND model = 'challenger' AND year > 2024 RETURNING year, display_trim`
  );
  
  console.log('Deleted erroneous Challenger records:');
  for (const r of res.rows) {
    console.log(`  ${r.year} ${r.display_trim}`);
  }
  console.log(`Total deleted: ${res.rows.length}`);
  
  await pool.end();
}
main();
