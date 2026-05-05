/**
 * Wheel-Size Trim Mapping Validation Script
 * 
 * Tests the trim mapping system end-to-end for known problem vehicles.
 * Run: npx tsx scripts/validate-trim-mappings.ts
 */

// Load environment variables first
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { wheelSizeTrimMappings, vehicleFitments, vehicleFitmentConfigurations } from "../src/lib/fitment-db/schema";
import { buildMappingsForVehicle, getTrimMapping } from "../src/lib/fitment-db/wheelSizeTrimMapping";
import { resolveVehicleFitment } from "../src/lib/fitment/canonicalResolver";
import { eq, and, ilike } from "drizzle-orm";
import { normalizeMake, normalizeModel } from "../src/lib/fitment-db/keys";

// Test vehicles that previously showed unnecessary size choices
const TEST_VEHICLES = [
  { year: 2024, make: "Ford", model: "F-150", trim: "XLT" },
  { year: 2024, make: "Chevrolet", model: "Silverado 1500", trim: "LT" },
  { year: 2024, make: "GMC", model: "Sierra 1500", trim: "Elevation" },
  { year: 2024, make: "Ram", model: "1500", trim: "Big Horn" },
  { year: 2024, make: "Toyota", model: "Tacoma", trim: "SR5" },
  { year: 2024, make: "Honda", model: "Accord", trim: "Sport" },
  { year: 2024, make: "Toyota", model: "Camry", trim: "SE" },
  { year: 2024, make: "Jeep", model: "Grand Cherokee", trim: "Limited" },
];

interface ValidationResult {
  vehicle: string;
  trim: string;
  beforeBehavior: string;
  mappingCreated: boolean;
  mappingStatus: string | null;
  mappingConfidence: string | null;
  showSizeChooser: boolean | null;
  autoSelectedConfig: string | null;
  warnings: string[];
  afterBehavior: string;
  passFail: "PASS" | "FAIL" | "SKIP";
  notes: string;
}

async function getBeforeBehavior(year: number, make: string, model: string, trim: string): Promise<string> {
  // Check how many OEM sizes exist for this vehicle
  const makeKey = normalizeMake(make);
  const modelKey = normalizeModel(model);
  
  const fitments = await db
    .select()
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, year),
        ilike(vehicleFitments.make, makeKey),
        ilike(vehicleFitments.model, modelKey),
        eq(vehicleFitments.certificationStatus, "certified")
      )
    )
    .limit(10);
  
  if (fitments.length === 0) {
    return "No fitment data";
  }
  
  // Get unique tire sizes across all trims
  const allSizes = new Set<string>();
  for (const f of fitments) {
    const sizes = (f.oemTireSizes as string[]) || [];
    sizes.forEach(s => allSizes.add(s));
  }
  
  // Get configurations count
  const configs = await db
    .select()
    .from(vehicleFitmentConfigurations)
    .where(
      and(
        eq(vehicleFitmentConfigurations.year, year),
        eq(vehicleFitmentConfigurations.makeKey, makeKey),
        eq(vehicleFitmentConfigurations.modelKey, modelKey)
      )
    )
    .limit(20);
  
  const uniqueDiameters = [...new Set(configs.map(c => c.wheelDiameter))];
  
  if (uniqueDiameters.length > 1) {
    return `${uniqueDiameters.length} diameters (${uniqueDiameters.join(", ")}")→ SHOWS CHOOSER`;
  } else if (uniqueDiameters.length === 1) {
    return `1 diameter (${uniqueDiameters[0]}") → AUTO-SELECT`;
  } else if (allSizes.size > 1) {
    return `${allSizes.size} sizes (legacy) → SHOWS CHOOSER`;
  } else if (allSizes.size === 1) {
    return `1 size (legacy) → AUTO-SELECT`;
  }
  
  return "Unknown";
}

