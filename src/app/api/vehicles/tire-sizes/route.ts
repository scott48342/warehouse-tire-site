/**
 * PATCHED: tire-sizes route with DB-First Fitment Lookup
 * 
 * File: src/app/api/vehicles/tire-sizes/route.ts
 * 
 * CHANGES FROM ORIGINAL:
 * 1. Added getDbFitmentSizes() function
 * 2. DB lookup happens FIRST before cache/API/fallback
 * 3. Returns source: "db-first" when data comes from database
 */

import { NextResponse } from "next/server";
import {
  makeCacheKey,
  getCached,
  setCache,
  isInCooldown,
  record429,
  recordSuccess,
  getCacheStats,
  type CachedFitment,
} from "@/lib/fitmentCache";
import { normalizeModelForApi, normalizeMake, slugify } from "@/lib/fitment-db/keys";
import * as wheelSizeApi from "@/lib/wheelSizeApi";
import oemSizesData from "@/data/oem-tire-sizes.json";
import { 
  convertLegacyTireSize, 
  convertTireSizesForSearch,
  type LegacyTireConversion 
} from "@/lib/legacyTireConverter";

export const runtime = "nodejs";
export const maxDuration = 30;

// ═══════════════════════════════════════════════════════════════════════════
// NEW: DB-FIRST FITMENT LOOKUP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Look up OEM tire sizes from the fitment database.
 * This is the PRIMARY source for imported fitment data (Toyota, GM, Ford, etc.)
 * Returns null if no data found (allows fallback to other sources).
 */
async function getDbFitmentSizes(
  year: string, 
  make: string, 
  model: string, 
  modification?: string
): Promise<{
  tireSizes: string[];
  boltPattern?: string;
  centerBore?: number;
  source: string;
} | null> {
  try {
    // Dynamic import to avoid breaking if fitment-db isn't ready
    const { listLocalFitments } = await import("@/lib/fitment-db/getFitment");
    
    const fitments = await listLocalFitments(
      parseInt(year, 10),
      make,
      model
    );
    
    if (!fitments || fitments.length === 0) {
      return null;
    }
    
    // Find matching modification or use first
    let selectedFitment = fitments[0];
    if (modification) {
      const match = fitments.find(f => 
        f.modificationId === modification ||
        f.displayTrim?.toLowerCase().includes(modification.toLowerCase())
      );
      if (match) selectedFitment = match;
    }
    
    // Extract tire sizes from oem_tire_sizes JSON field
    const oemTireSizes = selectedFitment.oemTireSizes as string[] | null;
    if (!oemTireSizes || oemTireSizes.length === 0) {
      // Also check oemWheelSizes for tire info
      const oemWheelSizes = selectedFitment.oemWheelSizes as Array<{ tires?: string[] }> | null;
      if (oemWheelSizes) {
        const extractedSizes = new Set<string>();
        for (const ws of oemWheelSizes) {
          if (ws.tires) {
            ws.tires.forEach(t => extractedSizes.add(t));
          }
        }
        if (extractedSizes.size > 0) {
          return {
            tireSizes: Array.from(extractedSizes),
            boltPattern: selectedFitment.boltPattern ?? undefined,
            centerBore: selectedFitment.centerBoreMm ? Number(selectedFitment.centerBoreMm) : undefined,
            source: "db-first",
          };
        }
      }
      return null;
    }
    
    return {
      tireSizes: oemTireSizes,
      boltPattern: selectedFitment.boltPattern ?? undefined,
      centerBore: selectedFitment.centerBoreMm ? Number(selectedFitment.centerBoreMm) : undefined,
      source: "db-first",
    };
    
  } catch (err) {
    console.warn("[tire-sizes] DB lookup failed:", err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ORIGINAL FUNCTIONS (unchanged)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Look up static OEM tire sizes from local data file.
 * Used as fallback when Wheel-Size API is unavailable.
 */
function getStaticOemSizes(year: string, make: string, model: string, modification?: string): string[] {
  const vehicles = (oemSizesData as any).vehicles;
  
  // Normalize inputs
  const makeKey = make.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const modelKey = model.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const trimKey = modification?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "";
  
  // Look up make
  const makeData = vehicles[makeKey];
  if (!makeData) return [];
  
  // Look up model
  const modelData = makeData[modelKey];
  if (!modelData) return [];
  
  // Look up year
  const yearData = modelData[year];
  if (!yearData) {
    // Try adjacent years as fallback
    const nearYear = modelData[String(Number(year) - 1)] || modelData[String(Number(year) + 1)];
    if (!nearYear) return [];
    return nearYear.default || [];
  }
  
  // Look up trim, fall back to default
  if (trimKey && yearData[trimKey]) {
    return yearData[trimKey];
  }
  
  // Try partial match on trim
  for (const key of Object.keys(yearData)) {
    if (key !== "default" && trimKey.includes(key)) {
      return yearData[key];
    }
  }
  
  return yearData.default || [];
}

const BASE_URL = "https://api.wheel-size.com/v2/";

function getApiKey(): string {
  const key = process.env.WHEELSIZE_API_KEY;
  if (!key) throw new Error("Missing WHEELSIZE_API_KEY");
  return key;
}

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (!wheelSizeApi.isWheelSizeEnabled()) {
    console.warn("[tire-sizes] Wheel-Size API DISABLED - blocking direct call");
    throw new Error("Wheel-Size API is temporarily disabled");
  }

  const url = new URL(path, BASE_URL);
  url.searchParams.set("user_key", getApiKey());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 429) {
      record429();
      throw new Error(`Wheel-Size API rate limited (429)`);
    }
    throw new Error(`Wheel-Size API error: ${res.status}`);
  }

  recordSuccess();
  return res.json();
}

