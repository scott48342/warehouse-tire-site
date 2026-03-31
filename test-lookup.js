require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function test() {
  const pool = new Pool({ 
    connectionString: process.env.POSTGRES_URL, 
    ssl: { rejectUnauthorized: false } 
  });

  const year = 2022;
  const make = 'ford';  // What the API sends
  const model = 'f-150'; // What the API sends
  
  // Simulate normalization (from keys.ts)
  function slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");
  }
  
  const normalizedMake = slugify(make);
  const normalizedModel = slugify(model);
  
  console.log(`Looking up: year=${year}, make="${normalizedMake}", model="${normalizedModel}"`);
  
  try {
    const result = await pool.query(`
      SELECT year, make, model, modification_id, bolt_pattern 
      FROM vehicle_fitments 
      WHERE year = $1 AND make = $2 AND model = $3
      LIMIT 5
    `, [year, normalizedMake, normalizedModel]);
    
    console.log('Results:', result.rows.length);
    result.rows.forEach(row => console.log(JSON.stringify(row)));
    
    // Also try raw query
    console.log('\nRaw data in DB for ford:');
    const raw = await pool.query(`
      SELECT DISTINCT year, make, model 
      FROM vehicle_fitments 
      WHERE make = 'ford' 
      LIMIT 20
    `);
    raw.rows.forEach(row => console.log(`  ${row.year} ${row.make} ${row.model}`));
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

test();
