/**
 * Wheel Size Gate Decision Helper
 * 
 * Confidence-aware trigger for wheel-size selector step.
 * Only shows step when we have HIGH CONFIDENCE that the selected trim
 * truly has multiple valid OEM wheel diameters.
 * 
 * DATA SOURCES (in priority order):
 * 1. vehicle_fitment_configurations table (highest confidence) - SERVER ONLY
 * 2. Verified platform patterns (known multi-diameter setups)
 * 3. API diameter data with heuristics (lowest confidence)
 * 
 * NOTE: This file is imported by client components (SteppedVehicleSelector).
 * The async version with DB access is in wheelSizeGateDecisionServer.ts
 * 
 * NON-NEGOTIABLE: NO REGRESSION. Do not weaken fitment safety.
 */

export type WheelSizeGateReason = 
  | 'config_exact'         // From configuration table with high confidence
  | 'trim_exact'           // Trim has verified multi-diameter data
  | 'verified_pattern'     // Matches known multi-diameter platform/trim
  | 'single_size'          // Only one diameter available
  | 'default_skip'         // Insufficient confidence, skip for UX
  | 'insufficient_data';   // No data available

export interface WheelSizeGateDecision {
  show: boolean;
  reason: WheelSizeGateReason;
  options: number[];       // Wheel diameters if show=true
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Verified multi-diameter patterns
 * 
 * These are vehicle configurations we KNOW have multiple OEM wheel options
 * that require user selection. Add patterns as we verify them.
 * 
 * Format: { make, model?, trim?, years?, diameters }
 */
interface VerifiedPattern {
  make: string;
  model?: string;
  trim?: string | RegExp;
  years?: { min: number; max: number };
  diameters: number[];  // Expected OEM diameters
  notes?: string;
}

const VERIFIED_MULTI_DIAMETER_PATTERNS: VerifiedPattern[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CADILLAC - Premium SUVs with 22"/24" options
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: 'cadillac',
    model: 'escalade',
    years: { min: 2021, max: 2030 },
    diameters: [22, 24],
    notes: 'All Escalade trims offer 22" standard, 24" optional',
  },
  {
    make: 'cadillac',
    model: 'escalade esv',
    years: { min: 2021, max: 2030 },
    diameters: [22, 24],
    notes: 'ESV same wheel options as standard Escalade',
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GMC - Denali/AT4 platforms with wheel options
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: 'gmc',
    model: 'yukon',
    trim: /denali|at4/i,
    years: { min: 2021, max: 2030 },
    diameters: [22, 24],
    notes: 'Denali Ultimate gets 24", others 22"',
  },
  {
    make: 'gmc',
    model: 'yukon xl',
    trim: /denali|at4/i,
    years: { min: 2021, max: 2030 },
    diameters: [22, 24],
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CHEVROLET - Full-size SUVs
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: 'chevrolet',
    model: 'tahoe',
    trim: /high country|rst|premier/i,
    years: { min: 2021, max: 2030 },
    diameters: [22, 24],
    notes: 'High Country/RST offer 22"/24" options',
  },
  {
    make: 'chevrolet',
    model: 'suburban',
    trim: /high country|rst|premier/i,
    years: { min: 2021, max: 2030 },
    diameters: [22, 24],
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LINCOLN - Navigator with wheel packages
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: 'lincoln',
    model: 'navigator',
    years: { min: 2018, max: 2030 },
    diameters: [22, 24],
    notes: 'Black Label gets 24", others 22"',
  },
  {
    make: 'lincoln',
    model: 'navigator l',
    years: { min: 2018, max: 2030 },
    diameters: [22, 24],
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FORD - Expedition high trims
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: 'ford',
    model: 'expedition',
    trim: /platinum|king ranch|limited/i,
    years: { min: 2018, max: 2030 },
    diameters: [22, 24],
    notes: 'Platinum gets 24" option',
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RAM - 1500 Limited/Longhorn with 22" option
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: 'ram',
    model: '1500',
    trim: /limited|longhorn|rebel/i,
    years: { min: 2019, max: 2030 },
    diameters: [20, 22],
    notes: 'Limited/Longhorn offer 22" wheel package',
  },
];

/**
 * Check if vehicle matches a verified multi-diameter pattern
 */
