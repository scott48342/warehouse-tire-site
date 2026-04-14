/**
 * Vehicle-Aware Tire Recommendation Engine
 * 
 * Generates conversion-focused recommendations using:
 * - Vehicle context (make, model)
 * - Tire attributes (warranty, category, features)
 * - Popularity signals (when available)
 * 
 * DESIGN PRINCIPLES:
 * - Feel personal and vehicle-specific
 * - Help users decide faster with confidence
 * - One label per tire (no badge clutter)
 * - Short, human reasons (not marketing fluff)
 * 
 * @created 2026-04-14
 */

// ============================================================================
// TYPES
// ============================================================================

export type RecommendationType = 
  | "best-for-vehicle"
  | "most-popular"
  | "longest-lasting"
  | "all-weather-confidence";

export interface TireForRecommendation {
  sku: string;
  brand?: string;
  model?: string;
  displayName?: string;
  price?: number | null;
  stock?: number;
  category?: string | null;
  mileageWarranty?: number | null;
  is3PMSF?: boolean;
  isRunFlat?: boolean;
  imageUrl?: string | null;
  // Popularity signals (if available)
  popularityRank?: number | null;
  addToCartCount?: number;
  isTrending?: boolean;
}

export interface VehicleContext {
  year?: string | number;
  make?: string;
  model?: string;
  trim?: string;
}

export interface TireRecommendation {
  type: RecommendationType;
  label: string;
  reason: string;
  tire: TireForRecommendation;
  confidence: "high" | "medium" | "low";
}

