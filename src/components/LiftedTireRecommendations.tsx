"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LIFT_LEVELS } from "@/lib/homepage-intent/config";
import type { LiftLevel } from "@/lib/homepage-intent/types";

/**
 * LiftedTireRecommendations
 * 
 * Enhanced tire recommendations for users coming from the lifted build flow.
 * Shows Best Match, Most Popular, and Premium options with clear labels.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RecommendedTire {
  sku: string;
  brand: string;
  model: string;
  size: string;
  price: number;
  imageUrl?: string | null;
  category?: string;
  mileageWarranty?: number | null;
  inStock: boolean;
  stockQty?: number;
}

interface TireRecommendation {
  label: "Best Match" | "Most Popular" | "Premium" | "Budget Friendly" | "Best Value";
  tire: RecommendedTire;
  reason: string;
  highlight?: boolean;
}

// ============================================================================
// LIFTED TIRE RECOMMENDATIONS STRIP
// ============================================================================

interface LiftedTireRecommendationsProps {
  tires: RecommendedTire[];
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  modification?: string;
  className?: string;
}

export function LiftedTireRecommendations({
  tires,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  modification,
  className = "",
}: LiftedTireRecommendationsProps) {
  const searchParams = useSearchParams();
  
  const liftLevel = searchParams.get("liftLevel") as LiftLevel | null;
  const liftedInches = searchParams.get("liftedInches");
  const buildType = searchParams.get("buildType");
  
  // Only show for lifted builds
  if (!buildType || buildType === "stock") {
    return null;
  }
  
  const liftConfig = liftLevel ? LIFT_LEVELS[liftLevel] : null;
  const tireSizes = liftConfig?.targetTireSizes || [];
  const inches = liftedInches ? parseInt(liftedInches) : liftConfig?.inches || 0;
  
  // Generate recommendations from available tires
  const recommendations = generateRecommendations(tires, inches);
  
  if (recommendations.length === 0) {
    return null;
  }
  
  // Build tire detail URL
  const buildTireUrl = (tire: RecommendedTire) => {
    const params = new URLSearchParams();
    params.set("year", vehicleYear);
    params.set("make", vehicleMake);
    params.set("model", vehicleModel);
    if (modification) params.set("modification", modification);
    if (liftLevel) params.set("liftLevel", liftLevel);
    if (liftedInches) params.set("liftedInches", liftedInches);
    if (buildType) params.set("buildType", buildType);
    return `/tires/${tire.sku}?${params.toString()}`;
  };

  const formatPrice = (price: number) => 
    `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className={`rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <div>
            <h3 className="text-lg font-extrabold text-neutral-900">
              Recommended for Your {inches}" Lifted Build
            </h3>
            <p className="text-sm text-neutral-600">
              {tireSizes.length > 0 ? `${tireSizes.join("-")}" tires` : "Tires"} that fit perfectly
            </p>
          </div>
        </div>
        <span className="hidden sm:inline text-xs text-amber-700 font-semibold">
          🔥 Top choices for this setup
        </span>
      </div>
      
      {/* Recommendations Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recommendations.slice(0, 3).map((rec, index) => (
          <Link
            key={rec.tire.sku}
            href={buildTireUrl(rec.tire)}
            className={`relative flex flex-col rounded-xl border-2 bg-white p-4 transition-all hover:shadow-lg ${
              rec.highlight 
                ? "border-green-400 ring-2 ring-green-200" 
                : "border-neutral-200 hover:border-amber-300"
            }`}
          >
            {/* Label Badge */}
            <div className={`absolute -top-2 left-3 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              rec.label === "Best Match" 
                ? "bg-green-500 text-white" 
                : rec.label === "Most Popular"
                ? "bg-amber-500 text-white"
                : rec.label === "Premium"
                ? "bg-purple-500 text-white"
                : "bg-blue-500 text-white"
            }`}>
              {rec.label}
            </div>
            
            {/* Content */}
            <div className="flex items-start gap-3 mt-2">
              {rec.tire.imageUrl ? (
                <img 
                  src={rec.tire.imageUrl} 
                  alt={rec.tire.model}
                  className="w-16 h-16 object-contain flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🛞</span>
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="text-xs text-neutral-500">{rec.tire.brand}</div>
                <div className="text-sm font-bold text-neutral-900 truncate">{rec.tire.model}</div>
                <div className="text-xs text-neutral-600">{rec.tire.size}</div>
                {rec.tire.category && (
                  <div className="mt-1 text-xs text-amber-700 font-medium">{rec.tire.category}</div>
                )}
              </div>
            </div>
            
            {/* Reason */}
            <div className="mt-2 text-xs text-neutral-600">{rec.reason}</div>
            
            {/* Price + Stock */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-lg font-extrabold text-neutral-900">
                {formatPrice(rec.tire.price)}
              </span>
              {rec.tire.inStock && (
                <span className="text-xs text-green-600 font-medium">✓ In Stock</span>
              )}
            </div>
            
            {/* Mileage Warranty */}
            {rec.tire.mileageWarranty && (
              <div className="mt-1 text-xs text-neutral-500">
                {rec.tire.mileageWarranty.toLocaleString()} mile warranty
              </div>
            )}
          </Link>
        ))}
      </div>
      
      {/* Trust Messaging */}
      <div className="mt-4 pt-4 border-t border-amber-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
            <span className="flex items-center gap-1">
              <span className="text-green-500">✓</span>
              <strong>Fitment guaranteed</strong> — no guesswork
            </span>
            <span className="flex items-center gap-1">
              <span className="text-green-500">✓</span>
              Free shipping over $1,500
            </span>
          </div>
          <span className="text-xs text-blue-700 font-medium">
            🔧 Install available in Pontiac &amp; Waterford
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RECOMMENDATION GENERATOR
// ============================================================================

