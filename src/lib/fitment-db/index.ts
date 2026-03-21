/**
 * Fitment Database - Public API
 * 
 * DB-first fitment system with Wheel-Size API fallback.
 */

// Core database
export { db, schema } from "./db";

// Types
export type {
  FitmentSource,
  FitmentSourceRecord,
  VehicleFitment,
  FitmentOverride,
  FitmentImportJob,
  OemWheelSize,
  OemTireSize,
  FitmentLookupParams,
  FitmentLookupResult,
  CanonicalKey,
} from "./types";

// Schema (for migrations)
export {
  fitmentSourceRecords,
  vehicleFitments,
  fitmentOverrides,
  fitmentImportJobs,
} from "./schema";

// Key generation
export {
  slugify,
  normalizeMake,
  normalizeModel,
  makeCanonicalKey,
  parseCanonicalKey,
  makeVehicleHash,
  makePayloadChecksum,
} from "./keys";

// Normalization
export {
  normalizeWheelSizeData,
  normalizeWheelProsData,
  normalizeManualFitment,
  createWheelSizeSourceRecord,
} from "./normalize";

// Import
export {
  importWheelSizeFitment,
  createImportJob,
  updateImportJobProgress,
  getImportJob,
  importFromWheelSize,
} from "./importFitment";

// Lookup (main entry points)
export {
  getFitment,
  listFitments,
  getTrimOptions,
} from "./getFitment";

// Overrides
export {
  findApplicableOverrides,
  applyOverrides,
  createOverride,
  deactivateOverride,
  listOverrides,
} from "./applyOverrides";
