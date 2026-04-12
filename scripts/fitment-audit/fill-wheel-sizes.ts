/**
 * Fill Missing Wheel Sizes - Phase 1 (2015-2026)
 * 
 * STRICT GUARDRAILS:
 * - Only fills records with MISSING wheel sizes
 * - Does NOT overwrite existing wheel data
 * - Uses strict generation-compatible inheritance
 * - Logs every fill with source/confidence
 * - Blocks suspicious fills
 * 
 * Usage: npx tsx scripts/fitment-audit/fill-wheel-sizes.ts [--dry-run]
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const PHASE1_START_YEAR = 2015;
const PHASE1_END_YEAR = 2026;

// High-traffic models to prioritize (order matters)
const HIGH_TRAFFIC_MODELS = [
  // Trucks
  "ford/f-150",
  "chevrolet/silverado-1500",
  "gmc/sierra-1500",
  "ram/1500",
  "toyota/tacoma",
  "toyota/tundra",
  "ford/f-250",
  "ford/f-350",
  "chevrolet/silverado-2500hd",
  "chevrolet/silverado-3500hd",
  "ram/2500",
  "ram/3500",
  
  // SUVs
  "toyota/rav4",
  "honda/cr-v",
  "toyota/highlander",
  "jeep/grand-cherokee",
  "jeep/wrangler",
  "ford/explorer",
  "chevrolet/tahoe",
  "chevrolet/suburban",
  "gmc/yukon",
  "ford/bronco",
  "toyota/4runner",
  
  // Sedans
  "toyota/camry",
  "honda/accord",
  "honda/civic",
  "toyota/corolla",
  "nissan/altima",
  "hyundai/sonata",
  "hyundai/elantra",
  
  // Sports/Performance
  "ford/mustang",
  "chevrolet/camaro",
  "dodge/challenger",
  "dodge/charger",
  "chevrolet/corvette",
  "subaru/wrx",
];

// Platform generations - defines which years share wheel specs
const PLATFORM_GENERATIONS: Record<string, Record<string, [number, number][]>> = {
  ford: {
    "mustang": [[2015, 2023], [2024, 2026]],
    "f-150": [[2015, 2020], [2021, 2026]],
    "f-250": [[2017, 2026]],
    "f-350": [[2017, 2026]],
    "explorer": [[2020, 2026]],
    "escape": [[2020, 2026]],
    "bronco": [[2021, 2026]],
    "ranger": [[2019, 2026]],
  },
  toyota: {
    "camry": [[2018, 2026]],
    "rav4": [[2019, 2026]],
    "highlander": [[2020, 2026]],
    "tacoma": [[2016, 2026]],
    "tundra": [[2022, 2026]],
    "4runner": [[2015, 2026]],
    "corolla": [[2019, 2026]],
    "sienna": [[2021, 2026]],
  },
  honda: {
    "civic": [[2016, 2021], [2022, 2026]],
    "accord": [[2018, 2022], [2023, 2026]],
    "cr-v": [[2017, 2022], [2023, 2026]],
    "pilot": [[2016, 2022], [2023, 2026]],
  },
  chevrolet: {
    "silverado-1500": [[2019, 2026]],
    "silverado-2500hd": [[2020, 2026]],
    "silverado-3500hd": [[2020, 2026]],
    "tahoe": [[2021, 2026]],
    "suburban": [[2021, 2026]],
    "equinox": [[2018, 2026]],
    "traverse": [[2018, 2026]],
    "camaro": [[2016, 2026]],
    "corvette": [[2020, 2026]],
    "colorado": [[2015, 2026]],
  },
  gmc: {
    "sierra-1500": [[2019, 2026]],
    "sierra-2500hd": [[2020, 2026]],
    "sierra-3500hd": [[2020, 2026]],
    "yukon": [[2021, 2026]],
    "yukon-xl": [[2021, 2026]],
    "acadia": [[2017, 2026]],
    "terrain": [[2018, 2026]],
    "canyon": [[2015, 2026]],
  },
  ram: {
    "1500": [[2019, 2026]],
    "2500": [[2019, 2026]],
    "3500": [[2019, 2026]],
  },
  dodge: {
    "challenger": [[2015, 2026]],
    "charger": [[2015, 2026]],
    "durango": [[2015, 2026]],
  },
  jeep: {
    "grand-cherokee": [[2022, 2026]],
    "wrangler": [[2018, 2026]],
    "gladiator": [[2020, 2026]],
    "cherokee": [[2019, 2026]],
    "compass": [[2018, 2026]],
  },
  subaru: {
    "outback": [[2020, 2026]],
    "forester": [[2019, 2026]],
    "crosstrek": [[2018, 2023], [2024, 2026]],
    "wrx": [[2022, 2026]],
  },
  hyundai: {
    "palisade": [[2020, 2026]],
    "tucson": [[2022, 2026]],
    "santa-fe": [[2019, 2026]],
    "sonata": [[2020, 2026]],
    "elantra": [[2021, 2026]],
  },
  kia: {
    "telluride": [[2020, 2026]],
    "sorento": [[2021, 2026]],
    "sportage": [[2023, 2026]],
    "k5": [[2021, 2026]],
  },
  nissan: {
    "altima": [[2019, 2026]],
    "rogue": [[2021, 2026]],
    "pathfinder": [[2022, 2026]],
    "frontier": [[2022, 2026]],
    "titan": [[2016, 2026]],
  },
  lexus: {
    "rx": [[2023, 2026]],
    "nx": [[2022, 2026]],
    "es": [[2019, 2026]],
  },
  mercedes: {
    "c-class": [[2022, 2026]],
    "e-class": [[2024, 2026]],
    "gle": [[2020, 2026]],
    "glc": [[2023, 2026]],
    "gls": [[2020, 2026]],
  },
  bmw: {
    "3-series": [[2019, 2026]],
    "5-series": [[2024, 2026]],
    "x3": [[2018, 2026]],
    "x5": [[2019, 2026]],
  },
  audi: {
    "a4": [[2017, 2026]],
    "a6": [[2019, 2026]],
    "q5": [[2018, 2026]],
    "q7": [[2020, 2026]],
  },
};

// Minimum OEM wheel diameters (for validation)
const MIN_OEM_DIAMETERS: Record<string, number> = {
  // Trucks
  "ford/f-150": 17,
  "chevrolet/silverado-1500": 17,
  "gmc/sierra-1500": 17,
  "ram/1500": 17,
  "toyota/tacoma": 16,
  "toyota/tundra": 18,
  "ford/f-250": 17,
  "ford/f-350": 17,
  "chevrolet/silverado-2500hd": 17,
  "chevrolet/silverado-3500hd": 17,
  "ram/2500": 17,
  "ram/3500": 17,
  "nissan/titan": 17,
  
  // SUVs
  "toyota/rav4": 17,
  "honda/cr-v": 17,
  "toyota/highlander": 18,
  "jeep/grand-cherokee": 17,
  "jeep/wrangler": 17,
  "ford/explorer": 18,
  "chevrolet/tahoe": 18,
  "chevrolet/suburban": 18,
  "gmc/yukon": 18,
  "ford/bronco": 17,
  "toyota/4runner": 17,
  
  // Sedans
  "toyota/camry": 17,
  "honda/accord": 17,
  "honda/civic": 16,
  "toyota/corolla": 16,
  "nissan/altima": 17,
  
  // Sports
  "ford/mustang": 17,
  "chevrolet/camaro": 18,
  "dodge/challenger": 17,
  "dodge/charger": 17,
  "chevrolet/corvette": 19,
  "subaru/wrx": 17,
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface WheelSize {
  diameter: number;
  width: number;
  offset?: number;
  axle?: string;
  isStock?: boolean;
}

interface FillResult {
  recordId: string;
  year: number;
  make: string;
  model: string;
  displayTrim: string;
  donorYear: number;
  donorTrim: string;
  donorSource: string;
  wheelSizesBefore: WheelSize[];
  wheelSizesAfter: WheelSize[];
  confidence: "high" | "medium" | "low";
  status: "filled" | "blocked" | "skipped";
  reason: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function parseWheelSizes(oemWheelSizes: any): WheelSize[] {
  if (!oemWheelSizes || !Array.isArray(oemWheelSizes)) return [];
  
  return oemWheelSizes.map((ws: any) => {
    if (typeof ws === 'string') {
      const match = ws.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
      if (match) {
        const offsetMatch = ws.match(/ET\s*(-?\d+)/i);
        return {
          diameter: parseFloat(match[1]),
          width: parseFloat(match[2]),
          offset: offsetMatch ? parseInt(offsetMatch[1]) : undefined,
        };
      }
      return null;
    }
    
    if (typeof ws === 'object' && ws !== null) {
      return {
        diameter: parseFloat(ws.diameter || ws.rim_diameter || 0),
        width: parseFloat(ws.width || ws.rim_width || 0),
        offset: ws.offset != null ? parseFloat(ws.offset) : undefined,
        axle: ws.axle,
        isStock: ws.isStock ?? ws.is_stock,
      };
    }
    
    return null;
  }).filter((ws): ws is WheelSize => ws !== null && ws.diameter > 0);
}

function getGeneration(make: string, model: string, year: number): [number, number] | null {
  const makeGens = PLATFORM_GENERATIONS[make.toLowerCase()];
  if (!makeGens) return null;
  
  const modelGens = makeGens[model.toLowerCase()];
  if (!modelGens) return null;
  
  for (const gen of modelGens) {
    if (year >= gen[0] && year <= gen[1]) {
      return gen;
    }
  }
  
  return null;
}

function validateWheelSizes(
  wheelSizes: WheelSize[], 
  make: string, 
  model: string
): { valid: boolean; reason: string } {
  if (wheelSizes.length === 0) {
    return { valid: false, reason: "No wheel sizes" };
  }
  
  const modelKey = `${make.toLowerCase()}/${model.toLowerCase()}`;
  const minDiameter = MIN_OEM_DIAMETERS[modelKey];
  
  if (minDiameter) {
    const diameters = wheelSizes.map(ws => ws.diameter);
    const minFound = Math.min(...diameters);
    
    if (minFound < minDiameter) {
      return { 
        valid: false, 
        reason: `Min diameter ${minFound}" below OEM baseline ${minDiameter}"` 
      };
    }
  }
  
  // Check for unrealistic values
  const maxDiameter = Math.max(...wheelSizes.map(ws => ws.diameter));
  if (maxDiameter > 24) {
    return { valid: false, reason: `Max diameter ${maxDiameter}" exceeds 24"` };
  }
  
  const widths = wheelSizes.map(ws => ws.width);
  if (Math.max(...widths) > 14) {
    return { valid: false, reason: `Width ${Math.max(...widths)}" exceeds 14"` };
  }
  
  if (Math.min(...widths) < 5) {
    return { valid: false, reason: `Width ${Math.min(...widths)}" below 5"` };
  }
  
  return { valid: true, reason: "OK" };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FILL LOGIC
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║        FILL MISSING WHEEL SIZES - PHASE 1 (2015-2026)          ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE (will modify data)"}`);
  console.log(`Year range: ${PHASE1_START_YEAR}-${PHASE1_END_YEAR}\n`);
  
  const results: FillResult[] = [];
  let filledCount = 0;
  let blockedCount = 0;
  let skippedCount = 0;
  
  try {
    // Step 1: Get all records with missing wheel sizes
    console.log("━━━ Step 1: Finding records with missing wheel sizes ━━━\n");
    
    const { rows: missingRecords } = await pool.query(`
      SELECT id, year, make, model, display_trim, modification_id,
             bolt_pattern, center_bore_mm, oem_wheel_sizes, source
      FROM vehicle_fitments
      WHERE year >= $1 AND year <= $2
        AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR jsonb_array_length(oem_wheel_sizes) = 0)
      ORDER BY year DESC, make, model
    `, [PHASE1_START_YEAR, PHASE1_END_YEAR]);
    
    console.log(`Found ${missingRecords.length} records with missing wheel sizes\n`);
    
    // Group by make/model
    const byModel: Record<string, any[]> = {};
    for (const rec of missingRecords) {
      const key = `${rec.make}/${rec.model}`;
      if (!byModel[key]) byModel[key] = [];
      byModel[key].push(rec);
    }
    
    console.log("Records by model:");
    Object.entries(byModel)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 15)
      .forEach(([model, recs]) => {
        console.log(`  ${model}: ${recs.length} records`);
      });
    console.log();
    
    // Step 2: Process each record
    console.log("━━━ Step 2: Finding donors and filling ━━━\n");
    
    for (const rec of missingRecords) {
      const modelKey = `${rec.make}/${rec.model}`;
      
      // Get generation for this record
      const generation = getGeneration(rec.make, rec.model, rec.year);
      
      if (!generation) {
        results.push({
          recordId: rec.id,
          year: rec.year,
          make: rec.make,
          model: rec.model,
          displayTrim: rec.display_trim,
          donorYear: 0,
          donorTrim: "",
          donorSource: "",
          wheelSizesBefore: [],
          wheelSizesAfter: [],
          confidence: "low",
          status: "skipped",
          reason: "No generation defined for this model/year",
        });
        skippedCount++;
        continue;
      }
      
      // Find a donor record within the same generation
      const { rows: donors } = await pool.query(`
        SELECT year, display_trim, oem_wheel_sizes, source
        FROM vehicle_fitments
        WHERE make = $1 AND model = $2
          AND year >= $3 AND year <= $4
          AND oem_wheel_sizes IS NOT NULL 
          AND oem_wheel_sizes != '[]'::jsonb 
          AND jsonb_array_length(oem_wheel_sizes) > 0
        ORDER BY 
          CASE WHEN display_trim = $5 THEN 0 ELSE 1 END,
          ABS(year - $6)
        LIMIT 1
      `, [rec.make, rec.model, generation[0], generation[1], rec.display_trim, rec.year]);
      
      if (donors.length === 0) {
        results.push({
          recordId: rec.id,
          year: rec.year,
          make: rec.make,
          model: rec.model,
          displayTrim: rec.display_trim,
          donorYear: 0,
          donorTrim: "",
          donorSource: "",
          wheelSizesBefore: [],
          wheelSizesAfter: [],
          confidence: "low",
          status: "skipped",
          reason: `No donor found in generation ${generation[0]}-${generation[1]}`,
        });
        skippedCount++;
        continue;
      }
      
      const donor = donors[0];
      const donorWheelSizes = parseWheelSizes(donor.oem_wheel_sizes);
      
      // Validate donor wheel sizes
      const validation = validateWheelSizes(donorWheelSizes, rec.make, rec.model);
      
      if (!validation.valid) {
        results.push({
          recordId: rec.id,
          year: rec.year,
          make: rec.make,
          model: rec.model,
          displayTrim: rec.display_trim,
          donorYear: donor.year,
          donorTrim: donor.display_trim,
          donorSource: donor.source,
          wheelSizesBefore: [],
          wheelSizesAfter: donorWheelSizes,
          confidence: "low",
          status: "blocked",
          reason: `Donor validation failed: ${validation.reason}`,
        });
        blockedCount++;
        continue;
      }
      
      // Determine confidence
      const sameYear = donor.year === rec.year;
      const sameTrim = donor.display_trim === rec.display_trim;
      const confidence: "high" | "medium" | "low" = 
        sameYear && sameTrim ? "high" :
        sameTrim || Math.abs(donor.year - rec.year) <= 1 ? "medium" : "low";
      
      // Apply fill
      if (!dryRun) {
        await pool.query(`
          UPDATE vehicle_fitments 
          SET oem_wheel_sizes = $1::jsonb,
              source = $2,
              updated_at = NOW()
          WHERE id = $3
        `, [
          JSON.stringify(donor.oem_wheel_sizes),
          `wheel_fill_${rec.make}_${rec.model}_from_${donor.year}`,
          rec.id
        ]);
      }
      
      results.push({
        recordId: rec.id,
        year: rec.year,
        make: rec.make,
        model: rec.model,
        displayTrim: rec.display_trim,
        donorYear: donor.year,
        donorTrim: donor.display_trim,
        donorSource: donor.source,
        wheelSizesBefore: [],
        wheelSizesAfter: donorWheelSizes,
        confidence,
        status: "filled",
        reason: `Inherited from ${donor.year} ${donor.display_trim}`,
      });
      filledCount++;
    }
    
    // Step 3: Summary
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                           SUMMARY                               ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
    
    console.log(`Total records processed: ${missingRecords.length}`);
    console.log(`  ✅ Filled: ${filledCount}`);
    console.log(`  ⛔ Blocked: ${blockedCount}`);
    console.log(`  ⏭️  Skipped: ${skippedCount}\n`);
    
    // Filled by model
    const filledByModel: Record<string, number> = {};
    results.filter(r => r.status === "filled").forEach(r => {
      const key = `${r.make}/${r.model}`;
      filledByModel[key] = (filledByModel[key] || 0) + 1;
    });
    
    console.log("Filled by model:");
    Object.entries(filledByModel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([model, count]) => {
        console.log(`  ${model}: ${count}`);
      });
    
    // Blocked examples
    const blockedExamples = results.filter(r => r.status === "blocked").slice(0, 5);
    if (blockedExamples.length > 0) {
      console.log("\n⛔ Blocked examples:");
      blockedExamples.forEach(r => {
        console.log(`  ${r.year} ${r.make} ${r.model} "${r.displayTrim}"`);
        console.log(`    Reason: ${r.reason}`);
      });
    }
    
    // Skipped examples
    const skippedExamples = results.filter(r => r.status === "skipped").slice(0, 5);
    if (skippedExamples.length > 0) {
      console.log("\n⏭️  Skipped examples:");
      skippedExamples.forEach(r => {
        console.log(`  ${r.year} ${r.make} ${r.model} "${r.displayTrim}"`);
        console.log(`    Reason: ${r.reason}`);
      });
    }
    
    // Filled examples
    const filledExamples = results.filter(r => r.status === "filled").slice(0, 5);
    if (filledExamples.length > 0) {
      console.log("\n✅ Filled examples:");
      filledExamples.forEach(r => {
        const sizes = r.wheelSizesAfter.map(ws => `${ws.diameter}x${ws.width}`).join(", ");
        console.log(`  ${r.year} ${r.make} ${r.model} "${r.displayTrim}"`);
        console.log(`    From: ${r.donorYear} ${r.donorTrim} (${r.confidence} confidence)`);
        console.log(`    Sizes: ${sizes}`);
      });
    }
    
    // Save log
    const logPath = path.resolve(__dirname, "wheel-fill-log.json");
    await fs.writeFile(logPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      dryRun,
      summary: {
        totalProcessed: missingRecords.length,
        filled: filledCount,
        blocked: blockedCount,
        skipped: skippedCount,
      },
      results,
    }, null, 2));
    console.log(`\n📄 Log saved to: ${logPath}`);
    
    if (dryRun) {
      console.log("\n💡 Run without --dry-run to apply changes");
    }
    
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
