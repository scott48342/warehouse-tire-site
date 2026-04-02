const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fix() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  // Check for bad duplicates with extra hyphen
  const badModels = [
    'silverado-2500-hd',
    'silverado-3500-hd', 
    'sierra-2500-hd',
    'sierra-3500-hd',
  ];
  
  console.log('=== FIXING HD MODEL NAME DUPLICATES ===\n');
  
  for (const badModel of badModels) {
    const goodModel = badModel.replace('-hd', 'hd'); // silverado-2500-hd -> silverado-2500hd
    
    // Count bad records
    const count = await pool.query(
      'SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE model = $1',
      [badModel]
    );
    
    if (parseInt(count.rows[0].cnt) === 0) continue;
    
    console.log(`${badModel}: ${count.rows[0].cnt} records`);
    
    // Check what the bad records have
    const badRecords = await pool.query(
      'SELECT year, display_trim FROM vehicle_fitments WHERE model = $1 ORDER BY year',
      [badModel]
    );
    console.log('  Bad trims:', [...new Set(badRecords.rows.map(r => r.display_trim))].join(', '));
    
    // Delete bad records (they're duplicates with worse data)
    const del = await pool.query(
      'DELETE FROM vehicle_fitments WHERE model = $1 RETURNING id',
      [badModel]
    );
    console.log(`  Deleted ${del.rowCount} bad records\n`);
  }
  
  // Also fix any remaining engine-only trims in the good models
  const engineTrims = ['6.0i', '6.6i', '6.2i', '6.6 Duramax', '6.6L'];
  
  console.log('=== FIXING ENGINE-ONLY TRIMS ===\n');
  
  for (const trim of engineTrims) {
    const r = await pool.query(
      `SELECT id, year, make, model FROM vehicle_fitments WHERE display_trim = $1`,
      [trim]
    );
    
    if (r.rowCount > 0) {
      console.log(`Found ${r.rowCount} records with trim "${trim}"`);
      
      // Update to proper trim based on year
      for (const row of r.rows) {
        let newTrim = 'WT, Custom, LT, LTZ, High Country';
        if (row.year < 2015) newTrim = 'WT, LT, LTZ';
        
        await pool.query(
          'UPDATE vehicle_fitments SET display_trim = $1 WHERE id = $2',
          [newTrim, row.id]
        );
      }
      console.log(`  Updated to proper trims`);
    }
  }
  
  // Verify 2020 Silverado 2500HD now
  console.log('\n=== VERIFICATION: 2020 Silverado 2500HD ===\n');
  const verify = await pool.query(`
    SELECT display_trim FROM vehicle_fitments 
    WHERE make = 'chevrolet' AND model LIKE '%2500%' AND year = 2020
  `);
  verify.rows.forEach(r => console.log(`  ${r.display_trim}`));
  
  const total = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  console.log(`\nTotal records: ${total.rows[0].count}`);
  
  await pool.end();
}

fix();
