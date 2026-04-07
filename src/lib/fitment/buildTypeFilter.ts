/**
 * Build Type Filter System
 * 
 * Filters and ranks wheels based on the selected build style:
 * - Stock: Conservative envelope, OEM-friendly
 * - Level: Moderate upgrades for leveled trucks/SUVs
 * - Lifted: Full aftermarket range with aggressive options
 * 
 * IMPORTANT: This does NOT hard-hide wheels. It:
 * 1. Ranks/prioritizes matching wheels higher
 * 2. Filters the default view (user can still drill into other options)
 */

import type { FitmentLevel, BuildRequirement } from "./guidance";

export type BuildType = "stock" | "level" | "lifted";

export interface WheelForBuildFilter {
  diameter?: string | number;
  width?: string | number;
  offset?: string | number;
  fitmentClass?: "surefit" | "specfit" | "extended";
  fitmentGuidance?: {
    level: FitmentLevel;
    buildRequirement: BuildRequirement;
  };
}

export interface OEMEnvelope {
  minDiameter?: number;
  maxDiameter?: number;
  minWidth?: number;
  maxWidth?: number;
  minOffset?: number;
  maxOffset?: number;
}

/**
 * Build type filter configuration
 */
export const BUILD_TYPE_CONFIG = {
  stock: {
    label: "Stock Fit",
    description: "Factory ride. No modifications needed.",
    // Envelope: OEM ±1" diameter, ±0.5" width, ±10mm offset
    diameterTolerance: 1,
    widthTolerance: 0.5,
    offsetTolerance: 10,
    // Preferred fitment levels
    preferredLevels: ["perfect", "recommended"] as FitmentLevel[],
    // Preferred build requirements
    preferredBuilds: ["stock"] as BuildRequirement[],
    // Score bonuses
    scoreBonus: {
      perfect: 100,
      recommended: 50,
      popular: 0,
      aggressive: -100, // Penalize aggressive fitment in stock mode
    },
  },
  level: {
    label: "Leveled",
    description: "Better stance. Minimal mods.",
    // Envelope: OEM +2" diameter, +1" width, -20mm to +10mm offset
    diameterTolerance: 2,
    widthTolerance: 1,
    offsetToleranceLow: 20, // More negative offset allowed
    offsetToleranceHigh: 10,
    // Preferred fitment levels
    preferredLevels: ["perfect", "recommended", "popular"] as FitmentLevel[],
    // Preferred build requirements
    preferredBuilds: ["stock", "level"] as BuildRequirement[],
    // Score bonuses
    scoreBonus: {
      perfect: 50,
      recommended: 100, // Level mode prefers recommended
      popular: 75,
      aggressive: -50,
    },
  },
  lifted: {
    label: "Lifted",
    description: "Big wheels. Wide stance. Maximum presence.",
    // Envelope: Wide open - show everything with guidance
    diameterTolerance: 6, // Up to +6" from OEM
    widthTolerance: 4, // Up to +4" width
    offsetToleranceLow: 80, // Deep negative offsets allowed
    offsetToleranceHigh: 20,
    // Preferred fitment levels
    preferredLevels: ["popular", "aggressive"] as FitmentLevel[],
    // Preferred build requirements
    preferredBuilds: ["level", "lift-small", "lift-large"] as BuildRequirement[],
    // Score bonuses
    scoreBonus: {
      perfect: 0,
      recommended: 25,
      popular: 75,
      aggressive: 100, // Lifted mode loves aggressive
    },
  },
} as const;

/**
 * Check if a wheel matches the build type envelope
 */
export function wheelMatchesBuildType(
  wheel: WheelForBuildFilter,
  buildType: BuildType,
  oemEnvelope: OEMEnvelope
): boolean {
  const config = BUILD_TYPE_CONFIG[buildType];
  
  const wheelDia = parseFloat(String(wheel.diameter || "0"));
  const wheelWidth = parseFloat(String(wheel.width || "0"));
  const wheelOffset = parseFloat(String(wheel.offset || "0"));
  
  if (!Number.isFinite(wheelDia) || !Number.isFinite(wheelWidth)) {
    return false; // Can't evaluate without specs
  }

  // Check diameter
  const maxDia = (oemEnvelope.maxDiameter ?? 20) + config.diameterTolerance;
  const minDia = Math.max(14, (oemEnvelope.minDiameter ?? 16) - 1); // Allow 1" smaller
  if (wheelDia > maxDia || wheelDia < minDia) {
    return false;
  }

  // Check width
  const maxWidth = (oemEnvelope.maxWidth ?? 8) + config.widthTolerance;
  const minWidth = Math.max(5, (oemEnvelope.minWidth ?? 6) - 0.5);
  if (wheelWidth > maxWidth || wheelWidth < minWidth) {
    return false;
  }

  // Check offset (only if we have offset data)
  if (Number.isFinite(wheelOffset) && oemEnvelope.minOffset != null && oemEnvelope.maxOffset != null) {
    const configAny = config as Record<string, unknown>;
    const offsetTolLow = (configAny.offsetToleranceLow as number) ?? (configAny.offsetTolerance as number) ?? 10;
    const offsetTolHigh = (configAny.offsetToleranceHigh as number) ?? (configAny.offsetTolerance as number) ?? 10;
    
    const minOff = oemEnvelope.minOffset - offsetTolLow;
    const maxOff = oemEnvelope.maxOffset + offsetTolHigh;
    
    if (wheelOffset < minOff || wheelOffset > maxOff) {
      return false;
    }
  }

  // For stock mode, also check fitment guidance if available
  if (buildType === "stock" && wheel.fitmentGuidance) {
    // Exclude aggressive fitment from stock mode default view
    if (wheel.fitmentGuidance.level === "aggressive") {
      return false;
    }
    // Exclude wheels that require lift/level
    const build = wheel.fitmentGuidance.buildRequirement;
    if (build === "lift-small" || build === "lift-large" || build === "level") {
      return false;
    }
  }

  // For level mode, exclude lift-required wheels
  if (buildType === "level" && wheel.fitmentGuidance) {
    const build = wheel.fitmentGuidance.buildRequirement;
    if (build === "lift-small" || build === "lift-large") {
      return false;
    }
  }

  return true;
}

