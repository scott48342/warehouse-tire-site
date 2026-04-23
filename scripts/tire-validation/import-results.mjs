/**
 * Import tire validation + trim enrichment results
 * Updates oem_tire_sizes and populates trim_fitments table
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RESULTS_DIR = 'scripts/tire-validation/results';
const DRY_RUN = process.argv.includes('--dry-run');

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}\n`);

const resultFiles = fs.readdirSync(RESULTS_DIR)
  .filter(f => f.endsWith('-results.json'))
  .sort();

console.log(`Found ${resultFiles.length} result files\n`);

let stats = {
  total: 0,
  tiresUpdated: 0,
  trimsAdded: 0,
  trimsSkipped: 0,
  notFound: 0,
  errors: 0
};

for (const file of resultFiles) {
  const filePath = path.join(RESULTS_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  console.log(`Processing ${file}...`);
  
  for (const vehicle of (data.results || [])) {
    stats.total++;
    
    // Find matching fitment record
    const { rows: existing } = await client.query(`
      SELECT id, oem_tire_sizes
      FROM vehicle_fitments
      WHERE year = $1 
        AND LOWER(make) = LOWER($2)
        AND LOWER(model) = LOWER($3)
      LIMIT 1
    `, [vehicle.year, vehicle.make, vehicle.model]);
    
    if (existing.length === 0) {
      stats.notFound++;
      continue;
    }
    
    const fitmentId = existing[0].id;
    
    // Update base tire sizes if provided
    if (vehicle.tireSizes && vehicle.tireSizes.length > 0) {
      if (!DRY_RUN) {
        try {
          await client.query(`
            UPDATE vehicle_fitments 
            SET oem_tire_sizes = $1
            WHERE id = $2
          `, [JSON.stringify(vehicle.tireSizes), fitmentId]);
          stats.tiresUpdated++;
        } catch (err) {
          console.error(`  Tire update error: ${err.message}`);
          stats.errors++;
        }
      } else {
        stats.tiresUpdated++;
      }
    }
    
    // Add trim-specific fitments
    if (vehicle.trims && vehicle.trims.length > 0) {
      for (const trim of vehicle.trims) {
        if (!DRY_RUN) {
          try {
            // Upsert trim fitment
            await client.query(`
              INSERT INTO trim_fitments (
                fitment_id, trim,
                wheel_diameter, wheel_width, wheel_offset,
                tire_size,
                is_staggered,
                front_wheel_diameter, front_wheel_width, front_wheel_offset, front_tire_size,
                rear_wheel_diameter, rear_wheel_width, rear_wheel_offset, rear_tire_size,
                source, confidence, notes
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
              ON CONFLICT (fitment_id, trim) DO UPDATE SET
                wheel_diameter = EXCLUDED.wheel_diameter,
                wheel_width = EXCLUDED.wheel_width,
                wheel_offset = EXCLUDED.wheel_offset,
                tire_size = EXCLUDED.tire_size,
                is_staggered = EXCLUDED.is_staggered,
                front_wheel_diameter = EXCLUDED.front_wheel_diameter,
                front_wheel_width = EXCLUDED.front_wheel_width,
                front_wheel_offset = EXCLUDED.front_wheel_offset,
                front_tire_size = EXCLUDED.front_tire_size,
                rear_wheel_diameter = EXCLUDED.rear_wheel_diameter,
                rear_wheel_width = EXCLUDED.rear_wheel_width,
                rear_wheel_offset = EXCLUDED.rear_wheel_offset,
                rear_tire_size = EXCLUDED.rear_tire_size,
                source = EXCLUDED.source,
                confidence = EXCLUDED.confidence,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
            `, [
              fitmentId,
              trim.trim,
              trim.wheelSize?.diameter || trim.wheel_diameter || null,
              trim.wheelSize?.width || trim.wheel_width || null,
              trim.wheelSize?.offset || trim.wheel_offset || null,
              trim.tireSize || trim.tire_size || null,
              trim.isStaggered || trim.is_staggered || false,
              trim.frontWheelSize?.diameter || trim.front_wheel_diameter || null,
              trim.frontWheelSize?.width || trim.front_wheel_width || null,
              trim.frontWheelSize?.offset || trim.front_wheel_offset || null,
              trim.frontTireSize || trim.front_tire_size || null,
              trim.rearWheelSize?.diameter || trim.rear_wheel_diameter || null,
              trim.rearWheelSize?.width || trim.rear_wheel_width || null,
              trim.rearWheelSize?.offset || trim.rear_wheel_offset || null,
              trim.rearTireSize || trim.rear_tire_size || null,
              vehicle.source || null,
              trim.confidence || vehicle.confidence || 'medium',
              trim.notes || null
            ]);
            stats.trimsAdded++;
          } catch (err) {
            console.error(`  Trim insert error: ${err.message}`);
            stats.errors++;
          }
        } else {
          stats.trimsAdded++;
        }
      }
    }
  }
}

console.log('\n' + '='.repeat(50));
console.log('IMPORT SUMMARY');
console.log('='.repeat(50));
console.log(`Total vehicles processed: ${stats.total}`);
console.log(`Tire sizes updated: ${stats.tiresUpdated}`);
console.log(`Trim fitments added/updated: ${stats.trimsAdded}`);
console.log(`Not found in DB: ${stats.notFound}`);
console.log(`Errors: ${stats.errors}`);

if (DRY_RUN) {
  console.log('\n⚠️  DRY RUN - No changes made.');
}

await client.end();
