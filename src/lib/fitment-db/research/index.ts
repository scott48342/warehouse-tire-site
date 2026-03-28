/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FITMENT RESEARCH MODULE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Research ingestion workflow for discovering fitment data from web sources.
 * 
 * IMPORTANT: This module collects CANDIDATE data for human review.
 * It does NOT auto-insert into production fitment tables.
 * 
 * Workflow:
 * 1. Input (make/model/year/trim)
 * 2. Research (collect from web sources)
 * 3. Normalize (structured fields)
 * 4. Score (confidence calculation)
 * 5. Queue (for human review)
 * 6. Approve/Reject (manual step)
 * 
 * @created 2026-03-28
 */

// Types
export type {
  // Input/Output
  FitmentResearchInput,
  FitmentResearchRecord,
  ResearchWorkflowResult,
  
  // Sources
  ResearchSource,
  SourceAuthority,
  RawFitmentFinding,
  FitmentFieldType,
  
  // Normalized data
  NormalizedFitmentCandidate,
  OEMWheelSizeCandidate,
  FitmentException,
  
  // Confidence
  ConfidenceScore,
  ConfidenceLevel,
  FieldConfidence,
  
  // Review
  ReviewStatus,
} from "./types";

// Workflow
export {
  validateInput,
  validateCandidate,
  createResearchRecord,
  executeResearchWorkflow,
  updateReviewStatus,
  canApproveForProduction,
  exportRecordAsJSON,
  exportCandidateForProduction,
} from "./workflow";

// Confidence
export {
  calculateSourceAuthorityScore,
  calculateSourceAgreementScore,
  calculateCompletenessScore,
  calculateOverallConfidence,
  calculateFieldConfidence,
} from "./confidence";

// Normalization
export {
  normalizeBoltPattern,
  normalizeCenterBore,
  normalizeOffset,
  normalizeThreadSize,
  parseOEMWheelSize,
  normalizeOEMTireSize,
  extractGenerationInfo,
  extractExceptions,
  detectVariant,
  normalizeFindings,
} from "./normalize";
