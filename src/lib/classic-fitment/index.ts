/**
 * Classic Fitment Module
 * 
 * ISOLATED from modern fitment system.
 * Platform-based fitment for classic/muscle cars.
 */

// Schema
export * from "./schema";

// Types
export * from "./types";

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
