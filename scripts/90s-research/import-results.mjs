import pg from 'pg';
import { config } from 'dotenv';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const resultsDir = './scripts/90s-research/results';

// Manual overrides
const SKIP_VEHICLES = [
  { year: 1991, make: 'subaru', model: 'svx' },  // US started 1992
  { year: 1999, make: 'mazda', model: 'mpv' },   // No 1999 US model
];

function shouldSkip(vehicle) {
  return SKIP_VEHICLES.some(s => 
    s.year === vehicle.year && 
    s.make.toLowerCase() === vehicle.make.toLowerCase() && 
    s.model.toLowerCase() === vehicle.model.toLowerCase()
  );
}

async function main() {
  const client = await pool.connect();
  const dryRun = process.argv.includes('--dry-run');
  
  if (dryRun) console.log('=== DRY RUN MODE ===\n');
  
  try {
    const files = readdirSync(resultsDir).filter(f => f.startsWith('batch-') && f.endsWith('.json')).sort();
    
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    let errors = [];
    
    for (const file of files) {
      console.log(`\nProcessing ${file}...`);
      const data = JSON.parse(readFileSync(join(resultsDir, file), 'utf8'));
      const results = data.results || [];
      
      for (const item of results) {
        // Skip DNE/invalid entries
        if (item.status !== 'complete') {
          skipped++;
          continue;
        }
        
        // Skip manual overrides
        if (shouldSkip(item)) {
          console.log(`  Skipping (manual override): ${item.year} ${item.make} ${item.model}`);
          skipped++;
          continue;
        }
        
        const { year, make, model, data: fitment, confidence, sources, notes } = item;
        
        if (!fitment || !fitment.bolt_pattern) {
          console.log(`  Missing data: ${year} ${make} ${model}`);
          skipped++;
          continue;
        }
        
        // Check if exists
        const existing = await client.query(
          `SELECT id, quality_tier FROM vehicle_fitments 
           WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)`,
          [year, make, model]
        );
        
        const qualityTier = confidence === 'high' ? 'complete' : 'partial';
        
        const oemWheelSizes = JSON.stringify(fitment.oem_wheel_sizes || []);
        const oemTireSizes = JSON.stringify(fitment.oem_tire_sizes || []);
        
        if (existing.rows.length > 0) {
          // Update existing
          const current = existing.rows[0];
          if (!dryRun) {
            await client.query(`
              UPDATE vehicle_fitments SET
                bolt_pattern = $1,
                center_bore_mm = $2,
                oem_wheel_sizes = $3,
                oem_tire_sizes = $4,
                quality_tier = $5,
                updated_at = NOW()
              WHERE id = $6
            `, [
              fitment.bolt_pattern,
              fitment.hub_bore,
              oemWheelSizes,
              oemTireSizes,
              qualityTier,
              current.id
            ]);
          }
          updated++;
        } else {
          // Insert new
          if (!dryRun) {
            // Generate modification_id: year-make-model-base
            const modificationId = `${year}-${make.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, '-')}-base`;
            
            await client.query(`
              INSERT INTO vehicle_fitments (
                year, make, model, modification_id, display_trim, bolt_pattern, center_bore_mm,
                oem_wheel_sizes, oem_tire_sizes, quality_tier, source,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
            `, [
              year,
              make.toLowerCase(),
              model,
              modificationId,
              'Base',  // display_trim
              fitment.bolt_pattern,
              fitment.hub_bore,
              oemWheelSizes,
              oemTireSizes,
              qualityTier,
              '90s-research-batch'
            ]);
          }
          imported++;
        }
      }
    }
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`New records: ${imported}`);
    console.log(`Updated records: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    if (errors.length) {
      console.log(`Errors: ${errors.length}`);
      errors.forEach(e => console.log(`  - ${e}`));
    }
    
    if (dryRun) {
      console.log('\n(Dry run - no changes made)');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
