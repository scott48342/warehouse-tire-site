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
  // Score tires for "best overall" recommendation
  const scored = tires
    .filter(t => !usedSkus.has(t.sku))
    .map(t => ({
      tire: t,
      score: calculateBestForVehicleScore(t, vehicle),
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.tire || null;
}

function calculateBestForVehicleScore(
  tire: TireForRecommendation,
  vehicle?: VehicleContext | null
): number {
  let score = 0;
  const brandLower = (tire.brand || '').toLowerCase();
  const categoryLower = (tire.category || '').toLowerCase();

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

  // Category match for vehicle type
  if (vehicle?.model) {
    const modelLower = vehicle.model.toLowerCase();
    // Trucks/SUVs prefer all-terrain or highway
    if (isTruckOrSUV(modelLower)) {
      if (categoryLower.includes('all-terrain')) score += 10;
      else if (categoryLower.includes('highway') || categoryLower.includes('touring')) score += 8;
    }
    // Sedans/cars prefer all-season or touring
    else {
      if (categoryLower.includes('all-season')) score += 10;
      else if (categoryLower.includes('touring')) score += 8;
    }
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
