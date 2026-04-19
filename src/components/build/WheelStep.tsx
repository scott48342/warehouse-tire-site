"use client";

import { useState, useEffect } from "react";
import { useBuild, type BuildWheel } from "./BuildContext";
import { InlineGuide } from "./GuideVoice";

// ============================================================================
// Types
// ============================================================================

type WheelResult = {
  sku: string;
  brand: string;
  model: string;
  finish?: string;
  diameter: string;
  width: string;
  offset?: string;
  boltPattern?: string;
  imageUrl?: string;
  price: number;
  fitmentClass?: "surefit" | "specfit" | "extended";
  stockQty?: number;
};

type TopPickCategory = "best-overall" | "most-popular" | "best-style" | "best-value";

const TOP_PICK_CONFIG: Record<TopPickCategory, { icon: string; label: string; description: string; color: string }> = {
  "best-overall": { 
    icon: "⭐", 
    label: "Best Overall", 
    description: "Perfect blend of style, fitment, and value",
    color: "from-amber-400/90 to-yellow-400/90 text-amber-950"
  },
  "most-popular": { 
    icon: "🔥", 
    label: "Most Popular", 
    description: "Customer favorite for this vehicle",
    color: "from-orange-400/90 to-amber-400/90 text-orange-950"
  },
  "best-style": { 
    icon: "💎", 
    label: "Best Style Upgrade", 
    description: "Bold upgrade for a head-turning look",
    color: "from-purple-400/90 to-violet-400/90 text-purple-950"
  },
  "best-value": { 
    icon: "🛞", 
    label: "Best Value", 
    description: "Great look without breaking the bank",
    color: "from-emerald-400/90 to-teal-400/90 text-emerald-950"
  },
};

// ============================================================================
// Wheel Card
// ============================================================================

