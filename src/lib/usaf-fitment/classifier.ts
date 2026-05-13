/**
 * USAF Enrichment Classifier
 * 
 * Confidence-gated classification for fitment enrichment candidates.
 * NO direct DB writes - exports for review/dry-run import only.
 */

import { normalizeTireSize, findEquivalentSizes, detectStaggeredPairs } from "./normalize";

// ============================================================================
// KNOWN NOISE PATTERNS
// ============================================================================

/** 
 * Brands/models requiring MANUAL review due to complex staggered configs
 */
const COMPLEX_STAGGERED_PATTERNS = [
  // Porsche - extensive staggered options
  { make: /porsche/i, model: /911|cayenne|panamera|macan|taycan|boxster|cayman/i },
  // BMW M and performance
  { make: /bmw/i, model: /m[2-8]|z4|i[48]/i },
  // American muscle
  { make: /ford/i, model: /mustang/i },
  { make: /chevrolet|chevy/i, model: /corvette|camaro/i },
  { make: /dodge/i, model: /challenger|charger/i },
  // Exotic
  { make: /lamborghini|ferrari|mclaren|aston martin|bentley|rolls-royce/i },
];

/**
 * HD truck models with SRW/DRW ambiguity
 */
const HD_TRUCK_PATTERNS = [
  { make: /ford/i, model: /f-?250|f-?350|f-?450|super duty/i },
  { make: /chevrolet|chevy|gmc/i, model: /silverado\s*(2500|3500)|sierra\s*(2500|3500)/i },
  { make: /ram/i, model: /2500|3500/i },
];

/**
 * Check if vehicle is a complex staggered type
 */
export function isComplexStaggeredVehicle(make: string, model: string): boolean {
  return COMPLEX_STAGGERED_PATTERNS.some(p => p.make.test(make) && p.model.test(model));
}

/**
 * Check if vehicle is an HD truck with SRW/DRW ambiguity
 */
export function isHDTruck(make: string, model: string): boolean {
  return HD_TRUCK_PATTERNS.some(p => p.make.test(make) && p.model.test(model));
}

/**
 * Check if a size is flotation format
 */
export function isFlotationSize(size: string): boolean {
  return /^\d{2,3}x\d/.test(size);
}

/**
 * Check if difference is notation-only (P, ZR, RF, LT suffix)
 */
export function isNotationOnlyDifference(size1: string, size2: string): boolean {
  const n1 = normalizeTireSize(size1);
  const n2 = normalizeTireSize(size2);
  
  if (!n1 || !n2) return false;
  
  // Same normalized base = notation difference only
  return n1.normalized === n2.normalized;
}

/**
 * Detect JSON artifacts in WTD data
 */
