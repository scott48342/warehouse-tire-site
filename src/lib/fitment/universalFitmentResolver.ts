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
import { eq, and, ilike, or, asc, sql, isNull } from "drizzle-orm";
import { applyOverrides } from "@/lib/fitment-db/applyOverrides";
import { serviceSpecsFromRecord, type FitmentServiceSpecs } from "@/lib/fitment-db/profileService";
// Utility helpers only (NOT the resolution path) for reverse-mapping a
// canonicalFitmentId (the trims API `value`) back to its atomic trim label.
import { isCanonicalFitmentId, getAtomicTrimOptions } from "@/lib/fitment/canonicalResolver";
import { isGroupedTrim, explodeTrim } from "@/lib/fitment/trimExplosion";
import { assessTrimAmbiguity, type TrimAmbiguityResult } from "@/lib/fitment-db/trimAmbiguity";
import {
  assessSourceVerification,
  type SourceVerification,
} from "@/lib/fitment-db/sourceVerification";
import type { FitCertificationBlock } from "@/lib/fitment-db/fitCertification";

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
  /** OE service specs (lug torque ft-lb, placard tire pressure psi, load index); null = none on file */
  serviceSpecs: FitmentServiceSpecs | null;
  
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

  /**
   * 2026-09-18 (audit F7): set when NO trim was requested and >1 certified rows
   * exist. `trimAmbiguity.ambiguous` means the rows disagree on bolt pattern /
   * center bore / tire-size set and the auto-selected record (matchedBy
   * "first_available") must NOT be presented as this vehicle's fitment.
   * Callers that need a definite answer should return trimRequired instead.
   */
  trimAmbiguity: TrimAmbiguityResult | null;
  trimRequired: boolean;
  /**
   * R3: true when a trim was selected, or the single/all-agreeing candidate rows
   * make the selected record safe to certify. false => no fit badge, no
   * fits:true, no certified package may be built from this result.
   *
   * 2026-09-18 (J2/J4): ALSO requires approved-source provenance for BOTH wheel
   * specs and tire sizes (see `sourceVerification`). An exact trim match on a
   * row with no provenance is NOT certifiable.
   */
  certifiable: boolean;
  /** trim gate passed AND wheel specs (bolt/bore/offset) have approved provenance */
  wheelCertifiable: boolean;
  /** trim gate passed AND OE tire sizes for THIS trim have approved provenance */
  tireCertifiable: boolean;
  /** Why `certifiable` is false (null when certifiable). */
  certificationBlock: FitCertificationBlock;
  /** Per-field provenance verdict for the selected row. `internal` must never be serialized publicly. */
  sourceVerification: SourceVerification | null;
  
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
  // 0. The input itself (lowercased / slugified). 2026-09-17: the DB stores
  //    model as a slug ("silverado-1500"), and the alias list for
  //    "silverado-1500" includes the generic "Silverado" — which is a
  //    DIFFERENT live model ("silverado", a 1-row-per-year placeholder with
  //    display_trim "Base" / modification_id "base"). Trying aliases first
  //    made every 2021 Silverado 1500 trim resolve to that phantom base row.
  //    An exact match on the caller's own model name must always win.
  // 1. Rich variant (HD trucks with best data)
  // 2. Aliases (actual DB names)
  // 3. Original lowercased (might match directly)
  // 4. Slugified version
  const variants: string[] = [];
  
  variants.push(lowercased);
  if (slugified !== lowercased) {
    variants.push(slugified);
  }
  // 2026-09-18 (audit / Jake J1): the DB slug for HD trucks has no separator
  // before "hd" ("silverado-2500hd"), but customers - and Jake - write
  // "Silverado 2500 HD", which slugifies to "silverado-2500-hd" and missed
  // every variant above (tire-sizes answered "No tire size data" while
  // fitment-search, reached via a different input, resolved 8x180). Try the
  // collapsed form too. Exact-input variants stay first, so nothing that
  // matched before changes.
  const hdCollapsed = slugified.replace(/-(hd)$/i, "$1");
  if (hdCollapsed !== slugified && !variants.includes(hdCollapsed)) {
    variants.push(hdCollapsed);
  }
  
  if (richVariant) {
    if (!variants.includes(richVariant)) variants.push(richVariant);
  }
  
  for (const alias of aliases) {
    if (!variants.includes(alias)) {
      variants.push(alias);
    }
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
 * Normalize a trim label for exact (not fuzzy) comparison:
 * lowercase, trim, collapse whitespace.
 */
function normalizeTrimLabel(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Atomic trim labels for a record. Grouped display_trims
 * ("Big Horn / Laramie / Tradesman") explode into their individual trims;
 * atomic display_trims return themselves.
 */
function atomicTrimsOf(displayTrim: string | null | undefined): string[] {
  if (!displayTrim) return [];
  try {
    return isGroupedTrim(displayTrim) ? explodeTrim(displayTrim) : [displayTrim];
  } catch {
    return [displayTrim];
  }
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
// CERTIFIED FILTER (only return certified, non-quarantined records)
// 2026-09-15 audit Pass 0: quarantined rows (quarantined_at IS NOT NULL) were
// still being served by the site because this filter only checked
// certification_status. Mirrors notQuarantined() in public-fitment-service.ts.
// ═══════════════════════════════════════════════════════════════════════════

const CERTIFIED_FILTER = and(
  eq(vehicleFitments.certificationStatus, "certified"),
  isNull(vehicleFitments.quarantinedAt)
);

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
  // Raw trim/modification param exactly as the caller sent it. Pickers send
  // either a live modification_id (legacy trims path) or a canonicalFitmentId
  // (atomic trims path). Kept separate from the label we derive below so the
  // exact-modification_id match can always run first.
  const rawTrimParam = input.trim?.trim() || null;
  let requestedTrim = rawTrimParam;
  // modification_id of the row a canonicalFitmentId reverse-mapped to.
  let preferredModificationId: string | null = null;

  // ───────────────────────────────────────────────────────────────────────
  // CANONICAL FITMENT ID NORMALIZATION (2026-06-22)
  // Pickers pass the trims API `value` (a canonicalFitmentId, e.g.
  // "2024-ford-f-150-king-ranch-64d6fb") in as the trim/modification param.
  // That is a different namespace than trim labels, so trim matching misses
  // it. Reverse-map it to its atomic trim label so resolution succeeds.
  // Additive: plain trim labels are untouched.
  // ───────────────────────────────────────────────────────────────────────
  if (requestedTrim && isCanonicalFitmentId(requestedTrim)) {
    try {
      const atomicOptions = await getAtomicTrimOptions(input.year, input.make, input.model);
      const matched = atomicOptions.find((o) => o.canonicalFitmentId === requestedTrim);
      if (matched) {
        console.log(`[universalFitmentResolver] canonicalFitmentId "${requestedTrim}" → trim="${matched.label}" modificationId="${matched.modificationId}"`);
        requestedTrim = matched.label;
        preferredModificationId = matched.modificationId;
      } else {
        console.warn(`[universalFitmentResolver] canonicalFitmentId "${requestedTrim}" did not match any atomic trim for ${input.year} ${input.make} ${input.model}`);
      }
    } catch (e) {
      console.warn(`[universalFitmentResolver] canonicalFitmentId reverse-map failed: ${e}`);
    }
  }
  
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
    serviceSpecs: null,
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
    trimAmbiguity: null,
    trimRequired: false,
    certifiable: false,
    wheelCertifiable: false,
    tireCertifiable: false,
    certificationBlock: "source_unverified",
    sourceVerification: null,
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

  // F7: when the caller omitted the trim, record whether auto-selecting a row
  // would be a silent guess. Non-breaking: resolution still proceeds below.
  // R3: tri-state per-field compare. `certifiable` is false unless every field
  // agrees; consumers MUST NOT claim fit (badge / fits:true / certified package)
  // when `trimRequired` is true. Browsing may use `trimAmbiguity.sharedSpecs`.
  if (!requestedTrim && matchedRecords.length > 1) {
    result.trimAmbiguity = assessTrimAmbiguity(
      matchedRecords.map((r) => ({
        modificationId: r.modificationId,
        displayTrim: r.displayTrim,
        boltPattern: r.boltPattern,
        centerBoreMm: r.centerBoreMm as unknown as number | string | null,
        threadSize: r.threadSize,
        oemWheelSizes: r.oemWheelSizes,
        offsetMinMm: r.offsetMinMm,
        offsetMaxMm: r.offsetMaxMm,
        oemTireSizes: r.oemTireSizes,
        requiredLoadIndex: r.oemLoadIndex,
      }))
    );
    result.trimRequired = result.trimAmbiguity.trimRequired;
    result.certifiable = result.trimAmbiguity.certifiable;
    if (result.trimRequired) {
      const a = result.trimAmbiguity;
      warnings.push(
        `Trim required: ${matchedRecords.length} certified trims; disagree on [${a.conflictingFields.join(", ")}], unknown [${a.unknownFields.join(", ")}]. Auto-selected record is NOT certified fitment.`
      );
    }
  } else if (!requestedTrim && matchedRecords.length === 1) {
    result.certifiable = true;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Select the best matching record
  // ─────────────────────────────────────────────────────────────────────────
  
  let selectedRecord: typeof vehicleFitments.$inferSelect | null = null;
  let matchedBy = "first_available";
  
  if (requestedTrim) {
    // ─────────────────────────────────────────────────────────────────────
    // 2026-09-17: Strict-first trim selection. Order matters:
    //   1. exact live modification_id (raw param)
    //   2. row the canonicalFitmentId reverse-mapped to (exact modification_id)
    //   3. exact display_trim (case-insensitive)
    //   4. exact ATOMIC trim inside a grouped display_trim
    //      ("Big Horn" ∈ "Big Horn / Laramie / Tradesman")
    //   5. fuzzy contains (legacy) — only when nothing above matched
    // Previously fuzzy `includes` ran as soon as exact display_trim missed,
    // so "Big Horn" matched the first row containing it alphabetically:
    // "Big Horn (DRW) / ..." (8x200) instead of the SRW row.
    // ─────────────────────────────────────────────────────────────────────
    const trimNorm = normalizeTrimLabel(requestedTrim);
    
    if (rawTrimParam) {
      selectedRecord = matchedRecords.find(r => r.modificationId === rawTrimParam) || null;
      if (selectedRecord) matchedBy = "exact_modification_id";
    }
    
    if (!selectedRecord && preferredModificationId) {
      selectedRecord = matchedRecords.find(r => r.modificationId === preferredModificationId) || null;
      if (selectedRecord) matchedBy = "exact_canonical_id";
    }
    
    if (!selectedRecord) {
      selectedRecord = matchedRecords.find(r => normalizeTrimLabel(r.displayTrim) === trimNorm) || null;
      if (selectedRecord) matchedBy = "exact_trim";
    }
    
    if (!selectedRecord) {
      selectedRecord = matchedRecords.find(r =>
        atomicTrimsOf(r.displayTrim).some(t => normalizeTrimLabel(t) === trimNorm)
      ) || null;
      if (selectedRecord) matchedBy = "exact_atomic_trim";
    }
    
    if (selectedRecord) {
      result.normalized.trim = selectedRecord.displayTrim;
    } else {
      // Try fuzzy trim match (legacy behaviour, last resort)
      selectedRecord = matchedRecords.find(r => {
        const dt = normalizeTrimLabel(r.displayTrim);
        return dt.length > 0 && (dt.includes(trimNorm) || trimNorm.includes(dt));
      }) || null;
      
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
      // R3: a requested-but-unmatched trim is the same silent guess as an omitted
      // trim. Run the same gate so consumers cannot certify the fallback row.
      if (!result.trimAmbiguity) {
        result.trimAmbiguity = assessTrimAmbiguity(
          matchedRecords.map((r) => ({
            modificationId: r.modificationId,
            displayTrim: r.displayTrim,
            boltPattern: r.boltPattern,
            centerBoreMm: r.centerBoreMm as unknown as number | string | null,
            threadSize: r.threadSize,
            oemWheelSizes: r.oemWheelSizes,
            offsetMinMm: r.offsetMinMm,
            offsetMaxMm: r.offsetMaxMm,
            oemTireSizes: r.oemTireSizes,
            requiredLoadIndex: r.oemLoadIndex,
          }))
        );
        result.trimRequired = result.trimAmbiguity.trimRequired;
        result.certifiable = result.trimAmbiguity.certifiable;
      }
    }
  }

  // R3: an explicitly matched trim (exact or fuzzy) or a single record is
  // certifiable; first_available is only certifiable when the gate said so.
  if (matchedBy !== "first_available") {
    result.certifiable = true;
    result.trimRequired = false;
  }

  // 2026-09-18 (J2/J4): source-verification gate. The trim gate above answers
  // "is this row THIS vehicle?"; this answers "are the row's values verified by
  // an approved source?". Both must hold. `matchedRecords.length` is the live
  // trim count for the Y/M/M, which is what model-level tire sources need.
  const trimGatePassed = result.certifiable;
  const sv = assessSourceVerification(selectedRecord, { trimCount: matchedRecords.length });
  result.sourceVerification = sv;
  result.wheelCertifiable = trimGatePassed && sv.wheelSpecs === "verified";
  result.tireCertifiable = trimGatePassed && sv.tireSizes === "verified";
  result.certifiable = trimGatePassed && sv.verified;
  result.certificationBlock = !trimGatePassed
    ? "trim_required"
    : sv.verified
      ? null
      : "source_unverified";
  if (trimGatePassed && !sv.verified) {
    warnings.push(
      `Source verification: ${sv.unverifiedFields.join(", ")} not verified by an approved source. Values may be shown as "on file", never as confirmed/verified.`
    );
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
  result.serviceSpecs = serviceSpecsFromRecord(recordWithOverrides);
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
  
  // Check for staggered fitment.
  // NOTE: the DB stores staggered fitment as an object whose front/rear values
  // may be EITHER a single string (e.g. {"front":"245/40R20","rear":"275/35R20"})
  // OR an array of strings. Normalize both shapes to string[] so downstream
  // code can safely index front[0]/rear[0]. Previously a raw string meant
  // front[0] returned the first CHARACTER ("2"), corrupting staggered output.
  const tireSizesRaw = recordWithOverrides.oemTireSizes;
  if (tireSizesRaw && typeof tireSizesRaw === "object" && !Array.isArray(tireSizesRaw)) {
    const staggered = tireSizesRaw as { front?: unknown; rear?: unknown };
    const toSizeArray = (v: unknown): string[] => {
      if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
      if (typeof v === "string") return v.trim() ? [v.trim()] : [];
      return [];
    };
    const front = toSizeArray(staggered.front);
    const rear = toSizeArray(staggered.rear);
    if (front.length > 0 || rear.length > 0) {
      result.oemTireSizesStaggered = { front, rear };
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
  console.log(
    `[universalFitmentResolver]   Certification: certifiable=${result.certifiable} wheel=${result.wheelCertifiable} tire=${result.tireCertifiable} block=${result.certificationBlock ?? "none"}` +
      (result.sourceVerification ? ` | unverified=[${result.sourceVerification.unverifiedFields.join(",")}]` : "")
  );
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
