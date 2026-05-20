/**
 * Wheel Candidate Evaluation Service
 * 
 * Evaluates wheel search results against known/inferred fitment profiles
 * for non-verified vehicles. This enables Jake to present wheel options
 * even when the exact diameter isn't in the "safe" list.
 * 
 * CORE PRINCIPLE:
 * Fallback/researched profiles should GUIDE searches, not BLOCK them.
 * Only explicitly blocked diameters should prevent search.
 * 
 * @created 2026-05-20
 */

// =============================================================================
// TYPES
// =============================================================================

export type DiameterCategory = 
  | "safe"        // Known safe, commonly verified
  | "common"      // Commonly used in the community
  | "aggressive"  // Possible but may need trimming/mods
  | "extreme"     // Risky, requires significant mods
  | "blocked"     // Explicitly unsafe, do not recommend
  | "unknown";    // No data - evaluate on merit

export type CandidateConfidence = "high" | "medium" | "low" | "unverified";

export interface WheelCandidate {
  sku: string;
  brand: string;
  model: string;
  diameter: number;
  width: number;
  offset: number;
  boltPattern: string;
  centerBore: number;
  
  // Evaluation results
  score: number;
  confidence: CandidateConfidence;
  matchFactors: MatchFactor[];
  caveats: string[];
  recommendation: "recommended" | "acceptable" | "caution" | "not_recommended";
}

export interface MatchFactor {
  factor: string;
  matched: boolean;
  score: number;  // 0-100
  note?: string;
}

export interface CandidateEvaluationRequest {
  // Vehicle info
  year: number;
  make: string;
  model: string;
  trim?: string;
  
  // Requested specs
  requestedDiameter: number;
  
  // Known fitment profile (from fallback/research/curated)
  knownProfile?: {
    boltPattern?: string;
    centerBore?: number;
    offsetRange?: { min: number; max: number };
    safeDiameters?: number[];
    commonDiameters?: number[];
    aggressiveDiameters?: number[];
    extremeDiameters?: number[];
    blockedDiameters?: number[];
    safeWidths?: number[];
    platform?: string;
  };
  
  // Platform knowledge (from enthusiast service)
  platformKnowledge?: {
    platformId?: string;
    platformName?: string;
    enthusiastDiameters?: {
      conservative?: number[];
      sweetSpot?: number[];
      aggressive?: number[];
      extreme?: number[];
    };
    offsetRange?: { safe: { min: number; max: number }; aggressive: { min: number; max: number } };
    staggeredCommon?: boolean;
    culturalNotes?: string[];
  };
  
  // Wheel search results to evaluate
  wheelResults: Array<{
    sku: string;
    brand?: string;
    model?: string;
    diameter: number;
    width: number;
    offset: number;
    boltPattern: string;
    centerBore?: number;
    inStock?: boolean;
    price?: number;
  }>;
}

export interface CandidateEvaluationResult {
  // Evaluated candidates
  candidates: WheelCandidate[];
  rejected: Array<{
    sku: string;
    reason: string;
    matchFactors: MatchFactor[];
  }>;
  
  // Overall assessment
  confidence: CandidateConfidence;
  diameterCategory: DiameterCategory;
  searchWasBlocked: boolean;
  blockReason?: string;
  
  // Messaging
  caveats: string[];
  recommendations: string[];
  
  // Analytics
  searchStrategyUsed: string[];
  evaluationStats: {
    totalResults: number;
    candidatesAccepted: number;
    candidatesRejected: number;
    avgScore: number;
    topScore: number;
  };
}

// =============================================================================
// SCORING WEIGHTS
// =============================================================================

const SCORING_WEIGHTS = {
  boltPatternMatch: 30,       // Critical - must match
  diameterMatch: 10,          // Already filtered, but confirm
  widthInRange: 15,           // Important for fitment
  offsetInRange: 20,          // Critical for rubbing
  centerBoreCompatible: 10,   // Hub-centric fit
  platformSupported: 10,      // Enthusiast knowledge
  inStock: 5,                 // Availability bonus
};

// =============================================================================
// CLASSIC MUSCLE CONFIDENCE MODE
// =============================================================================

