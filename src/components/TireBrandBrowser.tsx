"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Brand {
  name: string;
  count: number;
}

interface TireBrandBrowserProps {
  className?: string;
}

export function TireBrandBrowser({ className = "" }: TireBrandBrowserProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch actual brands from API
  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch("/api/tires/brands");
        if (res.ok) {
          const data = await res.json();
          setBrands(data.brands || []);
        }
      } catch (err) {
        console.error("[TireBrandBrowser] Failed to fetch brands:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBrands();
  }, []);

  // Get brand names sorted by count (most popular first)
  const allBrandNames = useMemo(() => brands.map(b => b.name), [brands]);
  
  // Filter brands based on search
  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return allBrandNames;
    const q = searchQuery.toLowerCase();
    return allBrandNames.filter(b => b.toLowerCase().includes(q));
  }, [searchQuery, allBrandNames]);

  const handleBrandSelect = (brand: string) => {
    const params = new URLSearchParams({
      searchMode: "brand",
      brand: brand,
    });
    router.push(`/tires?${params.toString()}`);
  };

  // Get brand count for display
  const getBrandCount = (name: string) => {
    const brand = brands.find(b => b.name === name);
    return brand?.count || 0;
  };

  // Loading state
  if (loading) {
    return (
      <div className={`bg-white rounded-3xl shadow-xl border border-neutral-200 p-6 sm:p-8 ${className}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-extrabold text-neutral-900">Browse by Brand</div>
            <div className="text-xs text-neutral-500">Loading brands...</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="h-14 rounded-xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

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
          <div className="text-xs text-neutral-500">{brands.length} brands in stock</div>
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

      {/* Brands grid (when not searching) */}
      {!searchQuery && (
        <>
          <div className="mb-4">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Available Brands</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {allBrandNames.slice(0, showAllBrands ? undefined : 8).map((brand) => (
              <button
                key={brand}
                onClick={() => handleBrandSelect(brand)}
                className="flex flex-col items-center justify-center h-16 rounded-xl border-2 border-neutral-200 bg-white font-semibold text-sm text-neutral-800 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-purple-400"
              >
                <span>{brand}</span>
                <span className="text-[10px] text-neutral-400 font-normal">{getBrandCount(brand)} tires</span>
              </button>
            ))}
          </div>

          {!showAllBrands && allBrandNames.length > 8 && (
            <button
              onClick={() => setShowAllBrands(true)}
              className="w-full py-3 text-sm font-semibold text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition-colors"
            >
              Show all {allBrandNames.length} brands →
            </button>
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
                  className="h-14 px-4 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-800 hover:bg-purple-50 hover:border-purple-300 transition-colors text-left flex flex-col justify-center"
                >
                  <span>{brand}</span>
                  <span className="text-[10px] text-neutral-400 font-normal">{getBrandCount(brand)} tires</span>
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
