/**
 * Fitment Profile Service (ModificationId-First with Alias Resolution)
 * 
 * Provides complete fitment profiles for wheels/tires pages.
 * Uses vehicle_fitments table with canonical modificationId as PRIMARY key.
 * Supports alias mapping when requested modificationId differs from canonical.
 * 
 * Resolution Flow:
 * 1. Direct DB lookup by requested modificationId → "directCanonical"
 * 2. Alias lookup (requested → canonical mapping) → "canonicalAlias"
 * 3. API fetch + import (stores alias if different) → "importedAlias"
 * 4. Failure → "not_found"
 * 
 * Resolution Paths:
 * - "directCanonical" - Found directly in vehicle_fitments by modificationId
 * - "canonicalAlias" - Found via alias mapping to different canonical ID
 * - "importedAlias" - Fetched from API, imported with different ID, alias stored
 * - "not_found" - Could not resolve
 */

import { db } from "./db";
import { vehicleFitments, fitmentSourceRecords, modificationAliases } from "./schema";
import type { VehicleFitment } from "./schema";
import { eq, and } from "drizzle-orm";
import { normalizeMake, normalizeModel, normalizeModelForApi, slugify, makePayloadChecksum } from "./keys";
import { applyOverridesWithMeta } from "./applyOverrides";
import { normalizeTrimLabel } from "@/lib/trimNormalize";
// WHEEL-SIZE REMOVED: import { isWheelSizeEnabled } from "@/lib/wheelSizeApi";
import crypto from "crypto";
import submodelSupplements from "@/data/submodel-supplements.json";
import { getFitmentFromRules, matchFitmentRule } from "./vehicleFitmentRules";

// ============================================================================
// Types
// ============================================================================

export type ProfileResolutionPath = 
  | "directCanonical"   // Found directly in DB by requested modificationId
  | "canonicalAlias"    // Found via alias to different canonical modificationId
  | "importedAlias"     // Imported from API, alias stored
  | "not_found";        // Could not resolve

export interface FitmentProfile {
  modificationId: string;
  year: number;
  make: string;
  model: string;
  displayTrim: string;
  rawTrim: string | null;
  boltPattern: string | null;
  centerBoreMm: number | null;
  threadSize: string | null;
  seatType: string | null;
  offsetMinMm: number | null;
  offsetMaxMm: number | null;
  oemWheelSizes: WheelSize[];
  oemTireSizes: string[];
  source: "db" | "api";
  apiCalled: boolean;
  overridesApplied: boolean;
}

export interface WheelSize {
  diameter: number;
  width: number;
  offset: number | null;
  tireSize: string | null;
  axle: "front" | "rear" | "both";
  isStock: boolean;
}

export interface ProfileLookupResult {
  profile: FitmentProfile | null;
  resolutionPath: ProfileResolutionPath;
  requestedModificationId: string;
  canonicalModificationId: string | null;
  aliasUsed: boolean;
  apiCalled: boolean;
  overridesApplied: boolean;
  timing: {
    dbLookupMs: number;
    aliasLookupMs?: number;
    ymmFallbackMs?: number;
    apiCallMs?: number;
    importMs?: number;
    totalMs: number;
  };
  // Legacy compatibility
  source: "db" | "api" | "not_found";
}

// ============================================================================
// WHEEL-SIZE API REMOVED
// ============================================================================
// All Wheel-Size API code has been removed. This is now 100% DB-first.
// Fitment data must be imported via admin tools.
// ============================================================================

// REMOVED: WheelSizeModification, WheelSizeWheelSetup, WheelSizeVehicleData interfaces
// All Wheel-Size types have been removed. This is now 100% DB-first.

function safeString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name.trim();
    if (typeof obj.value === "string") return obj.value.trim();
    if (typeof obj.capacity === "string") return obj.capacity.trim();
    return "";
  }
  return "";
}

// ============================================================================
// Supplement ID Resolution
// ============================================================================

type SubmodelEntry = { value: string; label: string };
type YearRangeMap = { [yearRange: string]: SubmodelEntry[] };
type ModelMap = { [model: string]: YearRangeMap };
type MakeMap = { [make: string]: ModelMap };

/**
 * Check if a modificationId is a supplement-generated hash ID (prefix: s_)
 */
function isSupplementId(modificationId: string): boolean {
  return modificationId.startsWith("s_") && modificationId.length === 10;
}

/**
 * Reverse-lookup a supplement ID to get the original trim value.
 * Supplement IDs are SHA256 hashes of "year:make:model:trimValue".
 * 
 * Returns the trim value (e.g., "xlt") if found, null otherwise.
 */
