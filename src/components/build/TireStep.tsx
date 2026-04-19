"use client";

import { useState, useEffect } from "react";
import { useBuild, type BuildTire } from "./BuildContext";

// ============================================================================
// Types
// ============================================================================

type TireResult = {
  sku: string;
  partNumber?: string;
  brand: string;
  model: string;
  displayName?: string;
  size: string;
  imageUrl?: string;
  price: number;
  loadIndex?: string;
  speedRating?: string;
  warrantyMiles?: number;
  treadCategory?: string;
  stockQty?: number;
};

type TireCategory = "best-overall" | "most-popular" | "best-comfort" | "best-value";

const TIRE_CATEGORY_CONFIG: Record<TireCategory, { icon: string; label: string; description: string; color: string }> = {
  "best-overall": { 
    icon: "⭐", 
    label: "Best Overall", 
    description: "Top-rated for performance and longevity",
    color: "from-amber-400/90 to-yellow-400/90 text-amber-950"
  },
  "most-popular": { 
    icon: "🔥", 
    label: "Most Popular", 
    description: "Customer favorite for this setup",
    color: "from-orange-400/90 to-amber-400/90 text-orange-950"
  },
  "best-comfort": { 
    icon: "🛋️", 
    label: "Best Comfort", 
    description: "Smooth, quiet ride",
    color: "from-blue-400/90 to-indigo-400/90 text-blue-950"
  },
  "best-value": { 
    icon: "💰", 
    label: "Best Value", 
    description: "Great performance at a great price",
    color: "from-emerald-400/90 to-teal-400/90 text-emerald-950"
  },
};

// ============================================================================
// Tire Card
// ============================================================================

