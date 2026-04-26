import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const result = await pool.query(`
    SELECT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND source != 'trim-research'
    GROUP BY model 
    ORDER BY cnt DESC
  `);

  console.log('Remaining Toyota models (not yet updated):');
  for (const r of result.rows) {
    console.log(`  ${r.model}: ${r.cnt} records`);
  }
  console.log(`\nTotal: ${result.rows.reduce((a: number, b: any) => a + parseInt(b.cnt), 0)} records`);
  await pool.end();
}

main();