function resolveSupplementTrimValue(
  supplementId: string,
  year: number,
  make: string,
  model: string
): string | null {
  if (!isSupplementId(supplementId)) return null;
  
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  const makeData = (submodelSupplements as MakeMap)[make.toLowerCase()];
  if (!makeData) return null;
  
  const modelData = makeData[model.toLowerCase()];
  if (!modelData) return null;
  
  // Check each year range
  for (const [range, entries] of Object.entries(modelData)) {
    const [startStr, endStr] = range.split("-");
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    
    if (year >= start && year <= end) {
      // Check each trim entry to find which one matches our hash
      for (const entry of entries as SubmodelEntry[]) {
        const input = `${year}:${normalizedMake}:${normalizedModel}:${slugify(entry.value)}`;
        const hash = crypto.createHash("sha256").update(input).digest("hex").slice(0, 8);
        if (`s_${hash}` === supplementId) {
          console.log(`[profileService] Resolved supplement ID ${supplementId} → trim "${entry.value}" (${entry.label})`);
          return entry.value;
        }
      }
    }
  }
  
  console.log(`[profileService] Could not resolve supplement ID ${supplementId} for ${year} ${make} ${model}`);
  return null;
}

// REMOVED: findModificationByTrimLevel - was Wheel-Size API helper
// REMOVED: fetchModificationFromApi - was Wheel-Size API call

// ============================================================================
// Profile Validation
// ============================================================================

export type FitmentQuality = "valid" | "partial" | "invalid";

export function assessFitmentQuality(fitment: VehicleFitment): {
  quality: FitmentQuality;
  reasons: string[];
} {
  const reasons: string[] = [];
  const hasBoltPattern = Boolean(fitment.boltPattern);
  const hasWheelSizes = Array.isArray(fitment.oemWheelSizes) && fitment.oemWheelSizes.length > 0;
  const hasTireSizes = Array.isArray(fitment.oemTireSizes) && fitment.oemTireSizes.length > 0;
  
  if (!hasBoltPattern) reasons.push("missing boltPattern");
  if (!hasWheelSizes && !hasTireSizes) reasons.push("no OEM wheel or tire sizes");
  
  if (hasBoltPattern && (hasWheelSizes || hasTireSizes)) {
    return { quality: "valid", reasons: [] };
  }
  if (hasBoltPattern) {
    return { quality: "partial", reasons };
  }
  return { quality: "invalid", reasons };
}

export function isValidFitmentProfile(fitment: VehicleFitment): boolean {
  const { quality } = assessFitmentQuality(fitment);
  return quality === "valid" || quality === "partial";
}

// ============================================================================
// Alias Management
// ============================================================================

/**
 * Look up canonical modificationId from alias table
 */
async function resolveAlias(
  year: number,
  make: string,
  model: string,
  requestedModificationId: string
): Promise<{ canonicalModificationId: string; vehicleFitmentId: string | null } | null> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  // Don't slugify - preserve underscores in manual_XXXX IDs
  const normalizedReqId = requestedModificationId.toLowerCase().trim();
  
  const alias = await db.query.modificationAliases.findFirst({
    where: and(
      eq(modificationAliases.year, year),
      eq(modificationAliases.make, normalizedMake),
      eq(modificationAliases.model, normalizedModel),
      eq(modificationAliases.requestedModificationId, normalizedReqId)
    ),
  });
  
  if (alias) {
    return {
      canonicalModificationId: alias.canonicalModificationId,
      vehicleFitmentId: alias.vehicleFitmentId,
    };
  }
  
  return null;
}

/**
 * Store an alias mapping from requested to canonical modificationId
 */
async function storeAlias(
  year: number,
  make: string,
  model: string,
  requestedModificationId: string,
  canonicalModificationId: string,
  displayTrim: string,
  vehicleFitmentId: string | null
): Promise<void> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  // Don't slugify - preserve underscores in manual_XXXX IDs
  const normalizedReqId = requestedModificationId.toLowerCase().trim();
  const normalizedCanonId = canonicalModificationId.toLowerCase().trim();
  
  // Don't store self-referential aliases
  if (normalizedReqId === normalizedCanonId) {
    return;
  }
  
  console.log(`[profileService] STORING ALIAS: ${year} ${make} ${model} | ${requestedModificationId} → ${canonicalModificationId}`);
  
  try {
    // Upsert the alias
    const existing = await db.query.modificationAliases.findFirst({
      where: and(
        eq(modificationAliases.year, year),
        eq(modificationAliases.make, normalizedMake),
        eq(modificationAliases.model, normalizedModel),
        eq(modificationAliases.requestedModificationId, normalizedReqId)
      ),
    });
    
    if (existing) {
      await db.update(modificationAliases)
        .set({
          canonicalModificationId: normalizedCanonId,
          displayTrim,
          vehicleFitmentId,
        })
        .where(eq(modificationAliases.id, existing.id));
    } else {
      await db.insert(modificationAliases).values({
        year,
        make: normalizedMake,
        model: normalizedModel,
        requestedModificationId: normalizedReqId,
        canonicalModificationId: normalizedCanonId,
        displayTrim,
        vehicleFitmentId,
      });
    }
  } catch (err: any) {
    console.error(`[profileService] Failed to store alias:`, err?.message);
  }
}

