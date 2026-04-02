const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  // Check what submodels exist for Focus across ALL years (not just batch2)
  const allFocus = await pool.query(`
    SELECT year, submodel, display_trim, source, COUNT(*) as count
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'ford' AND LOWER(model) = 'focus'
    GROUP BY year, submodel, display_trim, source
    ORDER BY year, submodel
  `);
  
  console.log('All Ford Focus records by year/submodel:');
  console.log('─'.repeat(80));
  allFocus.rows.forEach(r => {
    console.log(`${r.year} | submodel: "${r.submodel}" | trim: "${r.display_trim}" | source: ${r.source} | count: ${r.count}`);
  });
  
  // Check a few other popular models to see the pattern
  console.log('\n\nOther models submodel pattern (for comparison):');
  console.log('─'.repeat(80));
  
  const otherModels = await pool.query(`
    SELECT make, model, year, submodel, display_trim
    FROM vehicle_fitments 
    WHERE LOWER(make) IN ('ford', 'toyota', 'honda') 
      AND LOWER(model) IN ('f-150', 'camry', 'accord')
      AND year = 2020
    ORDER BY make, model, submodel
    LIMIT 20
  `);
  
  otherModels.rows.forEach(r => {
    console.log(`${r.make} ${r.model} ${r.year} | submodel: "${r.submodel}" | trim: "${r.display_trim}"`);
  });
  
  await pool.end();
}

main().catch(console.error);
