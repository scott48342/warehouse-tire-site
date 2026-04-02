const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  // Check what display_trim values are used when submodel is NULL
  const result = await pool.query(`
    SELECT display_trim, COUNT(*) as count
    FROM vehicle_fitments 
    WHERE submodel IS NULL
    GROUP BY display_trim
    ORDER BY count DESC
    LIMIT 20
  `);
  
  console.log('Most common display_trim values when submodel is NULL:');
  result.rows.forEach(r => console.log(`  "${r.display_trim}": ${r.count}`));
  
  await pool.end();
}

main().catch(console.error);
