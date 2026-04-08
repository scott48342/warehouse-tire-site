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
