#!/usr/bin/env node
/**
 * ROLLBACK - Restore oem_tire_sizes from snapshot
 * 
 * This restores the Phase A records to their original state
 * from the pre-apply snapshot.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, readFileSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

async function rollback() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ROLLBACK - RESTORING FROM SNAPSHOT                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Find latest snapshot
  const snapshotDir = resolve(__dirname, 'output/snapshots');
  const files = readdirSync(snapshotDir).filter(f => f.startsWith('phase-a-snapshot-'));
  
  if (files.length === 0) {
    console.error('❌ No snapshot files found!');
    process.exit(1);
  }
  
  const latestSnapshot = files.sort().pop();
  const snapshotPath = resolve(snapshotDir, latestSnapshot);
  console.log(`📂 Loading snapshot: ${latestSnapshot}`);
  
  const snapshotData = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  console.log(`   Found ${snapshotData.records.length} records to restore\n`);
  
  const connectionString = process.env.POSTGRES_URL;
  const sql = postgres(connectionString);
  
  let restored = 0;
  let errors = 0;
  
  try {
    for (const record of snapshotData.records) {
      try {
        // Restore the original oem_tire_sizes
        await sql`
          UPDATE vehicle_fitments
          SET oem_tire_sizes = ${sql.json(record.oem_tire_sizes)},
              updated_at = NOW()
          WHERE id = ${record.id}::uuid
        `;
        restored++;
        
        if (restored % 20 === 0) {
          console.log(`   Restored ${restored}/${snapshotData.records.length}...`);
        }
      } catch (err) {
        errors++;
        console.error(`   ❌ Error restoring ${record.id}: ${err.message}`);
      }
    }
  } finally {
    await sql.end();
  }
  
  console.log(`\n✅ Restored ${restored} records`);
  if (errors > 0) {
    console.log(`⚠️  ${errors} errors`);
  }
  
  // Verify restoration
  console.log('\n📋 Verifying rollback...');
  const sql2 = postgres(connectionString);
  
  const verify = await sql2`
    SELECT id, year, make, model, display_trim, oem_tire_sizes
    FROM vehicle_fitments
    WHERE make = 'Chevrolet' AND model = 'Camaro' 
      AND display_trim LIKE '%SS 1LE%'
      AND year = 2024
    LIMIT 1
  `;
  
  if (verify.length > 0) {
    console.log(`\n2024 Chevrolet Camaro SS 1LE:`);
    console.log(`  oem_tire_sizes: ${JSON.stringify(verify[0].oem_tire_sizes)}`);
    
    // Check it's back to string array format
    const tireSizes = verify[0].oem_tire_sizes;
    if (Array.isArray(tireSizes) && typeof tireSizes[0] === 'string') {
      console.log(`  ✅ Format restored to string array`);
    } else {
      console.log(`  ⚠️  Format may still be objects: ${typeof tireSizes[0]}`);
    }
  }
  
  await sql2.end();
}

rollback().catch(err => {
  console.error('Rollback failed:', err);
  process.exit(1);
});
