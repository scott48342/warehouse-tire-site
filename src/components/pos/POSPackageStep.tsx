"use client";

import { useState, useEffect } from "react";
import { usePOS, type POSWheel, type POSTire } from "./POSContext";

// ============================================================================
// Types
// ============================================================================

type Tier = "good" | "better" | "best";

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
// Tier Config
// ============================================================================

const TIER_CONFIG: Record<Tier, { label: string; description: string; color: string; bgColor: string }> = {
  good: {
    label: "Good",
    description: "Budget-friendly, reliable choice",
    color: "text-green-400",
    bgColor: "bg-green-600",
  },
  better: {
    label: "Better",
    description: "Best value for most customers",
    color: "text-blue-400",
    bgColor: "bg-blue-600",
  },
  best: {
    label: "Best",
    description: "Premium quality, top performance",
    color: "text-amber-400",
    bgColor: "bg-amber-600",
  },
};

// ============================================================================
// POS Package Step
// ============================================================================

export function POSPackageStep() {
  const { state, setWheel, setTire, goToStep } = usePOS();
  
  const [wheels, setWheels] = useState<WheelOption[]>([]);
  const [tires, setTires] = useState<TireOption[]>([]);
  const [loadingWheels, setLoadingWheels] = useState(true);
  const [loadingTires, setLoadingTires] = useState(false);
  
  const [selectedTier, setSelectedTier] = useState<Tier | "custom">("better");
  const [showCustom, setShowCustom] = useState(false);
  
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
        // Normalize wheel data
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
  
  // Sort wheels by price for Good/Better/Best
  const sortedWheels = [...wheels].sort((a, b) => a.price - b.price);
  const goodWheel = sortedWheels[0];
  const betterWheel = sortedWheels[Math.floor(sortedWheels.length / 2)];
  const bestWheel = sortedWheels[sortedWheels.length - 1];
  
  // Sort tires by price for Good/Better/Best
  const sortedTires = [...tires].sort((a, b) => a.price - b.price);
  const goodTire = sortedTires[0];
  const betterTire = sortedTires[Math.floor(sortedTires.length / 2)];
  const bestTire = sortedTires[sortedTires.length - 1];
  
  const tierWheels: Record<Tier, WheelOption | undefined> = {
    good: goodWheel,
    better: betterWheel,
    best: bestWheel,
  };
  
  const tierTires: Record<Tier, TireOption | undefined> = {
    good: goodTire,
    better: betterTire,
    best: bestTire,
  };
  
  const handleSelectTier = (tier: Tier) => {
    setSelectedTier(tier);
    const wheel = tierWheels[tier];
    const tire = tierTires[tier];
    
    if (wheel) {
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
        fitmentClass: wheel.fitmentClass,
        tier,
      };
      setWheel(posWheel);
    }
    
    if (tire) {
      const posTire: POSTire = {
        sku: tire.sku,
        brand: tire.brand,
        model: tire.model,
        size: tire.size,
        imageUrl: tire.imageUrl,
        unitPrice: tire.price,
        setPrice: tire.price * 4,
        quantity: 4,
        tier,
      };
      setTire(posTire);
    }
  };
  
  const handleContinue = () => {
    if (state.wheel && state.tire) {
      goToStep("pricing");
    }
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
          Loading packages for {state.vehicle.year} {state.vehicle.make} {state.vehicle.model}...
        </div>
      </div>
    );
  }
  
  if (wheels.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-400">
        No wheels found for this vehicle. Try a different configuration.
      </div>
    );
  }
  
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white">Select a Package</h2>
        <p className="text-neutral-400 mt-2">
          Choose Good, Better, or Best — or customize
        </p>
      </div>
      
      {/* Tier Cards */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {(["good", "better", "best"] as Tier[]).map((tier) => {
          const config = TIER_CONFIG[tier];
          const wheel = tierWheels[tier];
          const tire = tierTires[tier];
          const isSelected = selectedTier === tier;
          const totalPrice = ((wheel?.price || 0) + (tire?.price || 0)) * 4;
          
          return (
            <button
              key={tier}
              onClick={() => handleSelectTier(tier)}
              disabled={!wheel}
              className={`
                relative rounded-2xl border-2 p-6 text-left transition-all
                ${isSelected
                  ? `border-${tier === "good" ? "green" : tier === "better" ? "blue" : "amber"}-500 bg-neutral-800/80`
                  : "border-neutral-700 bg-neutral-900 hover:border-neutral-600"
                }
                ${!wheel ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {/* Badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.bgColor} text-white text-sm font-bold mb-4`}>
                {tier === "better" && "⭐ "}
                {config.label}
              </div>
              
              {/* Wheel */}
              {wheel && (
                <div className="mb-4">
                  <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Wheels (×4)</div>
                  <div className="flex items-center gap-3">
                    {wheel.imageUrl && (
                      <img src={wheel.imageUrl} alt={wheel.model} className="h-16 w-16 rounded-lg object-contain bg-neutral-800" />
                    )}
                    <div>
                      <div className="font-semibold text-white">{wheel.brand}</div>
                      <div className="text-sm text-neutral-400">{wheel.model}</div>
                      <div className="text-sm text-neutral-500">{wheel.diameter}" × {wheel.width}"</div>
                    </div>
                  </div>
                  <div className="text-right text-lg font-bold text-white mt-2">
                    ${(wheel.price * 4).toLocaleString()}
                  </div>
                </div>
              )}
              
              {/* Tire */}
              {tire && (
                <div className="border-t border-neutral-700 pt-4">
                  <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Tires (×4)</div>
                  <div className="flex items-center gap-3">
                    {tire.imageUrl && (
                      <img src={tire.imageUrl} alt={tire.model} className="h-16 w-16 rounded-lg object-contain bg-neutral-800" />
                    )}
                    <div>
                      <div className="font-semibold text-white">{tire.brand}</div>
                      <div className="text-sm text-neutral-400">{tire.model}</div>
                      <div className="text-sm text-neutral-500">{tire.size}</div>
                    </div>
                  </div>
                  <div className="text-right text-lg font-bold text-white mt-2">
                    ${(tire.price * 4).toLocaleString()}
                  </div>
                </div>
              )}
              
              {/* Package Total */}
              <div className="mt-4 pt-4 border-t border-neutral-700">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Package Total</span>
                  <span className={`text-2xl font-black ${config.color}`}>
                    ${totalPrice.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 text-right">
                  Parts only • Labor & tax extra
                </div>
              </div>
              
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-white text-sm">✓</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Custom Selection Toggle */}
      <div className="text-center mb-6">
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium"
        >
          {showCustom ? "Hide custom options ↑" : "Or choose custom wheels & tires ↓"}
        </button>
      </div>
      
      {/* Custom Selection (expandable) */}
      {showCustom && (
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 mb-8">
          <h3 className="text-lg font-bold text-white mb-4">Custom Selection</h3>
          
          {/* Wheel Grid */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-neutral-400 mb-3">Wheels ({wheels.length} options)</h4>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 max-h-64 overflow-y-auto">
              {sortedWheels.slice(0, 20).map((wheel) => (
                <button
                  key={wheel.sku}
                  onClick={() => {
                    setSelectedTier("custom");
                    setWheel({
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
                      fitmentClass: wheel.fitmentClass,
                    });
                  }}
                  className={`
                    p-3 rounded-xl border text-left transition-all
                    ${state.wheel?.sku === wheel.sku
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-neutral-700 bg-neutral-800 hover:border-neutral-600"
                    }
                  `}
                >
                  {wheel.imageUrl && (
                    <img src={wheel.imageUrl} alt={wheel.model} className="h-12 w-12 mx-auto mb-2 object-contain" />
                  )}
                  <div className="text-xs font-medium text-white truncate">{wheel.brand}</div>
                  <div className="text-xs text-neutral-400 truncate">{wheel.model}</div>
                  <div className="text-sm font-bold text-green-400 mt-1">${(wheel.price * 4).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Tire Grid */}
          {state.wheel && (
            <div>
              <h4 className="text-sm font-semibold text-neutral-400 mb-3">
                Tires ({loadingTires ? "Loading..." : `${tires.length} options`})
              </h4>
              {loadingTires ? (
                <div className="text-neutral-500 text-sm">Loading matching tires...</div>
              ) : (
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4 max-h-64 overflow-y-auto">
                  {sortedTires.slice(0, 20).map((tire) => (
                    <button
                      key={tire.sku}
                      onClick={() => {
                        setSelectedTier("custom");
                        setTire({
                          sku: tire.sku,
                          brand: tire.brand,
                          model: tire.model,
                          size: tire.size,
                          imageUrl: tire.imageUrl,
                          unitPrice: tire.price,
                          setPrice: tire.price * 4,
                          quantity: 4,
                        });
                      }}
                      className={`
                        p-3 rounded-xl border text-left transition-all
                        ${state.tire?.sku === tire.sku
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-neutral-700 bg-neutral-800 hover:border-neutral-600"
                        }
                      `}
                    >
                      {tire.imageUrl && (
                        <img src={tire.imageUrl} alt={tire.model} className="h-12 w-12 mx-auto mb-2 object-contain" />
                      )}
                      <div className="text-xs font-medium text-white truncate">{tire.brand}</div>
                      <div className="text-xs text-neutral-400 truncate">{tire.model}</div>
                      <div className="text-xs text-neutral-500">{tire.size}</div>
                      <div className="text-sm font-bold text-green-400 mt-1">${(tire.price * 4).toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Selection Summary & Continue */}
      {state.wheel && state.tire && (
        <div className="bg-neutral-800 rounded-2xl border border-neutral-700 p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-neutral-400">Selected Package</div>
              <div className="text-white font-semibold">
                {state.wheel.brand} {state.wheel.model} + {state.tire.brand} {state.tire.model}
              </div>
              <div className="text-2xl font-black text-green-400">
                ${(state.wheel.setPrice + state.tire.setPrice).toLocaleString()} parts
              </div>
            </div>
            
            <button
              onClick={handleContinue}
              className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-colors"
            >
              Continue to Pricing →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
