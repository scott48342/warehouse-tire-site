/**
 * Check what wheel finish values exist in the database
 */
const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  console.log('=== Wheel Finish Values in Database ===\n');
  
  // Get all unique abbreviated_finish_desc values
  const finishes = await pool.query(`
    SELECT abbreviated_finish_desc, COUNT(*) as cnt
    FROM wp_wheels
    WHERE abbreviated_finish_desc IS NOT NULL AND abbreviated_finish_desc != ''
    GROUP BY abbreviated_finish_desc
    ORDER BY cnt DESC
    LIMIT 50
  `);
  
  console.log('Top 50 finish values by count:');
  finishes.rows.forEach((r, i) => {
    console.log(`  ${i+1}. "${r.abbreviated_finish_desc}" (${r.cnt})`);
  });
  
  // Check for Black variations
  console.log('\n=== Black-related finishes ===');
  const blackFinishes = await pool.query(`
    SELECT abbreviated_finish_desc, COUNT(*) as cnt
    FROM wp_wheels
    WHERE LOWER(abbreviated_finish_desc) LIKE '%black%'
    GROUP BY abbreviated_finish_desc
    ORDER BY cnt DESC
    LIMIT 30
  `);
  blackFinishes.rows.forEach(r => {
    console.log(`  "${r.abbreviated_finish_desc}" (${r.cnt})`);
  });
  
  // Check for Bronze/Gunmetal/Silver
  console.log('\n=== Bronze/Gunmetal/Silver finishes ===');
  const otherFinishes = await pool.query(`
    SELECT abbreviated_finish_desc, COUNT(*) as cnt
    FROM wp_wheels
    WHERE LOWER(abbreviated_finish_desc) LIKE '%bronze%'
       OR LOWER(abbreviated_finish_desc) LIKE '%gunmetal%'
       OR LOWER(abbreviated_finish_desc) LIKE '%silver%'
    GROUP BY abbreviated_finish_desc
    ORDER BY cnt DESC
    LIMIT 30
  `);
  otherFinishes.rows.forEach(r => {
    console.log(`  "${r.abbreviated_finish_desc}" (${r.cnt})`);
  });
  
  // Total distinct finishes
  const total = await pool.query(`
    SELECT COUNT(DISTINCT abbreviated_finish_desc) as cnt
    FROM wp_wheels
    WHERE abbreviated_finish_desc IS NOT NULL AND abbreviated_finish_desc != ''
  `);
  console.log(`\nTotal distinct finish values: ${total.rows[0].cnt}`);
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
