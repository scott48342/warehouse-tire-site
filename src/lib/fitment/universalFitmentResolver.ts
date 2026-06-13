/**
 * UNIVERSAL FITMENT RESOLVER
 * 
 * The ONE source of truth for all fitment lookups across the entire site.
 * 
 * USAGE:
 *   import { resolveUniversalFitment } from "@/lib/fitment/universalFitmentResolver";
 *   const fitment = await resolveUniversalFitment({ year: 2023, make: "Chevrolet", model: "Silverado 2500 HD" });
 * 
 * ALL model normalization, aliases, and DB lookups are encapsulated here.
 * No other code should directly query vehicle_fitments, use MODEL_ALIASES, or call
 * canonicalResolver/buildFitmentProfile/getFitment directly.
 * 
 * @created 2026-06-13
 */

import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and, ilike, or, asc, sql } from "drizzle-orm";
import { applyOverrides } from "@/lib/fitment-db/applyOverrides";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface UniversalFitmentInput {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  wheelDiameter?: number | null;
}

export interface UniversalFitmentResult {
  // Echo back what was requested
  input: {
    year: number;
    make: string;
    model: string;
    trim: string | null;
    wheelDiameter: number | null;
  };
  
  // Normalized versions used for lookup
  normalized: {
    make: string;           // Canonical make (e.g., "Chevrolet")
    model: string;          // DB model name that matched (e.g., "Silverado 2500HD")
    trim: string | null;    // Matched trim or null
    modelVariantsTried: string[];  // All variants attempted
    matchedVariant: string | null; // Which variant matched
  };
  
  // Canonical key for caching/deduplication
  canonicalVehicleKey: string;  // e.g., "2023|chevrolet|silverado-2500hd|lt"
  
  // Vehicle identity
  year: number;
  make: string;
  model: string;
  trim: string | null;
  modificationId: string | null;
  
  // Core fitment specs
  boltPattern: string | null;
  centerBore: number | null;
  threadSize: string | null;
  lugSeatType: string | null;
  
  // Tire data
  oemTireSizes: string[];
  oemTireSizesStaggered: {
    front: string[];
    rear: string[];
  } | null;
  
  // Wheel ranges
  wheelDiameterRange: { min: number; max: number } | null;
  wheelWidthRange: { min: number; max: number } | null;
  offsetRange: { min: number; max: number } | null;
  
  // OEM wheel specs (raw)
  oemWheelSizes: Array<{
    diameter: number;
    width: number;
    offset: number | null;
    axle?: "front" | "rear" | "both";
  }>;
  
  // Resolution metadata
  found: boolean;
  source: "vehicle_fitments" | "legacy_vehicles" | "fallback" | "none";
  qualityTier: "complete" | "partial" | "low_confidence" | "unknown";
  confidence: "high" | "medium" | "low";
  
  // Available trims (for trim selection UI)
  availableTrims: Array<{
    modificationId: string;
    displayTrim: string;
    tireSizes: string[];
  }>;
  
