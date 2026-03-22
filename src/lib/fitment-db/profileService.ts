/**
 * Fitment Profile Service (ModificationId-First)
 * 
 * Provides complete fitment profiles for wheels/tires pages.
 * Uses vehicle_fitments table with canonical modificationId as PRIMARY key.
 * 
 * Resolution Flow:
 * 1. Direct DB lookup by modificationId
 * 2. If not found → call Wheel-Size API to fetch and import
 * 3. Retry DB lookup after import (with short delay)
 * 4. Return profile with resolution path metadata
 * 
 * Resolution Paths:
 * - "modificationIdDb" - Found directly in vehicle_fitments by modificationId
 * - "modificationIdApi" - Fetched from API, imported, then read from DB
 * - "not_found" - Could not resolve (API didn't have data or import failed)
 */

import { db } from "./db";
import { vehicleFitments, fitmentSourceRecords } from "./schema";
import type { VehicleFitment } from "./schema";
import { eq, and, or } from "drizzle-orm";
import { normalizeMake, normalizeModel, normalizeModelForApi, slugify, makePayloadChecksum } from "./keys";
import { applyOverridesWithMeta } from "./applyOverrides";
import { normalizeTrimLabel } from "@/lib/trimNormalize";

// ============================================================================
// Types
// ============================================================================

export type ProfileResolutionPath = 
  | "modificationIdDb"    // Found directly in DB by modificationId
  | "modificationIdApi"   // Fetched from API, imported, returned
  | "not_found";          // Could not resolve

export interface FitmentProfile {
  // Identity
  modificationId: string;
  year: number;
  make: string;
  model: string;
  
  // Display
  displayTrim: string;
  rawTrim: string | null;
  
  // Wheel specs
  boltPattern: string | null;
  centerBoreMm: number | null;
  threadSize: string | null;
  seatType: string | null;
  
  // Offset range
  offsetMinMm: number | null;
  offsetMaxMm: number | null;
  
  // OEM sizes
  oemWheelSizes: WheelSize[];
  oemTireSizes: string[];
  
