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
import oemSizesData from "@/data/oem-tire-sizes.json";

// ============================================================================
// WHEEL-SIZE API REMOVED (Phase A - DB-First Architecture)
// All tire size data comes from local DB, cache, or static fallback.
// ============================================================================
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
    
    // Helper to check if a fitment has tire sizes
    const hasTireSizes = (f: any): boolean => {
      if (f.oemTireSizes && Array.isArray(f.oemTireSizes) && f.oemTireSizes.length > 0) {
        return true;
      }
      if (f.oemWheelSizes && Array.isArray(f.oemWheelSizes)) {
        return f.oemWheelSizes.some((ws: any) => ws.tires?.length > 0 || ws.tireSize);
      }
      return false;
    };
    
    // Find matching modification or prefer records with tire sizes
    let selectedFitment = fitments[0];
    if (modification) {
      const match = fitments.find(f => 
        f.modificationId === modification ||
        f.displayTrim?.toLowerCase().includes(modification.toLowerCase())
      );
      if (match) selectedFitment = match;
    }
    
    // If selected has no tire sizes, try to find one that does
    if (!hasTireSizes(selectedFitment)) {
      const withTires = fitments.find(f => hasTireSizes(f));
      if (withTires) {
        selectedFitment = withTires;
      }
    }
    
    // Extract tire sizes from oem_tire_sizes JSON field
    const oemTireSizes = selectedFitment.oemTireSizes as string[] | null;
    if (!oemTireSizes || oemTireSizes.length === 0) {
      // Also check oemWheelSizes for tire info
      const oemWheelSizes = selectedFitment.oemWheelSizes as Array<{ 
        tires?: string[]; 
        tireSize?: string; 
      }> | null;
      if (oemWheelSizes) {
        const extractedSizes = new Set<string>();
        for (const ws of oemWheelSizes) {
          // Handle both tires array and single tireSize
          if (ws.tires) {
            ws.tires.forEach(t => extractedSizes.add(t));
          }
          if (ws.tireSize) {
            extractedSizes.add(ws.tireSize);
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
      // No tire sizes found, but we might still have valid fitment data
      // Return partial result with fitment but empty tire sizes
      if (selectedFitment.boltPattern && selectedFitment.boltPattern.trim().length > 0) {
        return {
          tireSizes: [],
          boltPattern: selectedFitment.boltPattern,
          centerBore: selectedFitment.centerBoreMm ? Number(selectedFitment.centerBoreMm) : undefined,
          source: "db-first-fitment-only",
        };
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

// ============================================================================
// WHEEL-SIZE API PERMANENTLY DISABLED (Phase A - DB-First Architecture)
// ============================================================================

const BASE_URL = "https://api.wheel-size.com/v2/";

function getApiKey(): string {
  throw new Error("Wheel-Size API is FORBIDDEN in DB-first runtime");
}

async function apiGet<T>(_path: string, _params?: Record<string, string>): Promise<T> {
  throw new Error("Wheel-Size API is FORBIDDEN in DB-first runtime. All tire data must come from local database or static fallback.");
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
  // Store db fitment for later use even if tire sizes need fallback
  let dbFitmentData: { boltPattern?: string; centerBore?: number } | null = null;
  
  if (!forceRefresh) {
    const dbFitment = await getDbFitmentSizes(year, make, model, modification);
    if (dbFitment) {
      // Store fitment data for potential use in fallback
      if (dbFitment.boltPattern) {
        dbFitmentData = {
          boltPattern: dbFitment.boltPattern,
          centerBore: dbFitment.centerBore,
        };
      }
      
      if (dbFitment.tireSizes.length > 0) {
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
      } else if (dbFitmentData) {
        console.log(`[tire-sizes] DB has fitment but no tire sizes for ${year} ${make} ${model}, will use fallback for sizes`);
      }
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
  // STEP 3: API unavailable - use static fallback (PHASE A - DB-FIRST)
  // Wheel-Size API is PERMANENTLY DISABLED. Use DB data or static fallback only.
  // ═══════════════════════════════════════════════════════════════════════════
  const apiUnavailable = true; // HARD BLOCK: Wheel-Size API is forbidden
  
  if (apiUnavailable) {
    const staticSizes = getStaticOemSizes(year, make, model, modification);
    const reason = "Wheel-Size API is permanently disabled (DB-first architecture)";
    
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
        // Merge db fitment data if available
        fitment: dbFitmentData || undefined,
        source: dbFitmentData ? "static-fallback+db-fitment" : "static-fallback",
        apiError: reason,
        cacheStats: getCacheStats(),
      });
    }
    
    // No static fallback available - return db fitment if we have it
    return NextResponse.json({
      tireSizes: [],
      tireSizesStrict: [],
      tireSizesAgg: [],
      searchableSizes: [],
      sizeConversions: [],
      hasLegacySizes: false,
      // Include db fitment even if no tire sizes
      fitment: dbFitmentData || undefined,
      apiError: `${reason} (no static fallback for ${year} ${make} ${model})`,
      source: dbFitmentData ? "db-fitment-only" : "none",
      cacheStats: getCacheStats(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: REMOVED - Wheel-Size API (Phase A - DB-first architecture)
  // All API call logic has been removed. The code above returns from
  // DB, cache, or static fallback. This path should never be reached.
  // ═══════════════════════════════════════════════════════════════════════════
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
