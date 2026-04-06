"use client";

/**
 * Shared Review Summary Components
 * 
 * Reusable review display components for SRP cards and PDP.
 * These components:
 * - Degrade gracefully when no data exists (return null)
 * - Do NOT show fake/placeholder data in production
 * - Support real review data when available
 * - Are visually consistent across SRP and PDP
 * 
 * @created 2026-04-06
 */

import { formatReviewCount, formatRating, getStarDisplay, type ReviewData } from "@/lib/reviews/reviewService";

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewSummaryProps {
  /** Review data from the review service */
  reviewData?: ReviewData | null;
  /** Display variant */
  variant?: 'compact' | 'standard' | 'detailed';
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPACT VARIANT (for SRP cards)
// ============================================================================

interface CompactReviewProps {
  rating: number;
  reviewCount: number;
  className?: string;
}

/**
 * Compact review display for product cards
 * Shows: ⭐ 4.6 (2.3K)
 */
export function CompactReviewSummary({ rating, reviewCount, className = '' }: CompactReviewProps) {
  return (
    <div className={`flex items-center gap-1.5 text-[11px] ${className}`}>
      <span className="text-yellow-500">★</span>
      <span className="font-semibold text-neutral-700">{formatRating(rating)}</span>
      <span className="text-neutral-400">
        ({formatReviewCount(reviewCount)})
      </span>
    </div>
  );
}

// ============================================================================
// STANDARD VARIANT (for PDP)
// ============================================================================

interface StandardReviewProps {
  rating: number;
  reviewCount: number;
  className?: string;
}

/**
 * Standard review display for PDP
 * Shows: ★★★★★ 4.6 (2,341+ reviews)
 */
export function StandardReviewSummary({ rating, reviewCount, className = '' }: StandardReviewProps) {
  const stars = getStarDisplay(rating);
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center">
        {stars.map((star, i) => (
          <span 
            key={i} 
            className={`text-sm ${
              star === 'full' ? 'text-yellow-500' : 
              star === 'half' ? 'text-yellow-400' : 
              'text-neutral-300'
            }`}
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-sm font-semibold text-neutral-900">
        {formatRating(rating)}
      </span>
      <span className="text-sm text-neutral-500">
        ({formatReviewCount(reviewCount)} reviews)
      </span>
    </div>
  );
}

// ============================================================================
// DETAILED VARIANT (for expanded PDP sections)
// ============================================================================

interface DetailedReviewProps {
  reviewData: ReviewData;
  className?: string;
}

/**
 * Detailed review display with breakdown
 * Shows rating, count, source, and optional breakdown bars
 */
export function DetailedReviewSummary({ reviewData, className = '' }: DetailedReviewProps) {
  const { rating, reviewCount, source, breakdown } = reviewData;
  const stars = getStarDisplay(rating);
  
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main rating display */}
      <div className="flex items-center gap-3">
        <div className="text-3xl font-extrabold text-neutral-900">
          {formatRating(rating)}
        </div>
        <div>
          <div className="flex items-center">
            {stars.map((star, i) => (
              <span 
                key={i} 
                className={`text-lg ${
                  star === 'full' ? 'text-yellow-500' : 
                  star === 'half' ? 'text-yellow-400' : 
                  'text-neutral-300'
                }`}
              >
                ★
              </span>
            ))}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            Based on {formatReviewCount(reviewCount)} reviews
            {source === 'verified' && (
              <span className="ml-1 text-green-600">• Verified</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Optional breakdown */}
      {breakdown && (
        <div className="space-y-2 pt-2 border-t border-neutral-200">
          {breakdown.comfort != null && (
            <ReviewBreakdownBar label="Comfort" value={breakdown.comfort} />
          )}
          {breakdown.noise != null && (
            <ReviewBreakdownBar label="Quietness" value={breakdown.noise} />
          )}
          {breakdown.treadLife != null && (
            <ReviewBreakdownBar label="Tread Life" value={breakdown.treadLife} />
          )}
          {breakdown.wetGrip != null && (
            <ReviewBreakdownBar label="Wet Grip" value={breakdown.wetGrip} />
          )}
          {breakdown.dryGrip != null && (
            <ReviewBreakdownBar label="Dry Grip" value={breakdown.dryGrip} />
          )}
          {breakdown.value != null && (
            <ReviewBreakdownBar label="Value" value={breakdown.value} />
          )}
        </div>
      )}
    </div>
  );
}

function ReviewBreakdownBar({ label, value }: { label: string; value: number }) {
  const percentage = (value / 5) * 100;
  
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-neutral-600">{label}</span>
      <div className="flex-1 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-yellow-500 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-6 text-right text-neutral-700 font-medium">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// ============================================================================
// UNIFIED COMPONENT (auto-selects variant based on data)
// ============================================================================

/**
 * Unified Review Summary component
 * 
 * IMPORTANT: This component returns NULL if no valid review data exists.
 * It does NOT show fake placeholders in production.
 * 
 * Usage:
 * - Pass reviewData from reviewService.getReviewData()
 * - Component handles all display logic
 * - Returns null if no data (graceful hiding)
 */
export function ReviewSummary({ 
  reviewData, 
  variant = 'standard',
  className = '' 
}: ReviewSummaryProps) {
  // NO DATA = HIDE GRACEFULLY
  // This is intentional - we don't show fake reviews
  if (!reviewData) {
    return null;
  }
  
  const { rating, reviewCount, hasRealData } = reviewData;
  
  // Only show if we have real, trustworthy data
  if (!hasRealData || !rating || rating <= 0 || !reviewCount || reviewCount <= 0) {
    return null;
  }
  
  // Render appropriate variant
  switch (variant) {
    case 'compact':
      return (
        <CompactReviewSummary 
          rating={rating} 
          reviewCount={reviewCount} 
          className={className}
        />
      );
    
    case 'detailed':
      return (
        <DetailedReviewSummary 
          reviewData={reviewData} 
          className={className}
        />
      );
    
    case 'standard':
    default:
      return (
        <StandardReviewSummary 
          rating={rating} 
          reviewCount={reviewCount} 
          className={className}
        />
      );
  }
}

// ============================================================================
// DIRECT PROPS VARIANT (for components that manage their own data)
// ============================================================================

interface DirectReviewSummaryProps {
  rating?: number | null;
  reviewCount?: number | null;
  variant?: 'compact' | 'standard';
  className?: string;
}

/**
 * Direct props version for components that have rating/count directly
 * Still hides gracefully if no valid data
 */
export function DirectReviewSummary({ 
  rating, 
  reviewCount, 
  variant = 'standard',
  className = '' 
}: DirectReviewSummaryProps) {
  // NO DATA = HIDE GRACEFULLY
  if (!rating || rating <= 0 || !reviewCount || reviewCount <= 0) {
    return null;
  }
  
  if (variant === 'compact') {
    return (
      <CompactReviewSummary 
        rating={rating} 
        reviewCount={reviewCount} 
        className={className}
      />
    );
  }
  
  return (
    <StandardReviewSummary 
      rating={rating} 
      reviewCount={reviewCount} 
      className={className}
    />
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ReviewSummary;
