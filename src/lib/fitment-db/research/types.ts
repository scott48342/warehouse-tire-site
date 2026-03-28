/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FITMENT RESEARCH TYPES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Types for the fitment research ingestion workflow.
 * This system collects candidate fitment data from web research and normalizes
 * it into a review queue—NEVER auto-inserting into production.
 * 
 * @created 2026-03-28
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface FitmentResearchInput {
  make: string;
  model: string;
  year: number;
  trim?: string;
  /** Raw model string that may contain variants like "Classic" */
  rawModel?: string;
  /** Additional context for research */
  context?: {
    /** Known generation name if available */
    generation?: string;
    /** Whether this is a variant (e.g., Classic, Hybrid) */
    isVariant?: boolean;
    /** Parent model if this is a variant */
    parentModel?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SourceAuthority = 
  | "manufacturer"      // OEM specs from manufacturer
  | "supplier"          // Tier 1 suppliers (WheelPros, etc.)
  | "reference"         // Established reference sites (Tire Rack, etc.)
  | "enthusiast"        // Forums, enthusiast sites
  | "aggregator"        // Multi-source aggregators
  | "unknown";          // Unverified source

export interface ResearchSource {
  /** URL of the source */
  url: string;
  /** Human-readable source name */
  name: string;
  /** Authority level of this source */
  authority: SourceAuthority;
  /** Date the data was retrieved */
  retrievedAt: Date;
  /** Raw excerpt from the source */
  excerpt?: string;
  /** Whether this is a primary/direct source vs aggregated */
  isPrimary: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RAW FINDING TYPES (Pre-normalization)
// ═══════════════════════════════════════════════════════════════════════════════

export interface RawFitmentFinding {
  field: FitmentFieldType;
  value: string;
  source: ResearchSource;
  /** Confidence in this specific finding (0-1) */
  confidence: number;
  /** Notes about this finding */
  notes?: string;
}

export type FitmentFieldType =
  | "boltPattern"
  | "centerBore"
  | "threadSize"
  | "seatType"
  | "offsetMin"
  | "offsetMax"
  | "offsetTypical"
  | "oemWheelSize"
  | "oemTireSize"
  | "generation"
  | "yearRange"
  | "exception";

// ═══════════════════════════════════════════════════════════════════════════════
// NORMALIZED CANDIDATE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OEMWheelSizeCandidate {
  diameter: number;
  width: number;
  offset?: number;
  /** Associated tire size if known */
  tireSize?: string;
  /** Front, rear, or both axles */
  axle: "front" | "rear" | "both";
  /** Whether this is factory stock */
  isStock: boolean;
  /** Source of this specific size */
  source: string;
}

export interface NormalizedFitmentCandidate {
  // ═══════════════════════════════════════════════════════════════════════════
  // VEHICLE IDENTIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Normalized make (lowercase, hyphenated) */
  make: string;
  /** Normalized model (lowercase, hyphenated) */
  model: string;
  /** Model year */
  year: number;
  /** Trim level if specified */
  trim?: string;
  /** Display-friendly vehicle label */
  vehicleLabel: string;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GENERATION / VARIANT INFO
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Generation identifier (e.g., "5th Gen DT", "4th Gen DS Classic") */
  generation?: string;
  /** Year range for this generation */
  generationYearRange?: { start: number; end: number };
  /** Whether this is a model variant (e.g., Classic, Hybrid) */
  isVariant: boolean;
  /** Variant qualifier (e.g., "classic", "hybrid") */
  variantQualifier?: string;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE FITMENT DATA (Required fields)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Bolt pattern in metric format (e.g., "6x139.7") - REQUIRED */
  boltPattern: string;
  /** Bolt pattern in imperial format (e.g., "6x5.5") */
  boltPatternImperial?: string;
  /** Center bore in mm - REQUIRED */
  centerBoreMm: number;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // OFFSET RANGE
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Minimum safe offset in mm */
  offsetMinMm?: number;
  /** Maximum safe offset in mm */
  offsetMaxMm?: number;
  /** Typical/OEM offset in mm */
  offsetTypicalMm?: number;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // HARDWARE SPECS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Thread size (e.g., "14x1.5", "M12x1.5") */
  threadSize?: string;
  /** Seat type (e.g., "conical", "ball", "flat") */
  seatType?: string;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // OEM SIZES (Baseline reference - NOT constraints)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * OEM wheel sizes - baseline reference for calculations
   * NOTE: These are for OD/plus-sizing calculations, NOT hard constraints
   */
  oemWheelSizes: OEMWheelSizeCandidate[];
  
  /**
   * OEM tire sizes - baseline reference for calculations - REQUIRED
   * NOTE: These are for OD/plus-sizing calculations, NOT hard constraints
   * in lifted or upsize flows
   */
  oemTireSizes: string[];
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EXCEPTIONS / NOTES
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Known exceptions or edge cases */
  exceptions: FitmentException[];
  /** General notes about this fitment */
  notes: string[];
}

export interface FitmentException {
  /** Type of exception */
  type: "trim" | "engine" | "year" | "package" | "variant" | "other";
  /** Description of the exception */
  description: string;
  /** What differs in this exception */
  differs: Partial<Pick<NormalizedFitmentCandidate, 
    "boltPattern" | "centerBoreMm" | "offsetMinMm" | "offsetMaxMm" | "threadSize"
  >>;
  /** Which trims/engines/years this applies to */
  appliesTo?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE SCORING
// ═══════════════════════════════════════════════════════════════════════════════

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceScore {
  /** Overall confidence level */
  level: ConfidenceLevel;
  /** Numeric score (0-100) */
  score: number;
  /** Breakdown by factor */
  factors: {
    /** Score from source authority (0-40) */
    sourceAuthority: number;
    /** Score from cross-source agreement (0-40) */
    sourceAgreement: number;
    /** Score from data completeness (0-20) */
    completeness: number;
  };
  /** Explanation of the score */
  reasoning: string[];
}

export interface FieldConfidence {
  field: FitmentFieldType;
  value: string | number;
  confidence: ConfidenceLevel;
  sourceCount: number;
  sources: string[];
  disagreements?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEW QUEUE RECORD
// ═══════════════════════════════════════════════════════════════════════════════

export type ReviewStatus = 
  | "pending"       // Awaiting review
  | "approved"      // Approved for production
  | "rejected"      // Rejected (bad data)
  | "needs_more"    // Needs additional research
  | "merged";       // Merged into production

export interface FitmentResearchRecord {
  /** Unique ID for this record */
  id: string;
  /** When the research was conducted */
  researchedAt: Date;
  /** Who/what initiated the research */
  initiatedBy: string;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Original research input */
  input: FitmentResearchInput;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RAW FINDINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** All raw findings from research */
  rawFindings: RawFitmentFinding[];
  /** All sources consulted */
  sources: ResearchSource[];
  
  // ═══════════════════════════════════════════════════════════════════════════
  // NORMALIZED CANDIDATE
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Normalized fitment candidate (null if normalization failed) */
  candidate: NormalizedFitmentCandidate | null;
  /** Per-field confidence scores */
  fieldConfidence: FieldConfidence[];
  /** Overall confidence score */
  overallConfidence: ConfidenceScore;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // REVIEW STATUS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Current review status */
  status: ReviewStatus;
  /** Reviewer notes */
  reviewNotes?: string;
  /** Who reviewed (if reviewed) */
  reviewedBy?: string;
  /** When reviewed (if reviewed) */
  reviewedAt?: Date;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Validation errors (if any) */
  validationErrors: string[];
  /** Validation warnings (if any) */
  validationWarnings: string[];
  /** Whether this passes minimum requirements for review */
  isReviewable: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResearchWorkflowResult {
  success: boolean;
  record: FitmentResearchRecord;
  /** If related variants were found, their records */
  relatedVariants?: FitmentResearchRecord[];
  /** Summary for logging/display */
  summary: string;
}
