import pg from 'pg';
import { config } from 'dotenv';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const resultsDir = './scripts/90s-research/results';

// Only process the new batch files
const NEW_BATCHES = [
  'batch-17-chevy-trucks.json',
  'batch-18-ford-trucks.json',
  'batch-19-mopar.json',
  'batch-20-gm-luxury.json',
  'batch-21-german.json',
  'batch-22-euro-luxury.json',
];

function parseYearRange(yearRange) {
  if (!yearRange) return [];
  
  // Handle "1990-1999" format
  if (yearRange.includes('-')) {
    const [start, end] = yearRange.split('-').map(y => parseInt(y.trim()));
    const years = [];
    for (let y = start; y <= end; y++) {
      years.push(y);
    }
    return years;
  }
  
  // Handle single year
  const year = parseInt(yearRange);
  return isNaN(year) ? [] : [year];
}

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const client = await pool.connect();
  
  if (dryRun) console.log('=== DRY RUN MODE ===\n');
  
  try {
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const file of NEW_BATCHES) {
      const filePath = join(resultsDir, file);
      console.log(`\nProcessing ${file}...`);
      
      let data;
      try {
        data = JSON.parse(readFileSync(filePath, 'utf8'));
      } catch (e) {
        console.log(`  Skipping - file not found or invalid`);
        continue;
      }
      
      const results = data.results || [];
      
      for (const item of results) {
        if (item.status !== 'complete') {
          skipped++;
          continue;
        }
        
        const { make, model, data: fitment, confidence, sources, notes, year_range, year, submodel } = item;
        
        if (!fitment || !fitment.bolt_pattern) {
          skipped++;
          continue;
        }
        
        // Handle both year and year_range formats
        let years = [];
        if (year) {
          years = [parseInt(year)];
        } else if (year_range) {
          years = parseYearRange(year_range);
        }
        
        if (years.length === 0 || years.some(y => isNaN(y))) {
          console.log(`  No valid years for ${make} ${model}: year=${year}, year_range=${year_range}`);
          skipped++;
          continue;
        }
        
        for (const year of years) {
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
                existing.rows[0].id
              ]);
            }
            updated++;
          } else {
            // Insert new
            if (!dryRun) {
              const modificationId = `${year}-${make.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, '-')}-base`;
              const displayTrim = submodel || 'Base';
              
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
                displayTrim,
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
    }
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`New records: ${imported}`);
    console.log(`Updated records: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    
    if (dryRun) console.log('\n(Dry run - no changes made)');
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
