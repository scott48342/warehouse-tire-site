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
