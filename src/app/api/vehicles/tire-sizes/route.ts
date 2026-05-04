/**
 * Tire Sizes API (DB-First, No External API)
 * 
 * File: src/app/api/vehicles/tire-sizes/route.ts
 * 
 * Returns OEM tire sizes from database. No external API fallback.
 * 
 * 2026-05-03: Added trim-aware resolution with debug fields
 * - selectedTrim, normalizedTrim, modificationId passed to response
 * - fitmentSource tracks where data came from
 * - exactTrimMatch indicates if specific trim was found
 * - reasonMultipleSizesShown explains why gate is shown
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
// DEBUG RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TireSizeDebugInfo {
  // === Scott's Required Audit Fields (2026-05-04) ===
  requestedTrim: string | null;           // What UI sent
  normalizedRequestedTrim: string | null; // After normalization
  candidateTrims: string[];               // All trims considered
  matchedTrim: string | null;             // Which trim was matched (displayTrim)
  matchedBy: string | null;               // Resolution method (exact_modification, normalized_trim, etc.)
  modificationId: string | null;          // Resolved modificationId
  tireSizesFound: string[];               // The actual tire sizes returned
  fallbackBlockedReason: string | null;   // Why fallback was blocked (if applicable)
  
  // === Additional Context ===
  fitmentSource: "config" | "db-exact" | "db-fallback" | "static" | "cache" | "none";
  exactTrimMatch: boolean;
  sizeCount: number;
  wheelDiametersAvailable: number[];
  needsWheelSelection: boolean;
  reasonMultipleSizesShown: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DB-FIRST FITMENT LOOKUP (with trim-aware resolution)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Look up OEM tire sizes from the fitment database.
 * This is the PRIMARY source for imported fitment data.
 * 
 * 2026-05-03: Uses safeResolver for trim-specific matching
 * - Returns exact trim match when possible
 * - Falls back to model-level only when no specific trim data exists
 * - Returns debug info for tracking resolution path
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
  // Debug info for 2026-05-03 fix
  debug: {
    exactTrimMatch: boolean;
    resolutionMethod: string;
    candidateCount: number;
    selectedModificationId: string | null;
    selectedDisplayTrim: string | null;
  };
}

// 2026-05-04: Enhanced result type for trim-blocked fallback
interface TrimBlockedResult {
  blocked: true;
  reason: "inconsistent_sizes";
  availableTrims: Array<{
    modificationId: string;
    displayTrim: string;
    tireSizes: string[];
  }>;
  requestedTrim: string;
}

async function getDbFitmentSizes(
  year: string, 
  make: string, 
  model: string, 
  modification?: string,
  trim?: string  // Display label for atomic trim matching
): Promise<DbFitmentResult | TrimBlockedResult | null> {
  try {
    const { resolveVehicleFitment } = await import("@/lib/fitment/canonicalResolver");
    const { canDetectStaggered } = await import("@/lib/fitment-db/qualityTier");
    
    // ═══════════════════════════════════════════════════════════════════════
    // 2026-05-04: Use CANONICAL RESOLVER for fitment identity
    // This properly handles grouped trims and prevents fallback to model-level
    // ═══════════════════════════════════════════════════════════════════════
    
    const resolveResult = await resolveVehicleFitment({
      year: parseInt(year, 10),
      make,
      model,
      trim: trim || undefined,          // Use display label if available
      modificationId: modification || undefined,
    });
    
    // Check if resolution was blocked
    if (resolveResult.matchedBy === "blocked") {
      console.warn(`[tire-sizes] ⚠️ CANONICAL BLOCKED: ${year} ${make} ${model} → ${resolveResult.debug.fallbackBlockedReason}`);
      
      return {
        blocked: true,
        reason: "inconsistent_sizes",
        availableTrims: resolveResult.debug.candidateTrims.map(c => ({
          modificationId: c.modificationId,
          displayTrim: c.atomicTrims[0], // Use first atomic trim for display
          tireSizes: c.tireSizes,
        })),
        requestedTrim: modification || trim || "",
      };
    }
    
    // Check if not found at all
    if (resolveResult.matchedBy === "not_found" || !resolveResult.fitment) {
      // No match found - return null to fall through to other sources
      console.log(`[tire-sizes] CANONICAL NOT_FOUND: ${year} ${make} ${model} mod=${modification}`);
      return null;
    }
    
    const selectedFitment = resolveResult.fitment;
    const debugInfo = {
      exactTrimMatch: resolveResult.confidence === "high",
      resolutionMethod: resolveResult.matchedBy,
      candidateCount: resolveResult.debug.candidateTrims.length,
      selectedModificationId: resolveResult.modificationId,
      selectedDisplayTrim: resolveResult.displayTrim,
    };
    
    console.log(`[tire-sizes] CANONICAL HIT: ${year} ${make} ${model} → method=${resolveResult.matchedBy}, confidence=${resolveResult.confidence}, trim="${resolveResult.displayTrim}"`);
    if (resolveResult.debug.wasGroupedRecord) {
      console.log(`[tire-sizes]   ↳ Extracted from grouped record, matched atomic trim: "${resolveResult.debug.matchedAtomicTrim}"`);
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
    
    // PHASE 3: Only detect staggered if quality tier allows it
    const qualityTier = (selectedFitment as any).qualityTier;
    const staggeredCheck = canDetectStaggered(qualityTier, oemWheelSizes);
    
    if (staggeredCheck.canDetect && oemWheelSizes && oemWheelSizes.length > 0) {
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
    } else if (!staggeredCheck.canDetect) {
      console.log(`[tire-sizes] Staggered detection BLOCKED: ${staggeredCheck.reason}`);
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
            source: debugInfo.exactTrimMatch ? "db-exact" : "db-fallback",
            staggered: staggeredInfo,
            debug: debugInfo,
          };
        }
      }
      return null;
    }
    
    return {
      tireSizes: oemTireSizes,
      boltPattern: selectedFitment.boltPattern ?? undefined,
      centerBore: selectedFitment.centerBoreMm ? Number(selectedFitment.centerBoreMm) : undefined,
      source: debugInfo.exactTrimMatch ? "db-exact" : "db-fallback",
      staggered: staggeredInfo,
      debug: debugInfo,
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
        
        // Debug info for multiple-size prompt tracking
        const debugInfo: TireSizeDebugInfo = {
          // Scott's required audit fields
          requestedTrim: trimParam || null,
          normalizedRequestedTrim: modification || null,
          candidateTrims: [], // Config table = direct match, no candidates
          matchedTrim: modification || null,
          matchedBy: "config_table",
          modificationId: modification || null,
          tireSizesFound: tireSizes,
          fallbackBlockedReason: null,
          // Additional context
          fitmentSource: "config",
          exactTrimMatch: true, // Config table = exact trim match
          sizeCount: tireSizes.length,
          wheelDiametersAvailable: diameters,
          needsWheelSelection: configResult.hasMultipleDiameters,
          reasonMultipleSizesShown: configResult.hasMultipleDiameters 
            ? `Trim ${modification || 'selected'} has ${diameters.length} OEM wheel options: ${diameters.join('", "')}"`
            : null,
        };
        
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
          debug: debugInfo,
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
    // Pass both modificationId and trim label for best resolution
    const dbFitment = await getDbFitmentSizes(year, make, model, modification, trimParam || undefined);
    
    // Check if fallback was BLOCKED due to inconsistent tire sizes across trims
    if (dbFitment && 'blocked' in dbFitment && dbFitment.blocked) {
      console.log(`[tire-sizes] BLOCKED RESPONSE: ${year} ${make} ${model} mod=${modification} → ${dbFitment.availableTrims.length} trims available`);
      
      // Return a response that tells the UI:
      // 1. We couldn't find the exact trim requested
      // 2. Different trims have different tire sizes
      // 3. Here are the available trims to choose from
      const debugInfo: TireSizeDebugInfo = {
        // Scott's required audit fields
        requestedTrim: trimParam || null,
        normalizedRequestedTrim: modification || null,
        candidateTrims: dbFitment.availableTrims.map(t => t.displayTrim),
        matchedTrim: null, // Not matched - fallback blocked
        matchedBy: null,
        modificationId: null,
        tireSizesFound: [],
        fallbackBlockedReason: `Trim "${modification}" not found. ${dbFitment.availableTrims.length} trims exist with different tire sizes.`,
        // Additional context
        fitmentSource: "none",
        exactTrimMatch: false,
        sizeCount: 0,
        wheelDiametersAvailable: [],
        needsWheelSelection: false,
        reasonMultipleSizesShown: `Trim "${modification}" not found. ${dbFitment.availableTrims.length} trims exist with different tire sizes - please select your exact trim.`,
      };
      
      return NextResponse.json({
        tireSizes: [],
        tireSizesStrict: [],
        tireSizesAgg: [],
        searchableSizes: [],
        sizeConversions: [],
        hasLegacySizes: false,
        source: "trim_not_found",
        
        // NEW: Inform UI that trim selection is required
        trimResolutionRequired: true,
        trimNotFound: dbFitment.requestedTrim,
        availableTrims: dbFitment.availableTrims,
        
        message: `The selected trim "${modification}" was not found. Different trims for this vehicle have different tire sizes. Please select your exact trim.`,
        debug: debugInfo,
        cacheStats: getCacheStats(),
      });
    }
    
    if (dbFitment && !('blocked' in dbFitment) && dbFitment.tireSizes.length > 0) {
      console.log(`[tire-sizes] DB-FIRST HIT: ${year} ${make} ${model} → ${dbFitment.tireSizes.join(", ")} (exact=${dbFitment.debug.exactTrimMatch})`);
      
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
      
      // Build the reasonMultipleSizesShown based on the resolution
      let reasonMultipleSizesShown: string | null = null;
      if (wheelDiameterAnalysis.needsSelection && !isStaggered) {
        if (dbFitment.debug.exactTrimMatch) {
          // Legitimate multiple sizes for this specific trim
          reasonMultipleSizesShown = `Trim "${dbFitment.debug.selectedDisplayTrim}" has ${wheelDiameterAnalysis.availableDiameters.length} OEM wheel options: ${wheelDiameterAnalysis.availableDiameters.map(d => `${d}"`).join(', ')}`;
        } else {
          // Fallback to model-level data - this is the problem case!
          reasonMultipleSizesShown = `⚠️ FALLBACK: Using model-level data (${dbFitment.debug.resolutionMethod}). ${dbFitment.debug.candidateCount} trims available. Multiple sizes may not all apply to selected trim.`;
          console.warn(`[tire-sizes] ⚠️ MULTIPLE SIZES FROM FALLBACK: ${year} ${make} ${model} mod=${modification} → showing ${wheelDiameterAnalysis.availableDiameters.length} diameters from ${dbFitment.debug.resolutionMethod}`);
        }
      }
      
      // Debug info for tracking
      const debugInfo: TireSizeDebugInfo = {
        // Scott's required audit fields
        requestedTrim: trimParam || null,
        normalizedRequestedTrim: modification || null,
        candidateTrims: [], // Would need to fetch from safeResolver for full list
        matchedTrim: dbFitment.debug.selectedDisplayTrim,
        matchedBy: dbFitment.debug.resolutionMethod,
        modificationId: dbFitment.debug.selectedModificationId,
        tireSizesFound: dbFitment.tireSizes,
        fallbackBlockedReason: null,
        // Additional context
        fitmentSource: dbFitment.debug.exactTrimMatch ? "db-exact" : "db-fallback",
        exactTrimMatch: dbFitment.debug.exactTrimMatch,
        sizeCount: dbFitment.tireSizes.length,
        wheelDiametersAvailable: wheelDiameterAnalysis.availableDiameters,
        needsWheelSelection: isStaggered ? false : wheelDiameterAnalysis.needsSelection,
        reasonMultipleSizesShown,
      };
      
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
        debug: debugInfo,
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
