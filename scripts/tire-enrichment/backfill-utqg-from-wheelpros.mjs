/**
 * Backfill UTQG from WheelPros Data
 * 
 * The wp_tires table has treadwear/traction/temperature in the raw JSON.
 * This script backfills tire_pattern_specs from that data.
 * 
 * Usage: node scripts/tire-enrichment/backfill-utqg-from-wheelpros.mjs [--dry-run]
 */

import pg from "pg";
import fs from "fs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("🔄 Backfilling UTQG from WheelPros data");
  console.log(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  // Get all patterns missing UTQG
  const missingQuery = `
    SELECT id, brand, pattern_name, pattern_key
    FROM tire_pattern_specs
    WHERE utqg IS NULL OR utqg = ''
  `;
  const missing = await pool.query(missingQuery);
  console.log(`Found ${missing.rows.length} patterns missing UTQG\n`);

  // Get all WheelPros UTQG data grouped by brand/pattern
  const wpDataQuery = `
    SELECT DISTINCT ON (brand_desc, tire_description)
      brand_desc as brand,
      tire_description as description,
      raw->>'treadwear' as treadwear,
      raw->>'traction' as traction,
      raw->>'temperature' as temperature,
      raw->>'utqg' as utqg
    FROM wp_tires
    WHERE raw->>'treadwear' IS NOT NULL 
       OR raw->>'utqg' IS NOT NULL
    ORDER BY brand_desc, tire_description, updated_at DESC
  `;
  const wpData = await pool.query(wpDataQuery);
  console.log(`Found ${wpData.rows.length} unique tire patterns in WheelPros with UTQG data\n`);

  // Build lookup map
  const wpMap = new Map();
  for (const row of wpData.rows) {
    const key = `${row.brand?.toLowerCase()}|${row.description?.toLowerCase()}`;
    wpMap.set(key, row);
    
    // Also index by partial pattern match
    if (row.description) {
      const words = row.description.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      for (const word of words) {
        const partialKey = `${row.brand?.toLowerCase()}|${word}`;
        if (!wpMap.has(partialKey)) {
          wpMap.set(partialKey, row);
        }
      }
    }
  }

  let updated = 0;
  let notFound = 0;
  const results = [];

  for (const pattern of missing.rows) {
    const brand = pattern.brand?.toLowerCase();
    const patternName = (pattern.pattern_name || pattern.pattern_key || "").toLowerCase();
    
    // Try exact match
    let match = null;
    for (const [key, data] of wpMap) {
      if (key.includes(brand) && key.includes(patternName)) {
        match = data;
        break;
      }
    }
    
    // Try fuzzy match on pattern name words
    if (!match && patternName) {
      const words = patternName.split(/[\s\/\-]+/).filter(w => w.length > 2);
      for (const word of words) {
        const partialKey = `${brand}|${word}`;
        if (wpMap.has(partialKey)) {
          match = wpMap.get(partialKey);
          break;
        }
      }
    }

    if (match && (match.treadwear || match.utqg)) {
      const utqg = match.utqg || [match.treadwear, match.traction, match.temperature].filter(Boolean).join(" ");
      
      console.log(`✅ ${pattern.brand} ${pattern.pattern_name || pattern.pattern_key}`);
      console.log(`   → UTQG: ${utqg} (from: ${match.description})`);
      
      results.push({
        id: pattern.id,
        brand: pattern.brand,
        pattern: pattern.pattern_name || pattern.pattern_key,
        utqg,
        treadwear: match.treadwear ? parseInt(match.treadwear) : null,
        traction: match.traction,
        temperature: match.temperature,
        source: "wheelpros",
        matchedFrom: match.description,
      });
      
      if (!dryRun) {
        await pool.query(`
          UPDATE tire_pattern_specs
          SET utqg = $1,
              treadwear = $2,
              traction = $3,
              temperature = $4,
              source = COALESCE(source, '') || ' utqg:wheelpros',
              updated_at = NOW()
          WHERE id = $5
        `, [utqg, match.treadwear ? parseInt(match.treadwear) : null, match.traction, match.temperature, pattern.id]);
      }
      
      updated++;
    } else {
      console.log(`❌ ${pattern.brand} ${pattern.pattern_name || pattern.pattern_key} - no WheelPros match`);
      notFound++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                       SUMMARY                              ");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Total missing:   ${missing.rows.length}`);
  console.log(`Found in WP:     ${updated}`);
  console.log(`Not found:       ${notFound}`);
  console.log(`Coverage now:    ${((538 + updated) / 709 * 100).toFixed(1)}% (was 75.9%)`);
  
  // Save results
  fs.writeFileSync(
    "scripts/tire-enrichment/wheelpros-backfill-results.json",
    JSON.stringify({ updated, notFound, results }, null, 2)
  );
  console.log("\n✅ Results saved to scripts/tire-enrichment/wheelpros-backfill-results.json");

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
