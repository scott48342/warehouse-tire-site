// Quick check for cleanup items using pg directly
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  
  try {
    // Check pre-1999 Silverado entries
    const silverado = await client.query(`
      SELECT COUNT(*)::int as count, MIN(year)::int as min_year, MAX(year)::int as max_year 
      FROM vehicle_fitments 
      WHERE model = 'Silverado' AND year < 1999
    `);
    console.log('\n=== Pre-1999 "Silverado" entries (should be C/K) ===');
    console.log(silverado.rows[0]);

    // Check Jeep Cherokee 2002-2013 (should be Liberty)
    const cherokee = await client.query(`
      SELECT COUNT(*)::int as count, MIN(year)::int as min_year, MAX(year)::int as max_year 
      FROM vehicle_fitments 
      WHERE model = 'Cherokee' AND make = 'Jeep' AND year BETWEEN 2002 AND 2013
    `);
    console.log('\n=== Jeep Cherokee 2002-2013 (should be Liberty) ===');
    console.log(cherokee.rows[0]);

    // Check if Liberty already exists
    const liberty = await client.query(`
      SELECT COUNT(*)::int as count, MIN(year)::int as min_year, MAX(year)::int as max_year 
      FROM vehicle_fitments 
      WHERE model = 'Liberty' AND make = 'Jeep'
    `);
    console.log('\n=== Existing Jeep Liberty entries ===');
    console.log(liberty.rows[0]);

    // Sample of pre-1999 Silverado trims
    const silveradoTrims = await client.query(`
      SELECT DISTINCT year, display_trim, bolt_pattern 
      FROM vehicle_fitments 
      WHERE model = 'Silverado' AND year < 1999
      ORDER BY year
      LIMIT 20
    `);
    console.log('\n=== Pre-1999 Silverado trims (sample) ===');
    console.table(silveradoTrims.rows);

    // Check C/K series entries
    const ck = await client.query(`
      SELECT model, COUNT(*)::int as count, MIN(year)::int as min_year, MAX(year)::int as max_year 
      FROM vehicle_fitments 
      WHERE make = 'Chevrolet' AND (model LIKE 'C%' OR model LIKE 'K%') AND model ~ '^[CK][0-9]'
      GROUP BY model
      ORDER BY model
    `);
    console.log('\n=== Existing C/K series entries ===');
    console.table(ck.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
