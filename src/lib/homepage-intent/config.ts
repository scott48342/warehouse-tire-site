/**
 * Homepage Intent System - Configuration
 * 
 * Defines the default configurations for each homepage intent.
 * These are applied when a user enters from a homepage block.
 */

import type { 
  HomepageIntentId, 
  HomepageIntentConfig, 
  LiftLevel,
  LiftLevelConfig 
} from "./types";

/**
 * Lift level configurations with offset ranges
 * These represent typical offset ranges for each lift height on trucks
 */
export const LIFT_LEVELS: Record<LiftLevel, LiftLevelConfig> = {
  leveled: {
    id: "leveled",
    label: "Leveled",
    inches: 2,
    offsetMin: -12,
    offsetMax: 0,
    targetTireSizes: ["32", "33"],
  },
  "4in": {
    id: "4in",
    label: '4" Lift',
    inches: 4,
    offsetMin: -24,
    offsetMax: -12,
    targetTireSizes: ["33", "35"],
  },
  "6in": {
    id: "6in",
    label: '6" Lift',
    inches: 6,
    offsetMin: -44,
    offsetMax: -18,
    targetTireSizes: ["35", "37"],
  },
  "8in": {
    id: "8in",
    label: '8" Lift',
    inches: 8,
    offsetMin: -54,
    offsetMax: -24,
    targetTireSizes: ["37", "40"],
  },
};

/**
 * Homepage intent configurations
 */