/**
 * Classic GM muscle platforms with HUGE aftermarket support.
 * These platforms should have HIGH confidence for wheel searches
 * because 5x4.75 is one of the best-supported patterns in existence.
 */
const CLASSIC_MUSCLE_MODELS = [
  // A-body
  "nova", "chevelle", "malibu", "el camino", "monte carlo",
  "gto", "lemans", "tempest", "skylark", "gs", "cutlass", "442",
  // F-body (all generations)
  "camaro", "firebird", "trans am", "formula", "iroc", "gta",
  // B-body
  "impala", "caprice", "bel air", "biscayne",
  // G-body
  "grand national", "regal", "grand prix",
  // C10 trucks
  "c10", "c-10", "c20", "c-20", "k10", "k-10",
];

const CLASSIC_MUSCLE_BOLT_PATTERNS = [
  "5x120.65", "5x4.75",  // Classic GM muscle
  "5x127", "5x5",        // Classic GM trucks
  "5x120",               // Close enough (modern GM)
];

/**
 * Check if a vehicle is a classic GM muscle platform
 */
export function isClassicMusclePlatform(
  year: number,
  make: string,
  model: string,
  boltPattern?: string
): { isClassicMuscle: boolean; reason?: string; enthusiastNote?: string } {
  const normalizedMake = make.toLowerCase();
  const normalizedModel = model.toLowerCase();
  
  // Check make
  const gmMakes = ["chevrolet", "chevy", "pontiac", "buick", "oldsmobile", "olds", "gmc"];
  if (!gmMakes.some(m => normalizedMake.includes(m))) {
    return { isClassicMuscle: false };
  }
  
  // Check model
  const modelMatch = CLASSIC_MUSCLE_MODELS.some(m => 
    normalizedModel.includes(m) || normalizedModel.replace(/[^a-z0-9]/g, "").includes(m.replace(/[^a-z0-9]/g, ""))
  );
  
  if (!modelMatch) {
    return { isClassicMuscle: false };
  }
  
  // Check bolt pattern if provided
  if (boltPattern) {
    const normalizedPattern = boltPattern.toLowerCase();
    const patternMatch = CLASSIC_MUSCLE_BOLT_PATTERNS.some(p => 
      normalizedPattern.includes(p) || p.includes(normalizedPattern)
    );
    
    if (!patternMatch) {
      return { isClassicMuscle: false };
    }
  }
  
  // Determine specific note based on model
  let enthusiastNote = "Classic GM muscle platform - huge aftermarket support";
  
  if (normalizedModel.includes("nova")) {
    enthusiastNote = "Nova is one of the most popular pro-touring platforms ever - tons of wheel options";
  } else if (normalizedModel.includes("chevelle")) {
    enthusiastNote = "Chevelle is a pro-touring legend - 5x4.75 = endless wheel choices";
  } else if (normalizedModel.includes("camaro")) {
    enthusiastNote = "Camaro platform shares wheels with Corvettes and all classic GM muscle";
  } else if (normalizedModel.includes("firebird") || normalizedModel.includes("trans am")) {
    enthusiastNote = "Firebird/Trans Am shares the same bolt pattern as Corvettes and Camaros - huge selection";
  } else if (normalizedModel.includes("c10") || normalizedModel.includes("c-10")) {
    enthusiastNote = "C10 is the hottest classic truck platform - 5x5 has amazing aftermarket support";
  } else if (normalizedModel.includes("monte carlo")) {
    enthusiastNote = "Monte Carlo has a massive following - pro touring and street builds everywhere";
  } else if (normalizedModel.includes("el camino")) {
    enthusiastNote = "El Camino shares the A-body platform - 5x4.75 = tons of options";
  } else if (normalizedModel.includes("grand national")) {
    enthusiastNote = "Grand National is a G-body legend - same pattern as all classic GM muscle";
  } else if (normalizedModel.includes("impala")) {
    enthusiastNote = "Impala is iconic - huge aftermarket from pro-touring to donk builds";
  }
  
  return {
    isClassicMuscle: true,
    reason: `${year} ${make} ${model} is a classic GM muscle platform with 5x4.75 bolt pattern`,
    enthusiastNote,
  };
}

/**
 * Get realistic pro-touring diameter range for classic muscle
 */
