"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

// ═══════════════════════════════════════════════════════════════════════════════
// TIRE BRANDS
// ═══════════════════════════════════════════════════════════════════════════════

const POPULAR_TIRE_BRANDS = [
  { slug: "michelin", name: "Michelin", tier: "premium" },
  { slug: "goodyear", name: "Goodyear", tier: "premium" },
  { slug: "bridgestone", name: "Bridgestone", tier: "premium" },
  { slug: "continental", name: "Continental", tier: "premium" },
  { slug: "pirelli", name: "Pirelli", tier: "premium" },
  { slug: "cooper", name: "Cooper", tier: "mid" },
  { slug: "toyo", name: "Toyo", tier: "mid" },
  { slug: "bfgoodrich", name: "BFGoodrich", tier: "mid" },
  { slug: "yokohama", name: "Yokohama", tier: "mid" },
  { slug: "hankook", name: "Hankook", tier: "mid" },
  { slug: "falken", name: "Falken", tier: "mid" },
  { slug: "nitto", name: "Nitto", tier: "mid" },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL BRANDS
// ═══════════════════════════════════════════════════════════════════════════════

const POPULAR_WHEEL_BRANDS = [
  { code: "FM", name: "Fuel", tier: "premium" },
  { code: "MO", name: "Moto Metal", tier: "premium" },
  { code: "XD", name: "XD Series", tier: "premium" },
  { code: "KM", name: "KMC", tier: "premium" },
  { code: "AR", name: "American Racing", tier: "mid" },
  { code: "HE", name: "Helo", tier: "mid" },
  { code: "RC", name: "Raceline", tier: "mid" },
  { code: "BK", name: "Black Rhino", tier: "mid" },
  { code: "VF", name: "Vision", tier: "mid" },
  { code: "MA", name: "Mayhem", tier: "mid" },
  { code: "TU", name: "Tuff", tier: "mid" },
  { code: "NC", name: "Niche", tier: "mid" },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SHOP BY BRAND - TIRES
// ═══════════════════════════════════════════════════════════════════════════════

interface ShopByBrandTiresProps {
  /** Pass vehicle params to preserve context */
  vehicleParams?: {
    year?: string;
    make?: string;
    model?: string;
    modification?: string;
    trim?: string;
  };
  /** Show only premium brands */
  premiumOnly?: boolean;
  /** Max brands to show */
  maxBrands?: number;
  /** Compact mode for sidebar */
  compact?: boolean;
}

export function ShopByBrandTires({
  vehicleParams,
  premiumOnly = false,
  maxBrands = 12,
  compact = false,
}: ShopByBrandTiresProps) {
  const searchParams = useSearchParams();
  
  // Build URL with vehicle context preserved
  const buildBrandUrl = (slug: string) => {
    const params = new URLSearchParams();
    if (vehicleParams?.year) params.set("year", vehicleParams.year);
    if (vehicleParams?.make) params.set("make", vehicleParams.make);
    if (vehicleParams?.model) params.set("model", vehicleParams.model);
    if (vehicleParams?.modification) params.set("modification", vehicleParams.modification);
    if (vehicleParams?.trim) params.set("trim", vehicleParams.trim);
    
    const qs = params.toString();
    return `/tires/b/${slug}${qs ? `?${qs}` : ""}`;
  };

  const brands = premiumOnly 
    ? POPULAR_TIRE_BRANDS.filter(b => b.tier === "premium")
    : POPULAR_TIRE_BRANDS.slice(0, maxBrands);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-extrabold text-neutral-500 uppercase tracking-wide">
          Popular Brands
        </div>
        <div className="flex flex-wrap gap-1.5">
          {brands.map((brand) => (
            <Link
              key={brand.slug}
              href={buildBrandUrl(brand.slug)}
              className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 transition-colors"
            >
              {brand.name}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h3 className="text-lg font-extrabold text-neutral-900 mb-4">Shop by Brand</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {brands.map((brand) => (
          <Link
            key={brand.slug}
            href={buildBrandUrl(brand.slug)}
            className="group flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 hover:border-neutral-300 hover:shadow-sm transition-all"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-600 group-hover:bg-neutral-200">
              {brand.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-neutral-900 truncate">{brand.name}</div>
              {brand.tier === "premium" && (
                <div className="text-[10px] text-amber-600 font-semibold">Premium</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHOP BY BRAND - WHEELS
// ═══════════════════════════════════════════════════════════════════════════════

interface ShopByBrandWheelsProps {
  /** Pass vehicle params to preserve context */
  vehicleParams?: {
    year?: string;
    make?: string;
    model?: string;
    modification?: string;
    trim?: string;
  };
  /** Show only premium brands */
  premiumOnly?: boolean;
  /** Max brands to show */
  maxBrands?: number;
  /** Compact mode for sidebar */
  compact?: boolean;
}

export function ShopByBrandWheels({
  vehicleParams,
  premiumOnly = false,
  maxBrands = 12,
  compact = false,
}: ShopByBrandWheelsProps) {
  // Build URL with vehicle context preserved
  const buildBrandUrl = (code: string) => {
    const params = new URLSearchParams();
    if (vehicleParams?.year) params.set("year", vehicleParams.year);
    if (vehicleParams?.make) params.set("make", vehicleParams.make);
    if (vehicleParams?.model) params.set("model", vehicleParams.model);
    if (vehicleParams?.modification) params.set("modification", vehicleParams.modification);
    if (vehicleParams?.trim) params.set("trim", vehicleParams.trim);
    
    const qs = params.toString();
    return `/wheels/b/${code.toLowerCase()}${qs ? `?${qs}` : ""}`;
  };

  const brands = premiumOnly 
    ? POPULAR_WHEEL_BRANDS.filter(b => b.tier === "premium")
    : POPULAR_WHEEL_BRANDS.slice(0, maxBrands);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-extrabold text-neutral-500 uppercase tracking-wide">
          Popular Brands
        </div>
        <div className="flex flex-wrap gap-1.5">
          {brands.map((brand) => (
            <Link
              key={brand.code}
              href={buildBrandUrl(brand.code)}
              className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 transition-colors"
            >
              {brand.name}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h3 className="text-lg font-extrabold text-neutral-900 mb-4">Shop by Brand</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {brands.map((brand) => (
          <Link
            key={brand.code}
            href={buildBrandUrl(brand.code)}
            className="group flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 hover:border-neutral-300 hover:shadow-sm transition-all"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-600 group-hover:bg-neutral-200">
              {brand.code}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-neutral-900 truncate">{brand.name}</div>
              {brand.tier === "premium" && (
                <div className="text-[10px] text-amber-600 font-semibold">Premium</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED BRANDS SECTION (for homepage)
// ═══════════════════════════════════════════════════════════════════════════════

export function ShopByBrandSection() {
  return (
    <section className="py-12 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">Shop by Brand</h2>
          <p className="mt-2 text-neutral-600">Find your favorite brands with guaranteed fitment</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Tire Brands */}
          <div>
            <h3 className="text-lg font-extrabold text-neutral-900 mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white text-sm">🛞</span>
              Tire Brands
            </h3>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TIRE_BRANDS.slice(0, 8).map((brand) => (
                <Link
                  key={brand.slug}
                  href={`/tires/b/${brand.slug}`}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:border-neutral-300 hover:shadow-sm transition-all"
                >
                  {brand.name}
                </Link>
              ))}
              <Link
                href="/tires"
                className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 transition-colors"
              >
                View all →
              </Link>
            </div>
          </div>
          
          {/* Wheel Brands */}
          <div>
            <h3 className="text-lg font-extrabold text-neutral-900 mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white text-sm">⚙️</span>
              Wheel Brands
            </h3>
            <div className="flex flex-wrap gap-2">
              {POPULAR_WHEEL_BRANDS.slice(0, 8).map((brand) => (
                <Link
                  key={brand.code}
                  href={`/wheels/b/${brand.code.toLowerCase()}`}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:border-neutral-300 hover:shadow-sm transition-all"
                >
                  {brand.name}
                </Link>
              ))}
              <Link
                href="/wheels"
                className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 transition-colors"
              >
                View all →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
