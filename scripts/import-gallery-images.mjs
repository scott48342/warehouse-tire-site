#!/usr/bin/env node
/**
 * Import Gallery Images from Fitment Industries
 * 
 * Usage:
 *   node scripts/import-gallery-images.mjs --make=Ford --model=F-150
 *   node scripts/import-gallery-images.mjs --url="https://www.fitmentindustries.com/wheel-offset-gallery?..."
 *   node scripts/import-gallery-images.mjs --batch --years=2020-2024
 * 
 * Data is scraped from Fitment Industries gallery (owned by WheelPros).
 * Each gallery entry has:
 * - Vehicle: year/make/model/trim
 * - Wheel: brand, diameter, width, offset
 * - Tire: brand, model, size
 * - Suspension: brand, type (stock, lowered, lifted)
 * - Fitment: flush, poke, tucked, etc.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Mock database client - replace with your actual connection
const mockDb = {
  async upsert(record) {
    console.log(`[MOCK] Would upsert:`, JSON.stringify(record, null, 2));
    return { id: "mock-" + Date.now() };
  }
};

// ============================================================================
// Parsers for Fitment Industries data
// ============================================================================

/**
 * Parse wheel spec string like "18x9.5 38mm"
 */
function parseWheelSpec(spec) {
  if (!spec) return null;
  
  // Match "18x9.5 38mm" or "20x10 30mm — Rear: 20x11 50mm"
  const match = spec.match(/(\d+)x([\d.]+)\s*([-\d]+)mm/);
  if (!match) return null;
  
  return {
    diameter: parseInt(match[1], 10),
    width: parseFloat(match[2]),
    offsetMm: parseInt(match[3], 10),
  };
}

/**
 * Parse rear wheel spec from staggered string
 */
function parseRearWheelSpec(spec) {
  if (!spec || !spec.includes("Rear:")) return null;
  
  const rearMatch = spec.match(/Rear:\s*(\d+)x([\d.]+)\s*([-\d]+)mm/);
  if (!rearMatch) return null;
  
  return {
    diameter: parseInt(rearMatch[1], 10),
    width: parseFloat(rearMatch[2]),
    offsetMm: parseInt(rearMatch[3], 10),
  };
}

/**
 * Infer lift level from suspension info
 */
function inferLiftLevel(suspensionBrand, suspensionType) {
  const lowered = /lowering|coilover|air|airlift|bags|slammed/i;
  const lifted = /lift|leveling|level|rough country|fabtech|ready ?lift/i;
  
  const combined = `${suspensionBrand || ""} ${suspensionType || ""}`;
  
  if (lowered.test(combined)) {
    if (/slam|air|bags/i.test(combined)) return "slammed";
    return "lowered";
  }
  if (/level/i.test(combined)) return "leveled";
  if (lifted.test(combined)) return "lifted";
  if (/stock/i.test(combined)) return "stock";
  
  return "stock"; // Default
}

/**
 * Infer suspension type from brand/description
 */
function inferSuspensionType(suspensionBrand) {
  if (!suspensionBrand) return "stock";
  
  const brand = suspensionBrand.toLowerCase();
  
  if (/coilover|bc racing|ksport|tein|fortune auto/i.test(brand)) return "coilovers";
  if (/air|airlift|accuair|airmext|bags/i.test(brand)) return "air";
  if (/lowering spring|eibach|h&r|swift/i.test(brand)) return "lowering_springs";
  if (/lift|level|rough country|fabtech|readylift|bilstein/i.test(brand)) return "lift_kit";
  if (/stock|oem/i.test(brand)) return "stock";
  
  return "stock";
}

/**
 * Infer build style from wheel size and lift level
 */
function inferBuildStyle(wheelDiameter, liftLevel, fitmentType) {
  // Offroad builds: lifted trucks with larger wheels
  if (liftLevel === "lifted" && wheelDiameter >= 17) return "offroad";
  
  // Aggressive: flush/poke fitment with low offset
  if (fitmentType === "hellaflush" || fitmentType === "poke") return "aggressive";
  
  // Show: slammed air suspension
  if (liftLevel === "slammed") return "show";
  
  // Default to daily
  return "daily";
}

/**
 * Normalize fitment type from Fitment Industries terminology
 */
