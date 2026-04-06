/**
 * Reviews Module - Public API
 * 
 * Import from '@/lib/reviews' for all review-related functionality
 */

export {
  getReviewData,
  getReviewDataSync,
  formatReviewCount,
  formatRating,
  getStarDisplay,
  REVIEW_CONFIG,
  type ReviewData,
  type ReviewSource,
  type ReviewBreakdown,
  type ReviewLookupParams,
} from './reviewService';
