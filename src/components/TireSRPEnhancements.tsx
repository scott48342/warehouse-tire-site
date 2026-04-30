"use client";

/**
 * Tire SRP Conversion Enhancements
 * 
 * ADDITIVE components to boost trust and conversion on tire search results.
 * These components are designed to:
 * - Degrade gracefully if data is missing
 * - Not interfere with existing filters, sorting, or cart logic
 * - Match the existing design system
 * - Be mobile-first responsive
 * - Keep cards clean and scannable
 * 
 * @created 2026-04-06
 */

import Link from "next/link";
import { 
  generateTireRecommendations, 
  createRecommendationAnalyticsEvent,
  type TireForRecommendation,
  type VehicleContext,
  type TireRecommendation,
  type RecommendationSet,
} from "@/lib/recommendations/tireRecommendations";

// ============================================================================
// TYPES
// ============================================================================

export type TireCategory = 
  | 'All-Season' 
  | 'All-Weather' 
  | 'All-Terrain' 
  | 'Mud-Terrain'
  | 'Highway/Touring'
  | 'Performance'
  | 'Summer'
  | 'Winter'
  | 'Rugged-Terrain'
  | string
  | null;

export interface TireCardData {
  brand?: string;
  model?: string;
  category?: TireCategory;
  mileageWarranty?: number | null;
  isRunFlat?: boolean;
  is3PMSF?: boolean;
  price?: number | null;
  stock?: number;
}

// ============================================================================
// 1. REVIEW SUMMARY (Compact for Card)
// ============================================================================