export const HOMEPAGE_INTENTS: Record<HomepageIntentId, HomepageIntentConfig> = {
  /**
   * Street Performance Intent
   * For users clicking the Street Performance 22" block
   * 
   * Behavior:
   * - Prefer staggered setups if vehicle supports it
   * - Show performance-oriented wheels (aggressive offsets, larger diameters)
   * - Chips for switching between staggered/square
   */
  street_performance: {
    id: "street_performance",
    label: "Street Performance",
    description: "Performance wheels for street builds",
    
    // No buildType override - use default OEM flow
    buildType: undefined,
    
    // Auto-detect staggered capability
    staggeredPreference: "auto",
    
    // UI chips
    chips: [
      { 
        id: "street_performance", 
        label: "Street Performance", 
        defaultActive: true,
      },
      { 
        id: "staggered", 
        label: "Staggered",
        params: { setup: "staggered" },
      },
      { 
        id: "square", 
        label: "Square",
        params: { setup: "square" },
      },
      { 
        id: "popular_upgrade", 
        label: "Popular Upgrade",
      },
    ],
  },

  /**
   * 35" Lifted Truck Intent
   * For users clicking the 35" Lifted Truck block
   * 
   * Behavior:
   * - Default to 6" lift with appropriate offsets
   * - Show lift level chips to adjust
   * - Skip the /lifted explainer, go straight to results
   */
  lifted_35: {
    id: "lifted_35",
    label: '35" Lifted Build',
    description: "Wheels for 35\" tire lifted truck builds",
    
    // Lifted build type
    buildType: "lifted",
    
    // Default to 6" lift
    liftLevel: "6in",
    liftLevelAdjustable: true,
    
    // 6" lift offset range
    offsetMin: LIFT_LEVELS["6in"].offsetMin,
    offsetMax: LIFT_LEVELS["6in"].offsetMax,
    
    // Target 35" tires
    targetTireSize: "35",
    
    // No staggered for trucks
    staggeredPreference: "none",
    
    // Lift level chips
    chips: [
      {
        id: "leveled",
        label: "Leveled",
        params: { liftLevel: "leveled" },
      },
      {
        id: "4in",
        label: '4" Lift',
        params: { liftLevel: "4in" },
      },
      {
        id: "6in",
        label: '6" Lift',
        params: { liftLevel: "6in" },
        defaultActive: true,
      },
      {
        id: "8in",
        label: '8" Lift',
        params: { liftLevel: "8in" },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: BUILD STYLE CARDS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Stock Fit Intent
   * For users clicking the Factory Build / Stock Fit block
   * 
   * Behavior:
   * - Prioritize perfect fit, OEM-compatible wheels
   * - Safe, confidence-building experience
   * - No aggressive or lifted suggestions
   */
  stock: {
    id: "stock",
    label: "Stock Fit",
    description: "Factory-compatible wheels that fit perfectly",
    
    buildType: "stock",
    staggeredPreference: "none",
    
    chips: [
      {
        id: "stock",
        label: "Stock Fit",
        defaultActive: true,
      },
      {
        id: "oem_plus",
        label: "OEM+",
      },
      {
        id: "perfect_fit",
        label: "Perfect Fit",
      },
      {
        id: "popular",
        label: "Popular",
      },
    ],
  },

  /**
   * Leveled Intent
   * For users clicking the Leveling Kit Build block
   * 
   * Behavior:
   * - Default to 2" level
   * - Mild offset range for leveled stance
   * - Not as aggressive as full lift
   */
  leveled: {
    id: "leveled",
    label: "Leveled Build",
    description: "Wheels for leveled trucks with better stance",
    
    buildType: "level",
    
    // Default to leveled (2")
    liftLevel: "leveled",
    liftLevelAdjustable: true,
    
    // Leveled offset range
    offsetMin: LIFT_LEVELS["leveled"].offsetMin,
    offsetMax: LIFT_LEVELS["leveled"].offsetMax,
    
    staggeredPreference: "none",
    
    chips: [
      {
        id: "stock",
        label: "Stock",
        params: { liftLevel: "stock" },
      },
      {
        id: "leveled",
        label: 'Level 1-2"',
        params: { liftLevel: "leveled" },
        defaultActive: true,
      },
      {
        id: "aggressive",
        label: "Aggressive",
      },
      {
        id: "popular_upgrade",
        label: "Popular Upgrade",
      },
    ],
  },

  /**
   * General Lifted Intent
   * For users clicking the Lifted Truck Build block
   * 
   * Behavior:
   * - Default to 4" lift (common entry point)
   * - Show lift level chips to adjust
   * - Goes straight to results, not explainer page
   */
  lifted: {
    id: "lifted",
    label: "Lifted Build",
    description: "Wheels for lifted trucks",
    
    buildType: "lifted",
    
    // Default to 4" lift (common entry point)
    liftLevel: "4in",
    liftLevelAdjustable: true,
    
    offsetMin: LIFT_LEVELS["4in"].offsetMin,
    offsetMax: LIFT_LEVELS["4in"].offsetMax,
    
    staggeredPreference: "none",
    
    chips: [
      {
        id: "leveled",
        label: "Leveled",
        params: { liftLevel: "leveled" },
      },
      {
        id: "4in",
        label: '4" Lift',
        params: { liftLevel: "4in" },
        defaultActive: true,
      },
      {
        id: "6in",
        label: '6" Lift',
        params: { liftLevel: "6in" },
      },
      {
        id: "8in",
        label: '8" Lift',
        params: { liftLevel: "8in" },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: FEATURED PACKAGES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Daily Driver Intent
   * For users clicking the 33" Daily Driver package block
   * 
   * Behavior:
   * - Practical, comfortable fitments
   * - All-season / highway friendly bias
   * - Square setups preferred
   * - Balanced pricing
   */
  daily_driver: {
    id: "daily_driver",
    label: "Daily Driver",
    description: "Practical wheel and tire packages for everyday use",
    
    // Mild level for daily use
    buildType: "level",
    liftLevel: "leveled",
    
    offsetMin: LIFT_LEVELS["leveled"].offsetMin,
    offsetMax: LIFT_LEVELS["leveled"].offsetMax,
    
    targetTireSize: "33",
    staggeredPreference: "none",
    
    chips: [
      {
        id: "daily_driver",
        label: "Daily Driver",
        defaultActive: true,
      },
      {
        id: "comfort",
        label: "Comfort",
      },
      {
        id: "long_life",
        label: "Long Life",
      },
      {
        id: "value",
        label: "Value",
      },
      {
        id: "oem_plus",
        label: "OEM+",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: SHOP BY CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * All-Terrain Tires Intent
   * For users clicking the All-Terrain Tires category
   * 
   * Behavior:
   * - Bias toward all-terrain tread types
   * - Truck/SUV relevance
   * - Useful upsizes where appropriate
   */
  all_terrain_tires: {
    id: "all_terrain_tires",
    label: "All-Terrain Tires",
    description: "All-terrain tires for trucks and SUVs",
    
    // Can work with any build type
    buildType: undefined,
    staggeredPreference: "none",
    
    chips: [
      {
        id: "all_terrain",
        label: "All-Terrain",
        defaultActive: true,
      },
      {
        id: "rugged_terrain",
        label: "Rugged Terrain",
      },
      {
        id: "daily_at",
        label: "Daily A/T",
      },
      {
        id: "33_inch",
        label: '33"',
      },
      {
        id: "35_inch",
        label: '35"',
      },
    ],
  },

  /**
   * Performance Tires Intent
   * For users clicking the Performance Tires category
   * 
   * Behavior:
   * - Summer / UHP / performance categories
   * - Staggered support when vehicle supports it
   * - Larger plus-size fitments
   */
  performance_tires: {
    id: "performance_tires",
    label: "Performance Tires",
    description: "High-performance tires for street driving",
    
    buildType: undefined,
    staggeredPreference: "auto",
    
    chips: [
      {
        id: "performance",
        label: "Performance",
        defaultActive: true,
      },
      {
        id: "summer",
        label: "Summer",
      },
      {
        id: "uhp",
        label: "UHP",
      },
      {
        id: "staggered",
        label: "Staggered",
        params: { setup: "staggered" },
      },
      {
        id: "square",
        label: "Square",
        params: { setup: "square" },
      },
    ],
  },

  /**
   * Truck Wheels Intent
   * For users clicking the Truck Wheels category
   * 
   * Behavior:
   * - Truck-friendly diameters and styles
   * - Proper fitment envelope
   * - Lifted/leveled-friendly options
   */
  truck_wheels: {
    id: "truck_wheels",
    label: "Truck Wheels",
    description: "Wheels designed for trucks and SUVs",
    
    buildType: undefined,
    staggeredPreference: "none",
    
    chips: [
      {
        id: "stock",
        label: "Stock",
        params: { buildType: "stock" },
      },
      {
        id: "level",
        label: "Level",
        params: { buildType: "level" },
      },
      {
        id: "lifted",
        label: "Lifted",
        params: { buildType: "lifted" },
      },
      {
        id: "popular",
        label: "Popular Truck Fits",
        defaultActive: true,
      },
    ],
  },

  /**
   * Street Wheels Intent
   * For users clicking the Street Wheels category
   * 
   * Behavior:
   * - Clean street styling
   * - Larger diameters when appropriate
   * - Staggered-ready when supported
   */
  street_wheels: {
    id: "street_wheels",
    label: "Street Wheels",
    description: "Street-style wheels for cars and trucks",
    
    buildType: undefined,
    staggeredPreference: "auto",
    
    chips: [
      {
        id: "street",
        label: "Street",
        defaultActive: true,
      },
      {
        id: "performance",
        label: "Performance",
      },
      {
        id: "staggered",
        label: "Staggered",
        params: { setup: "staggered" },
      },
      {
        id: "square",
        label: "Square",
        params: { setup: "square" },
      },
      {
        id: "popular_upgrade",
        label: "Popular Upgrade",
      },
    ],
  },

  /**
   * Lifted Packages Intent
   * For users clicking the Lifted Packages category
   * 
   * Behavior:
   * - Lifted-friendly wheel + tire combinations
   * - Package-ready results
   * - Common lifted targets (33"/35")
   */
  lifted_packages: {
    id: "lifted_packages",
    label: "Lifted Packages",
    description: "Wheel and tire packages for lifted builds",
    
    buildType: "lifted",
    
    // Default to 4" lift
    liftLevel: "4in",
    liftLevelAdjustable: true,
    
    offsetMin: LIFT_LEVELS["4in"].offsetMin,
    offsetMax: LIFT_LEVELS["4in"].offsetMax,
    
    staggeredPreference: "none",
    
    chips: [
      {
        id: "leveled",
        label: "Leveled",
        params: { liftLevel: "leveled" },
      },
      {
        id: "4in",
        label: '4" Lift',
        params: { liftLevel: "4in" },
        defaultActive: true,
      },
      {
        id: "6in",
        label: '6" Lift',
        params: { liftLevel: "6in" },
      },
      {
        id: "35_inch",
        label: '35"',
      },
      {
        id: "package_picks",
        label: "Package Picks",
      },
    ],
  },
};

/**
 * Get intent config by ID
 */
export function getIntentConfig(intentId: string | null | undefined): HomepageIntentConfig | null {
  if (!intentId) return null;
  return HOMEPAGE_INTENTS[intentId as HomepageIntentId] ?? null;
}

/**
 * Get lift level config by ID
 */
export function getLiftLevelConfig(liftLevel: string | null | undefined): LiftLevelConfig | null {
  if (!liftLevel) return null;
  return LIFT_LEVELS[liftLevel as LiftLevel] ?? null;
}

/**
 * Check if an intent ID is valid
 */
export function isValidIntent(intentId: string | null | undefined): intentId is HomepageIntentId {
  if (!intentId) return false;
  return intentId in HOMEPAGE_INTENTS;
}