/**
 * Calculate score bonus for a wheel based on build type preference
 */
export function getBuildTypeScoreBonus(
  wheel: WheelForBuildFilter,
  buildType: BuildType
): number {
  const config = BUILD_TYPE_CONFIG[buildType];
  let score = 0;

  // Add bonus based on fitment level
  if (wheel.fitmentGuidance?.level) {
    const levelBonus = config.scoreBonus[wheel.fitmentGuidance.level];
    score += levelBonus ?? 0;
  } else if (wheel.fitmentClass) {
    // Fallback to fitment class
    if (wheel.fitmentClass === "surefit") {
      score += buildType === "stock" ? 100 : 25;
    } else if (wheel.fitmentClass === "specfit") {
      score += buildType === "level" ? 75 : 50;
    } else if (wheel.fitmentClass === "extended") {
      score += buildType === "lifted" ? 75 : 10;
    }
  }

  // Add bonus for preferred build requirements
  if (wheel.fitmentGuidance?.buildRequirement) {
    const buildReq = wheel.fitmentGuidance.buildRequirement;
    if (config.preferredBuilds.includes(buildReq)) {
      score += 50;
    }
  }

  return score;
}

/**
 * Sort wheels by build type preference
 * Returns a comparator function for use with Array.sort()
 */
export function buildTypeSortComparator(buildType: BuildType | null) {
  return (a: WheelForBuildFilter, b: WheelForBuildFilter): number => {
    if (!buildType) return 0; // No preference, maintain existing order
    
    const scoreA = getBuildTypeScoreBonus(a, buildType);
    const scoreB = getBuildTypeScoreBonus(b, buildType);
    
    return scoreB - scoreA; // Higher score first
  };
}

/**
 * Filter and rank wheels for a build type
 */
export function filterWheelsForBuildType<T extends WheelForBuildFilter>(
  wheels: T[],
  buildType: BuildType | null,
  oemEnvelope: OEMEnvelope,
  options: {
    strictFilter?: boolean; // If true, exclude non-matching wheels; if false, just rank them lower
  } = {}
): T[] {
  if (!buildType) {
    return wheels; // No filter, return as-is
  }

  const { strictFilter = false } = options;

  // First, categorize wheels
  const matching: T[] = [];
  const nonMatching: T[] = [];

  for (const wheel of wheels) {
    if (wheelMatchesBuildType(wheel, buildType, oemEnvelope)) {
      matching.push(wheel);
    } else {
      nonMatching.push(wheel);
    }
  }

  // Sort matching wheels by build type score
  matching.sort(buildTypeSortComparator(buildType));

  if (strictFilter) {
    // Only return matching wheels
    return matching;
  }

  // Return matching first, then non-matching
  // (User can still see all wheels, but matching are prioritized)
  return [...matching, ...nonMatching];
}

/**
 * Get badges to emphasize based on build type
 */
export function getBadgeEmphasisForBuildType(buildType: BuildType | null): {
  emphasize: (FitmentLevel | BuildRequirement)[];
  deemphasize: (FitmentLevel | BuildRequirement)[];
} {
  switch (buildType) {
    case "stock":
      return {
        emphasize: ["perfect", "recommended", "stock"],
        deemphasize: ["aggressive", "lift-small", "lift-large"],
      };
    case "level":
      return {
        emphasize: ["recommended", "popular", "level", "stock"],
        deemphasize: ["lift-large"],
      };
    case "lifted":
      return {
        emphasize: ["aggressive", "popular", "lift-small", "lift-large", "may-trim"],
        deemphasize: [],
      };
    default:
      return {
        emphasize: [],
        deemphasize: [],
      };
  }
}
