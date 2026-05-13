/**
 * USAF Fitment Types
 * 
 * Types for USAF fitment audit pipeline.
 * USAF is an audit/enrichment source, NOT a replacement for our canonical fitment.
 */

// ============================================================================
// RAW USAF TYPES (from GetVehicleOptions)
// ============================================================================

export interface UsafVehicleOptionsResponse {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  year?: string;
  make?: string;
  model?: string;
  options?: UsafVehicleOption[];
}

export interface UsafVehicleOption {
  optionCode: string;
  optionDescription: string;
  tireSize: string;
  rimDiameter: number;
  rimWidth: number;
  aspectRatio: number;
  sectionWidth: number;
  loadIndex: string;
  speedRating: string;
  loadRange?: string;
  position?: 'front' | 'rear' | 'all';
  isOE: boolean;
}

// ============================================================================
// NORMALIZED TYPES
// ============================================================================

export interface NormalizedTireSize {
  raw: string;
  width: number;
  aspectRatio: number;
  rimDiameter: number;
  prefix?: 'P' | 'LT' | 'ST' | 'T';  // P=Passenger, LT=Light Truck, ST=Trailer, T=Temp
  suffix?: string;  // XL, RF, etc.
  loadIndex?: number;
  speedRating?: string;
  loadRange?: string;  // C, D, E, F, etc.
  isFlotation?: boolean;  // e.g., 35x12.50R17
  normalized: string;  // canonical format: 275/65R18
}

export interface NormalizedFitment {
  tireSizes: NormalizedTireSize[];
  isStaggered: boolean;
  frontSize?: NormalizedTireSize;
  rearSize?: NormalizedTireSize;
  wheelDiameters: number[];
  loadRanges: string[];
  speedRatings: string[];
}

// ============================================================================
// AUDIT TYPES
// ============================================================================

export type DiscrepancyType = 
  | 'SAFE_MATCH'
  | 'MISSING_SIZE'  // Our DB is missing a size USAF has
  | 'POSSIBLE_STAGGERED'  // USAF indicates staggered, we don't have it
  | 'LOAD_RANGE_MISMATCH'
  | 'SPEED_RATING_MISMATCH'
  | 'EXTRA_USAF_CONFIG'  // USAF has config we don't
  | 'MISSING_IN_USAF'  // We have it, USAF doesn't
  | 'POSSIBLE_BAD_DB_RECORD'  // Our record looks wrong
  | 'WHEEL_DIAMETER_MISMATCH';

export interface FitmentDiscrepancy {
  type: DiscrepancyType;
  field: string;
  ourValue: string | number | boolean | null;
  usafValue: string | number | boolean | null;
  confidence: number;  // 0-100
  recommendation: 'approve' | 'review' | 'ignore';
  notes?: string;
}

export interface VehicleAuditResult {
  vehicleId: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  
  // Our data
  ourTireSizes: string[];
  ourIsStaggered: boolean;
  ourWheelDiameters: number[];
  
  // USAF data
  usafTireSizes: string[];
  usafIsStaggered: boolean;
  usafWheelDiameters: number[];
  usafOptions: UsafVehicleOption[];
  
  // Comparison
  discrepancies: FitmentDiscrepancy[];
  overallMatch: 'full' | 'partial' | 'mismatch';
  confidenceScore: number;
  
  // Timestamps
  auditedAt: Date;
}

export interface AuditBatchResult {
  totalVehicles: number;
  processed: number;
  errors: number;
  
  // Coverage stats
  usafCoverage: number;  // % of our vehicles USAF has
  dbCoverage: number;  // % of USAF vehicles we have
  
  // Discrepancy stats
  safeMatches: number;
  missingSizes: number;
  possibleStaggered: number;
  mismatches: number;
  
  results: VehicleAuditResult[];
}

// ============================================================================
// ENRICHMENT TYPES
// ============================================================================

export interface SafeEnrichment {
  vehicleId: string;
  field: 'tireSizes' | 'isStaggered' | 'wheelDiameters' | 'speedRatings' | 'loadIndexes';
  currentValue: any;
  newValue: any;
  source: 'usaf';
  confidence: number;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

// Fields that are NEVER auto-enriched
export const PROTECTED_FIELDS = [
  'boltPattern',
  'offset',
  'centerBore', 
  'wheelWidth',
  'hubCentric',
  'trimId',
] as const;

// Fields that can be safely enriched
export const ENRICHABLE_FIELDS = [
  'tireSizes',
  'isStaggered',
  'wheelDiameters',
  'speedRatings',
  'loadIndexes',
  'loadRanges',
] as const;
