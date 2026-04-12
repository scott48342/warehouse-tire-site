/**
 * Tire Sizes API (DB-First, No External API)
 * 
 * File: src/app/api/vehicles/tire-sizes/route.ts
 * 
 * Returns OEM tire sizes from database. No external API fallback.
 */

import { NextResponse } from "next/server";
import {
  makeCacheKey,
  getCached,
  setCache,
  getCacheStats,
  type CachedFitment,
} from "@/lib/fitmentCache";
import oemSizesData from "@/data/oem-tire-sizes.json";
import { 
  convertLegacyTireSize, 
  convertTireSizesForSearch,
} from "@/lib/legacyTireConverter";
import { analyzeTireSizeOptions } from "@/lib/tires/wheelDiameterFilter";

export const runtime = "nodejs";
export const maxDuration = 30;

// ═══════════════════════════════════════════════════════════════════════════
// DB-FIRST FITMENT LOOKUP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Look up OEM tire sizes from the fitment database.
 * This is the PRIMARY source for imported fitment data.
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
// STATIC FALLBACK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Look up static OEM tire sizes from local data file.
 * Used as fallback when database has no data.
 */
function getStaticOemSizes(year: string, make: string, model: string, modification?: string): string[] {
  const vehicles = (oemSizesData as any).vehicles;
  
  const makeKey = make.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const modelKey = model.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const trimKey = modification?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "";
  
  const makeData = vehicles[makeKey];
  if (!makeData) return [];
  
  const modelData = makeData[modelKey];
  if (!modelData) return [];
  
  const yearData = modelData[year];
  if (!yearData) {
    const nearYear = modelData[String(Number(year) - 1)] || modelData[String(Number(year) + 1)];
    if (!nearYear) return [];
    return nearYear.default || [];
  }
  
  if (trimKey && yearData[trimKey]) {
    return yearData[trimKey];
  }
  
  for (const key of Object.keys(yearData)) {
    if (key !== "default" && trimKey.includes(key)) {
      return yearData[key];
    }
  }
  
  return yearData.default || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ROUTE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

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
  // STEP 1: DB-FIRST - Check imported fitment database
  // ═══════════════════════════════════════════════════════════════════════════
  if (!forceRefresh) {
    const dbFitment = await getDbFitmentSizes(year, make, model, modification);
    if (dbFitment && dbFitment.tireSizes.length > 0) {
      console.log(`[tire-sizes] DB-FIRST HIT: ${year} ${make} ${model} → ${dbFitment.tireSizes.join(", ")}`);
      
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
      
      // Analyze wheel diameters - CRITICAL for correct tire size filtering
      const wheelDiameterAnalysis = analyzeTireSizeOptions(dbFitment.tireSizes);
      
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
        // Wheel diameter analysis for trim-specific filtering
        wheelDiameters: {
          needsSelection: wheelDiameterAnalysis.needsSelection,
          available: wheelDiameterAnalysis.availableDiameters,
          default: wheelDiameterAnalysis.defaultDiameter,
        },
        source: dbFitment.source,
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
  // STEP 3: Static fallback (no external API)
  // ═══════════════════════════════════════════════════════════════════════════
  const staticSizes = getStaticOemSizes(year, make, model, modification);
  
  if (staticSizes.length > 0) {
    console.log(`[tire-sizes] STATIC fallback for ${year} ${make} ${model}: ${staticSizes.join(", ")}`);
    
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
    
    // Cache the static data
    setCache(cacheKey, {
      tireSizes: staticSizes,
      boltPattern: undefined,
      centerBore: undefined,
      vehicle: { year: Number(year), make, model, submodel: modification || "" },
      source: "fallback",
      cachedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
    
    return NextResponse.json({
      tireSizes: staticSizes,
      tireSizesStrict: staticSizes,
      tireSizesAgg: [],
      searchableSizes: searchSizes.length > 0 ? searchSizes : staticSizes,
      sizeConversions: staticConversions,
      hasLegacySizes: staticConversions.some(c => c.isLegacy),
      source: "static-fallback",
      cacheStats: getCacheStats(),
    });
  }
  
  // No data available - log for gap tracking
  console.warn(`[tire-sizes] NO DATA for ${year} ${make} ${model}`);
  
  // Log unresolved fitment search (fire and forget)
  import("@/lib/fitment-db/unresolvedFitmentTracker").then(({ logUnresolvedFitment }) => {
    logUnresolvedFitment({
      year,
      make,
      model,
      trim: modification || undefined,
      searchType: "tire",
      source: "api",
      path: `/api/vehicles/tire-sizes?year=${year}&make=${make}&model=${model}`,
      modificationId: modification || undefined,
      resolutionAttempts: ["db-first", "static-fallback"],
    }).catch(() => {});
  }).catch(() => {});
  
  return NextResponse.json({
    tireSizes: [],
    tireSizesStrict: [],
    tireSizesAgg: [],
    searchableSizes: [],
    sizeConversions: [],
    hasLegacySizes: false,
    source: "none",
    message: `No tire size data available for ${year} ${make} ${model}`,
    cacheStats: getCacheStats(),
  });
}
