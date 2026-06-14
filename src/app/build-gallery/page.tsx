"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { JakeBuildContext } from "@/lib/fitment-db/schema-gallery";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface GalleryBuild {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleTrim: string | null;
  buildStyle: string;
  liftLevel: string | null;
  wheelBrand: string;
  wheelModel: string;
  wheelSize: string;
  wheelFinish: string | null;
  wheelOffset: string | null;
  tireBrand: string;
  tireModel: string;
  tireSize: string;
  heroImageUrl: string;
  additionalImages: string[];
  tags: string[];
  isFeatured: boolean;
  isPopular: boolean;
}

interface FilterOption {
  value: string;
  count: number;
}

interface Filters {
  makes: FilterOption[];
  styles: FilterOption[];
  wheelBrands: FilterOption[];
  totals: { total: number; featured: number; popular: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface BuildCardProps {
  build: GalleryBuild;
  onBuildSimilar: (build: GalleryBuild) => void;
}

function BuildCard({ build, onBuildSimilar }: BuildCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const vehicleLabel = `${build.vehicleYear} ${build.vehicleMake} ${build.vehicleModel}`;
  const styleLabel = build.buildStyle.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const liftLabel = build.liftLevel && build.liftLevel !== "stock" 
    ? build.liftLevel.includes("level") ? "Leveled" : `${build.liftLevel} Lift`
    : null;
  
  if (imageError) return null;
  
  return (
    <div 
      className="group relative rounded-2xl overflow-hidden bg-neutral-900/50 border border-white/10 hover:border-red-500/50 transition-all duration-500"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hero Image */}
      <div className="relative aspect-[16/10] bg-neutral-800">
        <Image
          src={build.heroImageUrl}
          alt={`${build.wheelBrand} ${build.wheelModel} on ${vehicleLabel}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`object-cover transition-transform duration-700 ${isHovered ? "scale-105" : "scale-100"}`}
          onError={() => setImageError(true)}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-80" />
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          <div className="flex gap-2 flex-wrap">
            {build.isFeatured && (
              <span className="bg-amber-500/90 backdrop-blur-sm text-black text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                ⭐ Featured
              </span>
            )}
            {build.isPopular && !build.isFeatured && (
              <span className="bg-red-500/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                🔥 Popular
              </span>
            )}
          </div>
          {liftLabel && (
            <span className="bg-white/10 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              {liftLabel}
            </span>
          )}
        </div>
        
        {/* Build Info Overlay - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Vehicle */}
          <h3 className="text-white font-bold text-lg mb-1 drop-shadow-lg">
            {vehicleLabel}
          </h3>
          
          {/* Specs Row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/80 text-sm mb-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {build.wheelBrand} {build.wheelModel}
            </span>
            <span className="text-white/40">•</span>
            <span>{build.wheelSize}</span>
            <span className="text-white/40">•</span>
            <span>{build.tireSize}</span>
          </div>
          
          {/* Style Badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-white/10 backdrop-blur-sm text-white/90 text-xs font-medium px-2.5 py-1 rounded-lg">
              {styleLabel}
            </span>
            <span className="text-white/50 text-xs">
              {build.tireBrand} {build.tireModel}
            </span>
          </div>
          
          {/* CTA Button - Build Something Similar */}
          <button
            onClick={() => onBuildSimilar(build)}
            className={`w-full rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-4 py-3 text-white font-bold text-sm transition-all duration-300 shadow-lg hover:shadow-red-500/25 ${isHovered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 sm:translate-y-0 sm:opacity-100"}`}
          >
            Build Something Similar →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTER SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════

interface FilterSidebarProps {
  filters: Filters | null;
  activeFilters: {
    make: string;
    style: string;
    wheelBrand: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
}

function FilterSidebar({ filters, activeFilters, onFilterChange, onClearFilters }: FilterSidebarProps) {
  const hasActiveFilters = activeFilters.make || activeFilters.style || activeFilters.wheelBrand;
  
  return (
    <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-sm uppercase tracking-wider">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
      
      {/* Vehicle Make */}
      {filters && filters.makes.length > 0 && (
        <div className="mb-5">
          <label className="block text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2">
            Vehicle
          </label>
          <div className="flex flex-wrap gap-1.5">
            {filters.makes.slice(0, 8).map((opt) => (
              <button
                key={opt.value}
                onClick={() => onFilterChange("make", activeFilters.make === opt.value ? "" : opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeFilters.make === opt.value
                    ? "bg-red-600 text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {opt.value}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Build Style */}
      {filters && filters.styles.length > 0 && (
        <div className="mb-5">
          <label className="block text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2">
            Build Style
          </label>
          <div className="flex flex-wrap gap-1.5">
            {filters.styles.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onFilterChange("style", activeFilters.style === opt.value ? "" : opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  activeFilters.style === opt.value
                    ? "bg-amber-500 text-black"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {opt.value.replace(/-/g, " ")}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Wheel Brand */}
      {filters && filters.wheelBrands.length > 0 && (
        <div>
          <label className="block text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2">
            Wheel Brand
          </label>
          <select
            value={activeFilters.wheelBrand}
            onChange={(e) => onFilterChange("wheelBrand", e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          >
            <option value="" className="bg-neutral-900">All Brands</option>
            {filters.wheelBrands.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-neutral-900">
                {opt.value} ({opt.count})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GALLERY PAGE (Inner Component)
// ═══════════════════════════════════════════════════════════════════════════

function BuildGalleryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [builds, setBuilds] = useState<GalleryBuild[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Active filters from URL
  const activeFilters = {
    make: searchParams.get("make") || "",
    style: searchParams.get("style") || "",
    wheelBrand: searchParams.get("wheelBrand") || "",
  };
  
  const page = parseInt(searchParams.get("page") || "1");
  
  // Fetch builds
  useEffect(() => {
    setLoading(true);
    
    const params = new URLSearchParams();
    if (activeFilters.make) params.set("make", activeFilters.make);
    if (activeFilters.style) params.set("style", activeFilters.style);
    if (activeFilters.wheelBrand) params.set("wheelBrand", activeFilters.wheelBrand);
    params.set("page", String(page));
    params.set("limit", "18");
    
    fetch(`/api/build-gallery?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setBuilds(data.builds || []);
        setFilters(data.filters);
        setPagination(data.pagination);
        setLoading(false);
      })
      .catch(() => {
        setBuilds([]);
        setLoading(false);
      });
  }, [activeFilters.make, activeFilters.style, activeFilters.wheelBrand, page]);
  
  // Update URL with filters
  const updateFilters = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    
    params.delete("page");
    router.push(`/build-gallery?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);
  
  const clearFilters = useCallback(() => {
    router.push("/build-gallery", { scroll: false });
  }, [router]);
  
  // Handle "Build Something Similar" - Navigate to Jake with context
  const handleBuildSimilar = useCallback((build: GalleryBuild) => {
    // Build Jake context
    const jakeContext: JakeBuildContext = {
      galleryBuild: {
        vehicle: `${build.vehicleYear} ${build.vehicleMake} ${build.vehicleModel}${build.vehicleTrim ? ` ${build.vehicleTrim}` : ""}`,
        wheel: `${build.wheelBrand} ${build.wheelModel}`,
        wheelSize: build.wheelSize,
        tire: `${build.tireBrand} ${build.tireModel}`,
        tireSize: build.tireSize,
        style: build.buildStyle.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        liftLevel: build.liftLevel || undefined,
      },
    };
    
    // Encode and navigate to Jake with context
    const contextParam = encodeURIComponent(JSON.stringify(jakeContext));
    const prompt = `I want to build something similar to this ${build.vehicleYear} ${build.vehicleMake} ${build.vehicleModel} with ${build.wheelBrand} ${build.wheelModel} wheels and ${build.tireBrand} ${build.tireModel} tires`;
    
    router.push(`/jake?q=${encodeURIComponent(prompt)}&buildContext=${contextParam}`);
  }, [router]);
  
  // Pagination
  const goToPage = useCallback((p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/build-gallery?${params.toString()}`, { scroll: true });
  }, [router, searchParams]);
  
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/garage/hero-garage-04.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#0a0a0a]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
        </div>
        
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-6 backdrop-blur-sm border border-red-500/30">
              <span>🔥</span>
              <span>Real Builds • Real Inspiration</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
              Build Gallery
            </h1>
            
            <p className="text-lg md:text-xl text-white/70 mb-6 leading-relaxed">
              Find a setup you love. Click <span className="text-red-400 font-semibold">"Build Something Similar"</span> and Jake will help you create it for your vehicle.
            </p>
            
            {/* Stats */}
            {filters && (
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-2xl font-black text-white">{filters.totals.total}</span>
                  <span className="text-white/50 ml-2">Builds</span>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div>
                  <span className="text-2xl font-black text-amber-400">{filters.totals.featured}</span>
                  <span className="text-white/50 ml-2">Featured</span>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div>
                  <span className="text-2xl font-black text-white">{filters.wheelBrands?.length || 0}</span>
                  <span className="text-white/50 ml-2">Brands</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-4">
              <FilterSidebar
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={updateFilters}
                onClearFilters={clearFilters}
              />
              
              {/* CTA Card */}
              <div className="mt-6 rounded-2xl bg-gradient-to-br from-red-900/30 to-red-950/30 border border-red-500/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🎯</span>
                  <h4 className="font-bold text-white text-sm">Need Help?</h4>
                </div>
                <p className="text-white/60 text-xs mb-4 leading-relaxed">
                  Not finding what you're looking for? Jake can build a custom package for your specific vehicle.
                </p>
                <Link
                  href="/jake"
                  className="block w-full text-center rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2.5 transition-colors"
                >
                  Ask Jake →
                </Link>
              </div>
            </div>
          </div>
          
          {/* Main Grid */}
          <div className="flex-1 min-w-0">
            {/* Mobile Filters */}
            <div className="lg:hidden mb-6 flex flex-wrap gap-2">
              <select
                value={activeFilters.make}
                onChange={(e) => updateFilters("make", e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">All Vehicles</option>
                {filters?.makes.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.value}</option>
                ))}
              </select>
              <select
                value={activeFilters.style}
                onChange={(e) => updateFilters("style", e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white capitalize"
              >
                <option value="">All Styles</option>
                {filters?.styles.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.value.replace(/-/g, " ")}</option>
                ))}
              </select>
            </div>
            
            {/* Results Count */}
            {pagination && (
              <div className="text-sm text-white/50 mb-6">
                Showing <span className="text-white font-medium">{builds.length}</span> of{" "}
                <span className="text-white font-medium">{pagination.total}</span> builds
              </div>
            )}
            
            {/* Gallery Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl bg-white/5 aspect-[16/10]" />
                ))}
              </div>
            ) : builds.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-white mb-2">No builds found</h3>
                <p className="text-white/50 mb-6">Try adjusting your filters</p>
                <button
                  onClick={clearFilters}
                  className="rounded-xl bg-red-600 hover:bg-red-500 px-6 py-3 text-sm font-bold text-white transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {builds.map((build) => (
                  <BuildCard
                    key={build.id}
                    build={build}
                    onBuildSimilar={handleBuildSimilar}
                  />
                ))}
              </div>
            )}
            
            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-12">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                >
                  ← Prev
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                          p === page
                            ? "bg-red-600 text-white"
                            : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  
                  {pagination.pages > 5 && (
                    <>
                      <span className="px-2 text-white/30">...</span>
                      <button
                        onClick={() => goToPage(pagination.pages)}
                        className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-medium transition-colors"
                      >
                        {pagination.pages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= pagination.pages}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT WITH SUSPENSE
// ═══════════════════════════════════════════════════════════════════════════

export default function BuildGalleryPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 to-[#0a0a0a]" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28">
            <div className="max-w-2xl">
              <div className="h-6 w-40 bg-white/10 rounded-full mb-6 animate-pulse" />
              <div className="h-16 w-80 bg-white/10 rounded-lg mb-4 animate-pulse" />
              <div className="h-6 w-full max-w-lg bg-white/10 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-white/5 aspect-[16/10]" />
            ))}
          </div>
        </div>
      </main>
    }>
      <BuildGalleryInner />
    </Suspense>
  );
}
