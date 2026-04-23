/**
 * Import overnight verification results
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;
const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const RESULTS_DIR = './results-overnight';

// Get all result files
const files = fs.readdirSync(RESULTS_DIR)
  .filter(f => f.endsWith('.json') && f.startsWith('overnight-'))
  .sort();

console.log(`Found ${files.length} result files to import\n`);

let totalUpdated = 0;
let totalSkipped = 0;
let totalFlagged = 0;
let totalErrors = 0;

for (const file of files) {
  console.log(`Processing ${file}...`);
  
  try {
    const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'));
    
    let updated = 0;
    let skipped = 0;
    let flagged = 0;
    
    for (const vehicle of data) {
      // Skip invalid/flagged vehicles
      if (vehicle.status === 'invalid' || vehicle.status === 'not_sold_in_us') {
        skipped++;
        continue;
      }
      
      if (vehicle.status === 'flagged' || vehicle.status === 'review') {
        flagged++;
        continue;
      }
      
      // Must have verified specs
      if (!vehicle.verifiedBoltPattern && !vehicle.boltPattern) {
        skipped++;
        continue;
      }
      
      const boltPattern = vehicle.verifiedBoltPattern || vehicle.boltPattern;
      const hubBore = vehicle.verifiedHubBore || vehicle.hubBore || vehicle.centerBore;
      
      // Parse hub bore - handle various formats
      let hubBoreMm = null;
      if (hubBore) {
        const match = String(hubBore).match(/[\d.]+/);
        if (match) hubBoreMm = parseFloat(match[0]);
      }
      
      // Build wheel sizes array
      let wheelSizes = vehicle.verifiedWheelSizes || vehicle.wheelSizes || vehicle.oemWheelSizes;
      if (wheelSizes && typeof wheelSizes === 'string') {
        wheelSizes = wheelSizes.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      }
      
      // Build tire sizes array
      let tireSizes = vehicle.verifiedTireSizes || vehicle.tireSizes || vehicle.oemTireSizes;
      if (tireSizes && typeof tireSizes === 'string') {
        tireSizes = tireSizes.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      }
      
      // Update the record
      try {
        const result = await client.query(`
          UPDATE vehicle_fitments 
          SET 
            bolt_pattern = COALESCE($1, bolt_pattern),
            center_bore_mm = COALESCE($2, center_bore_mm),
            oem_wheel_sizes = COALESCE($3, oem_wheel_sizes),
            oem_tire_sizes = COALESCE($4, oem_tire_sizes),
            source = 'verified-research',
            last_verified_at = NOW(),
            updated_at = NOW()
          WHERE id = $5
        `, [
          boltPattern,
          hubBoreMm,
          wheelSizes,
          tireSizes,
          vehicle.id
        ]);
        
        if (result.rowCount > 0) {
          updated++;
        }
      } catch (dbErr) {
        console.error(`  DB error for ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${dbErr.message}`);
      }
    }
    
    console.log(`  → Updated: ${updated}, Skipped: ${skipped}, Flagged: ${flagged}`);
    totalUpdated += updated;
    totalSkipped += skipped;
    totalFlagged += flagged;
    
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    totalErrors++;
  }
}

console.log(`\n=== OVERNIGHT IMPORT COMPLETE ===`);
console.log(`Total Updated: ${totalUpdated}`);
console.log(`Total Skipped: ${totalSkipped}`);
console.log(`Total Flagged: ${totalFlagged}`);
console.log(`Total Errors: ${totalErrors}`);

await client.end();
