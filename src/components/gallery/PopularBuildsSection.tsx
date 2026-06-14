"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { JakeBuildContext } from "@/lib/fitment-db/schema-gallery";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface FeaturedBuild {
  id: string;
  slug: string;
  title: string | null;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  buildStyle: string;
  liftLevel: string | null;
  wheelBrand: string;
  wheelModel: string;
  wheelSize: string;
  tireBrand: string;
  tireModel: string;
  tireSize: string;
  heroImageUrl: string;
  isFeatured: boolean;
  isPopular: boolean;
  jakeContext: JakeBuildContext;
  vehicleLabel: string;
  wheelLabel: string;
  tireLabel: string;
  styleLabel: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD CARD
// ═══════════════════════════════════════════════════════════════════════════

interface BuildCardProps {
  build: FeaturedBuild;
  onBuildSimilar: (build: FeaturedBuild) => void;
}

function BuildCard({ build, onBuildSimilar }: BuildCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const liftLabel = build.liftLevel && build.liftLevel !== "stock" 
    ? build.liftLevel.includes("level") ? "Leveled" : `${build.liftLevel} Lift`
    : null;
  
  if (imageError) return null;
  
  return (
    <div 
      className="group relative rounded-2xl overflow-hidden bg-neutral-900/50 border border-white/10 hover:border-red-500/40 transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <div className="relative aspect-[16/10]">
        <Image
          src={build.heroImageUrl}
          alt={`${build.wheelLabel} on ${build.vehicleLabel}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`object-cover transition-transform duration-700 ${isHovered ? "scale-105" : "scale-100"}`}
          onError={() => setImageError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-80" />
        
        {/* Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
          <div className="flex gap-1.5">
            {build.isFeatured && (
              <span className="bg-amber-500/90 backdrop-blur-sm text-black text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                ⭐ Featured
              </span>
            )}
            {build.isPopular && !build.isFeatured && (
              <span className="bg-red-500/90 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                🔥 Popular
              </span>
            )}
          </div>
          {liftLabel && (
            <span className="bg-white/10 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              {liftLabel}
            </span>
          )}
        </div>
        
        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-bold text-sm mb-0.5 drop-shadow-lg">
            {build.vehicleLabel}
          </h3>
          <div className="flex items-center gap-2 text-white/70 text-xs mb-2">
            <span>{build.wheelLabel}</span>
            <span className="text-white/40">•</span>
            <span>{build.wheelSize}</span>
          </div>
          
          {/* CTA Button - Shows on hover */}
          <button
            onClick={(e) => {
              e.preventDefault();
              onBuildSimilar(build);
            }}
            className={`w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-3 py-2 text-white font-bold text-xs transition-all duration-300 ${isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 sm:opacity-100 sm:translate-y-0"}`}
          >
            Build Something Similar →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PopularBuildsSectionProps {
  limit?: number;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function PopularBuildsSection({ 
  limit = 6, 
  className = "",
  title = "Popular Builds",
  subtitle = "Get inspired and build something similar"
}: PopularBuildsSectionProps) {
  const router = useRouter();
  const [builds, setBuilds] = useState<FeaturedBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  useEffect(() => {
    fetch(`/api/build-gallery/featured?limit=${limit}`)
      .then((r) => r.json())
      .then((data) => {
        setBuilds(data.builds || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [limit]);
  
  const handleBuildSimilar = (build: FeaturedBuild) => {
    const prompt = `I want to build something similar to this ${build.vehicleLabel} with ${build.wheelLabel} wheels and ${build.tireLabel} tires`;
    const contextParam = encodeURIComponent(JSON.stringify(build.jakeContext));
    router.push(`/jake?q=${encodeURIComponent(prompt)}&buildContext=${contextParam}`);
  };
  
  // Don't render if no builds or error
  if (error || (!loading && builds.length === 0)) {
    return null;
  }
  
  return (
    <section className={`py-12 ${className}`}>
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2">{title}</h2>
            <p className="text-white/60 text-sm">{subtitle}</p>
          </div>
          <Link
            href="/build-gallery"
            className="hidden sm:inline-flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
          >
            View All Builds
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        
        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-white/5 aspect-[16/10]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {builds.map((build) => (
              <BuildCard
                key={build.id}
                build={build}
                onBuildSimilar={handleBuildSimilar}
              />
            ))}
          </div>
        )}
        
        {/* Mobile View All Link */}
        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/build-gallery"
            className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
          >
            View All Builds
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default PopularBuildsSection;