export function getClassicMuscleDiameterRange(): {
  conservative: number[];
  sweetSpot: number[];
  aggressive: number[];
  extreme: number[];
} {
  return {
    conservative: [17, 18],
    sweetSpot: [18, 19, 20],
    aggressive: [20, 22],
    extreme: [22, 24],
  };
}

// =============================================================================
// EVALUATION LOGIC
// =============================================================================

/**
 * Determine diameter category based on profile and platform knowledge
 */
export function getDiameterCategory(
  diameter: number,
  profile?: CandidateEvaluationRequest["knownProfile"],
  platform?: CandidateEvaluationRequest["platformKnowledge"]
): DiameterCategory {
  // Check explicit blocks first
  if (profile?.blockedDiameters?.includes(diameter)) {
    return "blocked";
  }
  
  // Check safe diameters
  if (profile?.safeDiameters?.includes(diameter)) {
    return "safe";
  }
  
  // Check common diameters
  if (profile?.commonDiameters?.includes(diameter)) {
    return "common";
  }
  
  // Check aggressive diameters
  if (profile?.aggressiveDiameters?.includes(diameter)) {
    return "aggressive";
  }
  
  // Check extreme diameters
  if (profile?.extremeDiameters?.includes(diameter)) {
    return "extreme";
  }
  
  // Check platform knowledge
  if (platform?.enthusiastDiameters) {
    const { conservative, sweetSpot, aggressive, extreme } = platform.enthusiastDiameters;
    
    if (conservative?.includes(diameter) || sweetSpot?.includes(diameter)) {
      return "common";
    }
    if (aggressive?.includes(diameter)) {
      return "aggressive";
    }
    if (extreme?.includes(diameter)) {
      return "extreme";
    }
  }
  
  // Unknown - evaluate on merit
  return "unknown";
}

/**
 * Determine if a diameter is too extreme to even search
 */
export function isDiameterBlocked(
  diameter: number,
  profile?: CandidateEvaluationRequest["knownProfile"],
  platform?: CandidateEvaluationRequest["platformKnowledge"]
): { blocked: boolean; reason?: string } {
  // Explicit blocks
  if (profile?.blockedDiameters?.includes(diameter)) {
    return { blocked: true, reason: "Diameter explicitly blocked for this vehicle" };
  }
  
  // Extreme sanity checks
  if (diameter > 28) {
    return { blocked: true, reason: "Diameter exceeds maximum reasonable size (28\")" };
  }
  if (diameter < 13) {
    return { blocked: true, reason: "Diameter below minimum reasonable size (13\")" };
  }
  
  // Check if WAY outside known range
  const knownDiameters = [
    ...(profile?.safeDiameters || []),
    ...(profile?.commonDiameters || []),
    ...(profile?.aggressiveDiameters || []),
    ...(profile?.extremeDiameters || []),
    ...(platform?.enthusiastDiameters?.conservative || []),
    ...(platform?.enthusiastDiameters?.sweetSpot || []),
    ...(platform?.enthusiastDiameters?.aggressive || []),
    ...(platform?.enthusiastDiameters?.extreme || []),
  ];
  
  if (knownDiameters.length > 0) {
    const maxKnown = Math.max(...knownDiameters);
    const minKnown = Math.min(...knownDiameters);
    
    // Block if more than 4" larger than max known extreme
    if (diameter > maxKnown + 4) {
      return { 
        blocked: true, 
        reason: `Diameter ${diameter}" is significantly larger than known range (max ${maxKnown}")` 
      };
    }
    
    // Block if more than 4" smaller than min known
    if (diameter < minKnown - 4) {
      return { 
        blocked: true, 
        reason: `Diameter ${diameter}" is significantly smaller than known range (min ${minKnown}")` 
      };
    }
  }
  
  return { blocked: false };
}

/**
 * Infer reasonable offset range based on profile, platform, or defaults
 */
