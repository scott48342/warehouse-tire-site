/**
 * Classic Fitment Module
 * 
 * ISOLATED from modern fitment system.
 * Platform-based fitment for classic/muscle cars.
 */

// Schema (table + inferred types)
export {
  classicFitments,
  type ClassicFitment,
  type NewClassicFitment,
  FITMENT_STYLES,
  CONFIDENCE_LEVELS,
  MODIFICATION_RISK,
} from "./schema";

// Types (interfaces + explicit types used by API)
export type {
  FitmentStyle,
  ConfidenceLevel,
  ModificationRisk,
  ClassicPlatform,
  ClassicFitmentRecord,
  ClassicFitmentResponse,
  ClassicFitmentNotFoundResponse,
  ClassicLookupResult,
  ClassicFitmentInput,
  ClassicImportResult,
  ClassicBatchImportResult,
  ClassicValidationResult,
} from "./types";

// Lookup
export {
  isClassicVehicle,
  hasClassicFitment,
  getClassicFitment,
  getVehiclesByPlatform,
  getAllPlatforms,
  deactivateBatch,
  reactivateBatch,
  getBatchStats,
} from "./classicLookup";

// Import
export {
  validateClassicRecord,
  importClassicFitment,
  importClassicBatch,
} from "./classicImport";