  // Warnings and debug info
  warnings: string[];
  debug: {
    resolutionTimeMs: number;
    dbQueriesCount: number;
    matchedBy: string | null;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAKE ALIASES (Canonical → DB format)
// ═══════════════════════════════════════════════════════════════════════════

const MAKE_ALIASES: Record<string, string> = {
  // Common abbreviations
  "chevy": "Chevrolet",
  "chevrolet": "Chevrolet",
  "gmc": "GMC",
  "vw": "Volkswagen",
  "volkswagen": "Volkswagen",
  "mb": "Mercedes",  // Use short form - DB has both "Mercedes" and "Mercedes-Benz"
  "mercedes": "Mercedes",
  "mercedes-benz": "Mercedes",
  "merc": "Mercedes",
  "bmw": "BMW",
  "land rover": "Land Rover",
  "land-rover": "Land Rover",
  "landrover": "Land Rover",
  "alfa romeo": "Alfa Romeo",
  "alfa-romeo": "Alfa Romeo",
  "alfaromeo": "Alfa Romeo",
  "aston martin": "Aston Martin",
  "aston-martin": "Aston Martin",
  "astonmartin": "Aston Martin",
  // Add more as needed
};

/**
 * Normalize make name to canonical DB format
 */
function normalizeMake(make: string): string {
  const key = make.toLowerCase().trim();
  if (MAKE_ALIASES[key]) {
    return MAKE_ALIASES[key];
  }
  // Title case fallback
  return make.trim().split(/\s+/).map(w => 
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(" ");
}

// ═══════════════════════════════════════════════════════════════════════════
// MODEL ALIASES (User input → Actual DB model names)
// 
// CRITICAL: Values MUST be actual DB model names (title case), NOT slugs!
// The DB stores "Silverado 2500HD", not "silverado-2500hd"
// ═══════════════════════════════════════════════════════════════════════════

const MODEL_ALIASES: Record<string, string[]> = {
  // ─────────────────────────────────────────────────────────────────────────
  // CHEVROLET HD TRUCKS
  // DB stores: "Silverado 2500HD" (title case, no space before HD)
  // ─────────────────────────────────────────────────────────────────────────
  "silverado": ["Silverado 1500", "Silverado"],
  "silverado-1500": ["Silverado 1500", "Silverado"],
  "silverado-2500": ["Silverado 2500HD", "Silverado 2500"],
  "silverado-2500hd": ["Silverado 2500HD", "Silverado 2500"],
  "silverado-2500-hd": ["Silverado 2500HD", "Silverado 2500"],
  "silverado-3500": ["Silverado 3500HD", "Silverado 3500"],
  "silverado-3500hd": ["Silverado 3500HD", "Silverado 3500"],
  "silverado-3500-hd": ["Silverado 3500HD", "Silverado 3500"],

  // ─────────────────────────────────────────────────────────────────────────
  // GMC HD TRUCKS
  // DB stores: "Sierra 2500HD" (title case, no space before HD)
  // ─────────────────────────────────────────────────────────────────────────
  "sierra": ["Sierra 1500", "Sierra"],
  "sierra-1500": ["Sierra 1500", "Sierra"],
  "sierra-2500": ["Sierra 2500HD", "Sierra 2500"],
  "sierra-2500hd": ["Sierra 2500HD", "Sierra 2500"],
  "sierra-2500-hd": ["Sierra 2500HD", "Sierra 2500"],
  "sierra-3500": ["Sierra 3500HD", "Sierra 3500"],
  "sierra-3500hd": ["Sierra 3500HD", "Sierra 3500"],
  "sierra-3500-hd": ["Sierra 3500HD", "Sierra 3500"],

  // ─────────────────────────────────────────────────────────────────────────
  // RAM TRUCKS
  // DB stores: "1500", "2500", "3500" (just numbers for Ram)
  // ─────────────────────────────────────────────────────────────────────────
  "ram": ["1500", "Ram 1500"],
  "ram-1500": ["1500", "Ram 1500"],
  "ram-2500": ["2500", "Ram 2500"],
  "ram-3500": ["3500", "Ram 3500"],
  "1500": ["1500", "Ram 1500"],
  "2500": ["2500", "Ram 2500"],
  "3500": ["3500", "Ram 3500"],

  // ─────────────────────────────────────────────────────────────────────────
  // FORD F-SERIES
  // ─────────────────────────────────────────────────────────────────────────
  "f-150": ["F-150", "F150"],
  "f150": ["F-150", "F150"],
  "f-250": ["F-250", "F250", "F-250 Super Duty"],
  "f250": ["F-250", "F250", "F-250 Super Duty"],
  "f-250-super-duty": ["F-250", "F-250 Super Duty"],
  "f-350": ["F-350", "F350", "F-350 Super Duty"],
  "f350": ["F-350", "F350", "F-350 Super Duty"],
  "f-350-super-duty": ["F-350", "F-350 Super Duty"],

  // ─────────────────────────────────────────────────────────────────────────
  // LEXUS RX VARIANTS
  // ─────────────────────────────────────────────────────────────────────────
  "rx-350": ["RX", "RX 350"],
  "rx-450h": ["RX", "RX 450h"],
  "rx350": ["RX", "RX 350"],
  "rx450h": ["RX", "RX 450h"],

  // ─────────────────────────────────────────────────────────────────────────
  // BMW SERIES
  // ─────────────────────────────────────────────────────────────────────────
  "3-series": ["3 Series"],
  "3 series": ["3 Series"],
  "5-series": ["5 Series"],
  "5 series": ["5 Series"],
  "x5": ["X5"],
  "x3": ["X3"],
  
  // ─────────────────────────────────────────────────────────────────────────
  // MERCEDES CLASSES (slug → DB title case)
  // ─────────────────────────────────────────────────────────────────────────
  // Standard classes
  "a-class": ["A-Class", "A Class"],
  "b-class": ["B-Class", "B Class"],
  "c-class": ["C-Class", "C Class"],
  "cla-class": ["CLA-Class", "CLA Class", "CLA"],
  "clk-class": ["CLK-Class", "CLK Class", "CLK"],
  "cls-class": ["CLS-Class", "CLS Class", "CLS"],
  "e-class": ["E-Class", "E Class"],
  "g-class": ["G-Class", "G Class"],
  "gl-class": ["GL-Class", "GL Class", "GL"],
  "gla-class": ["GLA-Class", "GLA Class", "GLA"],
  "glb-class": ["GLB-Class", "GLB Class", "GLB"],
  "glc-class": ["GLC-Class", "GLC Class", "GLC"],
  "gle-class": ["GLE-Class", "GLE Class", "GLE"],
  "glk-class": ["GLK-Class", "GLK Class", "GLK"],
  "gls-class": ["GLS-Class", "GLS Class", "GLS"],
  "m-class": ["M-Class", "M Class", "ML"],
  "ml-class": ["M-Class", "ML-Class", "ML Class", "ML"],
  "r-class": ["R-Class", "R Class"],
  "s-class": ["S-Class", "S Class"],
  "sl-class": ["SL-Class", "SL Class", "SL"],
  "slc-class": ["SLC-Class", "SLC Class", "SLC"],
  "slk-class": ["SLK-Class", "SLK Class", "SLK"],
  "sls-class": ["SLS-Class", "SLS Class", "SLS"],
  
  // AMG variants (slug → DB title case with AMG suffix)
  "a-class-amg": ["A-Class AMG", "A Class AMG", "AMG A-Class"],
  "c-class-amg": ["C-Class AMG", "C Class AMG", "AMG C-Class"],
  "cla-class-amg": ["CLA-Class AMG", "CLA Class AMG", "AMG CLA"],
  "cls-class-amg": ["CLS-Class AMG", "CLS Class AMG", "AMG CLS"],
  "e-class-amg": ["E-Class AMG", "E Class AMG", "AMG E-Class"],
  "g-class-amg": ["G-Class AMG", "G Class AMG", "AMG G-Class"],
  "gl-class-amg": ["GL-Class AMG", "GL Class AMG"],
  "gla-class-amg": ["GLA-Class AMG", "GLA Class AMG", "AMG GLA"],
  "glb-class-amg": ["GLB-Class AMG", "GLB Class AMG", "AMG GLB"],
  "glc-class-amg": ["GLC-Class AMG", "GLC Class AMG", "AMG GLC"],
  "gle-class-amg": ["GLE-Class AMG", "GLE Class AMG", "AMG GLE"],
  "gls-class-amg": ["GLS-Class AMG", "GLS Class AMG", "AMG GLS"],
  "m-class-amg": ["M-Class AMG", "M Class AMG", "ML AMG"],
  "s-class-amg": ["S-Class AMG", "S Class AMG", "AMG S-Class"],
  "sl-class-amg": ["SL-Class AMG", "SL Class AMG", "AMG SL"],
  "slc-class-amg": ["SLC-Class AMG", "SLC Class AMG", "AMG SLC"],
  "slk-class-amg": ["SLK-Class AMG", "SLK Class AMG"],
  "sls-class-amg": ["SLS-Class AMG", "SLS Class AMG", "SLS AMG"],
  
  // Short form SUV classes (without -class suffix)
  "gle": ["GLE", "GLE-Class"],
  "glc": ["GLC", "GLC-Class"],
  "gls": ["GLS", "GLS-Class"],
  "gla": ["GLA", "GLA-Class"],
  "glb": ["GLB", "GLB-Class"],
  "glk": ["GLK", "GLK-Class"],
  
  // AMG GT variants
  "amg-gt": ["AMG GT"],
  "amg-gt-s": ["AMG GT S"],
  "amg-gt-c": ["AMG GT C"],
  "amg-gt-r": ["AMG GT R"],

  // ─────────────────────────────────────────────────────────────────────────
  // HYUNDAI/KIA EVs
  // ─────────────────────────────────────────────────────────────────────────
  "ioniq-5": ["Ioniq 5", "IONIQ 5"],
  "ioniq5": ["Ioniq 5", "IONIQ 5"],
  "ioniq-6": ["Ioniq 6", "IONIQ 6"],
  "ioniq6": ["Ioniq 6", "IONIQ 6"],
  "ev6": ["EV6"],
  "ev9": ["EV9"],

  // ─────────────────────────────────────────────────────────────────────────
  // TESLA
  // ─────────────────────────────────────────────────────────────────────────
  "model-3": ["Model 3"],
  "model-y": ["Model Y"],
  "model-s": ["Model S"],
  "model-x": ["Model X"],
};

/**
 * HD truck priority - these models have richer fitment data
 * Maps slugified input → preferred DB model name
 */
const HD_RICH_PRIORITY: Record<string, string> = {
  "silverado-2500-hd": "Silverado 2500HD",
  "silverado-2500hd": "Silverado 2500HD",
  "silverado-2500": "Silverado 2500HD",
  "silverado-3500-hd": "Silverado 3500HD",
  "silverado-3500hd": "Silverado 3500HD",
  "silverado-3500": "Silverado 3500HD",
  "sierra-2500-hd": "Sierra 2500HD",
  "sierra-2500hd": "Sierra 2500HD",
  "sierra-2500": "Sierra 2500HD",
  "sierra-3500-hd": "Sierra 3500HD",
  "sierra-3500hd": "Sierra 3500HD",
  "sierra-3500": "Sierra 3500HD",
};

/**
 * Slugify a string for lookup in alias maps
 */
function slugify(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Get all model name variants to try for a given input.
 * Returns actual DB model names (title case), prioritized by data richness.
 */
function getModelVariants(model: string): string[] {
  const lowercased = model.toLowerCase().trim();
  const slugified = slugify(model);
  
  // Get aliases for this model
  const aliases = MODEL_ALIASES[slugified] || [];
  
  // Check if this is an HD truck with priority variant
  const richVariant = HD_RICH_PRIORITY[slugified];
  
  // Build variants list, prioritizing:
  // 1. Rich variant (HD trucks with best data)
  // 2. Aliases (actual DB names)
  // 3. Original lowercased (might match directly)
  // 4. Slugified version
  const variants: string[] = [];
  
  if (richVariant) {
    variants.push(richVariant);
  }
  
  for (const alias of aliases) {
    if (!variants.includes(alias)) {
      variants.push(alias);
    }
  }
  
  // Add original input variants
  if (!variants.includes(lowercased)) {
    variants.push(lowercased);
  }
  if (!variants.includes(slugified) && slugified !== lowercased) {
    variants.push(slugified);
  }
  
  // Also add the original model with title case preserved
  // (in case user typed "Silverado 2500 HD" exactly)
  const titleCase = model.trim();
  if (!variants.some(v => v.toLowerCase() === titleCase.toLowerCase())) {
    variants.push(titleCase);
  }
  
  return variants;
}

/**
 * Generate canonical vehicle key for caching
 */
function makeCanonicalKey(year: number, make: string, model: string, trim?: string | null): string {
  const parts = [
    String(year),
    slugify(make),
    slugify(model),
  ];
  if (trim) {
    parts.push(slugify(trim));
  }
  return parts.join("|");
}

// ═══════════════════════════════════════════════════════════════════════════
// CERTIFIED FILTER (only return certified records)
// ═══════════════════════════════════════════════════════════════════════════

const CERTIFIED_FILTER = eq(vehicleFitments.certificationStatus, "certified");

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RESOLVER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * UNIVERSAL FITMENT RESOLVER
 * 
 * The single source of truth for all fitment lookups.
 * All model normalization, aliases, and DB lookups are encapsulated here.
 */
export async function resolveUniversalFitment(
  input: UniversalFitmentInput
): Promise<UniversalFitmentResult> {
  const t0 = Date.now();
  let dbQueriesCount = 0;
  const warnings: string[] = [];
  
  // Normalize inputs
  const normalizedMake = normalizeMake(input.make);
  const modelVariants = getModelVariants(input.model);
  const requestedTrim = input.trim?.trim() || null;
  
  // Determine if alias mapping was used
  const usedAliasMapping = MODEL_ALIASES[slugify(input.model)] !== undefined;
  const usedMakeAlias = MAKE_ALIASES[input.make.toLowerCase().trim()] !== undefined;
  
  console.log(`[universalFitmentResolver] ══════════════════════════════════════════════════`);
  console.log(`[universalFitmentResolver] INPUT: ${input.year} ${input.make} ${input.model} trim=${requestedTrim || "(none)"}`);
  console.log(`[universalFitmentResolver] NORMALIZED: make="${normalizedMake}" (alias=${usedMakeAlias})`);
  console.log(`[universalFitmentResolver] MODEL VARIANTS: [${modelVariants.join(", ")}] (alias=${usedAliasMapping})`);
  
  // Initialize result with defaults
  const result: UniversalFitmentResult = {
    input: {
      year: input.year,
      make: input.make,
      model: input.model,
      trim: requestedTrim,
      wheelDiameter: input.wheelDiameter ?? null,
    },
    normalized: {
      make: normalizedMake,
      model: input.model, // Will be updated if match found
      trim: null,
      modelVariantsTried: modelVariants,
      matchedVariant: null,
    },
    canonicalVehicleKey: makeCanonicalKey(input.year, normalizedMake, input.model, requestedTrim),
    year: input.year,
    make: normalizedMake,
    model: input.model,
    trim: null,
    modificationId: null,
    boltPattern: null,
    centerBore: null,
    threadSize: null,
    lugSeatType: null,
    oemTireSizes: [],
    oemTireSizesStaggered: null,
    wheelDiameterRange: null,
    wheelWidthRange: null,
    offsetRange: null,
    oemWheelSizes: [],
    found: false,
    source: "none",
    qualityTier: "unknown",
    confidence: "low",
    availableTrims: [],
    warnings: [],
    debug: {
      resolutionTimeMs: 0,
      dbQueriesCount: 0,
      matchedBy: null,
    },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Try each model variant until we find certified fitment records
  // ─────────────────────────────────────────────────────────────────────────
  
  let matchedRecords: typeof vehicleFitments.$inferSelect[] = [];
  let matchedVariant: string | null = null;
  
  for (const modelName of modelVariants) {
    dbQueriesCount++;
    
    const records = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, input.year),
          ilike(vehicleFitments.make, `%${normalizedMake}%`),
          ilike(vehicleFitments.model, modelName),
          CERTIFIED_FILTER
        )
      )
      .orderBy(asc(vehicleFitments.displayTrim));
    
    if (records.length > 0) {
      matchedRecords = records;
      matchedVariant = modelName;
      console.log(`[universalFitmentResolver] ✓ Found ${records.length} records using variant: "${modelName}"`);
      break;
    }
  }
  
  if (matchedRecords.length === 0) {
    console.log(`[universalFitmentResolver] ✗ No certified records found after trying ${modelVariants.length} variants`);
    warnings.push(`No fitment data found for ${input.year} ${input.make} ${input.model}`);
    result.warnings = warnings;
    result.debug.resolutionTimeMs = Date.now() - t0;
    result.debug.dbQueriesCount = dbQueriesCount;
    return result;
  }
  
  // Update normalized model to the matched variant
  result.normalized.matchedVariant = matchedVariant;
  result.normalized.model = matchedRecords[0].model; // Use actual DB model name
  result.model = matchedRecords[0].model;
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Build available trims list
  // ─────────────────────────────────────────────────────────────────────────
  
  const trimMap = new Map<string, { modificationId: string; displayTrim: string; tireSizes: string[] }>();
  
  for (const rec of matchedRecords) {
    const trimKey = rec.displayTrim?.toLowerCase() || "base";
    if (!trimMap.has(trimKey)) {
      const tireSizes = normalizeTireSizes(rec.oemTireSizes);
      trimMap.set(trimKey, {
        modificationId: rec.modificationId,
        displayTrim: rec.displayTrim || "Base",
        tireSizes,
      });
    }
  }
  
  result.availableTrims = Array.from(trimMap.values());
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Select the best matching record
  // ─────────────────────────────────────────────────────────────────────────
  
  let selectedRecord: typeof vehicleFitments.$inferSelect | null = null;
  let matchedBy = "first_available";
  
  if (requestedTrim) {
    // Try exact trim match
    const trimLower = requestedTrim.toLowerCase();
    selectedRecord = matchedRecords.find(r => 
      r.displayTrim?.toLowerCase() === trimLower ||
      r.modificationId === requestedTrim
    ) || null;
    
    if (selectedRecord) {
      matchedBy = "exact_trim";
      result.normalized.trim = selectedRecord.displayTrim;
    } else {
      // Try fuzzy trim match
      selectedRecord = matchedRecords.find(r => 
        r.displayTrim?.toLowerCase().includes(trimLower) ||
        trimLower.includes(r.displayTrim?.toLowerCase() || "")
      ) || null;
      
      if (selectedRecord) {
        matchedBy = "fuzzy_trim";
        result.normalized.trim = selectedRecord.displayTrim;
        warnings.push(`Requested trim "${requestedTrim}" matched to "${selectedRecord.displayTrim}"`);
      }
    }
  }
  
  // Fall back to first record if no trim match
  if (!selectedRecord) {
    selectedRecord = matchedRecords[0];
    matchedBy = matchedRecords.length === 1 ? "single_record" : "first_available";
    
    if (matchedRecords.length > 1 && requestedTrim) {
      warnings.push(`Requested trim "${requestedTrim}" not found. Using "${selectedRecord.displayTrim || "Base"}".`);
    }
  }
  
  // Apply overrides (hub bore, bolt pattern corrections, etc.)
  const recordWithOverrides = await applyOverrides(selectedRecord);
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: Extract fitment data from selected record
  // ─────────────────────────────────────────────────────────────────────────
  
  result.found = true;
  result.source = "vehicle_fitments";
  result.trim = recordWithOverrides.displayTrim || null;
  result.modificationId = recordWithOverrides.modificationId;
  result.boltPattern = recordWithOverrides.boltPattern || null;
  result.centerBore = recordWithOverrides.centerBoreMm ? parseFloat(String(recordWithOverrides.centerBoreMm)) : null;
  result.threadSize = recordWithOverrides.threadSize || null;
  result.lugSeatType = recordWithOverrides.seatType || null;
  result.qualityTier = (recordWithOverrides.qualityTier as any) || "unknown";
  
  // Determine confidence based on quality tier and data completeness
  if (result.qualityTier === "complete" && result.boltPattern && result.centerBore) {
    result.confidence = "high";
  } else if (result.boltPattern) {
    result.confidence = "medium";
  } else {
    result.confidence = "low";
  }
  
  // Extract tire sizes
  result.oemTireSizes = normalizeTireSizes(recordWithOverrides.oemTireSizes);
  
  // Check for staggered fitment
  const tireSizesRaw = recordWithOverrides.oemTireSizes;
  if (tireSizesRaw && typeof tireSizesRaw === "object" && !Array.isArray(tireSizesRaw)) {
    const staggered = tireSizesRaw as { front?: string[]; rear?: string[] };
    if (staggered.front || staggered.rear) {
      result.oemTireSizesStaggered = {
        front: staggered.front || [],
        rear: staggered.rear || [],
      };
    }
  }
  
  // Extract wheel sizes
  const wheelSizes = recordWithOverrides.oemWheelSizes || [];
  if (Array.isArray(wheelSizes)) {
    result.oemWheelSizes = wheelSizes.map((ws: any) => ({
      diameter: ws.diameter || 0,
      width: ws.width || 0,
      offset: ws.offset ?? null,
      axle: ws.axle || "both",
    }));
    
    // Calculate ranges
    const diameters = result.oemWheelSizes.map(ws => ws.diameter).filter(d => d > 0);
    const widths = result.oemWheelSizes.map(ws => ws.width).filter(w => w > 0);
    const offsets = result.oemWheelSizes.map(ws => ws.offset).filter((o): o is number => o !== null);
    
    if (diameters.length > 0) {
      result.wheelDiameterRange = { min: Math.min(...diameters), max: Math.max(...diameters) };
    }
    if (widths.length > 0) {
      result.wheelWidthRange = { min: Math.min(...widths), max: Math.max(...widths) };
    }
    if (offsets.length > 0) {
      result.offsetRange = { min: Math.min(...offsets), max: Math.max(...offsets) };
    }
  }
  
  // Update canonical key with matched model
  result.canonicalVehicleKey = makeCanonicalKey(
    input.year, 
    normalizedMake, 
    result.model, 
    result.trim
  );
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: Finalize result
  // ─────────────────────────────────────────────────────────────────────────
  
  result.warnings = warnings;
  result.debug.resolutionTimeMs = Date.now() - t0;
  result.debug.dbQueriesCount = dbQueriesCount;
  result.debug.matchedBy = matchedBy;
  
  console.log(`[universalFitmentResolver] ✓ RESOLVED:`);
  console.log(`[universalFitmentResolver]   DB Model: "${result.model}" | Trim: "${result.trim || "(auto)"}"`);
  console.log(`[universalFitmentResolver]   Source: ${result.source} | Confidence: ${result.confidence} | Quality: ${result.qualityTier}`);
  console.log(`[universalFitmentResolver]   Bolt: ${result.boltPattern}, Hub: ${result.centerBore}mm`);
  console.log(`[universalFitmentResolver]   Alias used: ${usedAliasMapping ? "yes" : "no"} | Matched variant: "${matchedVariant}"`);
  console.log(`[universalFitmentResolver]   Time: ${result.debug.resolutionTimeMs}ms, Queries: ${dbQueriesCount}`);
  console.log(`[universalFitmentResolver] ══════════════════════════════════════════════════`);
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize tire sizes from various DB formats to string array
 */
function normalizeTireSizes(raw: unknown): string[] {
  if (!raw) return [];
  
  // Handle stringified JSON
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return normalizeTireSizes(parsed);
    } catch {
      // Single tire size string
      if (raw.match(/^\d{2,3}\/\d{2}[ZR]?\d{2}/)) {
        return [raw];
      }
      return [];
    }
  }
  
  // Handle staggered objects: { front: [...], rear: [...] }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as { front?: unknown; rear?: unknown };
    if (obj.front || obj.rear) {
      return [
        ...normalizeTireSizes(obj.front),
        ...normalizeTireSizes(obj.rear),
      ];
    }
  }
  