function inferOffsetRange(
  profile?: CandidateEvaluationRequest["knownProfile"],
  platform?: CandidateEvaluationRequest["platformKnowledge"]
): { min: number; max: number; source: string } {
  // Use profile offset range if available
  if (profile?.offsetRange) {
    return { ...profile.offsetRange, source: "profile" };
  }
  
  // Use platform safe offset range
  if (platform?.offsetRange?.safe) {
    return { ...platform.offsetRange.safe, source: "platform_safe" };
  }
  
  // Use platform aggressive range as fallback
  if (platform?.offsetRange?.aggressive) {
    return { ...platform.offsetRange.aggressive, source: "platform_aggressive" };
  }
  
  // Default reasonable range for aftermarket wheels
  return { min: -20, max: 60, source: "default" };
}

/**
 * Infer reasonable width range based on diameter and profile
 */
function inferWidthRange(
  diameter: number,
  profile?: CandidateEvaluationRequest["knownProfile"]
): { min: number; max: number } {
  // If we have safe widths, use them as a guide
  if (profile?.safeWidths && profile.safeWidths.length > 0) {
    const minSafe = Math.min(...profile.safeWidths);
    const maxSafe = Math.max(...profile.safeWidths);
    // Allow some variance
    return { min: minSafe - 1, max: maxSafe + 2 };
  }
  
  // General guidelines based on diameter
  // Larger diameters tend to run wider
  if (diameter >= 22) {
    return { min: 8.5, max: 14 };
  } else if (diameter >= 20) {
    return { min: 8, max: 12 };
  } else if (diameter >= 18) {
    return { min: 7.5, max: 11 };
  } else if (diameter >= 16) {
    return { min: 6.5, max: 10 };
  } else {
    return { min: 6, max: 9 };
  }
}

/**
 * Evaluate a single wheel against the fitment profile
 */
