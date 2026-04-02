const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function sample() {
  // Get distinct Y/M/M combos missing tire sizes, prioritize modern + popular
  const result = await pool.query(`
    SELECT DISTINCT year, make, model, 
           COUNT(*) as trim_count,
           array_agg(display_trim ORDER BY display_trim) as trims
    FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb
    GROUP BY year, make, model
    ORDER BY year DESC, make, model
    LIMIT 30
  `);

  console.log('Sample vehicles missing OEM tire sizes:\n');
  result.rows.forEach(r => {
    console.log(`${r.year} ${r.make} ${r.model} (${r.trim_count} trims)`);
    console.log(`   Trims: ${r.trims.slice(0,5).join(', ')}${r.trims.length > 5 ? '...' : ''}`);
  });

  await pool.end();
}

sample().catch(e => { console.error(e); process.exit(1); });
