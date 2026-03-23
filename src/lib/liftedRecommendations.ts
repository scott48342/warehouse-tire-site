/**
 * Lift-aware tire and wheel recommendations
 * 
 * IMPORTANT: These are general guidance ranges based on common setups.
 * Actual fitment depends on specific lift kit, wheel offset, backspacing,
 * fender trimming, and other modifications. Always verify before ordering.
 */

export type LiftLevel = "daily" | "offroad" | "extreme";

export interface LiftRecommendation {
  /** Typical tire diameter range in inches (e.g., 31-33) */
  tireDiameterMin: number;
  tireDiameterMax: number;
  /** Common tire sizes that fit this setup */
  commonTireSizes: string[];
  /** Typical wheel diameter range in inches */
  wheelDiameterMin: number;
  wheelDiameterMax: number;
  /** Wheel width range in inches */
  wheelWidthMin: number;
  wheelWidthMax: number;
  /** Typical offset range (negative for most lifted trucks) */
  offsetMin: number;
  offsetMax: number;
  /** Notes specific to this lift level */
  notes: string[];
}

export interface VehicleLiftProfile {
  /** Vehicle identifier: "make|model" (year-agnostic for now) */
  key: string;
  make: string;
  model: string;
  /** Year range this profile applies to (inclusive) */
  yearMin: number;
  yearMax: number;
  /** Platform/generation notes */
  platform?: string;
  /** Recommendations by lift level */
  recommendations: Record<LiftLevel, LiftRecommendation>;
}

/**
 * Recommendation profiles for common truck/SUV platforms
 * 
 * Data sources: Common aftermarket lift kit specs, tire fitment guides
 * These are conservative ranges - actual results vary by specific setup
 */
