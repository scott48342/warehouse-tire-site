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
interface StaggeredTireInfo {
  isStaggered: boolean;
  frontTireSize?: string;
  rearTireSize?: string;
  frontDiameter?: number;
  rearDiameter?: number;
}

interface DbFitmentResult {
  tireSizes: string[];
  boltPattern?: string;
  centerBore?: number;
  source: string;
  staggered?: StaggeredTireInfo;
}

async function getDbFitmentSizes(
  year: string, 
  make: string, 
  model: string, 
  modification?: string
): Promise<DbFitmentResult | null> {
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
    
    // Check wheel sizes for staggered configuration
    const oemWheelSizes = selectedFitment.oemWheelSizes as Array<{
      diameter?: number;
      width?: number;
      offset?: number;
      position?: string;
      axle?: string;
      tireSize?: string;
      tires?: string[];
    }> | null;
    
    let staggeredInfo: StaggeredTireInfo | undefined;
    
    if (oemWheelSizes && oemWheelSizes.length > 0) {
      // Check for staggered setup by looking for front/rear positions
      const frontWheel = oemWheelSizes.find(ws => ws.position === 'front' || ws.axle === 'front');
      const rearWheel = oemWheelSizes.find(ws => ws.position === 'rear' || ws.axle === 'rear');
      
      if (frontWheel && rearWheel) {
        // Extract tire sizes for front and rear
        const oemTireSizes = selectedFitment.oemTireSizes as string[] | null;
        let frontTire: string | undefined;
        let rearTire: string | undefined;
        
        if (oemTireSizes && oemTireSizes.length >= 2) {
          // Match tire sizes by rim diameter
          for (const size of oemTireSizes) {
            const rimMatch = size.match(/R(\d+)$/);
            if (rimMatch) {
              const rimDiameter = parseInt(rimMatch[1], 10);
              if (frontWheel.diameter && rimDiameter === frontWheel.diameter && !frontTire) {
                frontTire = size;
              } else if (rearWheel.diameter && rimDiameter === rearWheel.diameter && !rearTire) {
                rearTire = size;
              }
            }
          }
        }
        
        staggeredInfo = {
          isStaggered: true,
          frontTireSize: frontTire,
          rearTireSize: rearTire,
          frontDiameter: frontWheel.diameter,
          rearDiameter: rearWheel.diameter,
        };
        
        console.log(`[tire-sizes] STAGGERED detected: F:${frontTire || 'unknown'} R:${rearTire || 'unknown'}`);
      }
    }
    
    // Extract tire sizes from oem_tire_sizes JSON field
    const oemTireSizes = selectedFitment.oemTireSizes as string[] | null;
    if (!oemTireSizes || oemTireSizes.length === 0) {
      // Also check oemWheelSizes for tire info
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
            staggered: staggeredInfo,
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
      staggered: staggeredInfo,
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
  // STEP 0: CONFIG TABLE - Check new fitment configurations table first
  // This provides trim-specific tire sizes with high confidence
  // ═══════════════════════════════════════════════════════════════════════════
  if (!forceRefresh) {
    try {
      const { getFitmentConfigurations } = await import("@/lib/fitment-db/getFitmentConfigurations");
      // Pass trimParam to help prioritize matching when vehicle_fitments has comma-separated trims
      const configResult = await getFitmentConfigurations(
        parseInt(year, 10),
        make,
        model,
        modification,
        trimParam || undefined // requestedTrim from URL
      );
      
      if (configResult.usedConfigTable && configResult.configurations.length > 0) {
        // Use config table data - this is trim-specific and verified
        const tireSizes = [...new Set(configResult.configurations.map(c => c.tireSize))];
        const diameters = configResult.uniqueDiameters;
        
        console.log(`[tire-sizes] CONFIG TABLE HIT: ${year} ${make} ${model} ${modification} → ${tireSizes.join(", ")} (${configResult.confidence})`);
        
        const { searchSizes } = convertTireSizesForSearch(tireSizes);
        const configConversions = tireSizes.map(size => {
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
          tireSizes,
          tireSizesStrict: tireSizes,
          tireSizesAgg: [],
          searchableSizes: searchSizes.length > 0 ? searchSizes : tireSizes,
          sizeConversions: configConversions,
          hasLegacySizes: false,
          fitment: {
            // Config table doesn't store bolt pattern yet, could add later
          },
          wheelDiameters: {
            needsSelection: configResult.hasMultipleDiameters,
            available: diameters,
            default: diameters[0] || null,
          },
          source: "config",
          confidence: configResult.confidence,
          cacheStats: getCacheStats(),
        });
      }
    } catch (err) {
      console.warn("[tire-sizes] Config table lookup failed, using legacy:", err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: DB-FIRST - Check imported fitment database (legacy)
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
      
      // For staggered vehicles, we don't need diameter selection - use both sizes
      const isStaggered = dbFitment.staggered?.isStaggered ?? false;
      
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
        // For staggered: needsSelection=false because both sizes are needed
        wheelDiameters: {
          needsSelection: isStaggered ? false : wheelDiameterAnalysis.needsSelection,
          available: wheelDiameterAnalysis.availableDiameters,
          default: wheelDiameterAnalysis.defaultDiameter,
        },
        // Staggered fitment info (for vehicles like Crossfire, Mustang GT, etc.)
        staggered: dbFitment.staggered,
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