export interface RecommendationSet {
  recommendations: TireRecommendation[];
  vehicleLabel: string | null;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const PREMIUM_BRANDS = [
  'michelin', 'bridgestone', 'continental', 'goodyear', 'pirelli'
];

const MID_TIER_BRANDS = [
  'cooper', 'toyo', 'bfgoodrich', 'yokohama', 'hankook', 
  'falken', 'general', 'kumho', 'nexen', 'nitto', 'firestone'
];

// Categories that qualify for all-weather confidence recommendation
const ALL_WEATHER_CATEGORIES = [
  'all-weather', 'winter', 'snow'
];

// Minimum warranty for "Longest Lasting" consideration
const MIN_LONGEVITY_WARRANTY = 60000;
const STRONG_LONGEVITY_WARRANTY = 80000;

// ============================================================================
// VEHICLE TYPE CLASSIFICATION
// ============================================================================

export type VehicleType = 
  | "sedan"
  | "coupe" 
  | "hatchback"
  | "crossover"
  | "suv"
  | "truck"
  | "offroad"
  | "performance"
  | "van"
  | "unknown";

export interface VehicleProfile {
  type: VehicleType;
  isPerformanceOriented: boolean;
  isOffroadCapable: boolean;
  allowedCategories: string[];
  excludedCategories: string[];
  preferredReasonStyle: "sedan" | "truck" | "suv" | "offroad" | "performance" | "default";
}

// Model patterns for vehicle classification
const SEDAN_MODELS = [
  'camry', 'accord', 'civic', 'corolla', 'altima', 'sentra', 'maxima',
  'malibu', 'impala', 'cruze', 'sonata', 'elantra', 'optima', 'k5',
  'mazda3', 'mazda6', 'jetta', 'passat', 'a3', 'a4', 'a6', 'a8',
  '3 series', '320', '328', '330', '340', '5 series', '7 series',
  'c-class', 'c300', 'e-class', 's-class', 'cts', 'ct4', 'ct5', 'ats',
  'xts', 'dts', 'es', 'is', 'gs', 'ls', 'genesis', 'g70', 'g80', 'g90',
  'giulia', 'ghibli', 'quattroporte', 'charger', '300', 'taurus', 'fusion',
  'avalon', 'legacy', 'impreza', 'insight', 'clarity', 'prius',
];

const COUPE_MODELS = [
  'mustang', 'camaro', 'challenger', 'corvette', '370z', '350z', 'nissan z',
  'supra', 'brz', '86', 'gr86', 'miata', 'mx-5', 'tt', 'a5', 'rc',
  'm2', 'm4', 'c63', 'amg gt', '911', 'cayman', 'boxster',
];

const PERFORMANCE_TRIMS = [
  'gt', 'gt-line', 'sport', 'r/t', 'srt', 'ss', 'rs', 'si', 'type r', 'type s',
  'sti', 'wrx', 'nismo', 'trd', 'n line', 'n', 'amg', 'm sport', 'm',
  's-line', 'aspec', 'f sport', 'gt350', 'gt500', 'shelby', 'hellcat',
  'scat pack', 'redeye', 'demon', 'zl1', 'z06', 'zr1', 'dark horse',
];

const CROSSOVER_MODELS = [
  'rav4', 'cr-v', 'crv', 'cx-5', 'cx5', 'cx-30', 'cx30', 'cx-50', 'tucson',
  'sportage', 'rogue', 'murano', 'pathfinder', 'escape', 'edge', 'bronco sport',
  'equinox', 'terrain', 'blazer', 'trailblazer', 'trax', 'encore', 'envision',
  'outback', 'forester', 'crosstrek', 'ascent', 'tiguan', 'atlas cross sport',
  'q3', 'q5', 'x1', 'x3', 'glc', 'gla', 'nx', 'rx', 'ux', 'rdx', 'mdx',
  'macan', 'e-pace', 'f-pace', 'xc40', 'xc60', 'santa fe', 'sorento',
  'telluride', 'palisade', 'pilot', 'passport', 'highlander', 'venza',
  'cherokee', 'grand cherokee l', 'compass', 'seltos', 'kona', 'venue',
  'kicks', 'hr-v', 'hrv', 'ch-r', 'eclipse cross', 'outlander',
];

const SUV_MODELS = [
  'tahoe', 'suburban', 'yukon', 'escalade', 'expedition', 'navigator',
  'sequoia', 'land cruiser', 'armada', 'qx80', 'qx60', 'gx', 'lx',
  'x5', 'x7', 'gle', 'gls', 'q7', 'q8', 'cayenne', 'range rover',
  'defender', 'discovery', 'durango', 'grand cherokee', 'atlas', 'xc90',
];

const TRUCK_MODELS = [
  'f-150', 'f150', 'f-250', 'f250', 'f-350', 'f350', 'f-450',
  'silverado', 'sierra', 'ram 1500', 'ram 2500', 'ram 3500', 'ram',
  'tundra', 'tacoma', 'titan', 'frontier', 'colorado', 'canyon',
  'ranger', 'maverick', 'ridgeline', 'gladiator', 'santa cruz',
];

const OFFROAD_MODELS = [
  'wrangler', '4runner', 'bronco', 'defender', 'land cruiser',
  'fj cruiser', 'xterra', 'hummer',
];

const OFFROAD_TRIMS = [
  'trd pro', 'trd off-road', 'trail', 'trailhawk', 'rubicon', 'mojave',
  'raptor', 'tremor', 'at4', 'at4x', 'trail boss', 'zr2', 'bison',
  'wildtrak', 'badlands', 'sasquatch', 'willys', 'wilderness',
];

const VAN_MODELS = [
  'sienna', 'odyssey', 'pacifica', 'carnival', 'sedona', 'grand caravan',
  'transit', 'sprinter', 'promaster', 'metris', 'nv', 'express', 'savana',
];

/**
 * Determine the vehicle type/profile for recommendation filtering
 */
export function getVehicleProfile(vehicle?: VehicleContext | null): VehicleProfile {
  const defaultProfile: VehicleProfile = {
    type: "unknown",
    isPerformanceOriented: false,
    isOffroadCapable: false,
    allowedCategories: [], // Empty = allow all
    excludedCategories: [],
    preferredReasonStyle: "default",
  };

  if (!vehicle?.model) return defaultProfile;

  const modelLower = (vehicle.model || '').toLowerCase();
  const trimLower = (vehicle.trim || '').toLowerCase();
  const makeLower = (vehicle.make || '').toLowerCase();

  // Check for performance trims first (affects any vehicle type)
  const isPerformanceTrim = PERFORMANCE_TRIMS.some(t => 
    trimLower.includes(t) || modelLower.includes(t)
  );

  // Check for off-road trims
  const isOffroadTrim = OFFROAD_TRIMS.some(t => 
    trimLower.includes(t) || modelLower.includes(t)
  );

  // Determine vehicle type
  let type: VehicleType = "unknown";

  // Check in order of specificity
  if (VAN_MODELS.some(m => modelLower.includes(m))) {
    type = "van";
  } else if (OFFROAD_MODELS.some(m => modelLower.includes(m)) || isOffroadTrim) {
    type = "offroad";
  } else if (TRUCK_MODELS.some(m => modelLower.includes(m))) {
    type = "truck";
  } else if (COUPE_MODELS.some(m => modelLower.includes(m))) {
    type = isPerformanceTrim ? "performance" : "coupe";
  } else if (SUV_MODELS.some(m => modelLower.includes(m))) {
    type = "suv";
  } else if (CROSSOVER_MODELS.some(m => modelLower.includes(m))) {
    type = "crossover";
  } else if (SEDAN_MODELS.some(m => modelLower.includes(m))) {
    type = isPerformanceTrim ? "performance" : "sedan";
  }

  // Build profile based on type
  return buildProfileForType(type, isPerformanceTrim, isOffroadTrim);
}

function buildProfileForType(
  type: VehicleType, 
  isPerformanceTrim: boolean,
  isOffroadTrim: boolean
): VehicleProfile {
  switch (type) {
    case "sedan":
    case "coupe":
    case "hatchback":
      return {
        type,
        isPerformanceOriented: isPerformanceTrim,
        isOffroadCapable: false,
        allowedCategories: [
          'all-season', 'touring', 'highway', 'grand touring',
          'performance', 'ultra high performance', 'summer',
          'all-weather', 'winter',
        ],
        excludedCategories: [
          'all-terrain', 'mud-terrain', 'rugged-terrain', 
          'mud', 'off-road', 'a/t', 'm/t', 'r/t',
        ],
        preferredReasonStyle: isPerformanceTrim ? "performance" : "sedan",
      };

    case "performance":
      return {
        type,
        isPerformanceOriented: true,
        isOffroadCapable: false,
        allowedCategories: [
          'performance', 'ultra high performance', 'summer',
          'max performance', 'extreme performance',
          'all-season', 'high performance all-season',
        ],
        excludedCategories: [
          'all-terrain', 'mud-terrain', 'rugged-terrain',
          'mud', 'off-road', 'a/t', 'm/t', 'r/t',
          'touring', // Performance cars shouldn't get touring as primary
        ],
        preferredReasonStyle: "performance",
      };

    case "crossover":
      return {
        type,
        isPerformanceOriented: isPerformanceTrim,
        isOffroadCapable: isOffroadTrim,
        allowedCategories: [
          'all-season', 'touring', 'highway', 'crossover/suv touring',
          'all-weather', 'winter',
          // Light all-terrain only if off-road trim
          ...(isOffroadTrim ? ['all-terrain', 'crossover/suv'] : []),
        ],
        excludedCategories: isOffroadTrim ? [] : [
          'mud-terrain', 'rugged-terrain', 'mud', 'm/t',
          // Exclude aggressive all-terrain for non-offroad trims
          ...(!isOffroadTrim ? ['all-terrain', 'a/t'] : []),
        ],
        preferredReasonStyle: "suv",
      };

    case "suv":
      return {
        type,
        isPerformanceOriented: isPerformanceTrim,
        isOffroadCapable: isOffroadTrim,
        allowedCategories: [
          'all-season', 'touring', 'highway', 'crossover/suv touring',
          'all-weather', 'winter', 'all-terrain', 'crossover/suv',
        ],
        excludedCategories: isOffroadTrim ? [] : [
          'mud-terrain', 'rugged-terrain', 'mud', 'm/t',
        ],
        preferredReasonStyle: "suv",
      };

    case "truck":
      return {
        type,
        isPerformanceOriented: false,
        isOffroadCapable: isOffroadTrim,
        allowedCategories: [
          'highway', 'all-season', 'all-terrain', 
          'light truck', 'commercial', 'touring',
          ...(isOffroadTrim ? ['mud-terrain', 'rugged-terrain'] : []),
        ],
        excludedCategories: isOffroadTrim ? [] : [
          // Don't exclude all-terrain for trucks, but don't force it either
          'mud-terrain', 'rugged-terrain', 'mud', 'm/t',
        ],
        preferredReasonStyle: "truck",
      };

    case "offroad":
      return {
        type,
        isPerformanceOriented: false,
        isOffroadCapable: true,
        allowedCategories: [
          'all-terrain', 'mud-terrain', 'rugged-terrain',
          'all-season', 'highway', 'a/t', 'm/t', 'r/t',
        ],
        excludedCategories: [],
        preferredReasonStyle: "offroad",
      };

    case "van":
      return {
        type,
        isPerformanceOriented: false,
        isOffroadCapable: false,
        allowedCategories: [
          'all-season', 'touring', 'highway', 'passenger',
          'all-weather', 'winter',
        ],
        excludedCategories: [
          'all-terrain', 'mud-terrain', 'rugged-terrain',
          'performance', 'mud', 'off-road', 'a/t', 'm/t',
        ],
        preferredReasonStyle: "sedan",
      };

    default:
      // Unknown - be conservative, allow road tires
      return {
        type: "unknown",
        isPerformanceOriented: isPerformanceTrim,
        isOffroadCapable: isOffroadTrim,
        allowedCategories: [], // Allow all
        excludedCategories: [], // Exclude none
        preferredReasonStyle: "default",
      };
  }
}

/**
 * Check if a tire category is appropriate for the vehicle profile
 */
export function isCategoryAllowedForVehicle(
  category: string | null | undefined,
  profile: VehicleProfile
): boolean {
  if (!category) return true; // No category = allow
  
  const categoryLower = category.toLowerCase();

  // Check exclusions first (takes priority)
  if (profile.excludedCategories.length > 0) {
    for (const excluded of profile.excludedCategories) {
      if (categoryLower.includes(excluded.toLowerCase())) {
        return false;
      }
    }
  }

  // If no allowed list, everything not excluded is allowed
  if (profile.allowedCategories.length === 0) {
    return true;
  }

  // Check if category matches any allowed
  for (const allowed of profile.allowedCategories) {
    if (categoryLower.includes(allowed.toLowerCase())) {
      return true;
    }
  }

  // Default: if we have an allowed list and didn't match, exclude
  // But be lenient - if category is vague, allow it
  if (categoryLower.length < 5 || categoryLower === 'other') {
    return true;
  }

  return false;
}

// ============================================================================
// VEHICLE-AWARE REASON GENERATORS
// ============================================================================

const REASON_TEMPLATES: Record<VehicleProfile["preferredReasonStyle"], {
  comfort: string;
  durability: string;
  allAround: string;
  performance: string;
}> = {
  sedan: {
    comfort: "Smooth, quiet ride for daily driving",
    durability: "Excellent tread life for commuters",
    allAround: "Balanced comfort and all-season confidence",
    performance: "Responsive handling with everyday comfort",
  },
  truck: {
    comfort: "Quiet highway ride with strong durability",
    durability: "Built tough for work and daily driving",
    allAround: "Dependable performance for any job",
    performance: "Confident towing and hauling capability",
  },
  suv: {
    comfort: "Comfortable ride with year-round confidence",
    durability: "Long-lasting performance for family miles",
    allAround: "Versatile grip in any weather",
    performance: "Sure-footed handling for your adventures",
  },
  offroad: {
    comfort: "Capable on trails with civilized road manners",
    durability: "Rugged construction for tough terrain",
    allAround: "Confident traction on and off the road",
    performance: "Aggressive grip when you need it most",
  },
  performance: {
    comfort: "Precision handling without sacrificing comfort",
    durability: "Track-ready grip with street durability",
    allAround: "Exhilarating performance, rain or shine",
    performance: "Maximum grip for spirited driving",
  },
  default: {
    comfort: "Smooth ride and great tread life",
    durability: "Built for the long haul",
    allAround: "Dependable all-season performance",
    performance: "Responsive handling you can trust",
  },
};

/**
 * Get a vehicle-appropriate reason line
 */
export function getVehicleAwareReason(
  profile: VehicleProfile,
  reasonType: "comfort" | "durability" | "allAround" | "performance",
  tire?: TireForRecommendation
): string {
  const templates = REASON_TEMPLATES[profile.preferredReasonStyle] || REASON_TEMPLATES.default;
  let reason = templates[reasonType];

  // Add warranty mention if notable
  if (tire?.mileageWarranty && tire.mileageWarranty >= 60000) {
    const k = Math.round(tire.mileageWarranty / 1000);
    if (reasonType === "durability") {
      reason = `Up to ${k},000-mile warranty`;
    }
  }

  return reason;
}

// ============================================================================
// MAIN RECOMMENDATION GENERATOR
// ============================================================================

/**
 * Generate vehicle-aware tire recommendations
 * 
 * @param tires - Array of tires to recommend from
 * @param vehicle - Vehicle context for personalization
 * @param maxRecommendations - Max recommendations to return (default: 3)
 * @returns Recommendation set with vehicle-personalized labels
 */
export function generateTireRecommendations(
  tires: TireForRecommendation[],
  vehicle?: VehicleContext | null,
  maxRecommendations: number = 3
): RecommendationSet {
  if (!tires || tires.length < 2) {
    return { recommendations: [], vehicleLabel: null };
  }

  const vehicleLabel = formatVehicleLabel(vehicle);
  const recommendations: TireRecommendation[] = [];
  const usedSkus = new Set<string>();
  const usedBrands = new Set<string>();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. BEST FOR YOUR VEHICLE - Primary recommendation
  // ═══════════════════════════════════════════════════════════════════════════
  const bestForVehicle = findBestForVehicle(tires, usedSkus, usedBrands, vehicle);
  if (bestForVehicle) {
    usedSkus.add(bestForVehicle.sku);
    if (bestForVehicle.brand) usedBrands.add(bestForVehicle.brand.toLowerCase());
    
    recommendations.push({
      type: "best-for-vehicle",
      label: vehicleLabel ? `Best for Your ${vehicleLabel}` : "Best for Your Vehicle",
      reason: generateBestForVehicleReason(bestForVehicle, vehicle),
      tire: bestForVehicle,
      confidence: "high",
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. MOST POPULAR CHOICE - Social proof
  // ═══════════════════════════════════════════════════════════════════════════
  if (recommendations.length < maxRecommendations) {
    const mostPopular = findMostPopular(tires, usedSkus, usedBrands);
    if (mostPopular) {
      usedSkus.add(mostPopular.sku);
      if (mostPopular.brand) usedBrands.add(mostPopular.brand.toLowerCase());
      
      recommendations.push({
        type: "most-popular",
        label: "Most Popular Choice",
        reason: generatePopularReason(mostPopular),
        tire: mostPopular,
        confidence: mostPopular.addToCartCount && mostPopular.addToCartCount >= 5 ? "high" : "medium",
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. LONGEST LASTING - Mileage/durability
  // ═══════════════════════════════════════════════════════════════════════════
  if (recommendations.length < maxRecommendations) {
    const longestLasting = findLongestLasting(tires, usedSkus, usedBrands);
    if (longestLasting) {
      usedSkus.add(longestLasting.sku);
      if (longestLasting.brand) usedBrands.add(longestLasting.brand.toLowerCase());
      
      const warrantyK = Math.round((longestLasting.mileageWarranty || 0) / 1000);
      recommendations.push({
        type: "longest-lasting",
        label: "Longest Lasting",
        reason: `Up to ${warrantyK},000-mile warranty`,
        tire: longestLasting,
        confidence: (longestLasting.mileageWarranty || 0) >= STRONG_LONGEVITY_WARRANTY ? "high" : "medium",
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ALL-WEATHER CONFIDENCE (Optional) - Only when clearly applicable
  // ═══════════════════════════════════════════════════════════════════════════
  if (recommendations.length < maxRecommendations && recommendations.length < 4) {
    const allWeather = findAllWeatherConfidence(tires, usedSkus, usedBrands);
    if (allWeather) {
      usedSkus.add(allWeather.sku);
      
      recommendations.push({
        type: "all-weather-confidence",
        label: "Best for All-Weather Confidence",
        reason: generateAllWeatherReason(allWeather),
        tire: allWeather,
        confidence: allWeather.is3PMSF ? "high" : "medium",
      });
    }
  }

  return { recommendations, vehicleLabel };
}

// ============================================================================
// RECOMMENDATION FINDERS
// ============================================================================

function findBestForVehicle(
  tires: TireForRecommendation[],
  usedSkus: Set<string>,
  usedBrands: Set<string>,
  vehicle?: VehicleContext | null
): TireForRecommendation | null {
  // Get vehicle profile for filtering
  const profile = getVehicleProfile(vehicle);
  
  // First, filter to only vehicle-appropriate tires
  const appropriateTires = tires.filter(t => {
    if (usedSkus.has(t.sku)) return false;
    // Apply vehicle-type guardrails
    return isCategoryAllowedForVehicle(t.category, profile);
  });

  // Score appropriate tires
  const scored = appropriateTires
    .map(t => ({
      tire: t,
      score: calculateBestForVehicleScore(t, vehicle, profile),
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // If no appropriate tires found, fall back to any road-friendly tire
  if (scored.length === 0) {
    console.log(`[Recommendations] No appropriate tires for ${vehicle?.model}, falling back to road-friendly`);
    const fallbackTires = tires
      .filter(t => !usedSkus.has(t.sku))
      .filter(t => {
        const cat = (t.category || '').toLowerCase();
        // Fall back to basic road-friendly categories
        return cat.includes('all-season') || 
               cat.includes('touring') || 
               cat.includes('highway') ||
               !cat; // No category = allow
      })
      .map(t => ({
        tire: t,
        score: calculateBestForVehicleScore(t, vehicle, profile),
      }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);
    
    return fallbackTires[0]?.tire || null;
  }

  return scored[0]?.tire || null;
}

function calculateBestForVehicleScore(
  tire: TireForRecommendation,
  vehicle?: VehicleContext | null,
  profile?: VehicleProfile
): number {
  let score = 0;
  const brandLower = (tire.brand || '').toLowerCase();
  const categoryLower = (tire.category || '').toLowerCase();
  const vehicleProfile = profile || getVehicleProfile(vehicle);

  // Brand quality (premium > mid-tier > budget)
  if (PREMIUM_BRANDS.includes(brandLower)) score += 30;
  else if (MID_TIER_BRANDS.includes(brandLower)) score += 20;
  else score += 5;

  // Stock availability
  if (tire.stock && tire.stock >= 20) score += 15;
  else if (tire.stock && tire.stock >= 8) score += 10;
  else if (tire.stock && tire.stock >= 4) score += 5;

  // Warranty (balanced - not too focused on extremes)
  if (tire.mileageWarranty) {
    if (tire.mileageWarranty >= 60000 && tire.mileageWarranty <= 80000) score += 15;
    else if (tire.mileageWarranty >= 50000) score += 10;
    else if (tire.mileageWarranty >= 40000) score += 5;
  }

  // Price reasonability (avoid extremes)
  if (tire.price) {
    if (tire.price >= 80 && tire.price <= 200) score += 15;
    else if (tire.price >= 60 && tire.price <= 250) score += 10;
    else if (tire.price >= 40 && tire.price <= 300) score += 5;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VEHICLE-TYPE-AWARE CATEGORY SCORING
  // ═══════════════════════════════════════════════════════════════════════════
  
  switch (vehicleProfile.type) {
    case "sedan":
    case "coupe":
    case "hatchback":
    case "van":
      // Sedans prefer touring/all-season, penalize off-road categories
      if (categoryLower.includes('touring') || categoryLower.includes('grand touring')) score += 15;
      else if (categoryLower.includes('all-season')) score += 12;
      else if (categoryLower.includes('highway')) score += 10;
      // Penalize off-road categories (shouldn't reach here due to filter, but belt+suspenders)
      if (categoryLower.includes('all-terrain') || categoryLower.includes('mud')) score -= 50;
      break;

    case "performance":
      // Performance vehicles prefer performance categories
      if (categoryLower.includes('performance') || categoryLower.includes('summer')) score += 20;
      else if (categoryLower.includes('ultra high')) score += 18;
      else if (categoryLower.includes('max performance')) score += 18;
      // Penalize touring/comfort-focused
      if (categoryLower.includes('touring')) score -= 5;
      break;

    case "crossover":
      // Crossovers prefer versatile road tires
      if (categoryLower.includes('crossover') || categoryLower.includes('suv touring')) score += 15;
      else if (categoryLower.includes('all-season')) score += 12;
      else if (categoryLower.includes('touring')) score += 10;
      // Light penalty for aggressive off-road (unless off-road trim)
      if (!vehicleProfile.isOffroadCapable && categoryLower.includes('all-terrain')) score -= 5;
      break;

    case "suv":
      // SUVs can handle broader range
      if (categoryLower.includes('suv') || categoryLower.includes('crossover')) score += 12;
      else if (categoryLower.includes('all-season')) score += 10;
      else if (categoryLower.includes('highway')) score += 10;
      else if (categoryLower.includes('all-terrain')) score += 8;
      break;

    case "truck":
      // Trucks prefer highway/all-terrain balance
      if (categoryLower.includes('highway')) score += 15;
      else if (categoryLower.includes('all-terrain')) score += 12;
      else if (categoryLower.includes('all-season')) score += 10;
      else if (categoryLower.includes('light truck')) score += 10;
      // Only boost mud-terrain if off-road capable
      if (vehicleProfile.isOffroadCapable && categoryLower.includes('mud')) score += 8;
      break;

    case "offroad":
      // Off-road vehicles can prefer aggressive tires
      if (categoryLower.includes('all-terrain')) score += 15;
      else if (categoryLower.includes('mud-terrain') || categoryLower.includes('rugged')) score += 12;
      else if (categoryLower.includes('highway')) score += 8;
      break;

    default:
      // Unknown - use generic scoring
      if (categoryLower.includes('all-season')) score += 10;
      else if (categoryLower.includes('touring')) score += 8;
  }

  // Popularity boost (if available)
  if (tire.popularityRank && tire.popularityRank <= 10) score += 10;
  else if (tire.addToCartCount && tire.addToCartCount >= 5) score += 5;

  return score;
}

function findMostPopular(
  tires: TireForRecommendation[],
  usedSkus: Set<string>,
  usedBrands: Set<string>
): TireForRecommendation | null {
  // Prefer tires with actual popularity data
  const withPopularity = tires
    .filter(t => 
      !usedSkus.has(t.sku) && 
      !usedBrands.has((t.brand || '').toLowerCase()) &&
      t.stock && t.stock >= 4
    )
    .sort((a, b) => {
      // Primary: popularity rank (lower is better)
      if (a.popularityRank && b.popularityRank) {
        return a.popularityRank - b.popularityRank;
      }
      // Secondary: add to cart count
      if (a.addToCartCount || b.addToCartCount) {
        return (b.addToCartCount || 0) - (a.addToCartCount || 0);
      }
      // Fallback: stock (higher is better proxy for popularity)
      return (b.stock || 0) - (a.stock || 0);
    });

  // If no real popularity data, use stock + brand as proxy
  if (!withPopularity[0]?.addToCartCount && !withPopularity[0]?.popularityRank) {
    const byStockAndBrand = tires
      .filter(t => 
        !usedSkus.has(t.sku) && 
        !usedBrands.has((t.brand || '').toLowerCase()) &&
        t.stock && t.stock >= 8 &&
        (PREMIUM_BRANDS.includes((t.brand || '').toLowerCase()) ||
         MID_TIER_BRANDS.includes((t.brand || '').toLowerCase()))
      )
      .sort((a, b) => (b.stock || 0) - (a.stock || 0));
    
    return byStockAndBrand[0] || null;
  }

  return withPopularity[0] || null;
}

function findLongestLasting(
  tires: TireForRecommendation[],
  usedSkus: Set<string>,
  usedBrands: Set<string>
): TireForRecommendation | null {
  const candidates = tires
    .filter(t => 
      !usedSkus.has(t.sku) && 
      !usedBrands.has((t.brand || '').toLowerCase()) &&
      t.mileageWarranty && t.mileageWarranty >= MIN_LONGEVITY_WARRANTY &&
      t.stock && t.stock >= 4
    )
    .sort((a, b) => (b.mileageWarranty || 0) - (a.mileageWarranty || 0));

  return candidates[0] || null;
}

function findAllWeatherConfidence(
  tires: TireForRecommendation[],
  usedSkus: Set<string>,
  usedBrands: Set<string>
): TireForRecommendation | null {
  // Only recommend if there's a tire that's genuinely all-weather capable
  const candidates = tires
    .filter(t => {
      if (usedSkus.has(t.sku)) return false;
      if (usedBrands.has((t.brand || '').toLowerCase())) return false;
      if (!t.stock || t.stock < 4) return false;

      const categoryLower = (t.category || '').toLowerCase();
      
      // Must be all-weather, winter, or have 3PMSF rating
      return (
        ALL_WEATHER_CATEGORIES.some(c => categoryLower.includes(c)) ||
        t.is3PMSF === true
      );
    })
    .sort((a, b) => {
      // Prefer 3PMSF rated
      if (a.is3PMSF && !b.is3PMSF) return -1;
      if (!a.is3PMSF && b.is3PMSF) return 1;
      // Then by stock
      return (b.stock || 0) - (a.stock || 0);
    });

  return candidates[0] || null;
}

// ============================================================================
// REASON GENERATORS
// ============================================================================

function generateBestForVehicleReason(
  tire: TireForRecommendation,
  vehicle?: VehicleContext | null
): string {
  const profile = getVehicleProfile(vehicle);
  const categoryLower = (tire.category || '').toLowerCase();
  const brandLower = (tire.brand || '').toLowerCase();

  // Use vehicle-aware reason templates
  if (tire.mileageWarranty && tire.mileageWarranty >= 60000) {
    return getVehicleAwareReason(profile, "durability", tire);
  }

  // Category-based reason selection
  if (categoryLower.includes('performance') || categoryLower.includes('summer')) {
    return getVehicleAwareReason(profile, "performance", tire);
  }
  
  if (categoryLower.includes('touring') || categoryLower.includes('highway')) {
    return getVehicleAwareReason(profile, "comfort", tire);
  }

  // Default to all-around reason
  return getVehicleAwareReason(profile, "allAround", tire);
}

// Legacy reason generator (keeping for reference but not used)
function generateBestForVehicleReasonLegacy(
  tire: TireForRecommendation,
  vehicle?: VehicleContext | null
): string {
  const reasons: string[] = [];
  const categoryLower = (tire.category || '').toLowerCase();
  const brandLower = (tire.brand || '').toLowerCase();

  // Vehicle-specific comfort
  if (vehicle?.model) {
    const modelLower = vehicle.model.toLowerCase();
    if (isTruckOrSUV(modelLower)) {
      if (categoryLower.includes('all-terrain')) {
        reasons.push('Versatile on and off road');
      } else {
        reasons.push('Smooth highway ride');
      }
    } else if (isSportsCar(modelLower)) {
      reasons.push('Excellent grip and handling');
    } else {
      reasons.push('Smooth ride for daily driving');
    }
  } else {
    reasons.push('Great all-around performance');
  }

  // Add warranty mention if notable
  if (tire.mileageWarranty && tire.mileageWarranty >= 60000) {
    const k = Math.round(tire.mileageWarranty / 1000);
    reasons.push(`${k}K mile warranty`);
  } else if (PREMIUM_BRANDS.includes(brandLower)) {
    reasons.push('Premium quality');
  }

  return reasons.slice(0, 2).join(' • ');
}

function generatePopularReason(tire: TireForRecommendation): string {
  if (tire.isTrending) {
    return 'Trending choice among drivers';
  }
  if (tire.addToCartCount && tire.addToCartCount >= 10) {
    return 'Customer favorite this month';
  }
  
  const brandLower = (tire.brand || '').toLowerCase();
  if (PREMIUM_BRANDS.includes(brandLower)) {
    return 'Trusted brand, consistent quality';
  }
  if (MID_TIER_BRANDS.includes(brandLower)) {
    return 'Great performance at a fair price';
  }
  
  return 'Popular choice for this size';
}

function generateAllWeatherReason(tire: TireForRecommendation): string {
  if (tire.is3PMSF) {
    return 'Severe snow rated (3PMSF) for extra confidence';
  }
  
  const categoryLower = (tire.category || '').toLowerCase();
  if (categoryLower.includes('winter')) {
    return 'Designed for snow and ice';
  }
  if (categoryLower.includes('all-weather')) {
    return 'Year-round confidence in rain and light snow';
  }
  
  return 'Extra confidence in changing conditions';
}

// ============================================================================
// HELPERS
// ============================================================================

function formatVehicleLabel(vehicle?: VehicleContext | null): string | null {
  if (!vehicle?.model) return null;
  
  const model = vehicle.model.trim();
  
  // If model is short enough, use it directly
  if (model.length <= 12) {
    return model;
  }
  
  // Try to shorten common patterns
  const shortened = model
    .replace(/\s+(Series|Edition|Package)$/i, '')
    .replace(/\s+\d{4}$/, ''); // Remove year suffix if present
  
  if (shortened.length <= 15) {
    return shortened;
  }
  
  // Fall back to just "Vehicle" for very long names
  return null;
}

function isTruckOrSUV(modelLower: string): boolean {
  const truckSuvPatterns = [
    'f-150', 'f150', 'f-250', 'f250', 'f-350', 'silverado', 'sierra',
    'ram', 'tundra', 'tacoma', 'ranger', 'colorado', 'canyon', 'frontier',
    'titan', 'ridgeline', 'maverick', 'gladiator',
    'explorer', 'tahoe', 'suburban', 'yukon', 'expedition', 'sequoia',
    '4runner', 'highlander', 'pilot', 'pathfinder', 'armada', 'durango',
    'escalade', 'navigator', 'traverse', 'atlas', 'telluride', 'palisade',
    'rav4', 'cr-v', 'crv', 'cx-5', 'cx5', 'tucson', 'sportage', 'rogue',
    'forester', 'outback', 'crosstrek', 'equinox', 'terrain', 'escape',
    'bronco', 'wrangler', 'grand cherokee', 'cherokee', '4xe',
    'land cruiser', 'gx', 'lx', 'rx', 'nx', 'ux', 'x3', 'x5', 'x7',
    'q5', 'q7', 'q8', 'gle', 'glc', 'gls', 'cayenne', 'macan',
  ];
  return truckSuvPatterns.some(p => modelLower.includes(p));
}

function isSportsCar(modelLower: string): boolean {
  const sportsPatterns = [
    'mustang', 'camaro', 'corvette', 'challenger', 'charger',
    '911', 'cayman', 'boxster', 'supra', '86', 'brz', 'miata', 'mx-5',
    'z4', 'm3', 'm4', 'm5', 'rs', 'amg', 'type r', 'sti', 'wrx',
    'gt-r', 'gtr', 'nismo', 'shelby', 'hellcat', 'demon', 'zl1', 'z06',
  ];
  return sportsPatterns.some(p => modelLower.includes(p));
}

// ============================================================================
// ANALYTICS HELPER
// ============================================================================

export interface RecommendationAnalyticsEvent {
  event: "recommendation_shown" | "recommendation_clicked";
  recommendationType: RecommendationType;
  label: string;
  tireSku: string;
  tireBrand?: string;
  tireModel?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  position: number;
}

/**
 * Create analytics event for recommendation tracking
 */
export function createRecommendationAnalyticsEvent(
  eventType: "recommendation_shown" | "recommendation_clicked",
  recommendation: TireRecommendation,
  position: number,
  vehicle?: VehicleContext | null
): RecommendationAnalyticsEvent {
  return {
    event: eventType,
    recommendationType: recommendation.type,
    label: recommendation.label,
    tireSku: recommendation.tire.sku,
    tireBrand: recommendation.tire.brand,
    tireModel: recommendation.tire.model || recommendation.tire.displayName,
    vehicleMake: vehicle?.make,
    vehicleModel: vehicle?.model,
    position,
  };
}
