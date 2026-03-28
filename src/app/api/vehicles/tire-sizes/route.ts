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
  // ═══════════════════════════════════════════════════════════════════════════
  // KILL SWITCH - Block ALL Wheel-Size API calls when disabled
  // ═══════════════════════════════════════════════════════════════════════════
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
    // Check for 429 rate limit
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
  front: {
    tire: string;
    tire_full?: string;
    rim_diameter: number;
  };
  rear?: {
    tire: string;
    tire_full?: string;
    rim_diameter?: number;
  };
};

type VehicleData = {
  wheels?: WheelSetup[];
  technical?: {
    bolt_pattern?: string;
    centre_bore?: string;
  };
};

type Modification = {
  slug: string;
  name: string;
  trim?: string;
  regions?: string[];
};

/**
 * GET /api/vehicles/tire-sizes?year=2024&make=Ford&model=F-150&modification=s_abc123
 * 
 * Returns tire sizes for a vehicle by querying Wheel-Size API directly.
 * Uses caching and handles 429 rate limits gracefully.
 * 
 * Params:
 * - modification: canonical fitment identity (preferred)
 * - trim: legacy param, falls back if modification not provided
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  
  // PARAM SEPARATION: prefer modification, fall back to trim
  const modificationParam = url.searchParams.get("modification") || "";
  const trimParam = url.searchParams.get("trim") || "";
  const modificationRaw = modificationParam || trimParam;
  
  if (!modificationParam && trimParam) {
    console.warn(`[tire-sizes] DEPRECATION: Using 'trim' param. Migrate to 'modification=${trimParam}'`);
  }
  
  const forceRefresh = url.searchParams.get("refresh") === "1";
  
  // Handle composite modification values like "bfd36e8a76__xlt__"
  const modification = modificationRaw.includes("__") 
    ? modificationRaw.split("__")[0] 
    : modificationRaw;

  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }

  // Check cache first (unless force refresh)
  const cacheKey = makeCacheKey(year, make, model, modification);
  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) {
      // Convert legacy sizes for cached results too
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

  // Check if we're in 429 cooldown OR if API is disabled - use static fallback if available
  const apiUnavailable = isInCooldown() || !wheelSizeApi.isWheelSizeEnabled();
  
  if (apiUnavailable) {
    const staticSizes = getStaticOemSizes(year, make, model, modification);
    const reason = !wheelSizeApi.isWheelSizeEnabled() 
      ? "Wheel-Size API is temporarily disabled" 
      : "Rate limited - in cooldown";
    
    if (staticSizes.length > 0) {
      console.log(`[tire-sizes] ${reason}, using static fallback for ${year} ${make} ${model}: ${staticSizes.join(", ")}`);
      
      // Convert legacy sizes for static fallback too
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
    
    // No static data available - return empty array gracefully (NOT a 500 error)
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

  // Convert to slugs.
  // Prefer resolving via Wheel-Size catalog (handles Mercedes '*-Class' names, etc.).
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
    // If catalog resolve fails, proceed with best-guess slugs.
  }

  const debug: any = {
    input: { year, make, model, modification, modificationRaw },
    slugs: {
      makeSlug,
      modelSlug,
      resolved,
      fallback: { makeSlug: fallbackMakeSlug, modelSlug: fallbackModelSlug },
    },
  };

  try {
    // Step 1: Get available modifications for this vehicle
    const modsResponse = await apiGet<{ data: Modification[] }>("modifications/", {
      make: makeSlug,
      model: modelSlug,
      year,
    });
    const allMods = modsResponse.data || [];
    
    // Filter to US market mods
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

    // Step 2: Find the right modification to use
    let selectedMod: Modification | null = null;
    
    if (modification) {
      // Try to match the provided modification slug
      selectedMod = mods.find(m => m.slug === modification) || null;
    }
    
    // If no match, use the first US market modification
    if (!selectedMod) {
      selectedMod = mods[0];
    }

    debug.selectedModification = selectedMod;

    // Step 3: Get vehicle data with tire sizes
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

    // Step 4: Extract tire sizes from wheels array
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
          if (wheel.is_stock) {
            stockTireSizes.push(normalized);
          }
        }
      }

      if (rearTire && rearTire.trim() && rearTire !== frontTire) {
        const normalized = normalizeTireSize(rearTire);
        if (normalized) {
          allTireSizes.push(normalized);
          tireSizesSet.add(normalized);
          if (wheel.is_stock) {
            stockTireSizes.push(normalized);
          }
        }
      }
    }

    // Step 5: Also fetch other modifications to get aggregate sizes
    const aggTireSizes: string[] = [];
    
    // Limit to first 3 additional mods to avoid rate limits
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

    debug.rawTireSizes = {
      stock: stockTireSizes,
      all: allTireSizes,
      aggregate: aggTireSizes,
    };

    // Final tire sizes (deduplicated)
    const tireSizes = Array.from(tireSizesSet);

    // Also include bolt pattern and other fitment data
    const fitment = {
      boltPattern: vehicleData.technical?.bolt_pattern,
      centerBore: vehicleData.technical?.centre_bore,
    };

    // ═══════════════════════════════════════════════════════════════════════
    // LEGACY TIRE SIZE CONVERSION
    // Convert pre-metric sizes (E70-14, G60-15, etc.) to modern equivalents
    // Original sizes preserved for display, modern sizes used for search
    // ═══════════════════════════════════════════════════════════════════════
    const { searchSizes, displayMap } = convertTireSizesForSearch(tireSizes);
    
    // Build size conversions array for API response
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
    
    // For searching, use converted modern sizes
    const searchableSizes = searchSizes.length > 0 ? searchSizes : tireSizes;
    
    debug.legacyConversion = {
      hasLegacySizes: sizeConversions.some(c => c.isLegacy),
      originalSizes: tireSizes,
      searchSizes: searchableSizes,
      conversions: sizeConversions,
    };

    // Cache the successful result
    const strictSizes = stockTireSizes.length > 0 ? [...new Set(stockTireSizes)] : allTireSizes;
    setCache(cacheKey, {
      tireSizes: strictSizes,
      boltPattern: fitment.boltPattern,
      centerBore: fitment.centerBore ? parseFloat(String(fitment.centerBore)) : undefined,
      vehicle: {
        year: Number(year),
        make,
        model,
        submodel: selectedMod.name,
      },
      source: "wheelsize",
      cachedAt: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
    });

    return NextResponse.json({
      // Original OEM sizes (for display)
      tireSizes,
      tireSizesStrict: strictSizes,
      tireSizesAgg: aggTireSizes,
      
      // Converted sizes for search (modern P-metric)
      searchableSizes,
      
      // Size conversion details
      sizeConversions,
      hasLegacySizes: sizeConversions.some(c => c.isLegacy),
      
      fitment,
      selectedModification: {
        slug: selectedMod.slug,
        name: selectedMod.name,
      },
      source: "api",
      debug,
    });

  } catch (err: any) {
    debug.error = err?.message || String(err);
    
    // Check if this is a rate limit error
    const is429 = err?.message?.includes("429") || err?.message?.includes("rate limit");
    
    // Try static fallback if API failed
    const staticSizes = getStaticOemSizes(year, make, model, modification);
    if (staticSizes.length > 0) {
      console.log(`[tire-sizes] API error, using static fallback for ${year} ${make} ${model}: ${staticSizes.join(", ")}`);
      
      // Convert legacy sizes for error fallback too
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

/**
 * Normalize tire size to standard format (e.g., "LT315/70R17" -> "315/70R17")
 */
function normalizeTireSize(size: string): string | null {
  if (!size) return null;
  
  let s = size.trim().toUpperCase();
  
  // Remove LT prefix for light truck sizes
  s = s.replace(/^LT/, "");
  
  // Handle flotation sizes like "37x12.50R17LT" -> keep as-is for now
  if (s.match(/^\d+X[\d.]+R\d+/i)) {
    return s;
  }
  
  // Standard metric sizes: 315/70R17, 275/55R20, etc.
  const match = s.match(/(\d{3})\/(\d{2,3})R(\d{2})/);
  if (match) {
    return `${match[1]}/${match[2]}R${match[3]}`;
  }
  
  // Return original if can't normalize
  return size.trim();
}
