/**
 * EXPAND GROUPED TRIMS (FAST VERSION)
 * 
 * For each record with comma-separated display_trim,
 * create individual records for each trim.
 * 
 * Usage:
 *   node scripts/expand-grouped-trims-fast.mjs --dry-run
 *   node scripts/expand-grouped-trims-fast.mjs --execute
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
  console.log('Usage: node scripts/expand-grouped-trims-fast.mjs --dry-run | --execute');
  process.exit(1);
}

console.log(`\n=== EXPAND GROUPED TRIMS - FAST (${DRY_RUN ? 'DRY RUN' : '🚨 EXECUTING'}) ===\n`);

function generateModificationId(year, make, model, trim) {
  const normalizedTrim = trim.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const hash = crypto.createHash('md5')
    .update(`${year}-${make}-${model}-${trim}`)
    .digest('hex')
    .slice(0, 8);
  return `${make.toLowerCase()}-${model.toLowerCase()}-${normalizedTrim}-${hash}`;
}

function splitTrims(displayTrim) {
  if (!displayTrim) return [];
  
  // Split on comma, be careful with patterns like "2WD/4WD"
  const parts = displayTrim
    .split(/,\s*/)
    .map(s => s.trim())
    .filter(Boolean);
  
  return [...new Set(parts)];
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
    
    // Get all existing modification_ids for faster lookup
    const existingMods = await client.query(`
      SELECT year, LOWER(make) as make, LOWER(model) as model, modification_id
      FROM vehicle_fitments
    `);
    const existingSet = new Set(
      existingMods.rows.map(r => `${r.year}|${r.make}|${r.model}|${r.modification_id}`)
    );
    console.log(`Loaded ${existingSet.size} existing modification IDs for dedup\n`);
    
    const newRecords = [];
    let expandedCount = 0;
    
    for (const record of groupedRecords.rows) {
      const trims = splitTrims(record.display_trim);
      
      if (trims.length <= 1) continue;
      
      for (const trim of trims) {
        const modId = generateModificationId(record.year, record.make, record.model, trim);
        const key = `${record.year}|${record.make.toLowerCase()}|${record.model.toLowerCase()}|${modId}`;
        
        if (existingSet.has(key)) continue;
        existingSet.add(key); // Prevent duplicates in this run
        
        newRecords.push({
          year: record.year,
          make: record.make,
          model: record.model,
          modification_id: modId,
          raw_trim: trim,
          display_trim: trim,
          submodel: null,
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
      expandedCount++;
    }
    
    console.log(`Vehicles to expand: ${expandedCount}`);
    console.log(`New individual records to create: ${newRecords.length}\n`);
    
    // Show samples by make
    const byMake = {};
    for (const rec of newRecords) {
      byMake[rec.make] = (byMake[rec.make] || 0) + 1;
    }
    console.log('New records by make:');
    Object.entries(byMake)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([make, count]) => console.log(`  ${make}: ${count}`));
    
    // Show some Buick samples
    console.log('\nBuick samples:');
    newRecords
      .filter(r => r.make.toLowerCase() === 'buick')
      .slice(0, 10)
      .forEach(r => console.log(`  ${r.year} ${r.make} ${r.model}: ${r.display_trim}`));
    
    if (EXECUTE && newRecords.length > 0) {
      console.log(`\nInserting ${newRecords.length} records...`);
      
      let inserted = 0;
      let errors = 0;
      
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
          
          if (inserted % 500 === 0) {
            console.log(`  Inserted ${inserted}/${newRecords.length}...`);
          }
        } catch (err) {
          errors++;
          if (errors < 5) {
            console.error(`  Error: ${err.message}`);
          }
        }
      }
      
      console.log(`\n✅ Inserted ${inserted} new trim records (${errors} errors)`);
    }
    
    // Final stats
    const afterCount = await client.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`New records to create: ${newRecords.length}`);
    console.log(`Current total records: ${afterCount.rows[0].cnt}`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN - No changes made. Run with --execute to apply.');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
