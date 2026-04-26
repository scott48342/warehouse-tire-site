import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const total = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
  const complete = await pool.query("SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE quality_tier = 'complete'");
  const withBolt = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE bolt_pattern IS NOT NULL');

  const byMake = await pool.query(`
    SELECT make, COUNT(*) as total,
      SUM(CASE WHEN quality_tier = 'complete' THEN 1 ELSE 0 END) as complete
    FROM vehicle_fitments
    GROUP BY make
    ORDER BY total DESC
    LIMIT 20
  `);

  const incomplete = await pool.query(`
    SELECT make, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE quality_tier != 'complete' OR quality_tier IS NULL
    GROUP BY make
    ORDER BY cnt DESC
    LIMIT 10
  `);

  console.log('=== FITMENT DATABASE STATUS ===\n');
  console.log('Total records:', total.rows[0].cnt);
  console.log('Complete:', complete.rows[0].cnt, '(' + (complete.rows[0].cnt / total.rows[0].cnt * 100).toFixed(1) + '%)');
  console.log('With bolt pattern:', withBolt.rows[0].cnt);
  console.log('\n--- Top 20 Makes ---');
  for (const r of byMake.rows) {
    const pct = (r.complete / r.total * 100).toFixed(0);
    const bar = '█'.repeat(Math.floor(parseInt(pct) / 5)) + '░'.repeat(20 - Math.floor(parseInt(pct) / 5));
    console.log(`  ${r.make.padEnd(15)} ${r.complete}/${r.total} ${bar} ${pct}%`);
  }
  
  console.log('\n--- Most Incomplete ---');
  for (const r of incomplete.rows) {
    console.log(`  ${r.make}: ${r.cnt} records need work`);
  }

  await pool.end();
}

main();