function generateRecommendations(tires: RecommendedTire[], liftInches: number): TireRecommendation[] {
  if (!tires || tires.length < 3) return [];
  
  const recommendations: TireRecommendation[] = [];
  const usedSkus = new Set<string>();
  
  // Premium brands for lifted trucks
  const premiumBrands = ['bfgoodrich', 'toyo', 'nitto', 'falken', 'mickey thompson'];
  const midBrands = ['cooper', 'general', 'firestone', 'yokohama', 'hankook'];
  const valueBrands = ['atturo', 'lexani', 'venom power', 'lionhart'];
  
  // All-terrain / mud-terrain categories for lifted builds
  const offRoadCategories = ['all-terrain', 'mud-terrain', 'rugged-terrain', 'all terrain', 'mud terrain'];
  
  // 1. Best Match - AT tire from premium brand, in stock
  const bestMatch = tires.find(t => {
    const brandLower = (t.brand || '').toLowerCase();
    const catLower = (t.category || '').toLowerCase();
    return premiumBrands.some(b => brandLower.includes(b)) &&
           offRoadCategories.some(c => catLower.includes(c)) &&
           t.inStock &&
           (t.stockQty || 0) >= 4 &&
           !usedSkus.has(t.sku);
  });
  
  if (bestMatch) {
    usedSkus.add(bestMatch.sku);
    recommendations.push({
      label: "Best Match",
      tire: bestMatch,
      reason: `Top-rated for ${liftInches}" lifted trucks`,
      highlight: true,
    });
  }
  
  // 2. Most Popular - mid-tier brand, good stock
  const mostPopular = tires.find(t => {
    const brandLower = (t.brand || '').toLowerCase();
    return (midBrands.some(b => brandLower.includes(b)) || 
            premiumBrands.some(b => brandLower.includes(b))) &&
           t.inStock &&
           (t.stockQty || 0) >= 8 &&
           !usedSkus.has(t.sku);
  });
  
  if (mostPopular) {
    usedSkus.add(mostPopular.sku);
    recommendations.push({
      label: "Most Popular",
      tire: mostPopular,
      reason: "Customer favorite for this build",
    });
  }
  
  // 3. Premium - highest price premium brand
  const premium = tires
    .filter(t => {
      const brandLower = (t.brand || '').toLowerCase();
      return premiumBrands.some(b => brandLower.includes(b)) &&
             t.inStock &&
             !usedSkus.has(t.sku);
    })
    .sort((a, b) => (b.price || 0) - (a.price || 0))[0];
  
  if (premium) {
    usedSkus.add(premium.sku);
    recommendations.push({
      label: "Premium",
      tire: premium,
      reason: "Maximum performance & durability",
    });
  }
  
  // 4. If we don't have 3 yet, add budget option
  if (recommendations.length < 3) {
    const budget = tires.find(t => {
      const brandLower = (t.brand || '').toLowerCase();
      return (valueBrands.some(b => brandLower.includes(b)) ||
              t.price && t.price < 150) &&
             t.inStock &&
             !usedSkus.has(t.sku);
    });
    
    if (budget) {
      usedSkus.add(budget.sku);
      recommendations.push({
        label: "Budget Friendly",
        tire: budget,
        reason: "Great value for the money",
      });
    }
  }
  
  return recommendations;
}

// ============================================================================
// TRUST BAR FOR TIRE PAGE
// ============================================================================

export function TireTrustBar({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-green-50 border border-green-200 px-4 py-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
        <span className="flex items-center gap-2 text-green-800">
          <span className="text-green-600">✓</span>
          <strong>Fitment Guarantee</strong>
          <span className="text-green-600">—</span>
          Everything shown will fit
        </span>
        <span className="flex items-center gap-2 text-green-800">
          <span className="text-green-600">✓</span>
          Free Shipping over $1,500
        </span>
        <span className="flex items-center gap-2 text-blue-700">
          🔧 Install at Pontiac &amp; Waterford
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// STORE REVIEWS SNIPPET
// ============================================================================

export function StoreReviewsSnippet({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-white border border-neutral-200 px-4 py-3 ${className}`}>
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-1">
          <span className="text-yellow-500">★★★★★</span>
          <span className="font-bold text-neutral-900">4.8</span>
        </div>
        <span className="text-sm text-neutral-600">
          <strong>2,500+</strong> 5-star reviews
        </span>
        <span className="text-xs text-neutral-500">|</span>
        <span className="text-sm text-neutral-600">
          Trusted since 1979
        </span>
      </div>
    </div>
  );
}
