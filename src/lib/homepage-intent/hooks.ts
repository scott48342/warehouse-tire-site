/**
 * Homepage Intent System - Hooks & Utilities
 * 
 * Provides utilities for reading and resolving homepage intent from URL params.
 * Server-side compatible (no React hooks - just pure functions).
 */

import type { 
  HomepageIntentState, 
  HomepageIntentId,
  LiftLevel,
} from "./types";
import { 
  getIntentConfig, 
  getLiftLevelConfig,
  isValidIntent,
  LIFT_LEVELS,
} from "./config";

/**
 * Parse homepage intent from URL search params (server-side compatible)
 * 
 * @param searchParams - URL search params object
 * @returns Resolved intent state
 */
export function parseHomepageIntent(
  searchParams: Record<string, string | string[] | undefined>
): HomepageIntentState {
  // Extract params
  const entryRaw = Array.isArray(searchParams.entry) 
    ? searchParams.entry[0] 
    : searchParams.entry;
  const intentRaw = Array.isArray(searchParams.intent) 
    ? searchParams.intent[0] 
    : searchParams.intent;
  const liftLevelRaw = Array.isArray(searchParams.liftLevel) 
    ? searchParams.liftLevel[0] 
    : searchParams.liftLevel;
  const buildTypeRaw = Array.isArray(searchParams.buildType)
    ? searchParams.buildType[0]
    : searchParams.buildType;

  // Check if intent is active
  const entry = entryRaw === "homepage" ? "homepage" : null;
  const intent = isValidIntent(intentRaw) ? intentRaw : null;
  const isActive = entry === "homepage" && intent !== null;

  // Get config if active
  const config = isActive ? getIntentConfig(intent) : null;

  // Build resolved state
  const resolved: HomepageIntentState["resolved"] = {};

  if (isActive && config) {
    // Start with config defaults
    resolved.buildType = config.buildType;
    resolved.staggeredPreference = config.staggeredPreference;
    resolved.targetTireSize = config.targetTireSize;

    // Handle lift level (URL override or config default)
    if (config.liftLevelAdjustable) {
      const liftLevel = (liftLevelRaw as LiftLevel) || config.liftLevel;
      const liftConfig = getLiftLevelConfig(liftLevel);
      
      if (liftConfig) {
        resolved.liftLevel = liftConfig.id;
        resolved.liftInches = liftConfig.inches;
        resolved.offsetMin = liftConfig.offsetMin;
        resolved.offsetMax = liftConfig.offsetMax;
      }
    } else if (config.liftLevel) {
      const liftConfig = getLiftLevelConfig(config.liftLevel);
      if (liftConfig) {
        resolved.liftLevel = liftConfig.id;
        resolved.liftInches = liftConfig.inches;
        resolved.offsetMin = config.offsetMin ?? liftConfig.offsetMin;
        resolved.offsetMax = config.offsetMax ?? liftConfig.offsetMax;
      }
    }

    // URL buildType override takes precedence
    if (buildTypeRaw === "stock" || buildTypeRaw === "level" || buildTypeRaw === "lifted") {
      resolved.buildType = buildTypeRaw;
    }
  }

  return {
    entry,
    intent,
    config,
    isActive,
    resolved,
  };
}

/**
 * Build URL with intent params preserved
 * 
 * @param basePath - Base path (e.g., "/wheels")
 * @param currentParams - Current URL params
 * @param newParams - New params to merge
 * @returns URL string with intent preserved
 */
export function buildIntentUrl(
  basePath: string,
  currentParams: Record<string, string | string[] | undefined>,
  newParams: Record<string, string | undefined> = {}
): string {
  const params = new URLSearchParams();

  // Preserve intent params
  const entry = Array.isArray(currentParams.entry) ? currentParams.entry[0] : currentParams.entry;
  const intent = Array.isArray(currentParams.intent) ? currentParams.intent[0] : currentParams.intent;
  
  if (entry) params.set("entry", entry);
  if (intent) params.set("intent", intent);

  // Merge new params
  for (const [key, value] of Object.entries(newParams)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Build initial intent URL for homepage blocks
 * 
 * @param intentId - The intent to activate
 * @returns URL to start the intent flow
 */
export function buildHomepageEntryUrl(intentId: HomepageIntentId): string {
  return `/wheels?entry=homepage&intent=${intentId}`;
}

/**
 * Get active chip ID for an intent based on current params
 */
export function getActiveChipId(
  intentState: HomepageIntentState,
  searchParams: Record<string, string | string[] | undefined>
): string | null {
  if (!intentState.isActive || !intentState.config?.chips) {
    return null;
  }

  const { config, resolved } = intentState;

  // For lifted builds, active chip is based on liftLevel
  if (config.liftLevelAdjustable && resolved.liftLevel) {
    return resolved.liftLevel;
  }

  // For street performance, check setup param
  const setup = Array.isArray(searchParams.setup) 
    ? searchParams.setup[0] 
    : searchParams.setup;
  
  if (setup === "staggered") return "staggered";
  if (setup === "square") return "square";

  // Return default active chip
  const defaultChip = config.chips?.find(c => c.defaultActive);
  return defaultChip?.id ?? null;
}

/**
 * Build URL when clicking an intent chip
 */
export function buildChipUrl(
  basePath: string,
  currentParams: Record<string, string | string[] | undefined>,
  chipParams: Record<string, string> | undefined
): string {
  const params = new URLSearchParams();

  // Copy all current params
  for (const [key, value] of Object.entries(currentParams)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v !== undefined && v !== "") {
      params.set(key, v);
    }
  }

  // Apply chip params (overwrite existing)
  if (chipParams) {
    for (const [key, value] of Object.entries(chipParams)) {
      params.set(key, value);
    }
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Get the lift levels for chip rendering
 */
export function getLiftLevels() {
  return Object.values(LIFT_LEVELS);
}
