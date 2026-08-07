require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    // Get summary counts
    const result = await client.query(`
      SELECT 
        make, 
        COUNT(*) as count,
        COUNT(DISTINCT model) as models,
        MIN(year) as min_year,
        MAX(year) as max_year
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
      GROUP BY make
      ORDER BY count DESC
    `);
    
    const total = await client.query(`
      SELECT COUNT(*) as total FROM vehicle_fitments WHERE year >= 1980 AND year <= 1990
    `);
    
    console.log('=== CLASSIC VEHICLE AUDIT (1980-1990) ===\n');
    console.log('Total records in vehicle_fitments:', total.rows[0].total);
    console.log('Number of makes:', result.rows.length);
    
    console.log('\n--- By Make ---');
    console.log('Make                    | Records | Models | Years');
    console.log('------------------------|---------|--------|--------');
    result.rows.forEach(r => {
      const make = r.make.padEnd(23);
      const count = String(r.count).padStart(7);
      const models = String(r.models).padStart(6);
      const years = `${r.min_year}-${r.max_year}`;
      console.log(`${make} | ${count} | ${models} | ${years}`);
    });
    
    // List all distinct models
    console.log('\n\n--- All Models by Make ---');
    const models = await client.query(`
      SELECT DISTINCT make, model, COUNT(*) as years
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
      GROUP BY make, model
      ORDER BY make, model
    `);
    
    let currentMake = '';
    models.rows.forEach(r => {
      if (r.make !== currentMake) {
        console.log(`\n${r.make.toUpperCase()}:`);
        currentMake = r.make;
      }
      console.log(`  - ${r.model} (${r.years} year${r.years > 1 ? 's' : ''})`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
