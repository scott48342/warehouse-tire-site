import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  console.log('=== Camaro 1LE records ===');
  const r1 = await pool.query(`
    SELECT modification_id, display_trim, year, source 
    FROM vehicle_fitments 
    WHERE make ILIKE 'chevrolet' AND model ILIKE '%camaro%' AND display_trim ILIKE '%1le%' 
    LIMIT 5
  `);
  console.log(r1.rows.length ? r1.rows : 'NO RECORDS FOUND');
  
  console.log('\n=== Challenger Widebody records ===');
  const r2 = await pool.query(`
    SELECT modification_id, display_trim, year, source 
    FROM vehicle_fitments 
    WHERE make ILIKE 'dodge' AND model ILIKE '%challenger%' AND display_trim ILIKE '%widebody%' 
    LIMIT 5
  `);
  console.log(r2.rows.length ? r2.rows : 'NO RECORDS FOUND');
  
  console.log('\n=== Challenger R/T records (any) ===');
  const r3 = await pool.query(`
    SELECT modification_id, display_trim, year, source 
    FROM vehicle_fitments 
    WHERE make ILIKE 'dodge' AND model ILIKE '%challenger%' 
    AND (display_trim ILIKE '%r/t%' OR display_trim ILIKE '%rt %' OR modification_id ILIKE '%rt%')
    LIMIT 10
  `);
  console.log(r3.rows.length ? r3.rows : 'NO RECORDS FOUND');
  
  console.log('\n=== All Challenger trims (2024) ===');
  const r4 = await pool.query(`
    SELECT DISTINCT display_trim, modification_id, source 
    FROM vehicle_fitments 
    WHERE make ILIKE 'dodge' AND model ILIKE '%challenger%' AND year = 2024
    ORDER BY display_trim
  `);
  console.log(r4.rows.length ? r4.rows : 'NO RECORDS');
  
  console.log('\n=== All Camaro trims (2024) ===');
  const r5 = await pool.query(`
    SELECT DISTINCT display_trim, modification_id, source 
    FROM vehicle_fitments 
    WHERE make ILIKE 'chevrolet' AND model ILIKE '%camaro%' AND year = 2024
    ORDER BY display_trim
  `);
  console.log(r5.rows.length ? r5.rows : 'NO RECORDS');
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
