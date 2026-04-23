/**
 * Import wheel research results into the database
 * Updates oem_wheel_sizes and quality_tier for matching vehicles
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RESULTS_DIR = 'scripts/wheel-research/results';
const DRY_RUN = process.argv.includes('--dry-run');

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}\n`);

// Collect all results
const resultFiles = fs.readdirSync(RESULTS_DIR)
  .filter(f => f.endsWith('-results.json'))
  .sort();

console.log(`Found ${resultFiles.length} result files\n`);

let stats = {
  total: 0,
  updated: 0,
  skipped: 0,
  notFound: 0,
  errors: 0
};

for (const file of resultFiles) {
  const filePath = path.join(RESULTS_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  console.log(`Processing ${file} (${data.results?.length || 0} vehicles)...`);
  
  for (const vehicle of (data.results || [])) {
    stats.total++;
    
    // Skip failed/low confidence
    if (!vehicle.specs || vehicle.confidence === 'failed') {
      stats.skipped++;
      continue;
    }
    
    // Build oem_wheel_sizes array
    const wheelSizes = [];
    
    if (vehicle.specs.isStaggered && vehicle.specs.frontWheelSize && vehicle.specs.rearWheelSize) {
      // Staggered setup
      wheelSizes.push({
        diameter: vehicle.specs.frontWheelSize.diameter,
        width: vehicle.specs.frontWheelSize.width,
        offset: vehicle.specs.frontWheelSize.offset,
        position: 'front'
      });
      wheelSizes.push({
        diameter: vehicle.specs.rearWheelSize.diameter,
        width: vehicle.specs.rearWheelSize.width,
        offset: vehicle.specs.rearWheelSize.offset,
        position: 'rear'
      });
    } else if (vehicle.specs.wheelSizes && vehicle.specs.wheelSizes.length > 0) {
      // Standard setup - may have multiple options
      for (const ws of vehicle.specs.wheelSizes) {
        wheelSizes.push({
          diameter: ws.diameter,
          width: ws.width,
          offset: ws.offset,
          position: 'both'
        });
      }
    }
    
    if (wheelSizes.length === 0) {
      stats.skipped++;
      continue;
    }
    
    // Find matching records in DB (case-insensitive)
    const { rows: existing } = await client.query(`
      SELECT id, oem_wheel_sizes, quality_tier
      FROM vehicle_fitments
      WHERE year = $1 
        AND LOWER(make) = LOWER($2)
        AND LOWER(model) = LOWER($3)
    `, [vehicle.year, vehicle.make, vehicle.model]);
    
    if (existing.length === 0) {
      stats.notFound++;
      continue;
    }
    
    // Update each matching record
    for (const row of existing) {
      // Skip if already has wheel data and is marked complete
      if (row.quality_tier === 'complete' && 
          row.oem_wheel_sizes && 
          row.oem_wheel_sizes.length > 0 &&
          row.oem_wheel_sizes[0].offset !== undefined) {
        stats.skipped++;
        continue;
      }
      
      if (!DRY_RUN) {
        try {
          // Also update bolt pattern and center bore if we have them
          let updateQuery = `
            UPDATE vehicle_fitments 
            SET oem_wheel_sizes = $1,
                quality_tier = 'complete',
                source = COALESCE(source, '') || ' [web_research]'
          `;
          let params = [JSON.stringify(wheelSizes)];
          let paramIndex = 2;
          
          if (vehicle.specs.boltPattern) {
            // Store bolt pattern as-is (e.g., "5x114.3")
            updateQuery += `, bolt_pattern = $${paramIndex}`;
            params.push(vehicle.specs.boltPattern);
            paramIndex++;
          }
          
          if (vehicle.specs.centerBore) {
            updateQuery += `, center_bore_mm = $${paramIndex}`;
            params.push(vehicle.specs.centerBore);
            paramIndex++;
          }
          
          updateQuery += ` WHERE id = $${paramIndex}`;
          params.push(row.id);
          
          await client.query(updateQuery, params);
          stats.updated++;
        } catch (err) {
          console.error(`  Error updating ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${err.message}`);
          stats.errors++;
        }
      } else {
        stats.updated++;
      }
    }
  }
}

console.log('\n' + '='.repeat(50));
console.log('IMPORT SUMMARY');
console.log('='.repeat(50));
console.log(`Total vehicles in results: ${stats.total}`);
console.log(`Updated records: ${stats.updated}`);
console.log(`Skipped (no data/already complete): ${stats.skipped}`);
console.log(`Not found in DB: ${stats.notFound}`);
console.log(`Errors: ${stats.errors}`);

if (DRY_RUN) {
  console.log('\n⚠️  DRY RUN - No changes made. Run without --dry-run to apply.');
}

await client.end();
