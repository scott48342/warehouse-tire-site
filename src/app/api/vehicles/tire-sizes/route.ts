/**
 * Tire Sizes API (DB-First, Canonical Only)
 * 
 * File: src/app/api/vehicles/tire-sizes/route.ts
 * 
 * Returns OEM tire sizes from database ONLY via canonical resolver.
 * 
 * 2026-05-14: CANONICAL SOURCE ENFORCEMENT
 * - REMOVED: vehicle_fitment_configurations (deprecated config table)
 * - REMOVED: Static JSON fallback (oem-tire-sizes.json)
 * - ONLY SOURCE: vehicle_fitments via canonicalResolver
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
// 2026-05-14: REMOVED - Static JSON fallback disabled for canonical enforcement
// import oemSizesData from "@/data/oem-tire-sizes.json";
import { 
  convertLegacyTireSize, 
  convertTireSizesForSearch,
} from "@/lib/legacyTireConverter";
import { analyzeTireSizeOptions } from "@/lib/tires/wheelDiameterFilter";

export const runtime = "nodejs";
export const maxDuration = 30;

// ═══════════════════════════════════════════════════════════════════════════
// OEM TIRE SIZES NORMALIZATION (2026-05-13)
// Handles both string arrays and object arrays from DB
// ═══════════════════════════════════════════════════════════════════════════

type OemTireSizeObject = { 
  size?: string; 
  tireSize?: string;
  width?: number;
  aspectRatio?: number;
  diameter?: number;
};
type OemTireSizeRaw = string | OemTireSizeObject;

/**
 * Normalize oem_tire_sizes from DB to string array.
 * 
 * Handles:
 * - string arrays: ["275/65R18", "275/60R20"]
 * - object arrays with size: [{ size: "275/65R18" }]
 * - object arrays with tireSize: [{ tireSize: "275/65R18" }]
 * - object arrays with width/aspectRatio/diameter: [{ width: 255, aspectRatio: 55, diameter: 18 }]
 * - stringified JSON: "[\"275/65R18\"]" (parses and recurses)
 * - staggered objects: { front: ["245/40R19"], rear: ["275/35R19"] } (flattens)
 * - mixed arrays (defensive)
 * 
 * @param raw - Raw value from DB (unknown type)
 * @returns Normalized string array of tire sizes
 */
