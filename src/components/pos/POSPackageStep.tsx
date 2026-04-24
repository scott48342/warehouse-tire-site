"use client";

import { useState, useEffect } from "react";
import { usePOS, type POSWheel, type POSTire } from "./POSContext";

// ============================================================================
// Types
// ============================================================================

interface WheelOption {
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
  fitmentClass?: string;
}

interface TireOption {
  sku: string;
  brand: string;
  model: string;
  size: string;
  imageUrl?: string;
  price: number;
}

// ============================================================================
// POS Package Step - Simplified 2-phase selection
// ============================================================================

export function POSPackageStep() {
  const { state, setWheel, setTire, goToStep } = usePOS();
  
  const [wheels, setWheels] = useState<WheelOption[]>([]);
  const [tires, setTires] = useState<TireOption[]>([]);
  const [loadingWheels, setLoadingWheels] = useState(true);
  const [loadingTires, setLoadingTires] = useState(false);
  
  // Phase: "wheels" or "tires"
  const [phase, setPhase] = useState<"wheels" | "tires">("wheels");
  
  // Fetch wheels when vehicle is set
  useEffect(() => {
    if (!state.vehicle) return;
    
    setLoadingWheels(true);
    const params = new URLSearchParams({
      year: state.vehicle.year,
      make: state.vehicle.make,
      model: state.vehicle.model,
    });
    if (state.vehicle.trim) params.set("trim", state.vehicle.trim);
    
    fetch(`/api/wheels/fitment-search?${params}`)
      .then((res) => res.json())
      .then((data) => {
        const results = data.results || data.wheels || [];
        const normalized: WheelOption[] = results.map((w: Record<string, unknown>) => {
          const brandObj = w.brand as Record<string, string> | string | undefined;
          const brand = typeof brandObj === "object" ? brandObj?.description || brandObj?.code || "Unknown" : brandObj || "Unknown";
          const prices = w.prices as Record<string, { currencyAmount?: number }[]> | undefined;
          const price = prices?.msrp?.[0]?.currencyAmount || 0;
          const props = w.properties as Record<string, string | number> | undefined;
          const images = w.images as { imageUrlLarge?: string }[] | undefined;
          const fitVal = w.fitmentValidation as Record<string, string> | undefined;
          
          return {
            sku: (w.partNumber || w.sku || "") as string,
            brand,
            model: (w.styleDescription || w.model || "") as string,
            finish: (props?.finish || w.finish || "") as string,
            diameter: String(props?.diameter || w.diameter || ""),
            width: String(props?.width || w.width || ""),
            offset: props?.offset ? String(props.offset) : undefined,
            boltPattern: (w.boltPattern || "") as string,
            imageUrl: images?.[0]?.imageUrlLarge || (w.imageUrl as string) || undefined,
            price,
            fitmentClass: fitVal?.fitmentClass || (w.fitmentClass as string) || undefined,
          };
        });
        
        setWheels(normalized);
      })
      .catch((err) => {
        console.error("[POS] Error fetching wheels:", err);
        setWheels([]);
      })
      .finally(() => setLoadingWheels(false));
  }, [state.vehicle]);
  
  // Fetch tires when wheel is selected
  useEffect(() => {
    if (!state.vehicle || !state.wheel) {
      setTires([]);
      return;
    }
    
    setLoadingTires(true);
    setPhase("tires");
    
    const params = new URLSearchParams({
      year: state.vehicle.year,
      make: state.vehicle.make,
      model: state.vehicle.model,
      wheelDia: state.wheel.diameter,
      wheelWidth: state.wheel.width,
    });
    if (state.vehicle.trim) params.set("trim", state.vehicle.trim);
    
    fetch(`/api/tires/search?${params}`)
      .then((res) => res.json())
      .then((data) => {
        const results = data.results || data.tires || [];
        const normalized: TireOption[] = results.map((t: Record<string, unknown>) => ({
          sku: (t.partNumber || t.sku || "") as string,
          brand: (t.brand || "Unknown") as string,
          model: (t.displayName || t.prettyName || t.description || t.model || "") as string,
          size: (t.size || "") as string,
          imageUrl: (t.imageUrl as string) || undefined,
          price: typeof t.price === "number" ? t.price : (typeof t.cost === "number" ? t.cost + 50 : 0),
        }));
        setTires(normalized);
      })
      .catch((err) => {
        console.error("[POS] Error fetching tires:", err);
        setTires([]);
      })
      .finally(() => setLoadingTires(false));
  }, [state.vehicle, state.wheel]);
  
  // Sort by price (low to high)
  const sortedWheels = [...wheels].sort((a, b) => a.price - b.price);
  const sortedTires = [...tires].sort((a, b) => a.price - b.price);
  
  const handleSelectWheel = (wheel: WheelOption) => {
    const posWheel: POSWheel = {
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
      quantity: 4,
      fitmentClass: wheel.fitmentClass as "extended" | "surefit" | "specfit" | undefined,
    };
    setWheel(posWheel);
    // Phase automatically switches to tires via useEffect
  };
  
  const handleSelectTire = (tire: TireOption) => {
    const posTire: POSTire = {
      sku: tire.sku,
      brand: tire.brand,
      model: tire.model,
      size: tire.size,
      imageUrl: tire.imageUrl,
      unitPrice: tire.price,
      setPrice: tire.price * 4,
      quantity: 4,
    };
    setTire(posTire);
    // Auto-advance to pricing
    goToStep("pricing");
  };
  
  if (!state.vehicle) {
    return (
      <div className="text-center py-12 text-neutral-400">
        Please select a vehicle first.
      </div>
    );
  }
  
  if (loadingWheels) {
    return (
      <div className="text-center py-12 text-neutral-400">
        <div className="inline-flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading wheels for {state.vehicle.year} {state.vehicle.make} {state.vehicle.model}...
        </div>
      </div>
    );
  }
  
  if (wheels.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-400">
        No wheels found for this vehicle.
      </div>
    );
  }
  
  // ============================================================================
  // PHASE 1: Wheel Selection - Uniform Grid
  // ============================================================================
  if (phase === "wheels" && !state.wheel) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white">Step 1: Select Wheels</h2>
          <p className="text-neutral-400 mt-1">
            {wheels.length} wheels available • Sorted by price
          </p>
        </div>
        
        {/* Uniform Wheel Grid */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {sortedWheels.map((wheel) => (
            <button
              key={wheel.sku}
              onClick={() => handleSelectWheel(wheel)}
              className="p-4 rounded-xl border-2 border-neutral-700 bg-neutral-900 hover:border-blue-500 hover:bg-neutral-800 text-center transition-all group"
            >
              {/* Wheel Image */}
              <div className="flex justify-center mb-3">
                {wheel.imageUrl ? (
                  <img 
                    src={wheel.imageUrl} 
                    alt={wheel.model} 
                    className="h-24 w-24 object-contain group-hover:scale-105 transition-transform" 
                  />
                ) : (
                  <div className="h-24 w-24 bg-neutral-800 rounded-full flex items-center justify-center text-3xl">🛞</div>
                )}
              </div>
              
              {/* Wheel Info */}
              <div className="text-sm font-medium text-neutral-400">{wheel.brand}</div>
              <div className="text-sm font-bold text-white truncate" title={wheel.model}>{wheel.model}</div>
              <div className="text-xs text-neutral-500 mt-1">
                {wheel.diameter}" × {wheel.width}"
              </div>
              <div className="text-lg font-black text-green-400 mt-2">
                ${(wheel.price * 4).toLocaleString()}
              </div>
              <div className="text-xs text-neutral-500">set of 4</div>
            </button>
          ))}
        </div>
      </div>
    );
  }
  
  // ============================================================================
  // PHASE 2: Tire Selection (after wheel selected)
  // ============================================================================
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Selected Wheel Summary */}
      {state.wheel && (
        <div className="mb-6 p-4 rounded-xl bg-green-900/30 border border-green-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {state.wheel.imageUrl && (
                <img src={state.wheel.imageUrl} alt={state.wheel.model} className="h-16 w-16 object-contain" />
              )}
              <div>
                <div className="text-xs text-green-400 font-medium">✓ WHEELS SELECTED</div>
                <div className="text-white font-bold">{state.wheel.brand} {state.wheel.model}</div>
                <div className="text-sm text-neutral-400">{state.wheel.diameter}" × {state.wheel.width}"</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-white">${state.wheel.setPrice.toLocaleString()}</div>
              <button 
                onClick={() => { setWheel(null as unknown as POSWheel); setPhase("wheels"); }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Change
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">Step 2: Select Tires</h2>
        <p className="text-neutral-400 mt-1">
          {tires.length} tires for {state.wheel?.diameter}" wheels • Sorted by price
        </p>
      </div>
      
      {loadingTires ? (
        <div className="text-center py-12 text-neutral-400">
          <div className="inline-flex items-center gap-3">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Finding matching tires...
          </div>
        </div>
      ) : tires.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          No matching tires found. Try selecting different wheels.
        </div>
      ) : (
        /* Uniform Tire Grid */
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {sortedTires.map((tire) => (
            <button
              key={tire.sku}
              onClick={() => handleSelectTire(tire)}
              className="p-4 rounded-xl border-2 border-neutral-700 bg-neutral-900 hover:border-blue-500 hover:bg-neutral-800 text-center transition-all group"
            >
              {/* Tire Image */}
              <div className="flex justify-center mb-3">
                {tire.imageUrl ? (
                  <img 
                    src={tire.imageUrl} 
                    alt={tire.model} 
                    className="h-24 w-24 object-contain group-hover:scale-105 transition-transform" 
                  />
                ) : (
                  <div className="h-24 w-24 bg-neutral-800 rounded-full flex items-center justify-center text-3xl">🛞</div>
                )}
              </div>
              
              {/* Tire Info */}
              <div className="text-sm font-medium text-neutral-400">{tire.brand}</div>
              <div className="text-sm font-bold text-white truncate" title={tire.model}>{tire.model}</div>
              <div className="text-xs text-neutral-500 mt-1">{tire.size}</div>
              <div className="text-lg font-black text-green-400 mt-2">
                ${(tire.price * 4).toLocaleString()}
              </div>
              <div className="text-xs text-neutral-500">set of 4</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