interface CardReviewSummaryProps {
  /** Rating from 1-5 */
  rating?: number | null;
  /** Number of reviews */
  reviewCount?: number | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact review summary for product cards
 * 
 * IMPORTANT: Returns null if no valid review data exists.
 * Does NOT show fake placeholders in production.
 * When real review data is available, pass it via props.
 */
export function CardReviewSummary({ rating, reviewCount, className = '' }: CardReviewSummaryProps) {
  // NO DATA = HIDE GRACEFULLY
  // This is intentional - we don't show fake reviews in production
  if (!rating || rating <= 0 || !reviewCount || reviewCount <= 0) {
    return null;
  }
  
  // Format the review count for display
  const formattedCount = reviewCount >= 1000 
    ? `${(reviewCount / 1000).toFixed(1)}K` 
    : `${reviewCount}`;
  
  return (
    <div className={`flex items-center gap-1.5 text-[11px] ${className}`}>
      <span className="text-yellow-500">★</span>
      <span className="font-semibold text-neutral-700">{rating.toFixed(1)}</span>
      <span className="text-neutral-400">
        ({formattedCount})
      </span>
    </div>
  );
}

// ============================================================================
// 2. "BEST FOR" GUIDANCE LINE
// ============================================================================

interface BestForLineProps {
  category: TireCategory;
  mileageWarranty?: number | null;
  isRunFlat?: boolean;
  is3PMSF?: boolean;
  maxItems?: number;
}

/**
 * Single-line "Best for" guidance
 * Shows 2-3 key use cases based on tire attributes
 */
export function BestForLine({ 
  category, 
  mileageWarranty, 
  isRunFlat, 
  is3PMSF,
  maxItems = 3 
}: BestForLineProps) {
  const traits = getBestForTraits(category, mileageWarranty, isRunFlat, is3PMSF);
  
  if (traits.length === 0) return null;
  
  return (
    <div className="text-[11px] text-neutral-600 truncate">
      <span className="text-neutral-400">Best for:</span>{" "}
      {traits.slice(0, maxItems).join(" • ")}
    </div>
  );
}

function getBestForTraits(
  category: TireCategory,
  mileageWarranty?: number | null,
  isRunFlat?: boolean,
  is3PMSF?: boolean
): string[] {
  const traits: string[] = [];
  
  // Category-based traits
  switch (category) {
    case 'All-Season':
      traits.push('Daily driving');
      if (mileageWarranty && mileageWarranty >= 60000) traits.push('Long tread life');
      else traits.push('Year-round');
      break;
    case 'All-Weather':
      traits.push('All conditions', 'Light snow');
      break;
    case 'All-Terrain':
      traits.push('Trucks & SUVs', 'Light trails');
      break;
    case 'Mud-Terrain':
      traits.push('Off-road', 'Mud & rocks');
      break;
    case 'Highway/Touring':
      traits.push('Highway miles', 'Quiet ride');
      break;
    case 'Performance':
      traits.push('Sports driving', 'Grip');
      break;
    case 'Summer':
      traits.push('Warm weather', 'Dry grip');
      break;
    case 'Winter':
      traits.push('Snow & ice', 'Cold weather');
      break;
    case 'Rugged-Terrain':
      traits.push('Work trucks', 'Durability');
      break;
    default:
      traits.push('Daily driving');
  }
  
  // Add feature-based traits
  if (is3PMSF && !['Winter', 'All-Weather'].includes(category || '')) {
    traits.push('Snow rated');
  }
  if (isRunFlat && traits.length < 3) {
    traits.push('Run-flat');
  }
  
  return traits.slice(0, 3);
}

// ============================================================================
// 3. TRUST MICRO-LINE
// ============================================================================

interface TrustMicroLineProps {
  hasVehicle?: boolean;
  inStock?: boolean;
  hasWarranty?: boolean;
  isLocalMode?: boolean;
}

/**
 * Compact trust signals for product cards
 * Premium trust indicators with icons - positioned above CTA
 * Hidden for local mode (install indicator already shows value prop)
 */
export function TrustMicroLine({ hasVehicle = false, inStock = true, hasWarranty = true, isLocalMode = false }: TrustMicroLineProps) {
  // Local mode doesn't need this - the install time indicator is more relevant
  if (isLocalMode) return null;
  
  const signals: { icon: string; text: string; highlight?: boolean }[] = [];
  
  if (hasVehicle) signals.push({ icon: "✓", text: "Guaranteed Fit", highlight: true });
  signals.push({ icon: "🚚", text: "Free Shipping" });
  signals.push({ icon: "↩️", text: "Easy Returns" });
  
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] text-neutral-600">
      {signals.map((signal, i) => (
        <span key={signal.text} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-neutral-300 mx-0.5">•</span>}
          <span className={signal.highlight ? "text-green-600 font-medium" : "opacity-80"}>{signal.icon}</span>
          <span className={signal.highlight ? "font-medium" : ""}>{signal.text}</span>
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// 4. SMART MERCHANDISING BADGE
// ============================================================================

export type MerchandisingBadge = 
  | 'Best Value'
  | 'Most Popular'
  | 'Long Tread Life'
  | 'Quiet Ride'
  | 'All-Season Pick'
  | 'Top Rated'
  | 'Great Deal'
  | null;

interface SmartBadgeProps {
  badge: MerchandisingBadge;
  className?: string;
}

const BADGE_STYLES: Record<string, { bg: string; icon: string }> = {
  'Best Value': { bg: 'bg-blue-600', icon: '💰' },
  'Most Popular': { bg: 'bg-violet-600', icon: '🔥' },
  'Long Tread Life': { bg: 'bg-emerald-600', icon: '🛡️' },
  'Quiet Ride': { bg: 'bg-teal-600', icon: '🤫' },
  'All-Season Pick': { bg: 'bg-green-600', icon: '🌤️' },
  'Top Rated': { bg: 'bg-amber-500', icon: '⭐' },
  'Great Deal': { bg: 'bg-red-500', icon: '🎯' },
};

/**
 * Single merchandising badge for product card
 * Only one badge per card to avoid clutter
 */
export function SmartBadge({ badge, className = '' }: SmartBadgeProps) {
  if (!badge) return null;
  
  const style = BADGE_STYLES[badge] || { bg: 'bg-neutral-600', icon: '✓' };
  
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${style.bg} px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ${className}`}>
      <span>{style.icon}</span>
      <span>{badge}</span>
    </span>
  );
}

/**
 * Determine which merchandising badge to show (if any)
 * Uses deterministic logic based on tire attributes
 */
export function determineBadge(tire: TireCardData): MerchandisingBadge {
  const { brand, category, mileageWarranty, price, stock } = tire;
  const brandLower = (brand || '').toLowerCase();
  
  // Priority 1: Long tread life (80K+ warranty)
  if (mileageWarranty && mileageWarranty >= 80000) {
    return 'Long Tread Life';
  }
  
  // Priority 2: Most Popular (high stock from premium brand)
  const premiumBrands = ['michelin', 'bridgestone', 'continental', 'goodyear', 'pirelli'];
  if (stock && stock >= 50 && premiumBrands.includes(brandLower)) {
    return 'Most Popular';
  }
  
  // Priority 3: Best Value (mid-tier brand, good price, good stock)
  const midTierBrands = ['cooper', 'toyo', 'bfgoodrich', 'yokohama', 'hankook', 'falken', 'general', 'kumho', 'nexen'];
  if (price && price >= 80 && price <= 150 && stock && stock >= 16 && midTierBrands.includes(brandLower)) {
    return 'Best Value';
  }
  
  // Priority 4: All-Season Pick (good all-rounder)
  if (category === 'All-Season' && mileageWarranty && mileageWarranty >= 60000 && stock && stock >= 20) {
    return 'All-Season Pick';
  }
  
  // Priority 5: Quiet Ride (Highway/Touring with good warranty)
  if (category === 'Highway/Touring' && mileageWarranty && mileageWarranty >= 50000) {
    return 'Quiet Ride';
  }
  
  return null;
}

// ============================================================================
// 5. TOP PICKS / GUIDED STRIP
// ============================================================================

export interface TopPickTire {
  id: string;
  label: string;
  brand: string;
  model: string;
  price: number;
  imageUrl?: string | null;
  reason: string;
  href: string;
}

interface TopPicksStripProps {
  picks: TopPickTire[];
  title?: string;
}

/**
 * Guided selection strip above search results
 * Shows 3-4 recommended tires with clear differentiation
 */
export function TopPicksStrip({ picks, title = "Quick Picks" }: TopPicksStripProps) {
  if (!picks || picks.length === 0) return null;
  
  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⭐</span>
        <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
        <span className="text-xs text-neutral-500">— Our recommendations for you</span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {picks.slice(0, 4).map((pick) => (
          <Link
            key={pick.id}
            href={pick.href}
            className="flex items-center gap-3 rounded-xl bg-white p-3 border border-neutral-200 hover:border-amber-300 hover:shadow-md transition-all group"
          >
            {pick.imageUrl ? (
              <img 
                src={pick.imageUrl} 
                alt={pick.model} 
                className="w-14 h-14 object-contain flex-shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="w-14 h-14 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🛞</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
                {pick.label}
              </div>
              <div className="text-xs font-bold text-neutral-900 truncate group-hover:underline">
                {pick.brand} {pick.model}
              </div>
              <div className="text-xs text-neutral-500 truncate">
                {pick.reason}
              </div>
              <div className="text-sm font-extrabold text-neutral-900 mt-0.5">
                ${(pick.price * 4).toLocaleString()}<span className="text-[10px] text-neutral-400 font-normal"> /set</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Generate top picks from search results
 * Uses deterministic scoring to select varied recommendations
 */
export function generateTopPicks(
  tires: TireCardData[],
  baseHref: string,
  getHref: (tire: any) => string
): TopPickTire[] {
  if (!tires || tires.length < 3) return [];
  
  const picks: TopPickTire[] = [];
  const usedBrands = new Set<string>();
  
  // Find "Best Overall" - highest score premium tire
  const premiumBrands = ['michelin', 'bridgestone', 'continental', 'goodyear', 'pirelli'];
  const bestOverall = tires.find(t => {
    const brandLower = (t.brand || '').toLowerCase();
    return premiumBrands.includes(brandLower) && t.stock && t.stock >= 8 && t.price;
  });
  if (bestOverall && bestOverall.brand) {
    usedBrands.add(bestOverall.brand.toLowerCase());
    picks.push({
      id: 'best-overall',
      label: 'Best Overall',
      brand: bestOverall.brand,
      model: (bestOverall as any).model || (bestOverall as any).displayName || 'Premium Tire',
      price: bestOverall.price || 0,
      imageUrl: (bestOverall as any).imageUrl,
      reason: 'Premium quality & reliability',
      href: getHref(bestOverall),
    });
  }
  
  // Find "Best Value" - mid-tier with good warranty
  const midTierBrands = ['cooper', 'toyo', 'bfgoodrich', 'yokohama', 'hankook', 'falken'];
  const bestValue = tires.find(t => {
    const brandLower = (t.brand || '').toLowerCase();
    return midTierBrands.includes(brandLower) && 
           !usedBrands.has(brandLower) &&
           t.price && t.price >= 60 && t.price <= 160 &&
           t.stock && t.stock >= 8;
  });
  if (bestValue && bestValue.brand) {
    usedBrands.add(bestValue.brand.toLowerCase());
    picks.push({
      id: 'best-value',
      label: 'Best Value',
      brand: bestValue.brand,
      model: (bestValue as any).model || (bestValue as any).displayName || 'Value Tire',
      price: bestValue.price || 0,
      imageUrl: (bestValue as any).imageUrl,
      reason: 'Great quality at a fair price',
      href: getHref(bestValue),
    });
  }
  
  // Find "Longest Tread Life" - highest warranty
  const longestLife = [...tires]
    .filter(t => t.brand && !usedBrands.has(t.brand.toLowerCase()) && t.mileageWarranty && t.mileageWarranty >= 60000)
    .sort((a, b) => (b.mileageWarranty || 0) - (a.mileageWarranty || 0))[0];
  if (longestLife && longestLife.brand) {
    usedBrands.add(longestLife.brand.toLowerCase());
    const miles = Math.round((longestLife.mileageWarranty || 0) / 1000);
    picks.push({
      id: 'longest-life',
      label: 'Longest Tread Life',
      brand: longestLife.brand,
      model: (longestLife as any).model || (longestLife as any).displayName || 'Long Life Tire',
      price: longestLife.price || 0,
      imageUrl: (longestLife as any).imageUrl,
      reason: `${miles}K mile warranty`,
      href: getHref(longestLife),
    });
  }
  
  // Find "Budget Pick" - lowest price with decent stock
  const budgetPick = [...tires]
    .filter(t => t.brand && !usedBrands.has(t.brand.toLowerCase()) && t.price && t.price > 0 && t.stock && t.stock >= 4)
    .sort((a, b) => (a.price || 999) - (b.price || 999))[0];
  if (budgetPick && budgetPick.brand && picks.length < 4) {
    picks.push({
      id: 'budget-pick',
      label: 'Budget Friendly',
      brand: budgetPick.brand,
      model: (budgetPick as any).model || (budgetPick as any).displayName || 'Economy Tire',
      price: budgetPick.price || 0,
      imageUrl: (budgetPick as any).imageUrl,
      reason: 'Affordable option',
      href: getHref(budgetPick),
    });
  }
  
  return picks;
}

// ============================================================================
// 6. CARD ENHANCEMENT WRAPPER (combines multiple enhancements)
// ============================================================================

interface TireCardEnhancementsProps {
  tire: TireCardData;
  /** Review rating (1-5) - pass real data if available */
  rating?: number | null;
  /** Review count - pass real data if available */
  reviewCount?: number | null;
  hasVehicle?: boolean;
  showBestFor?: boolean;
  showTrust?: boolean;
}

/**
 * Combined enhancements block for tire cards
 * Place this after the title or before the price
 * 
 * NOTE: Review summary only shows when real rating/reviewCount data is provided.
 * It hides gracefully when no data exists (no fake placeholders).
 */
export function TireCardEnhancements({
  tire,
  rating,
  reviewCount,
  hasVehicle = false,
  showBestFor = true,
  showTrust = false,
}: TireCardEnhancementsProps) {
  return (
    <div className="space-y-1">
      {/* Review summary - only shows with real data */}
      <CardReviewSummary rating={rating} reviewCount={reviewCount} />
      
      {/* Best for line */}
      {showBestFor && tire.category && (
        <BestForLine 
          category={tire.category}
          mileageWarranty={tire.mileageWarranty}
          isRunFlat={tire.isRunFlat}
          is3PMSF={tire.is3PMSF}
        />
      )}
      
      {/* Trust micro-line (optional) */}
      {showTrust && (
        <TrustMicroLine 
          hasVehicle={hasVehicle}
          inStock={(tire.stock || 0) >= 4}
          hasWarranty={Boolean(tire.mileageWarranty && tire.mileageWarranty > 0)}
        />
      )}
    </div>
  );
}

// ============================================================================
// 7. VEHICLE-AWARE RECOMMENDATIONS (Upgraded Top Picks)
// ============================================================================

interface VehicleAwareRecommendationsProps {
  tires: TireForRecommendation[];
  vehicle?: VehicleContext | null;
  getHref: (tire: TireForRecommendation) => string;
  title?: string;
  maxRecommendations?: number;
  onRecommendationClick?: (recommendation: TireRecommendation, position: number) => void;
}

const RECOMMENDATION_ICONS: Record<string, string> = {
  "best-for-vehicle": "🏆",
  "most-popular": "🔥",
  "longest-lasting": "🛡️",
  "all-weather-confidence": "❄️",
};

const RECOMMENDATION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "best-for-vehicle": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  "most-popular": { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
  "longest-lasting": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  "all-weather-confidence": { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
};

/**
 * Vehicle-Aware Recommendations Strip
 * 
 * Upgraded from generic "Top Picks" to personalized, conversion-focused recommendations
 * that understand the selected vehicle and guide users to confident decisions.
 */
export function VehicleAwareRecommendations({
  tires,
  vehicle,
  getHref,
  title,
  maxRecommendations = 3,
  onRecommendationClick,
}: VehicleAwareRecommendationsProps) {
  const { recommendations, vehicleLabel } = generateTireRecommendations(
    tires,
    vehicle,
    maxRecommendations
  );

  if (recommendations.length === 0) return null;

  const displayTitle = title || (vehicleLabel 
    ? `Our Picks for Your ${vehicleLabel}` 
    : "Our Top Recommendations");

  return (
    <div className="mb-6 rounded-2xl border border-neutral-200 bg-gradient-to-r from-neutral-50 to-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">✨</span>
        <h3 className="text-sm font-bold text-neutral-900">{displayTitle}</h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recommendations.map((rec, index) => {
          const colors = RECOMMENDATION_COLORS[rec.type] || RECOMMENDATION_COLORS["best-for-vehicle"];
          const icon = RECOMMENDATION_ICONS[rec.type] || "⭐";
          
          return (
            <Link
              key={rec.tire.sku}
              href={getHref(rec.tire)}
              onClick={() => onRecommendationClick?.(rec, index)}
              className={`relative flex flex-col rounded-xl ${colors.bg} border ${colors.border} p-4 hover:shadow-md transition-all group`}
            >
              {/* Recommendation Label */}
              <div className={`flex items-center gap-1.5 text-xs font-bold ${colors.text} mb-2`}>
                <span>{icon}</span>
                <span>{rec.label}</span>
              </div>
              
              {/* Tire Info */}
              <div className="flex items-start gap-3 flex-1">
                {rec.tire.imageUrl ? (
                  <img 
                    src={rec.tire.imageUrl} 
                    alt={rec.tire.model || rec.tire.displayName || ''} 
                    className="w-16 h-16 object-contain flex-shrink-0 bg-white rounded-lg p-1"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl opacity-50">🛞</span>
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-neutral-900 group-hover:underline">
                    {rec.tire.brand}
                  </div>
                  <div className="text-xs text-neutral-600 truncate">
                    {rec.tire.model || rec.tire.displayName}
                  </div>
                  
                  {/* Reason Line */}
                  <div className="mt-1.5 text-[11px] text-neutral-500 line-clamp-2">
                    {rec.reason}
                  </div>
                </div>
              </div>
              
              {/* Price */}
              {rec.tire.price && rec.tire.price > 0 && (
                <div className="mt-3 pt-3 border-t border-neutral-200/50">
                  <div className="text-base font-extrabold text-neutral-900">
                    ${(rec.tire.price * 4).toLocaleString()}
                    <span className="text-[10px] text-neutral-400 font-normal ml-1">/set of 4</span>
                  </div>
                </div>
              )}
              
              {/* Confidence indicator for high-confidence picks */}
              {rec.confidence === "high" && (
                <div className="absolute top-2 right-2">
                  <span className="text-green-500 text-xs" title="High confidence recommendation">✓</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
      
      {/* Vehicle context note */}
      {vehicle?.make && vehicle?.model && (
        <p className="mt-4 text-[10px] text-neutral-400 text-center">
          Personalized for your {vehicle.year} {vehicle.make} {vehicle.model}
        </p>
      )}
    </div>
  );
}

/**
 * Generate recommendations using the new vehicle-aware system
 * (wrapper for backward compatibility)
 */
export function generateVehicleAwareRecommendations(
  tires: TireForRecommendation[],
  vehicle?: VehicleContext | null,
  maxRecommendations: number = 3
): RecommendationSet {
  return generateTireRecommendations(tires, vehicle, maxRecommendations);
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export types for convenience
export type { TireForRecommendation, VehicleContext, TireRecommendation, RecommendationSet };

export default {
  CardReviewSummary,
  BestForLine,
  TrustMicroLine,
  SmartBadge,
  determineBadge,
  TopPicksStrip,
  generateTopPicks,
  TireCardEnhancements,
  // New vehicle-aware system
  VehicleAwareRecommendations,
  generateVehicleAwareRecommendations,
};
