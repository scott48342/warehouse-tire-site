"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

// Popular tire brands with logos/icons
const POPULAR_BRANDS = [
  { name: "Michelin", tier: "premium" },
  { name: "Goodyear", tier: "premium" },
  { name: "Bridgestone", tier: "premium" },
  { name: "Continental", tier: "premium" },
  { name: "Pirelli", tier: "premium" },
  { name: "BFGoodrich", tier: "premium" },
  { name: "Cooper", tier: "mid" },
  { name: "Toyo", tier: "mid" },
  { name: "Yokohama", tier: "mid" },
  { name: "Hankook", tier: "mid" },
  { name: "Falken", tier: "mid" },
  { name: "General", tier: "mid" },
  { name: "Kumho", tier: "mid" },
  { name: "Nexen", tier: "value" },
  { name: "Nitto", tier: "mid" },
  { name: "Firestone", tier: "mid" },
  { name: "Dunlop", tier: "mid" },
  { name: "Sumitomo", tier: "value" },
  { name: "Ironman", tier: "value" },
  { name: "Mastercraft", tier: "value" },
];

// All brands alphabetically (extended list)
const ALL_BRANDS = [
  "Achilles", "Advanta", "Americus", "Antares", "Arroyo", "Atturo",
  "BFGoodrich", "Bridgestone", "Continental", "Cooper", "Crosswind",
  "Delinte", "Dunlop", "Duro", "Eldorado",
  "Falken", "Federal", "Firestone", "Fullway", "Fuzion",
  "General", "Goodyear", "Groundspeed", "GT Radial",
  "Hankook", "Hercules",
  "Ironman",
  "Kelly", "Kumho", "Kenda",
  "Landsail", "Lexani", "Lionhart",
  "Mastercraft", "Maxxis", "Milestar", "Michelin", "Mickey Thompson", "Momo",
  "Nexen", "Nitto", "Nokian",
  "Ohtsu",
  "Pathfinder", "Pirelli", "Prinx",
  "Radar", "RBP",
  "Sailun", "Sentury", "Sumitomo", "Supermax",
  "Thunderer", "Toyo", "Travelstar", "TBC",
  "Uniroyal",
  "Vercelli", "Vredestein",
  "Westlake",
  "Yokohama",
  "Zenna",
].sort();

interface TireBrandBrowserProps {
  className?: string;
}

export function TireBrandBrowser({ className = "" }: TireBrandBrowserProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);

  // Filter brands based on search
  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return ALL_BRANDS;
    const q = searchQuery.toLowerCase();
    return ALL_BRANDS.filter(b => b.toLowerCase().includes(q));
  }, [searchQuery]);

  const handleBrandSelect = (brand: string) => {
    const params = new URLSearchParams({
      searchMode: "brand",
      brand: brand,
    });
    router.push(`/tires?${params.toString()}`);
  };

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case "premium":
        return "border-amber-200 bg-gradient-to-br from-amber-50 to-white hover:border-amber-400 hover:shadow-amber-100";
      case "mid":
        return "border-blue-200 bg-gradient-to-br from-blue-50 to-white hover:border-blue-400 hover:shadow-blue-100";
      case "value":
        return "border-green-200 bg-gradient-to-br from-green-50 to-white hover:border-green-400 hover:shadow-green-100";
      default:
        return "border-neutral-200 bg-white hover:border-neutral-400";
    }
  };

  return (
    <div className={`bg-white rounded-3xl shadow-xl border border-neutral-200 p-6 sm:p-8 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-extrabold text-neutral-900">Browse by Brand</div>
          <div className="text-xs text-neutral-500">Shop tires from your favorite manufacturers</div>
        </div>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <svg 
          className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search brands..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-neutral-300 bg-neutral-50 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:bg-white"
        />
      </div>

      {/* Popular brands grid (when not searching) */}
      {!searchQuery && (
        <>
          <div className="mb-4">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Popular Brands</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {POPULAR_BRANDS.slice(0, showAllBrands ? undefined : 8).map((brand) => (
              <button
                key={brand.name}
                onClick={() => handleBrandSelect(brand.name)}
                className={`
                  flex items-center justify-center h-14 rounded-xl border-2 
                  font-semibold text-sm text-neutral-800 transition-all duration-200
                  hover:shadow-lg hover:-translate-y-0.5
                  ${getTierStyle(brand.tier)}
                `}
              >
                {brand.name}
              </button>
            ))}
          </div>

          {!showAllBrands && (
            <button
              onClick={() => setShowAllBrands(true)}
              className="w-full py-3 text-sm font-semibold text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition-colors"
            >
              Show all {POPULAR_BRANDS.length} popular brands →
            </button>
          )}

          {showAllBrands && (
            <div className="border-t border-neutral-200 pt-6 mt-2">
              <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">All Brands A-Z</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-2">
                {ALL_BRANDS.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => handleBrandSelect(brand)}
                    className="h-10 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors text-left truncate"
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Search results (when searching) */}
      {searchQuery && (
        <div>
          <p className="text-xs text-neutral-500 mb-3">
            {filteredBrands.length} brand{filteredBrands.length !== 1 ? "s" : ""} found
          </p>
          {filteredBrands.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
              {filteredBrands.map((brand) => (
                <button
                  key={brand}
                  onClick={() => handleBrandSelect(brand)}
                  className="h-12 px-4 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-800 hover:bg-purple-50 hover:border-purple-300 transition-colors text-left"
                >
                  {brand}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-500">
              <p>No brands match "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-2 text-sm text-purple-600 hover:underline"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      <p className="mt-6 text-center text-xs text-neutral-500">
        Want tires for your specific vehicle?{" "}
        <button 
          onClick={() => router.push("/tires")}
          className="text-purple-600 hover:underline font-semibold"
        >
          Search by vehicle instead
        </button>
      </p>
    </div>
  );
}
