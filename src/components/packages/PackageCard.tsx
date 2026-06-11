"use client";

/**
 * Package Card Component - Merchandising MVP
 * 
 * Features:
 * - Badge system: BEST VALUE, MOST POPULAR, PREMIUM
 * - Brand logos
 * - Trust signals
 * - Monthly payment estimate
 * - Savings display
 * - Mobile-first design
 * 
 * @created 2026-06-11
 */

import { useEffect } from "react";
import Image from "next/image";
import { 
  trackPackageView, 
  trackPackageBadgeView, 
  trackPackageBadgeClick,
  type PackageBadgeType 
} from "@/lib/analytics/tracker";
import type { RecommendedPackage, PackageCategory } from "@/lib/packages/engine";

// ============================================================================
// Types
// ============================================================================

export interface PackageCardProps {
  package: RecommendedPackage;
  badge?: PackageBadgeType;
  vehicleMake: string;
  vehicleModel: string;
  savingsVsSeparate?: number;
  installedPrice?: number;
  onSelect: () => void;
  position?: 'left' | 'center' | 'right';
  totalPackages?: number;
}

// ============================================================================
// Badge Configuration
// ============================================================================

const BADGE_CONFIG: Record<PackageBadgeType, {
  label: string;
  icon: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  description: string;
}> = {
  best_value: {
    label: "BEST VALUE",
    icon: "💰",
    bgColor: "bg-green-600",
    textColor: "text-white",
    borderColor: "border-green-500",
    description: "Great quality at the lowest price",
  },
  most_popular: {
    label: "MOST POPULAR",
    icon: "⭐",
    bgColor: "bg-red-600",
    textColor: "text-white",
    borderColor: "border-red-500",
    description: "Customer favorite for your vehicle",
  },
  premium: {
    label: "PREMIUM",
    icon: "👑",
    bgColor: "bg-amber-500",
    textColor: "text-white",
    borderColor: "border-amber-400",
    description: "Top-tier quality & performance",
  },
};

// ============================================================================
// Category to Good/Better/Best mapping
// ============================================================================

const CATEGORY_TIER: Record<PackageCategory, {
  tier: 'good' | 'better' | 'best';
  whyRecommend: string;
  rideQuality: string;
  warranty: string;
  performance: string;
}> = {
  daily_driver: {
    tier: 'good',
    whyRecommend: "Perfect OEM replacement with enhanced style",
    rideQuality: "Smooth, quiet ride like factory",
    warranty: "Standard manufacturer warranty",
    performance: "All-season versatility",
  },
  sport_aggressive: {
    tier: 'better',
    whyRecommend: "Aggressive styling with improved grip",
    rideQuality: "Sportier, responsive feel",
    warranty: "Enhanced road hazard coverage",
    performance: "Street performance focus",
  },
  premium_look: {
    tier: 'best',
    whyRecommend: "Premium brands with showroom presence",
    rideQuality: "Superior comfort & refinement",
    warranty: "Extended warranty options",
    performance: "Premium all-season capability",
  },
  offroad_lifted: {
    tier: 'better',
    whyRecommend: "Built for trails & tough terrain",
    rideQuality: "Rugged, trail-ready stance",
    warranty: "Off-road specific coverage",
    performance: "All-terrain capability",
  },
};

// ============================================================================
// Brand Logo Helper
// ============================================================================

function getBrandLogoUrl(brand: string): string | null {
  const normalizedBrand = brand.toLowerCase().replace(/\s+/g, '-');
  // Common wheel and tire brands with logos
  const knownBrands = [
    'fuel', 'method', 'american-racing', 'kmc', 'xd', 'moto-metal', 'vision',
    'nitto', 'toyo', 'falken', 'cooper', 'bf-goodrich', 'michelin', 'goodyear',
    'bridgestone', 'continental', 'pirelli', 'hankook', 'yokohama',
  ];
  
  if (knownBrands.includes(normalizedBrand)) {
    return `/brands/${normalizedBrand}.png`;
  }
  return null;
}

// ============================================================================
// Monthly Payment Calculator
// ============================================================================

