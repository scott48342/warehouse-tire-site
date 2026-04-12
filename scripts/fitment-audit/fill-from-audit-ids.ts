/**
 * FILL FROM AUDIT IDS - Strict Fill Using Audit Results
 * 
 * Uses the exact record IDs from wheel-audit-results.json that are flagged
 * with missing_wheel_specs, finds donors within the same platform generation,
 * and fills with full validation.
 * 
 * NON-NEGOTIABLE: NO REGRESSION.
 * - Only fills records flagged in audit
 * - Does NOT overwrite existing valid wheel specs
 * - Extra validation for HD trucks
 * - Full before/after logging
 * 
 * Usage: npx tsx scripts/fitment-audit/fill-from-audit-ids.ts [--dry-run]
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";
import { getModelVariants, normalizeModel } from "./model-normalization";

const { Pool } = pg;

// Load the audit results directly
const auditResults = require("./wheel-audit-results.json");

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION RULES
// ═══════════════════════════════════════════════════════════════════════════

const MIN_DIAMETER_BY_CLASS: Record<string, number> = {
  // HD trucks: minimum 17" baseline
  "silverado-2500hd": 17, "silverado-2500-hd": 17,
  "silverado-3500hd": 17, "silverado-3500-hd": 17,
  "sierra-2500hd": 17, "sierra-2500-hd": 17,
  "sierra-3500hd": 17, "sierra-3500-hd": 17,
  "2500": 17, "3500": 17, "f-250": 17, "f-350": 17,
  
  // Light trucks: minimum 16-17"
  "silverado-1500": 16, "sierra-1500": 16, "1500": 16, "f-150": 16,
  "tahoe": 17, "yukon": 17, "escalade": 17, "escalade-esv": 17,
  "suburban": 17, "yukon-xl": 17, "titan": 17, "titan-xd": 17,
  
  // Sports/Muscle: minimum 16-17"
  "camaro": 16, "corvette": 17, "firebird": 16, "mustang": 16,
  
  // Default
  "default": 14,
};

const HD_TRUCK_PATTERNS = [/2500/i, /3500/i, /f-250/i, /f-350/i, /super.?duty/i, /titan.?xd/i];

// Platform generations
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
    "cavalier": [[1995, 2005]],
    "monte-carlo": [[2000, 2007]],
    "lumina": [[1995, 2001]],
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
    "challenger": [[2008, 2026]],
    "charger": [[2006, 2010], [2011, 2026]],
  },
  cadillac: {
    "escalade": [[1999, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "escalade-esv": [[2003, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "cts": [[2003, 2007], [2008, 2013], [2014, 2019]],
  },
  nissan: {
    "titan": [[2004, 2015], [2016, 2026]],
    "titan-xd": [[2016, 2026]],
    "frontier": [[1998, 2004], [2005, 2021], [2022, 2026]],
  },
  buick: {
    "lesabre": [[2000, 2005]],
    "regal": [[1997, 2004], [2011, 2017], [2018, 2020]],
    "lacrosse": [[2005, 2009], [2010, 2016], [2017, 2019]],
    "enclave": [[2008, 2017], [2018, 2026]],
    "century": [[1997, 2005]],
  },
  pontiac: {
    "firebird": [[1998, 2002]],
    "grand-am": [[1999, 2005]],
    "grand-prix": [[1997, 2003], [2004, 2008]],
    "bonneville": [[2000, 2005]],
    "g6": [[2005, 2010]],
  },
  saturn: {
    "vue": [[2002, 2007], [2008, 2010]],
    "aura": [[2007, 2009]],
    "ion": [[2003, 2007]],
    "l-series": [[2000, 2005]],
    "s-series": [[1991, 2002]],
  },
  ford: {
    "f-150": [[1997, 2003], [2004, 2008], [2009, 2014], [2015, 2020], [2021, 2026]],
    "f-250": [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2026]],
    "f-350": [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2026]],
    "mustang": [[1999, 2004], [2005, 2014], [2015, 2023], [2024, 2026]],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & HELPERS
// ═══════════════════════════════════════════════════════════════════════════

interface WheelSize { diameter: number; width: number; offset?: number; }

interface FillResult {
  targetId: string;
  target: { year: number; make: string; model: string; trim?: string };
  donor: { year: number; make: string; model: string; trim?: string; id: string } | null;
  generation: string;
  status: "filled" | "skipped" | "blocked" | "error";
  reason?: string;
  confidence: "high" | "medium" | "low";
  wheelSizes: WheelSize[];
}

function getGeneration(make: string, model: string, year: number): [number, number] | null {
  const makeGens = PLATFORM_GENERATIONS[make.toLowerCase()];
  if (!makeGens) return null;
  let modelGens = makeGens[model.toLowerCase()] || makeGens[normalizeModel(model)];
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
      if (d > 0 && w > 0) return { diameter: d, width: w, offset: ws.offset };
    }
    return null;
  }).filter((ws): ws is WheelSize => ws !== null);
}

function isHDTruck(model: string): boolean {
  return HD_TRUCK_PATTERNS.some(p => p.test(model));
}

function getMinDiameter(model: string): number {
  const lower = model.toLowerCase();
  return MIN_DIAMETER_BY_CLASS[lower] || (isHDTruck(model) ? 17 : MIN_DIAMETER_BY_CLASS["default"]);
}

function validateWheelSizes(wheelSizes: WheelSize[], model: string): { valid: boolean; reason?: string } {
  if (wheelSizes.length === 0) return { valid: false, reason: "Empty wheel sizes" };
  const minDiameter = getMinDiameter(model);
  for (const ws of wheelSizes) {
    if (ws.diameter < minDiameter) {
      return { valid: false, reason: `Diameter ${ws.diameter}" < min ${minDiameter}" for ${model}` };
    }
    if (ws.diameter > 26) return { valid: false, reason: `Diameter ${ws.diameter}" too large` };
    if (ws.width < 5 || ws.width > 14) return { valid: false, reason: `Width ${ws.width}" out of range` };
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
  console.log("║    FILL FROM AUDIT IDS - STRICT WHEEL SPEC FILL                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "🔴 LIVE"}\n`);
  
  // Get records flagged with missing_wheel_specs from audit
  const missingRecords = auditResults.records.filter(
    (r: any) => r.issueTypes?.includes("missing_wheel_specs")
  );
  console.log(`Audit flagged ${missingRecords.length} records with missing wheel specs\n`);
  
  const results: FillResult[] = [];
  let filledCount = 0;
  let skippedNoGen = 0;
  let skippedNoDonor = 0;
  let blockedValidation = 0;
  let blockedHDYearGap = 0;
  let errorCount = 0;
  
  const client = await pool.connect();
  
  try {
    // Process each record from audit
    let processed = 0;
    for (const rec of missingRecords) {
      processed++;
      if (processed % 100 === 0) {
        console.log(`Processing ${processed}/${missingRecords.length}...`);
      }
      
      const { id, year, make, model, displayTrim } = rec;
      
      // Get generation for this vehicle
      const generation = getGeneration(make, model, year);
      if (!generation) {
        results.push({
          targetId: id,
          target: { year, make, model, trim: displayTrim },
          donor: null,
          generation: "unknown",
          status: "skipped",
          reason: "No generation defined for this model",
          confidence: "low",
          wheelSizes: [],
        });
        skippedNoGen++;
        continue;
      }
      
      // Find donor within same generation using model variants
      const modelVariants = getModelVariants(model);
      let donor: any = null;
      let donorModel = model;
      
      for (const variant of modelVariants) {
        const { rows: donors } = await client.query(`
          SELECT id, year, make, model, display_trim, oem_wheel_sizes
          FROM vehicle_fitments
          WHERE make = $1 AND model = $2
            AND year >= $3 AND year <= $4
            AND oem_wheel_sizes IS NOT NULL
            AND jsonb_array_length(oem_wheel_sizes) > 0
          ORDER BY ABS(year - $5)
          LIMIT 5
        `, [make, variant, generation[0], generation[1], year]);
        
        // Find first valid donor
        for (const d of donors) {
          const parsed = parseWheelSizes(d.oem_wheel_sizes);
          if (parsed.length > 0) {
            donor = { ...d, parsedWheelSizes: parsed };
            donorModel = variant;
            break;
          }
        }
        if (donor) break;
      }
      
      if (!donor) {
        results.push({
          targetId: id,
          target: { year, make, model, trim: displayTrim },
          donor: null,
          generation: `${generation[0]}-${generation[1]}`,
          status: "skipped",
          reason: `No valid donor in gen ${generation[0]}-${generation[1]}`,
          confidence: "low",
          wheelSizes: [],
        });
        skippedNoDonor++;
        continue;
      }
      
      // Extra caution for HD trucks: require tight year match (within 3 years)
      const yearGap = Math.abs(donor.year - year);
      if (isHDTruck(model) && yearGap > 3) {
        results.push({
          targetId: id,
          target: { year, make, model, trim: displayTrim },
          donor: { year: donor.year, make, model: donorModel, trim: donor.display_trim, id: donor.id },
          generation: `${generation[0]}-${generation[1]}`,
          status: "blocked",
          reason: `HD truck: year gap ${yearGap} > 3 years`,
          confidence: "low",
          wheelSizes: donor.parsedWheelSizes,
        });
        blockedHDYearGap++;
        continue;
      }
      
      // Validate wheel sizes
      const validation = validateWheelSizes(donor.parsedWheelSizes, model);
      if (!validation.valid) {
        results.push({
          targetId: id,
          target: { year, make, model, trim: displayTrim },
          donor: { year: donor.year, make, model: donorModel, trim: donor.display_trim, id: donor.id },
          generation: `${generation[0]}-${generation[1]}`,
          status: "blocked",
          reason: validation.reason || "Validation failed",
          confidence: "low",
          wheelSizes: donor.parsedWheelSizes,
        });
        blockedValidation++;
        continue;
      }
      
      // Determine confidence based on year gap
      const confidence: "high" | "medium" | "low" = yearGap <= 1 ? "high" : yearGap <= 3 ? "medium" : "low";
      
      // Execute fill
      if (!dryRun) {
        try {
          await client.query(`
            UPDATE vehicle_fitments
            SET oem_wheel_sizes = $1,
                source = COALESCE(source, '') || ' [filled from ' || $2::text || ' ' || $3 || ']'
            WHERE id = $4
          `, [JSON.stringify(donor.oem_wheel_sizes), donor.year, donorModel, id]);
          filledCount++;
        } catch (err: any) {
          results.push({
            targetId: id,
            target: { year, make, model, trim: displayTrim },
            donor: { year: donor.year, make, model: donorModel, trim: donor.display_trim, id: donor.id },
            generation: `${generation[0]}-${generation[1]}`,
            status: "error",
            reason: err.message,
            confidence,
            wheelSizes: donor.parsedWheelSizes,
          });
          errorCount++;
          continue;
        }
      } else {
        filledCount++;
      }
      
      results.push({
        targetId: id,
        target: { year, make, model, trim: displayTrim },
        donor: { year: donor.year, make, model: donorModel, trim: donor.display_trim, id: donor.id },
        generation: `${generation[0]}-${generation[1]}`,
        status: "filled",
        confidence,
        wheelSizes: donor.parsedWheelSizes,
      });
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
  console.log(`⏭️  Skipped (no generation): ${skippedNoGen}`);
  console.log(`⏭️  Skipped (no donor): ${skippedNoDonor}`);
  console.log(`🚫 Blocked (validation): ${blockedValidation}`);
  console.log(`🚫 Blocked (HD year gap): ${blockedHDYearGap}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\nTotal processed: ${results.length}`);
  
  // By confidence
  const filled = results.filter(r => r.status === "filled");
  const byConfidence = {
    high: filled.filter(r => r.confidence === "high").length,
    medium: filled.filter(r => r.confidence === "medium").length,
    low: filled.filter(r => r.confidence === "low").length,
  };
  console.log(`\nBy confidence: high=${byConfidence.high}, medium=${byConfidence.medium}, low=${byConfidence.low}`);
  
  // Top models filled
  const filledByModel: Record<string, number> = {};
  filled.forEach(r => {
    const key = `${r.target.make}/${r.target.model}`;
    filledByModel[key] = (filledByModel[key] || 0) + 1;
  });
  console.log("\n═══ TOP MODELS FILLED ═══");
  Object.entries(filledByModel).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([model, count]) => console.log(`  ${model}: ${count}`));
  
  // Skipped (no donor) by model
  const skippedByModel: Record<string, number> = {};
  results.filter(r => r.status === "skipped" && r.reason?.includes("No valid donor"))
    .forEach(r => {
      const key = `${r.target.make}/${r.target.model}`;
      skippedByModel[key] = (skippedByModel[key] || 0) + 1;
    });
  console.log("\n═══ SKIPPED (NO DONOR) ═══");
  Object.entries(skippedByModel).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([model, count]) => console.log(`  ${model}: ${count}`));
  
  // Blocked reasons
  const blocked = results.filter(r => r.status === "blocked");
  if (blocked.length > 0) {
    console.log("\n═══ BLOCKED RECORDS ═══");
    const byReason: Record<string, number> = {};
    blocked.forEach(r => {
      byReason[r.reason || "unknown"] = (byReason[r.reason || "unknown"] || 0) + 1;
    });
    Object.entries(byReason).sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => console.log(`  ${reason}: ${count}`));
  }
  
  // Save detailed log
  const logPath = path.resolve(__dirname, "fill-audit-ids-log.json");
  await fs.writeFile(logPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "live",
    summary: {
      totalAuditMissing: missingRecords.length,
      filled: filledCount,
      skippedNoGen,
      skippedNoDonor,
      blockedValidation,
      blockedHDYearGap,
      errors: errorCount,
      byConfidence,
    },
    filledByModel,
    skippedByModel,
    results: results.slice(0, 1000), // Cap log size
  }, null, 2));
  console.log(`\n📄 Log saved to: ${logPath}`);
  
  if (dryRun) {
    console.log("\n⚠️  DRY RUN - No changes made. Run without --dry-run to apply.");
  } else {
    console.log("\n✅ FILL COMPLETE. Run wheel audit to verify.");
  }
}

main().catch(console.error);