function normalizeFitmentType(fiType) {
  const map = {
    "flush": "flush",
    "hellaflush": "hellaflush",
    "nearly flush": "nearly_flush",
    "nearlyflush": "nearly_flush",
    "poke": "poke",
    "tucked": "tucked",
  };
  return map[(fiType || "").toLowerCase()] || "flush";
}

// ============================================================================
// Gallery Entry Parser
// ============================================================================

/**
 * Parse a Fitment Industries gallery entry
 * Expected structure from scraping the gallery page
 */
function parseGalleryEntry(entry) {
  // Entry example from FI:
  // {
  //   url: "/wheel-offset-gallery/3445305/2026-honda-civic-enkei-rpf1...",
  //   imageUrl: "https://cdn.fitmentindustries.com/...",
  //   vehicle: "2026 Honda Civic Si",
  //   wheelBrand: "Enkei Rpf1",
  //   wheelSpec: "18x9.5 38mm",
  //   tireBrand: "Kenda Kaiser Kr20a", 
  //   tireSize: "265/55R18",
  //   suspensionBrand: "REV9",
  //   suspensionType: "Coilovers",
  //   fitmentType: "Flush",
  // }
  
  // Parse vehicle
  const vehicleMatch = (entry.vehicle || "").match(/^(\d{4})\s+(.+?)\s+(\S+)(?:\s+(.+))?$/);
  if (!vehicleMatch) {
    console.warn(`Could not parse vehicle: ${entry.vehicle}`);
    return null;
  }
  
  const [, year, makeModel, trim] = vehicleMatch;
  
  // Split make from model (heuristic)
  const makeModelParts = makeModel.split(" ");
  const make = makeModelParts[0];
  const model = makeModelParts.slice(1).join(" ") || trim;
  
  // Parse wheel specs
  const wheelSpec = parseWheelSpec(entry.wheelSpec);
  const rearWheelSpec = parseRearWheelSpec(entry.wheelSpec);
  
  // Infer metadata
  const suspensionType = inferSuspensionType(entry.suspensionBrand);
  const liftLevel = inferLiftLevel(entry.suspensionBrand, entry.suspensionType);
  const fitmentType = normalizeFitmentType(entry.fitmentType);
  const buildStyle = inferBuildStyle(wheelSpec?.diameter, liftLevel, fitmentType);
  
  // Extract source ID from URL
  const sourceIdMatch = (entry.url || "").match(/\/(\d+)\//);
  const sourceId = sourceIdMatch ? sourceIdMatch[1] : null;
  
  return {
    // Image
    imageUrl: entry.imageUrl,
    thumbnailUrl: entry.thumbnailUrl || entry.imageUrl,
    
    // Source
    source: "fitment_industries",
    sourceId: sourceId,
    sourceUrl: entry.url ? `https://www.fitmentindustries.com${entry.url}` : null,
    
    // Vehicle
    vehicleYear: parseInt(year, 10),
    vehicleMake: make,
    vehicleModel: model,
    vehicleTrim: trim || null,
    
    // Wheel (front)
    wheelBrand: entry.wheelBrand,
    wheelModel: null, // FI doesn't separate brand/model well
    wheelDiameter: wheelSpec?.diameter,
    wheelWidth: wheelSpec?.width,
    wheelOffsetMm: wheelSpec?.offsetMm,
    
    // Wheel (rear) for staggered
    rearWheelDiameter: rearWheelSpec?.diameter,
    rearWheelWidth: rearWheelSpec?.width,
    rearWheelOffsetMm: rearWheelSpec?.offsetMm,
    isStaggered: rearWheelSpec !== null,
    
    // Tire
    tireBrand: entry.tireBrand,
    tireModel: null,
    tireSize: entry.tireSize,
    rearTireSize: entry.rearTireSize || null,
    
    // Suspension
    suspensionType: suspensionType,
    suspensionBrand: entry.suspensionBrand,
    liftLevel: liftLevel,
    
    // Fitment
    fitmentType: fitmentType,
    
    // Spacers
    spacerSizeMm: null, // Would need additional parsing
    rearSpacerSizeMm: null,
    
    // Build style
    buildStyle: buildStyle,
    
    // Metadata
    title: `${year} ${make} ${model} with ${entry.wheelBrand}`,
    description: null,
    tags: [
      make.toLowerCase(),
      model.toLowerCase().replace(/\s+/g, "_"),
      entry.wheelBrand?.toLowerCase().replace(/\s+/g, "_"),
      liftLevel,
      fitmentType,
    ].filter(Boolean),
    
    // Status
    status: "active",
    importedAt: new Date(),
  };
}

// ============================================================================
// Sample Data (for testing without scraping)
// ============================================================================

const sampleGalleryData = [
  {
    url: "/wheel-offset-gallery/3445305/2026-honda-civic-enkei-rpf1",
    imageUrl: "https://images.fitmentindustries.com/gallery/full/3445305.jpg",
    vehicle: "2026 Honda Civic Si",
    wheelBrand: "Enkei Rpf1",
    wheelSpec: "18x9.5 38mm",
    tireBrand: "Kenda Kaiser Kr20a",
    tireSize: "265/55R18",
    suspensionBrand: "REV9",
    suspensionType: "Coilovers",
    fitmentType: "Flush",
  },
  {
    url: "/wheel-offset-gallery/3487223/2026-ford-mustang-variant-sena",
    imageUrl: "https://images.fitmentindustries.com/gallery/full/3487223.jpg",
    vehicle: "2026 Ford Mustang GT Premium",
    wheelBrand: "Variant Sena",
    wheelSpec: "20x10 30mm — Rear: 20x11 50mm",
    tireBrand: "Nitto Nt555 G2",
    tireSize: "265/35R20",
    rearTireSize: "315/35R20",
    suspensionBrand: "Steeda",
    suspensionType: "Lowering Springs",
    fitmentType: "Flush",
  },
  {
    url: "/wheel-offset-gallery/example-f150-lifted",
    imageUrl: "https://images.fitmentindustries.com/gallery/full/example.jpg",
    vehicle: "2024 Ford F-150 XLT",
    wheelBrand: "Fuel Rebel",
    wheelSpec: "20x10 -18mm",
    tireBrand: "Nitto Ridge Grappler",
    tireSize: "33x12.50R20",
    suspensionBrand: "Rough Country",
    suspensionType: "4 Inch Lift",
    fitmentType: "Poke",
  },
];

// ============================================================================
// Main Import Function
// ============================================================================

async function importGalleryImages(options = {}) {
  const { dryRun = true, data = sampleGalleryData } = options;
  
  console.log(`\\n${"=".repeat(60)}`);
  console.log(`Gallery Image Import`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Records: ${data.length}`);
  console.log(`${"=".repeat(60)}\\n`);
  
  const results = {
    processed: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };
  
  for (const entry of data) {
    results.processed++;
    
    try {
      const parsed = parseGalleryEntry(entry);
      
      if (!parsed) {
        results.skipped++;
        continue;
      }
      
      console.log(`\\n[${results.processed}/${data.length}] ${parsed.title}`);
      console.log(`  Vehicle: ${parsed.vehicleYear} ${parsed.vehicleMake} ${parsed.vehicleModel}`);
      console.log(`  Wheel: ${parsed.wheelBrand} ${parsed.wheelDiameter}x${parsed.wheelWidth} ${parsed.wheelOffsetMm}mm`);
      console.log(`  Tire: ${parsed.tireBrand} ${parsed.tireSize}`);
      console.log(`  Style: ${parsed.liftLevel} / ${parsed.fitmentType} / ${parsed.buildStyle}`);
      console.log(`  Staggered: ${parsed.isStaggered}`);
      
      if (!dryRun) {
        await mockDb.upsert(parsed);
        results.inserted++;
      }
      
    } catch (error) {
      results.errors.push({ entry, error: error.message });
      console.error(`  ERROR: ${error.message}`);
    }
  }
  
  console.log(`\\n${"=".repeat(60)}`);
  console.log(`Import Summary`);
  console.log(`  Processed: ${results.processed}`);
  console.log(`  Inserted: ${results.inserted}`);
  console.log(`  Skipped: ${results.skipped}`);
  console.log(`  Errors: ${results.errors.length}`);
  console.log(`${"=".repeat(60)}\\n`);
  
  return results;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const args = process.argv.slice(2);
const dryRun = !args.includes("--live");

importGalleryImages({ dryRun })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