export function hasJsonArtifacts(sizes: string[]): boolean {
  return sizes.some(s => 
    /^\[/.test(s) || 
    /^"/.test(s) || 
    s.length === 1 ||  // Single characters
    /^[,\[\]"]$/.test(s)
  );
}

/**
 * Check if load range class is changing
 */
export function isLoadRangeChange(wtdSizes: string[], usafSize: string): boolean {
  const usafParsed = normalizeTireSize(usafSize);
  if (!usafParsed?.loadRange) return false;
  
  // Check if any WTD size has same base but different load range
  for (const wtdSize of wtdSizes) {
    const wtdParsed = normalizeTireSize(wtdSize);
    if (!wtdParsed) continue;
    
    if (wtdParsed.normalized === usafParsed.normalized && 
        wtdParsed.loadRange && 
        wtdParsed.loadRange !== usafParsed.loadRange) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// CLASSIFICATION TYPES
// ============================================================================

export type EnrichmentCategory = "auto_approve" | "bulk_review" | "manual_review" | "ignore";

export interface EnrichmentCandidate {
  year: number;
  make: string;
  model: string;
  
  // Sizes
  wtdSizes: string[];
  usafSizes: string[];
  missingFromWtd: string[];  // USAF has, WTD doesn't
  extraInWtd: string[];      // WTD has, USAF doesn't
  
  // Classification
  category: EnrichmentCategory;
  confidence: number;
  reasons: string[];
  
  // Proposed changes
  proposedAdditions: string[];
  
  // Flags
  isComplexStaggered: boolean;
  isHDTruck: boolean;
  hasFlotation: boolean;
  hasJsonArtifacts: boolean;
  hasLoadRangeChange: boolean;
  isNotationOnlyDiff: boolean;
  staggeredPairs: Array<{ front: string; rear: string; confidence: number }>;
  
  // Wheel diameter analysis
  wtdDiameters: number[];
  usafDiameters: number[];
  newDiameters: number[];  // Diameters in USAF not in WTD
}

export interface ClassificationResult {
  autoApprove: EnrichmentCandidate[];
  bulkReview: EnrichmentCandidate[];
  manualReview: EnrichmentCandidate[];
  ignore: EnrichmentCandidate[];
  
  stats: {
    total: number;
    autoApproveCount: number;
    bulkReviewCount: number;
    manualReviewCount: number;
    ignoreCount: number;
  };
}

// ============================================================================
// MAIN CLASSIFIER
// ============================================================================

/**
 * Classify a single vehicle's enrichment potential
 */
export function classifyEnrichment(
  year: number,
  make: string,
  model: string,
  wtdSizes: string[],
  usafSizes: string[],
  wtdTrims: string[] = []
): EnrichmentCandidate {
  const reasons: string[] = [];
  
  // Clean WTD sizes (remove JSON artifacts)
  const cleanWtdSizes = wtdSizes.filter(s => 
    s && typeof s === "string" && s.length > 3 && !/^[\[\]",]/.test(s)
  );
  
  // Dedupe USAF sizes
  const cleanUsafSizes = [...new Set(usafSizes)];
  
  // Find differences using normalized comparison
  const comparison = findEquivalentSizes(cleanWtdSizes, cleanUsafSizes);
  
  // Extract wheel diameters
  const wtdDiameters = extractDiameters(cleanWtdSizes);
  const usafDiameters = extractDiameters(cleanUsafSizes);
  const newDiameters = usafDiameters.filter(d => !wtdDiameters.includes(d));
  
  // Detect staggered pairs in USAF data
  const staggeredPairs = detectStaggeredPairs(cleanUsafSizes);
  
  // Flags
  const isComplex = isComplexStaggeredVehicle(make, model);
  const isHD = isHDTruck(make, model);
  const hasFlotation = cleanUsafSizes.some(isFlotationSize) || cleanWtdSizes.some(isFlotationSize);
  const jsonArtifacts = hasJsonArtifacts(wtdSizes);
  const hasLoadChange = comparison.usafOnly.some(s => isLoadRangeChange(cleanWtdSizes, s));
  
  // Check for notation-only differences
  let notationOnlyCount = 0;
  for (const usafSize of comparison.usafOnly) {
    for (const wtdSize of cleanWtdSizes) {
      if (isNotationOnlyDifference(usafSize, wtdSize)) {
        notationOnlyCount++;
        break;
      }
    }
  }
  const allNotationOnly = notationOnlyCount === comparison.usafOnly.length && comparison.usafOnly.length > 0;
  
  // Calculate base confidence
  let confidence = 50;
  
  // Boost confidence for clear cases
  if (comparison.common.length > 0) {
    confidence += 20;  // We have overlap
    reasons.push(`${comparison.common.length} common sizes`);
  }
  
  if (comparison.usafOnly.length > 0 && newDiameters.length === 0) {
    confidence += 15;  // New sizes but no new diameters
    reasons.push("New sizes use existing wheel diameters");
  }
  
  if (allNotationOnly) {
    confidence += 25;  // Just notation differences
    reasons.push("Notation-only differences (P/ZR/RF)");
  }
  
  if (cleanUsafSizes.length >= 3 && comparison.usafOnly.length <= 3) {
    confidence += 10;  // USAF has multiple OEM sizes, we're missing just a few
    reasons.push("USAF has multiple OEM options");
  }
  
  // Reduce confidence for risky cases
  if (isComplex) {
    confidence -= 20;
    reasons.push("Complex staggered vehicle");
  }
  
  if (isHD) {
    confidence -= 15;
    reasons.push("HD truck (SRW/DRW ambiguity)");
  }
  
  if (hasFlotation) {
    confidence -= 10;
    reasons.push("Has flotation sizes");
  }
  
  if (hasLoadChange) {
    confidence -= 15;
    reasons.push("Load range class change");
  }
  
  if (newDiameters.length > 0) {
    confidence -= 10;
    reasons.push(`New wheel diameter(s): ${newDiameters.join(", ")}"`);
  }
  
  if (comparison.wtdOnly.length > comparison.usafOnly.length && cleanUsafSizes.length > 0) {
    confidence -= 15;
    reasons.push(`WTD has ${comparison.wtdOnly.length} sizes USAF doesn't`);
  }
  
  if (staggeredPairs.length > 0 && !isComplex) {
    confidence += 5;  // Staggered pattern detected, helps with review
    reasons.push(`Staggered pairs detected: ${staggeredPairs.length}`);
  }
  
  if (jsonArtifacts) {
    reasons.push("JSON artifacts in WTD data - needs cleanup");
  }
  
  // Clamp confidence
  confidence = Math.max(0, Math.min(100, confidence));
  
  // Determine category
  let category: EnrichmentCategory;
  
  // Filter proposed additions (exclude notation-only)
  const proposedAdditions = comparison.usafOnly.filter(s => {
    // Don't add if it's just notation difference
    for (const wtdSize of cleanWtdSizes) {
      if (isNotationOnlyDifference(s, wtdSize)) {
        return false;
      }
    }
    return true;
  });
  
  if (proposedAdditions.length === 0) {
    category = "ignore";
    reasons.push("No new physical sizes to add");
  } else if (cleanUsafSizes.length === 0) {
    category = "ignore";
    reasons.push("USAF has no data for this vehicle");
  } else if (
    confidence >= 95 &&
    !isComplex &&
    !isHD &&
    !hasFlotation &&
    !hasLoadChange &&
    newDiameters.length === 0
  ) {
    category = "auto_approve";
  } else if (
    confidence >= 80 &&
    !isComplex &&
    !isHD
  ) {
    category = "bulk_review";
  } else {
    category = "manual_review";
  }
  
  // Force manual review for specific cases
  if (isComplex || isHD || hasFlotation || hasLoadChange) {
    if (category === "auto_approve" || category === "bulk_review") {
      category = "manual_review";
    }
  }
  
  return {
    year,
    make,
    model,
    wtdSizes: cleanWtdSizes,
    usafSizes: cleanUsafSizes,
    missingFromWtd: comparison.usafOnly,
    extraInWtd: comparison.wtdOnly,
    category,
    confidence,
    reasons,
    proposedAdditions,
    isComplexStaggered: isComplex,
    isHDTruck: isHD,
    hasFlotation,
    hasJsonArtifacts: jsonArtifacts,
    hasLoadRangeChange: hasLoadChange,
    isNotationOnlyDiff: allNotationOnly,
    staggeredPairs,
    wtdDiameters,
    usafDiameters,
    newDiameters,
  };
}

/**
 * Extract wheel diameters from tire sizes
 */
function extractDiameters(sizes: string[]): number[] {
  const diameters = new Set<number>();
  
  for (const size of sizes) {
    const parsed = normalizeTireSize(size);
    if (parsed?.rim) {
      diameters.add(parsed.rim);
    }
  }
  
  return [...diameters].sort((a, b) => a - b);
}

/**
 * Classify a batch of vehicles
 */
export function classifyBatch(
  vehicles: Array<{
    year: number;
    make: string;
    model: string;
    wtdSizes: string[];
    usafSizes: string[];
    wtdTrims?: string[];
  }>
): ClassificationResult {
  const autoApprove: EnrichmentCandidate[] = [];
  const bulkReview: EnrichmentCandidate[] = [];
  const manualReview: EnrichmentCandidate[] = [];
  const ignore: EnrichmentCandidate[] = [];
  
  for (const v of vehicles) {
    const candidate = classifyEnrichment(
      v.year,
      v.make,
      v.model,
      v.wtdSizes,
      v.usafSizes,
      v.wtdTrims
    );
    
    switch (candidate.category) {
      case "auto_approve":
        autoApprove.push(candidate);
        break;
      case "bulk_review":
        bulkReview.push(candidate);
        break;
      case "manual_review":
        manualReview.push(candidate);
        break;
      case "ignore":
        ignore.push(candidate);
        break;
    }
  }
  
  // Sort by confidence
  autoApprove.sort((a, b) => b.confidence - a.confidence);
  bulkReview.sort((a, b) => b.confidence - a.confidence);
  manualReview.sort((a, b) => b.confidence - a.confidence);
  
  return {
    autoApprove,
    bulkReview,
    manualReview,
    ignore,
    stats: {
      total: vehicles.length,
      autoApproveCount: autoApprove.length,
      bulkReviewCount: bulkReview.length,
      manualReviewCount: manualReview.length,
      ignoreCount: ignore.length,
    },
  };
}

/**
 * Generate dry-run export for a classification result
 */
export function generateDryRunExport(result: ClassificationResult): {
  timestamp: string;
  type: "usaf_dry_run_export";
  stats: ClassificationResult["stats"];
  autoApproveProposals: Array<{
    year: number;
    make: string;
    model: string;
    addSizes: string[];
    confidence: number;
    reasons: string[];
  }>;
  bulkReviewProposals: Array<{
    year: number;
    make: string;
    model: string;
    addSizes: string[];
    confidence: number;
    reasons: string[];
    flags: string[];
  }>;
  manualReviewFlags: Array<{
    year: number;
    make: string;
    model: string;
    reasons: string[];
    flags: string[];
  }>;
} {
  return {
    timestamp: new Date().toISOString(),
    type: "usaf_dry_run_export",
    stats: result.stats,
    
    autoApproveProposals: result.autoApprove.map(c => ({
      year: c.year,
      make: c.make,
      model: c.model,
      addSizes: c.proposedAdditions,
      confidence: c.confidence,
      reasons: c.reasons,
    })),
    
    bulkReviewProposals: result.bulkReview.map(c => ({
      year: c.year,
      make: c.make,
      model: c.model,
      addSizes: c.proposedAdditions,
      confidence: c.confidence,
      reasons: c.reasons,
      flags: [
        c.isComplexStaggered && "complex_staggered",
        c.isHDTruck && "hd_truck",
        c.hasFlotation && "flotation",
        c.hasLoadRangeChange && "load_range_change",
        c.newDiameters.length > 0 && `new_diameters:${c.newDiameters.join(",")}`,
      ].filter(Boolean) as string[],
    })),
    
    manualReviewFlags: result.manualReview.map(c => ({
      year: c.year,
      make: c.make,
      model: c.model,
      reasons: c.reasons,
      flags: [
        c.isComplexStaggered && "complex_staggered",
        c.isHDTruck && "hd_truck",
        c.hasFlotation && "flotation",
        c.hasLoadRangeChange && "load_range_change",
        c.hasJsonArtifacts && "json_artifacts",
        c.staggeredPairs.length > 0 && `staggered_pairs:${c.staggeredPairs.length}`,
      ].filter(Boolean) as string[],
    })),
  };
}
