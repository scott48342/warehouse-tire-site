const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function merge() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log('=== MERGING DUPLICATE MODELS ===\n');
  
  let totalDeleted = 0;
  let totalUpdated = 0;
  
  // 1. RAM: Merge RAM-2500 -> 2500, RAM-3500 -> 3500
  console.log('--- RAM Brand ---');
  for (const [oldModel, newModel] of [['RAM-2500', '2500'], ['RAM-3500', '3500']]) {
    // Delete duplicates where we already have coverage
    const dupes = await pool.query(`
      DELETE FROM vehicle_fitments 
      WHERE make = 'ram' AND model = $1 
        AND year IN (SELECT year FROM vehicle_fitments WHERE make = 'ram' AND model = $2)
      RETURNING id
    `, [oldModel, newModel]);
    
    // Update remaining to new model name
    const upd = await pool.query(`
      UPDATE vehicle_fitments SET model = $1 WHERE make = 'ram' AND model = $2 RETURNING id
    `, [newModel, oldModel]);
    
    console.log(`  ${oldModel} -> ${newModel}: deleted ${dupes.rowCount}, updated ${upd.rowCount}`);
    totalDeleted += dupes.rowCount;
    totalUpdated += upd.rowCount;
  }
  
  // 2. Delete that lone Dodge 1500 (should be ram-1500)
  const dodgeLone = await pool.query(`DELETE FROM vehicle_fitments WHERE make = 'dodge' AND model = '1500' RETURNING id`);
  console.log(`\n  Deleted dodge 1500: ${dodgeLone.rowCount}`);
  totalDeleted += dodgeLone.rowCount;
  
  // 3. Chevy/GMC: Delete generic -hd models (silverado-hd, sierra-hd)
  console.log('\n--- GM HD Models ---');
  for (const model of ['silverado-hd', 'sierra-hd']) {
    const make = model.startsWith('silverado') ? 'chevrolet' : 'gmc';
    const del = await pool.query(`DELETE FROM vehicle_fitments WHERE make = $1 AND model = $2 RETURNING id`, [make, model]);
    console.log(`  Deleted ${make} ${model}: ${del.rowCount}`);
    totalDeleted += del.rowCount;
  }
  
  // 4. Ford: Merge f-250-super-duty -> f-250, f-350-super-duty -> f-350
  console.log('\n--- Ford Super Duty ---');
  for (const size of ['250', '350']) {
    const oldModel = `f-${size}-super-duty`;
    const newModel = `f-${size}`;
    
    // Delete duplicates
    const dupes = await pool.query(`
      DELETE FROM vehicle_fitments 
      WHERE make = 'ford' AND model = $1 
        AND year IN (SELECT year FROM vehicle_fitments WHERE make = 'ford' AND model = $2)
      RETURNING id
    `, [oldModel, newModel]);
    
    // Update remaining
    const upd = await pool.query(`
      UPDATE vehicle_fitments SET model = $1 WHERE make = 'ford' AND model = $2 RETURNING id
    `, [newModel, oldModel]);
    
    console.log(`  ${oldModel} -> ${newModel}: deleted ${dupes.rowCount}, updated ${upd.rowCount}`);
    totalDeleted += dupes.rowCount;
    totalUpdated += upd.rowCount;
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Deleted: ${totalDeleted}`);
  console.log(`Updated: ${totalUpdated}`);
  
  const total = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  console.log(`Total records: ${total.rows[0].count}`);
  
  await pool.end();
}

merge();
