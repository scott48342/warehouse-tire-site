"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

type AccessoryItem = {
  sku: string;
  title: string;
  brand?: string;
  price: number;
  msrp?: number;
  inStock: boolean;
  imageUrl?: string;
};

type Brand = {
  name: string;
  count: number;
};

type Props = {
  category: string;
  title: string;
  description?: string;
  icon?: string;
};

export function AccessoryGrid({ category, title, description, icon }: Props) {
  const [items, setItems] = useState<AccessoryItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  
  // Filter state
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchAccessories = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams({
        category,
        pageSize: "100",
      });
      
      if (selectedBrands.size === 1) {
        params.set("brand", Array.from(selectedBrands)[0]);
      }
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (inStockOnly) params.set("inStock", "1");
      
      const res = await fetch(`/api/accessories/search?${params}`);
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        let results = data.results || [];
        
        // Client-side multi-brand filter (API only supports single brand)
        if (selectedBrands.size > 1) {
          results = results.filter((item: AccessoryItem) => 
            item.brand && selectedBrands.has(item.brand)
          );
        }
        
        setItems(results);
        setTotal(data.total || results.length);
        setBrands(data.brands || []);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load accessories");
    } finally {
      setLoading(false);
    }
  }, [category, selectedBrands, minPrice, maxPrice, inStockOnly]);

  useEffect(() => {
    fetchAccessories();
  }, [fetchAccessories]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brand)) {
        next.delete(brand);
      } else {
        next.add(brand);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedBrands(new Set());
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
  };

  const hasActiveFilters = selectedBrands.size > 0 || minPrice || maxPrice || inStockOnly;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <h1 className="text-3xl font-bold text-neutral-900">
            {icon && <span className="mr-2">{icon}</span>}
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-neutral-600">{description}</p>
          )}
          <p className="mt-2 text-sm text-neutral-500">
            {total.toLocaleString()} products
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="lg:grid lg:grid-cols-4 lg:gap-8">
          {/* Mobile filter toggle */}
          <div className="lg:hidden mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border border-neutral-200 rounded-lg"
            >
              <span className="font-medium">
                Filters {hasActiveFilters && `(${selectedBrands.size + (minPrice || maxPrice ? 1 : 0) + (inStockOnly ? 1 : 0)})`}
              </span>
              <svg className={`w-5 h-5 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Filter Sidebar */}
          <div className={`lg:col-span-1 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white border border-neutral-200 rounded-xl p-4 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-neutral-900">Filters</h2>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-orange-600 hover:text-orange-700"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-neutral-700 mb-2">Price Range</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                  />
                  <span className="text-neutral-400">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* In Stock */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-neutral-700">In Stock Only</span>
                </label>
              </div>

              {/* Brands */}
              {brands.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-2">Brand</h3>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {brands.map((brand) => (
                      <label key={brand.name} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={selectedBrands.has(brand.name)}
                          onChange={() => toggleBrand(brand.name)}
                          className="w-4 h-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span className="text-sm text-neutral-700 flex-1">{brand.name}</span>
                        <span className="text-xs text-neutral-400">({brand.count})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product Grid */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                    <div className="aspect-square bg-neutral-200 rounded-lg mb-4" />
                    <div className="h-4 bg-neutral-200 rounded mb-2" />
                    <div className="h-4 bg-neutral-200 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-700">{error}</p>
                <button 
                  onClick={() => fetchAccessories()}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
                <p className="text-neutral-600">No accessories found matching your filters.</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {items.map((item) => (
                  <Link
                    key={item.sku}
                    href={`/accessories/${encodeURIComponent(item.sku)}`}
                    className="bg-white border border-neutral-200 rounded-xl p-4 hover:shadow-lg hover:border-orange-300 transition-all group"
                  >
                    {/* Product image */}
                    <div className="aspect-square bg-neutral-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-4xl text-neutral-400">📦</span>
                      )}
                    </div>
                    
                    {/* Brand */}
                    {item.brand && (
                      <p className="text-xs font-semibold text-orange-600 uppercase mb-1">
                        {item.brand}
                      </p>
                    )}
                    
                    {/* Title */}
                    <h3 className="text-sm font-semibold text-neutral-900 line-clamp-2 mb-2 group-hover:text-orange-600 transition-colors">
                      {item.title}
                    </h3>
                    
                    {/* SKU */}
                    <p className="text-xs text-neutral-400 mb-2">SKU: {item.sku}</p>
                    
                    {/* Price */}
                    <div className="flex items-baseline gap-2">
                      {item.price > 0 ? (
                        <>
                          <span className="text-lg font-bold text-neutral-900">
                            {formatPrice(item.price)}
                          </span>
                          {item.msrp && item.msrp > item.price && (
                            <span className="text-sm text-neutral-400 line-through">
                              {formatPrice(item.msrp)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-neutral-500">Contact for pricing</span>
                      )}
                    </div>
                    
                    {/* Stock status */}
                    <p className={`text-xs mt-2 ${item.inStock ? "text-green-600" : "text-amber-600"}`}>
                      {item.inStock ? "✓ In Stock" : "⏳ Ships in 2-5 days"}
                    </p>
                    
                    {/* View Details button */}
                    <span className="mt-4 block w-full py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg text-center group-hover:bg-orange-700 transition-colors">
                      View Details
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