// ============================================================================
// Direct DB Lookup
// ============================================================================

async function getProfileByModificationIdDirect(
  year: number,
  make: string,
  model: string,
  modificationId: string
): Promise<{ fitment: VehicleFitment | null; lookupMs: number }> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  // NOTE: Don't use slugify() here - it converts underscores to hyphens
  // Manual imports use modificationIds like "manual_XXXX" with underscores
  const normalizedModId = modificationId.toLowerCase().trim();
  
  const t0 = Date.now();
  
  // Use query API pattern (same as listLocalFitments which works)
  const fitment = await db.query.vehicleFitments.findFirst({
    where: and(
      eq(vehicleFitments.year, year),
      eq(vehicleFitments.make, normalizedMake),
      eq(vehicleFitments.model, normalizedModel),
      eq(vehicleFitments.modificationId, normalizedModId)
    ),
  });
  
  return {
    fitment: fitment || null,
    lookupMs: Date.now() - t0,
  };
}

// ============================================================================
// YMM Fallback Lookup (for locally imported data with generated IDs)
// ============================================================================

/**
 * Look up any valid fitment for a year/make/model, regardless of modificationId.
 * This handles cases where:
 * - We imported fitment with generated IDs (manual_XXXX)
 * - Runtime requests use different IDs (from Wheel-Size API trims)
 * 
 * Returns the FIRST valid fitment found for the YMM.
 * For trucks/vehicles with shared fitment across trims, this is correct.
 */
async function getProfileByYMMFallback(
  year: number,
  make: string,
  model: string
): Promise<{ fitment: VehicleFitment | null; lookupMs: number; usedModificationId: string | null }> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  const t0 = Date.now();
  
  // Find any fitment for this YMM - prioritize those with good data
  // Use query API pattern (same as listLocalFitments which works)
  const fitments = await db.query.vehicleFitments.findMany({
    where: and(
      eq(vehicleFitments.year, year),
      eq(vehicleFitments.make, normalizedMake),
      eq(vehicleFitments.model, normalizedModel)
    ),
    limit: 10,
  });
  
  if (fitments.length === 0) {
    return {
      fitment: null,
      lookupMs: Date.now() - t0,
      usedModificationId: null,
    };
  }
  
  // Pick the best fitment: prefer ones with complete data
  let best = fitments[0];
  for (const f of fitments) {
    const hasFullData = f.boltPattern && f.centerBoreMm && f.oemWheelSizes;
    const bestHasFullData = best.boltPattern && best.centerBoreMm && best.oemWheelSizes;
    
    if (hasFullData && !bestHasFullData) {
      best = f;
    }
  }
  
  return {
    fitment: best,
    lookupMs: Date.now() - t0,
    usedModificationId: best.modificationId,
  };
}

// ============================================================================
// Main Profile Lookup (with Alias Resolution)
// ============================================================================

/**
 * Get fitment profile for a vehicle modification.
 * 
 * Resolution order:
 * 1. Direct DB lookup by requested modificationId → "directCanonical"
 * 2. Alias lookup (requested → canonical) → "canonicalAlias"  
 * 3. API fetch + import (stores alias if different) → "importedAlias"
 * 4. Failure → "not_found"
 */
