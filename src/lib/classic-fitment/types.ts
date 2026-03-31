/**
 * Classic Fitment Types
 * 
 * TypeScript interfaces for classic fitment system.
 * ISOLATED from modern fitment types.
 */

// ============================================================================
// Core Types
// ============================================================================

export type FitmentStyle = "stock_baseline" | "restomod_common" | "big_brake_sensitive";
export type ConfidenceLevel = "high" | "medium" | "low";
export type ModificationRisk = "low" | "medium" | "high";

// ============================================================================
// Platform Definition
// ============================================================================

export interface ClassicPlatform {
  code: string;
  name: string;
  generationName?: string;
  yearStart: number;
  yearEnd: number;
  vehicles: Array<{
    make: string;
    model: string;
  }>;
}

// ============================================================================
// Fitment Record (DB shape)
// ============================================================================

export interface ClassicFitmentRecord {
  id: string;
  
  // Platform identity
  platformCode: string;
  platformName: string;
  generationName: string | null;
  
  // Vehicle coverage
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  
  // Classification
  fitmentLevel: string;
  fitmentSource: string;
  fitmentStyle: FitmentStyle;
  
  // Confidence & verification
  confidence: ConfidenceLevel;
  verificationNote: string | null;
  requiresClearanceCheck: boolean;
  commonModifications: string[];
  
  // Specs
  commonBoltPattern: string;
  commonCenterBore: number | null;
  commonThreadSize: string | null;
  commonSeatType: string | null;
  
  // Recommended ranges
  recWheelDiameterMin: number | null;
  recWheelDiameterMax: number | null;
  recWheelWidthMin: number | null;
  recWheelWidthMax: number | null;
  recOffsetMinMm: number | null;
  recOffsetMaxMm: number | null;
  
  // Stock reference
  stockWheelDiameter: number | null;
  stockWheelWidth: number | null;
  stockTireSize: string | null;
  
  // Risk
  modificationRisk: ModificationRisk;
  
  // Rollback
  batchTag: string;
  version: number;
  isActive: boolean;
  
  // Metadata
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ClassicFitmentResponse {
  isClassicVehicle: true;
  fitmentMode: "classic";
  
  platform: {
    code: string;
    name: string;
    generationName: string | null;
    yearRange: string;
  };
  
  vehicle: {
    year: number;
    make: string;
    model: string;
  };
  
  // Classification
  fitmentStyle: FitmentStyle;
  confidence: ConfidenceLevel;
  
  // Verification
  verificationRequired: boolean;
  verificationNote: string | null;
  commonModifications: string[];
  modificationRisk: ModificationRisk;
  
  // Specs
  specs: {
    boltPattern: string;
    centerBore: number | null;
    threadSize: string | null;
    seatType: string | null;
  };
  
  // Recommended ranges
  recommendedRange: {
    diameter: { min: number; max: number };
    width: { min: number; max: number };
    offset: { min: number; max: number };
  };
  
  // Stock reference (for display)
  stockReference: {
    wheelDiameter: number | null;
    wheelWidth: number | null;
    tireSize: string | null;
  };
  
  // Metadata
  source: string;
  batchTag: string;
  version: number;
}

export interface ClassicFitmentNotFoundResponse {
  isClassicVehicle: false;
  fitmentMode: "not_found";
  message: string;
}

export type ClassicLookupResult = ClassicFitmentResponse | ClassicFitmentNotFoundResponse;

// ============================================================================
// Import Types
// ============================================================================

export interface ClassicFitmentInput {
  platformCode: string;
  platformName: string;
  generationName?: string;
  
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  
  fitmentStyle?: FitmentStyle;
  confidence: ConfidenceLevel;
  verificationNote?: string;
  requiresClearanceCheck?: boolean;
  commonModifications?: string[];
  
  commonBoltPattern: string;
  commonCenterBore?: number;
  commonThreadSize?: string;
  commonSeatType?: string;
  
  recWheelDiameterMin?: number;
  recWheelDiameterMax?: number;
  recWheelWidthMin?: number;
  recWheelWidthMax?: number;
  recOffsetMinMm?: number;
  recOffsetMaxMm?: number;
  
  stockWheelDiameter?: number;
  stockWheelWidth?: number;
  stockTireSize?: string;
  
  modificationRisk?: ModificationRisk;
  notes?: string;
}

export interface ClassicImportResult {
  success: boolean;
  action: "created" | "updated" | "skipped" | "error";
  id?: string;
  error?: string;
}

export interface ClassicBatchImportResult {
  batchTag: string;
  totalRecords: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ClassicValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
