/**
 * Package Recommendation Engine
 * 
 * Generates curated wheel + tire packages for vehicles based on:
 * - Vehicle fitment data (bolt pattern, OEM sizes, offset range)
 * - Package categories (Daily Driver, Sport, Premium, Off-Road)
 * - Safety validation (diameter tolerance, offset safety)
 * 
 * SAFETY RULES (NEVER BYPASS):
 * - Overall diameter must be within ±3% of OEM
 * - Offset must be within safe range for vehicle
 * - Bolt pattern must match exactly
 */

import { listLocalFitments } from "@/lib/fitment-db/getFitment";
import { parseWheelSizes } from "@/lib/fitment-db/profileService";
import type { VehicleFitment } from "@/lib/fitment-db/schema";
import { getTechfeedCandidatesByBoltPattern, type TechfeedWheel } from "@/lib/techfeed/wheels";
import { getCachedBulk } from "@/lib/availabilityCache";

// ============================================================================
// Types
// ============================================================================

export type PackageCategory = 
  | "daily_driver"
  | "sport_aggressive" 
  | "premium_look"
  | "offroad_lifted";

export interface PackageWheel {
  sku: string;
  brand: string;
  model: string;
  finish?: string;
  diameter: number;
  width: number;
  offset: number;
  price: number;
  imageUrl: string | null;
  boltPattern: string;
  centerBore?: number;
}

export interface PackageTire {
  size: string;          // e.g., "275/55R20"
  brand: string;
  model: string;
  price: number;
  imageUrl: string | null;
  width: number;         // Section width in mm
  aspectRatio: number;   // e.g., 55
  rimDiameter: number;   // e.g., 20
}

export interface FitmentValidation {
  safe: boolean;
  notes: string[];
  overallDiameterChange?: number; // percentage
  offsetFromOEM?: number;         // mm difference
}

export interface RecommendedPackage {
  id: string;
  name: string;
  category: PackageCategory;
  categoryLabel: string;
  wheel: PackageWheel;
  tire: PackageTire;
  totalPrice: number;           // 4 wheels + 4 tires
  fitmentValidation: FitmentValidation;
  overallDiameter: number;      // in inches
  oemOverallDiameter: number;   // baseline for comparison
  offsetRange: { min: number; max: number };
  sizeSpec: string;             // e.g., "20x9 / 275/55R20"
  availability: "in_stock" | "limited" | "check_availability";
  score: number;                // For ranking
}