function normalizeOemTireSizes(raw: unknown): string[] {
  if (!raw) return [];
  
  // Handle stringified JSON (e.g., "[\"275/65R18\"]")
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return normalizeOemTireSizes(parsed);
    } catch {
      // Not valid JSON - might be a single tire size
      const trimmed = raw.trim();
      // Match standard tire sizes including ZR (e.g., 275/35ZR19, 275/35R19, P275/35R19)
      if (trimmed.match(/^P?\d{2,3}\/\d{2}Z?R\d{2}/i)) {
        return [trimmed];
      }
      console.warn("[tire-sizes] oem_tire_sizes is unparseable string:", raw);
      return [];
    }
  }
  
  // Handle staggered objects: { front: [...], rear: [...] }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as { front?: unknown; rear?: unknown };
    if (obj.front || obj.rear) {
      const frontSizes = normalizeOemTireSizes(obj.front);
      const rearSizes = normalizeOemTireSizes(obj.rear);
      return [...frontSizes, ...rearSizes];
    }
    console.warn("[tire-sizes] oem_tire_sizes is non-array object without front/rear:", raw);
    return [];
  }
  
  if (!Array.isArray(raw)) {
    console.warn("[tire-sizes] oem_tire_sizes is not an array:", typeof raw);
    return [];
  }
  
  const result: string[] = [];
  let malformedCount = 0;
  
  for (const item of raw as OemTireSizeRaw[]) {
    if (typeof item === "string") {
      // Already a string
      if (item.trim()) result.push(item.trim());
    } else if (item && typeof item === "object") {
      // Object with size or tireSize property
      const sizeValue = (item as OemTireSizeObject).size || (item as OemTireSizeObject).tireSize;
      if (typeof sizeValue === "string" && sizeValue.trim()) {
        result.push(sizeValue.trim());
        continue;
      }
      
      // Object with width/aspectRatio/diameter (GMC Envoy format)
      const typedItem = item as OemTireSizeObject;
      if (typedItem.width && typedItem.aspectRatio && typedItem.diameter) {
        const reconstructed = `${typedItem.width}/${typedItem.aspectRatio}R${typedItem.diameter}`;
        result.push(reconstructed);
        continue;
      }
      
      malformedCount++;
    } else if (item === null || item === undefined) {
      // Skip null/undefined entries silently
      continue;
    } else {
      malformedCount++;
    }
  }
  
  if (malformedCount > 0) {
    console.warn(`[tire-sizes] Skipped ${malformedCount} malformed oem_tire_sizes entries`);
  }
  
  return result;
}

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
  reason: "inconsistent_sizes" | "bmw_variant_clarification";
  availableTrims: Array<{
    modificationId: string;
    displayTrim: string;
    tireSizes: string[];
  }>;
  requestedTrim: string;
  // 2026-05-18: BMW variant clarification
  bmwVariantClarification?: {
    requestedTrim: string;
    variants: Array<{
      trim: string;
      tireSizes: string[];
      isStaggered: boolean;
      description: string;
    }>;
  };
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
      
      // Check for BMW variant clarification (2026-05-18)
      const bmwVariantInfo = (resolveResult.debug as any).bmwVariantClarification;
      
      return {
        blocked: true,
        reason: bmwVariantInfo ? "bmw_variant_clarification" : "inconsistent_sizes",
        availableTrims: resolveResult.debug.candidateTrims.map(c => ({
          modificationId: c.modificationId,
          displayTrim: c.atomicTrims[0], // Use first atomic trim for display
          tireSizes: c.tireSizes,
        })),
        requestedTrim: modification || trim || "",
        bmwVariantClarification: bmwVariantInfo,
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
        // Extract tire sizes for front and rear (with normalization for object arrays)
        const oemTireSizes = normalizeOemTireSizes(selectedFitment.oemTireSizes);
        let frontTire: string | undefined;
        let rearTire: string | undefined;
        
        if (oemTireSizes.length >= 2) {
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
    
    // Extract tire sizes from oem_tire_sizes JSON field (with normalization for object arrays)
    const oemTireSizes = normalizeOemTireSizes(selectedFitment.oemTireSizes);
    if (oemTireSizes.length === 0) {
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
// STATIC FALLBACK - DISABLED (2026-05-14)
// ═══════════════════════════════════════════════════════════════════════════
// 
// Static JSON fallback has been REMOVED for canonical source enforcement.
// All tire size lookups must go through vehicle_fitments via canonicalResolver.
// 
// If a vehicle is not in the database, we return an empty result and log it
// for gap tracking. This is intentional - we do not serve stale static data.
//

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
  // STEP 0: DISABLED (2026-05-14) - Config table removed for canonical enforcement
  // ═══════════════════════════════════════════════════════════════════════════
  // The vehicle_fitment_configurations table is DEPRECATED and no longer used
  // in customer-facing runtime. All fitment resolution goes through vehicle_fitments
  // via the canonical resolver.
  //
  // If you need config table data for admin/audit purposes, use /api/admin/* endpoints.

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: CANONICAL DB LOOKUP - vehicle_fitments via canonicalResolver
  // ═══════════════════════════════════════════════════════════════════════════
  if (!forceRefresh) {
    // Pass both modificationId and trim label for best resolution
    // 2026-05-13 FIX: When no explicit trim param, use modification as trim fallback
    // This handles frontend passing display labels (e.g., "LE") in modification param
    // Resolution order in resolver:
    //   1. Exact modification_id match (if modification matches a real ID like "manual_xxx")
    //   2. Exact displayTrim match using trim param
    //   3. Falls back to trying modification as displayTrim
    const trimForResolver = trimParam || modification || undefined;
    const dbFitment = await getDbFitmentSizes(year, make, model, modification, trimForResolver);
    
    // Check if fallback was BLOCKED due to inconsistent tire sizes across trims
    if (dbFitment && 'blocked' in dbFitment && dbFitment.blocked) {
      console.log(`[tire-sizes] BLOCKED RESPONSE: ${year} ${make} ${model} mod=${modification} → ${dbFitment.availableTrims.length} trims available`);
      
      // Return a response that tells the UI:
      // 1. We couldn't find the exact trim requested
      // 2. Different trims have different tire sizes
      // 3. Here are the available trims to choose from
      
      // 2026-05-18: Check for BMW variant clarification
      const isBmwVariantClarification = dbFitment.reason === "bmw_variant_clarification";
      const bmwVariants = dbFitment.bmwVariantClarification;
      
      const debugInfo: TireSizeDebugInfo = {
        // Scott's required audit fields
        requestedTrim: trimParam || null,
        normalizedRequestedTrim: modification || null,
        candidateTrims: isBmwVariantClarification && bmwVariants
          ? bmwVariants.variants.map(v => v.trim)
          : dbFitment.availableTrims.map(t => t.displayTrim),
        matchedTrim: null, // Not matched - fallback blocked
        matchedBy: null,
        modificationId: null,
        tireSizesFound: [],
        fallbackBlockedReason: isBmwVariantClarification
          ? `Multiple "${bmwVariants?.requestedTrim}" variants exist with different fitments.`
          : `Trim "${modification}" not found. ${dbFitment.availableTrims.length} trims exist with different tire sizes.`,
        // Additional context
        fitmentSource: "none",
        exactTrimMatch: false,
        sizeCount: 0,
        wheelDiametersAvailable: [],
        needsWheelSelection: false,
        reasonMultipleSizesShown: isBmwVariantClarification
          ? `Multiple "${bmwVariants?.requestedTrim}" variants exist - please specify which version.`
          : `Trim "${modification}" not found. ${dbFitment.availableTrims.length} trims exist with different tire sizes - please select your exact trim.`,
      };
      
      // Build clarification message for BMW variants
      let message = `The selected trim "${modification}" was not found. Different trims for this vehicle have different tire sizes. Please select your exact trim.`;
      if (isBmwVariantClarification && bmwVariants) {
        const variantDescriptions = bmwVariants.variants.map(v => `• ${v.trim}: ${v.description}`).join("\n");
        message = `I found multiple ${bmwVariants.requestedTrim} versions with different tire setups:\n${variantDescriptions}\nWhich one do you have?`;
      }
      
      return NextResponse.json({
        tireSizes: [],
        tireSizesStrict: [],
        tireSizesAgg: [],
        searchableSizes: [],
        sizeConversions: [],
        hasLegacySizes: false,
        source: isBmwVariantClarification ? "bmw_variant_clarification" : "trim_not_found",
        
        // NEW: Inform UI that trim selection is required
        trimResolutionRequired: true,
        trimNotFound: dbFitment.requestedTrim,
        availableTrims: isBmwVariantClarification && bmwVariants
          ? bmwVariants.variants.map(v => ({
              displayTrim: v.trim,
              tireSizes: v.tireSizes,
              isStaggered: v.isStaggered,
              description: v.description,
            }))
          : dbFitment.availableTrims,
        
        // 2026-05-18: BMW-specific variant clarification
        bmwVariantClarification: isBmwVariantClarification ? bmwVariants : undefined,
        
        message,
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
  // STEP 3: DISABLED (2026-05-14) - Static fallback removed for canonical enforcement
  // ═══════════════════════════════════════════════════════════════════════════
  // Static JSON fallback has been removed. If a vehicle is not in vehicle_fitments,
  // we return an empty result and log it for gap tracking.
  // This is intentional - we do not serve stale static data to customers.
  
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
      resolutionAttempts: ["canonical-resolver"],
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
