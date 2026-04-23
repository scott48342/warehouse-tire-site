import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  
  // Check BMW models in 1980s
  const bmw = await client.query(`
    SELECT DISTINCT model FROM vehicle_fitments 
    WHERE LOWER(make) = 'bmw' AND year BETWEEN 1980 AND 1990
    ORDER BY model
  `);
  console.log('BMW 1980s models:', bmw.rows.map(r => r.model));
  
  // Check Hummer models
  const hummer = await client.query(`
    SELECT DISTINCT model FROM vehicle_fitments 
    WHERE LOWER(make) = 'hummer'
    ORDER BY model
  `);
  console.log('Hummer models:', hummer.rows.map(r => r.model));

  // Check a sample Hummer record
  const hummerSample = await client.query(`
    SELECT year, model, bolt_pattern, center_bore_mm, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'hummer'
    LIMIT 5
  `);
  console.log('\nHummer samples:');
  hummerSample.rows.forEach(r => {
    console.log(`  ${r.year} ${r.model}: ${r.bolt_pattern}, hub ${r.center_bore_mm}mm`);
  });

  // Count case inconsistencies
  const caseIssues = await client.query(`
    SELECT 
      LOWER(make) as normalized,
      COUNT(DISTINCT make) as variants,
      array_agg(DISTINCT make) as values,
      COUNT(*) as total_records
    FROM vehicle_fitments
    GROUP BY LOWER(make)
    HAVING COUNT(DISTINCT make) > 1
    ORDER BY total_records DESC
  `);
  console.log('\n=== Make casing inconsistencies ===');
  caseIssues.rows.forEach(r => {
    console.log(`${r.normalized}: ${r.values.join(' vs ')} (${r.total_records} records)`);
  });

  client.release();
  await pool.end();
}

main().catch(console.error);
