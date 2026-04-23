/**
 * Normalize model casing for specific patterns
 * - BMW: m3 → M3, x5 → X5, z4 → Z4, i4 → i4 (i-series stays lowercase i)
 * - Hummer: h1 → H1
 * - Generic alphanumeric models
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const client = await pool.connect();
  
  try {
    let totalUpdated = 0;

    // Get all distinct models that look like they need uppercase
    const models = await client.query(`
      SELECT DISTINCT make, model 
      FROM vehicle_fitments
      WHERE 
        -- BMW letter-number combos (m3, x5, z4, but NOT i3/i4/i7/i8 - those are correct as-is for BMW i-series)
        (make = 'BMW' AND model ~ '^[mxz][0-9]' AND model !~ '^[MXZ][0-9]')
        -- Hummer h1/h2/h3
        OR (make = 'Hummer' AND model ~ '^h[123]$')
        -- Mercedes letter-class (if any lowercase)
        OR (make = 'Mercedes-Benz' AND model ~ '^[a-z]-?class' AND model !~ '^[A-Z]')
      ORDER BY make, model
    `);

    console.log(`Found ${models.rows.length} models to normalize\n`);
    
    for (const { make, model } of models.rows) {
      // Uppercase first letter for these patterns
      const normalized = model.charAt(0).toUpperCase() + model.slice(1);
      
      console.log(`  "${make} ${model}" → "${make} ${normalized}"`);
      
      if (!dryRun) {
        const result = await client.query(
          `UPDATE vehicle_fitments SET model = $1 WHERE make = $2 AND model = $3`,
          [normalized, make, model]
        );
        totalUpdated += result.rowCount;
        console.log(`    (${result.rowCount} rows)`);
      }
    }

    console.log(`\n${dryRun ? '[DRY RUN] Would update' : 'Updated'} ${totalUpdated} records`);

    // Show remaining models for review
    const remaining = await client.query(`
      SELECT DISTINCT make, model 
      FROM vehicle_fitments
      WHERE make IN ('BMW', 'Hummer', 'Mercedes-Benz')
      ORDER BY make, model
    `);
    
    console.log('\n=== Final model list ===');
    let currentMake = '';
    for (const { make, model } of remaining.rows) {
      if (make !== currentMake) {
        console.log(`\n${make}:`);
        currentMake = make;
      }
      process.stdout.write(`  ${model}`);
    }
    console.log('');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
