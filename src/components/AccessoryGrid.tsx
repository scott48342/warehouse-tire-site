"use client";

import { useEffect, useState } from "react";
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

type Props = {
  category: string;
  title: string;
  description?: string;
  icon?: string;
};

export function AccessoryGrid({ category, title, description, icon }: Props) {
  const [items, setItems] = useState<AccessoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAccessories() {
      try {
        setLoading(true);
        const res = await fetch(`/api/accessories/search?category=${category}&pageSize=50`);
        const data = await res.json();
        
        if (data.error) {
          setError(data.error);
        } else {
          setItems(data.results || []);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load accessories");
      } finally {
        setLoading(false);
      }
    }
    
    fetchAccessories();
  }, [category]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

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
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
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
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
            <p className="text-neutral-600">No accessories found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
  );
}
