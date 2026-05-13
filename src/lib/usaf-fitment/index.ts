/**
 * USAF Fitment Audit Pipeline
 * 
 * Uses USAF as an audit/enrichment source for:
 * - OEM tire application validation
 * - Staggered detection
 * - Missing fitment discovery
 * - HD/commercial supplement
 * - Tire-size enrichment
 * - Fitment QA/audit
 * 
 * IMPORTANT: USAF is NOT a replacement for our canonical fitment architecture.
 * No runtime dependency on USAF. No customer-facing changes.
 */

// Types
export * from './types';

// Normalization utilities
export {
  normalizeUsafTireSize,
  normalizeLoadRange,
  normalizeSpeedRating,
  parseUsafStaggeredGroups,
  inferUsafConfigurations,
  deduplicateUsafOptions,
  tireSizesMatch,
  tireSizeInList,
} from './normalize';

// Comparison/audit
export {
  compareFitment,
  classifyDiscrepancy,
  summarizeAuditBatch,
  type OurFitmentData,
} from './compare';
