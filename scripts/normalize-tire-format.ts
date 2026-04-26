/**
 * Normalize tire data from objects to strings
 * Converts [{"size": "245/40R18"}] to ["245/40R18"]
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('\n🔧 Normalizing tire data format...\n');
  
  const records = await pool.query(`
    SELECT id, oem_tire_sizes::text as tires
    FROM vehicle_fitments
    WHERE year >= 2000 
      AND oem_tire_sizes IS NOT NULL
      AND oem_tire_sizes::text LIKE '%"size":%'
  `);
  
  console.log(`Found ${records.rowCount} records with object tire format\n`);
  
  const updates: { id: string; tires: string[] }[] = [];
  let failed = 0;
  
  for (const row of records.rows) {
    try {
      const tires = JSON.parse(row.tires);
      const normalized: string[] = [];
      
      for (const t of tires) {
        if (typeof t === 'string') {
          normalized.push(t);
        } else if (typeof t === 'object' && t.size) {
          normalized.push(t.size);
        }
      }
      
      if (normalized.length > 0) {
        // Remove duplicates
        const unique = [...new Set(normalized)];
        updates.push({ id: row.id, tires: unique });
      }
    } catch (e) {
      failed++;
    }
  }
  
  console.log(`Prepared ${updates.length} updates, ${failed} failed\n`);
  
  // Batch update
  const BATCH_SIZE = 500;
  let updated = 0;
  
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    
    for (const u of batch) {
      await pool.query(
        `UPDATE vehicle_fitments SET oem_tire_sizes = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(u.tires), u.id]
      );
    }
    
    updated += batch.length;
    console.log(`  Updated ${updated}/${updates.length}`);
  }
  
  console.log(`\n✅ Normalized ${updated} records`);
  await pool.end();
}

main().catch(console.error);