function calculateMonthlyPayment(price: number, months: number = 12, apr: number = 0): number {
  // Simple monthly payment for 0% APR financing
  return Math.ceil(price / months);
}

// ============================================================================
// Main Component
// ============================================================================

export function PackageCard({
  package: pkg,
  badge,
  vehicleMake,
  vehicleModel,
  savingsVsSeparate,
  installedPrice,
  onSelect,
  position = 'left',
  totalPackages = 1,
}: PackageCardProps) {
  const badgeConfig = badge ? BADGE_CONFIG[badge] : null;
  const tierInfo = CATEGORY_TIER[pkg.category];
  const isFeatured = badge === 'most_popular';
  
  const monthlyPayment = calculateMonthlyPayment(pkg.totalPrice);
  const wheelLogoUrl = getBrandLogoUrl(pkg.wheel.brand);
  const effectiveInstalledPrice = installedPrice || Math.round(pkg.totalPrice * 1.08); // ~8% for install
  
  // Track view on mount
  useEffect(() => {
    trackPackageView(pkg.id, badge);
    if (badge) {
      trackPackageBadgeView(badge, pkg.id);
    }
  }, [pkg.id, badge]);

  const handleClick = () => {
    if (badge) {
      trackPackageBadgeClick(badge, pkg.id);
    }
    onSelect();
  };

  return (
    <div
      className={`
        relative flex flex-col w-full sm:w-80 rounded-2xl bg-white overflow-hidden transition-all duration-200
        ${isFeatured 
          ? `border-2 ${badgeConfig?.borderColor || 'border-red-500'} shadow-lg scale-[1.02] z-10` 
          : "border border-neutral-200 shadow-sm hover:shadow-md hover:border-neutral-300"
        }
      `}
    >
      {/* Badge Banner */}
      {badgeConfig && (
        <div className={`${badgeConfig.bgColor} ${badgeConfig.textColor} text-center py-2 px-4`}>
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">{badgeConfig.icon}</span>
            <span className="text-sm font-bold tracking-wide">{badgeConfig.label}</span>
          </div>
          {isFeatured && (
            <p className="text-xs opacity-90 mt-0.5">{badgeConfig.description}</p>
          )}
        </div>
      )}

      {/* Image Section with Brand Logos */}
      <div className="relative h-48 bg-gradient-to-b from-neutral-50 to-white">
        {pkg.wheel.imageUrl ? (
          <Image
            src={pkg.wheel.imageUrl}
            alt={`${pkg.wheel.brand} ${pkg.wheel.model}`}
            fill
            className="object-contain p-4"
            sizes="320px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-7xl">🛞</span>
          </div>
        )}
        
        {/* Brand Logos Overlay */}
        {wheelLogoUrl && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur rounded-lg px-2 py-1">
            <Image
              src={wheelLogoUrl}
              alt={pkg.wheel.brand}
              width={60}
              height={24}
              className="object-contain"
            />
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 p-5">
        {/* Tier Label (Good/Better/Best) */}
        {totalPackages >= 3 && (
          <div className="mb-2">
            <span className={`
              inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide
              ${tierInfo.tier === 'best' ? 'bg-amber-100 text-amber-800' :
                tierInfo.tier === 'better' ? 'bg-blue-100 text-blue-800' :
                'bg-neutral-100 text-neutral-600'}
            `}>
              {tierInfo.tier === 'best' ? '★ Best' : tierInfo.tier === 'better' ? '★ Better' : 'Good'}
            </span>
          </div>
        )}

        {/* Wheel + Tire Info */}
        <h3 className="text-lg font-bold text-neutral-900 leading-tight mb-1">
          {pkg.wheel.brand} {pkg.wheel.model}
        </h3>
        <p className="text-sm text-neutral-500 mb-3">
          + Matching Tires • {pkg.sizeSpec}
        </p>

        {/* Price Block */}
        <div className="bg-neutral-50 rounded-xl p-4 mb-4">
          {/* Total Price */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold text-neutral-900">
              ${pkg.totalPrice.toLocaleString()}
            </span>
            <span className="text-sm text-neutral-500">complete</span>
          </div>

          {/* Installed Price */}
          <p className="text-sm text-neutral-600 mb-2">
            <span className="font-medium">${effectiveInstalledPrice.toLocaleString()}</span> installed
          </p>

          {/* Monthly Payment */}
          <div className="flex items-center gap-1 text-sm">
            <span className="text-blue-600 font-semibold">
              ${monthlyPayment}/mo
            </span>
            <span className="text-neutral-400">with financing</span>
          </div>

          {/* Savings */}
          {savingsVsSeparate && savingsVsSeparate > 0 && (
            <p className="text-sm text-green-600 font-medium mt-2">
              💰 Save ${savingsVsSeparate.toLocaleString()} vs buying separately
            </p>
          )}
        </div>

        {/* Trust Signals */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <span>✓</span>
            <span className="font-medium">Fits your {vehicleMake} {vehicleModel}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span>✓</span>
            <span>TPMS compatible</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span>✓</span>
            <span>Mounted & balanced ready</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span>✓</span>
            <span>Professional installation available</span>
          </div>
        </div>

        {/* Why Recommended (for featured) */}
        {isFeatured && tierInfo && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-red-800">
              Why Jake recommends this: {tierInfo.whyRecommend}
            </p>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={handleClick}
          className={`
            w-full rounded-xl px-4 py-3.5 text-sm font-bold transition-all duration-200
            ${isFeatured 
              ? `${badgeConfig?.bgColor || 'bg-red-600'} text-white hover:opacity-90 shadow-md` 
              : "bg-neutral-900 text-white hover:bg-neutral-800"
            }
          `}
        >
          {isFeatured ? 'Build This Package ★' : 'Build This Package'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Badge Assignment Logic
// ============================================================================

export interface PackageWithBadge {
  package: RecommendedPackage;
  badge?: PackageBadgeType;
}

/**
 * Assign badges to packages based on:
 * - BEST VALUE: Lowest price that meets quality threshold (not cheapest junk)
 * - MOST POPULAR: Daily driver category OR center position
 * - PREMIUM: Highest price / premium_look category
 */
export function assignPackageBadges(packages: RecommendedPackage[]): PackageWithBadge[] {
  if (packages.length === 0) return [];
  if (packages.length === 1) {
    return [{ package: packages[0], badge: 'most_popular' }];
  }

  // Sort by price to find best value and premium
  const sortedByPrice = [...packages].sort((a, b) => a.totalPrice - b.totalPrice);
  
  // Find best value: lowest price package that's not "offroad_lifted" (often incomplete)
  const bestValuePkg = sortedByPrice.find(p => 
    p.category !== 'offroad_lifted' && p.fitmentValidation.safe
  ) || sortedByPrice[0];
  
  // Find premium: highest price package
  const premiumPkg = sortedByPrice[sortedByPrice.length - 1];
  
  // Find most popular: daily_driver category, or middle package if 3+
  let mostPopularPkg: RecommendedPackage;
  const dailyDriver = packages.find(p => p.category === 'daily_driver');
  if (dailyDriver) {
    mostPopularPkg = dailyDriver;
  } else if (packages.length >= 3) {
    // Middle package
    mostPopularPkg = packages[Math.floor(packages.length / 2)];
  } else {
    // Default to first
    mostPopularPkg = packages[0];
  }

  // Assign badges (avoid duplicates)
  const result: PackageWithBadge[] = [];
  const assigned = new Set<string>();

  for (const pkg of packages) {
    let badge: PackageBadgeType | undefined;
    
    // Priority: most_popular > best_value > premium
    if (pkg.id === mostPopularPkg.id && !assigned.has('most_popular')) {
      badge = 'most_popular';
      assigned.add('most_popular');
    } else if (pkg.id === bestValuePkg.id && !assigned.has('best_value') && pkg.id !== mostPopularPkg.id) {
      badge = 'best_value';
      assigned.add('best_value');
    } else if (pkg.id === premiumPkg.id && !assigned.has('premium') && pkg.id !== mostPopularPkg.id && pkg.id !== bestValuePkg.id) {
      badge = 'premium';
      assigned.add('premium');
    }

    result.push({ package: pkg, badge });
  }

  return result;
}

export default PackageCard;
