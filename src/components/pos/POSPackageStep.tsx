"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePOS, type POSWheel, type POSTire, type StaggeredFitmentInfo } from "./POSContext";

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

/** Staggered wheel pair - front and rear wheels for staggered vehicles */
interface StaggeredWheelPair {
  styleKey: string;
  brand: string;
  model: string;
  finish?: string;
  front: WheelOption;
  rear: WheelOption;
  totalPrice: number; // 2×front + 2×rear
}

interface TireOption {
  sku: string;
  brand: string;
  model: string;
  size: string;
  imageUrl?: string;
  price: number;
}

/** Staggered tire pair - front and rear tires for staggered vehicles */
interface StaggeredTirePair {
  id: string;
  brand: string;
  model: string;
  front: TireOption;
  rear: TireOption;
  totalPrice: number; // 2×front + 2×rear
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
  const router = useRouter();
  const { state, setWheel, setTire, setStaggeredInfo, goToStep } = usePOS();
  
  // Redirect to /pos/wheels for consistent UI (sidebar filters, larger cards)
  // This applies to cars that skip the build step
  useEffect(() => {
    if (state.vehicle && !state.wheel) {
      const params = new URLSearchParams({
        year: state.vehicle.year,
        make: state.vehicle.make,
        model: state.vehicle.model,
      });
      // 2026-05-04: Pass modificationId for canonical fitment identity
      if (state.vehicle.modificationId) params.set("modification", state.vehicle.modificationId);
      if (state.vehicle.trim) params.set("trim", state.vehicle.trim);
      router.replace(`/pos/wheels?${params.toString()}`);
    }
  }, [state.vehicle, state.wheel, router]);
  
  const [wheels, setWheels] = useState<WheelOption[]>([]);
  const [staggeredPairs, setStaggeredPairs] = useState<StaggeredWheelPair[]>([]);
  const [tires, setTires] = useState<TireOption[]>([]);
  const [staggeredTirePairs, setStaggeredTirePairs] = useState<StaggeredTirePair[]>([]);
  const [loadingWheels, setLoadingWheels] = useState(true);
  const [loadingTires, setLoadingTires] = useState(false);
  
  // Phase: "wheels" or "tires"
  const [phase, setPhase] = useState<"wheels" | "tires">("wheels");
  
  // Detail modal
  const [selectedWheelDetail, setSelectedWheelDetail] = useState<WheelOption | null>(null);
  const [selectedPairDetail, setSelectedPairDetail] = useState<StaggeredWheelPair | null>(null);
  const [selectedTireDetail, setSelectedTireDetail] = useState<TireOption | null>(null);
  const [selectedTirePairDetail, setSelectedTirePairDetail] = useState<StaggeredTirePair | null>(null);
  
  // Filters
  const [wheelFilters, setWheelFilters] = useState<WheelFilters>({ brand: "", diameter: "", priceRange: "", finish: "" });
  
  // Check if vehicle is staggered
  const isStaggered = state.staggeredInfo?.isStaggered ?? false;
  const [tireFilters, setTireFilters] = useState<TireFilters>({ brand: "", size: "", priceRange: "" });
  