async function validateVehicle(vehicle: typeof TEST_VEHICLES[0]): Promise<ValidationResult> {
  const { year, make, model, trim } = vehicle;
  const vehicleStr = `${year} ${make} ${model}`;
  
  console.log(`\n🔍 Testing: ${vehicleStr} ${trim}`);
  
  const result: ValidationResult = {
    vehicle: vehicleStr,
    trim,
    beforeBehavior: "",
    mappingCreated: false,
    mappingStatus: null,
    mappingConfidence: null,
    showSizeChooser: null,
    autoSelectedConfig: null,
    warnings: [],
    afterBehavior: "",
    passFail: "SKIP",
    notes: "",
  };
  
  try {
    // 1. Get before behavior
    result.beforeBehavior = await getBeforeBehavior(year, make, model, trim);
    console.log(`   Before: ${result.beforeBehavior}`);
    
    // 2. Check if fitment data exists
    const makeKey = normalizeMake(make);
    const modelKey = normalizeModel(model);
    
    const fitments = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          ilike(vehicleFitments.make, makeKey),
          ilike(vehicleFitments.model, modelKey),
          eq(vehicleFitments.certificationStatus, "certified")
        )
      )
      .limit(1);
    
    if (fitments.length === 0) {
      result.notes = "No fitment data in DB";
      result.passFail = "SKIP";
      console.log(`   ⏭️  SKIP: No fitment data`);
      return result;
    }
    
    // 3. Build mappings for this vehicle
    console.log(`   Building mappings...`);
    const buildResult = await buildMappingsForVehicle(year, make, model);
    console.log(`   Built: ${buildResult.created} created, ${buildResult.updated} updated, ${buildResult.skipped} skipped`);
    result.mappingCreated = buildResult.created > 0 || buildResult.updated > 0;
    
    // 4. Get the mapping for this specific trim
    const mappingResult = await getTrimMapping(year, make, model, trim);
    
    if (!mappingResult.found || !mappingResult.mapping) {
      result.notes = "No mapping created for this trim";
      result.afterBehavior = result.beforeBehavior; // Unchanged
      result.passFail = "SKIP";
      console.log(`   ⏭️  SKIP: No mapping for trim "${trim}"`);
      return result;
    }
    
    result.mappingStatus = mappingResult.mapping.status;
    result.mappingConfidence = mappingResult.mapping.matchConfidence;
    result.showSizeChooser = mappingResult.showSizeChooser;
    
    if (mappingResult.autoSelectConfig) {
      result.autoSelectedConfig = `${mappingResult.autoSelectConfig.wheelDiameter}" / ${mappingResult.autoSelectConfig.tireSize}`;
    }
    
    // Check for warnings
    if (mappingResult.mapping.wsTrim && /^\d+\.\d+[ilLvV]?$/.test(mappingResult.mapping.wsTrim)) {
      result.warnings.push("Engine-based WS trim naming");
    }
    if (mappingResult.mapping.matchConfidence === "low") {
      result.warnings.push("Low confidence match");
    }
    if (mappingResult.configurations.length > 1) {
      result.warnings.push(`${mappingResult.configurations.length} configs`);
    }
    
    console.log(`   Mapping: status=${result.mappingStatus}, confidence=${result.mappingConfidence}`);
    console.log(`   showSizeChooser=${result.showSizeChooser}, autoSelect=${result.autoSelectedConfig || "none"}`);
    
    // 5. Test canonicalResolver
    const resolverResult = await resolveVehicleFitment({
      year,
      make,
      model,
      trim,
    });
    
    console.log(`   Resolver: matchedBy=${resolverResult.matchedBy}`);
    console.log(`   trimMapping.found=${resolverResult.trimMapping.found}, showSizeChooser=${resolverResult.trimMapping.showSizeChooser}`);
    
    // 6. Determine after behavior
    if (resolverResult.trimMapping.found && !resolverResult.trimMapping.showSizeChooser && resolverResult.trimMapping.autoSelectedConfig) {
      result.afterBehavior = `AUTO-SELECT ${resolverResult.trimMapping.autoSelectedConfig.wheelDiameter}" (trim mapping)`;
    } else if (resolverResult.trimMapping.found && resolverResult.trimMapping.showSizeChooser) {
      const configs = resolverResult.trimMapping.configurations;
      result.afterBehavior = `CHOOSER with ${configs.length} mapped configs (${configs.map(c => c.wheelDiameter + '"').join(", ")})`;
    } else {
      result.afterBehavior = result.beforeBehavior + " (no mapping applied)";
    }
    
    // 7. Validation checks
    const checks = {
      trimLabelUnchanged: resolverResult.displayTrim === trim || resolverResult.displayTrim === null,
      noEngineLabelsExposed: !resolverResult.displayTrim?.match(/^\d+\.\d+[ilLvV]?$/),
      mappingRespected: resolverResult.matchedBy === "wheel_size_trim_mapping" || 
                        (result.mappingStatus !== "approved" && resolverResult.matchedBy !== "wheel_size_trim_mapping"),
    };
    
    const allPassed = Object.values(checks).every(Boolean);
    result.passFail = allPassed ? "PASS" : "FAIL";
    
    if (!checks.trimLabelUnchanged) result.notes += "FAIL: Trim label changed. ";
    if (!checks.noEngineLabelsExposed) result.notes += "FAIL: Engine label exposed. ";
    
    console.log(`   Result: ${result.passFail}`);
    
  } catch (error) {
    result.passFail = "FAIL";
    result.notes = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.log(`   ❌ ERROR: ${result.notes}`);
  }
  
  return result;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  WHEEL-SIZE TRIM MAPPING VALIDATION");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Testing ${TEST_VEHICLES.length} vehicles`);
  console.log("═══════════════════════════════════════════════════════════════");
  
  const results: ValidationResult[] = [];
  
  for (const vehicle of TEST_VEHICLES) {
    const result = await validateVehicle(vehicle);
    results.push(result);
  }
  
  // Print summary table
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  VALIDATION SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  // Table header
  console.log("| Vehicle | Trim | Before | Status | Confidence | showChooser | autoSelect | Pass/Fail |");
  console.log("|---------|------|--------|--------|------------|-------------|------------|-----------|");
  
  for (const r of results) {
    const showChooser = r.showSizeChooser === null ? "-" : r.showSizeChooser ? "true" : "false";
    const autoSelect = r.autoSelectedConfig || "-";
    console.log(`| ${r.vehicle.substring(0, 20).padEnd(20)} | ${r.trim.substring(0, 12).padEnd(12)} | ${r.beforeBehavior.substring(0, 25).padEnd(25)} | ${(r.mappingStatus || "-").padEnd(10)} | ${(r.mappingConfidence || "-").padEnd(10)} | ${showChooser.padEnd(11)} | ${autoSelect.substring(0, 15).padEnd(15)} | ${r.passFail.padEnd(9)} |`);
  }
  
  // Stats
  const passed = results.filter(r => r.passFail === "PASS").length;
  const failed = results.filter(r => r.passFail === "FAIL").length;
  const skipped = results.filter(r => r.passFail === "SKIP").length;
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed} PASS | ${failed} FAIL | ${skipped} SKIP`);
  console.log("═══════════════════════════════════════════════════════════════");
  
  // Detailed results
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  DETAILED RESULTS");
  console.log("═══════════════════════════════════════════════════════════════");
  
  for (const r of results) {
    console.log(`\n${r.vehicle} ${r.trim}`);
    console.log(`  Before: ${r.beforeBehavior}`);
    console.log(`  After:  ${r.afterBehavior}`);
    console.log(`  Mapping: status=${r.mappingStatus || "none"}, confidence=${r.mappingConfidence || "none"}`);
    console.log(`  showSizeChooser: ${r.showSizeChooser}`);
    console.log(`  autoSelectedConfig: ${r.autoSelectedConfig || "none"}`);
    if (r.warnings.length > 0) console.log(`  Warnings: ${r.warnings.join(", ")}`);
    if (r.notes) console.log(`  Notes: ${r.notes}`);
    console.log(`  Result: ${r.passFail}`);
  }
  
  // Output JSON for further processing
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  JSON OUTPUT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(JSON.stringify(results, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