  // Handle arrays
  if (Array.isArray(raw)) {
    const sizes: string[] = [];
    for (const item of raw) {
      if (typeof item === "string") {
        sizes.push(item);
      } else if (item && typeof item === "object") {
        // Object format: { size: "275/65R18" } or { tireSize: "275/65R18" }
        const obj = item as any;
        if (obj.size) sizes.push(obj.size);
        else if (obj.tireSize) sizes.push(obj.tireSize);
      }
    }
    return sizes;
  }
  
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quick check if a vehicle has fitment coverage
 */
export async function hasUniversalFitmentCoverage(
  year: number,
  make: string,
  model: string
): Promise<boolean> {
  const result = await resolveUniversalFitment({ year, make, model });
  return result.found;
}

/**
 * Get just the bolt pattern for a vehicle
 */
export async function getUniversalBoltPattern(
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<string | null> {
  const result = await resolveUniversalFitment({ year, make, model, trim });
  return result.boltPattern;
}

/**
 * Get tire sizes for a vehicle
 */
export async function getUniversalTireSizes(
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<string[]> {
  const result = await resolveUniversalFitment({ year, make, model, trim });
  return result.oemTireSizes;
}

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORT MODEL VARIANTS FOR BACKWARD COMPATIBILITY
// (Endpoints migrating to universalFitmentResolver can use these during transition)
// ═══════════════════════════════════════════════════════════════════════════

export { getModelVariants, normalizeMake, slugify, makeCanonicalKey };
