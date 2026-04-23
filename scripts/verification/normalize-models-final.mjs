/**
 * Final model cleanup - specific replacements
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Specific model fixes: [make, from, to]
const FIXES = [
  // BMW hyphenated to spaced
  ['BMW', 'X3-m', 'X3 M'],
  ['BMW', 'X4-m', 'X4 M'],
  ['BMW', 'X5-m', 'X5 M'],
  ['BMW', 'X6-m', 'X6 M'],
  ['BMW', 'm-coupe', 'M Coupe'],
  ['BMW', 'm-roadster', 'M Roadster'],
  ['BMW', '4-series-gran-coupe', '4 Series Gran Coupe'],
  ['BMW', 'xm', 'XM'],
  ['BMW', 'ix', 'iX'],
  
  // Mercedes lowercase to proper
  ['Mercedes-Benz', 'amg-gt', 'AMG GT'],
  ['Mercedes-Benz', 'cla', 'CLA'],
  ['Mercedes-Benz', 'cla-class', 'CLA-Class'],
  ['Mercedes-Benz', 'gla', 'GLA'],
  ['Mercedes-Benz', 'glc', 'GLC'],
  ['Mercedes-Benz', 'glc-class', 'GLC-Class'],
  ['Mercedes-Benz', 'gle', 'GLE'],
  ['Mercedes-Benz', 'gle-class', 'GLE-Class'],
  
  // Mercedes case normalization
  ['Mercedes-Benz', 'E-class', 'E-Class'],
  ['Mercedes-Benz', 'C-class', 'C-Class'],
  ['Mercedes-Benz', 'S-class', 'S-Class'],
];

async function main() {
  const client = await pool.connect();
  let totalUpdated = 0;
  
  try {
    for (const [make, from, to] of FIXES) {
      const result = await client.query(
        `UPDATE vehicle_fitments SET model = $1 WHERE make = $2 AND model = $3`,
        [to, make, from]
      );
      if (result.rowCount > 0) {
        console.log(`  "${make} ${from}" → "${make} ${to}" (${result.rowCount} rows)`);
        totalUpdated += result.rowCount;
      }
    }

    console.log(`\nUpdated ${totalUpdated} records`);

    // Final check
    const check = await client.query(`
      SELECT make, model, COUNT(*)::int as count
      FROM vehicle_fitments
      WHERE make IN ('BMW', 'Mercedes-Benz', 'Hummer')
      GROUP BY make, model
      ORDER BY make, model
    `);
    
    console.log('\n=== Final state ===');
    let currentMake = '';
    for (const { make, model, count } of check.rows) {
      if (make !== currentMake) {
        console.log(`\n${make}:`);
        currentMake = make;
      }
      console.log(`  ${model} (${count})`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