export const VEHICLE_LIFT_PROFILES: VehicleLiftProfile[] = [
  // ─────────────────────────────────────────────────────────────
  // Ford
  // ─────────────────────────────────────────────────────────────
  {
    key: "ford|f-150",
    make: "Ford",
    model: "F-150",
    yearMin: 2015,
    yearMax: 2026,
    platform: "13th/14th Gen",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/60R20", "285/55R20", "275/65R18", "285/70R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        notes: ["Minimal fender contact", "Stock-like ride quality"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "295/70R17", "315/70R17", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        wheelWidthMin: 9,
        wheelWidthMax: 12,
        offsetMin: -24,
        offsetMax: -12,
        notes: ["May require minor trimming", "UCAs recommended for alignment"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17", "37x13.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -44,
        offsetMax: -18,
        notes: ["Requires fender trimming", "Aftermarket UCAs required", "May need cab mount chop"],
      },
    },
  },
  {
    key: "ford|bronco",
    make: "Ford",
    model: "Bronco",
    yearMin: 2021,
    yearMax: 2026,
    platform: "6th Gen",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "315/70R17", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 8.5,
        wheelWidthMax: 9,
        offsetMin: -6,
        offsetMax: 6,
        notes: ["Sasquatch-equivalent sizing", "No trimming needed on most trims"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        notes: ["Minor fender liner trim on non-Sasquatch", "Consider crash bars"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: ["37x12.50R17", "37x13.50R17", "40x13.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -24,
        offsetMax: -12,
        notes: ["Requires fender trimming", "Long arm kit recommended", "Consider gear regear"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Chevrolet / GMC
  // ─────────────────────────────────────────────────────────────
  {
    key: "chevrolet|silverado 1500",
    make: "Chevrolet",
    model: "Silverado 1500",
    yearMin: 2014,
    yearMax: 2026,
    platform: "K2XX/T1XX",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/60R20", "285/55R20", "275/65R18", "285/65R18"],
        wheelDiameterMin: 18,
        wheelDiameterMax: 20,
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        notes: ["Fits most trims without modification", "Stock UCA usually fine"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "295/70R17", "315/70R17", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        wheelWidthMin: 9,
        wheelWidthMax: 12,
        offsetMin: -24,
        offsetMax: -12,
        notes: ["Aftermarket UCAs recommended", "May need minor trim at full lock"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17", "37x13.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -44,
        offsetMax: -18,
        notes: ["Fender trimming required", "Aftermarket UCAs required", "Consider regear"],
      },
    },
  },
  {
    key: "chevrolet|tahoe",
    make: "Chevrolet",
    model: "Tahoe",
    yearMin: 2015,
    yearMax: 2026,
    platform: "K2XX/T1XX",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/60R20", "285/55R20", "305/50R22"],
        wheelDiameterMin: 20,
        wheelDiameterMax: 22,
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 6,
        notes: ["Maintains factory ride", "Good for daily + occasional off-road"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "295/70R17", "33x12.50R18", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: -6,
        notes: ["Check MagneRide compatibility if equipped", "UCAs recommended"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -24,
        offsetMax: -12,
        notes: ["Significant modification required", "Check for IFS clearance issues"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // RAM
  // ─────────────────────────────────────────────────────────────
  {
    key: "ram|1500",
    make: "RAM",
    model: "1500",
    yearMin: 2013,
    yearMax: 2026,
    platform: "DS/DT",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/60R20", "285/55R20", "275/65R18", "285/65R18"],
        wheelDiameterMin: 18,
        wheelDiameterMax: 20,
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        notes: ["Check air suspension compatibility if equipped", "Stock UCAs usually fine"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "295/70R17", "315/70R17", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        wheelWidthMin: 9,
        wheelWidthMax: 12,
        offsetMin: -24,
        offsetMax: -12,
        notes: ["Aftermarket UCAs recommended", "May require trimming at full lock"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17", "37x13.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -44,
        offsetMax: -18,
        notes: ["Fender trimming required", "Aftermarket UCAs required"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Toyota
  // ─────────────────────────────────────────────────────────────
  {
    key: "toyota|tacoma",
    make: "Toyota",
    model: "Tacoma",
    yearMin: 2016,
    yearMax: 2026,
    platform: "3rd/4th Gen",
    recommendations: {
      daily: {
        tireDiameterMin: 31,
        tireDiameterMax: 33,
        commonTireSizes: ["265/70R17", "265/75R16", "285/70R17"],
        wheelDiameterMin: 16,
        wheelDiameterMax: 17,
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -12,
        offsetMax: 0,
        notes: ["Popular overlander setup", "Stock UCAs usually acceptable"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 34,
        commonTireSizes: ["285/70R17", "285/75R16", "33x12.50R15"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 17,
        wheelWidthMin: 8,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: -6,
        notes: ["Aftermarket UCAs recommended", "Popular TRD Pro look"],
      },
      extreme: {
        tireDiameterMin: 34,
        tireDiameterMax: 35,
        commonTireSizes: ["295/70R17", "35x12.50R15", "35x12.50R17"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 17,
        wheelWidthMin: 8.5,
        wheelWidthMax: 10,
        offsetMin: -24,
        offsetMax: -12,
        notes: ["Requires cab mount chop or relocation", "Body mount chop may be needed", "Regear recommended"],
      },
    },
  },
  {
    key: "toyota|4runner",
    make: "Toyota",
    model: "4Runner",
    yearMin: 2010,
    yearMax: 2026,
    platform: "5th Gen",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["265/70R17", "275/70R17", "285/70R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -12,
        offsetMax: 0,
        notes: ["Very popular overlander platform", "Tons of aftermarket support"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 34,
        commonTireSizes: ["285/70R17", "285/75R16", "33x12.50R15"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 17,
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -18,
        offsetMax: -6,
        notes: ["Aftermarket UCAs recommended for alignment", "KDSS-equipped may have limitations"],
      },
      extreme: {
        tireDiameterMin: 34,
        tireDiameterMax: 35,
        commonTireSizes: ["295/70R17", "35x12.50R15", "35x12.50R17"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 17,
        wheelWidthMin: 8.5,
        wheelWidthMax: 10,
        offsetMin: -24,
        offsetMax: -12,
        notes: ["Fender trimming required", "Consider rear spring upgrade", "Regear recommended"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Jeep
  // ─────────────────────────────────────────────────────────────
  {
    key: "jeep|wrangler",
    make: "Jeep",
    model: "Wrangler",
    yearMin: 2018,
    yearMax: 2026,
    platform: "JL/JLU",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "315/70R17", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -12,
        offsetMax: 6,
        notes: ["Rubicon fits 35s stock", "Other trims may need minor trim"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: -6,
        notes: ["Popular size for rock crawling", "High clearance fenders recommended"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: ["37x12.50R17", "37x13.50R17", "40x13.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -24,
        offsetMax: -12,
        notes: ["Requires fender modifications", "Regear required (4.88+ recommended)", "Consider 1-ton axle swap for 40s"],
      },
    },
  },
  {
    key: "jeep|gladiator",
    make: "Jeep",
    model: "Gladiator",
    yearMin: 2020,
    yearMax: 2026,
    platform: "JT",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "315/70R17", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -12,
        offsetMax: 6,
        notes: ["Similar to Wrangler JL", "Rubicon fits 35s with minimal work"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: -6,
        notes: ["Longer wheelbase = more stable", "Check bed clearance for full articulation"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: ["37x12.50R17", "37x13.50R17", "40x13.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -24,
        offsetMax: -12,
        notes: ["Fender mods required", "Regear required", "Consider driveshaft upgrade"],
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Lookup functions
// ─────────────────────────────────────────────────────────────

/**
 * Find a lift profile for a given vehicle
 * Returns undefined if no profile exists (show fallback messaging)
 */
export function findLiftProfile(
  make: string,
  model: string,
  year?: number
): VehicleLiftProfile | undefined {
  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();
  
  // Handle GMC = Chevrolet equivalents
  const searchMake = normalizedMake === "gmc" ? "chevrolet" : normalizedMake;
  const searchModel = normalizedModel === "sierra 1500" ? "silverado 1500" : 
                       normalizedModel === "yukon" ? "tahoe" : normalizedModel;
  
  const profile = VEHICLE_LIFT_PROFILES.find((p) => {
    const profileMake = p.make.toLowerCase();
    const profileModel = p.model.toLowerCase();
    
    if (profileMake !== searchMake) return false;
    if (profileModel !== searchModel) return false;
    
    // Check year range if provided
    if (year && (year < p.yearMin || year > p.yearMax)) return false;
    
    return true;
  });
  
  return profile;
}

/**
 * Get recommendation for a specific vehicle and lift level
 */
export function getLiftRecommendation(
  make: string,
  model: string,
  liftLevel: LiftLevel,
  year?: number
): { profile: VehicleLiftProfile; recommendation: LiftRecommendation } | null {
  const profile = findLiftProfile(make, model, year);
  if (!profile) return null;
  
  const recommendation = profile.recommendations[liftLevel];
  return { profile, recommendation };
}

/**
 * Format tire diameter range for display
 */
export function formatTireDiameterRange(rec: LiftRecommendation): string {
  if (rec.tireDiameterMin === rec.tireDiameterMax) {
    return `${rec.tireDiameterMin}"`;
  }
  return `${rec.tireDiameterMin}"-${rec.tireDiameterMax}"`;
}

/**
 * Format wheel diameter range for display
 */
export function formatWheelDiameterRange(rec: LiftRecommendation): string {
  if (rec.wheelDiameterMin === rec.wheelDiameterMax) {
    return `${rec.wheelDiameterMin}"`;
  }
  return `${rec.wheelDiameterMin}"-${rec.wheelDiameterMax}"`;
}

/**
 * Format offset range for display
 */
export function formatOffsetRange(rec: LiftRecommendation): string {
  const minStr = rec.offsetMin >= 0 ? `+${rec.offsetMin}` : `${rec.offsetMin}`;
  const maxStr = rec.offsetMax >= 0 ? `+${rec.offsetMax}` : `${rec.offsetMax}`;
  return `${minStr} to ${maxStr}mm`;
}
