const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  const classics = ['mustang', 'challenger', 'charger', 'firebird', 'gto', 'chevelle', 'nova', 'barracuda', 'cuda'];
  
  console.log('Checking classic muscle car coverage (pre-2000):\n');
  
  for (const model of classics) {
    const result = await pool.query(`
      SELECT year, make, model, display_trim 
      FROM vehicle_fitments 
      WHERE year < 2000 AND LOWER(model) LIKE $1
      ORDER BY year
    `, [`%${model}%`]);
    
    if (result.rows.length > 0) {
      const years = [...new Set(result.rows.map(r => r.year))].sort();
      console.log(`✅ ${model}: ${result.rows.length} records (${Math.min(...years)}-${Math.max(...years)})`);
    } else {
      console.log(`❌ ${model}: NO DATA`);
    }
  }

  await pool.end();
}

main().catch(console.error);
