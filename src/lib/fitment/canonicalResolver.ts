/**
 * CANONICAL FITMENT RESOLVER
 * 
 * Single source of truth for resolving vehicle fitment identity.
 * Used by ALL fitment endpoints: trims, tire-sizes, wheels, packages, POS.
 * 
 * RULES:
 * 1. One selectable trim = one canonical fitment identity
 * 2. Grouped trims are exploded into individual canonical options
 * 3. If user selected a trim and candidates have different fitment → BLOCK
 * 4. Never expose grouped displayTrim values to customers
 * 
 * Resolution Order:
 * 1. Exact modificationId match (highest priority)
 * 2. APPROVED Wheel-Size trim mapping (Phase 2 - beats grouped fallback)
 * 3. Exact canonical displayTrim match (atomic, not grouped)
 * 4. Normalized alias match (case-insensitive, slug comparison)
 * 5. Same generation + submodel match
 * 6. Safe fallback only if ALL candidate trims have identical fitment
 */

import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import type { VehicleFitment, VehicleFitmentConfiguration, WheelSizeTrimMapping } from "@/lib/fitment-db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import { normalizeModel, slugify } from "@/lib/fitment-db/keys";
import { canonicalMake, getMakeVariantsForQuery } from "@/lib/fitment/makeAliases";
import { applyOverrides } from "@/lib/fitment-db/applyOverrides";
import { getModelVariants, extractBmwModelAndTrim } from "@/lib/fitment-db/modelAliases";
import { getTrimMapping, type TrimMappingResult } from "@/lib/fitment-db/wheelSizeTrimMapping";
import { isGroupedTrim, explodeTrim } from "@/lib/fitment/trimExplosion";
import { TRIM_ALIASES } from "@/lib/fitment-db/normalization";

// ============================================================================
// Types
// ============================================================================

export type ResolutionMethod = 
  | "exact_modification_id"     // Exact modificationId match
  | "wheel_size_trim_mapping"   // Approved Wheel-Size trim mapping (Phase 2)
  | "exact_canonical_trim"      // Exact atomic displayTrim match
  | "normalized_trim"           // Normalized/slugified trim match
  | "generation_submodel"       // Same generation + submodel
  | "identical_fallback"        // All candidates have identical fitment
  | "blocked"                   // Candidates differ, cannot safely resolve
  | "not_found";                // No match at all

/**
 * Auto-selected configuration from trim mapping
 */
export interface AutoSelectedConfig {
  configId: string;
  wheelDiameter: number;
  tireSize: string;
  isDefault: boolean;
}

export interface CanonicalFitmentResult {
  // Core identity
  canonicalFitmentId: string | null;  // Unique identifier for this fitment
  modificationId: string | null;       // DB modificationId
  displayTrim: string | null;          // Atomic (non-grouped) display trim
  
  // Resolution info
  matchedBy: ResolutionMethod;
  confidence: "high" | "medium" | "low";
  
  // Fitment data (when resolved)
  fitment: VehicleFitment | null;
  
  // Trim mapping resolution (Phase 2)
  trimMapping: {
    found: boolean;
    mappingId: string | null;
    showSizeChooser: boolean;
    autoSelectedConfig: AutoSelectedConfig | null;
    configurations: Array<{
      configId: string;
      wheelDiameter: number;
      tireSize: string;
      isDefault: boolean;
    }>;
    chooserReason: 'multiple_configs' | 'no_mapping' | 'low_confidence' | 'needs_review' | null;
  };
  
  // Debug info
  debug: {
    requestedTrim: string | null;
    normalizedRequestedTrim: string | null;
    candidateTrims: Array<{
      modificationId: string;
      displayTrim: string;
      isGrouped: boolean;
      atomicTrims: string[];
      tireSizes: string[];
    }>;
    fallbackBlockedReason: string | null;
    wasGroupedRecord: boolean;
    matchedAtomicTrim: string | null;
    // Phase 2: Trim mapping debug info
    trimMappingDebug: {
      resolutionSource: string | null;
      mappingId: string | null;
      mappingStatus: string | null;
      matchConfidence: string | null;
      matchMethod: string | null;
    };
    // 2026-05-18: BMW variant clarification
    bmwVariantClarification?: {
      requestedTrim: string;
      variants: Array<{
        trim: string;
        tireSizes: string[];
        isStaggered: boolean;
        description: string;
      }>;
    };
  };
}

