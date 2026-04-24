"use client";

import { useState, useEffect, useMemo } from "react";
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
// Detail Modal Component
// ============================================================================

function WheelDetailModal({ 
  wheel, 
  onClose, 
  onSelect 
}: { 
  wheel: WheelOption; 
  onClose: () => void; 
  onSelect: (w: WheelOption) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-bold text-gray-900">{wheel.brand} {wheel.model}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        
        {/* Content */}
        <div className="p-6 flex gap-6">
          {/* Image */}
          <div className="flex-shrink-0">
            {wheel.imageUrl ? (
              <img src={wheel.imageUrl} alt={wheel.model} className="w-64 h-64 object-contain" />
            ) : (
              <div className="w-64 h-64 bg-gray-100 rounded-xl flex items-center justify-center text-6xl">🛞</div>
            )}
          </div>
          
          {/* Details */}
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-gray-500 text-xs uppercase">Size</div>
                <div className="font-bold text-gray-900">{wheel.diameter}" × {wheel.width}"</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-gray-500 text-xs uppercase">Offset</div>
                <div className="font-bold text-gray-900">{wheel.offset || "N/A"}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-gray-500 text-xs uppercase">Bolt Pattern</div>
                <div className="font-bold text-gray-900">{wheel.boltPattern || "N/A"}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-gray-500 text-xs uppercase">Finish</div>
                <div className="font-bold text-gray-900">{wheel.finish || "Standard"}</div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs uppercase">SKU</div>
              <div className="font-mono text-gray-900">{wheel.sku}</div>
            </div>
            
            {/* Price */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-500">Set of 4</div>
                  <div className="text-3xl font-black text-green-600">${(wheel.price * 4).toLocaleString()}</div>
                  <div className="text-sm text-gray-400">${wheel.price.toLocaleString()} each</div>
                </div>
                <button
                  onClick={() => onSelect(wheel)}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Select This Wheel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TireDetailModal({ 
  tire, 
  onClose, 
  onSelect 
}: { 
  tire: TireOption; 
  onClose: () => void; 
  onSelect: (t: TireOption) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-bold text-gray-900">{tire.brand} {tire.model}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        
        {/* Content */}
        <div className="p-6 flex gap-6">
          {/* Image */}
          <div className="flex-shrink-0">
            {tire.imageUrl ? (
              <img src={tire.imageUrl} alt={tire.model} className="w-64 h-64 object-contain" />
            ) : (
              <div className="w-64 h-64 bg-gray-100 rounded-xl flex items-center justify-center text-6xl">🛞</div>
            )}
          </div>
          
          {/* Details */}
          <div className="flex-1 space-y-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs uppercase">Size</div>
              <div className="font-bold text-gray-900 text-lg">{tire.size}</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500 text-xs uppercase">SKU</div>
              <div className="font-mono text-gray-900">{tire.sku}</div>
            </div>
            
            {/* Price */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-500">Set of 4</div>
                  <div className="text-3xl font-black text-green-600">${(tire.price * 4).toLocaleString()}</div>
                  <div className="text-sm text-gray-400">${tire.price.toLocaleString()} each</div>
                </div>
                <button
                  onClick={() => onSelect(tire)}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Select This Tire
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Filter Bar Component
// ============================================================================

interface WheelFilters {
  brand: string;
  diameter: string;
  priceRange: string;
  finish: string;
}

interface TireFilters {
  brand: string;
  size: string;
  priceRange: string;
}

function WheelFilterBar({
  wheels,
  filters,
  setFilters,
}: {
  wheels: WheelOption[];
  filters: WheelFilters;
  setFilters: (f: WheelFilters) => void;
}) {
  // Extract unique values
  const brands = [...new Set(wheels.map(w => w.brand))].sort();
  const diameters = [...new Set(wheels.map(w => w.diameter))].sort((a, b) => Number(a) - Number(b));
  const finishes = [...new Set(wheels.map(w => w.finish).filter(Boolean))].sort();
  
  const selectClass = "px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  
  return (
    <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-100 rounded-xl">
      <select
        value={filters.brand}
        onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
        className={selectClass}
      >
        <option value="">All Brands</option>
        {brands.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      
      <select
        value={filters.diameter}
        onChange={(e) => setFilters({ ...filters, diameter: e.target.value })}
        className={selectClass}
      >
        <option value="">All Sizes</option>
        {diameters.map(d => <option key={d} value={d}>{d}"</option>)}
      </select>
      
      <select
        value={filters.finish}
        onChange={(e) => setFilters({ ...filters, finish: e.target.value })}
        className={selectClass}
      >
        <option value="">All Finishes</option>
        {finishes.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      
      <select
        value={filters.priceRange}
        onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
        className={selectClass}
      >
        <option value="">Any Price</option>
        <option value="0-1500">Under $1,500</option>
        <option value="1500-2000">$1,500 - $2,000</option>
        <option value="2000-2500">$2,000 - $2,500</option>
        <option value="2500+">$2,500+</option>
      </select>
      
      {(filters.brand || filters.diameter || filters.finish || filters.priceRange) && (
        <button
          onClick={() => setFilters({ brand: "", diameter: "", priceRange: "", finish: "" })}
          className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}

function TireFilterBar({
  tires,
  filters,
  setFilters,
}: {
  tires: TireOption[];
  filters: TireFilters;
  setFilters: (f: TireFilters) => void;
}) {
  const brands = [...new Set(tires.map(t => t.brand))].sort();
  const sizes = [...new Set(tires.map(t => t.size))].sort();
  
  const selectClass = "px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  
  return (
    <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-100 rounded-xl">
      <select
        value={filters.brand}
        onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
        className={selectClass}
      >
        <option value="">All Brands</option>
        {brands.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      
      <select
        value={filters.size}
        onChange={(e) => setFilters({ ...filters, size: e.target.value })}
        className={selectClass}
      >
        <option value="">All Sizes</option>
        {sizes.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      
      <select
        value={filters.priceRange}
        onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
        className={selectClass}
      >
        <option value="">Any Price</option>
        <option value="0-500">Under $500</option>
        <option value="500-750">$500 - $750</option>
        <option value="750-1000">$750 - $1,000</option>
        <option value="1000+">$1,000+</option>
      </select>
      
      {(filters.brand || filters.size || filters.priceRange) && (
        <button
          onClick={() => setFilters({ brand: "", size: "", priceRange: "" })}
          className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}

// ============================================================================
// POS Package Step - Main Component
// ============================================================================

export function POSPackageStep() {
  const { state, setWheel, setTire, goToStep } = usePOS();
  
  const [wheels, setWheels] = useState<WheelOption[]>([]);
  const [tires, setTires] = useState<TireOption[]>([]);
  const [loadingWheels, setLoadingWheels] = useState(true);
  const [loadingTires, setLoadingTires] = useState(false);
  
  // Phase: "wheels" or "tires"
  const [phase, setPhase] = useState<"wheels" | "tires">("wheels");
  
  // Detail modal
  const [selectedWheelDetail, setSelectedWheelDetail] = useState<WheelOption | null>(null);
  const [selectedTireDetail, setSelectedTireDetail] = useState<TireOption | null>(null);
  
  // Filters
  const [wheelFilters, setWheelFilters] = useState<WheelFilters>({ brand: "", diameter: "", priceRange: "", finish: "" });
  const [tireFilters, setTireFilters] = useState<TireFilters>({ brand: "", size: "", priceRange: "" });
  
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
  
  // Filter and sort wheels
  const filteredWheels = useMemo(() => {
    let result = [...wheels];
    
    if (wheelFilters.brand) {
      result = result.filter(w => w.brand === wheelFilters.brand);
    }
    if (wheelFilters.diameter) {
      result = result.filter(w => w.diameter === wheelFilters.diameter);
    }
    if (wheelFilters.finish) {
      result = result.filter(w => w.finish === wheelFilters.finish);
    }
    if (wheelFilters.priceRange) {
      const setPrice = (w: WheelOption) => w.price * 4;
      if (wheelFilters.priceRange === "0-1500") {
        result = result.filter(w => setPrice(w) < 1500);
      } else if (wheelFilters.priceRange === "1500-2000") {
        result = result.filter(w => setPrice(w) >= 1500 && setPrice(w) < 2000);
      } else if (wheelFilters.priceRange === "2000-2500") {
        result = result.filter(w => setPrice(w) >= 2000 && setPrice(w) < 2500);
      } else if (wheelFilters.priceRange === "2500+") {
        result = result.filter(w => setPrice(w) >= 2500);
      }
    }
    
    return result.sort((a, b) => a.price - b.price);
  }, [wheels, wheelFilters]);
  
  // Filter and sort tires
  const filteredTires = useMemo(() => {
    let result = [...tires];
    
    if (tireFilters.brand) {
      result = result.filter(t => t.brand === tireFilters.brand);
    }
    if (tireFilters.size) {
      result = result.filter(t => t.size === tireFilters.size);
    }
    if (tireFilters.priceRange) {
      const setPrice = (t: TireOption) => t.price * 4;
      if (tireFilters.priceRange === "0-500") {
        result = result.filter(t => setPrice(t) < 500);
      } else if (tireFilters.priceRange === "500-750") {
        result = result.filter(t => setPrice(t) >= 500 && setPrice(t) < 750);
      } else if (tireFilters.priceRange === "750-1000") {
        result = result.filter(t => setPrice(t) >= 750 && setPrice(t) < 1000);
      } else if (tireFilters.priceRange === "1000+") {
        result = result.filter(t => setPrice(t) >= 1000);
      }
    }
    
    return result.sort((a, b) => a.price - b.price);
  }, [tires, tireFilters]);
  
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
    setSelectedWheelDetail(null);
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
    setSelectedTireDetail(null);
    goToStep("pricing");
  };
  
  if (!state.vehicle) {
    return (
      <div className="text-center py-12 text-gray-500">
        Please select a vehicle first.
      </div>
    );
  }
  
  if (loadingWheels) {
    return (
      <div className="text-center py-12 text-gray-500">
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
      <div className="text-center py-12 text-gray-500">
        No wheels found for this vehicle.
      </div>
    );
  }
  
  // ============================================================================
  // PHASE 1: Wheel Selection
  // ============================================================================
  if (phase === "wheels" && !state.wheel) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 bg-white min-h-screen">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Step 1: Select Wheels</h2>
          <p className="text-gray-500 mt-1">
            {filteredWheels.length} of {wheels.length} wheels • Sorted by price
          </p>
        </div>
        
        <WheelFilterBar wheels={wheels} filters={wheelFilters} setFilters={setWheelFilters} />
        
        {/* Wheel Grid */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredWheels.map((wheel) => (
            <div
              key={wheel.sku}
              onClick={() => setSelectedWheelDetail(wheel)}
              className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-500 hover:shadow-lg text-center transition-all cursor-pointer group"
            >
              {/* Wheel Image */}
              <div className="flex justify-center mb-3">
                {wheel.imageUrl ? (
                  <img 
                    src={wheel.imageUrl} 
                    alt={wheel.model} 
                    className="h-28 w-28 object-contain group-hover:scale-105 transition-transform" 
                  />
                ) : (
                  <div className="h-28 w-28 bg-gray-100 rounded-full flex items-center justify-center text-4xl">🛞</div>
                )}
              </div>
              
              {/* Wheel Info */}
              <div className="text-sm font-medium text-gray-500">{wheel.brand}</div>
              <div className="text-sm font-bold text-gray-900 truncate" title={wheel.model}>{wheel.model}</div>
              <div className="text-xs text-gray-400 mt-1">
                {wheel.diameter}" × {wheel.width}"
              </div>
              {wheel.finish && <div className="text-xs text-gray-400">{wheel.finish}</div>}
              <div className="text-lg font-black text-green-600 mt-2">
                ${(wheel.price * 4).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">set of 4</div>
            </div>
          ))}
        </div>
        
        {filteredWheels.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No wheels match your filters. Try adjusting them.
          </div>
        )}
        
        {/* Detail Modal */}
        {selectedWheelDetail && (
          <WheelDetailModal
            wheel={selectedWheelDetail}
            onClose={() => setSelectedWheelDetail(null)}
            onSelect={handleSelectWheel}
          />
        )}
      </div>
    );
  }
  
  // ============================================================================
  // PHASE 2: Tire Selection
  // ============================================================================
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 bg-white min-h-screen">
      {/* Selected Wheel Summary */}
      {state.wheel && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {state.wheel.imageUrl && (
                <img src={state.wheel.imageUrl} alt={state.wheel.model} className="h-16 w-16 object-contain" />
              )}
              <div>
                <div className="text-xs text-green-600 font-medium">✓ WHEELS SELECTED</div>
                <div className="text-gray-900 font-bold">{state.wheel.brand} {state.wheel.model}</div>
                <div className="text-sm text-gray-500">{state.wheel.diameter}" × {state.wheel.width}"</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-900">${state.wheel.setPrice.toLocaleString()}</div>
              <button 
                onClick={() => { setWheel(null as unknown as POSWheel); setPhase("wheels"); }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Change
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Step 2: Select Tires</h2>
        <p className="text-gray-500 mt-1">
          {filteredTires.length} of {tires.length} tires for {state.wheel?.diameter}" wheels
        </p>
      </div>
      
      {loadingTires ? (
        <div className="text-center py-12 text-gray-500">
          <div className="inline-flex items-center gap-3">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Finding matching tires...
          </div>
        </div>
      ) : tires.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No matching tires found. Try selecting different wheels.
        </div>
      ) : (
        <>
          <TireFilterBar tires={tires} filters={tireFilters} setFilters={setTireFilters} />
          
          {/* Tire Grid */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredTires.map((tire) => (
              <div
                key={tire.sku}
                onClick={() => setSelectedTireDetail(tire)}
                className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-500 hover:shadow-lg text-center transition-all cursor-pointer group"
              >
                {/* Tire Image */}
                <div className="flex justify-center mb-3">
                  {tire.imageUrl ? (
                    <img 
                      src={tire.imageUrl} 
                      alt={tire.model} 
                      className="h-28 w-28 object-contain group-hover:scale-105 transition-transform" 
                    />
                  ) : (
                    <div className="h-28 w-28 bg-gray-100 rounded-full flex items-center justify-center text-4xl">🛞</div>
                  )}
                </div>
                
                {/* Tire Info */}
                <div className="text-sm font-medium text-gray-500">{tire.brand}</div>
                <div className="text-sm font-bold text-gray-900 truncate" title={tire.model}>{tire.model}</div>
                <div className="text-xs text-gray-400 mt-1">{tire.size}</div>
                <div className="text-lg font-black text-green-600 mt-2">
                  ${(tire.price * 4).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">set of 4</div>
              </div>
            ))}
          </div>
          
          {filteredTires.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No tires match your filters. Try adjusting them.
            </div>
          )}
        </>
      )}
      
      {/* Detail Modal */}
      {selectedTireDetail && (
        <TireDetailModal
          tire={selectedTireDetail}
          onClose={() => setSelectedTireDetail(null)}
          onSelect={handleSelectTire}
        />
      )}
    </div>
  );
}