  // Metadata
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
  apiCalled: boolean;
  overridesApplied: boolean;
  timing: {
    dbLookupMs: number;
    apiCallMs?: number;
    importMs?: number;
    retryCount?: number;
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
  return process.env.WHEELSIZE_API_KEY || null;
}

interface WheelSizeModification {
  slug: string;
  name?: string;
  trim?: string | { name?: string };
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

async function fetchModificationFromApi(
  apiKey: string,
  year: number,
  make: string,
  model: string,
  modificationId: string
): Promise<{ modification: WheelSizeModification; vehicleData: WheelSizeVehicleData } | null> {
  // Use normalized slugs for API compatibility (e.g., "RX 350" → "rx")
  const makeSlug = normalizeMake(make);
  const modelSlug = normalizeModelForApi(model);
  
  // First get modifications list to find the matching one
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
  
  // Find matching modification by slug
  // modificationId could be: API slug (hex), supplement hash (s_xxx), or slugified trim name
  let mod = allMods.find(m => m.slug === modificationId);
  
  // If not found by exact slug, try to match by slugified name
  if (!mod) {
    mod = allMods.find(m => slugify(m.slug) === slugify(modificationId));
  }
  
  // If STILL not found, use first USDM mod as fallback (for new imports)
  if (!mod && mods.length > 0) {
    console.log(`[profileService] Mod ${modificationId} not found in ${allMods.length} mods, using first available: ${mods[0].slug}`);
    mod = mods[0];
  }
  
  if (!mod) return null;
  
  // Now fetch vehicle data using search/by_model endpoint
  const vehicleUrl = new URL("search/by_model/", WHEELSIZE_API_BASE);
  vehicleUrl.searchParams.set("user_key", apiKey);
  vehicleUrl.searchParams.set("make", makeSlug);
  vehicleUrl.searchParams.set("model", modelSlug);
  vehicleUrl.searchParams.set("year", String(year));
  vehicleUrl.searchParams.set("modification", mod.slug);
  
  console.log(`[profileService] API: search/by_model/${makeSlug}/${modelSlug}/${year}/${mod.slug}`);
  
  const vehicleRes = await fetch(vehicleUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  
  if (!vehicleRes.ok) {
    console.log(`[profileService] API search/by_model failed: ${vehicleRes.status}`);
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
// Direct DB Lookup (ModificationId-First)
// ============================================================================

/**
 * Direct DB lookup by modificationId with retry support.
 * This is the PRIMARY lookup method - no API fallback.
 */
export async function getProfileByModificationIdDirect(
  year: number,
  make: string,
  model: string,
  modificationId: string,
  options?: {
    retryCount?: number;
    retryDelayMs?: number;
  }
): Promise<{
  fitment: VehicleFitment | null;
  lookupMs: number;
  retryAttempts: number;
}> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  const normalizedModId = slugify(modificationId);
  
  const maxRetries = options?.retryCount ?? 3;
  const retryDelay = options?.retryDelayMs ?? 50;
  
  const t0 = Date.now();
  let attempts = 0;
  let fitment: VehicleFitment | null = null;
  
  while (attempts < maxRetries && !fitment) {
    if (attempts > 0) {
      await new Promise(r => setTimeout(r, retryDelay));
    }
    
    attempts++;
    
    // Primary lookup: exact modificationId match
    fitment = await db.query.vehicleFitments.findFirst({
      where: and(
        eq(vehicleFitments.year, year),
        eq(vehicleFitments.make, normalizedMake),
        eq(vehicleFitments.model, normalizedModel),
        eq(vehicleFitments.modificationId, normalizedModId)
      ),
    });
    
    // Secondary lookup: try original modificationId if different from slugified
    if (!fitment && modificationId !== normalizedModId) {
      fitment = await db.query.vehicleFitments.findFirst({
        where: and(
          eq(vehicleFitments.year, year),
          eq(vehicleFitments.make, normalizedMake),
          eq(vehicleFitments.model, normalizedModel),
          eq(vehicleFitments.modificationId, modificationId)
        ),
      });
    }
  }
  
  return {
    fitment,
    lookupMs: Date.now() - t0,
    retryAttempts: attempts,
  };
}

// ============================================================================
// Main Profile Lookup (ModificationId-First with API Fallback)
// ============================================================================

/**
 * Get fitment profile for a vehicle modification.
 * 
 * Resolution order:
 * 1. Direct DB lookup by modificationId → "modificationIdDb"
 * 2. API fetch + import + DB retry → "modificationIdApi"
 * 3. Failure → "not_found"
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
  const normalizedModId = slugify(modificationId);
  
  let dbLookupMs = 0;
  let apiCallMs: number | undefined;
  let importMs: number | undefined;
  let retryCount: number | undefined;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Direct DB lookup by modificationId
  // ─────────────────────────────────────────────────────────────────────────
  
  if (!options?.forceRefresh) {
    const dbResult = await getProfileByModificationIdDirect(year, make, model, modificationId);
    dbLookupMs = dbResult.lookupMs;
    retryCount = dbResult.retryAttempts;
    
    if (dbResult.fitment) {
      // Apply overrides
      const overrideResult = await applyOverridesWithMeta(dbResult.fitment);
      const { quality, reasons } = assessFitmentQuality(overrideResult.fitment);
      
      // Check if override forces quality
      if (overrideResult.forceQuality) {
        console.log(`[profileService] DB HIT (modificationIdDb, forceQuality=${overrideResult.forceQuality}): ${year} ${make} ${model} mod=${modificationId} (${dbLookupMs}ms)`);
        return {
          profile: dbRecordToProfile(overrideResult.fitment, "db"),
          resolutionPath: "modificationIdDb",
          source: "db",
          apiCalled: false,
          overridesApplied: overrideResult.changed,
          timing: { dbLookupMs, retryCount, totalMs: Date.now() - t0 },
        };
      }
      
      if (quality === "valid" || quality === "partial") {
        console.log(`[profileService] DB HIT (modificationIdDb, ${quality}): ${year} ${make} ${model} mod=${modificationId} (${dbLookupMs}ms)`);
        return {
          profile: dbRecordToProfile(overrideResult.fitment, "db"),
          resolutionPath: "modificationIdDb",
          source: "db",
          apiCalled: false,
          overridesApplied: overrideResult.changed,
          timing: { dbLookupMs, retryCount, totalMs: Date.now() - t0 },
        };
      }
      
      // Invalid profile - need to re-import
      console.warn(`[profileService] INVALID DB PROFILE - triggering re-import: ${year} ${make} ${model} mod=${modificationId} - ${reasons.join(", ")}`);
    } else {
      console.log(`[profileService] DB MISS (modificationIdDb): ${year} ${make} ${model} mod=${modificationId} (${dbLookupMs}ms)`);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Fetch from Wheel-Size API
  // ─────────────────────────────────────────────────────────────────────────
  
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(`[profileService] NO API KEY - cannot fetch`);
    return {
      profile: null,
      resolutionPath: "not_found",
      source: "not_found",
      apiCalled: false,
      overridesApplied: false,
      timing: { dbLookupMs, totalMs: Date.now() - t0 },
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
        source: "not_found",
        apiCalled: true,
        overridesApplied: false,
        timing: { dbLookupMs, apiCallMs, totalMs: Date.now() - t0 },
      };
    }
    
    console.log(`[profileService] API OK: slug=${apiData.modification.slug} (${apiCallMs}ms)`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // Step 3: Import to database
    // ─────────────────────────────────────────────────────────────────────────
    
    const importStart = Date.now();
    
    // Import using the ACTUAL API slug (not the requested modificationId)
    // This ensures we store with the canonical ID
    const fitmentId = await importApiDataToDb(
      year,
      normalizedMake,
      normalizedModel,
      apiData.modification,
      apiData.vehicleData
    );
    
    importMs = Date.now() - importStart;
    console.log(`[profileService] IMPORTED: fitmentId=${fitmentId} (${importMs}ms)`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // Step 4: Retry DB lookup with the imported modificationId
    // ─────────────────────────────────────────────────────────────────────────
    
    // Use the actual API slug for lookup (might be different from requested modificationId)
    const importedModId = slugify(apiData.modification.slug);
    
    const retryResult = await getProfileByModificationIdDirect(
      year, make, model, importedModId,
      { retryCount: 3, retryDelayMs: 50 }
    );
    
    retryCount = retryResult.retryAttempts;
    
    if (!retryResult.fitment) {
      console.error(`[profileService] IMPORT SUCCEEDED BUT LOOKUP FAILED: ${year} ${make} ${model} mod=${importedModId}`);
      return {
        profile: null,
        resolutionPath: "not_found",
        source: "not_found",
        apiCalled: true,
        overridesApplied: false,
        timing: { dbLookupMs, apiCallMs, importMs, retryCount, totalMs: Date.now() - t0 },
      };
    }
    
    // Apply overrides
    const overrideResult = await applyOverridesWithMeta(retryResult.fitment);
    
    console.log(`[profileService] RESOLVED (modificationIdApi): ${year} ${make} ${model} mod=${importedModId}`);
    
    return {
      profile: dbRecordToProfile(overrideResult.fitment, "api"),
      resolutionPath: "modificationIdApi",
      source: "api",
      apiCalled: true,
      overridesApplied: overrideResult.changed,
      timing: { dbLookupMs, apiCallMs, importMs, retryCount, totalMs: Date.now() - t0 },
    };
    
  } catch (err: any) {
    console.error(`[profileService] API ERROR:`, err?.message);
    apiCallMs = Date.now() - apiStart;
    
    return {
      profile: null,
      resolutionPath: "not_found",
      source: "not_found",
      apiCalled: true,
      overridesApplied: false,
      timing: { dbLookupMs, apiCallMs, totalMs: Date.now() - t0 },
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
): Promise<string> {
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
  const displayTrim = normalizeTrimLabel(trimStr, engineStr, nameStr, String(year), make, model) || "Base";
  
  // Extract specs from vehicle data
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
  
  // Upsert fitment record using modificationId as key
  const existingFitment = await db.query.vehicleFitments.findFirst({
    where: and(
      eq(vehicleFitments.year, year),
      eq(vehicleFitments.make, make),
      eq(vehicleFitments.model, model),
      eq(vehicleFitments.modificationId, modificationId)
    ),
  });
  
  if (existingFitment) {
    await db.update(vehicleFitments)
      .set({
        rawTrim: trimStr || engineStr || nameStr || null,
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
    return existingFitment.id;
  }
  
  const [inserted] = await db.insert(vehicleFitments)
    .values({
      year,
      make,
      model,
      modificationId,
      rawTrim: trimStr || engineStr || nameStr || null,
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
  
  return inserted.id;
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
