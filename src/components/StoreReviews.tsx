"use client";

import { useState } from "react";
import storeReviewsData from "@/data/store-reviews.json";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  source?: string;
  tags?: string[];
}

interface StoreReviewsMeta {
  totalReviews: number;
  averageRating: number;
}

const meta: StoreReviewsMeta = storeReviewsData.meta;
const reviews: Review[] = storeReviewsData.featured as Review[];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${sizeClasses[size]} ${star <= rating ? "text-amber-400" : "text-neutral-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function SourceBadge({ source }: { source?: string }) {
  if (source === "google") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400">
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google Review
      </span>
    );
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSISTENT TRUST LINE - Use this text everywhere
// ═══════════════════════════════════════════════════════════════════════════════

export function getTrustLine() {
  return `Rated ${meta.averageRating}★ by ${meta.totalReviews} local customers`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPACT TRUST BADGE (for cart, checkout, headers)
// ═══════════════════════════════════════════════════════════════════════════════

export function ReviewTrustBadge({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-0.5">
        <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="text-sm font-bold text-neutral-900">{meta.averageRating}★</span>
      </div>
      <span className="text-xs text-neutral-500">
        by {meta.totalReviews} local customers
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINI REVIEWS (for product pages - above price or near CTA)
// ═══════════════════════════════════════════════════════════════════════════════

export function ReviewsMini({ count = 2 }: { count?: number }) {
  const displayReviews = reviews.slice(0, count);
  
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <StarRating rating={Math.round(meta.averageRating)} size="sm" />
          <span className="text-sm font-bold text-neutral-900">{meta.averageRating}</span>
          <span className="text-xs text-neutral-500">({meta.totalReviews} reviews)</span>
        </div>
      </div>
      
      {/* Label */}
      <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide mb-2">
        Real Customer Reviews from Our Stores
      </p>
      
      {/* Reviews */}
      <div className="space-y-2">
        {displayReviews.map((review) => (
          <div key={review.id} className="text-xs">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-medium text-neutral-800">{review.author}</span>
              <StarRating rating={review.rating} size="sm" />
            </div>
            <p className="text-neutral-600 line-clamp-2">&ldquo;{review.text}&rdquo;</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEWS SECTION (for homepage or dedicated section)
// ═══════════════════════════════════════════════════════════════════════════════

export function ReviewsSection({ 
  maxReviews = 4,
  showHeader = true,
}: { 
  maxReviews?: number;
  showHeader?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayReviews = expanded ? reviews : reviews.slice(0, maxReviews);
  
  return (
    <section className="py-10">
      {showHeader && (
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <StarRating rating={Math.round(meta.averageRating)} size="lg" />
            <span className="text-2xl font-bold text-neutral-900">{meta.averageRating}</span>
          </div>
          <h2 className="text-xl font-bold text-neutral-900">
            Trusted by Local Customers
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {meta.totalReviews} verified customer reviews
          </p>
          <p className="mt-1 text-[10px] text-neutral-400 uppercase tracking-wide">
            Real Customer Reviews from Our Stores
          </p>
        </div>
      )}
      
      {/* Review Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {displayReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
      
      {/* Show More */}
      {!expanded && reviews.length > maxReviews && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setExpanded(true)}
            className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
          >
            Show more reviews →
          </button>
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEW CARD (individual review)
// ═══════════════════════════════════════════════════════════════════════════════

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-medium text-neutral-900">{review.author}</div>
          <SourceBadge source={review.source} />
        </div>
        <StarRating rating={review.rating} size="sm" />
      </div>
      
      {/* Text */}
      <p className="text-sm text-neutral-600 leading-relaxed">
        &ldquo;{review.text}&rdquo;
      </p>
      
      {/* Tags (Phase 2 ready) */}
      {review.tags && review.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {review.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKOUT TRUST STRIP (for cart/checkout pages)
// ═══════════════════════════════════════════════════════════════════════════════

export function CheckoutTrustStrip({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-neutral-100 bg-neutral-50/80 px-4 py-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="font-bold text-neutral-900">{meta.averageRating}★</span>
          <span className="text-neutral-500">by {meta.totalReviews} local customers</span>
        </div>
        <div className="hidden sm:block h-4 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5 text-neutral-600">
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Verified Local Business</span>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] font-medium text-neutral-400 uppercase tracking-wide">
        Real Customer Reviews from Our Stores
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOATING TRUST INDICATOR (subtle, for any page)
// ═══════════════════════════════════════════════════════════════════════════════

export function FloatingTrustIndicator({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1 text-xs text-neutral-500 ${className}`}>
      <svg className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span>Rated {meta.averageRating}★ by {meta.totalReviews} local customers</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDP TRUST BLOCK (compact reviews + trust line for product pages)
// ═══════════════════════════════════════════════════════════════════════════════

export function PDPTrustBlock({ className = "" }: { className?: string }) {
  const displayReviews = reviews.slice(0, 2);
  
  return (
    <div className={`rounded-xl border border-neutral-100 bg-neutral-50/60 p-3 ${className}`}>
      {/* Trust line header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              className={`h-3.5 w-3.5 ${star <= Math.round(meta.averageRating) ? "text-amber-400" : "text-neutral-200"}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <span className="text-xs font-bold text-neutral-900">{meta.averageRating}</span>
        <span className="text-[10px] text-neutral-500">({meta.totalReviews} reviews)</span>
      </div>
      
      {/* Label */}
      <p className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
        Real Customer Reviews from Our Stores
      </p>
      
      {/* Compact review snippets */}
      <div className="space-y-1.5">
        {displayReviews.map((review) => (
          <div key={review.id} className="text-[11px]">
            <p className="text-neutral-600 line-clamp-2 leading-snug">
              &ldquo;{review.text.length > 100 ? review.text.slice(0, 100) + "..." : review.text}&rdquo;
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="font-medium text-neutral-700">{review.author}</span>
              <span className="text-amber-500">★★★★★</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