type WheelSetup = {
  is_stock: boolean;
  front: { tire: string; tire_full?: string; rim_diameter: number };
  rear?: { tire: string; tire_full?: string; rim_diameter?: number };
};

type VehicleData = {
  wheels?: WheelSetup[];
  technical?: { bolt_pattern?: string; centre_bore?: string };
};

type Modification = {
  slug: string;
  name: string;
  trim?: string;
  regions?: string[];
};

/**
 * GET /api/vehicles/tire-sizes?year=2024&make=Ford&model=F-150&modification=s_abc123
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  
  const modificationParam = url.searchParams.get("modification") || "";
  const trimParam = url.searchParams.get("trim") || "";
  const modificationRaw = modificationParam || trimParam;
  
  if (!modificationParam && trimParam) {
    console.warn(`[tire-sizes] DEPRECATION: Using 'trim' param. Migrate to 'modification=${trimParam}'`);
  }
  
  const forceRefresh = url.searchParams.get("refresh") === "1";
  
  const modification = modificationRaw.includes("__") 
    ? modificationRaw.split("__")[0] 
    : modificationRaw;

  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: DB-FIRST - Check imported fitment database BEFORE anything else
  // ═══════════════════════════════════════════════════════════════════════════
  if (!forceRefresh) {
    const dbFitment = await getDbFitmentSizes(year, make, model, modification);
    if (dbFitment && dbFitment.tireSizes.length > 0) {
      console.log(`[tire-sizes] DB-FIRST HIT: ${year} ${make} ${model} → ${dbFitment.tireSizes.join(", ")}`);
      
      // Convert legacy sizes if any
      const { searchSizes } = convertTireSizesForSearch(dbFitment.tireSizes);
      const dbConversions = dbFitment.tireSizes.map(size => {
        const conv = convertLegacyTireSize(size);
        return {
          originalSize: conv.original,
          recommendedSize: conv.recommended,
          alternatives: conv.alternatives,
          conversionMethod: conv.conversionMethod,
          isLegacy: conv.isLegacy,
        };
      });
      
      return NextResponse.json({
        tireSizes: dbFitment.tireSizes,
        tireSizesStrict: dbFitment.tireSizes,
        tireSizesAgg: [],
        searchableSizes: searchSizes.length > 0 ? searchSizes : dbFitment.tireSizes,
        sizeConversions: dbConversions,
        hasLegacySizes: dbConversions.some(c => c.isLegacy),
        fitment: {
          boltPattern: dbFitment.boltPattern,
          centerBore: dbFitment.centerBore,
        },
        source: dbFitment.source, // "db-first"
        cacheStats: getCacheStats(),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Check in-memory cache
  // ═══════════════════════════════════════════════════════════════════════════
  const cacheKey = makeCacheKey(year, make, model, modification);
  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) {
      const cachedSizes = cached.tireSizes || [];
      const { searchSizes } = convertTireSizesForSearch(cachedSizes);
      const cachedConversions = cachedSizes.map(size => {
        const conv = convertLegacyTireSize(size);
        return {
          originalSize: conv.original,
          recommendedSize: conv.recommended,
          alternatives: conv.alternatives,
          conversionMethod: conv.conversionMethod,
          isLegacy: conv.isLegacy,
        };
      });
      
      return NextResponse.json({
        tireSizes: cachedSizes,
        tireSizesStrict: cachedSizes,
        tireSizesAgg: [],
        searchableSizes: searchSizes.length > 0 ? searchSizes : cachedSizes,
        sizeConversions: cachedConversions,
        hasLegacySizes: cachedConversions.some(c => c.isLegacy),
        fitment: {
          boltPattern: cached.boltPattern,
          centerBore: cached.centerBore,
        },
        source: "cache",
        cacheStats: getCacheStats(),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: API unavailable? Use static fallback
  // ═══════════════════════════════════════════════════════════════════════════
  const apiUnavailable = isInCooldown() || !wheelSizeApi.isWheelSizeEnabled();
  
  if (apiUnavailable) {
    const staticSizes = getStaticOemSizes(year, make, model, modification);
    const reason = !wheelSizeApi.isWheelSizeEnabled() 
      ? "Wheel-Size API is temporarily disabled" 
      : "Rate limited - in cooldown";
    
    if (staticSizes.length > 0) {
      console.log(`[tire-sizes] ${reason}, using static fallback for ${year} ${make} ${model}: ${staticSizes.join(", ")}`);
      
      const { searchSizes } = convertTireSizesForSearch(staticSizes);
      const staticConversions = staticSizes.map(size => {
        const conv = convertLegacyTireSize(size);
        return {
          originalSize: conv.original,
          recommendedSize: conv.recommended,
          alternatives: conv.alternatives,
          conversionMethod: conv.conversionMethod,
          isLegacy: conv.isLegacy,
        };
      });
      
      return NextResponse.json({
        tireSizes: staticSizes,
        tireSizesStrict: staticSizes,
        tireSizesAgg: [],
        searchableSizes: searchSizes.length > 0 ? searchSizes : staticSizes,
        sizeConversions: staticConversions,
        hasLegacySizes: staticConversions.some(c => c.isLegacy),
        source: "static-fallback",
        apiError: reason,
        cacheStats: getCacheStats(),
      });
    }
    
    return NextResponse.json({
      tireSizes: [],
      tireSizesStrict: [],
      tireSizesAgg: [],
      searchableSizes: [],
      sizeConversions: [],
      hasLegacySizes: false,
      apiError: `${reason} (no static fallback for ${year} ${make} ${model})`,
      source: "none",
      cacheStats: getCacheStats(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Call Wheel-Size API (original logic)
  // ═══════════════════════════════════════════════════════════════════════════
  const fallbackMakeSlug = normalizeMake(make || "");
  const fallbackModelSlug = normalizeModelForApi(model);

  let makeSlug = fallbackMakeSlug;
  let modelSlug = fallbackModelSlug;
  let resolved: { makeSlug: string; modelSlug: string; modelName?: string } | null = null;

  try {
    resolved = await wheelSizeApi.resolveMakeModel(make, model);
    if (resolved) {
      makeSlug = resolved.makeSlug;
      modelSlug = resolved.modelSlug;
    }
  } catch {
    // proceed with fallback slugs
  }

  const debug: any = {
    input: { year, make, model, modification, modificationRaw },
    slugs: { makeSlug, modelSlug, resolved, fallback: { makeSlug: fallbackMakeSlug, modelSlug: fallbackModelSlug } },
  };

  try {
    const modsResponse = await apiGet<{ data: Modification[] }>("modifications/", {
      make: makeSlug,
      model: modelSlug,
      year,
    });
    const allMods = modsResponse.data || [];
    const usMods = allMods.filter(m => m.regions?.includes("usdm"));
    const mods = usMods.length > 0 ? usMods : allMods;

    debug.modifications = {
      total: allMods.length,
      usMarket: usMods.length,
      available: mods.map(m => ({ slug: m.slug, name: m.name, trim: m.trim })),
    };

    if (mods.length === 0) {
      return NextResponse.json({
        tireSizes: [],
        tireSizesStrict: [],
        tireSizesAgg: [],
        debug,
        error: "No modifications found for this vehicle",
      });
    }

    let selectedMod: Modification | null = null;
    if (modification) {
      selectedMod = mods.find(m => m.slug === modification) || null;
    }
    if (!selectedMod) {
      selectedMod = mods[0];
    }

    debug.selectedModification = selectedMod;

    const vehicleResponse = await apiGet<{ data: VehicleData[] }>("search/by_model/", {
      make: makeSlug,
      model: modelSlug,
      year,
      modification: selectedMod.slug,
    });

    const vehicleData = vehicleResponse.data?.[0];
    debug.vehicleDataFound = !!vehicleData;
    debug.wheelsCount = vehicleData?.wheels?.length || 0;

    if (!vehicleData?.wheels?.length) {
      return NextResponse.json({
        tireSizes: [],
        tireSizesStrict: [],
        tireSizesAgg: [],
        debug,
        error: "No wheel/tire data found for this modification",
      });
    }

    const tireSizesSet = new Set<string>();
    const stockTireSizes: string[] = [];
    const allTireSizes: string[] = [];

    for (const wheel of vehicleData.wheels) {
      const frontTire = wheel.front?.tire;
      const rearTire = wheel.rear?.tire;

      if (frontTire && frontTire.trim()) {
        const normalized = normalizeTireSize(frontTire);
        if (normalized) {
          allTireSizes.push(normalized);
          tireSizesSet.add(normalized);
          if (wheel.is_stock) stockTireSizes.push(normalized);
        }
      }

      if (rearTire && rearTire.trim() && rearTire !== frontTire) {
        const normalized = normalizeTireSize(rearTire);
        if (normalized) {
          allTireSizes.push(normalized);
          tireSizesSet.add(normalized);
          if (wheel.is_stock) stockTireSizes.push(normalized);
        }
      }
    }

    const aggTireSizes: string[] = [];
    const otherMods = mods.filter(m => m.slug !== selectedMod?.slug).slice(0, 3);
    
    for (const mod of otherMods) {
      try {
        const otherResponse = await apiGet<{ data: VehicleData[] }>("search/by_model/", {
          make: makeSlug,
          model: modelSlug,
          year,
          modification: mod.slug,
        });
        
        const otherData = otherResponse.data?.[0];
        if (otherData?.wheels) {
          for (const wheel of otherData.wheels) {
            const frontTire = wheel.front?.tire;
            if (frontTire) {
              const normalized = normalizeTireSize(frontTire);
              if (normalized && !tireSizesSet.has(normalized)) {
                aggTireSizes.push(normalized);
                tireSizesSet.add(normalized);
              }
            }
          }
        }
      } catch {
        // Ignore errors for aggregate data
      }
    }

    debug.rawTireSizes = { stock: stockTireSizes, all: allTireSizes, aggregate: aggTireSizes };

    const tireSizes = Array.from(tireSizesSet);
    const fitment = {
      boltPattern: vehicleData.technical?.bolt_pattern,
      centerBore: vehicleData.technical?.centre_bore,
    };

    const { searchSizes, displayMap } = convertTireSizesForSearch(tireSizes);
    
    const sizeConversions: Array<{
      originalSize: string;
      recommendedSize: string;
      alternatives: string[];
      conversionMethod: string;
      isLegacy: boolean;
    }> = [];
    
    for (const size of tireSizes) {
      const conversion = convertLegacyTireSize(size);
      sizeConversions.push({
        originalSize: conversion.original,
        recommendedSize: conversion.recommended,
        alternatives: conversion.alternatives,
        conversionMethod: conversion.conversionMethod,
        isLegacy: conversion.isLegacy,
      });
    }
    
    const searchableSizes = searchSizes.length > 0 ? searchSizes : tireSizes;
    
    debug.legacyConversion = {
      hasLegacySizes: sizeConversions.some(c => c.isLegacy),
      originalSizes: tireSizes,
      searchSizes: searchableSizes,
      conversions: sizeConversions,
    };

    const strictSizes = stockTireSizes.length > 0 ? [...new Set(stockTireSizes)] : allTireSizes;
    setCache(cacheKey, {
      tireSizes: strictSizes,
      boltPattern: fitment.boltPattern,
      centerBore: fitment.centerBore ? parseFloat(String(fitment.centerBore)) : undefined,
      vehicle: { year: Number(year), make, model, submodel: selectedMod.name },
      source: "wheelsize",
      cachedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    return NextResponse.json({
      tireSizes,
      tireSizesStrict: strictSizes,
      tireSizesAgg: aggTireSizes,
      searchableSizes,
      sizeConversions,
      hasLegacySizes: sizeConversions.some(c => c.isLegacy),
      fitment,
      selectedModification: { slug: selectedMod.slug, name: selectedMod.name },
      source: "api",
      debug,
    });

  } catch (err: any) {
    debug.error = err?.message || String(err);
    const is429 = err?.message?.includes("429") || err?.message?.includes("rate limit");
    
    const staticSizes = getStaticOemSizes(year, make, model, modification);
    if (staticSizes.length > 0) {
      console.log(`[tire-sizes] API error, using static fallback for ${year} ${make} ${model}: ${staticSizes.join(", ")}`);
      
      const { searchSizes: fallbackSearchSizes } = convertTireSizesForSearch(staticSizes);
      const fallbackConversions = staticSizes.map(size => {
        const conv = convertLegacyTireSize(size);
        return {
          originalSize: conv.original,
          recommendedSize: conv.recommended,
          alternatives: conv.alternatives,
          conversionMethod: conv.conversionMethod,
          isLegacy: conv.isLegacy,
        };
      });
      
      return NextResponse.json({
        tireSizes: staticSizes,
        tireSizesStrict: staticSizes,
        tireSizesAgg: [],
        searchableSizes: fallbackSearchSizes.length > 0 ? fallbackSearchSizes : staticSizes,
        sizeConversions: fallbackConversions,
        hasLegacySizes: fallbackConversions.some(c => c.isLegacy),
        source: "static-fallback",
        apiError: err?.message || String(err),
        cacheStats: getCacheStats(),
        debug,
      });
    }
    
    return NextResponse.json(
      { 
        tireSizes: [],
        tireSizesStrict: [],
        tireSizesAgg: [],
        error: is429 ? "Rate limited - please try again later" : (err?.message || String(err)),
        rateLimited: is429,
        cacheStats: getCacheStats(),
        debug,
      },
      { status: is429 ? 429 : 500 }
    );
  }
}

function normalizeTireSize(size: string): string | null {
  if (!size) return null;
  
  let s = size.trim().toUpperCase();
  s = s.replace(/^LT/, "");
  
  if (s.match(/^\d+X[\d.]+R\d+/i)) {
    return s;
  }
  
  const match = s.match(/(\d{3})\/(\d{2,3})R(\d{2})/);
  if (match) {
    return `${match[1]}/${match[2]}R${match[3]}`;
  }
  
  return size.trim();
}
