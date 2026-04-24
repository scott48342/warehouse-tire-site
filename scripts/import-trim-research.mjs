/**
 * Import verified trim research data into vehicle_fitments database
 * 
 * Reads JSON files from scripts/trim-research/completed/[Make]/[Model].json
 * Updates or creates records with accurate trim-level wheel/tire data
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

const COMPLETED_DIR = "scripts/trim-research/completed";

const stats = {
  filesProcessed: 0,
  trimsProcessed: 0,
  recordsCreated: 0,
  recordsUpdated: 0,
  errors: []
};

function generateModificationId(year, make, model, trim) {
  const normalizedTrim = trim.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const hash = crypto.createHash('md5')
    .update(`${year}-${make}-${model}-${trim}`)
    .digest('hex')
    .slice(0, 8);
  return `${make.toLowerCase()}-${model.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${normalizedTrim}-${hash}`;
}

function parseWheelSizes(wheelSizes) {
  if (!wheelSizes || !Array.isArray(wheelSizes)) return [];
  return wheelSizes.map(w => {
    if (typeof w === 'object') {
      return { diameter: w.diameter, width: w.width || null };
    }
    // Parse string like "18x8" or just "18"
    const match = String(w).match(/(\d+)(?:x([\d.]+))?/);
    if (match) {
      return { diameter: parseInt(match[1]), width: match[2] ? parseFloat(match[2]) : null };
    }
    return null;
  }).filter(Boolean);
}

function parseTireSizes(tireSizes) {
  if (!tireSizes || !Array.isArray(tireSizes)) return [];
  return tireSizes.filter(t => typeof t === 'string' && t.match(/\d+\/\d+R\d+/i));
}

async function importFile(client, filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    stats.errors.push(`Failed to parse ${filePath}: ${e.message}`);
    return;
  }
  
  const make = data.make;
  const model = data.model;
  
  // Handle multiple formats:
  // 1. { years: [ {year: 2024, trims: [...]} ] } - array format
  // 2. { years: { "2024": { trims: [...] } } } - object format (Honda)
  // 3. { year: 2024, trims: [...] } - simple format
  // 4. { trims: [...] } - no year specified
  
  let years = [];
  
  if (Array.isArray(data.years)) {
    years = data.years;
  } else if (data.years && typeof data.years === 'object') {
    // Object format: { "2024": { trims: [...] }, "2025": { trims: [...] } }
    for (const [yearStr, yearData] of Object.entries(data.years)) {
      const year = parseInt(yearStr);
      if (!isNaN(year) && yearData.trims) {
        years.push({ year, trims: yearData.trims });
      }
    }
  } else if (data.year && data.trims) {
    years.push({ year: data.year, trims: data.trims });
  } else if (data.trims) {
    years.push({ year: 2024, trims: data.trims });
  }
  
  for (const yearData of years) {
    const year = yearData.year;
    const trims = yearData.trims || [];
    
    for (const trim of trims) {
      const trimName = trim.name || trim.trim;
      if (!trimName) continue;
      
      // Skip trims marked as needing verification with no real data
      if (trim.needs_verification && (!trim.tireSizes || trim.tireSizes.length === 0)) {
        continue;
      }
      
      const wheelSizes = parseWheelSizes(trim.wheelSizes);
      const tireSizes = parseTireSizes(trim.tireSizes);
      
      if (tireSizes.length === 0 && wheelSizes.length === 0) {
        continue; // Skip empty records
      }
      
      const modificationId = generateModificationId(year, make, model, trimName);
      
      // Check if record exists
      const existing = await client.query(`
        SELECT id, oem_tire_sizes, oem_wheel_sizes 
        FROM vehicle_fitments 
        WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3) 
          AND (modification_id = $4 OR LOWER(display_trim) = LOWER($5))
        LIMIT 1
      `, [year, make, model, modificationId, trimName]);
      
      const oemWheelSizes = wheelSizes.map(w => ({
        diameter: w.diameter,
        width: w.width
      }));
      
      if (existing.rows.length > 0) {
        // Update existing record
        await client.query(`
          UPDATE vehicle_fitments 
          SET display_trim = $1,
              raw_trim = $1,
              oem_tire_sizes = $2::jsonb,
              oem_wheel_sizes = $3::jsonb,
              source = 'verified-research',
              quality_tier = 'complete',
              updated_at = NOW()
          WHERE id = $4
        `, [trimName, JSON.stringify(tireSizes), JSON.stringify(oemWheelSizes), existing.rows[0].id]);
        stats.recordsUpdated++;
      } else {
        // Get base fitment data from same model
        const baseFitment = await client.query(`
          SELECT bolt_pattern, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm
          FROM vehicle_fitments 
          WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
          LIMIT 1
        `, [year, make, model]);
        
        const base = baseFitment.rows[0] || {};
        
        // Create new record
        await client.query(`
          INSERT INTO vehicle_fitments (
            year, make, model, modification_id, raw_trim, display_trim,
            bolt_pattern, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm,
            oem_wheel_sizes, oem_tire_sizes, source, quality_tier, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $5,
            $6, $7, $8, $9, $10, $11,
            $12::jsonb, $13::jsonb, 'verified-research', 'complete', NOW(), NOW()
          )
          ON CONFLICT (year, make, model, modification_id) DO UPDATE SET
            display_trim = EXCLUDED.display_trim,
            oem_tire_sizes = EXCLUDED.oem_tire_sizes,
            oem_wheel_sizes = EXCLUDED.oem_wheel_sizes,
            quality_tier = 'complete',
            updated_at = NOW()
        `, [
          year, make, model, modificationId, trimName,
          base.bolt_pattern, base.center_bore_mm, base.thread_size, base.seat_type, 
          base.offset_min_mm, base.offset_max_mm,
          JSON.stringify(oemWheelSizes), JSON.stringify(tireSizes)
        ]);
        stats.recordsCreated++;
      }
      
      stats.trimsProcessed++;
    }
  }
  
  stats.filesProcessed++;
}

async function main() {
  console.log('=== IMPORTING VERIFIED TRIM RESEARCH ===\n');
  
  const client = await pool.connect();
  
  try {
    // Find all JSON files
    const makes = fs.readdirSync(COMPLETED_DIR).filter(f => 
      fs.statSync(path.join(COMPLETED_DIR, f)).isDirectory()
    );
    
    console.log(`Found ${makes.length} makes to process\n`);
    
    for (const make of makes) {
      const makeDir = path.join(COMPLETED_DIR, make);
      const files = fs.readdirSync(makeDir).filter(f => f.endsWith('.json'));
      
      console.log(`Processing ${make}: ${files.length} models`);
      
      for (const file of files) {
        const filePath = path.join(makeDir, file);
        try {
          await importFile(client, filePath);
          process.stdout.write('.');
        } catch (e) {
          stats.errors.push(`${make}/${file}: ${e.message}`);
          process.stdout.write('x');
        }
      }
      console.log();
    }
    
    // Final count
    const finalCount = await client.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
    
    console.log('\n' + '='.repeat(60));
    console.log('IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`Files processed: ${stats.filesProcessed}`);
    console.log(`Trims processed: ${stats.trimsProcessed}`);
    console.log(`Records created: ${stats.recordsCreated}`);
    console.log(`Records updated: ${stats.recordsUpdated}`);
    console.log(`Total records in DB: ${finalCount.rows[0].cnt}`);
    
    if (stats.errors.length > 0) {
      console.log(`\nErrors (${stats.errors.length}):`);
      stats.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
      if (stats.errors.length > 10) console.log(`  ... and ${stats.errors.length - 10} more`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