function TireCard({ 
  tire, 
  category,
  onSelect,
  isSelected,
}: { 
  tire: TireResult;
  category?: TireCategory;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const setPrice = tire.price * 4;
  const config = category ? TIRE_CATEGORY_CONFIG[category] : null;
  const displayModel = tire.displayName || tire.model;
  
  return (
    <div 
      className={`
        group relative flex flex-col overflow-hidden rounded-2xl border bg-white
        transition-all duration-250 ease-out cursor-pointer
        ${isSelected
          ? "ring-2 ring-green-500 ring-offset-2 border-green-200"
          : "border-neutral-200 hover:shadow-md hover:border-neutral-300 hover:-translate-y-0.5"
        }
      `}
      onClick={onSelect}
    >
      {/* Category Badge */}
      {config && (
        <div className={`px-3 py-2 bg-gradient-to-r ${config.color}`}>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="text-sm">{config.icon}</span>
            <span>{config.label}</span>
          </div>
        </div>
      )}
      
      {/* Image */}
      <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-50 p-4">
        {tire.imageUrl ? (
          <img
            src={tire.imageUrl}
            alt={displayModel}
            className="h-full w-full object-contain transition-transform duration-250 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-5xl text-neutral-300">🛞</span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
          {tire.brand}
        </div>
        <h3 className="mt-1 text-base font-bold text-neutral-900 line-clamp-1">
          {displayModel}
        </h3>
        <div className="mt-1 text-sm text-neutral-600">
          {tire.size}
        </div>
        
        {/* Specs badges */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tire.treadCategory && (
            <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] font-medium">
              {tire.treadCategory}
            </span>
          )}
          {tire.warrantyMiles && tire.warrantyMiles >= 40000 && (
            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-medium">
              {Math.round(tire.warrantyMiles / 1000)}K mi warranty
            </span>
          )}
        </div>
        
        {/* Why this tire */}
        {config && (
          <div className="mt-2.5 text-[11px] italic text-neutral-500">
            "{config.description}"
          </div>
        )}
        
        {/* Price */}
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-neutral-900">
              ${setPrice.toLocaleString()}
            </span>
            <span className="text-xs text-neutral-400">set of 4</span>
          </div>
          {setPrice >= 50 && (
            <div className="text-xs text-neutral-400 mt-1">
              As low as ${Math.ceil(setPrice / 12)}/mo with Affirm
            </div>
          )}
        </div>
        
        {/* Select button */}
        <button
          className={`
            mt-3 w-full py-2.5 rounded-xl font-bold text-sm transition-all
            ${isSelected
              ? "bg-green-500 text-white"
              : "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-600"
            }
          `}
        >
          {isSelected ? "✓ Selected" : "Select These Tires"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// TireStep Component
// ============================================================================

export function TireStep() {
  const { state, setTire } = useBuild();
  const [tires, setTires] = useState<TireResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch tires that match the selected wheel
  useEffect(() => {
    if (!state.vehicle || !state.wheel) return;
    
    const fetchTires = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          year: state.vehicle!.year,
          make: state.vehicle!.make,
          model: state.vehicle!.model,
          wheelDia: state.wheel!.diameter,
          wheelWidth: state.wheel!.width,
        });
        if (state.vehicle!.trim) params.set("trim", state.vehicle!.trim);
        
        const res = await fetch(`/api/tires/search?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch tires");
        
        const data = await res.json();
        
        // API returns { results: [] } not { tires: [] }
        const rawTires = data.results || data.tires || [];
        
        // Normalize tire data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalizedTires: TireResult[] = rawTires.map((t: any) => {
          const badges = t.badges || {};
          const quantity = t.quantity || {};
          return {
            sku: t.partNumber || t.sku || "",
            partNumber: t.partNumber,
            brand: t.brand || "Unknown",
            model: t.description || t.model || "",
            displayName: t.displayName || t.prettyName,
            size: t.size || "",
            imageUrl: t.imageUrl,
            price: typeof t.price === "number" ? t.price : (typeof t.cost === "number" ? t.cost + 50 : 0),
            loadIndex: badges.loadIndex || t.loadIndex,
            speedRating: badges.speedRating || t.speedRating,
            warrantyMiles: badges.warrantyMiles || t.warrantyMiles,
            treadCategory: t.treadCategory || badges.terrain,
            stockQty: quantity.primary || 0,
          };
        });
        
        setTires(normalizedTires);
      } catch (err) {
        console.error("[TireStep] Fetch error:", err);
        setError("Unable to load tires. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchTires();
  }, [state.vehicle, state.wheel]);
  
  const handleSelect = (tire: TireResult) => {
    const buildTire: BuildTire = {
      sku: tire.sku,
      brand: tire.brand,
      model: tire.displayName || tire.model,
      size: tire.size,
      imageUrl: tire.imageUrl,
      unitPrice: tire.price,
      setPrice: tire.price * 4,
      loadIndex: tire.loadIndex,
      speedRating: tire.speedRating,
    };
    setTire(buildTire);
  };
  
  // Get top picks (first 4 tires, each with a category)
  const topPicks = tires.slice(0, 4);
  const categories: TireCategory[] = ["best-overall", "most-popular", "best-comfort", "best-value"];
  
  // Remaining tires
  const moreTires = tires.slice(4);
  
  if (!state.wheel) {
    return (
      <div className="text-center py-12 text-neutral-500">
        Please select wheels first.
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-3 text-neutral-600">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Finding the best tires for your {state.wheel.brand} {state.wheel.model} wheels...
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        {error}
      </div>
    );
  }
  
  if (tires.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-500">
        No matching tires found. Please contact us for assistance.
      </div>
    );
  }
  
  return (
    <div>
      {/* Selected wheel reminder */}
      <div className="mb-6 rounded-xl bg-green-50 border border-green-200 p-4">
        <div className="flex items-center gap-4">
          {state.wheel.imageUrl && (
            <img 
              src={state.wheel.imageUrl} 
              alt={state.wheel.model}
              className="h-16 w-16 rounded-lg border border-green-200 object-contain bg-white"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-sm font-bold text-green-800">Wheels Selected</span>
            </div>
            <div className="text-sm text-green-700">
              {state.wheel.brand} {state.wheel.model} • {state.wheel.diameter}" × {state.wheel.width}"
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-green-800">${state.wheel.setPrice.toLocaleString()}</div>
          </div>
        </div>
      </div>
      
      {/* FIX #2: Guide message removed - ContextualGuide in layout already shows this */}
      
      {/* Top Picks */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-neutral-800 mb-4">
          Best Tires for This Setup
        </h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {topPicks.map((tire, idx) => (
            <TireCard
              key={tire.sku}
              tire={tire}
              category={categories[idx]}
              onSelect={() => handleSelect(tire)}
              isSelected={state.tire?.sku === tire.sku}
            />
          ))}
        </div>
      </div>
      
      {/* More Options */}
      {moreTires.length > 0 && (
        <div>
          <h3 className="text-base font-bold text-neutral-700 mb-4">
            More Options ({moreTires.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {moreTires.slice(0, 8).map((tire) => (
              <TireCard
                key={tire.sku}
                tire={tire}
                onSelect={() => handleSelect(tire)}
                isSelected={state.tire?.sku === tire.sku}
              />
            ))}
          </div>
          {moreTires.length > 8 && (
            <div className="text-center mt-6">
              <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
                View all {moreTires.length} options →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
