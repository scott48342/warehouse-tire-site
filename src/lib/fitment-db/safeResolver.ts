/**
 * SAFE FITMENT RESOLVER
 * 
 * Resolves fitment data with controlled fallback logic.
 * Prevents false "no fitment data" errors from modification ID mismatches.
 * 
 * Resolution order:
 * 1. Exact year/make/model/modification match
 * 2. Exact year/make/model with displayTrim match
 * 3. Normalized trim match (case-insensitive, slug comparison)
 * 4. Fail only if no unambiguous match exists
 * 
 * Rules:
 * - Exact modification match ALWAYS wins
 * - No random guessing across multiple trims
 * - Only use fallback if match is unambiguous (single result)
 * - Log all fallback usage
 */

import { db } from "./db";
import { vehicleFitments } from "./schema";
import type { VehicleFitment } from "./schema";
import { eq, and, sql, ilike } from "drizzle-orm";
import { normalizeMake, normalizeModel, slugify } from "./keys";
import { applyOverrides } from "./applyOverrides";
import { getModelVariants, wasAliasUsed } from "./modelAliases";
import { fitmentLog } from "./logger";

// ============================================================================
// Certification Filter (2026-04-26)
// STRICT: Only return certified records for runtime queries
// No NULL fallback - all records are stamped as of certification pass
// ============================================================================

const CERTIFIED_FILTER = eq(vehicleFitments.certificationStatus, "certified");

// ============================================================================
// Types
// ============================================================================

export type ResolutionMethod = 
  | "exact_modification"    // Exact modificationId match
  | "exact_display_trim"    // Exact displayTrim match (case-sensitive)
  | "normalized_trim"       // Normalized/slugified trim match
  | "single_trim_fallback"  // Only one trim exists for Y/M/M
  | "model_alias"           // Resolved via model alias (f-350 → f-350-super-duty)
  | "not_found";            // No valid match

export interface SafeResolverResult {
  fitment: VehicleFitment | null;
  method: ResolutionMethod;
  requestedModificationId: string;
  resolvedModificationId: string | null;
  modelAliasUsed: boolean;
  isAmbiguous: boolean;
  candidateCount: number;
  overridesApplied: boolean;
}

// ============================================================================
// Trim Normalization
// ============================================================================

/**
 * Normalize a trim name for comparison.
 * Handles variations like "XLT", "xlt", "X-L-T", "XLT Crew Cab"
 */
function normalizeTrim(trim: string): string {
  return trim
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")  // Remove all non-alphanumeric
    .replace(/crewcab|extendedcab|regularcab|supercrew|supercab/g, "")  // Remove cab types
    .replace(/4x4|4wd|awd|2wd|rwd|fwd/g, "")  // Remove drive types
    .replace(/diesel|gas|hybrid|electric/g, "")  // Remove fuel types
    .trim();
}

/**
 * Check if two trim names are equivalent after normalization
 */
function trimsMatch(trim1: string, trim2: string): boolean {
  const n1 = normalizeTrim(trim1);
  const n2 = normalizeTrim(trim2);
  
  if (n1 === n2) return true;
  
  // Check if one contains the other (for partial matches like "XLT" vs "XLT Premium")
  if (n1.length > 0 && n2.length > 0) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }
  
  return false;
}

// ============================================================================
// Safe Resolver
// ============================================================================

/**
 * Safely resolve fitment with controlled fallback.
 * 
 * @param year Vehicle year
 * @param make Vehicle make
 * @param model Vehicle model
 * @param modificationId Requested modification ID (from URL, selector, etc.)
 */
