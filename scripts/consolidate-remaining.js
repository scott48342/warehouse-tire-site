const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Additional consolidations
const consolidations = [
  ['promaster 1500', 'promaster-1500'],
  ['santa fe', 'santa-fe'],
  ['golf gti', 'golf-gti'],
  ['golf r', 'golf-r'],
  ['outlander sport', 'outlander-sport'],
  ['bolt ev', 'bolt-ev'],
  ['ioniq 5', 'ioniq-5'],
  ['avalanche 1500', 'avalanche-1500'],
  ['ioniq 6', 'ioniq-6'],
  ['mustang mach-e', 'mustang-mach-e'],
  ['eclipse cross', 'eclipse-cross'],
  ['encore gx', 'encore-gx'],
  ['hummer ev', 'hummer-ev'],
  ['polestar 2', 'polestar-2'],
  ['ram 1500', '1500'],  // ram make already, just model is 1500
  ['town & country', 'town-and-country'],
];

async function consolidate() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log('=== REMAINING CONSOLIDATION ===\n');
  
  let totalUpdated = 0;
  let totalDeleted = 0;
  
  for (const [oldName, newName] of consolidations) {
    const check = await pool.query(
      'SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE model = $1',
      [oldName]
    );
    
    if (parseInt(check.rows[0].cnt) === 0) continue;
    
    console.log(`${oldName} → ${newName}: ${check.rows[0].cnt} records`);
    
    // Find duplicates
    const dupes = await pool.query(`
      SELECT old.id as old_id
      FROM vehicle_fitments old
      JOIN vehicle_fitments new ON old.year = new.year 
        AND old.make = new.make 
        AND old.display_trim = new.display_trim
      WHERE old.model = $1 AND new.model = $2
    `, [oldName, newName]);
    
    if (dupes.rows.length > 0) {
      const oldIds = dupes.rows.map(r => r.old_id);
      await pool.query('DELETE FROM vehicle_fitments WHERE id = ANY($1)', [oldIds]);
      totalDeleted += oldIds.length;
      console.log(`  Deleted ${oldIds.length} duplicates`);
    }
    
    const result = await pool.query(
      'UPDATE vehicle_fitments SET model = $1 WHERE model = $2 RETURNING id',
      [newName, oldName]
    );
    totalUpdated += result.rowCount;
    console.log(`  Updated ${result.rowCount}`);
  }
  
  // Check for any remaining
  const remaining = await pool.query(`
    SELECT DISTINCT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE model LIKE '% %' 
    GROUP BY model 
    ORDER BY cnt DESC
  `);
  
  if (remaining.rows.length > 0) {
    console.log('\n⚠️ Still remaining with spaces:');
    remaining.rows.forEach(r => console.log(`  ${r.model}: ${r.cnt}`));
  } else {
    console.log('\n✅ No more models with spaces!');
  }
  
  const total = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  console.log(`\nTotal records: ${total.rows[0].count}`);
  
  await pool.end();
}

consolidate();