export interface ResolverInput {
  year: number;
  make: string;
  model: string;
  trim?: string;          // Display trim name (e.g., "Sport")
  modificationId?: string; // DB modificationId
}

// ============================================================================
// Helpers
// ============================================================================

// NOTE: isGroupedTrim and explodeTrim (explodeTrim) are now imported from
// @/lib/fitment/trimExplosion for consistency across all fitment endpoints.

/**
 * Build SQL condition to match any make variant.
 * Uses ILIKE ANY(ARRAY[...]) for case-insensitive matching.
 * 
 * This handles the case where DB has inconsistent make storage:
 * - "Mercedes-Benz" vs "Mercedes" vs "mercedes"
 * All should match when user searches for any variant.
 */
function makeLikeAny(makeColumn: typeof vehicleFitments.make, make: string) {
  const variants = getMakeVariantsForQuery(make);
  // Use SQL ILIKE ANY for PostgreSQL
  return sql`${makeColumn} ILIKE ANY(ARRAY[${sql.join(variants.map(v => sql`${v}`), sql`, `)}])`;
}

/**
 * Normalize trim for comparison
 */
function normalizeTrim(trim: string): string {
  return trim
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/crewcab|extendedcab|regularcab|supercrew|supercab/g, "")
    .replace(/4x4|4wd|awd|2wd|rwd|fwd/g, "")
    .replace(/diesel|gas|hybrid|electric/g, "")
    .trim();
}

/**
 * Resolve trim alias to canonical DB trim name.
 * Returns the canonical trim if found, otherwise returns the original.
 * 
 * @example
 * resolveTrimAlias("audi", "s4", "Premium") → "S4 Premium Plus"
 * resolveTrimAlias("ford", "escape", "Base") → "S"
 */
function resolveTrimAlias(make: string, model: string, trim: string): string {
  if (!trim) return trim;
  
  const normalizedMake = canonicalMake(make).toLowerCase();
  const normalizedModel = slugify(model);
  const trimLower = trim.toLowerCase().trim();
  
  const makeAliases = TRIM_ALIASES[normalizedMake];
  if (!makeAliases) return trim;
  
  const modelAliases = makeAliases[normalizedModel];
  if (!modelAliases) return trim;
  
  // Look for a canonical trim that includes this alias
  for (const [canonical, aliases] of Object.entries(modelAliases)) {
    for (const alias of aliases) {
      if (alias === trimLower) {
        console.log(`[canonicalResolver] Trim alias resolved: "${trim}" → "${canonical}" (${make} ${model})`);
        return canonical;
      }
    }
  }
  
  return trim;
}

/**
 * Normalize tire sizes to a flat array.
 * Handles both array format (square fitment) and object format (staggered fitment).
 * 
 * Array format: ["245/40R20", "275/35R20"]
 * Object format: { front: ["245/40R20"], rear: ["275/35R20"] }
 */
function normalizeTireSizes(tireSizes: unknown): string[] {
  if (!tireSizes) return [];
  
  // Already an array - use as-is
  if (Array.isArray(tireSizes)) {
    return tireSizes.filter(s => typeof s === 'string');
  }
  
  // Object format (staggered fitment) - flatten front + rear
  if (typeof tireSizes === 'object') {
    const obj = tireSizes as { front?: string[]; rear?: string[] };
    const front = Array.isArray(obj.front) ? obj.front : [];
    const rear = Array.isArray(obj.rear) ? obj.rear : [];
    return [...front, ...rear].filter(s => typeof s === 'string');
  }
  
  return [];
}

/**
 * Check if two sets of tire sizes are identical
 */
function tireSizesMatch(sizes1: string[] | null, sizes2: string[] | null): boolean {
  if (!sizes1 && !sizes2) return true;
  if (!sizes1 || !sizes2) return false;
  if (sizes1.length !== sizes2.length) return false;
  const sorted1 = [...sizes1].sort();
  const sorted2 = [...sizes2].sort();
  return sorted1.every((s, i) => s === sorted2[i]);
}