function evaluateWheel(
  wheel: CandidateEvaluationRequest["wheelResults"][0],
  request: CandidateEvaluationRequest,
  offsetRange: { min: number; max: number; source: string },
  widthRange: { min: number; max: number }
): WheelCandidate | { rejected: true; reason: string; matchFactors: MatchFactor[] } {
  const matchFactors: MatchFactor[] = [];
  let totalScore = 0;
  const caveats: string[] = [];
  
  // 1. Bolt pattern match (critical)
  const boltPatternMatches = request.knownProfile?.boltPattern 
    ? normalizeBoltPattern(wheel.boltPattern) === normalizeBoltPattern(request.knownProfile.boltPattern)
    : true; // If unknown, don't penalize
  
  matchFactors.push({
    factor: "Bolt Pattern",
    matched: boltPatternMatches,
    score: boltPatternMatches ? SCORING_WEIGHTS.boltPatternMatch : 0,
    note: boltPatternMatches ? `Matches ${request.knownProfile?.boltPattern}` : "Bolt pattern mismatch",
  });
  
  if (!boltPatternMatches && request.knownProfile?.boltPattern) {
    return {
      rejected: true,
      reason: `Bolt pattern ${wheel.boltPattern} doesn't match ${request.knownProfile.boltPattern}`,
      matchFactors,
    };
  }
  
  totalScore += boltPatternMatches ? SCORING_WEIGHTS.boltPatternMatch : 0;
  
  // 2. Diameter match (should be pre-filtered, but verify)
  const diameterMatches = wheel.diameter === request.requestedDiameter;
  matchFactors.push({
    factor: "Diameter",
    matched: diameterMatches,
    score: diameterMatches ? SCORING_WEIGHTS.diameterMatch : 0,
  });
  totalScore += diameterMatches ? SCORING_WEIGHTS.diameterMatch : 0;
  
  // 3. Width in range
  const widthInRange = wheel.width >= widthRange.min && wheel.width <= widthRange.max;
  const widthScore = widthInRange ? SCORING_WEIGHTS.widthInRange : SCORING_WEIGHTS.widthInRange * 0.3;
  
  matchFactors.push({
    factor: "Width",
    matched: widthInRange,
    score: widthScore,
    note: widthInRange 
      ? `${wheel.width}" is within range ${widthRange.min}-${widthRange.max}"` 
      : `${wheel.width}" outside typical range ${widthRange.min}-${widthRange.max}"`,
  });
  
  if (!widthInRange) {
    if (wheel.width > widthRange.max) {
      caveats.push(`Width ${wheel.width}" is wider than typical - verify fender clearance`);
    } else {
      caveats.push(`Width ${wheel.width}" is narrower than typical`);
    }
  }
  
  totalScore += widthScore;
  
  // 4. Offset in range (critical for rubbing)
  const offsetInRange = wheel.offset >= offsetRange.min && wheel.offset <= offsetRange.max;
  const offsetScore = offsetInRange ? SCORING_WEIGHTS.offsetInRange : SCORING_WEIGHTS.offsetInRange * 0.2;
  
  matchFactors.push({
    factor: "Offset",
    matched: offsetInRange,
    score: offsetScore,
    note: offsetInRange 
      ? `+${wheel.offset}mm is within range ${offsetRange.min} to ${offsetRange.max}mm` 
      : `+${wheel.offset}mm is outside typical range ${offsetRange.min} to ${offsetRange.max}mm`,
  });
  
  if (!offsetInRange) {
    if (wheel.offset < offsetRange.min) {
      caveats.push(`Offset +${wheel.offset}mm is aggressive - may cause rubbing at full lock or require fender work`);
    } else {
      caveats.push(`Offset +${wheel.offset}mm is high - wheel will sit further inboard`);
    }
    
    // Reject if WAY outside range
    if (wheel.offset < offsetRange.min - 30 || wheel.offset > offsetRange.max + 20) {
      return {
        rejected: true,
        reason: `Offset +${wheel.offset}mm is too far outside safe range (${offsetRange.min} to ${offsetRange.max}mm)`,
        matchFactors,
      };
    }
  }
  
  totalScore += offsetScore;
  
  // 5. Center bore compatibility
  let centerBoreCompatible = true;
  if (request.knownProfile?.centerBore && wheel.centerBore) {
    // Wheel center bore must be >= vehicle hub to fit
    // If smaller, won't physically mount
    // If larger, needs hub-centric rings (acceptable)
    centerBoreCompatible = wheel.centerBore >= request.knownProfile.centerBore;
    
    if (wheel.centerBore > request.knownProfile.centerBore + 15) {
      caveats.push(`Hub-centric rings recommended (wheel bore ${wheel.centerBore}mm > hub ${request.knownProfile.centerBore}mm)`);
    }
  }
  
  matchFactors.push({
    factor: "Center Bore",
    matched: centerBoreCompatible,
    score: centerBoreCompatible ? SCORING_WEIGHTS.centerBoreCompatible : 0,
    note: centerBoreCompatible 
      ? (wheel.centerBore ? `${wheel.centerBore}mm compatible` : "Center bore not specified")
      : `Wheel bore ${wheel.centerBore}mm is smaller than hub ${request.knownProfile?.centerBore}mm`,
  });
  
  if (!centerBoreCompatible) {
    return {
      rejected: true,
      reason: `Wheel center bore ${wheel.centerBore}mm is smaller than hub bore ${request.knownProfile?.centerBore}mm - won't fit`,
      matchFactors,
    };
  }
  
  totalScore += centerBoreCompatible ? SCORING_WEIGHTS.centerBoreCompatible : 0;
  
  // 6. Platform knowledge support
  let platformSupported = false;
  if (request.platformKnowledge?.platformId) {
    const { enthusiastDiameters } = request.platformKnowledge;
    const allPlatformDiameters = [
      ...(enthusiastDiameters?.conservative || []),
      ...(enthusiastDiameters?.sweetSpot || []),
      ...(enthusiastDiameters?.aggressive || []),
      ...(enthusiastDiameters?.extreme || []),
    ];
    platformSupported = allPlatformDiameters.includes(wheel.diameter);
  }
  
  matchFactors.push({
    factor: "Platform Knowledge",
    matched: platformSupported,
    score: platformSupported ? SCORING_WEIGHTS.platformSupported : SCORING_WEIGHTS.platformSupported * 0.5,
    note: platformSupported 
      ? `${wheel.diameter}" is known for ${request.platformKnowledge?.platformName}`
      : "No specific platform data for this diameter",
  });
  
  totalScore += platformSupported ? SCORING_WEIGHTS.platformSupported : SCORING_WEIGHTS.platformSupported * 0.5;
  
  // 7. In stock bonus
  const inStock = wheel.inStock !== false;
  matchFactors.push({
    factor: "In Stock",
    matched: inStock,
    score: inStock ? SCORING_WEIGHTS.inStock : 0,
  });
  totalScore += inStock ? SCORING_WEIGHTS.inStock : 0;
  
  // Calculate confidence based on score and factors
  let confidence: CandidateConfidence;
  if (totalScore >= 85) {
    confidence = "high";
  } else if (totalScore >= 70) {
    confidence = "medium";
  } else if (totalScore >= 50) {
    confidence = "low";
  } else {
    confidence = "unverified";
  }
  
  // Determine recommendation
  let recommendation: WheelCandidate["recommendation"];
  if (totalScore >= 85 && caveats.length === 0) {
    recommendation = "recommended";
  } else if (totalScore >= 70) {
    recommendation = "acceptable";
  } else if (totalScore >= 50) {
    recommendation = "caution";
  } else {
    recommendation = "not_recommended";
  }
  
  return {
    sku: wheel.sku,
    brand: wheel.brand || "Unknown",
    model: wheel.model || "Unknown",
    diameter: wheel.diameter,
    width: wheel.width,
    offset: wheel.offset,
    boltPattern: wheel.boltPattern,
    centerBore: wheel.centerBore || 0,
    score: totalScore,
    confidence,
    matchFactors,
    caveats,
    recommendation,
  };
}

