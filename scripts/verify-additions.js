require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    // Check what we added
    const results = await client.query(`
      SELECT make, model, display_trim, COUNT(*) as cnt, MIN(year) as min_y, MAX(year) as max_y
      FROM vehicle_fitments
      WHERE source = 'manual-research' AND year >= 1980 AND year <= 1990
      GROUP BY make, model, display_trim
      ORDER BY make, model, display_trim
    `);
    console.log('Added records (source=manual-research):');
    results.rows.forEach(r => {
      console.log(`  ${r.make} ${r.model} ${r.display_trim}: ${r.min_y}-${r.max_y} (${r.cnt})`);
    });
    
    // Check for grand-am vs Grand Am inconsistency
    const gaCheck = await client.query(`
      SELECT model, COUNT(*) as cnt FROM vehicle_fitments
      WHERE make = 'Pontiac' AND model ILIKE '%grand%am%'
      GROUP BY model
    `);
    console.log('\nGrand Am model name variants:');
    gaCheck.rows.forEach(r => console.log(`  "${r.model}": ${r.cnt} records`));
    
    // Fix if needed
    if (gaCheck.rows.some(r => r.model === 'grand-am')) {
      console.log('\nFixing grand-am -> Grand Am...');
      await client.query(`
        UPDATE vehicle_fitments 
        SET model = 'Grand Am', updated_at = NOW()
        WHERE make = 'Pontiac' AND model = 'grand-am'
      `);
      console.log('Done!');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
