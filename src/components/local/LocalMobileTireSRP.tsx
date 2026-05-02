'use client';

/**
 * LocalMobileTireSRP - Mobile-first tire search results for local mode
 * 
 * ONLY renders on:
 * - Mobile viewport (< 768px)
 * - Local mode (shop.warehousetire.net)
 * 
 * Features:
 * - Single column tire cards
 * - Bottom sheet filter drawer
 * - Sticky top bar with size/count/filter/sort
 * - Touch-optimized UI (52px min buttons)
 * - Full-width cards with proper padding
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useIsLocalMode } from '@/contexts/ShopContextProvider';
import { TirePriceDisplay } from '@/components/TirePriceDisplay';
import { InstallTimeIndicator } from '@/components/InstallTimeIndicator';

// ============================================================================
// TYPES
// ============================================================================

interface TireProduct {
  partNumber: string;
  brand: string;
  model: string;
  size: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  cost?: number;
  quantity?: { primary?: number; alternate?: number; national?: number };
  badges?: {
    terrain?: string | null;
    warrantyMiles?: number | null;
    loadIndex?: string | null;
    speedRating?: string | null;
  };
  enrichment?: {
    treadCategory?: string | null;
    mileage?: number | null;
  };
}

interface FilterState {
  brands: string[];
  treadCategories: string[];
  priceMin: number | null;
  priceMax: number | null;
}

interface LocalMobileTireSRPProps {
  tires: TireProduct[];
  tireSize: string;
  totalCount: number;
  basePath: string;
  brandOptions: Array<{ value: string; count: number }>;
  categoryOptions: Array<{ value: string; count: number }>;
  activeFilters: FilterState;
  sort: string;
  vehicleInfo?: {
    year: string;
    make: string;
    model: string;
    trim?: string;
  };
  onAddToCart?: (tire: TireProduct, qty: number) => void;
}

// ============================================================================
// SORT OPTIONS
// ============================================================================

const SORT_OPTIONS = [
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'brand_asc', label: 'Brand: A-Z' },
  { value: 'mileage_desc', label: 'Mileage: High to Low' },
  { value: 'popular', label: 'Most Popular' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTotalStock(tire: TireProduct): number {
  const q = tire.quantity || {};
  return (q.primary || 0) + (q.alternate || 0) + (q.national || 0);
}

function getDisplayPrice(tire: TireProduct): number | null {
  if (typeof tire.price === 'number' && tire.price > 0) return tire.price;
  if (typeof tire.cost === 'number' && tire.cost > 0) return tire.cost + 50;
  return null;
}

function formatTireSize(size: string): string {
  // Format like "225/65R17" to be readable
  return size?.replace(/\//g, '/').replace(/R/gi, 'R') || '';
}

// ============================================================================
// MOBILE TIRE CARD
// ============================================================================

function MobileTireCard({
  tire,
  onAddToCart,
}: {
  tire: TireProduct;
  onAddToCart?: (tire: TireProduct, qty: number) => void;
}) {
  const [qty, setQty] = useState(4);
  const stock = getTotalStock(tire);
  const price = getDisplayPrice(tire);
  const category = tire.enrichment?.treadCategory || tire.badges?.terrain || 'All-Season';
  const mileage = tire.enrichment?.mileage || tire.badges?.warrantyMiles;
  
  // Out the door pricing (local mode includes install)
  const installPerTire = 20;
  const disposalPerTire = 5;
  const perTireTotal = (price || 0) + installPerTire + disposalPerTire;
  const setTotal = perTireTotal * qty;
  
  const canSameDay = stock >= qty;
  
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-4">
      {/* Header: Brand + Model */}
      <div>
        <p className="text-sm text-neutral-500 font-medium">{tire.brand}</p>
        <h3 className="text-lg font-bold text-neutral-900 leading-tight">
          {tire.model || tire.description?.split(' ').slice(0, 3).join(' ') || 'Tire'}
        </h3>
        <p className="text-sm text-neutral-600 mt-0.5">{formatTireSize(tire.size)}</p>
      </div>
      
      {/* Image */}
      <div className="flex justify-center">
        {tire.imageUrl ? (
          <Image
            src={tire.imageUrl}
            alt={`${tire.brand} ${tire.model}`}
            width={180}
            height={180}
            className="object-contain"
          />
        ) : (
          <div className="w-[180px] h-[180px] bg-neutral-100 rounded-xl flex items-center justify-center">
            <span className="text-4xl">🛞</span>
          </div>
        )}
      </div>
      
      {/* Badges Row */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
          {category}
        </span>
        {mileage && mileage >= 40000 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
            {Math.round(mileage / 1000)}K mi warranty
          </span>
        )}
        {canSameDay && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
            ⚡ Same-day install
          </span>
        )}
      </div>
      
      {/* Price Section */}
      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
        {/* Per tire price */}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-neutral-600">Per tire</span>
          <span className="text-xl font-bold text-neutral-900">
            ${price?.toFixed(2) || '—'}
          </span>
        </div>
        
        {/* Qty selector */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-600">Quantity</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-neutral-200 text-lg font-bold"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-10 text-center font-bold text-lg">{qty}</span>
            <button
              onClick={() => setQty(Math.min(stock, qty + 1))}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-neutral-200 text-lg font-bold"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>
        
        {/* Out the door total */}
        <div className="pt-3 border-t border-neutral-200">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-sm font-semibold text-neutral-900">Out the door</span>
              <p className="text-xs text-neutral-500">Installed, balanced, disposal</p>
            </div>
            <span className="text-2xl font-extrabold text-green-600">
              ${setTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Stock indicator */}
      <div className="flex items-center gap-2 text-sm">
        {stock >= 4 ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-green-700 font-medium">{stock} in stock</span>
          </>
        ) : stock > 0 ? (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-amber-700 font-medium">Only {stock} left</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-700 font-medium">Out of stock</span>
          </>
        )}
      </div>
      
      {/* Action buttons */}
      <div className="space-y-2">
        <button
          onClick={() => onAddToCart?.(tire, qty)}
          disabled={stock < 1}
          className="w-full h-[52px] rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-neutral-300 text-white font-bold text-base transition-colors"
        >
          Add {qty} to Cart
        </button>
        <Link
          href={`/tires/${tire.partNumber}`}
          className="block w-full h-[52px] rounded-xl border-2 border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 font-semibold text-base text-center leading-[48px] transition-colors"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// FILTER DRAWER (Bottom Sheet)