/**
 * Normalize bolt pattern for comparison
 * e.g., "5x4.75" -> "5x120.65", "5X120.65" -> "5x120.65"
 */
function normalizeBoltPattern(pattern: string): string {
  if (!pattern) return "";
  
  let normalized = pattern.toLowerCase().trim();
  
  // Convert imperial to metric
  const imperialPatterns: Record<string, string> = {
    "5x4.75": "5x120.65",
    "5x4.5": "5x114.3",
    "5x5": "5x127",
    "5x5.5": "5x139.7",
    "6x5.5": "6x139.7",
    "8x6.5": "8x165.1",
    "8x170": "8x170",
  };
  
  if (imperialPatterns[normalized]) {
    normalized = imperialPatterns[normalized];
  }
  
  return normalized;
}

// =============================================================================
// MAIN EVALUATION FUNCTION
// =============================================================================

/**
 * Evaluate wheel candidates against known/inferred fitment profile
 */
export function evaluateWheelCandidates(
  request: CandidateEvaluationRequest
): CandidateEvaluationResult {
  const startTime = Date.now();
  const searchStrategyUsed: string[] = [];
  
  // 1. Check if diameter is blocked
  const blockCheck = isDiameterBlocked(
    request.requestedDiameter, 
    request.knownProfile, 
    request.platformKnowledge
  );
  
  if (blockCheck.blocked) {
    return {
      candidates: [],
      rejected: [],
      confidence: "unverified",
      diameterCategory: "blocked",
      searchWasBlocked: true,
      blockReason: blockCheck.reason,
      caveats: [blockCheck.reason || "Diameter blocked"],
      recommendations: [
        "Consider a different wheel size that's known to work with this vehicle",
      ],
      searchStrategyUsed: ["blocked"],
      evaluationStats: {
        totalResults: 0,
        candidatesAccepted: 0,
        candidatesRejected: 0,
        avgScore: 0,
        topScore: 0,
      },
    };
  }
  
  // 2. Determine diameter category
  const diameterCategory = getDiameterCategory(
    request.requestedDiameter,
    request.knownProfile,
    request.platformKnowledge
  );
  
  searchStrategyUsed.push(`diameter_category:${diameterCategory}`);
  
  // 3. Infer offset and width ranges
  const offsetRange = inferOffsetRange(request.knownProfile, request.platformKnowledge);
  const widthRange = inferWidthRange(request.requestedDiameter, request.knownProfile);
  
  searchStrategyUsed.push(`offset_source:${offsetRange.source}`);
  
  // 4. Evaluate each wheel
  const candidates: WheelCandidate[] = [];
  const rejected: CandidateEvaluationResult["rejected"] = [];
  
  for (const wheel of request.wheelResults) {
    const result = evaluateWheel(wheel, request, offsetRange, widthRange);
    
    if ("rejected" in result) {
      rejected.push({
        sku: wheel.sku,
        reason: result.reason,
        matchFactors: result.matchFactors,
      });
    } else {
      candidates.push(result);
    }
  }
  
  // 5. Sort candidates by score
  candidates.sort((a, b) => b.score - a.score);
  
  // 6. Calculate stats
  const totalScore = candidates.reduce((sum, c) => sum + c.score, 0);
  const avgScore = candidates.length > 0 ? totalScore / candidates.length : 0;
  const topScore = candidates.length > 0 ? candidates[0].score : 0;
  
  // 7. Determine overall confidence
  let confidence: CandidateConfidence;
  if (diameterCategory === "safe" || diameterCategory === "common") {
    confidence = candidates.length > 0 && avgScore >= 75 ? "high" : "medium";
  } else if (diameterCategory === "aggressive") {
    confidence = "medium";
  } else if (diameterCategory === "extreme") {
    confidence = "low";
  } else {
    // Unknown diameter
    confidence = candidates.length > 0 && avgScore >= 70 ? "medium" : "low";
  }
  
  searchStrategyUsed.push(`confidence:${confidence}`);
  
  // 8. Build caveats based on diameter category
  const caveats: string[] = [];
  const recommendations: string[] = [];
  
  if (diameterCategory === "unknown") {
    caveats.push(`${request.requestedDiameter}" is not in our verified profile for this vehicle`);
    caveats.push("These candidates are based on bolt pattern match and reasonable fitment ranges");
    recommendations.push("Verify final fitment clearance before purchase");
  } else if (diameterCategory === "aggressive") {
    caveats.push(`${request.requestedDiameter}" is an aggressive upgrade size`);
    caveats.push("May require minor trimming or fender rolling");
    recommendations.push("Double-check clearance with a professional installer");
  } else if (diameterCategory === "extreme") {
    caveats.push(`${request.requestedDiameter}" is an extreme size for this vehicle`);
    caveats.push("Significant modifications may be required");
    recommendations.push("Consult with a professional before purchasing");
    recommendations.push("Verify brake and suspension clearance");
  }
  
  // Add platform knowledge caveats if available
  if (request.platformKnowledge?.culturalNotes?.length) {
    const relevantNotes = request.platformKnowledge.culturalNotes.slice(0, 2);
    caveats.push(...relevantNotes);
  }
  
  // 9. Return results
  return {
    candidates,
    rejected,
    confidence,
    diameterCategory,
    searchWasBlocked: false,
    caveats,
    recommendations,
    searchStrategyUsed,
    evaluationStats: {
      totalResults: request.wheelResults.length,
      candidatesAccepted: candidates.length,
      candidatesRejected: rejected.length,
      avgScore: Math.round(avgScore * 10) / 10,
      topScore,
    },
  };
}

