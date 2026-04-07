"use client";

import { useState, useMemo } from "react";

type BrandOption = {
  code: string;
  name: string;
  count?: number;
};

interface SearchableBrandFilterProps {
  brands: BrandOption[];
  selectedBrands: string[];
  onToggle: (brandCode: string) => void;
  maxVisible?: number;
}

/**
 * SearchableBrandFilter
 * 
 * A searchable, filterable brand selection component.
 * Features:
 * - Search input to filter brands
 * - Shows product count per brand
 * - Sorted by: selected first, then count (desc), then alphabetical
 * - "Show more" for long lists
 */
export function SearchableBrandFilter({
  brands,
  selectedBrands,
  onToggle,
  maxVisible = 10,
}: SearchableBrandFilterProps) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Filter and sort brands
  const filteredBrands = useMemo(() => {
    let result = [...brands];
    
    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(b => 
        b.name.toLowerCase().includes(searchLower) ||
        b.code.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort: selected first, then by count (desc), then alphabetical
    result.sort((a, b) => {
      const aSelected = selectedBrands.includes(a.code) ? 1 : 0;
      const bSelected = selectedBrands.includes(b.code) ? 1 : 0;
      
      // Selected first
      if (aSelected !== bSelected) return bSelected - aSelected;
      
      // Then by count (desc)
      const aCount = a.count ?? 0;
      const bCount = b.count ?? 0;
      if (aCount !== bCount) return bCount - aCount;
      
      // Then alphabetical
      return a.name.localeCompare(b.name);
    });
    
    return result;
  }, [brands, selectedBrands, search]);

  // Determine visible brands
  const visibleBrands = showAll || search.trim() 
    ? filteredBrands 
    : filteredBrands.slice(0, maxVisible);
  
  const hasMore = !showAll && !search.trim() && filteredBrands.length > maxVisible;

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search brands..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-8 pr-3 text-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
        />
        <svg
          className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Brand list */}
      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {visibleBrands.length === 0 ? (
          <div className="py-3 text-center text-sm text-neutral-500">
            No brands found
          </div>
        ) : (
          visibleBrands.map((brand) => {
            const isSelected = selectedBrands.includes(brand.code);
            return (
              <button
                key={brand.code}
                type="button"
                onClick={() => onToggle(brand.code)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 py-1.5 hover:bg-neutral-50 -mx-2 px-2 rounded-lg transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                      isSelected
                        ? "border-neutral-900 bg-neutral-900"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {isSelected && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${isSelected ? "font-semibold text-neutral-900" : "text-neutral-800"}`}>
                    {brand.name}
                  </span>
                </div>
                {typeof brand.count === "number" && (
                  <span className="text-xs font-medium text-neutral-400">{brand.count.toLocaleString()}</span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Show more/less */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full py-1.5 text-center text-sm font-semibold text-neutral-600 hover:text-neutral-900 hover:underline"
        >
          Show {filteredBrands.length - maxVisible} more brands
        </button>
      )}
      {showAll && !search.trim() && filteredBrands.length > maxVisible && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="w-full py-1.5 text-center text-sm font-semibold text-neutral-600 hover:text-neutral-900 hover:underline"
        >
          Show less
        </button>
      )}
    </div>
  );
}

/**
 * Popular brand badges for quick selection
 */
export function PopularBrandBadges({
  brands,
  selectedBrands,
  onToggle,
  maxShow = 6,
}: {
  brands: BrandOption[];
  selectedBrands: string[];
  onToggle: (brandCode: string) => void;
  maxShow?: number;
}) {
  // Get top brands by count
  const topBrands = useMemo(() => {
    return [...brands]
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, maxShow);
  }, [brands, maxShow]);

  if (topBrands.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {topBrands.map((brand) => {
        const isSelected = selectedBrands.includes(brand.code);
        return (
          <button
            key={brand.code}
            type="button"
            onClick={() => onToggle(brand.code)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              isSelected
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {brand.name}
          </button>
        );
      })}
    </div>
  );
}
