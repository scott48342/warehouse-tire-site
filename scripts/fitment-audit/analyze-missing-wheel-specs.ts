/**
 * Phase 2 Legacy Wheel Coverage Analysis
 * 
 * Classifies remaining missing_wheel_specs records into actionable categories
 * to plan safe remediation without loosening guardrails.
 * 
 * Usage: npx tsx scripts/fitment-audit/analyze-missing-wheel-specs.ts
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════════
// KNOWN PLATFORM GENERATIONS (for checking if defined)
// ═══════════════════════════════════════════════════════════════════════════

const DEFINED_GENERATIONS: Record<string, Record<string, [number, number][]>> = {
  ford: {
    "mustang": [[2005, 2014], [2015, 2023], [2024, 2026]],
    "f-150": [[2004, 2008], [2009, 2014], [2015, 2020], [2021, 2026]],
    "f-250": [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2026]],
    "f-350": [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2026]],
    "explorer": [[2002, 2005], [2006, 2010], [2011, 2019], [2020, 2026]],
    "escape": [[2001, 2007], [2008, 2012], [2013, 2019], [2020, 2026]],
    "ranger": [[1998, 2011], [2019, 2026]],
    "bronco": [[2021, 2026]],
    "expedition": [[1997, 2002], [2003, 2006], [2007, 2017], [2018, 2026]],
    "taurus": [[2000, 2007], [2008, 2009], [2010, 2019]],
    "focus": [[2000, 2007], [2008, 2011], [2012, 2018]],
    "fusion": [[2006, 2012], [2013, 2020]],
    "edge": [[2007, 2014], [2015, 2026]],
  },
  chevrolet: {
    "silverado-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
    "silverado-2500hd": [[2001, 2007], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-3500hd": [[2001, 2007], [2007, 2014], [2015, 2019], [2020, 2026]],
    "tahoe": [[1995, 1999], [2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "suburban": [[1992, 1999], [2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "camaro": [[1998, 2002], [2010, 2015], [2016, 2026]],
    "corvette": [[1997, 2004], [2005, 2013], [2014, 2019], [2020, 2026]],
    "equinox": [[2005, 2009], [2010, 2017], [2018, 2026]],
    "traverse": [[2009, 2017], [2018, 2026]],
    "colorado": [[2004, 2012], [2015, 2026]],
    "malibu": [[2004, 2007], [2008, 2012], [2013, 2015], [2016, 2026]],
    "impala": [[2000, 2005], [2006, 2013], [2014, 2020]],
    "trailblazer": [[2002, 2009], [2021, 2026]],
    "blazer": [[2019, 2026]],
  },
  gmc: {
    "sierra-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
    "sierra-2500hd": [[2001, 2007], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-3500hd": [[2001, 2007], [2007, 2014], [2015, 2019], [2020, 2026]],
    "yukon": [[1995, 1999], [2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "yukon-xl": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "acadia": [[2007, 2016], [2017, 2026]],
    "terrain": [[2010, 2017], [2018, 2026]],
    "canyon": [[2004, 2012], [2015, 2026]],
    "envoy": [[2002, 2009]],
  },
  ram: {
    "1500": [[2002, 2008], [2009, 2018], [2019, 2026]],
    "2500": [[2003, 2009], [2010, 2018], [2019, 2026]],
    "3500": [[2003, 2009], [2010, 2018], [2019, 2026]],
  },
  dodge: {
    "challenger": [[2008, 2026]],
    "charger": [[2006, 2010], [2011, 2026]],
    "durango": [[1998, 2003], [2004, 2009], [2011, 2026]],
    "ram-1500": [[1994, 2001], [2002, 2008]],
    "ram-2500": [[1994, 2002], [2003, 2009]],
    "ram-3500": [[1994, 2002], [2003, 2009]],
    "caravan": [[2001, 2007], [2008, 2020]],
    "grand-caravan": [[2001, 2007], [2008, 2020]],
  },
  jeep: {
    "wrangler": [[1997, 2006], [2007, 2017], [2018, 2026]],
    "grand-cherokee": [[1999, 2004], [2005, 2010], [2011, 2021], [2022, 2026]],
    "cherokee": [[2002, 2007], [2014, 2026]],
    "liberty": [[2002, 2007], [2008, 2012]],
    "compass": [[2007, 2017], [2018, 2026]],
    "patriot": [[2007, 2017]],
    "gladiator": [[2020, 2026]],
    "commander": [[2006, 2010]],
  },
  toyota: {
    "camry": [[2002, 2006], [2007, 2011], [2012, 2017], [2018, 2026]],
    "corolla": [[2000, 2002], [2003, 2008], [2009, 2013], [2014, 2018], [2019, 2026]],
    "rav4": [[1996, 2000], [2001, 2005], [2006, 2012], [2013, 2018], [2019, 2026]],
    "highlander": [[2001, 2007], [2008, 2013], [2014, 2019], [2020, 2026]],
    "tacoma": [[1995, 2004], [2005, 2015], [2016, 2026]],
    "tundra": [[2000, 2006], [2007, 2021], [2022, 2026]],
    "4runner": [[1996, 2002], [2003, 2009], [2010, 2026]],
    "sienna": [[1998, 2003], [2004, 2010], [2011, 2020], [2021, 2026]],
    "sequoia": [[2001, 2007], [2008, 2022], [2023, 2026]],
    "avalon": [[2000, 2004], [2005, 2012], [2013, 2018], [2019, 2026]],
    "prius": [[2001, 2003], [2004, 2009], [2010, 2015], [2016, 2022], [2023, 2026]],
  },
  honda: {
    "accord": [[2003, 2007], [2008, 2012], [2013, 2017], [2018, 2022], [2023, 2026]],
    "civic": [[2001, 2005], [2006, 2011], [2012, 2015], [2016, 2021], [2022, 2026]],
    "cr-v": [[1997, 2001], [2002, 2006], [2007, 2011], [2012, 2016], [2017, 2022], [2023, 2026]],
    "pilot": [[2003, 2008], [2009, 2015], [2016, 2022], [2023, 2026]],
    "odyssey": [[1999, 2004], [2005, 2010], [2011, 2017], [2018, 2026]],
    "ridgeline": [[2006, 2014], [2017, 2026]],
    "element": [[2003, 2011]],
    "fit": [[2007, 2008], [2009, 2013], [2015, 2020]],
  },
  nissan: {
    "altima": [[2002, 2006], [2007, 2012], [2013, 2018], [2019, 2026]],
    "maxima": [[2000, 2003], [2004, 2008], [2009, 2014], [2016, 2026]],
    "sentra": [[2000, 2006], [2007, 2012], [2013, 2019], [2020, 2026]],
    "rogue": [[2008, 2013], [2014, 2020], [2021, 2026]],
    "pathfinder": [[2000, 2004], [2005, 2012], [2013, 2020], [2022, 2026]],
    "murano": [[2003, 2007], [2009, 2014], [2015, 2026]],
    "frontier": [[1998, 2004], [2005, 2021], [2022, 2026]],
    "titan": [[2004, 2015], [2016, 2026]],
    "armada": [[2004, 2015], [2017, 2026]],
    "xterra": [[2000, 2004], [2005, 2015]],
    "quest": [[2004, 2009], [2011, 2017]],
  },
  subaru: {
    "outback": [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2026]],
    "forester": [[1998, 2002], [2003, 2008], [2009, 2013], [2014, 2018], [2019, 2026]],
    "impreza": [[2000, 2007], [2008, 2011], [2012, 2016], [2017, 2026]],
    "legacy": [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2026]],
    "wrx": [[2002, 2007], [2008, 2014], [2015, 2021], [2022, 2026]],
    "crosstrek": [[2013, 2017], [2018, 2023], [2024, 2026]],
    "brz": [[2013, 2020], [2022, 2026]],
    "ascent": [[2019, 2026]],
  },
};

// Commercially relevant legacy vehicles (prioritize these)
const PRIORITY_LEGACY_VEHICLES = [
  // GM Trucks/SUVs
  "chevrolet/silverado-1500", "chevrolet/silverado-2500hd", "chevrolet/silverado-3500hd",
  "gmc/sierra-1500", "gmc/sierra-2500hd", "gmc/sierra-3500hd",
  "chevrolet/tahoe", "chevrolet/suburban", "gmc/yukon", "gmc/yukon-xl",
  "chevrolet/avalanche", "chevrolet/trailblazer", "gmc/envoy",
  
  // Ford Trucks
  "ford/f-150", "ford/f-250", "ford/f-350", "ford/ranger",
  "ford/expedition", "ford/explorer", "ford/excursion",
  
  // Ram Trucks
  "ram/1500", "ram/2500", "ram/3500",
  "dodge/ram-1500", "dodge/ram-2500", "dodge/ram-3500",
  
  // Jeep
  "jeep/wrangler", "jeep/grand-cherokee", "jeep/cherokee", "jeep/liberty", "jeep/commander",
  
  // Performance
  "chevrolet/corvette", "chevrolet/camaro", "ford/mustang",
  "dodge/challenger", "dodge/charger", "dodge/viper",
  
  // Popular sedans/SUVs
  "toyota/camry", "toyota/corolla", "toyota/rav4", "toyota/highlander", "toyota/4runner",
  "honda/accord", "honda/civic", "honda/cr-v", "honda/pilot",
  "nissan/altima", "nissan/maxima", "nissan/pathfinder", "nissan/frontier",
];

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Classification =
  | "missing_generation_def"   // No generation defined for this make/model
  | "no_donor_in_generation"   // Generation defined but no donor records
  | "alias_naming_mismatch"    // Model name doesn't match expected slug
  | "safe_inheritance_candidate" // Has donor in same generation
  | "needs_platform_template"  // Needs new generation template data
  | "manual_override_case";    // Edge case requiring manual data entry

interface ClassifiedRecord {
  id: string;
  year: number;
  make: string;
  model: string;
  displayTrim: string;
  source: string;
  classification: Classification;
  reason: string;
  isPriority: boolean;
  hasDonorInDb: boolean;
  generationDefined: boolean;
  donorYear?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getGeneration(make: string, model: string, year: number): [number, number] | null {
  const makeGens = DEFINED_GENERATIONS[make.toLowerCase()];
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

function hasGenerationDefined(make: string, model: string): boolean {
  const makeGens = DEFINED_GENERATIONS[make.toLowerCase()];
  if (!makeGens) return false;
  return !!makeGens[model.toLowerCase()];
}

function isPriorityVehicle(make: string, model: string): boolean {
  const key = `${make.toLowerCase()}/${model.toLowerCase()}`;
  return PRIORITY_LEGACY_VEHICLES.includes(key);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║      PHASE 2 LEGACY WHEEL COVERAGE ANALYSIS (2000-2014)        ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
  
  try {
    // Get all records with missing wheel sizes (pre-2015)
    const { rows: missingRecords } = await pool.query(`
      SELECT id, year, make, model, display_trim, modification_id, source
      FROM vehicle_fitments
      WHERE year >= 2000 AND year < 2015
        AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR jsonb_array_length(oem_wheel_sizes) = 0)
      ORDER BY year DESC, make, model
    `);
    
    console.log(`Found ${missingRecords.length} records with missing wheel sizes (2000-2014)\n`);
    
    // Classify each record
    const classified: ClassifiedRecord[] = [];
    
    for (const rec of missingRecords) {
      const generation = getGeneration(rec.make, rec.model, rec.year);
      const genDefined = hasGenerationDefined(rec.make, rec.model);
      const priority = isPriorityVehicle(rec.make, rec.model);
      
      // Check if there's a donor in the same generation
      let hasDonor = false;
      let donorYear: number | undefined;
      
      if (generation) {
        const { rows: donors } = await pool.query(`
          SELECT year FROM vehicle_fitments
          WHERE make = $1 AND model = $2
            AND year >= $3 AND year <= $4
            AND oem_wheel_sizes IS NOT NULL 
            AND oem_wheel_sizes != '[]'::jsonb 
            AND jsonb_array_length(oem_wheel_sizes) > 0
          LIMIT 1
        `, [rec.make, rec.model, generation[0], generation[1]]);
        
        if (donors.length > 0) {
          hasDonor = true;
          donorYear = donors[0].year;
        }
      }
      
      // Classify
      let classification: Classification;
      let reason: string;
      
      if (!genDefined) {
        classification = "missing_generation_def";
        reason = `No generation defined for ${rec.make}/${rec.model}`;
      } else if (!generation) {
        classification = "missing_generation_def";
        reason = `Year ${rec.year} not in any defined generation for ${rec.make}/${rec.model}`;
      } else if (hasDonor) {
        classification = "safe_inheritance_candidate";
        reason = `Has donor in generation ${generation[0]}-${generation[1]} (year ${donorYear})`;
      } else {
        // Check if there are ANY records with wheel data for this model
        const { rows: anyDonor } = await pool.query(`
          SELECT year FROM vehicle_fitments
          WHERE make = $1 AND model = $2
            AND oem_wheel_sizes IS NOT NULL 
            AND oem_wheel_sizes != '[]'::jsonb 
            AND jsonb_array_length(oem_wheel_sizes) > 0
          LIMIT 1
        `, [rec.make, rec.model]);
        
        if (anyDonor.length > 0) {
          classification = "no_donor_in_generation";
          reason = `Generation ${generation[0]}-${generation[1]} has no donor, but model has data in other gens`;
        } else {
          classification = "needs_platform_template";
          reason = `No wheel data exists for ${rec.make}/${rec.model} in any year`;
        }
      }
      
      classified.push({
        id: rec.id,
        year: rec.year,
        make: rec.make,
        model: rec.model,
        displayTrim: rec.display_trim,
        source: rec.source,
        classification,
        reason,
        isPriority: priority,
        hasDonorInDb: hasDonor,
        generationDefined: genDefined,
        donorYear,
      });
    }
    
    // Aggregate by classification
    const byClassification: Record<Classification, ClassifiedRecord[]> = {
      missing_generation_def: [],
      no_donor_in_generation: [],
      alias_naming_mismatch: [],
      safe_inheritance_candidate: [],
      needs_platform_template: [],
      manual_override_case: [],
    };
    
    classified.forEach(r => {
      byClassification[r.classification].push(r);
    });
    
    // Print summary
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                    CLASSIFICATION SUMMARY                      ");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    console.log("BY CATEGORY:");
    Object.entries(byClassification)
      .filter(([_, recs]) => recs.length > 0)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([cat, recs]) => {
        const priorityCount = recs.filter(r => r.isPriority).length;
        console.log(`  ${cat}: ${recs.length} (${priorityCount} priority)`);
      });
    
    // By year range
    console.log("\nBY YEAR RANGE:");
    const yearRanges = {
      "2010-2014": classified.filter(r => r.year >= 2010),
      "2005-2009": classified.filter(r => r.year >= 2005 && r.year < 2010),
      "2000-2004": classified.filter(r => r.year < 2005),
    };
    Object.entries(yearRanges).forEach(([range, recs]) => {
      console.log(`  ${range}: ${recs.length}`);
    });
    
    // Top affected makes
    console.log("\nTOP AFFECTED MAKES:");
    const byMake: Record<string, number> = {};
    classified.forEach(r => {
      byMake[r.make] = (byMake[r.make] || 0) + 1;
    });
    Object.entries(byMake)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([make, count]) => {
        console.log(`  ${make}: ${count}`);
      });
    
    // Top affected models
    console.log("\nTOP AFFECTED MODELS:");
    const byModel: Record<string, { count: number; priority: boolean }> = {};
    classified.forEach(r => {
      const key = `${r.make}/${r.model}`;
      if (!byModel[key]) byModel[key] = { count: 0, priority: r.isPriority };
      byModel[key].count++;
    });
    Object.entries(byModel)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .forEach(([model, info]) => {
        const marker = info.priority ? "⭐" : "";
        console.log(`  ${model}: ${info.count} ${marker}`);
      });
    
    // Safe inheritance candidates (the good news)
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("              SAFE INHERITANCE CANDIDATES                       ");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    const safeByModel: Record<string, ClassifiedRecord[]> = {};
    byClassification.safe_inheritance_candidate.forEach(r => {
      const key = `${r.make}/${r.model}`;
      if (!safeByModel[key]) safeByModel[key] = [];
      safeByModel[key].push(r);
    });
    
    console.log(`Total safe candidates: ${byClassification.safe_inheritance_candidate.length}`);
    console.log("\nBy model (top 10):");
    Object.entries(safeByModel)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .forEach(([model, recs]) => {
        const years = [...new Set(recs.map(r => r.year))].sort();
        const priority = recs[0].isPriority ? "⭐ PRIORITY" : "";
        console.log(`  ${model}: ${recs.length} records (years: ${years.join(", ")}) ${priority}`);
      });
    
    // Missing generation definitions
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("             MISSING GENERATION DEFINITIONS                     ");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    const missingGenByModel: Record<string, ClassifiedRecord[]> = {};
    byClassification.missing_generation_def.forEach(r => {
      const key = `${r.make}/${r.model}`;
      if (!missingGenByModel[key]) missingGenByModel[key] = [];
      missingGenByModel[key].push(r);
    });
    
    console.log(`Total: ${byClassification.missing_generation_def.length}`);
    console.log("\nBy model (top 15):");
    Object.entries(missingGenByModel)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 15)
      .forEach(([model, recs]) => {
        const years = [...new Set(recs.map(r => r.year))].sort();
        const priority = recs[0].isPriority ? "⭐ PRIORITY" : "";
        console.log(`  ${model}: ${recs.length} (years: ${years.join(", ")}) ${priority}`);
      });
    
    // Needs platform template
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("              NEEDS PLATFORM TEMPLATE DATA                      ");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    const needsTemplateByModel: Record<string, ClassifiedRecord[]> = {};
    byClassification.needs_platform_template.forEach(r => {
      const key = `${r.make}/${r.model}`;
      if (!needsTemplateByModel[key]) needsTemplateByModel[key] = [];
      needsTemplateByModel[key].push(r);
    });
    
    console.log(`Total: ${byClassification.needs_platform_template.length}`);
    console.log("\nBy model (all with count > 5):");
    Object.entries(needsTemplateByModel)
      .sort((a, b) => b[1].length - a[1].length)
      .filter(([_, recs]) => recs.length > 5)
      .forEach(([model, recs]) => {
        const priority = recs[0].isPriority ? "⭐ PRIORITY" : "";
        console.log(`  ${model}: ${recs.length} ${priority}`);
      });
    
    // Recommendations
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("                   PHASE 2 RECOMMENDATIONS                      ");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    // Safe bucket
    const safeCount = byClassification.safe_inheritance_candidate.length;
    const safePriorityCount = byClassification.safe_inheritance_candidate.filter(r => r.isPriority).length;
    
    console.log("✅ SAFE TO AUTO-FILL:");
    console.log(`   ${safeCount} records are safe inheritance candidates`);
    console.log(`   ${safePriorityCount} of these are priority vehicles`);
    console.log("   Action: Expand fill-wheel-sizes.ts to include these generations\n");
    
    // Needs gen definition
    const missingGenCount = byClassification.missing_generation_def.length;
    const missingGenPriority = byClassification.missing_generation_def.filter(r => r.isPriority).length;
    
    console.log("🔧 NEEDS GENERATION DEFINITIONS:");
    console.log(`   ${missingGenCount} records have undefined generations`);
    console.log(`   ${missingGenPriority} of these are priority vehicles`);
    console.log("   Action: Add generation definitions to DEFINED_GENERATIONS, then fill\n");
    
    // Needs template
    const needsTemplateCount = byClassification.needs_platform_template.length;
    const needsTemplatePriority = byClassification.needs_platform_template.filter(r => r.isPriority).length;
    
    console.log("📋 NEEDS PLATFORM TEMPLATE DATA:");
    console.log(`   ${needsTemplateCount} records have NO existing wheel data in any year`);
    console.log(`   ${needsTemplatePriority} of these are priority vehicles`);
    console.log("   Action: Import or manually seed wheel specs for these models\n");
    
    // Do NOT auto-fill
    console.log("⛔ DO NOT AUTO-FILL:");
    console.log("   - Records in needs_platform_template (no donor data exists)");
    console.log("   - Models with complex trim variations (check for alias issues)");
    console.log("   - Any record where donor is from a different generation");
    
    // Save results
    const outputDir = path.resolve(__dirname);
    const resultsPath = path.join(outputDir, "legacy-wheel-analysis.json");
    await fs.writeFile(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: classified.length,
        byClassification: {
          safe_inheritance_candidate: byClassification.safe_inheritance_candidate.length,
          missing_generation_def: byClassification.missing_generation_def.length,
          no_donor_in_generation: byClassification.no_donor_in_generation.length,
          needs_platform_template: byClassification.needs_platform_template.length,
          alias_naming_mismatch: byClassification.alias_naming_mismatch.length,
          manual_override_case: byClassification.manual_override_case.length,
        },
        priorityCounts: {
          safe_inheritance_candidate: byClassification.safe_inheritance_candidate.filter(r => r.isPriority).length,
          missing_generation_def: byClassification.missing_generation_def.filter(r => r.isPriority).length,
          needs_platform_template: byClassification.needs_platform_template.filter(r => r.isPriority).length,
        },
      },
      safeInheritanceByModel: Object.entries(safeByModel)
        .map(([model, recs]) => ({
          model,
          count: recs.length,
          years: [...new Set(recs.map(r => r.year))].sort(),
          isPriority: recs[0].isPriority,
        }))
        .sort((a, b) => b.count - a.count),
      missingGenByModel: Object.entries(missingGenByModel)
        .map(([model, recs]) => ({
          model,
          count: recs.length,
          years: [...new Set(recs.map(r => r.year))].sort(),
          isPriority: recs[0].isPriority,
        }))
        .sort((a, b) => b.count - a.count),
      needsTemplateByModel: Object.entries(needsTemplateByModel)
        .map(([model, recs]) => ({
          model,
          count: recs.length,
          isPriority: recs[0].isPriority,
        }))
        .sort((a, b) => b.count - a.count),
    }, null, 2));
    
    console.log(`\n📄 Results saved to: ${resultsPath}`);
    
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
