/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FITMENT RESEARCH WORKFLOW
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Main workflow for researching vehicle fitment data.
 * This collects candidate data from web research and normalizes it into a
 * review queue—NEVER auto-inserting into production.
 * 
 * Workflow Steps:
 * 1. Input validation
 * 2. Web research (collect candidate sources)
 * 3. Normalization (convert to structured fields)
 * 4. Confidence scoring
 * 5. Validation
 * 6. Queue for review
 * 
 * @created 2026-03-28
 */

import { randomUUID } from "crypto";
import type {
  FitmentResearchInput,
  FitmentResearchRecord,
  RawFitmentFinding,
  ResearchSource,
  NormalizedFitmentCandidate,
  FieldConfidence,
  ConfidenceScore,
  ResearchWorkflowResult,
  ReviewStatus,
} from "./types";
import { calculateOverallConfidence, calculateFieldConfidence } from "./confidence";
import { normalizeFindings, detectVariant } from "./normalize";
import { normalizeMake, normalizeModel } from "../normalization";

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate research input
 */
export function validateInput(input: FitmentResearchInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!input.make || input.make.trim().length === 0) {
    errors.push("Make is required");
  }
  
  if (!input.model || input.model.trim().length === 0) {
    errors.push("Model is required");
  }
  
  if (!input.year || input.year < 1980 || input.year > new Date().getFullYear() + 2) {
    errors.push("Year must be between 1980 and next model year");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate normalized candidate
 */
export function validateCandidate(candidate: NormalizedFitmentCandidate | null): {
  errors: string[];
  warnings: string[];
  isReviewable: boolean;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!candidate) {
    return {
      errors: ["Normalization failed - no candidate produced"],
      warnings: [],
      isReviewable: false,
    };
  }
  
  // Required fields
  if (!candidate.boltPattern) {
    errors.push("Missing required field: boltPattern");
  }
  
  if (!candidate.centerBoreMm) {
    errors.push("Missing required field: centerBoreMm");
  }
  
  if (candidate.oemTireSizes.length === 0) {
    errors.push("Missing required field: oemTireSizes (at least one required)");
  }
  
  // Validate bolt pattern format
  if (candidate.boltPattern && !/^\d+x\d+(\.\d+)?$/.test(candidate.boltPattern)) {
    errors.push(`Invalid bolt pattern format: ${candidate.boltPattern}`);
  }
  
  // Validate center bore range
  if (candidate.centerBoreMm && (candidate.centerBoreMm < 50 || candidate.centerBoreMm > 120)) {
    warnings.push(`Unusual center bore: ${candidate.centerBoreMm}mm (typical: 54-110mm)`);
  }
  
  // Validate offset range
  if (candidate.offsetMinMm !== undefined && candidate.offsetMaxMm !== undefined) {
    if (candidate.offsetMinMm > candidate.offsetMaxMm) {
      errors.push("Offset min is greater than offset max");
    }
    if (candidate.offsetMaxMm - candidate.offsetMinMm > 50) {
      warnings.push("Large offset range - verify accuracy");
    }
  }
  
  // Warn if missing important fields
  if (!candidate.threadSize) {
    warnings.push("Missing thread size - needed for lug nut compatibility");
  }
  
  if (candidate.oemWheelSizes.length === 0) {
    warnings.push("No OEM wheel sizes found");
  }
  
  if (candidate.offsetMinMm === undefined || candidate.offsetMaxMm === undefined) {
    warnings.push("Missing offset range");
  }
  
  return {
    errors,
    warnings,
    isReviewable: errors.length === 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH RECORD CREATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a research record from findings
 * This is the main entry point for creating review queue records
 */
export function createResearchRecord(
  input: FitmentResearchInput,
  findings: RawFitmentFinding[],
  sources: ResearchSource[],
  initiatedBy: string = "manual"
): FitmentResearchRecord {
  const id = randomUUID();
  
  // Calculate field confidence
  const fieldConfidence = calculateFieldConfidence(findings);
  
  // Normalize findings into candidate
  const candidate = normalizeFindings(input, findings, fieldConfidence);
  
  // Calculate overall confidence
  const overallConfidence = calculateOverallConfidence(findings, sources, candidate);
  
  // Validate candidate
  const validation = validateCandidate(candidate);
  
  return {
    id,
    researchedAt: new Date(),
    initiatedBy,
    
    input,
    rawFindings: findings,
    sources,
    
    candidate,
    fieldConfidence,
    overallConfidence,
    
    status: "pending",
    
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    isReviewable: validation.isReviewable,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW ORCHESTRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute the full research workflow
 * 
 * NOTE: This does NOT auto-insert into production. It creates a review queue
 * record that must be manually approved before being applied.
 */
export async function executeResearchWorkflow(
  input: FitmentResearchInput,
  findings: RawFitmentFinding[],
  sources: ResearchSource[],
  options: {
    initiatedBy?: string;
    checkVariants?: boolean;
  } = {}
): Promise<ResearchWorkflowResult> {
  const { initiatedBy = "workflow", checkVariants = true } = options;
  
  // Step 1: Validate input
  const inputValidation = validateInput(input);
  if (!inputValidation.valid) {
    return {
      success: false,
      record: {
        id: randomUUID(),
        researchedAt: new Date(),
        initiatedBy,
        input,
        rawFindings: [],
        sources: [],
        candidate: null,
        fieldConfidence: [],
        overallConfidence: {
          level: "low",
          score: 0,
          factors: { sourceAuthority: 0, sourceAgreement: 0, completeness: 0 },
          reasoning: inputValidation.errors,
        },
        status: "rejected",
        validationErrors: inputValidation.errors,
        validationWarnings: [],
        isReviewable: false,
      },
      summary: `Input validation failed: ${inputValidation.errors.join(", ")}`,
    };
  }
  
  // Step 2: Create main record
  const record = createResearchRecord(input, findings, sources, initiatedBy);
  
  // Step 3: Check for variants (e.g., if researching "Ram 1500", also check "Ram 1500 Classic")
  const relatedVariants: FitmentResearchRecord[] = [];
  
  if (checkVariants) {
    const { isVariant } = detectVariant(input);
    
    // If this is NOT a variant, check if variants might exist
    if (!isVariant) {
      // For RAM 1500 in 2019+, check for Classic variant
      if (
        normalizeMake(input.make) === "ram" &&
        normalizeModel(input.make, input.model) === "1500" &&
        input.year >= 2019 && input.year <= 2024
      ) {
        // Note: In actual implementation, this would trigger separate research
        // For now, just log that a variant should be researched
        record.notes = [
          ...(record.candidate?.notes || []),
          "⚠️ RAM 1500 Classic variant exists for this year range - research separately",
        ];
      }
    }
  }
  
  // Step 4: Build summary
  const summary = buildWorkflowSummary(record);
  
  return {
    success: record.isReviewable,
    record,
    relatedVariants: relatedVariants.length > 0 ? relatedVariants : undefined,
    summary,
  };
}

function buildWorkflowSummary(record: FitmentResearchRecord): string {
  const parts: string[] = [];
  
  // Vehicle
  const vehicle = record.candidate?.vehicleLabel || 
    `${record.input.year} ${record.input.make} ${record.input.model}`;
  parts.push(vehicle);
  
  // Status
  if (record.isReviewable) {
    parts.push(`✅ Ready for review (${record.overallConfidence.level} confidence)`);
  } else {
    parts.push(`❌ Not reviewable: ${record.validationErrors.join(", ")}`);
  }
  
  // Key findings
  if (record.candidate) {
    parts.push(`Bolt: ${record.candidate.boltPattern}`);
    parts.push(`CB: ${record.candidate.centerBoreMm}mm`);
    parts.push(`Tires: ${record.candidate.oemTireSizes.length} sizes`);
  }
  
  return parts.join(" | ");
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEW QUEUE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update review status (for admin UI)
 */
export function updateReviewStatus(
  record: FitmentResearchRecord,
  status: ReviewStatus,
  reviewedBy: string,
  notes?: string
): FitmentResearchRecord {
  return {
    ...record,
    status,
    reviewedBy,
    reviewedAt: new Date(),
    reviewNotes: notes,
  };
}

/**
 * Check if a record can be approved for production
 */
export function canApproveForProduction(record: FitmentResearchRecord): {
  canApprove: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  
  if (!record.isReviewable) {
    blockers.push("Record has validation errors");
  }
  
  if (record.overallConfidence.level === "low") {
    blockers.push("Confidence level is too low - needs additional research");
  }
  
  if (!record.candidate) {
    blockers.push("No normalized candidate data");
  }
  
  if (record.candidate && record.candidate.oemTireSizes.length === 0) {
    blockers.push("Missing OEM tire sizes (required)");
  }
  
  if (record.candidate && !record.candidate.centerBoreMm) {
    blockers.push("Missing center bore (required)");
  }
  
  return {
    canApprove: blockers.length === 0,
    blockers,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Export record as JSON for storage/review
 */
export function exportRecordAsJSON(record: FitmentResearchRecord): string {
  return JSON.stringify(record, null, 2);
}

/**
 * Export candidate as production-ready format
 * NOTE: This is for preview only - actual insertion requires manual approval
 */
export function exportCandidateForProduction(
  candidate: NormalizedFitmentCandidate
): object {
  return {
    year: candidate.year,
    make: candidate.make,
    model: candidate.model,
    trim: candidate.trim,
    generation: candidate.generation,
    isVariant: candidate.isVariant,
    variantQualifier: candidate.variantQualifier,
    boltPattern: candidate.boltPattern,
    centerBoreMm: candidate.centerBoreMm,
    threadSize: candidate.threadSize,
    seatType: candidate.seatType,
    offsetMinMm: candidate.offsetMinMm,
    offsetMaxMm: candidate.offsetMaxMm,
    oemWheelSizes: candidate.oemWheelSizes.map(w => ({
      diameter: w.diameter,
      width: w.width,
      offset: w.offset,
      tireSize: w.tireSize,
      axle: w.axle,
    })),
    oemTireSizes: candidate.oemTireSizes,
    exceptions: candidate.exceptions,
    notes: candidate.notes,
  };
}
