import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();

  // Check Suburban structure
  console.log('=== Chevrolet Suburban (1980-1991) ===');
  const suburban = await client.query(`
    SELECT year, display_trim, bolt_pattern, center_bore_mm, 
           COUNT(*)::int as count
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' 
    AND LOWER(model) = 'suburban'
    AND year BETWEEN 1980 AND 1991
    GROUP BY year, display_trim, bolt_pattern, center_bore_mm
    ORDER BY year, display_trim
  `);
  console.table(suburban.rows);

  // Check Celebrity structure
  console.log('\n=== Chevrolet Celebrity (1982-1990) ===');
  const celebrity = await client.query(`
    SELECT year, display_trim, bolt_pattern, center_bore_mm,
           COUNT(*)::int as count
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' 
    AND LOWER(model) = 'celebrity'
    GROUP BY year, display_trim, bolt_pattern, center_bore_mm
    ORDER BY year
  `);
  console.table(celebrity.rows);

  // Check if we have separate 2WD/4WD/2500 trims already
  console.log('\n=== Existing Suburban Trim Names ===');
  const trims = await client.query(`
    SELECT DISTINCT display_trim FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'suburban'
    ORDER BY display_trim
  `);
  console.log(trims.rows.map(r => r.display_trim || '(null)').join(', '));

  client.release();
  await pool.end();
}

main().catch(console.error);
