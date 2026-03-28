/**
 * Fitment Database - Public API
 * 
 * DB-first fitment system with Wheel-Size API fallback.
 */

// Core database
export { db, schema } from "./db";

// Types from schema (Drizzle inferred types)
export type {
  FitmentSourceRecord,
  NewFitmentSourceRecord,
  VehicleFitment,
  NewVehicleFitment,
  FitmentOverride,
  NewFitmentOverride,
  FitmentImportJob,
  NewFitmentImportJob,
} from "./schema";

// Shared frontend types
export type {
  OEMWheelSize,
  DBFitmentProfile,
  FitmentSearchResponse,
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
  applyOverridesWithMeta,
  createOverride,
  updateOverride,
  getOverride,
  findOverrideByVehicle,
  deactivateOverride,
  listOverrides,
  type ApplyOverridesResult,
  type CreateOverrideInput,
  type OEMWheelSizeOverride,
} from "./applyOverrides";

// Profile service
export {
  getFitmentProfile,
  assessFitmentQuality,
  isValidFitmentProfile,
  type FitmentProfile,
  type ProfileLookupResult,
  type FitmentQuality,
  type WheelSize,
} from "./profileService";

// Vehicle fitment rules (explicit per-generation/variant rules)
export {
  matchFitmentRule,
  getFitmentFromRules,
  isRam1500Classic,
  getRam1500GenerationInfo,
  VEHICLE_FITMENT_RULES,
  type FitmentRule,
  type FitmentRuleMatch,
  type RuleMatchInput,
  type RuleMatchResult,
} from "./vehicleFitmentRules";
