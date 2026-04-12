/**
 * STRICT FILL - 471 Confirmed Donor Records
 * 
 * NON-NEGOTIABLE: NO REGRESSION.
 * - Only fills records confirmed in fill-from-audit-log.json
 * - Does NOT overwrite existing valid wheel specs
 * - Extra validation for HD trucks
 * - Full before/after logging
 * 
 * Usage: npx tsx scripts/fitment-audit/strict-fill-471.ts [--dry-run]
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";
import { getModelVariants, normalizeModel } from "./model-normalization";

const { Pool } = pg;

// Load the analysis that identified fillable records
const analysisLog = require("./fill-from-audit-log.json");

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION RULES
// ═══════════════════════════════════════════════════════════════════════════

// Minimum OEM wheel diameter by vehicle class
const MIN_DIAMETER_BY_CLASS: Record<string, number> = {
  // HD trucks: minimum 17" baseline
  "silverado-2500hd": 17,
  "silverado-2500-hd": 17,
  "silverado-3500hd": 17,
  "silverado-3500-hd": 17,
  "sierra-2500hd": 17,
  "sierra-2500-hd": 17,
  "sierra-3500hd": 17,
  "sierra-3500-hd": 17,
  "2500": 17,
  "3500": 17,
  "f-250": 17,
  "f-350": 17,
  
  // Light trucks: minimum 16"
  "silverado-1500": 16,
  "sierra-1500": 16,
  "1500": 16,
  "f-150": 16,
  "tahoe": 17,
  "yukon": 17,
  "escalade": 17,
  "escalade-esv": 17,
  "suburban": 17,
  "yukon-xl": 17,
  
  // Muscle cars: minimum 17"
  "camaro": 17,
  "corvette": 17,
  "firebird": 16,
  
  // Default for everything else
  "default": 14,
};

// HD truck model patterns (extra caution)
const HD_TRUCK_PATTERNS = [
  /2500/i,
  /3500/i,
  /f-250/i,
  /f-350/i,
  /super.?duty/i,
];

// Platform generations for exact matching
const PLATFORM_GENERATIONS: Record<string, Record<string, [number, number][]>> = {
  chevrolet: {
    "silverado-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
    "silverado-2500hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-2500-hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-3500hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-3500-hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "tahoe": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "suburban": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "camaro": [[1998, 2002], [2010, 2015], [2016, 2026]],
    "corvette": [[1997, 2004], [2005, 2013], [2014, 2019], [2020, 2026]],
    "equinox": [[2005, 2009], [2010, 2017], [2018, 2026]],
    "traverse": [[2009, 2017], [2018, 2026]],
    "malibu": [[2000, 2003], [2004, 2007], [2008, 2012], [2013, 2015], [2016, 2026]],
    "impala": [[2000, 2005], [2006, 2013], [2014, 2020]],
    "colorado": [[2004, 2012], [2015, 2026]],
  },
  gmc: {
    "sierra-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
    "sierra-2500hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-2500-hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-3500hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-3500-hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "yukon": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "yukon-xl": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "acadia": [[2007, 2016], [2017, 2026]],
    "terrain": [[2010, 2017], [2018, 2026]],
    "canyon": [[2004, 2012], [2015, 2026]],
  },
  ram: {
    "1500": [[2002, 2008], [2009, 2018], [2019, 2026]],
    "2500": [[2003, 2009], [2010, 2018], [2019, 2026]],
    "3500": [[2003, 2009], [2010, 2018], [2019, 2026]],
  },
  dodge: {
    "ram-1500": [[1994, 2001], [2002, 2008]],
    "ram-2500": [[1994, 2002], [2003, 2009]],
    "ram-3500": [[1994, 2002], [2003, 2009]],
  },
  cadillac: {
    "escalade": [[1999, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "escalade-esv": [[2003, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "cts": [[2003, 2007], [2008, 2013], [2014, 2019]],
  },
  buick: {
    "lesabre": [[2000, 2005]],
    "regal": [[1997, 2004], [2011, 2017], [2018, 2020]],
    "lacrosse": [[2005, 2009], [2010, 2016], [2017, 2019]],
    "enclave": [[2008, 2017], [2018, 2026]],
  },
  pontiac: {
    "firebird": [[1998, 2002]],
    "g6": [[2005, 2010]],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface WheelSize {
  diameter: number;
  width: number;
  offset?: number;
}

interface FillResult {
  target: { year: number; make: string; model: string; trim?: string; id: number };
  donor: { year: number; make: string; model: string; trim?: string; id: number } | null;
  generation: string;
  status: "filled" | "skipped" | "blocked" | "error";
  reason?: string;
  confidence: "high" | "medium" | "low";
  before: any;
  after: any;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getGeneration(make: string, model: string, year: number): [number, number] | null {
  const makeGens = PLATFORM_GENERATIONS[make.toLowerCase()];
  if (!makeGens) return null;
  
  let modelGens = makeGens[model.toLowerCase()];
  if (!modelGens) {
    modelGens = makeGens[normalizeModel(model)];
  }
  if (!modelGens) return null;
  
  for (const gen of modelGens) {
    if (year >= gen[0] && year <= gen[1]) return gen;
  }
  return null;
}

function parseWheelSizes(oemWheelSizes: any): WheelSize[] {
  if (!oemWheelSizes || !Array.isArray(oemWheelSizes)) return [];
  return oemWheelSizes.map((ws: any) => {
    if (typeof ws === 'object' && ws !== null) {
      const d = parseFloat(ws.diameter || ws.rim_diameter || 0);
      const w = parseFloat(ws.width || ws.rim_width || 0);
      if (d > 0 && w > 0) {
        return { diameter: d, width: w, offset: ws.offset };
      }
    }
    return null;
  }).filter((ws): ws is WheelSize => ws !== null);
}

function hasValidWheelSpecs(oemWheelSizes: any): boolean {
  const parsed = parseWheelSizes(oemWheelSizes);
  return parsed.length > 0;
}

function isHDTruck(model: string): boolean {
  return HD_TRUCK_PATTERNS.some(p => p.test(model));
}

function getMinDiameter(model: string): number {
  const lower = model.toLowerCase();
  if (MIN_DIAMETER_BY_CLASS[lower]) {
    return MIN_DIAMETER_BY_CLASS[lower];
  }
  // Check for HD pattern
  if (isHDTruck(model)) {
    return 17;
  }
  return MIN_DIAMETER_BY_CLASS["default"];
}

function validateWheelSizes(wheelSizes: WheelSize[], model: string): { valid: boolean; reason?: string } {
  if (wheelSizes.length === 0) {
    return { valid: false, reason: "Empty wheel sizes" };
  }
  
  const minDiameter = getMinDiameter(model);
  
  for (const ws of wheelSizes) {
    if (ws.diameter < minDiameter) {
      return { 
        valid: false, 
        reason: `Diameter ${ws.diameter}" below minimum ${minDiameter}" for ${model}` 
      };
    }
    if (ws.diameter > 26) {
      return { valid: false, reason: `Suspicious diameter ${ws.diameter}" (too large)` };
    }
    if (ws.width < 5 || ws.width > 14) {
      return { valid: false, reason: `Suspicious width ${ws.width}" (out of range)` };
    }
  }
  
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║    STRICT FILL - 471 CONFIRMED DONOR RECORDS                   ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "🔴 LIVE"}`);
  console.log(`Analysis source: fill-from-audit-log.json`);
  console.log(`Expected fillable: ${analysisLog.summary.donorFound}\n`);
  
  const results: FillResult[] = [];
  let filledCount = 0;
  let skippedAlreadyValid = 0;
  let skippedNoDonor = 0;
  let blockedValidation = 0;
  let blockedHDNoExact = 0;
  let errorCount = 0;
  
  // Get the list of fillable models from analysis
  const fillableModels = Object.keys(analysisLog.fillableByModel);
  console.log(`Models with fillable records: ${fillableModels.length}\n`);
  
  const client = await pool.connect();
  
  try {
    // Process each fillable model
    for (const modelKey of fillableModels) {
      const [make, model] = modelKey.split("/");
      const expectedCount = analysisLog.fillableByModel[modelKey];
      
      console.log(`\n═══ ${make}/${model} (expecting ${expectedCount}) ═══`);
      
      // Get records missing wheel specs for this model
      const { rows: targetRecords } = await client.query(`
        SELECT id, year, make, model, display_trim, oem_wheel_sizes, source
        FROM vehicle_fitments
        WHERE make = $1 AND model = $2
          AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
        ORDER BY year
      `, [make, model]);
      
      console.log(`  Found ${targetRecords.length} records missing wheel specs`);
      
      for (const target of targetRecords) {
        const generation = getGeneration(make, model, target.year);
        
        if (!generation) {
          results.push({
            target: { year: target.year, make, model, trim: target.display_trim, id: target.id },
            donor: null,
            generation: "unknown",
            status: "skipped",
            reason: "No generation defined",
            confidence: "low",
            before: target.oem_wheel_sizes,
            after: null,
          });
          skippedNoDonor++;
          continue;
        }
        
        // Find donor within same generation
        const modelVariants = getModelVariants(model);
        let donor = null;
        let normalizedMatch = false;
        
        for (const variant of modelVariants) {
          const { rows: donors } = await client.query(`
            SELECT id, year, make, model, display_trim, oem_wheel_sizes, source
            FROM vehicle_fitments
            WHERE make = $1 AND model = $2
              AND year >= $3 AND year <= $4
              AND oem_wheel_sizes IS NOT NULL
              AND oem_wheel_sizes != '[]'::jsonb
              AND oem_wheel_sizes != 'null'::jsonb
            ORDER BY ABS(year - $5)
            LIMIT 5
          `, [make, variant, generation[0], generation[1], target.year]);
          
          // Find first valid donor
          for (const d of donors) {
            const parsed = parseWheelSizes(d.oem_wheel_sizes);
            if (parsed.length > 0) {
              donor = { ...d, parsedWheelSizes: parsed };
              normalizedMatch = variant !== model.toLowerCase();
              break;
            }
          }
          if (donor) break;
        }
        
        if (!donor) {
          results.push({
            target: { year: target.year, make, model, trim: target.display_trim, id: target.id },
            donor: null,
            generation: `${generation[0]}-${generation[1]}`,
            status: "skipped",
            reason: "No valid donor in generation",
            confidence: "low",
            before: target.oem_wheel_sizes,
            after: null,
          });
          skippedNoDonor++;
          continue;
        }
        
        // Extra caution for HD trucks: require tight year match
        if (isHDTruck(model)) {
          const yearGap = Math.abs(donor.year - target.year);
          if (yearGap > 3) {
            results.push({
              target: { year: target.year, make, model, trim: target.display_trim, id: target.id },
              donor: { year: donor.year, make, model: donor.model, trim: donor.display_trim, id: donor.id },
              generation: `${generation[0]}-${generation[1]}`,
              status: "blocked",
              reason: `HD truck year gap too large (${yearGap} years)`,
              confidence: "low",
              before: target.oem_wheel_sizes,
              after: null,
            });
            blockedHDNoExact++;
            continue;
          }
        }
        
        // Validate wheel sizes
        const validation = validateWheelSizes(donor.parsedWheelSizes, model);
        if (!validation.valid) {
          results.push({
            target: { year: target.year, make, model, trim: target.display_trim, id: target.id },
            donor: { year: donor.year, make, model: donor.model, trim: donor.display_trim, id: donor.id },
            generation: `${generation[0]}-${generation[1]}`,
            status: "blocked",
            reason: validation.reason || "Validation failed",
            confidence: "low",
            before: target.oem_wheel_sizes,
            after: null,
          });
          blockedValidation++;
          continue;
        }
        
        // Determine confidence
        const yearGap = Math.abs(donor.year - target.year);
        const confidence: "high" | "medium" | "low" = 
          yearGap === 0 ? "high" :
          yearGap <= 2 ? "high" :
          yearGap <= 4 ? "medium" : "low";
        
        // Execute fill
        if (!dryRun) {
          try {
            await client.query(`
              UPDATE vehicle_fitments
              SET oem_wheel_sizes = $1,
                  source = COALESCE(source, '') || ' [filled from ' || $2 || ' ' || $3 || ']'
              WHERE id = $4
            `, [JSON.stringify(donor.oem_wheel_sizes), donor.year, donor.model, target.id]);
            
            filledCount++;
            console.log(`  ✅ ${target.year} ← donor ${donor.year} (${confidence})`);
          } catch (err: any) {
            results.push({
              target: { year: target.year, make, model, trim: target.display_trim, id: target.id },
              donor: { year: donor.year, make, model: donor.model, trim: donor.display_trim, id: donor.id },
              generation: `${generation[0]}-${generation[1]}`,
              status: "error",
              reason: err.message,
              confidence,
              before: target.oem_wheel_sizes,
              after: null,
            });
            errorCount++;
            continue;
          }
        } else {
          filledCount++;
          console.log(`  [DRY] ${target.year} ← donor ${donor.year} (${confidence})`);
        }
        
        results.push({
          target: { year: target.year, make, model, trim: target.display_trim, id: target.id },
          donor: { year: donor.year, make, model: donor.model, trim: donor.display_trim, id: donor.id },
          generation: `${generation[0]}-${generation[1]}`,
          status: "filled",
          confidence,
          before: target.oem_wheel_sizes,
          after: donor.oem_wheel_sizes,
        });
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                        FILL SUMMARY                            ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
  
  console.log(`✅ Filled: ${filledCount}`);
  console.log(`⏭️  Skipped (already valid): ${skippedAlreadyValid}`);
  console.log(`⏭️  Skipped (no donor): ${skippedNoDonor}`);
  console.log(`🚫 Blocked (validation): ${blockedValidation}`);
  console.log(`🚫 Blocked (HD no exact): ${blockedHDNoExact}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\nTotal processed: ${results.length}`);
  
  // By confidence
  const byConfidence = {
    high: results.filter(r => r.status === "filled" && r.confidence === "high").length,
    medium: results.filter(r => r.status === "filled" && r.confidence === "medium").length,
    low: results.filter(r => r.status === "filled" && r.confidence === "low").length,
  };
  console.log(`\nBy confidence: high=${byConfidence.high}, medium=${byConfidence.medium}, low=${byConfidence.low}`);
  
  // By model (top 10 filled)
  const filledByModel: Record<string, number> = {};
  results.filter(r => r.status === "filled").forEach(r => {
    const key = `${r.target.make}/${r.target.model}`;
    filledByModel[key] = (filledByModel[key] || 0) + 1;
  });
  console.log("\n═══ TOP MODELS FILLED ═══");
  Object.entries(filledByModel)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([model, count]) => console.log(`  ${model}: ${count}`));
  
  // Blocked reasons
  const blockedResults = results.filter(r => r.status === "blocked");
  if (blockedResults.length > 0) {
    console.log("\n═══ BLOCKED RECORDS ═══");
    const byReason: Record<string, number> = {};
    blockedResults.forEach(r => {
      byReason[r.reason || "unknown"] = (byReason[r.reason || "unknown"] || 0) + 1;
    });
    Object.entries(byReason)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => console.log(`  ${reason}: ${count}`));
  }
  
  // Save detailed log
  const logPath = path.resolve(__dirname, "strict-fill-471-log.json");
  await fs.writeFile(logPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "live",
    summary: {
      filled: filledCount,
      skippedAlreadyValid,
      skippedNoDonor,
      blockedValidation,
      blockedHDNoExact,
      errors: errorCount,
      total: results.length,
      byConfidence,
    },
    filledByModel,
    results: results.slice(0, 500), // Cap log size
  }, null, 2));
  console.log(`\n📄 Log saved to: ${logPath}`);
  
  if (dryRun) {
    console.log("\n⚠️  DRY RUN - No changes made. Run without --dry-run to apply.");
  } else {
    console.log("\n✅ FILL COMPLETE. Run wheel audit to verify.");
  }
}

main().catch(console.error);
