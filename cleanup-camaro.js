const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  // Camaro discontinued after 2024 (6th gen ended)
  const res = await pool.query(
    `DELETE FROM vehicle_fitments 
     WHERE make = 'chevrolet' AND model = 'camaro' AND year > 2024 
     RETURNING year, display_trim`
  );
  
  console.log('Deleted erroneous Camaro records (discontinued after 2024):');
  for (const r of res.rows) {
    console.log(`  ${r.year} ${r.display_trim}`);
  }
  console.log(`Total deleted: ${res.rows.length}`);
  
  // Verify final coverage
  const verify = await pool.query(`
    SELECT COUNT(DISTINCT year) as years,
           SUM(CASE WHEN (SELECT COUNT(*) FROM vehicle_fitments v2 
                          WHERE v2.year = v.year AND v2.make = 'chevrolet' AND v2.model = 'camaro') > 1 
               THEN 1 ELSE 0 END) as multi_trim
    FROM (SELECT DISTINCT year FROM vehicle_fitments WHERE make = 'chevrolet' AND model = 'camaro') v
  `);
  
  const multiCheck = await pool.query(`
    SELECT COUNT(*) as cnt FROM (
      SELECT year FROM vehicle_fitments
      WHERE make = 'chevrolet' AND model = 'camaro'
      GROUP BY year HAVING COUNT(*) > 1
    ) sub
  `);
  
  const totalYears = await pool.query(`
    SELECT COUNT(DISTINCT year) as cnt FROM vehicle_fitments
    WHERE make = 'chevrolet' AND model = 'camaro'
  `);
  
  console.log(`\nCamaro now: ${totalYears.rows[0].cnt} years, ${multiCheck.rows[0].cnt} multi-trim`);
  
  await pool.end();
}
main();