export async function safeResolveFitment(
  year: number,
  make: string,
  model: string,
  modificationId: string
): Promise<SafeResolverResult> {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  const normalizedModId = slugify(modificationId);
  const requestedTrimNormalized = normalizeTrim(modificationId);
  
  let modelAliasUsed = false;
  
  // Try each model variant (handles f-250 → f-250-super-duty)
  for (let i = 0; i < modelVariants.length; i++) {
    const modelName = modelVariants[i];
    const isAliasedModel = i > 0; // First is original, rest are aliases
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Exact modificationId match (HIGHEST PRIORITY)
    // ─────────────────────────────────────────────────────────────────────────
    const [exactModMatch] = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          ilike(vehicleFitments.make, normalizedMake),
          ilike(vehicleFitments.model, modelName),
          eq(vehicleFitments.modificationId, normalizedModId),
          CERTIFIED_FILTER
        )
      )
      .limit(1);
    
    if (exactModMatch) {
      if (isAliasedModel) {
        modelAliasUsed = true;
        fitmentLog.fallback("alias_used", {
          from: model,
          to: modelName,
          vehicle: `${year} ${make} ${model}`,
        });
      }
      
      const withOverrides = await applyOverrides(exactModMatch);
      return {
        fitment: withOverrides,
        method: isAliasedModel ? "model_alias" : "exact_modification",
        requestedModificationId: modificationId,
        resolvedModificationId: exactModMatch.modificationId,
        modelAliasUsed,
        isAmbiguous: false,
        candidateCount: 1,
        overridesApplied: withOverrides !== exactModMatch,
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Exact displayTrim match (case-sensitive)
    // ─────────────────────────────────────────────────────────────────────────
    const [exactTrimMatch] = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          ilike(vehicleFitments.make, normalizedMake),
          ilike(vehicleFitments.model, modelName),
          eq(vehicleFitments.displayTrim, modificationId),
          CERTIFIED_FILTER
        )
      )
      .limit(1);
    
    if (exactTrimMatch) {
      if (isAliasedModel) modelAliasUsed = true;
      
      fitmentLog.fallback("trim_fallback", {
        from: modificationId,
        to: exactTrimMatch.modificationId,
        vehicle: `${year} ${make} ${model}`,
        details: { method: "exact_display_trim" },
      });
      
      const withOverrides = await applyOverrides(exactTrimMatch);
      return {
        fitment: withOverrides,
        method: "exact_display_trim",
        requestedModificationId: modificationId,
        resolvedModificationId: exactTrimMatch.modificationId,
        modelAliasUsed,
        isAmbiguous: false,
        candidateCount: 1,
        overridesApplied: withOverrides !== exactTrimMatch,
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Case-insensitive displayTrim match
    // ─────────────────────────────────────────────────────────────────────────
    const caseInsensitiveMatches = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          ilike(vehicleFitments.make, normalizedMake),
          ilike(vehicleFitments.model, modelName),
          ilike(vehicleFitments.displayTrim, modificationId),
          CERTIFIED_FILTER
        )
      )
      .limit(5);
    
    if (caseInsensitiveMatches.length === 1) {
      const match = caseInsensitiveMatches[0];
      if (isAliasedModel) modelAliasUsed = true;
      
      fitmentLog.fallback("trim_fallback", {
        from: modificationId,
        to: match.modificationId,
        vehicle: `${year} ${make} ${model}`,
        details: { method: "case_insensitive_trim" },
      });
      
      const withOverrides = await applyOverrides(match);
      return {
        fitment: withOverrides,
        method: "normalized_trim",
        requestedModificationId: modificationId,
        resolvedModificationId: match.modificationId,
        modelAliasUsed,
        isAmbiguous: false,
        candidateCount: 1,
        overridesApplied: withOverrides !== match,
      };
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Normalized trim comparison (handles XLT vs xlt, etc.)
    // ─────────────────────────────────────────────────────────────────────────
    const allTrims = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          ilike(vehicleFitments.make, normalizedMake),
          ilike(vehicleFitments.model, modelName),
          CERTIFIED_FILTER
        )
      )
      .limit(50);
    
    if (allTrims.length > 0) {
      // Find trims that match after normalization
      const normalizedMatches = allTrims.filter(t => 
        trimsMatch(t.displayTrim, modificationId) || 
        trimsMatch(t.modificationId, modificationId)
      );
      
      if (normalizedMatches.length === 1) {
        const match = normalizedMatches[0];
        if (isAliasedModel) modelAliasUsed = true;
        
        fitmentLog.fallback("trim_fallback", {
          from: modificationId,
          to: match.modificationId,
          vehicle: `${year} ${make} ${model}`,
          details: { method: "normalized_trim", displayTrim: match.displayTrim },
        });
        
        const withOverrides = await applyOverrides(match);
        return {
          fitment: withOverrides,
          method: "normalized_trim",
          requestedModificationId: modificationId,
          resolvedModificationId: match.modificationId,
          modelAliasUsed,
          isAmbiguous: false,
          candidateCount: 1,
          overridesApplied: withOverrides !== match,
        };
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // STEP 5: Single trim fallback (if only one trim exists for Y/M/M)
      // This is safe because there's no ambiguity
      // ─────────────────────────────────────────────────────────────────────────
      if (allTrims.length === 1) {
        const match = allTrims[0];
        if (isAliasedModel) modelAliasUsed = true;
        
        fitmentLog.fallback("base_trim_fallback", {
          from: modificationId,
          to: match.modificationId,
          vehicle: `${year} ${make} ${model}`,
          details: { method: "single_trim_fallback", displayTrim: match.displayTrim },
        });
        
        const withOverrides = await applyOverrides(match);
        return {
          fitment: withOverrides,
          method: "single_trim_fallback",
          requestedModificationId: modificationId,
          resolvedModificationId: match.modificationId,
          modelAliasUsed,
          isAmbiguous: false,
          candidateCount: 1,
          overridesApplied: withOverrides !== match,
        };
      }
      
      // Multiple trims exist but none match - this is ambiguous
      if (normalizedMatches.length > 1) {
        fitmentLog.validationError("ambiguous_trim_match", {
          vehicle: `${year} ${make} ${model}`,
          requestedModificationId: modificationId,
          candidates: normalizedMatches.map(t => ({
            modificationId: t.modificationId,
            displayTrim: t.displayTrim,
          })),
        });
        
        return {
          fitment: null,
          method: "not_found",
          requestedModificationId: modificationId,
          resolvedModificationId: null,
          modelAliasUsed,
          isAmbiguous: true,
          candidateCount: normalizedMatches.length,
          overridesApplied: false,
        };
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6: No match found
  // ─────────────────────────────────────────────────────────────────────────
  fitmentLog.notFound(`${year} ${make} ${model} mod=${modificationId}`, [
    "exact_modification",
    "exact_display_trim",
    "case_insensitive_trim",
    "normalized_trim",
    "single_trim_fallback",
  ]);
  
  return {
    fitment: null,
    method: "not_found",
    requestedModificationId: modificationId,
    resolvedModificationId: null,
    modelAliasUsed,
    isAmbiguous: false,
    candidateCount: 0,
    overridesApplied: false,
  };
}

// ============================================================================
// Batch Resolution (for auditing)
// ============================================================================

export interface BatchResolveInput {
  year: number;
  make: string;
  model: string;
  modificationId: string;
}

export async function batchResolveFitments(
  inputs: BatchResolveInput[]
): Promise<SafeResolverResult[]> {
  const results: SafeResolverResult[] = [];
  
  for (const input of inputs) {
    const result = await safeResolveFitment(
      input.year,
      input.make,
      input.model,
      input.modificationId
    );
    results.push(result);
  }
  
  return results;
}