export interface PackageRecommendationResult {
  packages: RecommendedPackage[];
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string;
  };
  fitment: {
    boltPattern: string | null;
    oemDiameters: number[];
    oemTireSizes: string[];
    offsetRange: { min: number | null; max: number | null };
  };
  timing: {
    totalMs: number;
    fitmentMs: number;
    wheelsMs: number;
    packagesMs: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const PACKAGE_CONFIGS: Record<PackageCategory, {
  label: string;
  description: string;
  diameterOffset: number[];   // e.g., [0] for OEM, [1, 2] for plus-size
  preferredBrands: string[];  // Brand codes to prioritize
  tireType: "all_season" | "performance" | "all_terrain" | "any";
  priceRange: "value" | "mid" | "premium" | "any";
  offsetPreference: "oem" | "aggressive" | "any";
}> = {
  daily_driver: {
    label: "Daily Driver",
    description: "OEM-equivalent, all-season comfort",
    diameterOffset: [0],
    preferredBrands: ["KM", "MO", "AR", "HE"],
    tireType: "all_season",
    priceRange: "value",
    offsetPreference: "oem",
  },
  sport_aggressive: {
    label: "Sport / Aggressive",
    description: "Plus-size wheels, performance tires",
    diameterOffset: [1, 2],
    preferredBrands: ["FM", "XD", "MO", "NC"],
    tireType: "performance",
    priceRange: "mid",
    offsetPreference: "any",
  },
  premium_look: {
    label: "Premium Look",
    description: "Larger diameter, premium brands",
    diameterOffset: [2, 3],
    preferredBrands: ["FM", "XD", "NC", "VF"],
    tireType: "any",
    priceRange: "premium",
    offsetPreference: "any",
  },
  offroad_lifted: {
    label: "Off-Road / Lifted",
    description: "Aggressive offset, all-terrain tires",
    diameterOffset: [0, 1, 2],
    preferredBrands: ["FM", "XD", "MO", "FT"],
    tireType: "all_terrain",
    priceRange: "any",
    offsetPreference: "aggressive",
  },
};

// Brand tiers for scoring
const TIER_1_BRANDS = new Set(["FM", "FT", "MO", "XD", "KM", "RC", "AR"]);
const TIER_2_BRANDS = new Set(["HE", "VF", "PR", "LE", "DC", "NC", "UC"]);

// Vehicle type detection
const TRUCK_KEYWORDS = ["f-150", "f-250", "f-350", "silverado", "sierra", "ram", "titan", "tundra", "tacoma", "ranger", "colorado", "canyon", "frontier", "ridgeline"];
const SUV_KEYWORDS = ["explorer", "tahoe", "suburban", "yukon", "expedition", "4runner", "highlander", "pilot", "pathfinder", "armada", "sequoia", "durango", "grand cherokee", "wrangler", "bronco", "rav4", "cr-v", "cx-5", "tucson", "santa fe"];

// ============================================================================
// Core Engine Functions
// ============================================================================

/**
 * Get recommended packages for a vehicle
 */
export async function getRecommendedPackages(params: {
  year: number;
  make: string;
  model: string;
  trim?: string;
}): Promise<PackageRecommendationResult> {
  const t0 = Date.now();
  const timing = { totalMs: 0, fitmentMs: 0, wheelsMs: 0, packagesMs: 0 };

  const { year, make, model, trim } = params;

  // Step 1: Get fitment data
  const tFitment0 = Date.now();
  const fitmentData = await getVehicleFitment(year, make, model, trim);
  timing.fitmentMs = Date.now() - tFitment0;

  if (!fitmentData || !fitmentData.boltPattern) {
    return {
      packages: [],
      vehicle: { year, make, model, trim },
      fitment: {
        boltPattern: null,
        oemDiameters: [],
        oemTireSizes: [],
        offsetRange: { min: null, max: null },
      },
      timing: { ...timing, totalMs: Date.now() - t0 },
    };
  }

  // Step 2: Get candidate wheels from Techfeed
  const tWheels0 = Date.now();
  const candidateWheels = await getTechfeedCandidatesByBoltPattern(fitmentData.boltPattern);
  timing.wheelsMs = Date.now() - tWheels0;

  // Step 3: Detect vehicle type for category selection
  const vehicleType = detectVehicleType(model);

  // Step 4: Generate packages
  const tPackages0 = Date.now();
  const packages = await generatePackages({
    fitment: fitmentData,
    wheels: candidateWheels,
    vehicleType,
  });
  timing.packagesMs = Date.now() - tPackages0;

  timing.totalMs = Date.now() - t0;

  return {
    packages,
    vehicle: { year, make, model, trim },
    fitment: {
      boltPattern: fitmentData.boltPattern,
      oemDiameters: fitmentData.oemDiameters,
      oemTireSizes: fitmentData.oemTireSizes,
      offsetRange: fitmentData.offsetRange,
    },
    timing,
  };
}

// ============================================================================
// Internal Functions
// ============================================================================

interface ParsedFitment {
  boltPattern: string;
  centerBore: number | null;
  offsetRange: { min: number; max: number };
  oemDiameters: number[];
  oemWidths: number[];
  oemTireSizes: string[];
  oemOverallDiameter: number;
}

async function getVehicleFitment(
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<ParsedFitment | null> {
  const fitments = await listLocalFitments(year, make, model);
  
  if (fitments.length === 0) return null;

  // Pick best fitment (prefer matching trim)
  let bestFitment: VehicleFitment | null = null;
  
  if (trim) {
    bestFitment = fitments.find(f => 
      f.displayTrim.toLowerCase().includes(trim.toLowerCase()) ||
      f.modificationId.toLowerCase().includes(trim.toLowerCase())
    ) || null;
  }
  
  if (!bestFitment) {
    // Pick one with most data
    bestFitment = fitments.find(f => 
      f.boltPattern && 
      Array.isArray(f.oemTireSizes) && 
      f.oemTireSizes.length > 0
    ) || fitments[0];
  }

  if (!bestFitment || !bestFitment.boltPattern) return null;

  // Parse OEM wheel sizes (handles string formats like "8.5Jx18" from generation_template)
  const parsedWheelSizes = parseWheelSizes(bestFitment.oemWheelSizes);
  
  const oemDiameters = parsedWheelSizes
    .map((ws) => ws.diameter)
    .filter((d) => d > 0);
  
  const oemWidths = parsedWheelSizes
    .map((ws) => ws.width)
    .filter((w) => w > 0);

  // Parse OEM tire sizes
  const oemTireSizes = Array.isArray(bestFitment.oemTireSizes)
    ? bestFitment.oemTireSizes.filter((s: any) => typeof s === "string" && s.length > 0)
    : [];

  // Calculate OEM overall diameter (from first tire size)
  let oemOverallDiameter = 28; // fallback
  if (oemTireSizes.length > 0) {
    const parsed = parseTireSize(oemTireSizes[0]);
    if (parsed) {
      oemOverallDiameter = calculateOverallDiameter(
        parsed.width,
        parsed.aspectRatio,
        parsed.rimDiameter
      );
    }
  }

  // Offset range
  const offsetMin = bestFitment.offsetMinMm != null ? Number(bestFitment.offsetMinMm) : 20;
  const offsetMax = bestFitment.offsetMaxMm != null ? Number(bestFitment.offsetMaxMm) : 50;

  return {
    boltPattern: bestFitment.boltPattern,
    centerBore: bestFitment.centerBoreMm != null ? Number(bestFitment.centerBoreMm) : null,
    offsetRange: { min: offsetMin, max: offsetMax },
    oemDiameters: oemDiameters.length > 0 ? oemDiameters : [17],
    oemWidths: oemWidths.length > 0 ? oemWidths : [7.5],
    oemTireSizes,
    oemOverallDiameter,
  };
}

function detectVehicleType(model: string): "truck" | "suv" | "car" {
  const modelLower = model.toLowerCase();
  
  if (TRUCK_KEYWORDS.some(k => modelLower.includes(k))) return "truck";
  if (SUV_KEYWORDS.some(k => modelLower.includes(k))) return "suv";
  return "car";
}

async function generatePackages(opts: {
  fitment: ParsedFitment;
  wheels: TechfeedWheel[];
  vehicleType: "truck" | "suv" | "car";
}): Promise<RecommendedPackage[]> {
  const { fitment, wheels, vehicleType } = opts;
  const packages: RecommendedPackage[] = [];

  // Determine which categories to generate
  const categories: PackageCategory[] = vehicleType === "car"
    ? ["daily_driver", "sport_aggressive", "premium_look"]
    : ["daily_driver", "sport_aggressive", "premium_look", "offroad_lifted"];

  // Get baseline OEM diameter
  const baseOemDiameter = Math.max(...fitment.oemDiameters, 17);

  for (const category of categories) {
    const config = PACKAGE_CONFIGS[category];
    
    // Target diameters for this category
    const targetDiameters = config.diameterOffset.map(off => baseOemDiameter + off);

    // Find best wheel for this category
    const bestWheel = findBestWheel(wheels, {
      targetDiameters,
      preferredBrands: config.preferredBrands,
      offsetRange: fitment.offsetRange,
      offsetPreference: config.offsetPreference,
      priceRange: config.priceRange,
    });

    if (!bestWheel) continue;

    // Find matching tire
    const tire = findMatchingTire(bestWheel, fitment, config.tireType);
    if (!tire) continue;

    // Calculate overall diameter
    const overallDiameter = calculateOverallDiameter(
      tire.width,
      tire.aspectRatio,
      tire.rimDiameter
    );

    // Validate fitment
    const validation = validateFitment(
      overallDiameter,
      fitment.oemOverallDiameter,
      Number(bestWheel.offset || 0),
      fitment.offsetRange
    );

    // Skip unsafe packages
    if (!validation.safe) continue;

    // Calculate total price (4 wheels + 4 tires)
    const totalPrice = (bestWheel.price * 4) + (tire.price * 4);

    // Score the package
    const score = scorePackage({
      wheel: bestWheel,
      tire,
      validation,
      category,
    });

    const pkg: RecommendedPackage = {
      id: `${category}-${bestWheel.sku}`,
      name: config.label,
      category,
      categoryLabel: config.label,
      wheel: {
        sku: bestWheel.sku,
        brand: bestWheel.brand_desc || bestWheel.brand_cd || "Unknown",
        model: bestWheel.style || bestWheel.display_style_no || "Wheel",
        finish: bestWheel.abbreviated_finish_desc || bestWheel.fancy_finish_desc,
        diameter: Number(bestWheel.diameter),
        width: Number(bestWheel.width),
        offset: Number(bestWheel.offset || 0),
        price: bestWheel.price,
        imageUrl: bestWheel.images?.[0] || null,
        boltPattern: fitment.boltPattern,
        centerBore: bestWheel.centerbore ? Number(bestWheel.centerbore) : undefined,
      },
      tire,
      totalPrice: Math.round(totalPrice * 100) / 100,
      fitmentValidation: validation,
      overallDiameter: Math.round(overallDiameter * 10) / 10,
      oemOverallDiameter: Math.round(fitment.oemOverallDiameter * 10) / 10,
      offsetRange: fitment.offsetRange,
      sizeSpec: `${bestWheel.diameter}x${bestWheel.width} / ${tire.size}`,
      availability: "check_availability", // Will be updated with cached availability
      score,
    };

    packages.push(pkg);
  }

  // Check cached availability for all packages
  const wheelSkus = packages.map(p => p.wheel.sku);
  if (wheelSkus.length > 0) {
    const cachedAvail = await getCachedBulk(wheelSkus, 4);
    
    for (const pkg of packages) {
      const cached = cachedAvail.get(pkg.wheel.sku);
      if (cached?.ok) {
        const totalStock = (cached.localQty || 0) + (cached.globalQty || 0);
        if (totalStock >= 8) {
          pkg.availability = "in_stock";
        } else if (totalStock >= 4) {
          pkg.availability = "limited";
        }
      }
    }
  }

  // Sort by score and limit to 6 packages
  packages.sort((a, b) => b.score - a.score);
  return packages.slice(0, 6);
}

interface WheelSearchCriteria {
  targetDiameters: number[];
  preferredBrands: string[];
  offsetRange: { min: number; max: number };
  offsetPreference: "oem" | "aggressive" | "any";
  priceRange: "value" | "mid" | "premium" | "any";
}

interface ScoredWheel extends TechfeedWheel {
  price: number;
  score: number;
}

function findBestWheel(
  wheels: TechfeedWheel[],
  criteria: WheelSearchCriteria
): ScoredWheel | null {
  const scored: ScoredWheel[] = [];

  for (const wheel of wheels) {
    const diameter = Number(wheel.diameter || 0);
    const offset = Number(wheel.offset || 0);
    const price = Number(wheel.map_price || wheel.msrp || 0);
    
    // Skip if missing critical data
    if (!diameter || !price || price <= 0) continue;

    // Skip if diameter doesn't match targets
    if (!criteria.targetDiameters.includes(diameter)) continue;

    // Skip if offset is unsafe
    if (offset < criteria.offsetRange.min || offset > criteria.offsetRange.max) continue;

    // Calculate score
    let score = 50;

    // Brand scoring
    const brandCode = (wheel.brand_cd || "").toUpperCase();
    if (criteria.preferredBrands.includes(brandCode)) {
      score += 20;
    }
    if (TIER_1_BRANDS.has(brandCode)) {
      score += 15;
    } else if (TIER_2_BRANDS.has(brandCode)) {
      score += 10;
    }

    // Price range scoring
    if (criteria.priceRange === "value" && price < 200) {
      score += 15;
    } else if (criteria.priceRange === "mid" && price >= 200 && price <= 400) {
      score += 15;
    } else if (criteria.priceRange === "premium" && price > 300) {
      score += 15;
    }

    // Offset preference scoring
    const offsetMid = (criteria.offsetRange.min + criteria.offsetRange.max) / 2;
    if (criteria.offsetPreference === "oem") {
      // Prefer offset near OEM range midpoint
      const offsetDiff = Math.abs(offset - offsetMid);
      if (offsetDiff <= 5) score += 15;
      else if (offsetDiff <= 10) score += 10;
    } else if (criteria.offsetPreference === "aggressive") {
      // Prefer lower offset (more aggressive stance)
      if (offset <= criteria.offsetRange.min + 10) {
        score += 15;
      }
    }

    // Image availability bonus
    if (wheel.images && wheel.images.length > 0) {
      score += 10;
    }

    scored.push({ ...wheel, price, score });
  }

  // Sort by score and return best
  scored.sort((a, b) => b.score - a.score);
  return scored[0] || null;
}

function findMatchingTire(
  wheel: ScoredWheel,
  fitment: ParsedFitment,
  tireType: "all_season" | "performance" | "all_terrain" | "any"
): PackageTire | null {
  const wheelDiameter = Number(wheel.diameter);
  const wheelWidth = Number(wheel.width);

  // Look for OEM tire size with matching diameter
  const matchingOemSize = fitment.oemTireSizes.find(size => {
    const parsed = parseTireSize(size);
    return parsed && parsed.rimDiameter === wheelDiameter;
  });

  if (matchingOemSize) {
    const parsed = parseTireSize(matchingOemSize)!;
    return {
      size: matchingOemSize,
      brand: "TBD", // Will be filled by tire search
      model: tireType === "all_terrain" ? "All-Terrain" : "All-Season",
      price: estimateTirePrice(parsed.rimDiameter, tireType),
      imageUrl: null,
      width: parsed.width,
      aspectRatio: parsed.aspectRatio,
      rimDiameter: parsed.rimDiameter,
    };
  }

  // Calculate recommended tire size for plus-sizing
  // Maintain overall diameter within 3%
  const targetOverallDiameter = fitment.oemOverallDiameter;
  
  // Common tire widths based on wheel width
  const recommendedTireWidth = Math.round((wheelWidth * 25.4) + 20); // Approx 20mm wider than rim
  
  // Calculate aspect ratio to maintain diameter
  // Overall Diameter = (2 * (width * aspect / 100 / 25.4)) + rim diameter
  // Solving for aspect ratio:
  const sidewallHeight = (targetOverallDiameter - wheelDiameter) / 2;
  const aspectRatio = Math.round((sidewallHeight * 25.4 * 100) / recommendedTireWidth);

  // Snap to common aspect ratios
  const commonAspects = [30, 35, 40, 45, 50, 55, 60, 65, 70];
  const snappedAspect = commonAspects.reduce((prev, curr) => 
    Math.abs(curr - aspectRatio) < Math.abs(prev - aspectRatio) ? curr : prev
  );

  // Snap to common widths
  const commonWidths = [205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315, 325];
  const snappedWidth = commonWidths.reduce((prev, curr) =>
    Math.abs(curr - recommendedTireWidth) < Math.abs(prev - recommendedTireWidth) ? curr : prev
  );

  const tireSize = `${snappedWidth}/${snappedAspect}R${wheelDiameter}`;

  return {
    size: tireSize,
    brand: "TBD",
    model: tireType === "all_terrain" ? "All-Terrain" : tireType === "performance" ? "Performance" : "All-Season",
    price: estimateTirePrice(wheelDiameter, tireType),
    imageUrl: null,
    width: snappedWidth,
    aspectRatio: snappedAspect,
    rimDiameter: wheelDiameter,
  };
}

function parseTireSize(size: string): { width: number; aspectRatio: number; rimDiameter: number } | null {
  // Handle standard metric: 265/70R17, P265/70R17, 265/70ZR17
  const match = size.match(/^[P]?(\d{3})\/(\d{2,3})[A-Z]*R(\d{2})/i);
  if (match) {
    return {
      width: parseInt(match[1], 10),
      aspectRatio: parseInt(match[2], 10),
      rimDiameter: parseInt(match[3], 10),
    };
  }
  
  // Handle flotation: 35x12.50R22
  const flotationMatch = size.match(/^(\d{2,3})[xX](\d+\.?\d*)R(\d{2})/);
  if (flotationMatch) {
    const overallDiameterInches = parseFloat(flotationMatch[1]);
    const sectionWidthInches = parseFloat(flotationMatch[2]);
    const rimDiameter = parseInt(flotationMatch[3], 10);
    
    return {
      width: Math.round(sectionWidthInches * 25.4),
      aspectRatio: Math.round(((overallDiameterInches - rimDiameter) / 2 / sectionWidthInches) * 100),
      rimDiameter,
    };
  }

  return null;
}

function calculateOverallDiameter(
  tireWidth: number,      // mm
  aspectRatio: number,    // percent
  rimDiameter: number     // inches
): number {
  // Sidewall height = width * aspect ratio
  const sidewallMm = tireWidth * (aspectRatio / 100);
  const sidewallInches = sidewallMm / 25.4;
  
  // Overall diameter = rim + 2 * sidewall
  return rimDiameter + (2 * sidewallInches);
}

function validateFitment(
  overallDiameter: number,
  oemOverallDiameter: number,
  wheelOffset: number,
  oemOffsetRange: { min: number; max: number }
): FitmentValidation {
  const notes: string[] = [];
  let safe = true;

  // Check overall diameter (±3% tolerance)
  const diameterChange = ((overallDiameter - oemOverallDiameter) / oemOverallDiameter) * 100;
  
  if (Math.abs(diameterChange) > 3) {
    safe = false;
    notes.push(`Overall diameter ${diameterChange > 0 ? "increased" : "decreased"} by ${Math.abs(diameterChange).toFixed(1)}% (max ±3%)`);
  } else if (Math.abs(diameterChange) > 1.5) {
    notes.push(`Overall diameter change: ${diameterChange > 0 ? "+" : ""}${diameterChange.toFixed(1)}%`);
  }

  // Check offset
  const offsetMid = (oemOffsetRange.min + oemOffsetRange.max) / 2;
  const offsetDiff = wheelOffset - offsetMid;

  if (wheelOffset < oemOffsetRange.min - 5 || wheelOffset > oemOffsetRange.max + 5) {
    safe = false;
    notes.push(`Offset ${wheelOffset}mm is outside safe range (${oemOffsetRange.min}-${oemOffsetRange.max}mm)`);
  } else if (wheelOffset < oemOffsetRange.min || wheelOffset > oemOffsetRange.max) {
    notes.push(`Offset ${wheelOffset}mm is at the edge of safe range`);
  }

  if (safe && notes.length === 0) {
    notes.push("Perfect fitment - within all OEM specifications");
  }

  return {
    safe,
    notes,
    overallDiameterChange: Math.round(diameterChange * 10) / 10,
    offsetFromOEM: Math.round(offsetDiff),
  };
}

function estimateTirePrice(rimDiameter: number, tireType: string): number {
  // Base price by diameter
  let basePrice = 100;
  if (rimDiameter >= 22) basePrice = 280;
  else if (rimDiameter >= 20) basePrice = 220;
  else if (rimDiameter >= 18) basePrice = 160;
  else if (rimDiameter >= 17) basePrice = 140;

  // Adjust by type
  if (tireType === "performance") basePrice *= 1.3;
  else if (tireType === "all_terrain") basePrice *= 1.2;

  return Math.round(basePrice);
}

function scorePackage(opts: {
  wheel: ScoredWheel;
  tire: PackageTire;
  validation: FitmentValidation;
  category: PackageCategory;
}): number {
  let score = opts.wheel.score || 50;

  // Safety bonus
  if (opts.validation.safe) {
    score += 20;
  }

  // Lower diameter change is better
  const diamChange = Math.abs(opts.validation.overallDiameterChange || 0);
  if (diamChange < 1) score += 15;
  else if (diamChange < 2) score += 10;
  else if (diamChange < 3) score += 5;

  // Image availability
  if (opts.wheel.images && opts.wheel.images.length > 0) {
    score += 10;
  }

  return score;
}

// ============================================================================
// Exports
// ============================================================================

export { PACKAGE_CONFIGS };
