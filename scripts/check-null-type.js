const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  // Check if "null" is actually NULL or the string "null"
  const result = await pool.query(`
    SELECT 
      submodel,
      submodel IS NULL as is_actual_null,
      submodel = 'null' as is_string_null,
      COUNT(*) as count
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'ford' AND LOWER(model) = 'f-150' AND year = 2020
    GROUP BY submodel
  `);
  
  console.log('F-150 2020 submodel analysis:');
  console.log(result.rows);
  
  // What does the API expect?
  const focusSearch = await pool.query(`
    SELECT DISTINCT submodel, display_trim
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'ford' AND LOWER(model) = 'focus'
    ORDER BY submodel
  `);
  
  console.log('\nFocus all submodels:');
  focusSearch.rows.forEach(r => console.log(`  submodel=${JSON.stringify(r.submodel)}, trim=${r.display_trim}`));
  
  await pool.end();
}

main().catch(console.error);
