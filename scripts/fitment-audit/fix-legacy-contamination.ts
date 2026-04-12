/**
 * Fix Legacy Contamination - Targeted Cleanup
 * 
 * Removes tire sizes that are clearly from older generations.
 * ONLY targets cases where the minimum diameter is definitely wrong.
 * 
 * Usage: npx tsx scripts/fitment-audit/fix-legacy-contamination.ts [--dry-run]
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP RULES - Only truly wrong sizes
// ═══════════════════════════════════════════════════════════════════════════

interface CleanupRule {
  make: string;
  model: string;
  minYear: number;       // Apply from this year forward
  maxYear?: number;      // Optional: only apply up to this year
  removeBelow: number;   // Remove tire sizes with diameter < this
  reason: string;        // Documentation
}

const CLEANUP_RULES: CleanupRule[] = [
  // MX-5 Miata ND generation (2016+) - minimum is 17"
  // The 16" sizes (195/50R16) are from NC generation (2006-2015)
  {
    make: "mazda",
    model: "mx-5-miata",
    minYear: 2016,
    removeBelow: 17,
    reason: "ND generation (2016+) minimum is 17\", 16\" sizes from NC gen"
  },
  
  // BMW 3-Series G20 generation (2019+) - minimum is 17"
  // The 16" sizes (205/60R16) are from F30 generation (2012-2018)
  {
    make: "bmw",
    model: "3-series",
    minYear: 2019,
    removeBelow: 17,
    reason: "G20 generation (2019+) minimum is 17\", 16\" sizes from F30 gen"
  },
  
  // Corvette C5 (1997-2004) - minimum is 17"
  // The 15" sizes are from C4 generation (1984-1996)
  {
    make: "chevrolet",
    model: "corvette",
    minYear: 1997,
    maxYear: 2004,
    removeBelow: 17,
    reason: "C5 generation (1997-2004) minimum is 17\", 15\" sizes from C4 gen"
  },
  
  // Corvette C6 (2005-2013) - minimum is 18"
  {
    make: "chevrolet",
    model: "corvette",
    minYear: 2005,
    maxYear: 2013,
    removeBelow: 18,
    reason: "C6 generation (2005-2013) minimum is 18\""
  },
  
  // Corvette C7 (2014-2019) - minimum is 18"
  {
    make: "chevrolet",
    model: "corvette",
    minYear: 2014,
    maxYear: 2019,
    removeBelow: 18,
    reason: "C7 generation (2014-2019) minimum is 18\""
  },
  
  // Corvette C8 (2020+) - minimum is 19"
  {
    make: "chevrolet",
    model: "corvette",
    minYear: 2020,
    removeBelow: 19,
    reason: "C8 generation (2020+) minimum is 19\""
  },
  
  // NOTE: The following are NOT legacy contamination - they have legitimate 17" base options:
  // - Subaru WRX (2022+ VB has 17" base)
  // - Subaru BRZ (2022+ has 17" base) 
  // - Toyota GR86 (has 17" base)
  // - Ford Mustang EcoBoost (17" is valid base)
  // - Dodge Challenger SXT (17" is valid base)
  // - Dodge Charger SXT (17" is valid base)
];

// ═══════════════════════════════════════════════════════════════════════════

function extractRimDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).toUpperCase().match(/R(\d{2}(?:\.\d)?)/);
  if (match) return Math.floor(parseFloat(match[1]));
  return null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║          FIX LEGACY CONTAMINATION - TARGETED CLEANUP           ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE (will modify data)"}`);
  console.log(`Rules: ${CLEANUP_RULES.length} targeted cleanup rules\n`);

  const results: Array<{
    rule: CleanupRule;
    recordsFound: number;
    recordsFixed: number;
    sizesRemoved: string[];
  }> = [];

  try {
    for (const rule of CLEANUP_RULES) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 ${rule.make}/${rule.model} (${rule.minYear}${rule.maxYear ? `-${rule.maxYear}` : "+"})`);
      console.log(`   Remove diameters < ${rule.removeBelow}"`);
      console.log(`   Reason: ${rule.reason}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Query for matching records
      const yearCondition = rule.maxYear 
        ? `year >= ${rule.minYear} AND year <= ${rule.maxYear}`
        : `year >= ${rule.minYear}`;
        
      const query = `
        SELECT id, year, make, model, display_trim, oem_tire_sizes, source
        FROM vehicle_fitments
        WHERE make = $1 AND model = $2 AND ${yearCondition}
        ORDER BY year, display_trim
      `;
      
      const { rows } = await pool.query(query, [rule.make, rule.model]);
      
      let recordsFixed = 0;
      const sizesRemoved: string[] = [];
      
      for (const row of rows) {
        const tireSizes: string[] = row.oem_tire_sizes || [];
        const badSizes = tireSizes.filter(s => {
          const d = extractRimDiameter(s);
          return d !== null && d < rule.removeBelow;
        });
        
        if (badSizes.length > 0) {
          const goodSizes = tireSizes.filter(s => {
            const d = extractRimDiameter(s);
            return d === null || d >= rule.removeBelow;
          });
          
          console.log(`  ${row.year} ${row.display_trim}`);
          console.log(`    Remove: ${badSizes.join(", ")}`);
          console.log(`    Keep:   ${goodSizes.join(", ") || "(empty - will need sizes)"}`);
          
          sizesRemoved.push(...badSizes);
          
          if (!dryRun && goodSizes.length > 0) {
            // Only update if we have remaining sizes
            await pool.query(
              `UPDATE vehicle_fitments 
               SET oem_tire_sizes = $1::jsonb, 
                   source = $2,
                   updated_at = NOW()
               WHERE id = $3`,
              [JSON.stringify(goodSizes), `cleanup_legacy_${rule.make}_${rule.model}`, row.id]
            );
            recordsFixed++;
          } else if (!dryRun && goodSizes.length === 0) {
            console.log(`    ⚠️  SKIPPED: Would leave record with no sizes`);
          }
        }
      }
      
      results.push({
        rule,
        recordsFound: rows.length,
        recordsFixed: dryRun ? 0 : recordsFixed,
        sizesRemoved: [...new Set(sizesRemoved)]
      });
      
      console.log(`\n  📊 Found: ${rows.length} records, Fixed: ${dryRun ? "N/A (dry run)" : recordsFixed}`);
    }
    
    // Summary
    console.log("\n\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                           SUMMARY                               ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
    
    let totalFixed = 0;
    for (const r of results) {
      console.log(`${r.rule.make}/${r.rule.model}:`);
      console.log(`  Records found: ${r.recordsFound}`);
      console.log(`  Records fixed: ${r.recordsFixed}`);
      console.log(`  Sizes removed: ${r.sizesRemoved.join(", ") || "none"}`);
      totalFixed += r.recordsFixed;
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`TOTAL RECORDS FIXED: ${totalFixed}`);
    if (dryRun) {
      console.log(`\n💡 Run without --dry-run to apply changes`);
    }
    
    // Save results
    const logFile = path.resolve(__dirname, "legacy-cleanup-log.json");
    await fs.writeFile(logFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      dryRun,
      results,
      totalFixed
    }, null, 2));
    console.log(`\n📄 Log saved to: ${logFile}`);
    
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