function matchesVerifiedPattern(
  year: number,
  make: string,
  model: string,
  trim?: string
): VerifiedPattern | null {
  const makeLower = make.toLowerCase();
  const modelLower = model.toLowerCase();
  const trimLower = trim?.toLowerCase() || '';
  
  for (const pattern of VERIFIED_MULTI_DIAMETER_PATTERNS) {
    // Check make
    if (pattern.make !== makeLower) continue;
    
    // Check model (if specified)
    if (pattern.model && !modelLower.includes(pattern.model)) continue;
    
    // Check years (if specified)
    if (pattern.years) {
      if (year < pattern.years.min || year > pattern.years.max) continue;
    }
    
    // Check trim (if specified)
    if (pattern.trim) {
      if (pattern.trim instanceof RegExp) {
        if (!pattern.trim.test(trimLower)) continue;
      } else if (!trimLower.includes(pattern.trim.toLowerCase())) {
        continue;
      }
    }
    
    // All checks passed
    return pattern;
  }
  
  return null;
}

/**
 * Main decision function for wheel-size gate
 * 
 * @param year - Vehicle year
 * @param make - Vehicle make
 * @param model - Vehicle model  
 * @param trim - Selected trim (displayTrim)
 * @param modificationId - Modification ID for exact matching
 * @param apiDiameters - Diameters returned from tire-sizes API
 * @param apiNeedsSelection - needsSelection flag from API
 * 
 * @returns Decision object with show, reason, options, confidence
 */
export function getWheelSizeGateDecision(params: {
  year: number;
  make: string;
  model: string;
  trim?: string;
  modificationId?: string;
  apiDiameters: number[];
  apiNeedsSelection: boolean;
}): WheelSizeGateDecision {
  const { year, make, model, trim, apiDiameters, apiNeedsSelection } = params;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CASE 1: No diameters or single diameter - skip
  // ═══════════════════════════════════════════════════════════════════════════
  if (!apiDiameters || apiDiameters.length === 0) {
    return {
      show: false,
      reason: 'insufficient_data',
      options: [],
      confidence: 'low',
    };
  }
  
  if (apiDiameters.length === 1) {
    return {
      show: false,
      reason: 'single_size',
      options: apiDiameters,
      confidence: 'high',
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CASE 2: Check verified patterns (HIGH CONFIDENCE)
  // ═══════════════════════════════════════════════════════════════════════════
  const verifiedPattern = matchesVerifiedPattern(year, make, model, trim);
  
  if (verifiedPattern) {
    // Filter API diameters to only include verified ones
    const verifiedDiameters = apiDiameters.filter(d => 
      verifiedPattern.diameters.includes(d)
    );
    
    if (verifiedDiameters.length > 1) {
      return {
        show: true,
        reason: 'verified_pattern',
        options: verifiedDiameters.sort((a, b) => a - b),
        confidence: 'high',
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CASE 3: Large diameter spread (22+ inches with 2+ inch gap)
  // This catches premium SUVs/trucks we haven't explicitly verified yet
  // ═══════════════════════════════════════════════════════════════════════════
  const minDia = Math.min(...apiDiameters);
  const maxDia = Math.max(...apiDiameters);
  const hasLargeDiameters = maxDia >= 22;
  const hasSignificantGap = (maxDia - minDia) >= 2;
  
  if (hasLargeDiameters && hasSignificantGap && apiDiameters.length === 2) {
    // Only 2 options with big gap (like 22/24) - likely real choice
    return {
      show: true,
      reason: 'verified_pattern', // Treat as pattern-matched
      options: apiDiameters.sort((a, b) => a - b),
      confidence: 'medium',
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CASE 4: Multiple diameters but low confidence
  // This is the aggregated-data case - skip for better UX
  // ═══════════════════════════════════════════════════════════════════════════
  // If we have 3+ diameter options spanning a wide range (e.g., 16/17/18/19),
  // this is almost certainly model-aggregated data, not trim-specific
  if (apiDiameters.length >= 3) {
    return {
      show: false,
      reason: 'default_skip',
      options: [],
      confidence: 'low',
    };
  }
  
  // 2 diameters with small gap (e.g., 17/18) - likely trim packages, but
  // not critical enough to ask. Default to smaller/more common.
  if (apiDiameters.length === 2 && (maxDia - minDia) <= 1) {
    return {
      show: false,
      reason: 'default_skip',
      options: [],
      confidence: 'low',
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT: Skip with low confidence
  // Better UX to not ask than to ask about uncertain data
  // ═══════════════════════════════════════════════════════════════════════════
  return {
    show: false,
    reason: 'default_skip',
    options: [],
    confidence: 'low',
  };
}

/**
 * Simplified check for components that just need show/hide
 */
export function shouldShowWheelSizeStep(params: {
  year: number;
  make: string;
  model: string;
  trim?: string;
  modificationId?: string;
  apiDiameters: number[];
  apiNeedsSelection: boolean;
}): boolean {
  return getWheelSizeGateDecision(params).show;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS FOR TESTING
// ═══════════════════════════════════════════════════════════════════════════
export const __test = {
  matchesVerifiedPattern,
  VERIFIED_MULTI_DIAMETER_PATTERNS,
};
