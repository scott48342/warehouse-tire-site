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
import { normalizeMake, normalizeModel, slugify } from "@/lib/fitment-db/keys";
import { applyOverrides } from "@/lib/fitment-db/applyOverrides";
import { getModelVariants } from "@/lib/fitment-db/modelAliases";
import { getTrimMapping, type TrimMappingResult } from "@/lib/fitment-db/wheelSizeTrimMapping";

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

/**
 * Check if a displayTrim is grouped (contains comma or slash)
 */
function isGroupedTrim(displayTrim: string): boolean {
  return /[,\/]/.test(displayTrim);
}

/**
 * Split a grouped displayTrim into atomic trims
 */
function splitGroupedTrim(displayTrim: string): string[] {
  return displayTrim.split(/[,\/]/).map(t => t.trim()).filter(Boolean);
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
  const { year, make, model, trim, modificationId } = input;
  
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  const requestedTrim = trim || null;
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
            ilike(vehicleFitments.make, normalizedMake),
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
          const atomicTrims = splitGroupedTrim(exactMatch.displayTrim);
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
          displayTrim: isGrouped ? splitGroupedTrim(exactMatch.displayTrim)[0] : exactMatch.displayTrim,
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
    // ─────────────────────────────────────────────────────────────────────────
    if (requestedTrim) {
      // First try exact match on non-grouped records
      const [exactTrimMatch] = await db
        .select()
        .from(vehicleFitments)
        .where(
          and(
            eq(vehicleFitments.year, year),
            ilike(vehicleFitments.make, normalizedMake),
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

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Search all records and find best match
    // ─────────────────────────────────────────────────────────────────────────
    const allRecords = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          ilike(vehicleFitments.make, normalizedMake),
          ilike(vehicleFitments.model, modelName),
          eq(vehicleFitments.certificationStatus, "certified")
        )
      )
      .limit(50);
    
    if (allRecords.length === 0) continue;

    // Build candidate list with atomic trim info
    const candidates = allRecords.map(rec => {
      const isGrouped = isGroupedTrim(rec.displayTrim);
      const atomicTrims = isGrouped ? splitGroupedTrim(rec.displayTrim) : [rec.displayTrim];
      return {
        record: rec,
        modificationId: rec.modificationId,
        displayTrim: rec.displayTrim,
        isGrouped,
        atomicTrims,
        tireSizes: (rec.oemTireSizes as string[]) || [],
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
  const normalizedMake = normalizeMake(make);
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
          ilike(vehicleFitments.make, normalizedMake),
          ilike(vehicleFitments.model, modelName),
          eq(vehicleFitments.certificationStatus, "certified")
        )
      )
      .limit(50);
    
    for (const rec of records) {
      const isGrouped = isGroupedTrim(rec.displayTrim);
      const atomicTrims = isGrouped ? splitGroupedTrim(rec.displayTrim) : [rec.displayTrim];
      const tireSizes = (rec.oemTireSizes as string[]) || [];
      
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
