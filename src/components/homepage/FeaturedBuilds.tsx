"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

/**
 * Featured Builds Strip - Premium Social Proof
 * 
 * Placement: After TrustStrip, Before FeaturedPackages
 * Purpose: Show real builds as inspiration and social proof
 * 
 * Design Language: Matches existing homepage exactly
 * - Same container width (max-w-6xl)
 * - Same card styling (glassmorphism, border, hover)
 * - Same typography (white with opacity variants)
 * - Subtle, not loud
 * 
 * Data: Fetches from gallery API, prioritizing featured/customer builds
 */

interface GalleryBuild {
  id: number;
  thumbnailUrl: string;
  wheelBrand: string;
  wheelModel: string;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  liftLevel: string | null;
  buildStyle: string | null;
  isFeatured: boolean;
  isCustomerBuild: boolean;
}

interface BuildCardProps {
  build: GalleryBuild;
}

function BuildCard({ build }: BuildCardProps) {
  const [imageError, setImageError] = useState(false);
  
  // Build vehicle label
  const vehicle = [build.vehicleYear, build.vehicleMake, build.vehicleModel]
    .filter(Boolean)
    .join(" ") || "Custom Build";

  // Build metadata line: "Lifted • Fuel • etc"
  const metadataParts: string[] = [];
  if (build.liftLevel && build.liftLevel !== "stock") {
    metadataParts.push(build.liftLevel.includes("level") ? "Leveled" : "Lifted");
  } else if (build.buildStyle && build.buildStyle !== "stock") {
    metadataParts.push(build.buildStyle.charAt(0).toUpperCase() + build.buildStyle.slice(1));
  }
  if (build.wheelBrand) {
    metadataParts.push(build.wheelBrand);
  }
  const metadata = metadataParts.join(" • ") || "Custom Setup";

  // Link to gallery with brand filter
  const href = build.wheelBrand 
    ? `/gallery?wheelBrand=${encodeURIComponent(build.wheelBrand)}`
    : "/gallery";

  if (imageError) return null;

  return (
    <Link
      href={href}
      className="group flex-shrink-0 w-[260px] md:w-auto overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/30"
    >
      <div className="bg-[rgba(20,20,20,0.85)] backdrop-blur-md rounded-xl overflow-hidden border border-white/10">
        {/* Image - Smaller aspect ratio for strip feel */}
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-900" />
          <Image
            src={build.thumbnailUrl}
            alt={`${build.wheelBrand} ${build.wheelModel} on ${vehicle}`}
            fill
            sizes="(max-width: 768px) 260px, 220px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
          
          {/* Customer build badge */}
          {build.isCustomerBuild && (
            <div className="absolute top-2 left-2">
              <span className="bg-green-600/90 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                📸
              </span>
            </div>
          )}
        </div>

        {/* Content - Compact */}
        <div className="p-3">
          <h3 className="text-sm font-bold text-white truncate">
            {vehicle}
          </h3>
          <p className="mt-0.5 text-[11px] text-white/50 truncate">
            {metadata}
          </p>

          {/* Single CTA */}
          <div className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-amber-400 group-hover:text-amber-300 transition-colors">
            <span>Build This Setup</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function BuildCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[260px] md:w-auto rounded-xl overflow-hidden">
      <div className="bg-[rgba(20,20,20,0.85)] backdrop-blur-md rounded-xl overflow-hidden border border-white/10">
        <div className="aspect-[16/10] w-full bg-neutral-800 animate-pulse" />
        <div className="p-3">
          <div className="h-4 w-3/4 bg-neutral-700 rounded animate-pulse" />
          <div className="mt-1 h-3 w-1/2 bg-neutral-800 rounded animate-pulse" />
          <div className="mt-2.5 h-3 w-1/3 bg-amber-900/30 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function FeaturedBuilds() {
  const [builds, setBuilds] = useState<GalleryBuild[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch more builds from gallery API, then select diverse set
    // API orders by: verified (customer) > featured > high confidence
    fetch("/api/gallery/discover?limit=30")
      .then((res) => res.json())
      .then((data) => {
        const results: GalleryBuild[] = data.results || [];
        
        // Select diverse builds - max one per vehicle make
        const seenMakes = new Set<string>();
        const seenBrands = new Set<string>();
        const diverse: GalleryBuild[] = [];
        
        for (const build of results) {
          const make = build.vehicleMake?.toLowerCase() || "";
          const brand = build.wheelBrand?.toLowerCase() || "";
          
          // Skip if we already have this make (unless we need more variety)
          if (make && seenMakes.has(make) && diverse.length < 10) {
            continue;
          }
          
          // Also try to vary wheel brands
          if (brand && seenBrands.has(brand) && diverse.length < 3) {
            continue;
          }
          
          diverse.push(build);
          if (make) seenMakes.add(make);
          if (brand) seenBrands.add(brand);
          
          if (diverse.length >= 5) break;
        }
        
        // If we don't have enough diverse results, fill with remaining
        if (diverse.length < 5) {
          for (const build of results) {
            if (!diverse.includes(build)) {
              diverse.push(build);
              if (diverse.length >= 5) break;
            }
          }
        }
        
        setBuilds(diverse.slice(0, 5));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Don't render section if no builds and not loading
  if (!loading && builds.length === 0) {
    return null;
  }

  return (
    <section className="relative py-10">
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        {/* Section Header - Left aligned with right link */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Featured Builds
            </h2>
            <p className="mt-1 text-sm text-white/50">
              See what real setups look like before you shop
            </p>
          </div>
          <Link
            href="/gallery"
            className="hidden md:flex items-center gap-1 text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            <span>Explore all builds</span>
            <span>→</span>
          </Link>
        </div>

        {/* Builds Strip - Horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0 md:grid md:grid-cols-5 md:overflow-visible scrollbar-hide">
          {loading ? (
            // Skeleton loading
            Array.from({ length: 5 }).map((_, i) => (
              <BuildCardSkeleton key={i} />
            ))
          ) : (
            builds.map((build) => (
              <BuildCard key={build.id} build={build} />
            ))
          )}
        </div>

        {/* Mobile "View all" link */}
        <div className="mt-4 md:hidden text-center">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-1 text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            <span>Explore all builds</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* Hide scrollbar but keep functionality */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