function WheelCard({ 
  wheel, 
  category,
  onSelect,
  isSelected,
}: { 
  wheel: WheelResult;
  category?: TopPickCategory;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const setPrice = wheel.price * 4;
  const config = category ? TOP_PICK_CONFIG[category] : null;
  
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
      {/* Top Pick Badge */}
      {config && (
        <div className={`px-3 py-2 bg-gradient-to-r ${config.color}`}>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="text-sm">{config.icon}</span>
            <span>{config.label}</span>
          </div>
        </div>
      )}
      
      {/* Image */}
      <div className="aspect-square w-full overflow-hidden bg-neutral-50 p-4">
        {wheel.imageUrl ? (
          <img
            src={wheel.imageUrl}
            alt={wheel.model}
            className="h-full w-full object-contain transition-transform duration-250 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-4xl text-neutral-300">⚙️</span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
          {wheel.brand}
        </div>
        <h3 className="mt-1 text-base font-bold text-neutral-900 line-clamp-1">
          {wheel.model}
        </h3>
        <div className="mt-1 text-sm text-neutral-600">
          {wheel.diameter}" × {wheel.width}"
          {wheel.finish && <span className="ml-1.5 text-neutral-400">|</span>}
          {wheel.finish && <span className="ml-1.5">{wheel.finish}</span>}
        </div>
        
        {/* Why this wheel */}
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
          {isSelected ? "✓ Selected" : "Select These Wheels"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// WheelStep Component
// ============================================================================

export function WheelStep() {
  const { state, setWheel } = useBuild();
  const [wheels, setWheels] = useState<WheelResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch wheels for vehicle
  useEffect(() => {
    if (!state.vehicle) return;
    
    const fetchWheels = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          year: state.vehicle!.year,
          make: state.vehicle!.make,
          model: state.vehicle!.model,
        });
        if (state.vehicle!.trim) params.set("trim", state.vehicle!.trim);
        
        const res = await fetch(`/api/wheels/fitment-search?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch wheels");
        
        const data = await res.json();
        // API returns { results: [] } with wheel objects
        const rawWheels = data.results || data.wheels || [];
        
        // Normalize wheel data to expected format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalizedWheels: WheelResult[] = rawWheels.map((w: any) => {
          // Extract brand - API returns { code, description } object
          const brandObj = w.brand;
          const brandName = typeof brandObj === "string" 
            ? brandObj 
            : (brandObj?.description || brandObj?.code || w.properties?.brand_desc || w.properties?.brand_cd || "Unknown");
          
          // Extract properties
          const props = w.properties || {};
          
          // Extract price from prices array
          const priceValue = w.prices?.msrp?.[0]?.currencyAmount;
          const price = typeof priceValue === "string" ? parseFloat(priceValue) : (typeof priceValue === "number" ? priceValue : 0);
          
          // Extract image
          const imageUrl = w.images?.[0]?.imageUrlLarge || w.images?.[0]?.imageUrlMedium || w.imageUrl || "";
          
          return {
            sku: w.sku || "",
            brand: brandName,
            model: w.title || props.style_desc || "",
            finish: props.abbreviated_finish_desc || props.fancy_finish_desc || "",
            diameter: String(props.diameter || w.diameter || ""),
            width: String(props.width || w.width || ""),
            offset: props.offset ? String(props.offset) : undefined,
            boltPattern: props.boltPattern || props.boltPatternMetric || "",
            imageUrl,
            price,
            fitmentClass: w.fitmentValidation?.fitmentClass || "specfit",
            stockQty: w.inventory?.localStock || 0,
          };
        });
        
        setWheels(normalizedWheels);
      } catch (err) {
        console.error("[WheelStep] Fetch error:", err);
        setError("Unable to load wheels. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchWheels();
  }, [state.vehicle]);
  
  const handleSelect = (wheel: WheelResult) => {
    const buildWheel: BuildWheel = {
      sku: wheel.sku,
      brand: wheel.brand,
      model: wheel.model,
      finish: wheel.finish,
      diameter: wheel.diameter,
      width: wheel.width,
      offset: wheel.offset,
      boltPattern: wheel.boltPattern,
      imageUrl: wheel.imageUrl,
      unitPrice: wheel.price,
      setPrice: wheel.price * 4,
      fitmentClass: wheel.fitmentClass,
    };
    setWheel(buildWheel);
  };
  
  // Get top picks (first 4 wheels, each with a category)
  const topPicks = wheels.slice(0, 4);
  const categories: TopPickCategory[] = ["best-overall", "most-popular", "best-style", "best-value"];
  
  // Remaining wheels
  const moreWheels = wheels.slice(4);
  
  if (!state.vehicle) {
    return (
      <div className="text-center py-12 text-neutral-500">
        Please select a vehicle first.
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
          Finding the best wheels for your {state.vehicle.model}...
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
  
  if (wheels.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-500">
        No wheels found for this vehicle. Please contact us for assistance.
      </div>
    );
  }
  
  return (
    <div>
      {/* Guide message */}
      <InlineGuide 
        message="These are my top picks for your vehicle — all of these will fit perfectly."
        className="mb-6"
      />
      
      {/* Top Picks */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-neutral-800 mb-4">
          Top Picks for Your {state.vehicle.model}
        </h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {topPicks.map((wheel, idx) => (
            <WheelCard
              key={wheel.sku}
              wheel={wheel}
              category={categories[idx]}
              onSelect={() => handleSelect(wheel)}
              isSelected={state.wheel?.sku === wheel.sku}
            />
          ))}
        </div>
      </div>
      
      {/* More Options */}
      {moreWheels.length > 0 && (
        <div>
          <h3 className="text-base font-bold text-neutral-700 mb-4">
            More Options ({moreWheels.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {moreWheels.slice(0, 8).map((wheel) => (
              <WheelCard
                key={wheel.sku}
                wheel={wheel}
                onSelect={() => handleSelect(wheel)}
                isSelected={state.wheel?.sku === wheel.sku}
              />
            ))}
          </div>
          {moreWheels.length > 8 && (
            <div className="text-center mt-6">
              <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
                View all {moreWheels.length} options →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
