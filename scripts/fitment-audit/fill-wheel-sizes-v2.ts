/**
 * Fill Missing Wheel Sizes - Version 2 (with Model Normalization)
 * 
 * IMPROVEMENTS OVER V1:
 * - Uses model normalization to find donors across variant names
 * - Searches sierra-2500hd AND sierra-2500-hd for donors
 * - Expanded generation definitions for HD trucks
 * - Does NOT modify existing data - only improves donor discovery
 * 
 * Usage: npx tsx scripts/fitment-audit/fill-wheel-sizes-v2.ts [--dry-run] [--analysis-only]
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";
import { getModelVariants, normalizeModel, getCrossMakeLookups } from "./model-normalization";

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const PHASE2_START_YEAR = 2000;
const PHASE2_END_YEAR = 2026;

// Platform generations - EXPANDED for HD trucks
const PLATFORM_GENERATIONS: Record<string, Record<string, [number, number][]>> = {
  chevrolet: {
    // Light trucks
    "silverado-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
    // HD trucks - add both variants mapping to same gens
    "silverado-2500hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-2500-hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-3500hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-3500-hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-3500": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    // SUVs
    "tahoe": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "suburban": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    // Performance
    "camaro": [[2010, 2015], [2016, 2026]],
    "corvette": [[1997, 2004], [2005, 2013], [2014, 2019], [2020, 2026]],
    // Other
    "equinox": [[2005, 2009], [2010, 2017], [2018, 2026]],
    "traverse": [[2009, 2017], [2018, 2026]],
    "malibu": [[2004, 2007], [2008, 2012], [2013, 2015], [2016, 2026]],
    "colorado": [[2004, 2012], [2015, 2026]],
  },
  gmc: {
    // Light trucks
    "sierra-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
    // HD trucks - add both variants
    "sierra-2500hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-2500-hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-3500hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-3500-hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-3500": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    // SUVs
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
    "durango": [[1998, 2003], [2004, 2009], [2011, 2026]],
  },
  ford: {
    "f-150": [[2004, 2008], [2009, 2014], [2015, 2020], [2021, 2026]],
    "f-250": [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2026]],
    "f-350": [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2026]],
    "mustang": [[2005, 2014], [2015, 2023], [2024, 2026]],
    "explorer": [[2002, 2005], [2006, 2010], [2011, 2019], [2020, 2026]],
    "expedition": [[1997, 2002], [2003, 2006], [2007, 2017], [2018, 2026]],
    "ranger": [[1998, 2011], [2019, 2026]],
    "bronco": [[2021, 2026]],
  },
  toyota: {
    "tacoma": [[2005, 2015], [2016, 2026]],
    "tundra": [[2000, 2006], [2007, 2021], [2022, 2026]],
    "4runner": [[2003, 2009], [2010, 2026]],
    "camry": [[2002, 2006], [2007, 2011], [2012, 2017], [2018, 2026]],
    "corolla": [[2003, 2008], [2009, 2013], [2014, 2018], [2019, 2026]],
    "rav4": [[2006, 2012], [2013, 2018], [2019, 2026]],
    "highlander": [[2001, 2007], [2008, 2013], [2014, 2019], [2020, 2026]],
    "sienna": [[2004, 2010], [2011, 2020], [2021, 2026]],
    "sequoia": [[2001, 2007], [2008, 2022], [2023, 2026]],
  },
  honda: {
    "accord": [[2003, 2007], [2008, 2012], [2013, 2017], [2018, 2022], [2023, 2026]],
    "civic": [[2001, 2005], [2006, 2011], [2012, 2015], [2016, 2021], [2022, 2026]],
    "cr-v": [[2002, 2006], [2007, 2011], [2012, 2016], [2017, 2022], [2023, 2026]],
    "pilot": [[2003, 2008], [2009, 2015], [2016, 2022], [2023, 2026]],
    "odyssey": [[1999, 2004], [2005, 2010], [2011, 2017], [2018, 2026]],
  },
  jeep: {
    "wrangler": [[1997, 2006], [2007, 2017], [2018, 2026]],
    "grand-cherokee": [[1999, 2004], [2005, 2010], [2011, 2021], [2022, 2026]],
    "cherokee": [[2014, 2026]],
    "liberty": [[2002, 2007], [2008, 2012]],
    "gladiator": [[2020, 2026]],
  },
  nissan: {
    "altima": [[2002, 2006], [2007, 2012], [2013, 2018], [2019, 2026]],
    "titan": [[2004, 2015], [2016, 2026]],
    "frontier": [[2005, 2021], [2022, 2026]],
    "pathfinder": [[2005, 2012], [2013, 2020], [2022, 2026]],
  },
  cadillac: {
    "escalade": [[1999, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "escalade-esv": [[2003, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
  },
};

// Minimum OEM wheel diameters (expanded)
const MIN_OEM_DIAMETERS: Record<string, number> = {
  // HD Trucks
  "chevrolet/silverado-2500hd": 17,
  "chevrolet/silverado-2500-hd": 17,
  "chevrolet/silverado-3500hd": 17,
  "chevrolet/silverado-3500-hd": 17,
  "gmc/sierra-2500hd": 17,
  "gmc/sierra-2500-hd": 17,
  "gmc/sierra-3500hd": 17,
  "gmc/sierra-3500-hd": 17,
  "ram/2500": 17,
  "ram/3500": 17,
  "dodge/ram-2500": 16,
  "dodge/ram-3500": 16,
  "ford/f-250": 17,
  "ford/f-350": 17,
  
  // Light Trucks
  "chevrolet/silverado-1500": 17,
  "gmc/sierra-1500": 17,
  "ford/f-150": 17,
  "ram/1500": 17,
  "toyota/tacoma": 16,
  "toyota/tundra": 17,
  "nissan/titan": 17,
  
  // SUVs
  "chevrolet/tahoe": 17,
  "chevrolet/suburban": 17,
  "gmc/yukon": 17,
  "gmc/yukon-xl": 17,
  "cadillac/escalade": 18,
  "cadillac/escalade-esv": 18,
  "ford/expedition": 17,
  "jeep/wrangler": 17,
  "jeep/grand-cherokee": 17,
  
  // Performance
  "chevrolet/corvette": 17,
  "chevrolet/camaro": 18,
  "ford/mustang": 17,
  "dodge/challenger": 17,
  "dodge/charger": 17,
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
  donorModel: string;  // May differ from record model due to normalization
  donorSource: string;
  wheelSizesBefore: WheelSize[];
  wheelSizesAfter: WheelSize[];
  confidence: "high" | "medium" | "low";
  status: "filled" | "blocked" | "skipped" | "donor_found";
  reason: string;
  normalizedMatch: boolean;  // True if donor found via normalization
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
  
  // Try original model name
  let modelGens = makeGens[model.toLowerCase()];
  
  // If not found, try normalized name
  if (!modelGens) {
    const normalized = normalizeModel(model);
    modelGens = makeGens[normalized];
  }
  
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
  
  // Check both original and normalized model key
  const modelKey = `${make.toLowerCase()}/${model.toLowerCase()}`;
  const normalizedKey = `${make.toLowerCase()}/${normalizeModel(model)}`;
  const minDiameter = MIN_OEM_DIAMETERS[modelKey] || MIN_OEM_DIAMETERS[normalizedKey];
  
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

/**
 * Find a donor record, searching across model variants.
 * Returns donor info or null if not found.
 */