  // Fetch wheels when vehicle is set
  useEffect(() => {
    if (!state.vehicle) return;
    
    setLoadingWheels(true);
    const params = new URLSearchParams({
      year: state.vehicle.year,
      make: state.vehicle.make,
      model: state.vehicle.model,
      pageSize: "200", // Get more wheels for POS
    });
    // 2026-05-04: Pass modificationId for canonical fitment identity (not just trim label)
    if (state.vehicle.modificationId) params.set("modification", state.vehicle.modificationId);
    if (state.vehicle.trim) params.set("trim", state.vehicle.trim);
    
    fetch(`/api/wheels/fitment-search?${params}`)
      .then((res) => res.json())
      .then((data) => {
        // Store staggered info from API
        const staggeredInfo: StaggeredFitmentInfo | null = data.fitment?.staggered || null;
        if (staggeredInfo) {
          setStaggeredInfo(staggeredInfo);
        }
        
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
        
        // Build staggered pairs if vehicle is staggered
        if (staggeredInfo?.isStaggered) {
          const apiPairs = data.staggeredPairs as Array<{ styleKey: string; frontSku: string; rearSku: string }> | undefined;
          if (apiPairs && apiPairs.length > 0) {
            // Map SKUs to wheel options
            const wheelBySku = new Map<string, WheelOption>();
            normalized.forEach(w => wheelBySku.set(w.sku, w));
            
            const pairs: StaggeredWheelPair[] = [];
            for (const pair of apiPairs) {
              const front = wheelBySku.get(pair.frontSku);
              const rear = wheelBySku.get(pair.rearSku);
              if (front && rear) {
                pairs.push({
                  styleKey: pair.styleKey,
                  brand: front.brand,
                  model: front.model,
                  finish: front.finish,
                  front,
                  rear,
                  totalPrice: (front.price * 2) + (rear.price * 2),
                });
              }
            }
            setStaggeredPairs(pairs);
            console.log(`[POS] Built ${pairs.length} staggered pairs from API`);
          }
        }
      })
      .catch((err) => {
        console.error("[POS] Error fetching wheels:", err);
        setWheels([]);
        setStaggeredPairs([]);
      })
      .finally(() => setLoadingWheels(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.vehicle]); // setStaggeredInfo intentionally omitted - it's stable via dispatch
  
  // Fetch tires when wheel is selected
  useEffect(() => {
    if (!state.vehicle || !state.wheel) {
      setTires([]);
      setStaggeredTirePairs([]);
      return;
    }
    
    setLoadingTires(true);
    setPhase("tires");
    
    // For staggered vehicles, fetch both front and rear tires
    if (state.wheel.staggered && state.wheel.rearDiameter && state.wheel.rearWidth) {
      const frontParams = new URLSearchParams({
        year: state.vehicle.year,
        make: state.vehicle.make,
        model: state.vehicle.model,
        wheelDiameter: state.wheel.diameter,
      });
      const rearParams = new URLSearchParams({
        year: state.vehicle.year,
        make: state.vehicle.make,
        model: state.vehicle.model,
        wheelDiameter: state.wheel.rearDiameter,
        rearWheelDiameter: state.wheel.rearDiameter, // Signal this is rear
      });
      // 2026-05-04: Pass modificationId for canonical fitment identity
      if (state.vehicle.modificationId) {
        frontParams.set("modification", state.vehicle.modificationId);
        rearParams.set("modification", state.vehicle.modificationId);
      }
      if (state.vehicle.trim) {
        frontParams.set("trim", state.vehicle.trim);
        rearParams.set("trim", state.vehicle.trim);
      }
      
      // Fetch front and rear tires in parallel
      Promise.all([
        fetch(`/api/tires/search?${frontParams}`).then(r => r.json()),
        fetch(`/api/tires/search?${rearParams}`).then(r => r.json()),
      ])
        .then(([frontData, rearData]) => {
          const normalizeTires = (data: any): TireOption[] => {
            const results = data.results || data.tires || [];
            return results.map((t: Record<string, unknown>) => ({
              sku: (t.partNumber || t.sku || "") as string,
              brand: (t.brand || "Unknown") as string,
              model: (t.displayName || t.prettyName || t.description || t.model || "") as string,
              size: (t.size || "") as string,
              imageUrl: (t.imageUrl as string) || undefined,
              price: typeof t.price === "number" ? t.price : (typeof t.cost === "number" ? t.cost + 50 : 0),
            }));
          };
          
          const frontTires = normalizeTires(frontData);
          const rearTires = normalizeTires(rearData);
          
          // Build tire pairs - match by brand+model
          const pairs: StaggeredTirePair[] = [];
          const usedRearSkus = new Set<string>();
          
          for (const front of frontTires) {
            // Find matching rear tire (same brand, same or similar model)
            const matchingRear = rearTires.find(r => 
              r.brand === front.brand && 
              r.model === front.model &&
              !usedRearSkus.has(r.sku)
            );
            
            if (matchingRear) {
              usedRearSkus.add(matchingRear.sku);
              pairs.push({
                id: `${front.sku}:${matchingRear.sku}`,
                brand: front.brand,
                model: front.model,
                front,
                rear: matchingRear,
                totalPrice: (front.price * 2) + (matchingRear.price * 2),
              });
            }
          }
          
          setStaggeredTirePairs(pairs.sort((a, b) => a.totalPrice - b.totalPrice));
          setTires([]); // Clear single tires when showing pairs
          console.log(`[POS] Built ${pairs.length} staggered tire pairs (${frontTires.length} front, ${rearTires.length} rear)`);
        })
        .catch((err) => {
          console.error("[POS] Error fetching staggered tires:", err);
          setStaggeredTirePairs([]);
        })
        .finally(() => setLoadingTires(false));
      
      return;
    }
    
    // Square fitment - single tire search
    const params = new URLSearchParams({
      year: state.vehicle.year,
      make: state.vehicle.make,
      model: state.vehicle.model,
      wheelDiameter: state.wheel.diameter,
    });
    // 2026-05-04: Pass modificationId for canonical fitment identity
    if (state.vehicle.modificationId) params.set("modification", state.vehicle.modificationId);
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
        setStaggeredTirePairs([]); // Clear pairs for square fitment
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
      staggered: false,
    };
    setWheel(posWheel);
    setSelectedWheelDetail(null);
  };
  
  /** Handle staggered wheel pair selection */
  const handleSelectStaggeredPair = (pair: StaggeredWheelPair) => {
    const posWheel: POSWheel = {
      sku: pair.front.sku,
      rearSku: pair.rear.sku,
      brand: pair.brand,
      model: pair.model,
      finish: pair.finish,
      diameter: pair.front.diameter,
      width: pair.front.width,
      rearDiameter: pair.rear.diameter,
      rearWidth: pair.rear.width,
      offset: pair.front.offset,
      rearOffset: pair.rear.offset,
      boltPattern: pair.front.boltPattern,
      imageUrl: pair.front.imageUrl,
      unitPrice: pair.front.price, // Front price for reference
      setPrice: pair.totalPrice,    // 2×front + 2×rear
      quantity: 4,
      fitmentClass: pair.front.fitmentClass as "extended" | "surefit" | "specfit" | undefined,
      staggered: true,
    };
    setWheel(posWheel);
    setSelectedPairDetail(null);
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
      staggered: false,
    };
    setTire(posTire);
    setSelectedTireDetail(null);
    goToStep("pricing");
  };
  
  /** Handle staggered tire pair selection */
  const handleSelectStaggeredTirePair = (pair: StaggeredTirePair) => {
    const posTire: POSTire = {
      sku: pair.front.sku,
      rearSku: pair.rear.sku,
      brand: pair.brand,
      model: pair.model,
      size: pair.front.size,
      rearSize: pair.rear.size,
      imageUrl: pair.front.imageUrl,
      unitPrice: pair.front.price,
      setPrice: pair.totalPrice,
      quantity: 4,
      staggered: true,
    };
    setTire(posTire);
    setSelectedTirePairDetail(null);
    goToStep("pricing");
  };
  
  // ============================================================================
  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS (React Rules of Hooks)
  // ============================================================================
  
  // Filter staggered pairs by brand
  const filteredPairs = useMemo(() => {
    let result = [...staggeredPairs];
    if (wheelFilters.brand) {
      result = result.filter(p => p.brand === wheelFilters.brand);
    }
    if (wheelFilters.priceRange) {
      if (wheelFilters.priceRange === "0-1500") {
        result = result.filter(p => p.totalPrice < 1500);
      } else if (wheelFilters.priceRange === "1500-2000") {
        result = result.filter(p => p.totalPrice >= 1500 && p.totalPrice < 2000);
      } else if (wheelFilters.priceRange === "2000-2500") {
        result = result.filter(p => p.totalPrice >= 2000 && p.totalPrice < 2500);
      } else if (wheelFilters.priceRange === "2500+") {
        result = result.filter(p => p.totalPrice >= 2500);
      }
    }
    return result.sort((a, b) => a.totalPrice - b.totalPrice);
  }, [staggeredPairs, wheelFilters]);
  
  // ============================================================================
  // EARLY RETURNS (after all hooks)
  // ============================================================================
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
  
  if (wheels.length === 0 && staggeredPairs.length === 0) {
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
    // STAGGERED: Show wheel pairs instead of individual wheels
    if (isStaggered && staggeredPairs.length > 0) {
      return (
        <div className="mx-auto max-w-7xl px-4 py-6 bg-white min-h-screen">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Step 1: Select Wheels</h2>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-sm font-medium">
              <span>⚡</span> Staggered Fitment
              <span className="text-purple-600 text-xs">
                Front: {state.staggeredInfo?.frontSpec?.diameter}"×{state.staggeredInfo?.frontSpec?.width}" / 
                Rear: {state.staggeredInfo?.rearSpec?.diameter}"×{state.staggeredInfo?.rearSpec?.width}"
              </span>
            </div>
            <p className="text-gray-500 mt-1">
              {filteredPairs.length} wheel pairs • 2 front + 2 rear • Sorted by total price
            </p>
          </div>
          
          <WheelFilterBar wheels={wheels} filters={wheelFilters} setFilters={setWheelFilters} />
          
          {/* Staggered Pairs Grid */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredPairs.map((pair) => (
              <div
                key={pair.styleKey}
                onClick={() => setSelectedPairDetail(pair)}
                className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer group"
              >
                {/* Two wheel images side by side */}
                <div className="flex justify-center gap-2 mb-3">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 mb-1">FRONT</div>
                    {pair.front.imageUrl ? (
                      <img src={pair.front.imageUrl} alt="Front" className="h-20 w-20 object-contain" />
                    ) : (
                      <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center text-2xl">🛞</div>
                    )}
                    <div className="text-[10px] text-gray-500">{pair.front.diameter}"×{pair.front.width}"</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 mb-1">REAR</div>
                    {pair.rear.imageUrl ? (
                      <img src={pair.rear.imageUrl} alt="Rear" className="h-20 w-20 object-contain" />
                    ) : (
                      <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center text-2xl">🛞</div>
                    )}
                    <div className="text-[10px] text-gray-500">{pair.rear.diameter}"×{pair.rear.width}"</div>
                  </div>
                </div>
                
                {/* Wheel Info */}
                <div className="text-sm font-medium text-gray-500">{pair.brand}</div>
                <div className="text-sm font-bold text-gray-900 truncate" title={pair.model}>{pair.model}</div>
                {pair.finish && <div className="text-xs text-gray-400">{pair.finish}</div>}
                <div className="text-lg font-black text-purple-600 mt-2">
                  ${pair.totalPrice.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">2 front + 2 rear</div>
              </div>
            ))}
          </div>
          
          {filteredPairs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No wheel pairs match your filters. Try adjusting them.
            </div>
          )}
          
          {/* Staggered Pair Detail Modal */}
          {selectedPairDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelectedPairDetail(null)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                  <h3 className="text-xl font-bold text-gray-900">{selectedPairDetail.brand} {selectedPairDetail.model}</h3>
                  <button onClick={() => setSelectedPairDetail(null)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                <div className="p-6">
                  <div className="flex gap-8 justify-center mb-6">
                    <div className="text-center">
                      <div className="text-sm font-bold text-gray-600 mb-2">FRONT (×2)</div>
                      {selectedPairDetail.front.imageUrl && (
                        <img src={selectedPairDetail.front.imageUrl} alt="Front" className="h-32 w-32 object-contain mx-auto" />
                      )}
                      <div className="mt-2 text-gray-900 font-medium">{selectedPairDetail.front.diameter}" × {selectedPairDetail.front.width}"</div>
                      <div className="text-green-600 font-bold">${selectedPairDetail.front.price}/ea</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-gray-600 mb-2">REAR (×2)</div>
                      {selectedPairDetail.rear.imageUrl && (
                        <img src={selectedPairDetail.rear.imageUrl} alt="Rear" className="h-32 w-32 object-contain mx-auto" />
                      )}
                      <div className="mt-2 text-gray-900 font-medium">{selectedPairDetail.rear.diameter}" × {selectedPairDetail.rear.width}"</div>
                      <div className="text-green-600 font-bold">${selectedPairDetail.rear.price}/ea</div>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <div className="text-sm text-purple-600">Total for all 4 wheels</div>
                    <div className="text-3xl font-black text-purple-700">${selectedPairDetail.totalPrice.toLocaleString()}</div>
                    <div className="text-xs text-purple-500 mt-1">
                      (2 × ${selectedPairDetail.front.price} front) + (2 × ${selectedPairDetail.rear.price} rear)
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelectStaggeredPair(selectedPairDetail)}
                    className="mt-4 w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition"
                  >
                    Select This Wheel Set
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // SQUARE: Show individual wheels (original flow)
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
        {state.wheel?.staggered ? (
          <>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-sm font-medium">
              <span>⚡</span> Staggered Fitment
            </div>
            <p className="text-gray-500 mt-1">
              {staggeredTirePairs.length} tire pairs • Front: {state.wheel.diameter}" / Rear: {state.wheel.rearDiameter}"
            </p>
          </>
        ) : (
          <p className="text-gray-500 mt-1">
            {filteredTires.length} of {tires.length} tires for {state.wheel?.diameter}" wheels
          </p>
        )}
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
      ) : state.wheel?.staggered && staggeredTirePairs.length > 0 ? (
        /* STAGGERED: Show tire pairs */
        <>
          {/* Staggered Tire Pairs Grid */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {staggeredTirePairs.map((pair) => (
              <div
                key={pair.id}
                onClick={() => setSelectedTirePairDetail(pair)}
                className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer group"
              >
                {/* Two tire sizes side by side */}
                <div className="flex justify-center gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 mb-1">FRONT</div>
                    {pair.front.imageUrl ? (
                      <img src={pair.front.imageUrl} alt="Front" className="h-16 w-16 object-contain" />
                    ) : (
                      <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-xl">🛞</div>
                    )}
                    <div className="text-[10px] text-gray-500 mt-1">{pair.front.size}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 mb-1">REAR</div>
                    {pair.rear.imageUrl ? (
                      <img src={pair.rear.imageUrl} alt="Rear" className="h-16 w-16 object-contain" />
                    ) : (
                      <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-xl">🛞</div>
                    )}
                    <div className="text-[10px] text-gray-500 mt-1">{pair.rear.size}</div>
                  </div>
                </div>
                
                {/* Tire Info */}
                <div className="text-sm font-medium text-gray-500">{pair.brand}</div>
                <div className="text-sm font-bold text-gray-900 truncate" title={pair.model}>{pair.model}</div>
                <div className="text-lg font-black text-purple-600 mt-2">
                  ${pair.totalPrice.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">2 front + 2 rear</div>
              </div>
            ))}
          </div>
          
          {staggeredTirePairs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No matching tire pairs found. Contact support for assistance.
            </div>
          )}
          
          {/* Staggered Tire Pair Detail Modal */}
          {selectedTirePairDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelectedTirePairDetail(null)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                  <h3 className="text-xl font-bold text-gray-900">{selectedTirePairDetail.brand} {selectedTirePairDetail.model}</h3>
                  <button onClick={() => setSelectedTirePairDetail(null)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                <div className="p-6">
                  <div className="flex gap-8 justify-center mb-6">
                    <div className="text-center">
                      <div className="text-sm font-bold text-gray-600 mb-2">FRONT (×2)</div>
                      {selectedTirePairDetail.front.imageUrl && (
                        <img src={selectedTirePairDetail.front.imageUrl} alt="Front" className="h-24 w-24 object-contain mx-auto" />
                      )}
                      <div className="mt-2 text-gray-900 font-medium">{selectedTirePairDetail.front.size}</div>
                      <div className="text-green-600 font-bold">${selectedTirePairDetail.front.price}/ea</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-gray-600 mb-2">REAR (×2)</div>
                      {selectedTirePairDetail.rear.imageUrl && (
                        <img src={selectedTirePairDetail.rear.imageUrl} alt="Rear" className="h-24 w-24 object-contain mx-auto" />
                      )}
                      <div className="mt-2 text-gray-900 font-medium">{selectedTirePairDetail.rear.size}</div>
                      <div className="text-green-600 font-bold">${selectedTirePairDetail.rear.price}/ea</div>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <div className="text-sm text-purple-600">Total for all 4 tires</div>
                    <div className="text-3xl font-black text-purple-700">${selectedTirePairDetail.totalPrice.toLocaleString()}</div>
                    <div className="text-xs text-purple-500 mt-1">
                      (2 × ${selectedTirePairDetail.front.price} front) + (2 × ${selectedTirePairDetail.rear.price} rear)
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelectStaggeredTirePair(selectedTirePairDetail)}
                    className="mt-4 w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition"
                  >
                    Select This Tire Set
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : tires.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No matching tires found. Try selecting different wheels.
        </div>
      ) : (
        /* SQUARE: Show individual tires */
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
      
      {/* Detail Modal (square fitment) */}
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