// ============================================================================

function FilterDrawer({
  isOpen,
  onClose,
  brandOptions,
  categoryOptions,
  activeFilters,
  basePath,
}: {
  isOpen: boolean;
  onClose: () => void;
  brandOptions: Array<{ value: string; count: number }>;
  categoryOptions: Array<{ value: string; count: number }>;
  activeFilters: FilterState;
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Local filter state for Apply
  const [localBrands, setLocalBrands] = useState<string[]>(activeFilters.brands);
  const [localCategories, setLocalCategories] = useState<string[]>(activeFilters.treadCategories);
  const [localPriceMin, setLocalPriceMin] = useState<string>(activeFilters.priceMin?.toString() || '');
  const [localPriceMax, setLocalPriceMax] = useState<string>(activeFilters.priceMax?.toString() || '');
  
  // Reset local state when drawer opens
  useEffect(() => {
    if (isOpen) {
      setLocalBrands(activeFilters.brands);
      setLocalCategories(activeFilters.treadCategories);
      setLocalPriceMin(activeFilters.priceMin?.toString() || '');
      setLocalPriceMax(activeFilters.priceMax?.toString() || '');
    }
  }, [isOpen, activeFilters]);
  
  const toggleBrand = (brand: string) => {
    setLocalBrands(prev => 
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
  };
  
  const toggleCategory = (cat: string) => {
    setLocalCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };
  
  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Clear old filter params
    params.delete('brand');
    params.delete('treadCategory');
    params.delete('priceMin');
    params.delete('priceMax');
    params.delete('page');
    
    // Set new filters
    localBrands.forEach(b => params.append('brand', b));
    localCategories.forEach(c => params.append('treadCategory', c));
    if (localPriceMin) params.set('priceMin', localPriceMin);
    if (localPriceMax) params.set('priceMax', localPriceMax);
    
    router.push(`${basePath}?${params.toString()}`);
    onClose();
  };
  
  const clearFilters = () => {
    setLocalBrands([]);
    setLocalCategories([]);
    setLocalPriceMin('');
    setLocalPriceMax('');
  };
  
  const activeCount = localBrands.length + localCategories.length + 
    (localPriceMin ? 1 : 0) + (localPriceMax ? 1 : 0);
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-neutral-300" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <h2 className="text-lg font-bold text-neutral-900">Filters</h2>
          {activeCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-red-600"
            >
              Clear all ({activeCount})
            </button>
          )}
        </div>
        
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Category */}
          {categoryOptions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Category</h3>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map(({ value, count }) => (
                  <button
                    key={value}
                    onClick={() => toggleCategory(value)}
                    className={`h-11 px-4 rounded-full text-sm font-medium transition-colors ${
                      localCategories.includes(value)
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    {value} ({count})
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Brand */}
          {brandOptions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Brand</h3>
              <div className="grid grid-cols-2 gap-2">
                {brandOptions.slice(0, 12).map(({ value, count }) => (
                  <button
                    key={value}
                    onClick={() => toggleBrand(value)}
                    className={`h-12 px-3 rounded-xl text-sm font-medium text-left transition-colors flex items-center justify-between ${
                      localBrands.includes(value)
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    <span className="truncate">{value}</span>
                    <span className="text-xs opacity-60 ml-1">({count})</span>
                  </button>
                ))}
              </div>
              {brandOptions.length > 12 && (
                <button className="mt-2 text-sm text-blue-600 font-medium">
                  Show {brandOptions.length - 12} more brands
                </button>
              )}
            </div>
          )}
          
          {/* Price Range */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Price Range</h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-neutral-500 mb-1 block">Min</label>
                <input
                  type="number"
                  placeholder="$0"
                  value={localPriceMin}
                  onChange={(e) => setLocalPriceMin(e.target.value)}
                  className="w-full h-12 rounded-xl border border-neutral-200 px-4 text-base"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-neutral-500 mb-1 block">Max</label>
                <input
                  type="number"
                  placeholder="$500"
                  value={localPriceMax}
                  onChange={(e) => setLocalPriceMax(e.target.value)}
                  className="w-full h-12 rounded-xl border border-neutral-200 px-4 text-base"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Fixed footer */}
        <div className="p-4 border-t border-neutral-100 bg-white">
          <button
            onClick={applyFilters}
            className="w-full h-[52px] rounded-xl bg-neutral-900 text-white font-bold text-base"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// SORT DRAWER