export async function getFitmentProfile(
  year: number,
  make: string,
  model: string,
  modificationId: string,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<ProfileLookupResult> {
  const t0 = Date.now();
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  // NOTE: Don't slugify - manual imports use "manual_XXXX" with underscores
  const requestedModId = modificationId.toLowerCase().trim();
  
  let dbLookupMs = 0;
  let aliasLookupMs: number | undefined;
  let ymmFallbackMs: number | undefined;
  let apiCallMs: number | undefined;
  let importMs: number | undefined;
  let canonicalModificationId: string | null = null;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Direct DB lookup by requested modificationId
  // ─────────────────────────────────────────────────────────────────────────
  
  if (!options?.forceRefresh) {
    let directResult: { fitment: any; lookupMs: number } = { fitment: null, lookupMs: 0 };
    try {
      directResult = await getProfileByModificationIdDirect(year, make, model, modificationId);
    } catch (e: any) {
      // If DB is unavailable/migrating, do not fail the whole request; fall back to API fetch.
      console.warn(`[profileService] DB lookup failed; falling back to API fetch: ${e?.message || String(e)}`);
      directResult = { fitment: null, lookupMs: 0 };
    }
    dbLookupMs = directResult.lookupMs;

    if (directResult.fitment) {
      const overrideResult = await applyOverridesWithMeta(directResult.fitment);
      const { quality } = assessFitmentQuality(overrideResult.fitment);
      
      if (quality === "valid" || quality === "partial" || overrideResult.forceQuality) {
        console.log(`[profileService] RESOLVED (directCanonical): ${year} ${make} ${model} mod=${modificationId} (${dbLookupMs}ms)`);
        
        return {
          profile: dbRecordToProfile(overrideResult.fitment, "db"),
          resolutionPath: "directCanonical",
          requestedModificationId: requestedModId,
          canonicalModificationId: requestedModId,
          aliasUsed: false,
          source: "db",
          apiCalled: false,
          overridesApplied: overrideResult.changed,
          timing: { dbLookupMs, totalMs: Date.now() - t0 },
        };
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Alias lookup (requested → canonical)
    // ─────────────────────────────────────────────────────────────────────────
    
    const aliasStart = Date.now();
    let aliasResult: any = null;
    try {
      aliasResult = await resolveAlias(year, make, model, modificationId);
    } catch (e: any) {
      console.warn(`[profileService] Alias lookup failed; continuing without alias: ${e?.message || String(e)}`);
      aliasResult = null;
    }
    aliasLookupMs = Date.now() - aliasStart;
    
    if (aliasResult) {
      canonicalModificationId = aliasResult.canonicalModificationId;
      
      // Look up by canonical ID
      const canonicalResult = await getProfileByModificationIdDirect(
        year, make, model, aliasResult.canonicalModificationId
      );
      
      if (canonicalResult.fitment) {
        const overrideResult = await applyOverridesWithMeta(canonicalResult.fitment);
        const { quality } = assessFitmentQuality(overrideResult.fitment);
        
        if (quality === "valid" || quality === "partial" || overrideResult.forceQuality) {
          console.log(`[profileService] RESOLVED (canonicalAlias): ${year} ${make} ${model} mod=${modificationId} → ${canonicalModificationId} (${dbLookupMs + aliasLookupMs}ms)`);
          
          return {
            profile: dbRecordToProfile(overrideResult.fitment, "db"),
            resolutionPath: "canonicalAlias",
            requestedModificationId: requestedModId,
            canonicalModificationId: aliasResult.canonicalModificationId,
            aliasUsed: true,
            source: "db",
            apiCalled: false,
            overridesApplied: overrideResult.changed,
            timing: { dbLookupMs, aliasLookupMs, totalMs: Date.now() - t0 },
          };
        }
      }
    }
    
    console.log(`[profileService] DB MISS: ${year} ${make} ${model} mod=${modificationId} (db: ${dbLookupMs}ms, alias: ${aliasLookupMs}ms)`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // Step 2.5: YMM Fallback Lookup (for locally imported data with generated IDs)
    // This handles cases where we imported fitment with manual_XXXX IDs
    // but runtime requests use different modificationIds from Wheel-Size API
    // ─────────────────────────────────────────────────────────────────────────
    
    try {
      const ymmResult = await getProfileByYMMFallback(year, make, model);
      ymmFallbackMs = ymmResult.lookupMs;
      
      if (ymmResult.fitment) {
        const overrideResult = await applyOverridesWithMeta(ymmResult.fitment);
        const { quality } = assessFitmentQuality(overrideResult.fitment);
        
        if (quality === "valid" || quality === "partial" || overrideResult.forceQuality) {
          console.log(`[profileService] RESOLVED (ymmFallback): ${year} ${make} ${model} mod=${modificationId} → used ${ymmResult.usedModificationId} (${ymmFallbackMs}ms)`);
          
          // Store alias so future lookups are faster
          if (ymmResult.usedModificationId && ymmResult.usedModificationId !== requestedModId) {
            await storeAlias(
              year,
              make,
              model,
              requestedModId,
              ymmResult.usedModificationId,
              overrideResult.fitment.displayTrim || "Base",
              ymmResult.fitment.id
            );
          }
          
          return {
            profile: dbRecordToProfile(overrideResult.fitment, "db"),
            resolutionPath: "canonicalAlias", // Treat as alias since we're mapping IDs
            requestedModificationId: requestedModId,
            canonicalModificationId: ymmResult.usedModificationId,
            aliasUsed: true,
            source: "db",
            apiCalled: false,
            overridesApplied: overrideResult.changed,
            timing: { dbLookupMs, aliasLookupMs, ymmFallbackMs, totalMs: Date.now() - t0 },
          };
        }
      }
    } catch (e: any) {
      console.warn(`[profileService] YMM fallback lookup failed: ${e?.message || String(e)}`);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // DB-FIRST: No external API fallback. Return not_found.
  // ─────────────────────────────────────────────────────────────────────────
  
  console.log(`[profileService] NOT FOUND (DB-first, no API fallback): ${year} ${make} ${model} mod=${modificationId}`);
  return {
    profile: null,
    resolutionPath: "not_found",
    requestedModificationId: requestedModId,
    canonicalModificationId: null,
    aliasUsed: false,
    source: "not_found",
    apiCalled: false,
    overridesApplied: false,
    timing: { dbLookupMs, aliasLookupMs, ymmFallbackMs, totalMs: Date.now() - t0 },
  };
}

// ============================================================================
// REMOVED: fetchModificationFromApi, importApiDataToDb, and related API helpers
// All Wheel-Size API integration code has been removed.
// ============================================================================

// ============================================================================
// The following code block was API fallback - now deleted:
// ============================================================================
/*
REMOVED CODE - Steps 3-5 (API fetch, import, read back) are no longer used.
All fitment data must be imported via admin tools.
*/

// Dummy placeholder to prevent syntax errors from remaining code below
const _removedApiCode = null; // This line helps with any trailing references

// ============================================================================
// Helper Functions (DB-only, kept for compatibility)
// ============================================================================

// NOTE: The following functions may have been used by API import path.
// Keeping stubs or removing entirely in Phase B cleanup.

async function _unusedImportPlaceholder(
  _year: number,
  _make: string,
  _model: string,
  _modification: unknown,
  _vehicleData: unknown
): Promise<{ fitmentId: number; displayTrim: string }> {
  throw new Error("Wheel-Size API import is forbidden in DB-first runtime");
}

// Keep getProfileByModificationIdDirect (it's DB-only)
// Keep resolveAlias (it's DB-only)
// Keep storeAlias (it's DB-only)
// Keep getProfileByYMMFallback (it's DB-only)
// Keep dbRecordToProfile (it's DB-only)
// Keep assessFitmentQuality (it's DB-only)

/*
  // REMOVED: Old API path continuation that imported from Wheel-Size
  // The following was inside a try block that called API:
  
      const importedResult = await getProfileByModificationIdDirect(year, make, model, actualCanonicalId);

      if (!importedResult.fitment) {
        console.error(
          `[profileService] IMPORT SUCCEEDED BUT LOOKUP FAILED`
        );
        return {
          profile: null,
          resolutionPath: "not_found",
          requestedModificationId: requestedModId,
          canonicalModificationId: actualCanonicalId,
          aliasUsed: isAlias,
          source: "not_found",
          apiCalled: true,
          overridesApplied: false,
          timing: { dbLookupMs, aliasLookupMs, apiCallMs, importMs, totalMs: Date.now() - t0 },
        };
      }

      const overrideResult = await applyOverridesWithMeta(importedResult.fitment);

      console.log(
        `[profileService] RESOLVED (importedAlias): ${year} ${make} ${model} mod=${requestedModId} → ${actualCanonicalId}`
      );

      return {
        profile: dbRecordToProfile(overrideResult.fitment, "api"),
        resolutionPath: "importedAlias",
        requestedModificationId: requestedModId,
        canonicalModificationId: actualCanonicalId,
        aliasUsed: isAlias,
        source: "api",
        apiCalled: true,
        overridesApplied: overrideResult.changed,
        timing: { dbLookupMs, aliasLookupMs, apiCallMs, importMs, totalMs: Date.now() - t0 },
      };
    } catch (e: any) {
      // DB import failed (e.g. migrations not present / DB temporarily unavailable).
      // Still return an API-derived profile so downstream flows (required accessories) work.
      importMs = Date.now() - importStart;
      console.warn(`[profileService] IMPORT FAILED; returning API-only profile: ${e?.message || String(e)}`);

      const tech = (apiData as any)?.vehicleData?.technical || {};
      const threadSize = tech?.wheel_fasteners?.thread_size || null;
      const centerBoreMm = tech?.centre_bore ? Number(tech.centre_bore) : null;
      const boltPattern = tech?.bolt_pattern || null;

      return {
        profile: {
          modificationId: actualCanonicalId,
          year,
          make: normalizedMake,
          model: normalizedModel,
          displayTrim: String((apiData as any)?.modification?.name || (apiData as any)?.modification?.trim || "Base"),
          rawTrim: String((apiData as any)?.modification?.trim || (apiData as any)?.modification?.name || "") || null,
          boltPattern,
          centerBoreMm,
          threadSize,
          seatType: null,
          offsetMinMm: null,
          offsetMaxMm: null,
          oemWheelSizes: [],
          oemTireSizes: [],
          source: "api",
          apiCalled: true,
          overridesApplied: false,
        },
        resolutionPath: "importedAlias",
        requestedModificationId: requestedModId,
        canonicalModificationId: actualCanonicalId,
        aliasUsed: isAlias,
        source: "api",
        apiCalled: true,
        overridesApplied: false,
        timing: { dbLookupMs, aliasLookupMs, apiCallMs, importMs, totalMs: Date.now() - t0 },
      };
    }
    
  } catch (err: any) {
    console.error(`[profileService] API ERROR:`, err?.message);
    apiCallMs = Date.now() - apiStart;
    
    return {
      profile: null,
      resolutionPath: "not_found",
      requestedModificationId: requestedModId,
      canonicalModificationId: null,
      aliasUsed: false,
      source: "not_found",
      apiCalled: true,
      overridesApplied: false,
      timing: { dbLookupMs, aliasLookupMs, apiCallMs, totalMs: Date.now() - t0 },
    };
  }
}

// ============================================================================
// Import Helper
// ============================================================================

async function importApiDataToDb(
  year: number,
  make: string,
  model: string,
  modification: WheelSizeModification,
  vehicleData: WheelSizeVehicleData
): Promise<{ fitmentId: string; displayTrim: string }> {
  const sourceId = modification.slug;
  const modificationId = slugify(modification.slug);
  const checksum = makePayloadChecksum({ modification, vehicleData });
  
  // Upsert source record
  const existingSource = await db.query.fitmentSourceRecords.findFirst({
    where: and(
      eq(fitmentSourceRecords.source, "wheelsize"),
      eq(fitmentSourceRecords.sourceId, sourceId)
    ),
  });
  
  let sourceRecordId: string;
  
  if (existingSource) {
    await db.update(fitmentSourceRecords)
      .set({
        rawPayload: { modification, vehicleData } as any,
        checksum,
        fetchedAt: new Date(),
      })
      .where(eq(fitmentSourceRecords.id, existingSource.id));
    sourceRecordId = existingSource.id;
  } else {
    const [inserted] = await db.insert(fitmentSourceRecords)
      .values({
        source: "wheelsize",
        sourceId,
        year,
        make,
        model,
        rawPayload: { modification, vehicleData } as any,
        checksum,
      })
      .returning({ id: fitmentSourceRecords.id });
    sourceRecordId = inserted.id;
  }
  
  // Build normalized fitment data
  const trimStr = safeString(modification.trim);
  const engineStr = safeString(modification.engine);
  const nameStr = safeString(modification.name);
  
  // Use trim_levels if available (these are the actual trim names like XL, XLT, Lariat)
  // Otherwise fall back to the engine-based trim designation
  const trimLevels = modification.trim_levels?.filter(t => t && t.trim()) || [];
  let displayTrim: string;
  
  if (trimLevels.length > 0) {
    // Use first trim level, or join multiple (e.g., "XL / XLT / Lariat")
    // For display, we'll use the first one as primary but store all in raw
    displayTrim = trimLevels[0];
    console.log(`[importApiDataToDb] Using trim_levels: ${trimLevels.join(", ")} → displayTrim="${displayTrim}"`);
  } else {
    // Fall back to normalized label from engine/name
    displayTrim = normalizeTrimLabel(trimStr, engineStr, nameStr, String(year), make, model) || "Base";
  }
  
  // Extract specs from API
  const tech = vehicleData.technical || {};
  let boltPattern = tech.bolt_pattern || null;
  let centerBoreMm = tech.centre_bore ? parseFloat(tech.centre_bore) : null;
  let threadSize = tech.wheel_fasteners?.thread_size || null;
  let seatType = tech.wheel_fasteners?.type || null;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // APPLY FITMENT RULES - Override API data with known-correct values
  // This is critical for vehicles like RAM 1500 vs RAM 1500 Classic where
  // the bolt pattern differs by model variant, not just year.
  // ═══════════════════════════════════════════════════════════════════════════
  const ruleOverride = getFitmentFromRules({
    year,
    make,
    model,
    rawModel: model,
    trim: displayTrim,
    modificationId,
  });
  
  if (ruleOverride) {
    console.log(`[importApiDataToDb] RULE OVERRIDE for ${year} ${make} ${model}:`, {
      apiBoltPattern: boltPattern,
      ruleBoltPattern: ruleOverride.boltPattern,
      notes: ruleOverride.notes,
    });
    
    // Apply rule overrides (only if rule provides the value)
    if (ruleOverride.boltPattern) boltPattern = ruleOverride.boltPattern;
    if (ruleOverride.centerBoreMm !== undefined) centerBoreMm = ruleOverride.centerBoreMm;
    if (ruleOverride.threadSize) threadSize = ruleOverride.threadSize;
    if (ruleOverride.seatType) seatType = ruleOverride.seatType;
  }
  
  // Extract wheel/tire sizes
  const wheelSetups = vehicleData.wheels || [];
  const oemWheelSizes: WheelSize[] = [];
  const oemTireSizes: string[] = [];
  const seenTires = new Set<string>();
  
  let offsetMin: number | null = null;
  let offsetMax: number | null = null;
  
  for (const setup of wheelSetups) {
    if (setup.front) {
      const ws: WheelSize = {
        diameter: setup.front.rim_diameter,
        width: setup.front.rim_width,
        offset: setup.front.rim_offset ?? null,
        tireSize: setup.front.tire || null,
        axle: setup.rear ? "front" : "both",
        isStock: setup.is_stock ?? true,
      };
      oemWheelSizes.push(ws);
      
      if (ws.offset !== null) {
        if (offsetMin === null || ws.offset < offsetMin) offsetMin = ws.offset;
        if (offsetMax === null || ws.offset > offsetMax) offsetMax = ws.offset;
      }
      
      if (setup.front.tire && !seenTires.has(setup.front.tire)) {
        seenTires.add(setup.front.tire);
        oemTireSizes.push(setup.front.tire);
      }
    }
    
    if (setup.rear && (setup.rear.rim_diameter || setup.rear.tire)) {
      const ws: WheelSize = {
        diameter: setup.rear.rim_diameter ?? setup.front?.rim_diameter ?? 0,
        width: setup.rear.rim_width ?? setup.front?.rim_width ?? 0,
        offset: setup.rear.rim_offset ?? null,
        tireSize: setup.rear.tire || null,
        axle: "rear",
        isStock: setup.is_stock ?? true,
      };
      oemWheelSizes.push(ws);
      
      if (ws.offset !== null) {
        if (offsetMin === null || ws.offset < offsetMin) offsetMin = ws.offset;
        if (offsetMax === null || ws.offset > offsetMax) offsetMax = ws.offset;
      }
      
      if (setup.rear.tire && !seenTires.has(setup.rear.tire)) {
        seenTires.add(setup.rear.tire);
        oemTireSizes.push(setup.rear.tire);
      }
    }
  }
  
  // Apply offset range from fitment rules if available
  if (ruleOverride) {
    if (ruleOverride.offsetMin !== undefined) {
      offsetMin = ruleOverride.offsetMin;
    }
    if (ruleOverride.offsetMax !== undefined) {
      offsetMax = ruleOverride.offsetMax;
    }
  }
  
  // Upsert fitment record
  const existingFitment = await db.query.vehicleFitments.findFirst({
    where: and(
      eq(vehicleFitments.year, year),
      eq(vehicleFitments.make, make),
      eq(vehicleFitments.model, model),
      eq(vehicleFitments.modificationId, modificationId)
    ),
  });
  
  let fitmentId: string;
  
  // Store trim_levels in rawTrim if available, otherwise use engine designation
  const rawTrimValue = trimLevels.length > 0 
    ? trimLevels.join("; ")  // Store all trim levels: "XL; XLT; Lariat"
    : (trimStr || engineStr || nameStr || null);
  
  if (existingFitment) {
    await db.update(vehicleFitments)
      .set({
        rawTrim: rawTrimValue,
        displayTrim,
        boltPattern,
        centerBoreMm: centerBoreMm ? String(centerBoreMm) : null,
        threadSize,
        seatType,
        offsetMinMm: offsetMin !== null ? String(offsetMin) : null,
        offsetMaxMm: offsetMax !== null ? String(offsetMax) : null,
        oemWheelSizes: oemWheelSizes as any,
        oemTireSizes: oemTireSizes as any,
        sourceRecordId,
        updatedAt: new Date(),
      })
      .where(eq(vehicleFitments.id, existingFitment.id));
    fitmentId = existingFitment.id;
  } else {
    const [inserted] = await db.insert(vehicleFitments)
      .values({
        year,
        make,
        model,
        modificationId,
        rawTrim: rawTrimValue,
        displayTrim,
        boltPattern,
        centerBoreMm: centerBoreMm ? String(centerBoreMm) : null,
        threadSize,
        seatType,
        offsetMinMm: offsetMin !== null ? String(offsetMin) : null,
        offsetMaxMm: offsetMax !== null ? String(offsetMax) : null,
        oemWheelSizes: oemWheelSizes as any,
        oemTireSizes: oemTireSizes as any,
        source: "wheelsize",
        sourceRecordId,
      })
      .returning({ id: vehicleFitments.id });
    fitmentId = inserted.id;
  }
  
  return { fitmentId, displayTrim };
}
*/

// ============================================================================
// Conversion Helper
// ============================================================================

function dbRecordToProfile(record: VehicleFitment, source: "db" | "api"): FitmentProfile {
  // ═══════════════════════════════════════════════════════════════════════════
  // CRITICAL: Apply fitment rules to override incorrect DB/API data
  // This is the ONLY place where rules are applied at resolution time.
  // Rules handle cases like RAM 1500 Classic vs 5th Gen where bolt pattern differs.
  // ═══════════════════════════════════════════════════════════════════════════
  
  let boltPattern = record.boltPattern;
  let centerBoreMm = record.centerBoreMm ? parseFloat(String(record.centerBoreMm)) : null;
  let threadSize = record.threadSize;
  let seatType = record.seatType;
  let offsetMinMm = record.offsetMinMm ? parseFloat(String(record.offsetMinMm)) : null;
  let offsetMaxMm = record.offsetMaxMm ? parseFloat(String(record.offsetMaxMm)) : null;
  let rulesApplied = false;
  
  // Check if fitment rules should override
  const ruleOverride = getFitmentFromRules({
    year: record.year,
    make: record.make,
    model: record.model,
    rawModel: record.model, // Use model as rawModel
    trim: record.displayTrim,
    modificationId: record.modificationId,
  });
  
  if (ruleOverride) {
    // Log when rules override data
    if (ruleOverride.boltPattern && ruleOverride.boltPattern !== boltPattern) {
      console.log(`[dbRecordToProfile] 🔧 RULE OVERRIDE: ${record.year} ${record.make} ${record.model} (mod=${record.modificationId})`);
      console.log(`  Bolt pattern: ${boltPattern} → ${ruleOverride.boltPattern}`);
      console.log(`  Reason: ${ruleOverride.notes || "Fitment rule match"}`);
    }
    
    // Apply overrides
    if (ruleOverride.boltPattern) {
      boltPattern = ruleOverride.boltPattern;
      rulesApplied = true;
    }
    if (ruleOverride.centerBoreMm !== undefined) {
      centerBoreMm = ruleOverride.centerBoreMm;
      rulesApplied = true;
    }
    if (ruleOverride.threadSize) {
      threadSize = ruleOverride.threadSize;
      rulesApplied = true;
    }
    if (ruleOverride.seatType) {
      seatType = ruleOverride.seatType;
      rulesApplied = true;
    }
    if (ruleOverride.offsetMin !== undefined) {
      offsetMinMm = ruleOverride.offsetMin;
      rulesApplied = true;
    }
    if (ruleOverride.offsetMax !== undefined) {
      offsetMaxMm = ruleOverride.offsetMax;
      rulesApplied = true;
    }
  }
  
  return {
    modificationId: record.modificationId,
    year: record.year,
    make: record.make,
    model: record.model,
    displayTrim: record.displayTrim,
    rawTrim: record.rawTrim,
    boltPattern,
    centerBoreMm,
    threadSize,
    seatType,
    offsetMinMm,
    offsetMaxMm,
    oemWheelSizes: (record.oemWheelSizes as WheelSize[]) || [],
    oemTireSizes: (record.oemTireSizes as string[]) || [],
    source,
    apiCalled: source === "api",
    overridesApplied: rulesApplied,
  };
}
