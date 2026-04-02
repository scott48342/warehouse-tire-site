const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fix() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  // Find all engine-only trims
  const r = await pool.query(`
    SELECT make, model, display_trim, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE display_trim ~ '^[0-9]+\\.?[0-9]*[iL]?$'
    GROUP BY make, model, display_trim
    ORDER BY make, model
  `);
  
  console.log('Engine-only trims by vehicle:\n');
  r.rows.forEach(row => {
    console.log(`${row.make} ${row.model}: "${row.display_trim}" (${row.cnt} records)`);
  });
  
  console.log(`\nTotal: ${r.rows.length} vehicle/trim combos\n`);
  
  // Get the proper trims for each make/model from existing good records
  console.log('=== FIXING ===\n');
  
  const vehicles = [...new Set(r.rows.map(row => `${row.make}|${row.model}`))];
  
  for (const v of vehicles) {
    const [make, model] = v.split('|');
    
    // Get the most common good trim for this vehicle
    const good = await pool.query(`
      SELECT display_trim, COUNT(*) as cnt
      FROM vehicle_fitments
      WHERE make = $1 AND model = $2 
        AND display_trim !~ '^[0-9]+\\.?[0-9]*[iL]?$'
        AND display_trim != 'Base'
      GROUP BY display_trim
      ORDER BY cnt DESC
      LIMIT 1
    `, [make, model]);
    
    let newTrim = 'Base';
    if (good.rows.length > 0) {
      newTrim = good.rows[0].display_trim;
    }
    
    // Update
    const upd = await pool.query(`
      UPDATE vehicle_fitments 
      SET display_trim = $1
      WHERE make = $2 AND model = $3 AND display_trim ~ '^[0-9]+\\.?[0-9]*[iL]?$'
      RETURNING id
    `, [newTrim, make, model]);
    
    if (upd.rowCount > 0) {
      console.log(`${make} ${model}: ${upd.rowCount} records -> "${newTrim}"`);
    }
  }
  
  const total = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  console.log(`\nTotal records: ${total.rows[0].count}`);
  
  await pool.end();
}

fix();
