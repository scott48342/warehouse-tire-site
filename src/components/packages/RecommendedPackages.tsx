"use client";

import { useState, useEffect, useMemo } from "react";
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
// Category Styling & Labels (Conversion Optimized)
// ============================================================================

const CATEGORY_CONFIG: Record<PackageCategory, {
  label: string;
  badge: string;
  badgeBg: string;
  icon: string;
  sizeLabel: (diameter: number) => string;
}> = {
  daily_driver: {
    label: "OEM+ Clean Look",
    badge: "OEM+",
    badgeBg: "bg-blue-100 text-blue-800",
    icon: "🚗",
    sizeLabel: (d) => `${d}" OEM Size Setup`,
  },
  sport_aggressive: {
    label: "Street / Aggressive",
    badge: "Street",
    badgeBg: "bg-red-100 text-red-800",
    icon: "🏎️",
    sizeLabel: (d) => `${d}" Upgrade`,
  },
  premium_look: {
    label: "Premium Look",
    badge: "Premium",
    badgeBg: "bg-amber-100 text-amber-800",
    icon: "✨",
    sizeLabel: (d) => `${d}" Premium Setup`,
  },
  offroad_lifted: {
    label: "Off-Road / Truck Setup",
    badge: "Off-Road",
    badgeBg: "bg-green-100 text-green-800",
    icon: "🏔️",
    sizeLabel: (d) => `${d}" Off-Road Setup`,
  },
};

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
    <p className="text-center text-lg text-neutral-600 mb-4">
      Complete packages from{" "}
      <span className="font-bold text-neutral-900">${minPrice.toLocaleString()}</span>
      {maxPrice > minPrice && (
        <> – <span className="font-bold text-neutral-900">${maxPrice.toLocaleString()}</span></>
      )}
      {" "}installed
    </p>
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

  // Determine featured package (Daily Driver = Most Popular, else first)
  const featuredIndex = useMemo(() => {
    const dailyIdx = data.packages.findIndex(p => p.category === "daily_driver");
    return dailyIdx >= 0 ? dailyIdx : 0;
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
          <h2 className="mb-4 text-xl font-semibold text-neutral-900">
            Recommended Packages
          </h2>
        )}
        <div className="flex gap-6 overflow-x-auto pb-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-80 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50 p-5"
            >
              <div className="h-44 rounded-xl bg-neutral-200 mb-4" />
              <div className="h-5 w-28 rounded bg-neutral-200 mb-2" />
              <div className="h-6 w-full rounded bg-neutral-200 mb-3" />
              <div className="h-10 w-24 rounded bg-neutral-200" />
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

  const vehicleSlug = `${year}-${make.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={`${className}`}>
      {/* Section Header */}
      {showTitle && (
        <div className="mb-2 text-center">
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

      {/* Price Anchor */}
      <PriceAnchor packages={data.packages} />

      {/* Package Cards */}
      <div className="flex gap-6 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide justify-center">
        {data.packages.map((pkg, idx) => (
          <PackageCard
            key={pkg.id}
            package={pkg}
            isFeatured={idx === featuredIndex}
            vehicleMake={make}
            vehicleModel={model}
            onSelect={() => handleSelectPackage(pkg)}
          />
        ))}
      </div>

      {/* Browse All Link */}
      <div className="text-center mt-4">
        <Link
          href={`/packages/for/${vehicleSlug}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
        >
          Browse all 2000+ packages for your {make} {model}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Package Card Component (Conversion Optimized)
// ============================================================================

interface PackageCardProps {
  package: RecommendedPackage;
  isFeatured: boolean;
  vehicleMake: string;
  vehicleModel: string;
  onSelect: () => void;
}

function PackageCard({ 
  package: pkg, 
  isFeatured,
  vehicleMake,
  vehicleModel,
  onSelect 
}: PackageCardProps) {
  const config = CATEGORY_CONFIG[pkg.category] || CATEGORY_CONFIG.daily_driver;
  const sizeLabel = config.sizeLabel(pkg.wheel.diameter);

  return (
    <div 
      className={`
        flex-shrink-0 w-80 rounded-2xl bg-white overflow-hidden transition-all duration-200
        ${isFeatured 
          ? "border-2 border-red-500 shadow-lg shadow-red-100 scale-[1.02]" 
          : "border border-neutral-200 shadow-sm hover:shadow-md hover:border-neutral-300"
        }
      `}
    >
      {/* Featured Badge */}
      {isFeatured && (
        <div className="bg-red-600 text-white text-center py-1.5 text-sm font-semibold">
          ⭐ Most Popular Choice
        </div>
      )}

      {/* Image Section */}
      <div className="relative h-48 bg-gradient-to-b from-neutral-50 to-neutral-100">
        {pkg.wheel.imageUrl ? (
          <Image
            src={pkg.wheel.imageUrl}
            alt={`${pkg.wheel.brand} ${pkg.wheel.model}`}
            fill
            className="object-contain p-3"
            sizes="320px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-7xl">{config.icon}</span>
          </div>
        )}
        
        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${config.badgeBg}`}>
            {config.icon} {config.label}
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5">
        {/* Size Label (User-friendly) */}
        <p className="text-sm font-semibold text-red-600 mb-1">
          {sizeLabel}
        </p>

        {/* Wheel Info */}
        <h3 className="text-lg font-bold text-neutral-900 mb-0.5">
          {pkg.wheel.brand} {pkg.wheel.model}
        </h3>
        
        {/* Technical Specs (secondary) */}
        <p className="text-xs text-neutral-500 mb-4">
          {pkg.sizeSpec}
        </p>

        {/* Price */}
        <div className="mb-2">
          <span className="text-3xl font-bold text-neutral-900">
            ${pkg.totalPrice.toLocaleString()}
          </span>
          <span className="text-sm text-neutral-500 ml-1">complete</span>
        </div>

        {/* Micro Copy */}
        <p className="text-xs text-green-700 font-medium mb-4">
          ✓ Fits your {vehicleMake} {vehicleModel} — no modifications needed
        </p>

        {/* CTA Button */}
        <button
          onClick={onSelect}
          className={`
            w-full rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200
            ${isFeatured 
              ? "bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg" 
              : "bg-neutral-900 text-white hover:bg-neutral-800"
            }
          `}
        >
          Build This Setup
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
