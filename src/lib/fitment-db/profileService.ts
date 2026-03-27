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
import { isWheelSizeEnabled } from "@/lib/wheelSizeApi";
import crypto from "crypto";
import submodelSupplements from "@/data/submodel-supplements.json";

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
    apiCallMs?: number;
    importMs?: number;
    totalMs: number;
  };
  // Legacy compatibility
  source: "db" | "api" | "not_found";
}

// ============================================================================
// Wheel-Size API Helpers
// ============================================================================

const WHEELSIZE_API_BASE = "https://api.wheel-size.com/v2/";

function getApiKey(): string | null {
  // KILL SWITCH - Block ALL Wheel-Size API calls when disabled
  if (!isWheelSizeEnabled()) {
    console.warn("[profileService] Wheel-Size API DISABLED - returning null API key");
    return null;
  }
  return process.env.WHEELSIZE_API_KEY || null;
}

interface WheelSizeModification {
  slug: string;
  name?: string;
  trim?: string | { name?: string };
  trim_levels?: string[];  // Actual trim names (XL, XLT, Lariat, etc.)
  engine?: string | { capacity?: string; type?: string };
  body?: string;
  regions?: string[];
}

interface WheelSizeWheelSetup {
  is_stock: boolean;
  front: {
    tire: string;
    rim_diameter: number;
    rim_width: number;
    rim_offset: number;
  };
  rear?: {
    tire: string;
    rim_diameter?: number;
    rim_width?: number;
    rim_offset?: number;
  };
}

interface WheelSizeVehicleData {
  wheels?: WheelSizeWheelSetup[];
  technical?: {
    bolt_pattern?: string;
    centre_bore?: string;
    wheel_fasteners?: {
      thread_size?: string;
      type?: string;
    };
  };
}

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

/**
 * Find a modification that contains the given trim level in its trim_levels array.
 * Returns the best matching modification or undefined.
 */
function findModificationByTrimLevel(
  modifications: WheelSizeModification[],
  trimValue: string
): WheelSizeModification | undefined {
  const normalizedTrim = trimValue.toLowerCase().trim();
  
  // First pass: exact match in trim_levels
  for (const mod of modifications) {
    if (mod.trim_levels && Array.isArray(mod.trim_levels)) {
      const match = mod.trim_levels.find(
        (t: string) => t.toLowerCase().trim() === normalizedTrim
      );
      if (match) {
        console.log(`[profileService] Found modification ${mod.slug} with exact trim_level match: "${match}"`);
        return mod;
      }
    }
  }
  
  // Second pass: partial match (trim contains or is contained by)
  for (const mod of modifications) {
    if (mod.trim_levels && Array.isArray(mod.trim_levels)) {
      const match = mod.trim_levels.find((t: string) => {
        const normalized = t.toLowerCase().trim();
        return normalized.includes(normalizedTrim) || normalizedTrim.includes(normalized);
      });
      if (match) {
        console.log(`[profileService] Found modification ${mod.slug} with partial trim_level match: "${match}" ~ "${trimValue}"`);
        return mod;
      }
    }
  }
  
  // Third pass: check if trim name appears in modification name/trim field
  for (const mod of modifications) {
    const modName = safeString(mod.name).toLowerCase();
    const modTrim = safeString(mod.trim).toLowerCase();
    if (modName.includes(normalizedTrim) || modTrim.includes(normalizedTrim)) {
      console.log(`[profileService] Found modification ${mod.slug} with name/trim match`);
      return mod;
    }
  }
  
  return undefined;
}

