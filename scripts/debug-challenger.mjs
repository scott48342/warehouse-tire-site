import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  // Exact query that canonicalResolver would run
  console.log('=== Exact Query (Step 2) ===');
  console.log('WHERE year=2024, make ilike "dodge", model ilike "challenger", displayTrim="R/T", certified');
  
  const r1 = await pool.query(`
    SELECT id, modification_id, display_trim, make, model, certification_status, bolt_pattern
    FROM vehicle_fitments 
    WHERE year = 2024
      AND make ILIKE 'dodge'
      AND model ILIKE 'challenger'
      AND display_trim = 'R/T'
      AND certification_status = 'certified'
    LIMIT 5
  `);
  console.log('Results:', r1.rows.length);
  console.log(r1.rows);
  
  console.log('\n=== All 2024 Challenger records ===');
  const r2 = await pool.query(`
    SELECT id, modification_id, display_trim, model, certification_status
    FROM vehicle_fitments 
    WHERE year = 2024 AND make ILIKE 'dodge' AND model ILIKE '%challenger%'
    ORDER BY display_trim
  `);
  console.log('Total records:', r2.rows.length);
  r2.rows.forEach(r => console.log(`  ${r.display_trim} | ${r.modification_id} | certified=${r.certification_status}`));
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
