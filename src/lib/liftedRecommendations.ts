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
  /** Typical wheel diameter range in inches (technical guidance) */
  wheelDiameterMin: number;
  wheelDiameterMax: number;
  /** Popular wheel sizes shoppers buy for this build (demand-driven) */
  popularWheelSizes: number[];
  /** Wheel width range in inches */
  wheelWidthMin: number;
  wheelWidthMax: number;
  /** Typical offset range (negative for most lifted trucks) */
  offsetMin: number;
  offsetMax: number;
  /** Human-readable offset label for this lift level */
  offsetLabel: string;
  /** Short description of the stance for this lift level */
  stanceDescription: string;
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
    key: "ford|f-250",
    make: "Ford",
    model: "F-250",
    yearMin: 1990,
    yearMax: 2026,
    platform: "Super Duty (all generations)",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["275/70R18", "285/65R20", "295/65R20", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, leveled stance",
        notes: ["Great towing capability", "Stock suspension handles well"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: [
          "35x12.50R17", "315/70R17", "37x12.50R17",
          "35x12.50R18", "35x12.50R20", "37x12.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -25,
        offsetMax: 0,
        offsetLabel: "0 to -25mm",
        stanceDescription: "Aggressive work truck stance",
        notes: ["Popular ranch/work truck setup", "Maintains towing capacity"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: [
          "37x12.50R17", "37x13.50R17", "40x13.50R17",
          "37x12.50R20", "37x12.50R22", "40x13.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [20, 22, 24],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Massive presence — trimming required",
        notes: ["Fender trimming likely needed", "Check steering geometry", "May affect towing"],
      },
    },
  },
  {
    key: "ford|f-350",
    make: "Ford",
    model: "F-350",
    yearMin: 1990,
    yearMax: 2026,
    platform: "Super Duty (all generations)",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["275/70R18", "285/65R20", "295/65R20", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, leveled stance",
        notes: ["Great towing capability", "Dually options available"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: [
          "35x12.50R17", "315/70R17", "37x12.50R17",
          "35x12.50R18", "35x12.50R20", "37x12.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -25,
        offsetMax: 0,
        offsetLabel: "0 to -25mm",
        stanceDescription: "Aggressive work truck stance",
        notes: ["Heavy duty springs handle bigger tires well", "Great for work + play"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: [
          "37x12.50R17", "37x13.50R17", "40x13.50R17",
          "37x12.50R20", "37x12.50R22", "40x13.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [20, 22, 24],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Massive presence — trimming required",
        notes: ["Fender trimming needed", "Popular show truck build", "SRW vs DRW considerations"],
      },
    },
  },
  {
    key: "ford|f-150",
    make: "Ford",
    model: "F-150",
    yearMin: 1990,
    yearMax: 2026,
    platform: "13th/14th Gen",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/60R20", "285/55R20", "275/65R18", "285/70R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["Minimal fender contact", "Stock-like ride quality"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: [
          "285/70R17", "295/70R17", "315/70R17", "35x12.50R17",  // 17" wheels
          "33x12.50R18", "285/70R18", "295/65R18",                // 18" wheels
          "33x12.50R20", "35x12.50R20", "295/60R20", "305/55R20", // 20" wheels
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [17, 18, 20],
        wheelWidthMin: 9,
        wheelWidthMax: 12,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["May require minor trimming", "UCAs recommended for alignment"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: [
          "35x12.50R17", "37x12.50R17", "37x13.50R17",  // 17" wheels
          "35x12.50R18", "37x12.50R18",                  // 18" wheels (removed 33")
          "35x12.50R20", "37x12.50R20",                  // 20" wheels (removed 33")
          "35x12.50R22", "37x12.50R22",                  // 22" wheels (removed 33")
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Deep, aggressive stance — trimming required",
        notes: ["Requires fender trimming", "Aftermarket UCAs required", "May need cab mount chop"],
      },
    },
  },
  {
    key: "ford|bronco",
    make: "Ford",
    model: "Bronco",
    yearMin: 1990,
    yearMax: 2026,
    platform: "6th Gen",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "315/70R17", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 8.5,
        wheelWidthMax: 9,
        offsetMin: -6,
        offsetMax: 6,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["Sasquatch-equivalent sizing", "No trimming needed on most trims"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        popularWheelSizes: [17],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Minor fender liner trim on non-Sasquatch", "Consider crash bars"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: ["37x12.50R17", "37x13.50R17", "40x13.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Deep, aggressive stance — trimming required",
        notes: ["Requires fender trimming", "Long arm kit recommended", "Consider gear regear"],
      },
    },
  },

  {
    key: "ford|ranger",
    make: "Ford",
    model: "Ranger",
    yearMin: 1990,
    yearMax: 2026,
    platform: "T6/P703",
    recommendations: {
      daily: {
        tireDiameterMin: 31,
        tireDiameterMax: 33,
        commonTireSizes: ["265/70R17", "265/65R18", "275/65R18", "285/70R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -12,
        offsetMax: 6,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["Popular mid-size truck", "FX4 comes with better approach angles"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 34,
        commonTireSizes: ["285/70R17", "285/75R17", "33x12.50R17", "275/70R18"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 8.5,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["May need minor fender trimming", "UCAs help with alignment"],
      },
      extreme: {
        tireDiameterMin: 34,
        tireDiameterMax: 35,
        commonTireSizes: ["295/70R17", "35x12.50R17", "305/70R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -44,
        offsetMax: -18,
        offsetLabel: "-18 to -44mm",
        stanceDescription: "Aggressive stance — trimming required",
        notes: ["Fender trimming required", "Body mount chop may be needed", "Consider regear"],
      },
    },
  },
  {
    key: "ford|expedition",
    make: "Ford",
    model: "Expedition",
    yearMin: 1990,
    yearMax: 2026,
    platform: "T3/U553",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/55R22", "285/45R22", "275/60R20", "305/45R22"],
        wheelDiameterMin: 20,
        wheelDiameterMax: 22,
        popularWheelSizes: [20, 22, 24],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 6,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, leveled stance",
        notes: ["Maintains factory ride quality", "Great family hauler look"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "33x12.50R18", "295/65R20", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Check air suspension compatibility", "UCAs recommended"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17", "35x12.50R20", "37x12.50R20"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -44,
        offsetMax: -18,
        offsetLabel: "-18 to -44mm",
        stanceDescription: "Aggressive stance — trimming required",
        notes: ["Fender trimming required", "Consider IFS limitations", "Air suspension may need attention"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Chevrolet / GMC
  // ─────────────────────────────────────────────────────────────
  {
    key: "chevrolet|silverado 2500 hd",
    make: "Chevrolet",
    model: "Silverado 2500 HD",
    yearMin: 1990,
    yearMax: 2026,
    platform: "HD Truck (all generations)",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["275/70R18", "285/65R20", "295/65R20", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, leveled stance",
        notes: ["Great towing capability", "HD suspension handles bigger tires well"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: [
          "35x12.50R17", "315/70R17", "37x12.50R17",
          "35x12.50R18", "35x12.50R20", "37x12.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -25,
        offsetMax: 0,
        offsetLabel: "0 to -25mm",
        stanceDescription: "Aggressive work truck stance",
        notes: ["Popular rancher setup", "Maintains good towing capacity"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: [
          "37x12.50R17", "37x13.50R17", "40x13.50R17",
          "37x12.50R20", "37x12.50R22", "40x13.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [20, 22, 24],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Massive presence — trimming required",
        notes: ["Fender trimming likely needed", "Check steering geometry", "May affect towing"],
      },
    },
  },
  {
    key: "chevrolet|silverado 3500 hd",
    make: "Chevrolet",
    model: "Silverado 3500 HD",
    yearMin: 1990,
    yearMax: 2026,
    platform: "HD Truck (all generations)",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["275/70R18", "285/65R20", "295/65R20", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, leveled stance",
        notes: ["Great towing capability", "Dually options available"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: [
          "35x12.50R17", "315/70R17", "37x12.50R17",
          "35x12.50R18", "35x12.50R20", "37x12.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -25,
        offsetMax: 0,
        offsetLabel: "0 to -25mm",
        stanceDescription: "Aggressive work truck stance",
        notes: ["HD springs handle bigger tires well", "Great for work + play"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: [
          "37x12.50R17", "37x13.50R17", "40x13.50R17",
          "37x12.50R20", "37x12.50R22", "40x13.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [20, 22, 24],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Massive presence — trimming required",
        notes: ["Fender trimming needed", "Popular show truck build", "SRW vs DRW considerations"],
      },
    },
  },
  {
    key: "chevrolet|silverado 1500",
    make: "Chevrolet",
    model: "Silverado 1500",
    yearMin: 1990,
    yearMax: 2026,
    platform: "K2XX/T1XX",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/60R20", "285/55R20", "275/65R18", "285/65R18"],
        wheelDiameterMin: 18,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["Fits most trims without modification", "Stock UCA usually fine"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        // Sizes for each popular wheel diameter: R17, R18, R20
        commonTireSizes: [
          "285/70R17", "295/70R17", "315/70R17", "35x12.50R17",  // 17" wheels
          "33x12.50R18", "285/70R18", "295/65R18",                // 18" wheels  
          "33x12.50R20", "295/55R20", "305/55R20",                // 20" wheels
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [17, 18, 20],
        wheelWidthMin: 9,
        wheelWidthMax: 12,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Aftermarket UCAs recommended", "May need minor trim at full lock"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        // Sizes for each popular wheel diameter: R17, R18, R20, R22 (removed 33" - too small for 6" lift)
        commonTireSizes: [
          "35x12.50R17", "37x12.50R17", "37x13.50R17",  // 17" wheels
          "35x12.50R18", "37x12.50R18",                  // 18" wheels
          "35x12.50R20", "37x12.50R20",                  // 20" wheels
          "35x12.50R22", "37x12.50R22",                  // 22" wheels
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Deep, aggressive stance — trimming required",
        notes: ["Fender trimming required", "Aftermarket UCAs required", "Consider regear"],
      },
    },
  },
  {
    key: "chevrolet|tahoe",
    make: "Chevrolet",
    model: "Tahoe",
    yearMin: 1990,
    yearMax: 2026,
    platform: "K2XX/T1XX",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/60R20", "285/55R20", "305/50R22"],
        wheelDiameterMin: 20,
        wheelDiameterMax: 22,
        popularWheelSizes: [20, 22, 24],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 6,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["Maintains factory ride", "Good for daily + occasional off-road"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "295/70R17", "33x12.50R18", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Check MagneRide compatibility if equipped", "UCAs recommended"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Deep, aggressive stance — trimming required",
        notes: ["Significant modification required", "Check for IFS clearance issues"],
      },
    },
  },

  {
    key: "chevrolet|colorado",
    make: "Chevrolet",
    model: "Colorado",
    yearMin: 1990,
    yearMax: 2026,
    platform: "GMT31XX",
    recommendations: {
      daily: {
        tireDiameterMin: 31,
        tireDiameterMax: 33,
        commonTireSizes: ["265/70R17", "265/65R18", "275/65R18", "285/70R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -12,
        offsetMax: 6,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["ZR2 comes ready for bigger tires", "Great mid-size platform"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 34,
        commonTireSizes: ["285/70R17", "285/75R17", "33x12.50R17", "275/70R18"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 8.5,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["May need fender trimming", "UCAs help with alignment"],
      },
      extreme: {
        tireDiameterMin: 34,
        tireDiameterMax: 35,
        commonTireSizes: ["295/70R17", "35x12.50R17", "305/70R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -44,
        offsetMax: -18,
        offsetLabel: "-18 to -44mm",
        stanceDescription: "Aggressive stance — trimming required",
        notes: ["Fender trimming required", "Body mount chop may be needed", "Regear recommended"],
      },
    },
  },
  {
    key: "chevrolet|suburban",
    make: "Chevrolet",
    model: "Suburban",
    yearMin: 1990,
    yearMax: 2026,
    platform: "K2XX/T1XX",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/60R20", "285/55R20", "305/50R22", "285/45R22"],
        wheelDiameterMin: 20,
        wheelDiameterMax: 22,
        popularWheelSizes: [20, 22, 24],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 6,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, leveled stance",
        notes: ["Maintains factory ride", "Great family hauler look"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "295/70R17", "33x12.50R18", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Check MagneRide compatibility if equipped", "UCAs recommended"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17", "35x12.50R20", "37x12.50R20"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Aggressive stance — trimming required",
        notes: ["Significant modification required", "Check for IFS clearance issues"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // RAM
  // ─────────────────────────────────────────────────────────────
  {
    key: "ram|2500",
    make: "RAM",
    model: "2500",
    yearMin: 1990,
    yearMax: 2026,
    platform: "HD Truck (3rd gen Dodge + RAM)",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["275/70R18", "285/65R20", "295/65R20", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, leveled stance",
        notes: ["Great towing capability", "HD suspension handles bigger tires well"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: [
          "35x12.50R17", "315/70R17", "37x12.50R17",
          "35x12.50R18", "35x12.50R20", "37x12.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -25,
        offsetMax: 0,
        offsetLabel: "0 to -25mm",
        stanceDescription: "Aggressive work truck stance",
        notes: ["Popular Power Wagon look", "Solid front axle = easier lift"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: [
          "37x12.50R17", "37x13.50R17", "40x13.50R17",
          "37x12.50R20", "37x12.50R22", "40x13.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [20, 22, 24],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Massive presence — trimming required",
        notes: ["Solid axle = more lift options", "Check driveshaft angles", "Popular show truck platform"],
      },
    },
  },
  {
    key: "ram|3500",
    make: "RAM",
    model: "3500",
    yearMin: 1990,
    yearMax: 2026,
    platform: "HD Truck (3rd gen Dodge + RAM)",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["275/70R18", "285/65R20", "295/65R20", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, leveled stance",
        notes: ["Great towing capability", "Dually options available"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: [
          "35x12.50R17", "315/70R17", "37x12.50R17",
          "35x12.50R18", "35x12.50R20", "37x12.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -25,
        offsetMax: 0,
        offsetLabel: "0 to -25mm",
        stanceDescription: "Aggressive work truck stance",
        notes: ["HD springs handle bigger tires", "Great for work + play"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: [
          "37x12.50R17", "37x13.50R17", "40x13.50R17",
          "37x12.50R20", "37x12.50R22", "40x13.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [20, 22, 24],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Massive presence — trimming required",
        notes: ["Solid axle = great lift platform", "SRW vs DRW considerations", "Popular show truck"],
      },
    },
  },
  {
    key: "ram|1500",
    make: "RAM",
    model: "1500",
    yearMin: 1990,
    yearMax: 2026,
    platform: "DS/DT",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/60R20", "285/55R20", "275/65R18", "285/65R18"],
        wheelDiameterMin: 18,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["Check air suspension compatibility if equipped", "Stock UCAs usually fine"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: [
          "285/70R17", "295/70R17", "315/70R17", "35x12.50R17",  // 17" wheels
          "33x12.50R18", "285/70R18", "295/65R18",                // 18" wheels
          "33x12.50R20", "35x12.50R20", "295/60R20", "305/55R20", // 20" wheels
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [17, 18, 20],
        wheelWidthMin: 9,
        wheelWidthMax: 12,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Aftermarket UCAs recommended", "May require trimming at full lock"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        // Removed 33" - too small for 6" lift on half-ton
        commonTireSizes: [
          "35x12.50R17", "37x12.50R17", "37x13.50R17",  // 17" wheels
          "35x12.50R18", "37x12.50R18",                  // 18" wheels
          "35x12.50R20", "37x12.50R20",                  // 20" wheels
          "35x12.50R22", "37x12.50R22",                  // 22" wheels
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Deep, aggressive stance — trimming required",
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
    yearMin: 1990,
    yearMax: 2026,
    platform: "3rd/4th Gen",
    recommendations: {
      daily: {
        tireDiameterMin: 31,
        tireDiameterMax: 33,
        commonTireSizes: ["265/70R17", "265/75R16", "285/70R17"],
        wheelDiameterMin: 16,
        wheelDiameterMax: 17,
        popularWheelSizes: [16, 17, 18],
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["Popular overlander setup", "Stock UCAs usually acceptable"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 34,
        commonTireSizes: ["285/70R17", "285/75R16", "33x12.50R15"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 17,
        popularWheelSizes: [16, 17],
        wheelWidthMin: 8,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Aftermarket UCAs recommended", "Popular TRD Pro look"],
      },
      extreme: {
        tireDiameterMin: 34,
        tireDiameterMax: 35,
        commonTireSizes: ["295/70R17", "35x12.50R15", "35x12.50R17"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 8.5,
        wheelWidthMax: 10,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Deep, aggressive stance — trimming required",
        notes: ["Requires cab mount chop or relocation", "Body mount chop may be needed", "Regear recommended"],
      },
    },
  },
  {
    key: "toyota|4runner",
    make: "Toyota",
    model: "4Runner",
    yearMin: 1990,
    yearMax: 2026,
    platform: "5th Gen",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["265/70R17", "275/70R17", "285/70R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["Very popular overlander platform", "Tons of aftermarket support"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 34,
        commonTireSizes: ["285/70R17", "285/75R16", "33x12.50R15"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 17,
        popularWheelSizes: [16, 17],
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Aftermarket UCAs recommended for alignment", "KDSS-equipped may have limitations"],
      },
      extreme: {
        tireDiameterMin: 34,
        tireDiameterMax: 35,
        commonTireSizes: ["295/70R17", "35x12.50R15", "35x12.50R17"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 8.5,
        wheelWidthMax: 10,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Deep, aggressive stance — trimming required",
        notes: ["Fender trimming required", "Consider rear spring upgrade", "Regear recommended"],
      },
    },
  },

  // 2nd Gen Tundra (2007-2013)
  {
    key: "toyota|tundra",
    make: "Toyota",
    model: "Tundra",
    yearMin: 1990,
    yearMax: 2013,
    platform: "XK50 (2nd Gen)",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/65R18", "285/65R18", "275/60R20", "285/55R20"],
        wheelDiameterMin: 18,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean leveled stance",
        notes: ["Popular platform for leveling kits", "Great reliability"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: [
          "285/70R17", "295/70R17", "35x12.50R17",
          "33x12.50R18", "295/65R20", "33x12.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [17, 18, 20],
        wheelWidthMin: 9,
        wheelWidthMax: 12,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Aftermarket UCAs recommended for lifts over 3\"", "Check ball joint clearance"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: [
          "35x12.50R17", "37x12.50R17",
          "35x12.50R18", "35x12.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [17, 18, 20],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -44,
        offsetMax: -18,
        offsetLabel: "-18 to -44mm",
        stanceDescription: "Aggressive stance — trimming required",
        notes: ["Fender trimming required", "Body mount chop may be needed", "Regear recommended for 37s"],
      },
    },
  },
  // 3rd Gen Tundra (2014-2021) and 4th Gen (2022+)
  {
    key: "toyota|tundra",
    make: "Toyota",
    model: "Tundra",
    yearMin: 1990,
    yearMax: 2026,
    platform: "XK50/XK70",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/65R18", "285/65R18", "275/60R20", "285/55R20"],
        wheelDiameterMin: 18,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["TRD Pro comes with factory lift", "Great reliability platform"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: [
          "285/70R17", "295/70R17", "35x12.50R17",
          "33x12.50R18", "295/65R20", "33x12.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20],
        wheelWidthMin: 9,
        wheelWidthMax: 12,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Aftermarket UCAs recommended", "Popular overlander build"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: [
          "35x12.50R17", "37x12.50R17",
          "35x12.50R18", "35x12.50R20", "37x12.50R20",
        ],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Aggressive stance — trimming required",
        notes: ["Fender trimming required", "Check for IFS clearance", "Regear recommended"],
      },
    },
  },
  {
    key: "toyota|sequoia",
    make: "Toyota",
    model: "Sequoia",
    yearMin: 1990,
    yearMax: 2026,
    platform: "XK60/XK80",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/65R18", "285/65R18", "275/60R20", "285/55R20"],
        wheelDiameterMin: 18,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, leveled stance",
        notes: ["Great family hauler", "Tundra-based platform"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "295/70R17", "33x12.50R18", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Check KDSS compatibility if equipped", "UCAs recommended"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17", "35x12.50R20"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -44,
        offsetMax: -18,
        offsetLabel: "-18 to -44mm",
        stanceDescription: "Aggressive stance — trimming required",
        notes: ["Fender trimming required", "Check IFS limitations"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Nissan
  // ─────────────────────────────────────────────────────────────
  {
    key: "nissan|titan",
    make: "Nissan",
    model: "Titan",
    yearMin: 1990,
    yearMax: 2026,
    platform: "A61",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["275/65R18", "285/65R18", "275/60R20", "285/55R20"],
        wheelDiameterMin: 18,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["PRO-4X comes with factory lift", "Great value full-size truck"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "295/70R17", "33x12.50R18", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["UCAs recommended for alignment", "Good aftermarket support"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17", "35x12.50R20", "37x12.50R20"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Aggressive stance — trimming required",
        notes: ["Fender trimming required", "Check IFS clearance"],
      },
    },
  },
  {
    key: "nissan|titan xd",
    make: "Nissan",
    model: "Titan XD",
    yearMin: 1990,
    yearMax: 2026,
    platform: "A61 XD",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["275/70R18", "285/65R20", "295/65R20", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 0,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, leveled stance",
        notes: ["HD frame handles bigger tires", "Cummins diesel option popular"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "35x12.50R18", "35x12.50R20", "37x12.50R20"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [18, 20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 12,
        offsetMin: -25,
        offsetMax: 0,
        offsetLabel: "0 to -25mm",
        stanceDescription: "Aggressive work truck stance",
        notes: ["HD suspension handles bigger tires well", "Good aftermarket support"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: ["37x12.50R17", "37x12.50R20", "37x13.50R17", "40x13.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [20, 22],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Massive presence — trimming required",
        notes: ["Fender trimming needed", "Check steering geometry"],
      },
    },
  },
  {
    key: "nissan|frontier",
    make: "Nissan",
    model: "Frontier",
    yearMin: 1990,
    yearMax: 2026,
    platform: "D40/D41",
    recommendations: {
      daily: {
        tireDiameterMin: 31,
        tireDiameterMax: 32,
        commonTireSizes: ["265/70R17", "265/75R16", "275/70R17", "265/65R18"],
        wheelDiameterMin: 16,
        wheelDiameterMax: 18,
        popularWheelSizes: [16, 17, 18],
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -12,
        offsetMax: 6,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["PRO-4X comes with factory lift", "Great value mid-size truck"],
      },
      offroad: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["285/70R17", "285/75R16", "33x12.50R15", "275/70R18"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 18,
        popularWheelSizes: [16, 17, 18],
        wheelWidthMin: 8,
        wheelWidthMax: 9.5,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["May need fender trimming", "UCAs help with alignment"],
      },
      extreme: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["295/70R17", "33x12.50R17", "35x12.50R15", "35x12.50R17"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 8.5,
        wheelWidthMax: 10,
        offsetMin: -44,
        offsetMax: -18,
        offsetLabel: "-18 to -44mm",
        stanceDescription: "Aggressive stance — trimming required",
        notes: ["Fender trimming required", "Body mount chop may be needed", "Regear recommended"],
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
    yearMin: 1990,
    yearMax: 2026,
    platform: "JL/JLU",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "315/70R17", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -12,
        offsetMax: 6,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["Rubicon fits 35s stock", "Other trims may need minor trim"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        popularWheelSizes: [17],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Popular size for rock crawling", "High clearance fenders recommended"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: ["37x12.50R17", "37x13.50R17", "40x13.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Deep, aggressive stance — trimming required",
        notes: ["Requires fender modifications", "Regear required (4.88+ recommended)", "Consider 1-ton axle swap for 40s"],
      },
    },
  },
  {
    key: "jeep|gladiator",
    make: "Jeep",
    model: "Gladiator",
    yearMin: 1990,
    yearMax: 2026,
    platform: "JT",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/70R17", "315/70R17", "35x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -12,
        offsetMax: 6,
        offsetLabel: "Standard offset",
        stanceDescription: "Clean, factory-like leveled stance",
        notes: ["Similar to Wrangler JL", "Rubicon fits 35s with minimal work"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R17", "37x12.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 17,
        popularWheelSizes: [17],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Longer wheelbase = more stable", "Check bed clearance for full articulation"],
      },
      extreme: {
        tireDiameterMin: 37,
        tireDiameterMax: 40,
        commonTireSizes: ["37x12.50R17", "37x13.50R17", "40x13.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 18,
        popularWheelSizes: [17, 18],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -50,
        offsetMax: -24,
        offsetLabel: "-24 to -50mm",
        stanceDescription: "Deep, aggressive stance — trimming required",
        notes: ["Fender mods required", "Regear required", "Consider driveshaft upgrade"],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Hummer
  // ─────────────────────────────────────────────────────────────
  {
    key: "hummer|h2",
    make: "Hummer",
    model: "H2",
    yearMin: 2003,
    yearMax: 2009,
    platform: "GMT820 (Tahoe-based)",
    recommendations: {
      daily: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["315/70R17", "35x12.50R17", "33x12.50R20"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 22,
        popularWheelSizes: [17, 20, 22],
        wheelWidthMin: 9,
        wheelWidthMax: 10,
        offsetMin: -12,
        offsetMax: 25,
        offsetLabel: "-12 to +25mm",
        stanceDescription: "Stock-look with slight upgrade",
        notes: ["H2 fits 35s stock", "Check brake caliper clearance on 17s"],
      },
      offroad: {
        tireDiameterMin: 35,
        tireDiameterMax: 38,
        commonTireSizes: ["35x12.50R17", "37x12.50R17", "35x12.50R20", "37x12.50R20"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [17, 20],
        wheelWidthMin: 9,
        wheelWidthMax: 12,
        offsetMin: -44,
        offsetMax: 0,
        offsetLabel: "0 to -44mm",
        stanceDescription: "Aggressive off-road stance",
        notes: ["Minor fender trimming may be needed", "UCAs recommended for alignment"],
      },
      extreme: {
        tireDiameterMin: 38,
        tireDiameterMax: 42,
        commonTireSizes: ["37x13.50R17", "40x13.50R17", "38x15.50R17"],
        wheelDiameterMin: 17,
        wheelDiameterMax: 20,
        popularWheelSizes: [17, 20],
        wheelWidthMin: 10,
        wheelWidthMax: 14,
        offsetMin: -76,
        offsetMax: -44,
        offsetLabel: "-44 to -76mm",
        stanceDescription: "Extreme stance — significant mods required",
        notes: ["Fender trimming required", "Long arm kit recommended", "Regear to 4.56+ for 40s"],
      },
    },
  },
  {
    key: "hummer|h3",
    make: "Hummer",
    model: "H3",
    yearMin: 2006,
    yearMax: 2010,
    platform: "GMT355 (Colorado-based)",
    recommendations: {
      daily: {
        tireDiameterMin: 32,
        tireDiameterMax: 33,
        commonTireSizes: ["285/70R17", "285/75R16", "33x12.50R15"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 18,
        popularWheelSizes: [16, 17, 18],
        wheelWidthMin: 8,
        wheelWidthMax: 9,
        offsetMin: -6,
        offsetMax: 25,
        offsetLabel: "-6 to +25mm",
        stanceDescription: "Clean, leveled stance",
        notes: ["Stock fits 32s", "Adventure package has better clearance"],
      },
      offroad: {
        tireDiameterMin: 33,
        tireDiameterMax: 35,
        commonTireSizes: ["285/75R16", "33x12.50R15", "35x12.50R17"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 17,
        popularWheelSizes: [15, 16, 17],
        wheelWidthMin: 8,
        wheelWidthMax: 10,
        offsetMin: -18,
        offsetMax: 0,
        offsetLabel: "0 to -18mm",
        stanceDescription: "Aggressive lifted stance",
        notes: ["Fender trimming likely needed", "UCAs recommended"],
      },
      extreme: {
        tireDiameterMin: 35,
        tireDiameterMax: 37,
        commonTireSizes: ["35x12.50R15", "35x12.50R17", "37x12.50R17"],
        wheelDiameterMin: 15,
        wheelDiameterMax: 17,
        popularWheelSizes: [15, 17],
        wheelWidthMin: 9,
        wheelWidthMax: 12,
        offsetMin: -44,
        offsetMax: -18,
        offsetLabel: "-18 to -44mm",
        stanceDescription: "Aggressive stance — trimming required",
        notes: ["Significant fender trimming required", "Body mount chop may be needed", "Regear recommended"],
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Lookup functions
// ─────────────────────────────────────────────────────────────

/**
 * Normalize HD truck model names to canonical format
 * Handles variations like "2500HD", "2500 HD", "2500-HD", "Super Duty", etc.
 */
function normalizeHdModel(model: string): string {
  let normalized = model.toLowerCase().trim();
  
  // === GMC Sierra HD → Chevrolet Silverado HD (same platforms) ===
  // Handle Sierra 2500/3500 variations
  if (/^sierra[\s-]?2500[\s-]?(hd)?$/i.test(model)) return "silverado 2500 hd";
  if (/^sierra[\s-]?3500[\s-]?(hd)?$/i.test(model)) return "silverado 3500 hd";
  
  // === Chevrolet Silverado HD ===
  // Silverado 2500: with or without "HD", various spacings
  if (/^silverado[\s-]?2500[\s-]?(hd)?$/i.test(model)) return "silverado 2500 hd";
  // Silverado 3500: with or without "HD", various spacings
  if (/^silverado[\s-]?3500[\s-]?(hd)?$/i.test(model)) return "silverado 3500 hd";
  
  // === Ford Super Duty ===
  // F-250: "F-250", "F250", "F-250 Super Duty", "Super Duty F-250"
  if (/^f[\s-]?250([\s-]?super[\s-]?duty)?$/i.test(model)) return "f-250";
  if (/^super[\s-]?duty[\s-]?f[\s-]?250$/i.test(model)) return "f-250";
  // F-350: "F-350", "F350", "F-350 Super Duty", "Super Duty F-350"
  if (/^f[\s-]?350([\s-]?super[\s-]?duty)?$/i.test(model)) return "f-350";
  if (/^super[\s-]?duty[\s-]?f[\s-]?350$/i.test(model)) return "f-350";
  // F-450: "F-450", "F450", "F-450 Super Duty"
  if (/^f[\s-]?450([\s-]?super[\s-]?duty)?$/i.test(model)) return "f-450";
  
  // === RAM HD ===
  // RAM 2500: "RAM 2500", "Ram 2500", "2500" (when make is RAM)
  if (/^(ram[\s-]?)?2500$/i.test(model)) return "2500";
  // RAM 3500: "RAM 3500", "Ram 3500", "3500" (when make is RAM)
  if (/^(ram[\s-]?)?3500$/i.test(model)) return "3500";
  
  // === Nissan Titan XD ===
  if (/^titan[\s-]?xd$/i.test(model)) return "titan xd";
  
  return normalized;
}

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
  let searchMake = normalizedMake;
  let searchModel = normalizeHdModel(model);
  
  // Handle make equivalents (same platforms, different badges)
  if (normalizedMake === "gmc") {
    searchMake = "chevrolet";
    // Sierra HD models already normalized above, handle remaining GMC models
    const normalizedModel = model.toLowerCase().trim();
    if (normalizedModel === "sierra 1500") searchModel = "silverado 1500";
    else if (normalizedModel === "yukon") searchModel = "tahoe";
    else if (normalizedModel === "yukon xl") searchModel = "suburban";
    else if (normalizedModel === "canyon") searchModel = "colorado";
    // Sierra HD already handled by normalizeHdModel
  }
  
  // Handle Dodge → RAM for pre-2010 trucks (Dodge Ram 2500/3500 → RAM 2500/3500)
  if (normalizedMake === "dodge") {
    // Dodge Ram 2500/3500 use same platform as RAM 2500/3500
    if (/^(ram[\s-]?)?2500$/i.test(model) || /^(ram[\s-]?)?3500$/i.test(model)) {
      searchMake = "ram";
    }
  }
  
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

// ─────────────────────────────────────────────────────────────
// POS-specific helpers
// ─────────────────────────────────────────────────────────────

/**
 * Get lift profile for a vehicle (simplified for POS)
 */
export function getLiftProfile(
  make: string,
  model: string,
  year?: number
): VehicleLiftProfile | null {
  return findLiftProfile(make, model, year) || null;
}

/**
 * Get recommendation based on lift height (not preset ID)
 * Maps lift inches to appropriate preset level
 */
export function getRecommendationForLiftHeight(
  profile: VehicleLiftProfile,
  liftInches: number
): LiftRecommendation {
  // Map lift height to preset level
  let level: LiftLevel;
  if (liftInches <= 2.5) {
    level = "daily";
  } else if (liftInches <= 4) {
    level = "offroad";
  } else {
    level = "extreme";
  }
  
  return profile.recommendations[level];
}

/**
 * Check if a wheel fits the lift configuration
 */
export function wheelFitsLiftConfig(
  wheelOffset: number,
  wheelDiameter: number,
  liftInches: number,
  profile: VehicleLiftProfile | null
): { fits: boolean; notes: string[] } {
  if (!profile) {
    return { fits: true, notes: ["Fitment profile not available - verify manually"] };
  }
  
  const rec = getRecommendationForLiftHeight(profile, liftInches);
  const notes: string[] = [];
  
  // Check diameter
  if (wheelDiameter < rec.wheelDiameterMin || wheelDiameter > rec.wheelDiameterMax) {
    notes.push(`Recommended wheel diameter: ${rec.wheelDiameterMin}-${rec.wheelDiameterMax}"`);
  }
  
  // Check offset
  if (wheelOffset < rec.offsetMin || wheelOffset > rec.offsetMax) {
    notes.push(`Recommended offset: ${rec.offsetLabel}`);
  }
  
  // Add general notes from recommendation
  if (rec.notes.length > 0) {
    notes.push(...rec.notes);
  }
  
  return {
    fits: notes.length === 0 || notes.every(n => rec.notes.includes(n)),
    notes,
  };
}

/**
 * Get tire sizes recommended for a lift configuration
 */
export function getTireSizesForLift(
  profile: VehicleLiftProfile | null,
  liftInches: number,
  wheelDiameter?: number
): string[] {
  if (!profile) return [];
  
  const rec = getRecommendationForLiftHeight(profile, liftInches);
  
  if (!wheelDiameter) {
    return rec.commonTireSizes;
  }
  
  // Filter to sizes matching the wheel diameter
  return rec.commonTireSizes.filter((size) => {
    const rimMatch = size.match(/R(\d+)$/i) || size.match(/(\d+)$/);
    if (rimMatch) {
      return parseInt(rimMatch[1], 10) === wheelDiameter;
    }
    return false;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MINIMUM TIRE DIAMETER ENFORCEMENT (2026-05-05)
// Safety net to prevent undersized tire recommendations for lifted builds
// ═══════════════════════════════════════════════════════════════════════════

export type VehicleClass = "half-ton" | "midsize" | "hd" | "jeep-wrangler" | "suv" | "unknown";

/**
 * Determine vehicle class for lift-aware tire sizing
 */
export function getVehicleClass(make: string, model: string): VehicleClass {
  const m = make.toLowerCase().trim();
  const mod = model.toLowerCase().trim();
  
  // Jeep Wrangler - special case
  if (m === "jeep" && mod.includes("wrangler")) {
    return "jeep-wrangler";
  }
  
  // HD trucks (3/4 ton and 1 ton)
  if (
    mod.includes("2500") || mod.includes("3500") ||
    mod.includes("f-250") || mod.includes("f-350") ||
    mod.includes("f250") || mod.includes("f350") ||
    mod.includes("super duty") ||
    mod.includes("titan xd")
  ) {
    return "hd";
  }
  
  // Half-ton trucks
  if (
    mod.includes("f-150") || mod.includes("f150") ||
    mod === "1500" || mod.includes("silverado 1500") || mod.includes("sierra 1500") ||
    mod.includes("ram 1500") ||
    mod.includes("tundra") ||
    mod.includes("titan") // Non-XD Titan
  ) {
    return "half-ton";
  }
  
  // Midsize trucks
  if (
    mod.includes("tacoma") || mod.includes("colorado") || mod.includes("canyon") ||
    mod.includes("ranger") || mod.includes("frontier") || mod.includes("gladiator")
  ) {
    return "midsize";
  }
  
  // Full-size SUVs (treat like half-ton for tire sizing)
  if (
    mod.includes("tahoe") || mod.includes("yukon") ||
    mod.includes("suburban") || mod.includes("expedition") ||
    mod.includes("sequoia") || mod.includes("4runner") ||
    mod.includes("bronco")
  ) {
    return "suv";
  }
  
  return "unknown";
}

/**
 * Get minimum tire diameter (inches) based on vehicle class and lift height
 * 
 * Rules:
 * - Half-ton/SUV 2"/leveled: 33" min
 * - Half-ton/SUV 4": 34" min
 * - Half-ton/SUV 6"+: 35" min
 * - Midsize 2": 32" min
 * - Midsize 4": 33" min
 * - Midsize 6"+: 34" min (Tacoma/Colorado can't always fit 35")
 * - Jeep Wrangler 2": 33" min (Rubicon comes with 33s)
 * - Jeep Wrangler 4": 35" min
 * - Jeep Wrangler 6"+: 37" min
 * - HD 2": 35" min
 * - HD 4": 35" min
 * - HD 6"+: 37" min
 */
export function getMinTireDiameterForLift(
  vehicleClass: VehicleClass,
  liftInches: number
): number {
  const isLeveled = liftInches <= 2.5;
  const is4Inch = liftInches > 2.5 && liftInches <= 4.5;
  const is6Inch = liftInches > 4.5;
  
  switch (vehicleClass) {
    case "half-ton":
    case "suv":
      if (isLeveled) return 33;
      if (is4Inch) return 34;
      return 35; // 6"+
      
    case "midsize":
      if (isLeveled) return 32;
      if (is4Inch) return 33;
      return 34; // 6"+ (34" is more realistic for midsize)
      
    case "jeep-wrangler":
      if (isLeveled) return 33;
      if (is4Inch) return 35;
      return 37; // 6"+
      
    case "hd":
      if (isLeveled) return 35;
      if (is4Inch) return 35;
      return 37; // 6"+
      
    default:
      // Unknown vehicle - use conservative half-ton rules
      if (isLeveled) return 32;
      if (is4Inch) return 33;
      return 35;
  }
}

/**
 * Parse tire diameter from a tire size string
 * Handles both flotation (35x12.50R20) and P-metric (305/55R20) formats
 */
export function parseTireDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  
  const size = tireSize.trim().toUpperCase();
  
  // Flotation format: "35x12.50R20", "33X12.50R20LT"
  const flotationMatch = size.match(/^(\d+(?:\.\d+)?)[xX][\d.]+R\d+/);
  if (flotationMatch) {
    return parseFloat(flotationMatch[1]);
  }
  
  // P-metric format: "305/55R20", "285/70R17"
  // Diameter = (width * aspect / 100 * 2 / 25.4) + rim
  const pMetricMatch = size.match(/^(\d+)\/(\d+)R(\d+)/);
  if (pMetricMatch) {
    const width = parseInt(pMetricMatch[1], 10);
    const aspect = parseInt(pMetricMatch[2], 10);
    const rim = parseInt(pMetricMatch[3], 10);
    const sidewallInches = (width * aspect / 100) / 25.4;
    const diameter = sidewallInches * 2 + rim;
    return Math.round(diameter * 10) / 10;
  }
  
  return null;
}

export interface LiftedTireFilterResult {
  /** Tire sizes meeting minimum diameter */
  validSizes: string[];
  /** Tire sizes below minimum (kept for fallback) */
  belowMinSizes: string[];
  /** Minimum diameter enforced */
  minDiameter: number;
  /** Vehicle class used */
  vehicleClass: VehicleClass;
  /** Whether we had to use below-min sizes as fallback */
  usedFallback: boolean;
}

/**
 * Filter tire sizes by minimum diameter for lifted builds
 * Returns sizes meeting the minimum, with fallback tracking
 */
export function filterTiresByMinDiameter(
  tireSizes: string[],
  make: string,
  model: string,
  liftInches: number
): LiftedTireFilterResult {
  const vehicleClass = getVehicleClass(make, model);
  const minDiameter = getMinTireDiameterForLift(vehicleClass, liftInches);
  
  const validSizes: string[] = [];
  const belowMinSizes: string[] = [];
  
  for (const size of tireSizes) {
    const diameter = parseTireDiameter(size);
    if (diameter !== null && diameter >= minDiameter) {
      validSizes.push(size);
    } else {
      belowMinSizes.push(size);
    }
  }
  
  // If no valid sizes, use below-min as fallback
  const usedFallback = validSizes.length === 0 && belowMinSizes.length > 0;
  
  return {
    validSizes: usedFallback ? belowMinSizes : validSizes,
    belowMinSizes,
    minDiameter,
    vehicleClass,
    usedFallback,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TIRE DIAMETER BAND ENFORCEMENT
// For lifted package recommendations, we need both min AND max enforcement
// to prevent showing oversized tires (e.g., 37" on a 4" lift HD truck)
// ═══════════════════════════════════════════════════════════════════════════

export interface TireDiameterBand {
  minDiameter: number;
  maxDiameter: number;
  preferredDiameter: number;
}

/**
 * Get tire diameter band (min, max, preferred) for lifted builds
 * 
 * Rules (per user requirements):
 * - half-ton 2": 33"
 * - half-ton 4": 34–35"
 * - half-ton 6": 35–37"
 * - midsize 2": 32–33"
 * - midsize 4": 33–34"
 * - midsize 6": 35"
 * - Jeep Wrangler 2": 33"
 * - Jeep Wrangler 4": 35"
 * - Jeep Wrangler 6": 37"
 * - HD truck 2": 35"
 * - HD truck 4": 35" (NO 37" in primary results!)
 * - HD truck 6": 37"
 */
export function getTireDiameterBandForLift(
  vehicleClass: VehicleClass,
  liftInches: number
): TireDiameterBand {
  const isLeveled = liftInches <= 2.5;
  const is4Inch = liftInches > 2.5 && liftInches <= 4.5;
  const is6Inch = liftInches > 4.5;
  
  switch (vehicleClass) {
    case "half-ton":
    case "suv":
      if (isLeveled) return { minDiameter: 33, maxDiameter: 33, preferredDiameter: 33 };
      if (is4Inch) return { minDiameter: 34, maxDiameter: 35, preferredDiameter: 35 };
      return { minDiameter: 35, maxDiameter: 37, preferredDiameter: 35 }; // 6"+
      
    case "midsize":
      if (isLeveled) return { minDiameter: 32, maxDiameter: 33, preferredDiameter: 33 };
      if (is4Inch) return { minDiameter: 33, maxDiameter: 34, preferredDiameter: 33 };
      return { minDiameter: 35, maxDiameter: 35, preferredDiameter: 35 }; // 6"+
      
    case "jeep-wrangler":
      if (isLeveled) return { minDiameter: 33, maxDiameter: 33, preferredDiameter: 33 };
      if (is4Inch) return { minDiameter: 35, maxDiameter: 35, preferredDiameter: 35 };
      return { minDiameter: 37, maxDiameter: 37, preferredDiameter: 37 }; // 6"+
      
    case "hd":
      // CRITICAL: HD truck 4" should show 35", NOT 37"
      if (isLeveled) return { minDiameter: 35, maxDiameter: 35, preferredDiameter: 35 };
      if (is4Inch) return { minDiameter: 35, maxDiameter: 35, preferredDiameter: 35 }; // NOT 37!
      return { minDiameter: 37, maxDiameter: 37, preferredDiameter: 37 }; // 6"+
      
    default:
      // Unknown vehicle - use conservative rules
      if (isLeveled) return { minDiameter: 32, maxDiameter: 33, preferredDiameter: 33 };
      if (is4Inch) return { minDiameter: 33, maxDiameter: 35, preferredDiameter: 35 };
      return { minDiameter: 35, maxDiameter: 37, preferredDiameter: 35 };
  }
}

/**
 * Get maximum tire diameter for lifted builds
 * Used to filter out oversized tires from primary package results
 */
export function getMaxTireDiameterForLift(
  vehicleClass: VehicleClass,
  liftInches: number
): number {
  const band = getTireDiameterBandForLift(vehicleClass, liftInches);
  return band.maxDiameter;
}

/**
 * Get preferred tire diameter for lifted builds
 * Used to prioritize certain sizes in search results
 */
export function getPreferredTireDiameterForLift(
  vehicleClass: VehicleClass,
  liftInches: number
): number {
  const band = getTireDiameterBandForLift(vehicleClass, liftInches);
  return band.preferredDiameter;
}

export interface LiftedTireFilterWithBandResult {
  /** Tire sizes within the diameter band */
  validSizes: string[];
  /** Tire sizes below minimum (kept for fallback) */
  belowMinSizes: string[];
  /** Tire sizes above maximum (aggressive/may require trimming) */
  aboveMaxSizes: string[];
  /** Minimum diameter enforced */
  minDiameter: number;
  /** Maximum diameter enforced */
  maxDiameter: number;
  /** Preferred diameter for this setup */
  preferredDiameter: number;
  /** Vehicle class used */
  vehicleClass: VehicleClass;
  /** Whether we had to use below-min sizes as fallback */
  usedBelowMinFallback: boolean;
  /** Whether we had to use above-max sizes as fallback */
  usedAboveMaxFallback: boolean;
}

/**
 * Filter tire sizes by diameter band (min AND max) for lifted builds
 * Returns sizes within the band, with fallback tracking for both ends
 */
export function filterTiresByDiameterBand(
  tireSizes: string[],
  make: string,
  model: string,
  liftInches: number,
  aggressiveMode: boolean = false
): LiftedTireFilterWithBandResult {
  const vehicleClass = getVehicleClass(make, model);
  const band = getTireDiameterBandForLift(vehicleClass, liftInches);
  
  const validSizes: string[] = [];
  const belowMinSizes: string[] = [];
  const aboveMaxSizes: string[] = [];
  
  for (const size of tireSizes) {
    const diameter = parseTireDiameter(size);
    if (diameter === null) {
      // Can't parse - include in valid to be safe
      validSizes.push(size);
      continue;
    }
    
    if (diameter < band.minDiameter) {
      belowMinSizes.push(size);
    } else if (diameter > band.maxDiameter && !aggressiveMode) {
      // Above max - only include if aggressiveMode is enabled
      aboveMaxSizes.push(size);
    } else {
      validSizes.push(size);
    }
  }
  
  // Fallback logic - DO NOT use undersized tires
  // If no valid sizes, we DON'T fall back to belowMin - that would recommend undersized tires
  // Instead, return empty and let the caller generate proper flotation sizes
  const usedBelowMinFallback = false; // NEVER use undersized tires
  const usedAboveMaxFallback = validSizes.length === 0 && !usedBelowMinFallback && aboveMaxSizes.length > 0;
  
  let finalSizes = validSizes;
  // Only fall back to above-max if aggressive mode is eventually enabled by user
  if (usedAboveMaxFallback) {
    finalSizes = aboveMaxSizes;
  }
  
  return {
    validSizes: finalSizes,
    belowMinSizes,
    aboveMaxSizes,
    minDiameter: band.minDiameter,
    maxDiameter: band.maxDiameter,
    preferredDiameter: band.preferredDiameter,
    vehicleClass,
    usedBelowMinFallback,
    usedAboveMaxFallback,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UI HELPER: Get recommended tire diameter label for lifted builds
// Use this in merchandising/UI instead of hardcoded LIFT_LEVELS.targetTireSizes
// ═══════════════════════════════════════════════════════════════════════════

export interface LiftedTireRecommendation {
  /** Display label for "Most customers choose" UI (e.g., "35-37") */
  displayLabel: string;
  /** Preferred tire diameter (for primary recommendation) */
  preferredDiameter: number;
  /** Min diameter for this setup */
  minDiameter: number;
  /** Max diameter for this setup */
  maxDiameter: number;
  /** Vehicle class used */
  vehicleClass: VehicleClass;
}

/**
 * Get recommended tire diameter for UI merchandising.
 * 
 * CRITICAL: Use this instead of hardcoded LIFT_LEVELS.targetTireSizes
 * to ensure vehicle-class-aware recommendations.
 * 
 * @param make Vehicle make
 * @param model Vehicle model
 * @param liftInches Lift height in inches
 * @returns Recommendation with display label and diameter band
 */
export function getLiftedTireRecommendation(
  make: string,
  model: string,
  liftInches: number
): LiftedTireRecommendation {
  const vehicleClass = getVehicleClass(make, model);
  const band = getTireDiameterBandForLift(vehicleClass, liftInches);
  
  // Build display label (e.g., "35-37" or just "35")
  const displayLabel = band.minDiameter === band.maxDiameter
    ? String(band.preferredDiameter)
    : `${band.minDiameter}-${band.maxDiameter}`;
  
  return {
    displayLabel,
    preferredDiameter: band.preferredDiameter,
    minDiameter: band.minDiameter,
    maxDiameter: band.maxDiameter,
    vehicleClass,
  };
}
