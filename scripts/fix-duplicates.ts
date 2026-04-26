/**
 * Find and remove duplicate fitment records
 * Keeps the first record, removes duplicates
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('\n🔍 Finding duplicate fitment records...\n');
  
  // Find duplicates (same year/make/model/submodel/wheels/tires)
  const duplicates = await pool.query(`
    SELECT year, make, model, submodel, 
           oem_wheel_sizes::text as wheels,
           oem_tire_sizes::text as tires,
           COUNT(*) as dup_count,
           array_agg(id) as ids
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY year, make, model, submodel, oem_wheel_sizes::text, oem_tire_sizes::text
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `);
  
  console.log(`Found ${duplicates.rowCount} duplicate groups\n`);
  
  let totalDuplicates = 0;
  const idsToDelete: string[] = [];
  
  for (const row of duplicates.rows) {
    const dupCount = row.dup_count - 1; // Keep one, delete rest
    totalDuplicates += dupCount;
    
    // Keep first ID, delete the rest
    const ids: string[] = row.ids;
    idsToDelete.push(...ids.slice(1));
    
    if (duplicates.rows.indexOf(row) < 10) {
      console.log(`  ${row.year} ${row.make} ${row.model} [${row.submodel}]: ${row.dup_count} copies (removing ${dupCount})`);
    }
  }
  
  if (duplicates.rows.length > 10) {
    console.log(`  ... and ${duplicates.rows.length - 10} more groups`);
  }
  
  console.log(`\nTotal duplicate records to remove: ${idsToDelete.length}`);
  
  if (idsToDelete.length > 0) {
    console.log('\nDeleting duplicates...');
    
    // Delete in batches
    const BATCH_SIZE = 500;
    let deleted = 0;
    
    for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
      const batch = idsToDelete.slice(i, i + BATCH_SIZE);
      await pool.query(`DELETE FROM vehicle_fitments WHERE id = ANY($1::uuid[])`, [batch]);
      deleted += batch.length;
      console.log(`  Deleted ${deleted}/${idsToDelete.length}`);
    }
    
    console.log(`\n✅ Removed ${deleted} duplicate records`);
  }
  
  // Verify final count
  const finalCount = await pool.query(`SELECT COUNT(*) FROM vehicle_fitments WHERE year >= 2000`);
  console.log(`\nFinal record count (2000+): ${finalCount.rows[0].count}`);
  
  await pool.end();
}

main().catch(console.error);