async function fetchModificationFromApi(
  apiKey: string,
  year: number,
  make: string,
  model: string,
  requestedModificationId: string
): Promise<{ modification: WheelSizeModification; vehicleData: WheelSizeVehicleData } | null> {
  const makeSlug = normalizeMake(make);
  const modelSlug = normalizeModelForApi(model);
  
  const modsUrl = new URL("modifications/", WHEELSIZE_API_BASE);
  modsUrl.searchParams.set("user_key", apiKey);
  modsUrl.searchParams.set("make", makeSlug);
  modsUrl.searchParams.set("model", modelSlug);
  modsUrl.searchParams.set("year", String(year));
  
  const modsRes = await fetch(modsUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  
  if (!modsRes.ok) {
    console.log(`[profileService] API modifications call failed: ${modsRes.status}`);
    return null;
  }
  
  const modsData = await modsRes.json();
  const allMods: WheelSizeModification[] = modsData?.data || [];
  
  if (allMods.length === 0) {
    console.log(`[profileService] API returned 0 modifications for ${year} ${makeSlug} ${modelSlug}`);
    return null;
  }
  
  // Prefer USDM
  const usMods = allMods.filter(m => m.regions?.includes("usdm"));
  const mods = usMods.length > 0 ? usMods : allMods;
  
  // Try to find exact match by slug
  let mod = allMods.find(m => m.slug === requestedModificationId);
  
  // Try slugified match
  if (!mod) {
    mod = allMods.find(m => slugify(m.slug) === slugify(requestedModificationId));
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FIX: Handle supplement IDs (s_XXXXXXXX) by resolving to original trim value
  // and finding a modification that contains that trim in trim_levels[]
  // ═══════════════════════════════════════════════════════════════════════════
  if (!mod && isSupplementId(requestedModificationId)) {
    const trimValue = resolveSupplementTrimValue(requestedModificationId, year, make, model);
    
    if (trimValue) {
      // Search for a modification containing this trim level
      mod = findModificationByTrimLevel(mods, trimValue);
      
      if (mod) {
        console.log(`[profileService] SUPPLEMENT RESOLVED: ${requestedModificationId} → trim "${trimValue}" → mod ${mod.slug}`);
      } else {
        console.log(`[profileService] SUPPLEMENT PARTIAL: Found trim "${trimValue}" but no modification contains it in trim_levels`);
        // Fall back to first USDM mod only for supplement IDs where we found the trim
        // This is acceptable because the trim is a marketing level, not a technical spec
        // All F-150 XLT/Lariat/etc share the same fitment specs for a given engine
        if (mods.length > 0) {
          mod = mods[0];
          console.log(`[profileService] Using first USDM mod ${mod.slug} for supplement trim "${trimValue}"`);
        }
      }
    } else {
      console.warn(`[profileService] SUPPLEMENT UNKNOWN: Could not resolve ${requestedModificationId} - no matching trim in supplements`);
      // DO NOT fall back to first mod for UNKNOWN supplement IDs - return null
      return null;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK: For non-supplement IDs that don't match any slug exactly,
  // fall back to first USDM modification. This is SAFE because:
  // - Non-supplement IDs are typically engine/configuration slugs
  // - All configurations of the same model/year share fitment specs
  // - Only supplement IDs (trim levels) need exact matching
  // ═══════════════════════════════════════════════════════════════════════════
  if (!mod && mods.length > 0) {
    mod = mods[0];
    console.log(`[profileService] FALLBACK: Using first USDM mod ${mod.slug} for unmatched ID "${requestedModificationId}"`);
  }
  
  if (!mod) {
    console.log(`[profileService] No modifications available for ${requestedModificationId}`);
    return null;
  }
  
  // Fetch vehicle data
  const vehicleUrl = new URL("search/by_model/", WHEELSIZE_API_BASE);
  vehicleUrl.searchParams.set("user_key", apiKey);
  vehicleUrl.searchParams.set("make", makeSlug);
  vehicleUrl.searchParams.set("model", modelSlug);
  vehicleUrl.searchParams.set("year", String(year));
  vehicleUrl.searchParams.set("modification", mod.slug);
  
  const vehicleRes = await fetch(vehicleUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  
  if (!vehicleRes.ok) {
    return { modification: mod, vehicleData: {} };
  }
  
  const vehicleRaw = await vehicleRes.json();
  const vehicleData = vehicleRaw?.data?.[0] || {};
  
  return { modification: mod, vehicleData };
}

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
  const normalizedReqId = slugify(requestedModificationId);
  
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
  const normalizedReqId = slugify(requestedModificationId);
  const normalizedCanonId = slugify(canonicalModificationId);
  
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
  const normalizedModId = slugify(modificationId);
  
  const t0 = Date.now();
  
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
  const requestedModId = slugify(modificationId);
  
  let dbLookupMs = 0;
  let aliasLookupMs: number | undefined;
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
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Fetch from Wheel-Size API
  // ─────────────────────────────────────────────────────────────────────────
  
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(`[profileService] NO API KEY - cannot fetch`);
    return {
      profile: null,
      resolutionPath: "not_found",
      requestedModificationId: requestedModId,
      canonicalModificationId: null,
      aliasUsed: false,
      source: "not_found",
      apiCalled: false,
      overridesApplied: false,
      timing: { dbLookupMs, aliasLookupMs, totalMs: Date.now() - t0 },
    };
  }
  
  const apiStart = Date.now();
  
  try {
    console.log(`[profileService] API FETCH: ${year} ${make} ${model} mod=${modificationId}`);
    
    const apiData = await fetchModificationFromApi(apiKey, year, make, model, modificationId);
    apiCallMs = Date.now() - apiStart;
    
    if (!apiData) {
      console.log(`[profileService] API returned no data (${apiCallMs}ms)`);
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
    
    // The actual canonical modificationId from the API
    const actualCanonicalId = slugify(apiData.modification.slug);
    const isAlias = actualCanonicalId !== requestedModId;
    
    if (isAlias) {
      console.log(`[profileService] ALIAS DETECTED: requested=${requestedModId} → canonical=${actualCanonicalId}`);
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Step 4: Import to database
    // ─────────────────────────────────────────────────────────────────────────
    
    const importStart = Date.now();

    try {
      const { fitmentId, displayTrim } = await importApiDataToDb(
        year,
        normalizedMake,
        normalizedModel,
        apiData.modification,
        apiData.vehicleData
      );

      importMs = Date.now() - importStart;
      console.log(`[profileService] IMPORTED: fitmentId=${fitmentId}, canonical=${actualCanonicalId} (${importMs}ms)`);

      // Store alias if different
      if (isAlias) {
        await storeAlias(
          year,
          make,
          model,
          requestedModId,
          actualCanonicalId,
          displayTrim,
          fitmentId
        );
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Step 5: Read back the imported record
      // ─────────────────────────────────────────────────────────────────────────

      const importedResult = await getProfileByModificationIdDirect(year, make, model, actualCanonicalId);

      if (!importedResult.fitment) {
        console.error(
          `[profileService] IMPORT SUCCEEDED BUT LOOKUP FAILED: ${year} ${make} ${model} canonical=${actualCanonicalId}`
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
  
  // Extract specs
  const tech = vehicleData.technical || {};
  const boltPattern = tech.bolt_pattern || null;
  const centerBoreMm = tech.centre_bore ? parseFloat(tech.centre_bore) : null;
  const threadSize = tech.wheel_fasteners?.thread_size || null;
  const seatType = tech.wheel_fasteners?.type || null;
  
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

// ============================================================================
// Conversion Helper
// ============================================================================

function dbRecordToProfile(record: VehicleFitment, source: "db" | "api"): FitmentProfile {
  return {
    modificationId: record.modificationId,
    year: record.year,
    make: record.make,
    model: record.model,
    displayTrim: record.displayTrim,
    rawTrim: record.rawTrim,
    boltPattern: record.boltPattern,
    centerBoreMm: record.centerBoreMm ? parseFloat(String(record.centerBoreMm)) : null,
    threadSize: record.threadSize,
    seatType: record.seatType,
    offsetMinMm: record.offsetMinMm ? parseFloat(String(record.offsetMinMm)) : null,
    offsetMaxMm: record.offsetMaxMm ? parseFloat(String(record.offsetMaxMm)) : null,
    oemWheelSizes: (record.oemWheelSizes as WheelSize[]) || [],
    oemTireSizes: (record.oemTireSizes as string[]) || [],
    source,
    apiCalled: source === "api",
    overridesApplied: false,
  };
}
