/**
 * Fitment Profile Service (DB-First)
 * 
 * Provides complete fitment profiles for wheels/tires pages.
 * Uses vehicle_fitments table with canonical modificationId.
 * 
 * Flow:
 * 1. Check DB for profile by year/make/model/modificationId
 * 2. If found → return (DB HIT)
 * 3. If not found → call Wheel-Size API, import, return (API FETCH + IMPORT)
 */

import { db } from "./db";
import { vehicleFitments, fitmentSourceRecords } from "./schema";
import type { VehicleFitment } from "./schema";
import { eq, and } from "drizzle-orm";
import { normalizeMake, normalizeModel, slugify, makePayloadChecksum } from "./keys";
import { applyOverrides } from "./applyOverrides";
import { normalizeTrimLabel } from "@/lib/trimNormalize";

// ============================================================================
// Types
// ============================================================================

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
  source: "db" | "api" | "not_found";
  apiCalled: boolean;
  overridesApplied: boolean;
  timing: {
    dbLookupMs: number;
    apiCallMs?: number;
    importMs?: number;
    totalMs: number;
  };
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

async function fetchModification(
  apiKey: string,
  year: number,
  make: string,
  model: string,
  modificationId: string
): Promise<{ modification: WheelSizeModification; vehicleData: WheelSizeVehicleData } | null> {
  const makeSlug = make.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const modelSlug = model.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  // First get modifications list to find the matching one
  const modsUrl = new URL("modifications/", WHEELSIZE_API_BASE);
  modsUrl.searchParams.set("user_key", apiKey);
  modsUrl.searchParams.set("make", makeSlug);
  modsUrl.searchParams.set("model", modelSlug);
  modsUrl.searchParams.set("year", String(year));
  
  const modsRes = await fetch(modsUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  
  if (!modsRes.ok) return null;
  
  const modsData = await modsRes.json();
  const allMods: WheelSizeModification[] = modsData?.data || [];
  
  // Prefer USDM
  const usMods = allMods.filter(m => m.regions?.includes("usdm"));
  const mods = usMods.length > 0 ? usMods : allMods;
  
  // Find matching modification
  // modificationId could be: API slug (hex), supplement hash (s_xxx), or slugified trim name
  let mod = mods.find(m => m.slug === modificationId);
  
  // If not found by slug, try to match by slugified name
  if (!mod) {
    mod = mods.find(m => slugify(m.slug) === slugify(modificationId));
  }
  
  // If still not found and there are mods, pick first USDM one
  if (!mod && mods.length > 0) {
    mod = mods[0];
  }
  
  if (!mod) return null;
  
  // Now fetch vehicle data using search/by_model endpoint
  // (NOT vehicles/ - which returns different/incomplete data)
  const vehicleUrl = new URL("search/by_model/", WHEELSIZE_API_BASE);
  vehicleUrl.searchParams.set("user_key", apiKey);
  vehicleUrl.searchParams.set("make", makeSlug);
  vehicleUrl.searchParams.set("model", modelSlug);
  vehicleUrl.searchParams.set("year", String(year));
  vehicleUrl.searchParams.set("modification", mod.slug);
  
  console.log(`[profileService] Fetching: search/by_model/${makeSlug}/${modelSlug}/${year}/${mod.slug}`);
  
  const vehicleRes = await fetch(vehicleUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  
  if (!vehicleRes.ok) {
    console.log(`[profileService] search/by_model failed: ${vehicleRes.status}`);
    // Return modification without vehicle data
    return { modification: mod, vehicleData: {} };
  }
  
  const vehicleRaw = await vehicleRes.json();
  const vehicleData = vehicleRaw?.data?.[0] || {};
  
  console.log(`[profileService] Got vehicleData:`, {
    hastechnical: !!vehicleData.technical,
    boltPattern: vehicleData.technical?.bolt_pattern,
    centreBore: vehicleData.technical?.centre_bore,
    wheelSetups: vehicleData.wheels?.length || 0,
  });
  
  return {
    modification: mod,
    vehicleData,
  };
}

// ============================================================================
// Main Profile Lookup
// ============================================================================

/**
 * Get fitment profile for a vehicle modification
 * DB-first with API fallback
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
  
  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Check database (unless forcing refresh)
  // ─────────────────────────────────────────────────────────────────────────
  
  if (!options?.forceRefresh) {
    const dbStart = Date.now();
    
    const dbFitment = await db.query.vehicleFitments.findFirst({
      where: and(
        eq(vehicleFitments.year, year),
        eq(vehicleFitments.make, normalizedMake),
        eq(vehicleFitments.model, normalizedModel),
        eq(vehicleFitments.modificationId, normalizedModId)
      ),
    });
    
    dbLookupMs = Date.now() - dbStart;
    
    if (dbFitment) {
      console.log(`[profileService] DB HIT: ${year} ${make} ${model} mod=${modificationId} (${dbLookupMs}ms)`);
      
      // Apply overrides
      const withOverrides = await applyOverrides(dbFitment);
      const overridesApplied = withOverrides !== dbFitment;
      
      return {
        profile: dbRecordToProfile(withOverrides, "db"),
        source: "db",
        apiCalled: false,
        overridesApplied,
        timing: { dbLookupMs, totalMs: Date.now() - t0 },
      };
    }
    
    console.log(`[profileService] DB MISS: ${year} ${make} ${model} mod=${modificationId} (${dbLookupMs}ms)`);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Call Wheel-Size API
  // ─────────────────────────────────────────────────────────────────────────
  
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(`[profileService] NO API KEY - cannot fetch`);
    return {
      profile: null,
      source: "not_found",
      apiCalled: false,
      overridesApplied: false,
      timing: { dbLookupMs, totalMs: Date.now() - t0 },
    };
  }
  
  const apiStart = Date.now();
  
  try {
    console.log(`[profileService] API FETCH: ${year} ${make} ${model} mod=${modificationId}`);
    
    const apiData = await fetchModification(apiKey, year, make, model, modificationId);
    apiCallMs = Date.now() - apiStart;
    
    if (!apiData) {
      console.log(`[profileService] API returned no data (${apiCallMs}ms)`);
      return {
        profile: null,
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
    
    const fitmentId = await importApiDataToDb(
      year,
      normalizedMake,
      normalizedModel,
      apiData.modification,
      apiData.vehicleData
    );
    
    importMs = Date.now() - importStart;
    console.log(`[profileService] IMPORTED: fitmentId=${fitmentId} (${importMs}ms)`);
    
    // Fetch the newly imported record
    const newFitment = await db.query.vehicleFitments.findFirst({
      where: eq(vehicleFitments.id, fitmentId),
    });
    
    if (!newFitment) {
      return {
        profile: null,
        source: "not_found",
        apiCalled: true,
        overridesApplied: false,
        timing: { dbLookupMs, apiCallMs, importMs, totalMs: Date.now() - t0 },
      };
    }
    
    // Apply overrides
    const withOverrides = await applyOverrides(newFitment);
    
    return {
      profile: dbRecordToProfile(withOverrides, "api"),
      source: "api",
      apiCalled: true,
      overridesApplied: withOverrides !== newFitment,
      timing: { dbLookupMs, apiCallMs, importMs, totalMs: Date.now() - t0 },
    };
    
  } catch (err: any) {
    console.error(`[profileService] API ERROR:`, err?.message);
    apiCallMs = Date.now() - apiStart;
    
    return {
      profile: null,
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
    // Front
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
    
    // Rear (if different)
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
    // Parse decimal strings back to numbers
    offsetMinMm: record.offsetMinMm ? parseFloat(String(record.offsetMinMm)) : null,
    offsetMaxMm: record.offsetMaxMm ? parseFloat(String(record.offsetMaxMm)) : null,
    oemWheelSizes: (record.oemWheelSizes as WheelSize[]) || [],
    oemTireSizes: (record.oemTireSizes as string[]) || [],
    source,
    apiCalled: source === "api",
    overridesApplied: false,
  };
}