// ============================================================================

function SortDrawer({
  isOpen,
  onClose,
  currentSort,
  basePath,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentSort: string;
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const selectSort = (sort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', sort);
    params.delete('page');
    router.push(`${basePath}?${params.toString()}`);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-neutral-300" />
        </div>
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-100">
          <h2 className="text-lg font-bold text-neutral-900">Sort By</h2>
        </div>
        
        {/* Options */}
        <div className="p-4 space-y-2">
          {SORT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => selectSort(value)}
              className={`w-full h-14 px-4 rounded-xl text-left text-base font-medium flex items-center justify-between transition-colors ${
                currentSort === value
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              <span>{label}</span>
              {currentSort === value && <span>✓</span>}
            </button>
          ))}
        </div>
        
        {/* Cancel */}
        <div className="p-4 pt-0">
          <button
            onClick={onClose}
            className="w-full h-[52px] rounded-xl border-2 border-neutral-200 text-neutral-700 font-semibold text-base"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LocalMobileTireSRP({
  tires,
  tireSize,
  totalCount,
  basePath,
  brandOptions,
  categoryOptions,
  activeFilters,
  sort,
  vehicleInfo,
  onAddToCart,
}: LocalMobileTireSRPProps) {
  const isLocal = useIsLocalMode();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  
  // DEBUG: Log client-side detection
  console.log('[LocalMobileTireSRP] isLocal:', isLocal);
  
  // Only render on mobile + local mode
  // Desktop/tablet and national mode should use the existing SRP
  if (!isLocal) {
    // DEBUG: Show why component isn't rendering
    return (
      <div className="md:hidden bg-red-500 text-white p-4 text-center font-bold">
        ❌ LocalMobileTireSRP: isLocal={String(isLocal)} - Component blocked by client check
      </div>
    );
  }
  
  const activeFilterCount = 
    activeFilters.brands.length + 
    activeFilters.treadCategories.length +
    (activeFilters.priceMin !== null ? 1 : 0) +
    (activeFilters.priceMax !== null ? 1 : 0);
  
  return (
    <div className="md:hidden">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 py-3">
        {/* Size + count */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-base font-bold text-neutral-900">{formatTireSize(tireSize)}</span>
            <span className="text-sm text-neutral-500 ml-2">{totalCount} in stock</span>
          </div>
          <InstallTimeIndicator variant="badge" />
        </div>
        
        {/* Filter + Sort buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterOpen(true)}
            className="flex-1 h-11 rounded-xl bg-neutral-100 text-neutral-900 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setSortOpen(true)}
            className="flex-1 h-11 rounded-xl bg-neutral-100 text-neutral-900 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Sort
          </button>
        </div>
      </div>
      
      {/* Tire list - single column, full width */}
      <div className="px-4 py-4 space-y-4">
        {tires.map((tire) => (
          <MobileTireCard
            key={tire.partNumber}
            tire={tire}
            onAddToCart={onAddToCart}
          />
        ))}
        
        {tires.length === 0 && (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">🔍</span>
            <p className="text-lg font-semibold text-neutral-900">No tires found</p>
            <p className="text-sm text-neutral-500 mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
      
      {/* Drawers */}
      <FilterDrawer
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        brandOptions={brandOptions}
        categoryOptions={categoryOptions}
        activeFilters={activeFilters}
        basePath={basePath}
      />
      <SortDrawer
        isOpen={sortOpen}
        onClose={() => setSortOpen(false)}
        currentSort={sort}
        basePath={basePath}
      />
      
      {/* CSS for animation */}
      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default LocalMobileTireSRP;
