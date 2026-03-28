/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * VEHICLE FITMENT RULES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Structured rules for vehicle-specific fitment data that cannot be reliably
 * determined from APIs or inheritance. This file is the source of truth for
 * vehicles with known generation-specific or model-variant fitment differences.
 * 
 * IMPORTANT: These rules are applied BEFORE API fallback and inheritance.
 * They take precedence over external data sources.
 * 
 * @created 2026-03-28
 */

import { normalizeMake, normalizeModel } from "./normalization";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface FitmentRuleMatch {
  boltPattern: string;
  boltPatternImperial?: string; // e.g., "6x5.5" for 6x139.7
  centerBoreMm?: number;
  threadSize?: string;
  seatType?: string;
  offsetMin?: number;
  offsetMax?: number;
  notes?: string;
}

export interface FitmentRule {
  /** Make (normalized, lowercase) */
  make: string;
  /** Model (normalized, lowercase with hyphens) */
  model: string;
  /** Year range start (inclusive) */
  yearStart: number;
  /** Year range end (inclusive) */
  yearEnd: number;
  /** 
   * Optional model/trim qualifier for variants like "Classic".
   * If provided, raw model or trim must contain this string (case-insensitive).
   */
  modelQualifier?: string;
  /**
   * If true, this rule only applies when modelQualifier IS present.
   * If false (default), applies when modelQualifier is NOT present.
   */
  requireQualifier?: boolean;
  /** Generation name for documentation/display */
  generation?: string;
  /** Fitment specs to apply */
  fitment: FitmentRuleMatch;
  /** Rule priority (higher = checked first). Default: 0 */
  priority?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FITMENT RULES DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Master list of vehicle fitment rules.
 * 
 * Rules are matched in order of:
 * 1. Priority (descending)
 * 2. Specificity (qualifier rules > non-qualifier rules)
 * 3. Array order
 * 
 * First matching rule wins.
 */
export const VEHICLE_FITMENT_RULES: FitmentRule[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // RAM 1500 - Complex multi-generation with concurrent models
  // ═══════════════════════════════════════════════════════════════════════════
  
  // RAM 1500 CLASSIC (2019-2024) - Carryover 4th Gen DS platform
  // MUST be checked BEFORE the 5th gen rule since it overlaps in years
  {
    make: "ram",
    model: "1500",
    yearStart: 2019,
    yearEnd: 2024,
    modelQualifier: "classic",
    requireQualifier: true,
    generation: "4th Gen DS Classic (2019-2024)",
    priority: 100, // High priority - must match before generic 2019+ rule
    fitment: {
      boltPattern: "5x139.7",
      boltPatternImperial: "5x5.5",
      centerBoreMm: 77.8,
      threadSize: "14x1.5",
      seatType: "conical",
      offsetMin: 18,
      offsetMax: 35,
      notes: "RAM 1500 Classic is the carryover 4th gen truck sold 2019-2024 alongside the new DT platform",
    },
  },
  
  // RAM 1500 5th Gen / DT Platform (2019-2026)
  // 6-lug pattern - the "new" RAM 1500
  {
    make: "ram",
    model: "1500",
    yearStart: 2019,
    yearEnd: 2026,
    modelQualifier: "classic",
    requireQualifier: false, // Only match when "classic" is NOT present
    generation: "5th Gen DT (2019-2026)",
    priority: 90,
    fitment: {
      boltPattern: "6x139.7",
      boltPatternImperial: "6x5.5",
      centerBoreMm: 77.8,
      threadSize: "14x1.5",
      seatType: "conical",
      offsetMin: 18,
      offsetMax: 22,
      notes: "RAM 1500 5th gen (DT platform) switched to 6-lug pattern",
    },
  },
  
  // RAM 1500 4th Gen (2009-2018) - Original DS platform
  {
    make: "ram",
    model: "1500",
    yearStart: 2009,
    yearEnd: 2018,
    generation: "4th Gen DS (2009-2018)",
    fitment: {
      boltPattern: "5x139.7",
      boltPatternImperial: "5x5.5",
      centerBoreMm: 77.8,
      threadSize: "14x1.5",
      seatType: "conical",
      offsetMin: 18,
      offsetMax: 35,
      notes: "RAM 1500 4th gen (DS platform) uses 5-lug pattern",
    },
  },
  
  // RAM 1500 3rd Gen (2002-2008)
  {
    make: "ram",
    model: "1500",
    yearStart: 2002,
    yearEnd: 2008,
    generation: "3rd Gen (2002-2008)",
    fitment: {
      boltPattern: "5x139.7",
      boltPatternImperial: "5x5.5",
      centerBoreMm: 77.8,
      threadSize: "9/16-18",
      seatType: "conical",
      offsetMin: 10,
      offsetMax: 25,
      notes: "RAM 1500 3rd gen",
    },
  },
  
  // RAM 1500 2nd Gen (1994-2001)
  {
    make: "ram",
    model: "1500",
    yearStart: 1994,
    yearEnd: 2001,
    generation: "2nd Gen (1994-2001)",
    fitment: {
      boltPattern: "5x139.7",
      boltPatternImperial: "5x5.5",
      centerBoreMm: 77.8,
      threadSize: "9/16-18",
      seatType: "conical",
      offsetMin: 0,
      offsetMax: 25,
      notes: "RAM 1500 2nd gen (Dodge Ram)",
    },
  },
  
  // RAM 1500 1st Gen Late (1990-1993) - Also 5x139.7
  {
    make: "ram",
    model: "1500",
    yearStart: 1990,
    yearEnd: 1993,
    generation: "1st Gen Late (1990-1993)",
    fitment: {
      boltPattern: "5x139.7",
      boltPatternImperial: "5x5.5",
      centerBoreMm: 77.8,
      threadSize: "1/2-20",
      seatType: "conical",
      offsetMin: 0,
      offsetMax: 20,
      notes: "Dodge Ram 1500 1st gen late years",
    },
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Additional rules can be added here for other vehicles with known
  // generation-specific fitment requirements
  // ═══════════════════════════════════════════════════════════════════════════
];

// ═══════════════════════════════════════════════════════════════════════════════
// RULE MATCHING
// ═══════════════════════════════════════════════════════════════════════════════

export interface RuleMatchInput {
  year: number;
  make: string;
  model: string;
  /** Raw model string before normalization (may contain "Classic" etc.) */
  rawModel?: string;
  /** Trim string that may contain qualifiers */
  trim?: string;
  /** Modification ID that may contain qualifiers */
  modificationId?: string;
}

export interface RuleMatchResult {
  matched: boolean;
  rule: FitmentRule | null;
  reason: string;
}

/**
 * Check if a qualifier string is present in any of the vehicle identifiers
 */
function hasQualifier(
  qualifier: string,
  rawModel?: string,
  trim?: string,
  modificationId?: string
): boolean {
  const lowerQualifier = qualifier.toLowerCase();
  
  // Check raw model
  if (rawModel && rawModel.toLowerCase().includes(lowerQualifier)) {
    return true;
  }
  
  // Check trim
  if (trim && trim.toLowerCase().includes(lowerQualifier)) {
    return true;
  }
  
  // Check modification ID (may have "classic" in the slug)
  if (modificationId && modificationId.toLowerCase().includes(lowerQualifier)) {
    return true;
  }
  
  return false;
}

/**
 * Find the best matching fitment rule for a vehicle
 */
export function matchFitmentRule(input: RuleMatchInput): RuleMatchResult {
  const normalizedMake = normalizeMake(input.make);
  const normalizedModel = normalizeModel(input.make, input.model);
  
  // Sort rules by priority (descending) then by specificity
  const sortedRules = [...VEHICLE_FITMENT_RULES].sort((a, b) => {
    // Higher priority first
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    
    // Rules with qualifiers are more specific
    const aHasQualifier = a.modelQualifier ? 1 : 0;
    const bHasQualifier = b.modelQualifier ? 1 : 0;
    return bHasQualifier - aHasQualifier;
  });
  
  for (const rule of sortedRules) {
    // Check make
    if (rule.make !== normalizedMake) continue;
    
    // Check model
    if (rule.model !== normalizedModel) continue;
    
    // Check year range
    if (input.year < rule.yearStart || input.year > rule.yearEnd) continue;
    
    // Check qualifier if specified
    if (rule.modelQualifier) {
      const qualifierPresent = hasQualifier(
        rule.modelQualifier,
        input.rawModel,
        input.trim,
        input.modificationId
      );
      
      if (rule.requireQualifier && !qualifierPresent) {
        // Rule requires qualifier but it's not present - skip
        continue;
      }
      
      if (!rule.requireQualifier && qualifierPresent) {
        // Rule requires qualifier NOT present but it IS - skip
        continue;
      }
    }
    
    // All conditions matched
    return {
      matched: true,
      rule,
      reason: `Matched rule: ${rule.generation || `${rule.yearStart}-${rule.yearEnd}`}`,
    };
  }
  
  return {
    matched: false,
    rule: null,
    reason: "No matching fitment rule found",
  };
}

/**
 * Get fitment data from rules if a match exists
 * Returns null if no rule matches (fallback to API/DB)
 */
export function getFitmentFromRules(input: RuleMatchInput): FitmentRuleMatch | null {
  const result = matchFitmentRule(input);
  
  if (result.matched && result.rule) {
    console.log(`[vehicleFitmentRules] ${input.year} ${input.make} ${input.model}: ${result.reason}`);
    return result.rule.fitment;
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a RAM 1500 is a "Classic" model
 * Used for UI badges, search filtering, etc.
 */
export function isRam1500Classic(
  year: number,
  rawModel?: string,
  trim?: string,
  modificationId?: string
): boolean {
  // Only applicable for 2019-2024
  if (year < 2019 || year > 2024) return false;
  
  return hasQualifier("classic", rawModel, trim, modificationId);
}

/**
 * Get RAM 1500 generation info for display
 */
export function getRam1500GenerationInfo(
  year: number,
  rawModel?: string,
  trim?: string,
  modificationId?: string
): { generation: string; boltPattern: string; isClassic: boolean } | null {
  const result = matchFitmentRule({
    year,
    make: "ram",
    model: "1500",
    rawModel,
    trim,
    modificationId,
  });
  
  if (!result.matched || !result.rule) return null;
  
  return {
    generation: result.rule.generation || "Unknown",
    boltPattern: result.rule.fitment.boltPattern,
    isClassic: hasQualifier("classic", rawModel, trim, modificationId),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS FOR TESTING
// ═══════════════════════════════════════════════════════════════════════════════

export { hasQualifier };