async function findDonor(
  pool: pg.Pool,
  make: string,
  model: string,
  year: number,
  displayTrim: string,
  generation: [number, number]
): Promise<{ 
  donor: any; 
  normalizedMatch: boolean; 
  donorModel: string;
} | null> {
  // Get all model variants to search
  const modelVariants = getModelVariants(model);
  
  // Also check cross-make lookups (e.g., Dodge Ram → Ram)
  const crossMake = getCrossMakeLookups(make, model);
  
  // Try each variant
  for (const variant of modelVariants) {
    const { rows: donors } = await pool.query(`
      SELECT year, display_trim, oem_wheel_sizes, source, model
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
    `, [make, variant, generation[0], generation[1], displayTrim, year]);
    
    if (donors.length > 0) {
      return {
        donor: donors[0],
        normalizedMatch: variant !== model.toLowerCase(),
        donorModel: variant,
      };
    }
  }
  
  // Try cross-make lookups
  for (const cm of crossMake) {
    // Get generation for cross-make model
    const cmGen = getGeneration(cm.make, cm.model, year);
    if (!cmGen) continue;
    
    const { rows: donors } = await pool.query(`
      SELECT year, display_trim, oem_wheel_sizes, source, model
      FROM vehicle_fitments
      WHERE make = $1 AND model = $2
        AND year >= $3 AND year <= $4
        AND oem_wheel_sizes IS NOT NULL 
        AND oem_wheel_sizes != '[]'::jsonb 
        AND jsonb_array_length(oem_wheel_sizes) > 0
      ORDER BY ABS(year - $5)
      LIMIT 1
    `, [cm.make, cm.model, cmGen[0], cmGen[1], year]);
    
    if (donors.length > 0) {
      return {
        donor: donors[0],
        normalizedMatch: true,
        donorModel: `${cm.make}/${cm.model}`,
      };
    }
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const analysisOnly = process.argv.includes("--analysis-only");
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║    FILL WHEEL SIZES V2 (WITH MODEL NORMALIZATION)              ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${analysisOnly ? "ANALYSIS ONLY" : dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Year range: ${PHASE2_START_YEAR}-${PHASE2_END_YEAR}\n`);
  
  const results: FillResult[] = [];
  let filledCount = 0;
  let blockedCount = 0;
  let skippedCount = 0;
  let donorFoundCount = 0;
  let normalizedMatchCount = 0;
  
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
    `, [PHASE2_START_YEAR, PHASE2_END_YEAR]);
    
    console.log(`Found ${missingRecords.length} records with missing wheel sizes\n`);
    
    // Step 2: Process each record
    console.log("━━━ Step 2: Finding donors (with normalization) ━━━\n");
    
    for (const rec of missingRecords) {
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
          donorModel: "",
          donorSource: "",
          wheelSizesBefore: [],
          wheelSizesAfter: [],
          confidence: "low",
          status: "skipped",
          reason: "No generation defined",
          normalizedMatch: false,
        });
        skippedCount++;
        continue;
      }
      
      // Find donor (with normalization)
      const donorResult = await findDonor(
        pool, rec.make, rec.model, rec.year, rec.display_trim, generation
      );
      
      if (!donorResult) {
        results.push({
          recordId: rec.id,
          year: rec.year,
          make: rec.make,
          model: rec.model,
          displayTrim: rec.display_trim,
          donorYear: 0,
          donorTrim: "",
          donorModel: "",
          donorSource: "",
          wheelSizesBefore: [],
          wheelSizesAfter: [],
          confidence: "low",
          status: "skipped",
          reason: `No donor in generation ${generation[0]}-${generation[1]}`,
          normalizedMatch: false,
        });
        skippedCount++;
        continue;
      }
      
      const { donor, normalizedMatch, donorModel } = donorResult;
      const donorWheelSizes = parseWheelSizes(donor.oem_wheel_sizes);
      
      if (normalizedMatch) {
        normalizedMatchCount++;
      }
      
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
          donorModel,
          donorSource: donor.source,
          wheelSizesBefore: [],
          wheelSizesAfter: donorWheelSizes,
          confidence: "low",
          status: "blocked",
          reason: `Validation failed: ${validation.reason}`,
          normalizedMatch,
        });
        blockedCount++;
        continue;
      }
      
      // Donor found and valid
      const sameYear = donor.year === rec.year;
      const sameTrim = donor.display_trim === rec.display_trim;
      const sameModel = !normalizedMatch;
      const confidence: "high" | "medium" | "low" = 
        sameYear && sameTrim && sameModel ? "high" :
        (sameTrim || Math.abs(donor.year - rec.year) <= 1) && sameModel ? "medium" : "low";
      
      donorFoundCount++;
      
      if (analysisOnly) {
        results.push({
          recordId: rec.id,
          year: rec.year,
          make: rec.make,
          model: rec.model,
          displayTrim: rec.display_trim,
          donorYear: donor.year,
          donorTrim: donor.display_trim,
          donorModel,
          donorSource: donor.source,
          wheelSizesBefore: [],
          wheelSizesAfter: donorWheelSizes,
          confidence,
          status: "donor_found",
          reason: `Would fill from ${donor.year} ${donorModel}`,
          normalizedMatch,
        });
        continue;
      }
      
      // Apply fill (unless dry-run)
      if (!dryRun) {
        await pool.query(`
          UPDATE vehicle_fitments 
          SET oem_wheel_sizes = $1::jsonb,
              source = $2,
              updated_at = NOW()
          WHERE id = $3
        `, [
          JSON.stringify(donor.oem_wheel_sizes),
          `wheel_fill_v2_${rec.make}_${rec.model}_from_${donor.year}`,
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
        donorModel,
        donorSource: donor.source,
        wheelSizesBefore: [],
        wheelSizesAfter: donorWheelSizes,
        confidence,
        status: "filled",
        reason: `Inherited from ${donor.year} ${donorModel}`,
        normalizedMatch,
      });
      filledCount++;
    }
    
    // Summary
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                           SUMMARY                               ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
    
    console.log(`Total records processed: ${missingRecords.length}`);
    console.log(`  ✅ ${analysisOnly ? "Donors found" : "Filled"}: ${analysisOnly ? donorFoundCount : filledCount}`);
    console.log(`  ⛔ Blocked: ${blockedCount}`);
    console.log(`  ⏭️  Skipped: ${skippedCount}`);
    console.log(`  🔗 Found via normalization: ${normalizedMatchCount}\n`);
    
    // Show normalized matches
    const normalizedResults = results.filter(r => r.normalizedMatch && r.status !== "skipped");
    if (normalizedResults.length > 0) {
      console.log("═══ NORMALIZED MATCHES (donors found via variant lookup) ═══\n");
      const byModel: Record<string, number> = {};
      normalizedResults.forEach(r => {
        const key = `${r.make}/${r.model} ← ${r.donorModel}`;
        byModel[key] = (byModel[key] || 0) + 1;
      });
      Object.entries(byModel)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([match, count]) => {
          console.log(`  ${match}: ${count} records`);
        });
    }
    
    // By model
    const filledByModel: Record<string, number> = {};
    results.filter(r => r.status === "filled" || r.status === "donor_found").forEach(r => {
      const key = `${r.make}/${r.model}`;
      filledByModel[key] = (filledByModel[key] || 0) + 1;
    });
    
    if (Object.keys(filledByModel).length > 0) {
      console.log("\n═══ FILLABLE BY MODEL ═══\n");
      Object.entries(filledByModel)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([model, count]) => {
          console.log(`  ${model}: ${count}`);
        });
    }
    
    // Save log
    const logPath = path.resolve(__dirname, "wheel-fill-v2-log.json");
    await fs.writeFile(logPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      mode: analysisOnly ? "analysis" : dryRun ? "dry-run" : "live",
      summary: {
        totalProcessed: missingRecords.length,
        filled: filledCount,
        donorFound: donorFoundCount,
        blocked: blockedCount,
        skipped: skippedCount,
        normalizedMatches: normalizedMatchCount,
      },
      results: results.slice(0, 500), // Limit for file size
    }, null, 2));
    console.log(`\n📄 Log saved to: ${logPath}`);
    
    if (analysisOnly) {
      console.log("\n💡 This was ANALYSIS ONLY. Run without --analysis-only to fill.");
    } else if (dryRun) {
      console.log("\n💡 Run without --dry-run to apply changes.");
    }
    
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
