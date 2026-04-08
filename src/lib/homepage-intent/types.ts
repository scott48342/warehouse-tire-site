/**
 * Homepage Intent System - Types
 * 
 * Defines the intent types and configurations for homepage-driven search flows.
 * These intents only activate when entry=homepage is present in URL params.
 */

export type HomepageIntentId = 
  | "street_performance"
  | "lifted_35"
  // Future intents:
  // | "daily_driver"
  // | "stock"
  // | "leveled"
  // | "offroad_33"
  ;

export type LiftLevel = "leveled" | "4in" | "6in" | "8in";

export interface LiftLevelConfig {
  id: LiftLevel;
  label: string;
  inches: number;
  offsetMin: number;
  offsetMax: number;
  targetTireSizes: string[]; // e.g., ["33", "35"]
}

export interface HomepageIntentConfig {
  id: HomepageIntentId;
  label: string;
  description: string;
  
  // Build configuration
  buildType?: "stock" | "level" | "lifted";
  
  // Lifted-specific
  liftLevel?: LiftLevel;
  liftLevelAdjustable?: boolean; // Show lift level chips
  
  // Staggered configuration
  staggeredPreference?: "auto" | "prefer" | "none";
  
  // Offset overrides
  offsetMin?: number;
  offsetMax?: number;
  
  // Target tire size (for lifted builds)
  targetTireSize?: string; // e.g., "35"
  
  // UI configuration
  chips?: IntentChip[];
}

export interface IntentChip {
  id: string;
  label: string;
  // What param(s) this chip sets when active
  params?: Record<string, string>;
  // Is this chip active by default for this intent?
  defaultActive?: boolean;
}

export interface HomepageIntentState {
  entry: "homepage" | null;
  intent: HomepageIntentId | null;
  config: HomepageIntentConfig | null;
  isActive: boolean;
  
  // Resolved values (after applying config + URL overrides)
  resolved: {
    buildType?: "stock" | "level" | "lifted";
    liftLevel?: LiftLevel;
    liftInches?: number;
    offsetMin?: number;
    offsetMax?: number;
    staggeredPreference?: "auto" | "prefer" | "none";
    targetTireSize?: string;
  };
}

export interface IntentUrlParams {
  entry?: string;
  intent?: string;
  // Allow overrides from URL
  liftLevel?: string;
  buildType?: string;
}