// =============================================================================
// HELPER: Should we attempt search for this diameter?
// =============================================================================

/**
 * Determine if we should attempt a wheel search for a given diameter
 * on a non-verified vehicle.
 * 
 * Returns true if search should proceed (even if diameter isn't in safeDiameters).
 * Returns false only if explicitly blocked or dangerously extreme.
 */
export function shouldAttemptSearch(
  diameter: number,
  profile?: CandidateEvaluationRequest["knownProfile"],
  platform?: CandidateEvaluationRequest["platformKnowledge"],
  vehicleInfo?: { year: number; make: string; model: string }
): { 
  shouldSearch: boolean; 
  reason: string; 
  category: DiameterCategory;
  isClassicMuscle?: boolean;
  enthusiastNote?: string;
} {
  const blockCheck = isDiameterBlocked(diameter, profile, platform);
  
  if (blockCheck.blocked) {
    return {
      shouldSearch: false,
      reason: blockCheck.reason || "Diameter blocked",
      category: "blocked",
    };
  }
  
  // Check for Classic Muscle Confidence Mode
  let classicMuscleCheck: ReturnType<typeof isClassicMusclePlatform> | null = null;
  if (vehicleInfo) {
    classicMuscleCheck = isClassicMusclePlatform(
      vehicleInfo.year, 
      vehicleInfo.make, 
      vehicleInfo.model,
      profile?.boltPattern
    );
  }
  
  // If it's classic muscle in pro-touring range (17-22), search with HIGH confidence
  if (classicMuscleCheck?.isClassicMuscle && diameter >= 17 && diameter <= 22) {
    const muscleRange = getClassicMuscleDiameterRange();
    
    let category: DiameterCategory = "common";
    if (muscleRange.sweetSpot.includes(diameter)) {
      category = "safe"; // Boost to "safe" for classic muscle sweet spots
    } else if (muscleRange.aggressive.includes(diameter)) {
      category = "common"; // Treat aggressive as common for these platforms
    } else if (muscleRange.extreme.includes(diameter)) {
      category = "aggressive"; // Treat extreme as just aggressive
    }
    
    return {
      shouldSearch: true,
      reason: `${diameter}" is a realistic pro-touring size for classic GM muscle - HUGE aftermarket support`,
      category,
      isClassicMuscle: true,
      enthusiastNote: classicMuscleCheck.enthusiastNote,
    };
  }
  
  const category = getDiameterCategory(diameter, profile, platform);
  
  // Always search for safe/common/aggressive/extreme - these are known
  if (["safe", "common", "aggressive", "extreme"].includes(category)) {
    return {
      shouldSearch: true,
      reason: `Diameter ${diameter}" is in the ${category} category for this platform`,
      category,
      isClassicMuscle: classicMuscleCheck?.isClassicMuscle,
      enthusiastNote: classicMuscleCheck?.enthusiastNote,
    };
  }
  
  // For unknown, search if we have bolt pattern
  if (profile?.boltPattern) {
    return {
      shouldSearch: true,
      reason: `Diameter ${diameter}" is not in profile, but bolt pattern ${profile.boltPattern} is known - evaluating candidates`,
      category: "unknown",
      isClassicMuscle: classicMuscleCheck?.isClassicMuscle,
      enthusiastNote: classicMuscleCheck?.enthusiastNote,
    };
  }
  
  // If we have platform knowledge, use that
  if (platform?.platformId) {
    return {
      shouldSearch: true,
      reason: `Diameter ${diameter}" is not in profile, but platform ${platform.platformName} is known - evaluating candidates`,
      category: "unknown",
      isClassicMuscle: classicMuscleCheck?.isClassicMuscle,
      enthusiastNote: classicMuscleCheck?.enthusiastNote,
    };
  }
  
  // No data at all - still search, but mark as unverified
  return {
    shouldSearch: true,
    reason: `Limited fitment data available - searching with basic compatibility checks`,
    category: "unknown",
    isClassicMuscle: classicMuscleCheck?.isClassicMuscle,
    enthusiastNote: classicMuscleCheck?.enthusiastNote,
  };
}

