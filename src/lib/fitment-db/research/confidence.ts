/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FITMENT RESEARCH CONFIDENCE SCORING
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Calculates confidence scores for research findings based on:
 * - Source authority (manufacturer > supplier > reference > enthusiast)
 * - Cross-source agreement (multiple sources reporting same value)
 * - Data completeness (all required fields present)
 * 
 * @created 2026-03-28
 */

import type {
  RawFitmentFinding,
  ResearchSource,
  SourceAuthority,
  ConfidenceScore,
  ConfidenceLevel,
  FieldConfidence,
  FitmentFieldType,
  NormalizedFitmentCandidate,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHORITY WEIGHTS
// ═══════════════════════════════════════════════════════════════════════════════

const AUTHORITY_WEIGHTS: Record<SourceAuthority, number> = {
  manufacturer: 1.0,    // Full trust
  supplier: 0.85,       // High trust (WheelPros, etc.)
  reference: 0.7,       // Good trust (Tire Rack, etc.)
  enthusiast: 0.4,      // Moderate trust (forums)
  aggregator: 0.5,      // Moderate trust (may have errors)
  unknown: 0.2,         // Low trust
};

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED FIELDS
// ═══════════════════════════════════════════════════════════════════════════════

const REQUIRED_FIELDS: FitmentFieldType[] = [
  "boltPattern",
  "centerBore",
  "oemTireSize",
];

const IMPORTANT_FIELDS: FitmentFieldType[] = [
  "offsetMin",
  "offsetMax",
  "threadSize",
  "oemWheelSize",
];

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE AUTHORITY SCORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate source authority score (0-40 points)
 */
export function calculateSourceAuthorityScore(sources: ResearchSource[]): number {
  if (sources.length === 0) return 0;
  
  // Get the highest authority level
  const authorities = sources.map(s => AUTHORITY_WEIGHTS[s.authority]);
  const maxAuthority = Math.max(...authorities);
  
  // Bonus for having primary sources
  const hasPrimary = sources.some(s => s.isPrimary);
  const primaryBonus = hasPrimary ? 5 : 0;
  
  // Bonus for manufacturer/supplier sources
  const hasManufacturer = sources.some(s => s.authority === "manufacturer");
  const hasSupplier = sources.some(s => s.authority === "supplier");
  const tierBonus = hasManufacturer ? 10 : (hasSupplier ? 5 : 0);
  
  // Base score from max authority (0-25)
  const baseScore = maxAuthority * 25;
  
  return Math.min(40, baseScore + primaryBonus + tierBonus);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-SOURCE AGREEMENT SCORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate source agreement score (0-40 points)
 */
export function calculateSourceAgreementScore(findings: RawFitmentFinding[]): number {
  if (findings.length === 0) return 0;
  
  // Group findings by field
  const byField = new Map<FitmentFieldType, RawFitmentFinding[]>();
  for (const f of findings) {
    const existing = byField.get(f.field) || [];
    existing.push(f);
    byField.set(f.field, existing);
  }
  
  // Calculate agreement for each field
  let totalAgreement = 0;
  let fieldCount = 0;
  
  for (const [field, fieldFindings] of byField) {
    if (fieldFindings.length < 2) {
      // Single source - moderate confidence
      totalAgreement += 0.5;
    } else {
      // Check if values agree
      const values = fieldFindings.map(f => normalizeValueForComparison(f.value, field));
      const uniqueValues = new Set(values);
      
      if (uniqueValues.size === 1) {
        // Full agreement
        totalAgreement += 1.0;
      } else if (uniqueValues.size === 2) {
        // Partial agreement - might be rounding differences
        const majority = getMajorityValue(values);
        const majorityCount = values.filter(v => v === majority).length;
        totalAgreement += majorityCount / values.length * 0.8;
      } else {
        // Disagreement
        totalAgreement += 0.2;
      }
    }
    fieldCount++;
  }
  
  if (fieldCount === 0) return 0;
  
  // Average agreement, scaled to 40 points
  return (totalAgreement / fieldCount) * 40;
}

function normalizeValueForComparison(value: string, field: FitmentFieldType): string {
  // Normalize bolt patterns (6x139.7 vs 6x5.5)
  if (field === "boltPattern") {
    const lower = value.toLowerCase().replace(/\s/g, "");
    // Convert imperial to metric for comparison
    if (lower.includes("x5.5")) return lower.replace("x5.5", "x139.7");
    return lower;
  }
  
  // Normalize numeric values (remove units, round)
  if (["centerBore", "offsetMin", "offsetMax", "offsetTypical"].includes(field)) {
    const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
    return isNaN(num) ? value : num.toFixed(1);
  }
  
  return value.toLowerCase().trim();
}

function getMajorityValue(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let maxCount = 0;
  let majority = values[0];
  for (const [v, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      majority = v;
    }
  }
  return majority;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETENESS SCORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate data completeness score (0-20 points)
 */
export function calculateCompletenessScore(
  candidate: NormalizedFitmentCandidate | null
): number {
  if (!candidate) return 0;
  
  let score = 0;
  
  // Required fields (12 points)
  if (candidate.boltPattern) score += 4;
  if (candidate.centerBoreMm) score += 4;
  if (candidate.oemTireSizes.length > 0) score += 4;
  
  // Important fields (8 points)
  if (candidate.offsetMinMm !== undefined) score += 2;
  if (candidate.offsetMaxMm !== undefined) score += 2;
  if (candidate.threadSize) score += 2;
  if (candidate.oemWheelSizes.length > 0) score += 2;
  
  return score;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERALL CONFIDENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate overall confidence score
 */
export function calculateOverallConfidence(
  findings: RawFitmentFinding[],
  sources: ResearchSource[],
  candidate: NormalizedFitmentCandidate | null
): ConfidenceScore {
  const sourceAuthority = calculateSourceAuthorityScore(sources);
  const sourceAgreement = calculateSourceAgreementScore(findings);
  const completeness = calculateCompletenessScore(candidate);
  
  const totalScore = sourceAuthority + sourceAgreement + completeness;
  
  // Determine level
  let level: ConfidenceLevel;
  if (totalScore >= 70) {
    level = "high";
  } else if (totalScore >= 45) {
    level = "medium";
  } else {
    level = "low";
  }
  
  // Build reasoning
  const reasoning: string[] = [];
  
  // Source authority reasoning
  if (sourceAuthority >= 30) {
    reasoning.push("High-authority sources (manufacturer/supplier data available)");
  } else if (sourceAuthority >= 20) {
    reasoning.push("Moderate-authority sources (reference sites)");
  } else {
    reasoning.push("Low-authority sources (enthusiast/aggregator only)");
  }
  
  // Agreement reasoning
  if (sourceAgreement >= 30) {
    reasoning.push("Strong cross-source agreement on key fields");
  } else if (sourceAgreement >= 20) {
    reasoning.push("Moderate cross-source agreement");
  } else if (findings.length > 0) {
    reasoning.push("Limited or conflicting data across sources");
  }
  
  // Completeness reasoning
  if (completeness >= 16) {
    reasoning.push("All required and important fields populated");
  } else if (completeness >= 12) {
    reasoning.push("Required fields present, some optional fields missing");
  } else {
    reasoning.push("Missing required fields - needs additional research");
  }
  
  return {
    level,
    score: totalScore,
    factors: {
      sourceAuthority,
      sourceAgreement,
      completeness,
    },
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PER-FIELD CONFIDENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate confidence for each field
 */
export function calculateFieldConfidence(
  findings: RawFitmentFinding[]
): FieldConfidence[] {
  // Group by field
  const byField = new Map<FitmentFieldType, RawFitmentFinding[]>();
  for (const f of findings) {
    const existing = byField.get(f.field) || [];
    existing.push(f);
    byField.set(f.field, existing);
  }
  
  const results: FieldConfidence[] = [];
  
  for (const [field, fieldFindings] of byField) {
    // Get values and sources
    const values = fieldFindings.map(f => f.value);
    const normalized = values.map(v => normalizeValueForComparison(v, field));
    const sources = fieldFindings.map(f => f.source.name);
    const uniqueNormalized = [...new Set(normalized)];
    
    // Determine consensus value
    const consensusNormalized = getMajorityValue(normalized);
    const consensusIdx = normalized.indexOf(consensusNormalized);
    const consensusValue = values[consensusIdx];
    
    // Calculate confidence
    let confidence: ConfidenceLevel;
    const disagreements: string[] = [];
    
    if (uniqueNormalized.length === 1 && fieldFindings.length >= 2) {
      // Full agreement with multiple sources
      const maxAuthority = Math.max(
        ...fieldFindings.map(f => AUTHORITY_WEIGHTS[f.source.authority])
      );
      confidence = maxAuthority >= 0.7 ? "high" : "medium";
    } else if (uniqueNormalized.length === 1) {
      // Single source
      const authority = AUTHORITY_WEIGHTS[fieldFindings[0].source.authority];
      confidence = authority >= 0.85 ? "high" : (authority >= 0.5 ? "medium" : "low");
    } else {
      // Disagreement
      confidence = "low";
      for (let i = 0; i < values.length; i++) {
        if (normalized[i] !== consensusNormalized) {
          disagreements.push(`${sources[i]}: ${values[i]}`);
        }
      }
    }
    
    results.push({
      field,
      value: consensusValue,
      confidence,
      sourceCount: fieldFindings.length,
      sources,
      disagreements: disagreements.length > 0 ? disagreements : undefined,
    });
  }
  
  return results;
}