/**
 * Generate a canonical fitment ID
 * Format: {year}-{make}-{model}-{trim}-{hash}
 */
function generateCanonicalId(year: number, make: string, model: string, trim: string): string {
  const base = `${year}-${slugify(make)}-${slugify(model)}-${slugify(trim)}`;
  const hash = base.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0).toString(16).slice(-6);
  return `${base}-${hash}`;
}

// ============================================================================
// Main Resolver
// ============================================================================

/**
 * Resolve vehicle fitment to a canonical identity.
 * 
 * This is the SINGLE entry point for ALL fitment resolution.
 * Handles grouped trims, normalization, and fallback logic.
 */
export async function resolveVehicleFitment(
  input: ResolverInput
): Promise<CanonicalFitmentResult> {
  let { year, make, model, trim, modificationId } = input;
  
  const normalizedMake = canonicalMake(make);
  
  // ─────────────────────────────────────────────────────────────────────────
  // BMW MODEL NUMBER EXTRACTION (2026-05-18)
  // 
  // BMW uses model numbers like "328i" that are actually:
  //   - Model: 3 Series
  //   - Trim: 328i
  // 
  // Extract these BEFORE looking up model variants so the resolver
  // can find the correct data.
  // ─────────────────────────────────────────────────────────────────────────
  const bmwExtraction = extractBmwModelAndTrim(make, model);
  if (bmwExtraction.isBmwModelNumber && bmwExtraction.modelName) {
    console.log(`[canonicalResolver] BMW model number detected: "${model}" → model="${bmwExtraction.modelName}", trim="${bmwExtraction.trimName}"`);
    // Override model with the series name
    model = bmwExtraction.modelName;
    // If no trim was explicitly provided, use the extracted trim
    if (!trim && bmwExtraction.trimName) {
      trim = bmwExtraction.trimName;
    }
  }
  
  const modelVariants = getModelVariants(model);
  
  // Resolve trim aliases before matching (e.g., "Premium" → "S4 Premium Plus")
  const resolvedTrim = trim ? resolveTrimAlias(make, model, trim) : null;
  const requestedTrim = resolvedTrim || null;
  const normalizedRequestedTrim = requestedTrim ? normalizeTrim(requestedTrim) : null;
  
  // Initialize result
  const result: CanonicalFitmentResult = {
    canonicalFitmentId: null,
    modificationId: null,
    displayTrim: null,
    matchedBy: "not_found",
    confidence: "low",
    fitment: null,
    trimMapping: {
      found: false,
      mappingId: null,
      showSizeChooser: true,
      autoSelectedConfig: null,
      configurations: [],
      chooserReason: 'no_mapping',
    },
    debug: {
      requestedTrim,
      normalizedRequestedTrim,
      candidateTrims: [],
      fallbackBlockedReason: null,
      wasGroupedRecord: false,
      matchedAtomicTrim: null,
      trimMappingDebug: {
        resolutionSource: null,
        mappingId: null,
        mappingStatus: null,
        matchConfidence: null,
        matchMethod: null,
      },
    },
  };

  // Try each model variant (handles aliases like f-350 → f-350-super-duty)
  for (const modelName of modelVariants) {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Exact modificationId match (HIGHEST PRIORITY)
    // ─────────────────────────────────────────────────────────────────────────
    if (modificationId) {
      const normalizedModId = slugify(modificationId);
      
      const [exactMatch] = await db
        .select()
        .from(vehicleFitments)
        .where(
          and(
            eq(vehicleFitments.year, year),
            makeLikeAny(vehicleFitments.make, make),
            ilike(vehicleFitments.model, modelName),
            eq(vehicleFitments.modificationId, normalizedModId),
            eq(vehicleFitments.certificationStatus, "certified")
          )
        )
        .limit(1);
      
      if (exactMatch) {
        const isGrouped = isGroupedTrim(exactMatch.displayTrim);
        
        // If this is a grouped record and we have a specific trim requested,
        // check if the requested trim is one of the atomic trims in the group
        if (isGrouped && requestedTrim) {
          const atomicTrims = explodeTrim(exactMatch.displayTrim);
          const matchedAtomic = atomicTrims.find(t => 
            normalizeTrim(t) === normalizedRequestedTrim
          );
          
          if (matchedAtomic) {
            // Found the specific atomic trim within the grouped record
            const withOverrides = await applyOverrides(exactMatch);
            return {
              ...result,
              canonicalFitmentId: generateCanonicalId(year, make, model, matchedAtomic),
              modificationId: exactMatch.modificationId,
              displayTrim: matchedAtomic, // Return the atomic trim, not the grouped one
              matchedBy: "exact_modification_id",
              confidence: "high",
              fitment: withOverrides,
              debug: {
                ...result.debug,
                wasGroupedRecord: true,
                matchedAtomicTrim: matchedAtomic,
              },
            };
          }
        }
        
        // Non-grouped record or no specific trim requested
        const withOverrides = await applyOverrides(exactMatch);
        return {
          ...result,
          canonicalFitmentId: generateCanonicalId(year, make, model, exactMatch.displayTrim),
          modificationId: exactMatch.modificationId,
          displayTrim: isGrouped ? explodeTrim(exactMatch.displayTrim)[0] : exactMatch.displayTrim,
          matchedBy: "exact_modification_id",
          confidence: isGrouped ? "medium" : "high",
          fitment: withOverrides,
          debug: {
            ...result.debug,
            wasGroupedRecord: isGrouped,
          },
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1.5: Approved Wheel-Size trim mapping (Phase 2)
    // Only use APPROVED mappings with high/medium confidence.
    // This prevents grouped/generic fallback from showing unnecessary choices.
    // ─────────────────────────────────────────────────────────────────────────
    if (requestedTrim) {
      const mappingResult = await getTrimMapping(year, make, model, requestedTrim);
      
      // Update debug info regardless of result
      result.debug.trimMappingDebug = {
        resolutionSource: mappingResult.found ? "wheel_size_trim_mapping" : null,
        mappingId: mappingResult.mapping?.id || null,
        mappingStatus: mappingResult.mapping?.status || null,
        matchConfidence: mappingResult.mapping?.matchConfidence || null,
        matchMethod: mappingResult.mapping?.matchMethod || null,
      };
      
      // Only use approved mappings with sufficient confidence
      if (
        mappingResult.found && 
        mappingResult.mapping && 
        mappingResult.mapping.status === 'approved' &&
        (mappingResult.mapping.matchConfidence === 'high' || mappingResult.mapping.matchConfidence === 'medium')
      ) {
        // Build configurations array from the mapping result
        const configsForResult = mappingResult.configurations.map(c => ({
          configId: c.id,
          wheelDiameter: c.wheelDiameter,
          tireSize: c.tireSize,
          isDefault: c.isDefault,
        }));
        
        // Build autoSelectedConfig if available
        const autoSelected = mappingResult.autoSelectConfig ? {
          configId: mappingResult.autoSelectConfig.id,
          wheelDiameter: mappingResult.autoSelectConfig.wheelDiameter,
          tireSize: mappingResult.autoSelectConfig.tireSize,
          isDefault: mappingResult.autoSelectConfig.isDefault,
        } : null;
        
        // Try to get the fitment record for this mapping
        const fitmentRecord = mappingResult.mapping.vehicleFitmentId 
          ? await db
              .select()
              .from(vehicleFitments)
              .where(eq(vehicleFitments.id, mappingResult.mapping.vehicleFitmentId))
              .limit(1)
              .then(rows => rows[0] || null)
          : null;
        
        const withOverrides = fitmentRecord ? await applyOverrides(fitmentRecord) : null;
        
        return {
          ...result,
          canonicalFitmentId: generateCanonicalId(year, make, model, requestedTrim),
          modificationId: mappingResult.mapping.ourModificationId || null,
          displayTrim: requestedTrim,
          matchedBy: "wheel_size_trim_mapping",
          confidence: mappingResult.mapping.matchConfidence === 'high' ? 'high' : 'medium',
          fitment: withOverrides,
          trimMapping: {
            found: true,
            mappingId: mappingResult.mapping.id,
            showSizeChooser: mappingResult.showSizeChooser,
            autoSelectedConfig: autoSelected,
            configurations: configsForResult,
            chooserReason: mappingResult.chooserReason,
          },
          debug: {
            ...result.debug,
            wasGroupedRecord: false,
            matchedAtomicTrim: requestedTrim,
            trimMappingDebug: {
              resolutionSource: "wheel_size_trim_mapping",
              mappingId: mappingResult.mapping.id,
              mappingStatus: mappingResult.mapping.status,
              matchConfidence: mappingResult.mapping.matchConfidence,
              matchMethod: mappingResult.mapping.matchMethod,
            },
          },
        };
      }
      
      // Mapping exists but not approved or low confidence - update trimMapping info but continue to other resolution methods
      if (mappingResult.found && mappingResult.mapping) {
        result.trimMapping = {
          found: true,
          mappingId: mappingResult.mapping.id,
          showSizeChooser: true, // Force chooser for non-approved mappings
          autoSelectedConfig: null,
          configurations: mappingResult.configurations.map(c => ({
            configId: c.id,
            wheelDiameter: c.wheelDiameter,
            tireSize: c.tireSize,
            isDefault: c.isDefault,
          })),
          chooserReason: mappingResult.chooserReason || 'needs_review',
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Exact canonical displayTrim match (atomic trims only)
    // 
    // 2026-05-18: For BMW model numbers, we skip the fast-path exact match
    // and always go through STEP 3 to check for related variants with
    // different fitments (e.g., "328i" vs "328i Sport Package").
    // ─────────────────────────────────────────────────────────────────────────
    const isBmwModelNumber = normalizedMake.toLowerCase() === "bmw" && 
                              /^\d{3}[a-z]*$/i.test(requestedTrim || "");
    
    if (requestedTrim && !isBmwModelNumber) {
      // First try exact match on non-grouped records (fast path for non-BMW)
      const [exactTrimMatch] = await db
        .select()
        .from(vehicleFitments)
        .where(
          and(
            eq(vehicleFitments.year, year),
            makeLikeAny(vehicleFitments.make, make),
            ilike(vehicleFitments.model, modelName),
            eq(vehicleFitments.displayTrim, requestedTrim),
            eq(vehicleFitments.certificationStatus, "certified")
          )
        )
        .limit(1);
      
      if (exactTrimMatch && !isGroupedTrim(exactTrimMatch.displayTrim)) {
        const withOverrides = await applyOverrides(exactTrimMatch);
        return {
          ...result,
          canonicalFitmentId: generateCanonicalId(year, make, model, exactTrimMatch.displayTrim),
          modificationId: exactTrimMatch.modificationId,
          displayTrim: exactTrimMatch.displayTrim,
          matchedBy: "exact_canonical_trim",
          confidence: "high",
          fitment: withOverrides,
        };
      }
    }
    
    // For BMW model numbers, log that we're checking for variants
    if (isBmwModelNumber) {
      console.log(`[canonicalResolver] BMW model number "${requestedTrim}" - checking for related variants before resolving`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Search all records and find best match
    // ─────────────────────────────────────────────────────────────────────────
    const allRecords = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          makeLikeAny(vehicleFitments.make, make),
          ilike(vehicleFitments.model, modelName),
          eq(vehicleFitments.certificationStatus, "certified")
        )
      )
      .limit(50);
    
    if (allRecords.length === 0) continue;
    
    // Build candidate list with atomic trim info
    const candidates = allRecords.map(rec => {
      const isGrouped = isGroupedTrim(rec.displayTrim);
      const atomicTrims = isGrouped ? explodeTrim(rec.displayTrim) : [rec.displayTrim];
      return {
        record: rec,
        modificationId: rec.modificationId,
        displayTrim: rec.displayTrim,
        isGrouped,
        atomicTrims,
        tireSizes: normalizeTireSizes(rec.oemTireSizes),
      };
    });

    // Populate debug info
    result.debug.candidateTrims = candidates.map(c => ({
      modificationId: c.modificationId,
      displayTrim: c.displayTrim,
      isGrouped: c.isGrouped,
      atomicTrims: c.atomicTrims,
      tireSizes: c.tireSizes,
    }));

    // If trim requested, try to find it in any record (including grouped)
    if (requestedTrim) {
      // Look for exact atomic match in all candidates
      for (const candidate of candidates) {
        const matchedAtomic = candidate.atomicTrims.find(t => 
          t.toLowerCase() === requestedTrim.toLowerCase()
        );
        
        if (matchedAtomic) {
          // ─────────────────────────────────────────────────────────────────────
          // BMW VARIANT CHECK (2026-05-18)
          // 
          // Before returning exact match, check if there are related variants
          // (e.g., "328i Sport Package" when user asked for "328i") that have
          // DIFFERENT fitments. If so, ask for clarification.
          // 
          // This prevents giving square fitment to a Sport Package customer.
          // ─────────────────────────────────────────────────────────────────────
          const matchedLower = matchedAtomic.toLowerCase();
          const relatedVariants: Array<{ trim: string; tireSizes: string[]; isStaggered: boolean }> = [];
          
          // Find other trims that start with the same root
          for (const otherCandidate of candidates) {
            for (const otherTrim of otherCandidate.atomicTrims) {
              const otherLower = otherTrim.toLowerCase();
              // Related if: other trim starts with matched trim + space/hyphen
              // e.g., "328i sport package" starts with "328i "
              if (otherLower !== matchedLower && 
                  (otherLower.startsWith(matchedLower + " ") || 
                   otherLower.startsWith(matchedLower + "-"))) {
                // Check if it's staggered (different front/rear sizes or position markers)
                const sizes = otherCandidate.tireSizes;
                const isStaggered = sizes.length === 2 && sizes[0] !== sizes[1];
                relatedVariants.push({ 
                  trim: otherTrim, 
                  tireSizes: sizes,
                  isStaggered 
                });
              }
            }
          }
          
          // If related variants exist with DIFFERENT fitments, require clarification
          if (relatedVariants.length > 0) {
            const matchedSizes = JSON.stringify(candidate.tireSizes.sort());
            const hasDifferentFitment = relatedVariants.some(v => 
              JSON.stringify(v.tireSizes.sort()) !== matchedSizes
            );
            
            if (hasDifferentFitment) {
              // Build list of all variants including the matched one
              const allVariants = [
                { trim: matchedAtomic, tireSizes: candidate.tireSizes, isStaggered: candidate.tireSizes.length === 2 && candidate.tireSizes[0] !== candidate.tireSizes[1] },
                ...relatedVariants
              ];
              
              console.log(`[canonicalResolver] BMW variant clarification needed: "${matchedAtomic}" has ${relatedVariants.length} related variant(s) with different fitment`);
              
              return {
                ...result,
                matchedBy: "blocked",
                confidence: "low",
                debug: {
                  ...result.debug,
                  fallbackBlockedReason: `Multiple "${matchedAtomic}" variants exist with different fitments. Please specify which version.`,
                  bmwVariantClarification: {
                    requestedTrim: matchedAtomic,
                    variants: allVariants.map(v => ({
                      trim: v.trim,
                      tireSizes: v.tireSizes,
                      isStaggered: v.isStaggered,
                      description: v.isStaggered 
                        ? `Staggered: F:${v.tireSizes[0]} R:${v.tireSizes[1]}`
                        : `Square: ${v.tireSizes.join(", ")}`
                    }))
                  }
                },
              };
            }
          }
          
          // No conflicting variants - safe to return exact match
          const withOverrides = await applyOverrides(candidate.record);
          return {
            ...result,
            canonicalFitmentId: generateCanonicalId(year, make, model, matchedAtomic),
            modificationId: candidate.modificationId,
            displayTrim: matchedAtomic,
            matchedBy: candidate.isGrouped ? "normalized_trim" : "exact_canonical_trim",
            confidence: candidate.isGrouped ? "medium" : "high",
            fitment: withOverrides,
            debug: {
              ...result.debug,
              wasGroupedRecord: candidate.isGrouped,
              matchedAtomicTrim: matchedAtomic,
            },
          };
        }
      }

      // Try normalized match
      for (const candidate of candidates) {
        const matchedAtomic = candidate.atomicTrims.find(t => 
          normalizeTrim(t) === normalizedRequestedTrim
        );
        
        if (matchedAtomic) {
          const withOverrides = await applyOverrides(candidate.record);
          return {
            ...result,
            canonicalFitmentId: generateCanonicalId(year, make, model, matchedAtomic),
            modificationId: candidate.modificationId,
            displayTrim: matchedAtomic,
            matchedBy: "normalized_trim",
            confidence: "medium",
            fitment: withOverrides,
            debug: {
              ...result.debug,
              wasGroupedRecord: candidate.isGrouped,
              matchedAtomicTrim: matchedAtomic,
            },
          };
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // STEP 3.5: Partial trim match (2026-05-18)
      // 
      // Handles cases where user says "330i" but DB has "330i xDrive"
      // Also handles "328i" when DB has "328i Sedan", "328i Coupe", etc.
      // 
      // Rules:
      // 1. If requested trim is a prefix of exactly ONE atomic trim, use it
      // 2. If multiple partial matches, continue to blocking/selection
      // ─────────────────────────────────────────────────────────────────────────
      const partialMatches: Array<{ candidate: typeof candidates[0]; matchedTrim: string }> = [];
      const requestedLower = requestedTrim.toLowerCase();
      
      for (const candidate of candidates) {
        for (const atomicTrim of candidate.atomicTrims) {
          const atomicLower = atomicTrim.toLowerCase();
          // Check if requested is a prefix of atomic (e.g., "330i" → "330i xDrive")
          // Or if atomic starts with requested + space/hyphen
          if (atomicLower.startsWith(requestedLower + " ") || 
              atomicLower.startsWith(requestedLower + "-") ||
              atomicLower === requestedLower) {
            partialMatches.push({ candidate, matchedTrim: atomicTrim });
          }
        }
      }
      
      // If exactly one partial match, use it
      if (partialMatches.length === 1) {
        const { candidate, matchedTrim } = partialMatches[0];
        console.log(`[canonicalResolver] Partial trim match: "${requestedTrim}" → "${matchedTrim}"`);
        const withOverrides = await applyOverrides(candidate.record);
        return {
          ...result,
          canonicalFitmentId: generateCanonicalId(year, make, model, matchedTrim),
          modificationId: candidate.modificationId,
          displayTrim: matchedTrim,
          matchedBy: "normalized_trim",
          confidence: "medium",
          fitment: withOverrides,
          debug: {
            ...result.debug,
            wasGroupedRecord: candidate.isGrouped,
            matchedAtomicTrim: matchedTrim,
          },
        };
      } else if (partialMatches.length > 1) {
        // Multiple partial matches with same tire sizes? Use first one.
        const uniqueFitments = new Set(partialMatches.map(pm => 
          JSON.stringify(pm.candidate.tireSizes.sort())
        ));
        
        if (uniqueFitments.size === 1) {
          const { candidate, matchedTrim } = partialMatches[0];
          console.log(`[canonicalResolver] Multiple partial matches with identical fitment, using first: "${matchedTrim}"`);
          const withOverrides = await applyOverrides(candidate.record);
          return {
            ...result,
            canonicalFitmentId: generateCanonicalId(year, make, model, matchedTrim),
            modificationId: candidate.modificationId,
            displayTrim: matchedTrim,
            matchedBy: "identical_fallback",
            confidence: "low",
            fitment: withOverrides,
            debug: {
              ...result.debug,
              wasGroupedRecord: candidate.isGrouped,
              matchedAtomicTrim: matchedTrim,
            },
          };
        }
        // Multiple partial matches with different fitments - continue to blocking
        console.log(`[canonicalResolver] Multiple partial matches with different fitments for "${requestedTrim}": ${partialMatches.map(pm => pm.matchedTrim).join(", ")}`);
      }

      // Trim requested but not found - check if safe fallback is possible
      const uniqueTireSizes = new Set(candidates.map(c => JSON.stringify(c.tireSizes.sort())));
      
      if (uniqueTireSizes.size === 1 && candidates.length > 0) {
        // All candidates have identical tire sizes - safe to use any
        const firstCandidate = candidates[0];
        const withOverrides = await applyOverrides(firstCandidate.record);
        return {
          ...result,
          canonicalFitmentId: null, // Can't generate canonical ID without specific trim
          modificationId: firstCandidate.modificationId,
          displayTrim: firstCandidate.atomicTrims[0],
          matchedBy: "identical_fallback",
          confidence: "low",
          fitment: withOverrides,
          debug: {
            ...result.debug,
            fallbackBlockedReason: null,
          },
        };
      } else {
        // Different fitment across candidates - BLOCK
        return {
          ...result,
          matchedBy: "blocked",
          confidence: "low",
          debug: {
            ...result.debug,
            fallbackBlockedReason: `Trim "${requestedTrim}" not found. ${candidates.length} trims exist with ${uniqueTireSizes.size} different fitment configurations.`,
          },
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: No trim specified - return first non-grouped or single record
    // ─────────────────────────────────────────────────────────────────────────
    if (candidates.length === 1) {
      const single = candidates[0];
      const withOverrides = await applyOverrides(single.record);
      return {
        ...result,
        canonicalFitmentId: generateCanonicalId(year, make, model, single.atomicTrims[0]),
        modificationId: single.modificationId,
        displayTrim: single.atomicTrims[0],
        matchedBy: single.isGrouped ? "normalized_trim" : "exact_canonical_trim",
        confidence: single.isGrouped ? "medium" : "high",
        fitment: withOverrides,
        debug: {
          ...result.debug,
          wasGroupedRecord: single.isGrouped,
        },
      };
    }

    // Multiple candidates without trim selection - need user input
    return {
      ...result,
      matchedBy: "not_found",
      debug: {
        ...result.debug,
        fallbackBlockedReason: `Multiple trims exist for ${year} ${make} ${model}. Please select a specific trim.`,
      },
    };
  }

  return result;
}

// ============================================================================
// Atomic Trim Options (for selector APIs)
// ============================================================================

export interface AtomicTrimOption {
  label: string;                    // Display name (e.g., "Sport")
  value: string;                    // Canonical fitment ID or modificationId
  modificationId: string;           // DB modificationId
  canonicalFitmentId: string;       // Unique canonical ID
  isFromGroupedRecord: boolean;     // True if exploded from grouped record
  tireSizes: string[];              // OEM tire sizes for this trim
}

/**
 * Get atomic trim options for a vehicle (for selector dropdowns).
 * Explodes grouped records into individual options.
 */
export async function getAtomicTrimOptions(
  year: number,
  make: string,
  model: string
): Promise<AtomicTrimOption[]> {
  const normalizedMake = canonicalMake(make);
  const modelVariants = getModelVariants(model);
  
  const options: AtomicTrimOption[] = [];
  const seenTrims = new Set<string>();
  
  for (const modelName of modelVariants) {
    const records = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          makeLikeAny(vehicleFitments.make, make),
          ilike(vehicleFitments.model, modelName),
          eq(vehicleFitments.certificationStatus, "certified")
        )
      )
      .limit(50);
    
    for (const rec of records) {
      const isGrouped = isGroupedTrim(rec.displayTrim);
      const atomicTrims = isGrouped ? explodeTrim(rec.displayTrim) : [rec.displayTrim];
      const tireSizes = normalizeTireSizes(rec.oemTireSizes);
      
      for (const atomicTrim of atomicTrims) {
        const normalizedLabel = atomicTrim.trim();
        if (seenTrims.has(normalizedLabel.toLowerCase())) continue;
        seenTrims.add(normalizedLabel.toLowerCase());
        
        const canonicalId = generateCanonicalId(year, make, model, atomicTrim);
        
        options.push({
          label: normalizedLabel,
          value: canonicalId,
          modificationId: rec.modificationId,
          canonicalFitmentId: canonicalId,
          isFromGroupedRecord: isGrouped,
          tireSizes,
        });
      }
    }
    
    if (options.length > 0) break; // Found options for this model variant
  }
  
  // Sort alphabetically
  options.sort((a, b) => a.label.localeCompare(b.label));
  
  return options;
}

