/**
 * EXPAND GROUPED TRIMS
 * 
 * Problem: Many records have display_trim like "Base, Preferred, Essence, Avenir"
 * but we need separate records for each trim to enable proper filtering.
 * 
 * Solution: For each grouped trim, create individual records copying the fitment data.
 * 
 * Usage:
 *   node scripts/expand-grouped-trims.mjs --dry-run
 *   node scripts/expand-grouped-trims.mjs --execute
 */

import pg from "pg";
import fs from "fs";
import crypto from "crypto";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

if (!DRY_RUN && !EXECUTE) {
  console.log('Usage: node scripts/expand-grouped-trims.mjs --dry-run | --execute');
  process.exit(1);
}

console.log(`\n=== EXPAND GROUPED TRIMS (${DRY_RUN ? 'DRY RUN' : '🚨 EXECUTING'}) ===\n`);

/**
 * Generate a unique modification ID for a new trim record
 */
function generateModificationId(year, make, model, trim) {
  const normalizedTrim = trim.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const hash = crypto.createHash('md5')
    .update(`${year}-${make}-${model}-${trim}`)
    .digest('hex')
    .slice(0, 8);
  return `${make.toLowerCase()}-${model.toLowerCase()}-${normalizedTrim}-${hash}`;
}

/**
 * Split a display_trim into individual trims
 */
function splitTrims(displayTrim) {
  if (!displayTrim) return [];
  
  // Split on comma or slash, but be careful with patterns like "3/4 Ton"
  const parts = displayTrim
    .split(/,\s*/)
    .flatMap(part => {
      // Don't split "2WD/4WD" or "3/4 Ton" type patterns
      if (part.match(/^\d+\/\d+/) || part.match(/WD\/\d*WD/) || part.match(/\d+[A-Za-z]\/\d+[A-Za-z]/)) {
        return [part];
      }
      // Split on " / " (with spaces) but not just "/"
      return part.split(/\s*\/\s*/).filter(Boolean);
    })
    .map(s => s.trim())
    .filter(Boolean);
  
  return [...new Set(parts)]; // Dedupe
}

async function main() {
  const client = await pool.connect();
  
  try {
    // Find all records with grouped trims (contain comma)
    const groupedRecords = await client.query(`
      SELECT * FROM vehicle_fitments
      WHERE display_trim LIKE '%,%'
      ORDER BY year DESC, make, model
    `);
    
    console.log(`Found ${groupedRecords.rows.length} records with grouped trims\n`);
    
    let totalNewRecords = 0;
    let expandedVehicles = [];
    const newRecords = [];
    
    for (const record of groupedRecords.rows) {
      const trims = splitTrims(record.display_trim);
      
      if (trims.length <= 1) continue; // Nothing to split
      
      const expansions = [];
      
      for (const trim of trims) {
        // Skip if we already have this exact trim as a separate record
        const existing = await client.query(`
          SELECT id FROM vehicle_fitments
          WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
            AND display_trim = $4
          LIMIT 1
        `, [record.year, record.make, record.model, trim]);
        
        if (existing.rows.length > 0) continue;
        
        const modId = generateModificationId(record.year, record.make, record.model, trim);
        
        expansions.push({
          trim,
          modificationId: modId
        });
        
        newRecords.push({
          year: record.year,
          make: record.make,
          model: record.model,
          modification_id: modId,
          raw_trim: trim,
          display_trim: trim,
          submodel: null, // Could populate if we had submodel data
          bolt_pattern: record.bolt_pattern,
          center_bore_mm: record.center_bore_mm,
          thread_size: record.thread_size,
          seat_type: record.seat_type,
          offset_min_mm: record.offset_min_mm,
          offset_max_mm: record.offset_max_mm,
          oem_wheel_sizes: record.oem_wheel_sizes,
          oem_tire_sizes: record.oem_tire_sizes,
          source: record.source + ' [trim-expanded]',
          quality_tier: record.quality_tier
        });
      }
      
      if (expansions.length > 0) {
        totalNewRecords += expansions.length;
        expandedVehicles.push({
          vehicle: `${record.year} ${record.make} ${record.model}`,
          original: record.display_trim,
          created: expansions.map(e => e.trim)
        });
      }
    }
    
    console.log(`Will create ${totalNewRecords} new individual trim records\n`);
    
    // Show samples
    console.log('Sample expansions:');
    for (const ev of expandedVehicles.slice(0, 15)) {
      console.log(`  ${ev.vehicle}:`);
      console.log(`    From: "${ev.original}"`);
      console.log(`    Creates: ${ev.created.join(', ')}`);
    }
    
    if (EXECUTE && newRecords.length > 0) {
      console.log(`\nInserting ${newRecords.length} records...`);
      
      let inserted = 0;
      for (const rec of newRecords) {
        try {
          await client.query(`
            INSERT INTO vehicle_fitments (
              year, make, model, modification_id, raw_trim, display_trim, submodel,
              bolt_pattern, center_bore_mm, thread_size, seat_type,
              offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
              source, quality_tier, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11,
              $12, $13, $14::jsonb, $15::jsonb,
              $16, $17, NOW(), NOW()
            )
            ON CONFLICT (year, make, model, modification_id) DO NOTHING
          `, [
            rec.year, rec.make, rec.model, rec.modification_id, rec.raw_trim, rec.display_trim, rec.submodel,
            rec.bolt_pattern, rec.center_bore_mm, rec.thread_size, rec.seat_type,
            rec.offset_min_mm, rec.offset_max_mm,
            JSON.stringify(rec.oem_wheel_sizes), JSON.stringify(rec.oem_tire_sizes),
            rec.source, rec.quality_tier
          ]);
          inserted++;
        } catch (err) {
          console.error(`  Error inserting ${rec.year} ${rec.make} ${rec.model} ${rec.display_trim}: ${err.message}`);
        }
      }
      
      console.log(`\n✅ Inserted ${inserted} new trim records`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Records with grouped trims: ${groupedRecords.rows.length}`);
    console.log(`Vehicles expanded: ${expandedVehicles.length}`);
    console.log(`New individual records: ${totalNewRecords}`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN - No changes made. Run with --execute to apply.');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
