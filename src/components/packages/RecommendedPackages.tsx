"use client";

/**
 * Recommended Packages Component - Merchandising MVP
 * 
 * Displays curated wheel + tire packages with:
 * - Badge system (BEST VALUE, MOST POPULAR, PREMIUM)
 * - Good/Better/Best tier labels
 * - Trust signals and pricing
 * - Mobile-first responsive design
 * 
 * @updated 2026-06-11 - Merchandising MVP
 */

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageCard, assignPackageBadges, type PackageWithBadge } from "./PackageCard";
import type { RecommendedPackage } from "@/lib/packages/engine";

// ============================================================================
// Types
// ============================================================================

interface RecommendedPackagesProps {
  year: number;
  make: string;
  model: string;
  trim?: string;
  className?: string;
  maxPackages?: number;
  showTitle?: boolean;
  showGoodBetterBest?: boolean;
}

interface PackageData {
  packages: RecommendedPackage[];
  vehicle: { year: number; make: string; model: string; trim?: string };
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Trust Stack Component
// ============================================================================

function TrustStack() {
  const items = [
    { icon: "🛞", text: "Wheels + Tires" },
    { icon: "🔧", text: "Mounted & Balanced" },
    { icon: "📡", text: "TPMS Included" },
    { icon: "✓", text: "Fitment Guaranteed" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4 px-4 bg-neutral-50 rounded-xl border border-neutral-200 mb-6">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 text-sm text-neutral-700">
          <span>{item.icon}</span>
          <span className="font-medium">{item.text}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Price Anchor Component
// ============================================================================

function PriceAnchor({ packages }: { packages: RecommendedPackage[] }) {
  if (packages.length === 0) return null;
  
  const prices = packages.map(p => p.totalPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  return (
    <p className="text-center text-lg text-neutral-600 mb-6">
      Complete packages from{" "}
      <span className="font-bold text-neutral-900">${minPrice.toLocaleString()}</span>
      {maxPrice > minPrice && (
        <> – <span className="font-bold text-neutral-900">${maxPrice.toLocaleString()}</span></>
      )}
      {" "}
      <span className="text-green-700 font-medium">• Fast nationwide shipping</span>
    </p>
  );
}

// ============================================================================
// Good/Better/Best Legend
// ============================================================================

function TierLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 mb-6 text-sm">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 font-bold text-xs">Good</span>
        <span className="text-neutral-500">Quality basics</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-xs">★ Better</span>
        <span className="text-neutral-500">Enhanced features</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-xs">★ Best</span>
        <span className="text-neutral-500">Premium quality</span>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="flex gap-6 overflow-x-auto pb-4 justify-center">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex-shrink-0 w-80 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50 p-5"
        >
          <div className="h-8 w-24 rounded bg-neutral-200 mb-4" />
          <div className="h-44 rounded-xl bg-neutral-200 mb-4" />
          <div className="h-5 w-28 rounded bg-neutral-200 mb-2" />
          <div className="h-6 w-full rounded bg-neutral-200 mb-3" />
          <div className="h-24 w-full rounded bg-neutral-200 mb-3" />
          <div className="h-12 w-full rounded bg-neutral-200" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RecommendedPackages({
  year,
  make,
  model,
  trim,
  className = "",
  maxPackages = 6,
  showTitle = true,
  showGoodBetterBest = true,
}: RecommendedPackagesProps) {
  const router = useRouter();
  const [data, setData] = useState<PackageData>({
    packages: [],
    vehicle: { year, make, model, trim },
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchPackages() {
      setData(prev => ({ ...prev, loading: true, error: null }));

      try {
        const params = new URLSearchParams({
          year: String(year),
          make,
          model,
        });
        if (trim) params.set("trim", trim);

        const res = await fetch(`/api/packages/recommended?${params}`);
        
        if (!res.ok) {
          throw new Error(`Failed to fetch packages: ${res.status}`);
        }

        const json = await res.json();

        if (!cancelled) {
          setData({
            packages: (json.packages || []).slice(0, maxPackages),
            vehicle: json.vehicle || { year, make, model, trim },
            loading: false,
            error: null,
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setData(prev => ({
            ...prev,
            loading: false,
            error: err.message || "Failed to load packages",
          }));
        }
      }
    }

    fetchPackages();

    return () => {
      cancelled = true;
    };
  }, [year, make, model, trim, maxPackages]);

  // Assign badges to packages
  const packagesWithBadges: PackageWithBadge[] = useMemo(() => {
    return assignPackageBadges(data.packages);
  }, [data.packages]);

  // Handle package selection
  const handleSelectPackage = (pkg: RecommendedPackage) => {
    const params = new URLSearchParams({
      packageId: pkg.id,
      wheelSku: pkg.wheel.sku,
      tireSize: pkg.tire.size,
      year: String(year),
      make,
      model,
      wheelBrand: pkg.wheel.brand,
      wheelModel: pkg.wheel.model,
      wheelFinish: pkg.wheel.finish || "",
      wheelDiameter: String(pkg.wheel.diameter),
      wheelWidth: String(pkg.wheel.width),
      wheelOffset: String(pkg.wheel.offset),
      wheelPrice: String(pkg.wheel.price),
      wheelBoltPattern: pkg.wheel.boltPattern,
    });
    if (pkg.wheel.imageUrl) params.set("wheelImage", pkg.wheel.imageUrl);
    if (trim) params.set("trim", trim);
    
    router.push(`/package/customize?${params}`);
  };

  // Loading state
  if (data.loading) {
    return (
      <div className={`${className}`}>
        {showTitle && (
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-neutral-900 mb-1">
              Complete Packages for Your {year} {make} {model}
            </h2>
            <p className="text-neutral-600">
              Wheels, tires, mounting, balancing & TPMS — ready to install
            </p>
          </div>
        )}
        <TrustStack />
        <LoadingSkeleton />
      </div>
    );
  }

  // Error state - show nothing (fail gracefully)
  if (data.error || data.packages.length === 0) {
    return null;
  }

  const vehicleSlug = `${year}-${make.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, '-')}`;
  const showTierLegend = showGoodBetterBest && data.packages.length >= 3;

  return (
    <div className={`${className}`}>
      {/* Section Header */}
      {showTitle && (
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-neutral-900 mb-1">
            Complete Packages for Your {year} {make} {model}
          </h2>
          <p className="text-neutral-600">
            Wheels, tires, mounting, balancing & TPMS — ready to install
          </p>
        </div>
      )}

      {/* Trust Stack - Above pricing */}
      <TrustStack />

      {/* Good/Better/Best Legend */}
      {showTierLegend && <TierLegend />}

      {/* Price Anchor */}
      <PriceAnchor packages={data.packages} />

      {/* Package Cards */}
      <div className="flex flex-col sm:flex-row gap-6 justify-center items-stretch px-4 -mx-4 overflow-x-auto pb-4 scrollbar-hide">
        {packagesWithBadges.map((item, idx) => (
          <PackageCard
            key={item.package.id}
            package={item.package}
            badge={item.badge}
            vehicleMake={make}
            vehicleModel={model}
            onSelect={() => handleSelectPackage(item.package)}
            position={idx === 0 ? 'left' : idx === packagesWithBadges.length - 1 ? 'right' : 'center'}
            totalPackages={packagesWithBadges.length}
          />
        ))}
      </div>

      {/* Browse All Link */}
      <div className="text-center mt-6">
        <Link
          href={`/packages/for/${vehicleSlug}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
        >
          Browse all packages for your {make} {model}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Compact Variant (for sidebar/mobile)
// ============================================================================

export function RecommendedPackagesCompact({
  year,
  make,
  model,
  trim,
  className = "",
}: Omit<RecommendedPackagesProps, "maxPackages" | "showTitle" | "showGoodBetterBest">) {
  return (
    <RecommendedPackages
      year={year}
      make={make}
      model={model}
      trim={trim}
      className={className}
      maxPackages={3}
      showTitle={false}
      showGoodBetterBest={false}
    />
  );
}

// ============================================================================
// Export
// ============================================================================

export default RecommendedPackages;
