/**
 * Check wheel finish values from raw JSONB
 */
const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  console.log('=== abbreviated_finish_desc values ===');
  const abbrev = await pool.query(`
    SELECT raw->>'abbreviated_finish_desc' as finish, COUNT(*) as cnt
    FROM wp_wheels
    WHERE raw->>'abbreviated_finish_desc' IS NOT NULL
    GROUP BY raw->>'abbreviated_finish_desc'
    ORDER BY cnt DESC
    LIMIT 50
  `);
  abbrev.rows.forEach((r, i) => console.log(`  ${i+1}. "${r.finish}" (${r.cnt})`));
  
  console.log('\n=== fancy_finish_desc values ===');
  const fancy = await pool.query(`
    SELECT raw->>'fancy_finish_desc' as finish, COUNT(*) as cnt
    FROM wp_wheels
    WHERE raw->>'fancy_finish_desc' IS NOT NULL
    GROUP BY raw->>'fancy_finish_desc'
    ORDER BY cnt DESC
    LIMIT 50
  `);
  fancy.rows.forEach((r, i) => console.log(`  ${i+1}. "${r.finish}" (${r.cnt})`));
  
  console.log('\n=== box_label_desc values (sample) ===');
  const box = await pool.query(`
    SELECT raw->>'box_label_desc' as finish, COUNT(*) as cnt
    FROM wp_wheels
    WHERE raw->>'box_label_desc' IS NOT NULL
    GROUP BY raw->>'box_label_desc'
    ORDER BY cnt DESC
    LIMIT 30
  `);
  box.rows.forEach((r, i) => console.log(`  ${i+1}. "${r.finish}" (${r.cnt})`));
  
  // How many get collapsed from fancy to abbreviated?
  console.log('\n=== Collapse analysis: fancy -> abbreviated ===');
  const collapse = await pool.query(`
    SELECT 
      raw->>'abbreviated_finish_desc' as abbrev,
      raw->>'fancy_finish_desc' as fancy,
      COUNT(*) as cnt
    FROM wp_wheels
    WHERE raw->>'abbreviated_finish_desc' = 'BLACK'
    GROUP BY raw->>'abbreviated_finish_desc', raw->>'fancy_finish_desc'
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log('Finishes collapsed to "BLACK":');
  collapse.rows.forEach(r => console.log(`  "${r.fancy}" -> "${r.abbrev}" (${r.cnt})`));
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
