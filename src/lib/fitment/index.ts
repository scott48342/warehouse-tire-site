/**
 * Fitment Module Exports
 */

// Fallback fitment service
export {
  lookupFallbackFitment,
  formatFallbackForJake,
  canSearchWithFallback,
  getPrimaryTireSize,
  type FallbackFitmentResult,
  type FallbackConfidence,
  type FallbackSource,
  type FallbackLookupRequest,
} from "./fallbackFitmentService";

// Missing fitment service
export {
  logMissingFitment,
  updateMissingFitmentOutcome,
  getMissingFitmentRequests,
  getMissingFitmentStats,
  updateMissingFitmentStatus,
  bulkUpdateStatus,
  getAlerts,
  dismissAlert,
  dismissAllAlerts,
  type MissingFitmentRequest,
  type MissingFitmentStatus,
  type MissingFitmentSource,
  type MissingFitmentSummary,
} from "./missingFitmentService";