// =============================================================================
// ANALYTICS HELPER
// =============================================================================

export interface CandidateEvaluationAnalytics {
  timestamp: number;
  vehicleKey: string;
  requestedDiameter: number;
  diameterWasInProfile: boolean;
  diameterCategory: DiameterCategory;
  wheelResultsFound: number;
  candidatesAccepted: number;
  candidatesRejected: number;
  confidence: CandidateConfidence;
  caveats: string[];
  searchStrategyUsed: string[];
  topCandidateSku?: string;
  topCandidateScore?: number;
}

export function buildAnalytics(
  request: CandidateEvaluationRequest,
  result: CandidateEvaluationResult
): CandidateEvaluationAnalytics {
  const vehicleKey = `${request.year}|${request.make}|${request.model}`;
  
  const diameterWasInProfile = !!(
    request.knownProfile?.safeDiameters?.includes(request.requestedDiameter) ||
    request.knownProfile?.commonDiameters?.includes(request.requestedDiameter) ||
    request.knownProfile?.aggressiveDiameters?.includes(request.requestedDiameter)
  );
  
  return {
    timestamp: Date.now(),
    vehicleKey,
    requestedDiameter: request.requestedDiameter,
    diameterWasInProfile,
    diameterCategory: result.diameterCategory,
    wheelResultsFound: result.evaluationStats.totalResults,
    candidatesAccepted: result.evaluationStats.candidatesAccepted,
    candidatesRejected: result.evaluationStats.candidatesRejected,
    confidence: result.confidence,
    caveats: result.caveats,
    searchStrategyUsed: result.searchStrategyUsed,
    topCandidateSku: result.candidates[0]?.sku,
    topCandidateScore: result.candidates[0]?.score,
  };
}
