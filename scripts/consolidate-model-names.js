const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Model name mappings: space -> hyphen (canonical)
const consolidations = [
  ['silverado 1500', 'silverado-1500'],
  ['silverado 2500 hd', 'silverado-2500-hd'],
  ['silverado 3500 hd', 'silverado-3500-hd'],
  ['sierra 1500', 'sierra-1500'],
  ['sierra 2500hd', 'sierra-2500-hd'],
  ['sierra 3500hd', 'sierra-3500-hd'],
  ['grand cherokee', 'grand-cherokee'],
  ['land cruiser', 'land-cruiser'],
  ['3 series', '3-series'],
  ['4 series', '4-series'],
  ['5 series', '5-series'],
  ['7 series', '7-series'],
  ['model 3', 'model-3'],
  ['model s', 'model-s'],
  ['model x', 'model-x'],
  ['model y', 'model-y'],
  ['town and country', 'town-and-country'],
  ['grand caravan', 'grand-caravan'],
  ['cx 5', 'cx-5'],
  ['cx 9', 'cx-9'],
  ['cr v', 'cr-v'],
  ['hr v', 'hr-v'],
  ['rav 4', 'rav4'],
  ['f 150', 'f-150'],
  ['yukon xl', 'yukon-xl'],
];

async function consolidate() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log('=== MODEL NAME CONSOLIDATION ===\n');
  
  let totalUpdated = 0;
  let totalDeleted = 0;
  
  for (const [oldName, newName] of consolidations) {
    // Check if old name exists
    const check = await pool.query(
      'SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE model = $1',
      [oldName]
    );
    
    if (parseInt(check.rows[0].cnt) === 0) continue;
    
    console.log(`\n${oldName} → ${newName}:`);
    console.log(`  Found ${check.rows[0].cnt} records with old name`);
    
    // Find records that would be duplicates after rename
    const dupes = await pool.query(`
      SELECT old.id as old_id, new.id as new_id, old.year, old.display_trim
      FROM vehicle_fitments old
      JOIN vehicle_fitments new ON old.year = new.year 
        AND old.make = new.make 
        AND old.display_trim = new.display_trim
      WHERE old.model = $1 AND new.model = $2
    `, [oldName, newName]);
    
    if (dupes.rows.length > 0) {
      console.log(`  ⚠️ ${dupes.rows.length} would be duplicates - deleting old versions`);
      
      // Delete the old versions that would be duplicates
      const oldIds = dupes.rows.map(r => r.old_id);
      await pool.query(
        'DELETE FROM vehicle_fitments WHERE id = ANY($1)',
        [oldIds]
      );
      totalDeleted += oldIds.length;
    }
    
    // Update remaining records
    const result = await pool.query(
      'UPDATE vehicle_fitments SET model = $1 WHERE model = $2 RETURNING id',
      [newName, oldName]
    );
    
    console.log(`  ✅ Updated ${result.rowCount} records`);
    totalUpdated += result.rowCount;
  }
  
  // Check for any remaining space-containing models
  const remaining = await pool.query(`
    SELECT DISTINCT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE model LIKE '% %' 
    GROUP BY model 
    ORDER BY cnt DESC
  `);
  
  if (remaining.rows.length > 0) {
    console.log('\n⚠️ Remaining models with spaces:');
    remaining.rows.forEach(r => console.log(`  ${r.model}: ${r.cnt} records`));
  }
  
  const total = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  
  console.log('\n=== SUMMARY ===');
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Deleted (duplicates): ${totalDeleted}`);
  console.log(`Total records: ${total.rows[0].count}`);
  
  await pool.end();
}

consolidate();
