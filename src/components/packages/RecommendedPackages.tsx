"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RecommendedPackage, PackageCategory } from "@/lib/packages/engine";

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
}

interface PackageData {
  packages: RecommendedPackage[];
  vehicle: { year: number; make: string; model: string; trim?: string };
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Category Styling
// ============================================================================

const CATEGORY_STYLES: Record<PackageCategory, {
  badge: string;
  badgeBg: string;
  icon: string;
}> = {
  daily_driver: {
    badge: "Daily Driver",
    badgeBg: "bg-blue-100 text-blue-800",
    icon: "🚗",
  },
  sport_aggressive: {
    badge: "Sport",
    badgeBg: "bg-red-100 text-red-800",
    icon: "🏎️",
  },
  premium_look: {
    badge: "Premium",
    badgeBg: "bg-amber-100 text-amber-800",
    icon: "✨",
  },
  offroad_lifted: {
    badge: "Off-Road",
    badgeBg: "bg-green-100 text-green-800",
    icon: "🏔️",
  },
};

const AVAILABILITY_STYLES: Record<string, { label: string; color: string }> = {
  in_stock: { label: "In Stock", color: "text-green-600" },
  limited: { label: "Limited", color: "text-amber-600" },
  check_availability: { label: "Check Stock", color: "text-neutral-500" },
};

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

  // Handle package selection
  const handleSelectPackage = (pkg: RecommendedPackage) => {
    const params = new URLSearchParams({
      packageId: pkg.id,
      wheelSku: pkg.wheel.sku,
      tireSize: pkg.tire.size,
      year: String(year),
      make,
      model,
      // Pass wheel data directly to avoid lookup
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
          <h2 className="mb-4 text-xl font-semibold text-neutral-900">
            Recommended Packages
          </h2>
        )}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-72 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50 p-4"
            >
              <div className="h-40 rounded-lg bg-neutral-200 mb-4" />
              <div className="h-4 w-24 rounded bg-neutral-200 mb-2" />
              <div className="h-6 w-full rounded bg-neutral-200 mb-3" />
              <div className="h-8 w-20 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state - show nothing (fail gracefully)
  if (data.error || data.packages.length === 0) {
    return null;
  }

  return (
    <div className={`${className}`}>
      {showTitle && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">
            Recommended Packages for Your {make} {model}
          </h2>
          <Link
            href={`/packages/for/${year}-${make.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, '-')}`}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            View All →
          </Link>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
        {data.packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            package={pkg}
            onSelect={() => handleSelectPackage(pkg)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Package Card Component
// ============================================================================

interface PackageCardProps {
  package: RecommendedPackage;
  onSelect: () => void;
}

function PackageCard({ package: pkg, onSelect }: PackageCardProps) {
  const categoryStyle = CATEGORY_STYLES[pkg.category] || CATEGORY_STYLES.daily_driver;
  const availStyle = AVAILABILITY_STYLES[pkg.availability] || AVAILABILITY_STYLES.check_availability;

  return (
    <div className="flex-shrink-0 w-72 rounded-xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Image Section */}
      <div className="relative h-44 bg-neutral-100">
        {pkg.wheel.imageUrl ? (
          <Image
            src={pkg.wheel.imageUrl}
            alt={`${pkg.wheel.brand} ${pkg.wheel.model}`}
            fill
            className="object-contain p-2"
            sizes="288px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">{categoryStyle.icon}</span>
          </div>
        )}
        
        {/* Category Badge */}
        <div className="absolute top-2 left-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${categoryStyle.badgeBg}`}>
            {categoryStyle.icon} {categoryStyle.badge}
          </span>
        </div>

        {/* Fitment Badge */}
        {pkg.fitmentValidation.safe && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              ✓ Fitment Guaranteed
            </span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Package Name & Specs */}
        <h3 className="font-semibold text-neutral-900 mb-1">
          {pkg.name}
        </h3>
        <p className="text-sm text-neutral-600 mb-1">
          {pkg.wheel.brand} {pkg.wheel.model}
        </p>
        <p className="text-xs text-neutral-500 mb-3">
          {pkg.sizeSpec}
        </p>

        {/* Price & Availability */}
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <span className="text-2xl font-bold text-neutral-900">
              ${pkg.totalPrice.toLocaleString()}
            </span>
            <span className="text-sm text-neutral-500 ml-1">complete</span>
          </div>
          <span className={`text-xs font-medium ${availStyle.color}`}>
            {availStyle.label}
          </span>
        </div>

        {/* Fitment Info */}
        {pkg.fitmentValidation.notes.length > 0 && (
          <p className="text-xs text-neutral-500 mb-3 line-clamp-2">
            {pkg.fitmentValidation.notes[0]}
          </p>
        )}

        {/* CTA Button */}
        <button
          onClick={onSelect}
          className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          Select Package
        </button>
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
}: Omit<RecommendedPackagesProps, "maxPackages" | "showTitle">) {
  return (
    <RecommendedPackages
      year={year}
      make={make}
      model={model}
      trim={trim}
      className={className}
      maxPackages={3}
      showTitle={false}
    />
  );
}

// ============================================================================
// Export
// ============================================================================

export default RecommendedPackages;
