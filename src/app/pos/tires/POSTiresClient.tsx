"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePOS, type POSTire } from "@/components/pos/POSContext";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { getLiftProfile, getRecommendationForLiftHeight, getTireSizesForLift } from "@/lib/liftedRecommendations";

// ============================================================================
// Types
// ============================================================================

type TireItem = {
  sku?: string;
  brand?: string;
  model?: string;
  size?: string;
  displayName?: string;
  imageUrl?: string;
  price?: number;
  loadIndex?: string;
  speedRating?: string;
  sidewall?: string;
  warranty?: string;
};

type Facets = {
  brands: Array<{ value: string; count: number }>;
  sizes: Array<{ value: string; count: number }>;
  speedRatings: Array<{ value: string; count: number }>;
};

// ============================================================================
// Tire Diameter Calculation
// ============================================================================

/**
 * Calculate overall tire diameter from size string
 * Handles both metric (285/70R17) and flotation (35x12.50R17) formats
 * Returns diameter in inches, or null if unparseable
 */
function calculateTireDiameter(size: string): number | null {
  if (!size) return null;
  
  // Flotation format: 35x12.50R17 or 33x12.5R15
  const flotationMatch = size.match(/^(\d+(?:\.\d+)?)\s*x/i);
  if (flotationMatch) {
    return parseFloat(flotationMatch[1]);
  }
  
  // Metric format: 285/70R17 or 285/70-17
  const metricMatch = size.match(/^(\d+)\/(\d+)[R-](\d+)/i);
  if (metricMatch) {
    const widthMm = parseFloat(metricMatch[1]);
    const aspectRatio = parseFloat(metricMatch[2]);
    const rimDiameter = parseFloat(metricMatch[3]);
    
    // Sidewall height in mm, then convert to inches
    const sidewallMm = widthMm * (aspectRatio / 100);
    const sidewallInches = sidewallMm / 25.4;
    
    // Overall diameter = rim + 2 × sidewall
    return rimDiameter + (2 * sidewallInches);
  }
  
  // LT metric: LT285/70R17
  const ltMetricMatch = size.match(/^LT\s*(\d+)\/(\d+)[R-](\d+)/i);
  if (ltMetricMatch) {
    const widthMm = parseFloat(ltMetricMatch[1]);
    const aspectRatio = parseFloat(ltMetricMatch[2]);
    const rimDiameter = parseFloat(ltMetricMatch[3]);
    
    const sidewallMm = widthMm * (aspectRatio / 100);
    const sidewallInches = sidewallMm / 25.4;
    
    return rimDiameter + (2 * sidewallInches);
  }
  
  return null;
}

/**
 * Check if a tire size matches the lift profile recommendations
 * Returns { matches, diameter, notes }
 */
function tireFitsLiftConfig(
  size: string,
  make: string,
  model: string,
  liftInches: number
): { matches: boolean; diameter: number | null; reason?: string } {
  const diameter = calculateTireDiameter(size);
  if (diameter === null) {
    return { matches: true, diameter: null, reason: "Could not parse size" };
  }
  
  const profile = getLiftProfile(make, model);
  if (!profile) {
    // No profile - show all tires
    return { matches: true, diameter };
  }
  
  const rec = getRecommendationForLiftHeight(profile, liftInches);
  
  // Check if diameter is in range (with some tolerance for rounding)
  const tolerance = 0.5; // Half inch tolerance
  if (diameter >= rec.tireDiameterMin - tolerance && diameter <= rec.tireDiameterMax + tolerance) {
    return { matches: true, diameter };
  }
  
  return { 
    matches: false, 
    diameter,
    reason: `Recommended: ${rec.tireDiameterMin}-${rec.tireDiameterMax}" tires`
  };
}

type Props = {
  year: string;
  make: string;
  model: string;
  trim: string;
  wheelDia: string;
  wheelWidth: string;
  searchParams: Record<string, string | string[] | undefined>;
};

// ============================================================================
// Main Component
// ============================================================================

export function POSTiresClient({ year, make, model, trim, wheelDia, wheelWidth, searchParams }: Props) {
  const router = useRouter();
  const { state, setTire, goToStep } = usePOS();
  
  const [tires, setTires] = useState<TireItem[]>([]);
  const [facets, setFacets] = useState<Facets>({ brands: [], sizes: [], speedRatings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Extract filter params
  const sort = (Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort) || "price_asc";
  const brand = Array.isArray(searchParams.brand) ? searchParams.brand[0] : searchParams.brand || "";
  const size = Array.isArray(searchParams.size) ? searchParams.size[0] : searchParams.size || "";
  
  const hasVehicle = Boolean(year && make && model);
  const hasWheel = Boolean(state.wheel?.diameter);
  
  // Fetch tires
  useEffect(() => {
    if (!hasVehicle) {
      setTires([]);
      setLoading(false);
      return;
    }
    
    const fetchTires = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          year,
          make,
          model,
        });
        
        if (trim) params.set("trim", trim);
        if (wheelDia || state.wheel?.diameter) {
          params.set("wheelDia", wheelDia || state.wheel?.diameter || "");
        }
        if (wheelWidth || state.wheel?.width) {
          params.set("wheelWidth", wheelWidth || state.wheel?.width || "");
        }
        if (brand) params.set("brand", brand);
        if (size) params.set("size", size);
        
        // Pass lift configuration to API for proper tire size search
        if (state.buildType !== "stock" && state.liftConfig) {
          params.set("buildType", state.buildType);
          params.set("liftInches", String(state.liftConfig.liftInches));
          if (state.liftConfig.targetTireSize) {
            params.set("targetTireSize", String(state.liftConfig.targetTireSize));
          }
        }
        
        const res = await fetch(`/api/tires/search?${params}`);
        if (!res.ok) throw new Error("Failed to fetch tires");
        
        const data = await res.json();
        
        const rawItems = data.results || data.tires || [];
        const processed: TireItem[] = rawItems.map((t: any) => ({
          sku: t.partNumber || t.sku,
          brand: t.brand,
          model: t.displayName || t.prettyName || t.description || t.model,
          size: t.size,
          displayName: t.displayName || t.prettyName,
          imageUrl: t.imageUrl,
          price: typeof t.price === "number" ? t.price : (typeof t.cost === "number" ? t.cost + 50 : 0),
          loadIndex: t.loadIndex,
          speedRating: t.speedRating,
          sidewall: t.sidewall,
          warranty: t.warranty,
        }));
        
        // Filter by lift config if applicable
        let filtered = processed;
        if (state.buildType !== "stock" && state.liftConfig) {
          const liftProfile = getLiftProfile(make, model);
          
          if (liftProfile) {
            const rec = getRecommendationForLiftHeight(liftProfile, state.liftConfig.liftInches);
            const recommendedSizes = getTireSizesForLift(liftProfile, state.liftConfig.liftInches, state.wheel?.diameter ? parseInt(state.wheel.diameter) : undefined);
            
            filtered = processed.filter((t) => {
              if (!t.size) return true; // Include if no size data
              
              // Check if it's an exact recommended size match
              if (recommendedSizes.some(rs => t.size?.includes(rs) || rs.includes(t.size || ""))) {
                return true;
              }
              
              // Otherwise check diameter range
              const result = tireFitsLiftConfig(t.size, make, model, state.liftConfig!.liftInches);
              return result.matches;
            });
            
            console.log(`[POS Tires] Lift filter: ${state.liftConfig.liftInches}" lift, ${rec.tireDiameterMin}-${rec.tireDiameterMax}" tires, ${filtered.length}/${processed.length} tires match`);
          } else {
            // No profile - use target tire size if specified
            if (state.liftConfig.targetTireSize) {
              const targetDiameter = state.liftConfig.targetTireSize;
              const tolerance = 1; // 1 inch tolerance
              
              filtered = processed.filter((t) => {
                if (!t.size) return true;
                const diameter = calculateTireDiameter(t.size);
                if (diameter === null) return true;
                return diameter >= targetDiameter - tolerance && diameter <= targetDiameter + tolerance;
              });
              
              console.log(`[POS Tires] No lift profile for ${make} ${model}, filtering by target size ${targetDiameter}": ${filtered.length}/${processed.length} tires match`);
            }
          }
        }
        
        // Sort
        const sorted = [...filtered].sort((a, b) => {
          const aPrice = a.price ?? Infinity;
          const bPrice = b.price ?? Infinity;
          switch (sort) {
            case "price_desc": return bPrice - aPrice;
            case "brand_asc": return (a.brand || "").localeCompare(b.brand || "");
            default: return aPrice - bPrice;
          }
        });
        
        setTires(sorted);
        
        // Build facets from FILTERED results (not raw API results)
        // This ensures facets match the displayed tires
        const brandMap = new Map<string, number>();
        const sizeMap = new Map<string, number>();
        const speedMap = new Map<string, number>();
        
        for (const t of sorted) {
          if (t.brand) brandMap.set(t.brand, (brandMap.get(t.brand) || 0) + 1);
          if (t.size) sizeMap.set(t.size, (sizeMap.get(t.size) || 0) + 1);
          if (t.speedRating) speedMap.set(t.speedRating, (speedMap.get(t.speedRating) || 0) + 1);
        }
        
        setFacets({
          brands: Array.from(brandMap.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => a.value.localeCompare(b.value)),
          sizes: Array.from(sizeMap.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => a.value.localeCompare(b.value)),
          speedRatings: Array.from(speedMap.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => a.value.localeCompare(b.value)),
        });
        
      } catch (err) {
        console.error("[POS Tires] Fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    
    fetchTires();
  }, [year, make, model, trim, wheelDia, wheelWidth, brand, size, sort, hasVehicle, state.wheel?.diameter, state.wheel?.width, state.buildType, state.liftConfig]);
  
  // Handle tire selection
  const handleSelectTire = useCallback((tire: TireItem) => {
    const posTire: POSTire = {
      sku: tire.sku || "",
      brand: tire.brand || "",
      model: tire.model || "",
      size: tire.size || "",
      imageUrl: tire.imageUrl,
      unitPrice: tire.price || 0,
      setPrice: (tire.price || 0) * 4,
      quantity: 4,
    };
    
    setTire(posTire);
    goToStep("pricing");
    
    // Navigate back to POS pricing page
    router.push("/pos");
  }, [setTire, goToStep, router]);
  
  // No vehicle or wheel selected
  if (!hasVehicle) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold text-gray-900">Select a Vehicle First</h1>
          <p className="mt-2 text-gray-600">Please go back and select a vehicle.</p>
          <Link href="/pos" className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white">
            Back to POS
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/pos/wheels?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}`} className="text-sm text-blue-600 hover:underline">
              ← Back to Wheels
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Select Tires</h1>
            <p className="text-sm text-gray-600">
              {year} {make} {model} {trim}
              {state.buildType !== "stock" && state.liftConfig && (
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                  state.buildType === "lifted" 
                    ? "bg-orange-100 text-orange-700" 
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {state.buildType === "leveled" ? "Leveled" : `${state.liftConfig.liftInches}" Lift`}
                  {state.liftConfig.targetTireSize && ` • ${state.liftConfig.targetTireSize}" Tires`}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Sort by</span>
            <AutoSubmitSelect
              name="sort"
              defaultValue={sort}
              className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm"
              options={[
                { value: "price_asc", label: "Price: Low to High" },
                { value: "price_desc", label: "Price: High to Low" },
                { value: "brand_asc", label: "Brand: A-Z" },
              ]}
            />
          </div>
        </div>
        
        {/* Selected wheel summary */}
        {state.wheel && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {state.wheel.imageUrl && (
                  <img src={state.wheel.imageUrl} alt="" className="h-16 w-16 object-contain" />
                )}
                <div>
                  <div className="text-xs font-medium text-green-700">✓ Wheel Selected</div>
                  <div className="font-bold text-gray-900">{state.wheel.brand} {state.wheel.model}</div>
                  <div className="text-sm text-gray-600">
                    {state.wheel.diameter}" × {state.wheel.width}"
                    {state.wheel.finish && ` • ${state.wheel.finish}`}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-gray-900">${state.wheel.setPrice.toLocaleString()}</div>
                <div className="text-xs text-gray-500">set of 4</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Lift recommendation info */}
        {state.buildType !== "stock" && state.liftConfig && (() => {
          const liftProfile = getLiftProfile(make, model);
          if (liftProfile) {
            const rec = getRecommendationForLiftHeight(liftProfile, state.liftConfig.liftInches);
            const wheelDia = state.wheel?.diameter ? parseInt(state.wheel.diameter) : null;
            
            // Get sizes that match the selected wheel diameter
            let displaySizes = getTireSizesForLift(liftProfile, state.liftConfig.liftInches, wheelDia || undefined);
            
            // If no sizes match the wheel diameter, generate appropriate flotation sizes
            if (displaySizes.length === 0 && wheelDia) {
              const minDia = rec.tireDiameterMin;
              const maxDia = rec.tireDiameterMax;
              const midDia = Math.round((minDia + maxDia) / 2);
              displaySizes = [
                `${midDia}x12.50R${wheelDia}`,
                `${midDia}x13.50R${wheelDia}`,
                `${minDia}x12.50R${wheelDia}`,
                `${maxDia}x12.50R${wheelDia}`,
              ];
            }
            
            return (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">🛞</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-amber-800">
                      Recommended Tire Sizes for Your {state.liftConfig.liftInches}" {state.buildType === "leveled" ? "Level" : "Lift"}
                    </div>
                    <div className="mt-1 text-sm text-amber-700">
                      {rec.tireDiameterMin}"-{rec.tireDiameterMax}" overall diameter • {rec.stanceDescription}
                    </div>
                    {displaySizes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {displaySizes.slice(0, 6).map((ts) => (
                          <span key={ts} className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                            {ts}
                          </span>
                        ))}
                        {displaySizes.length > 6 && (
                          <span className="px-2 py-0.5 text-amber-600 text-xs">
                            +{displaySizes.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>
      
      {/* Main content */}
      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar filters */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              {/* Brand filter */}
              {facets.brands.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Brand</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {facets.brands.map((b) => (
                      <Link
                        key={b.value}
                        href={`/pos/tires?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}&wheelDia=${wheelDia}&wheelWidth=${wheelWidth}&brand=${encodeURIComponent(b.value)}&sort=${sort}`}
                        className={`flex items-center justify-between py-1 text-sm ${brand === b.value ? "font-bold text-blue-600" : "text-gray-700 hover:text-blue-600"}`}
                      >
                        <span>{b.value}</span>
                        <span className="text-xs text-gray-400">{b.count}</span>
                      </Link>
                    ))}
                  </div>
                  {brand && (
                    <Link
                      href={`/pos/tires?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}&wheelDia=${wheelDia}&wheelWidth=${wheelWidth}&sort=${sort}`}
                      className="mt-3 inline-block text-sm text-blue-600 hover:underline"
                    >
                      Clear brand filter
                    </Link>
                  )}
                </div>
              )}
              
              {/* Size filter */}
              {facets.sizes.length > 1 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Size</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {facets.sizes.map((s) => (
                      <Link
                        key={s.value}
                        href={`/pos/tires?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}&wheelDia=${wheelDia}&wheelWidth=${wheelWidth}${brand ? `&brand=${encodeURIComponent(brand)}` : ""}&size=${encodeURIComponent(s.value)}&sort=${sort}`}
                        className={`flex items-center justify-between py-1 text-sm ${size === s.value ? "font-bold text-blue-600" : "text-gray-700 hover:text-blue-600"}`}
                      >
                        <span>{s.value}</span>
                        <span className="text-xs text-gray-400">{s.count}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
          
          {/* Results */}
          <section>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex items-center gap-3 text-gray-500">
                  <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading tires...
                </div>
              </div>
            ) : error ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
                <p className="text-red-800">{error}</p>
              </div>
            ) : tires.length === 0 ? (
              <div className="rounded-lg bg-gray-100 p-12 text-center">
                <p className="text-gray-600">No tires found matching your criteria.</p>
              </div>
            ) : (
              <>
                {/* Results count */}
                <div className="mb-4 text-sm text-gray-600">
                  Showing {tires.length} tires
                </div>
                
                {/* Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {tires.map((tire) => (
                    <button
                      key={tire.sku || `${tire.brand}-${tire.model}-${tire.size}`}
                      onClick={() => handleSelectTire(tire)}
                      className="group rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-blue-500 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {/* Image */}
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                        {tire.imageUrl ? (
                          <img 
                            src={tire.imageUrl} 
                            alt={`${tire.brand} ${tire.model}`}
                            className="h-full w-full object-contain transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-4xl text-gray-300">🛞</div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="mt-3">
                        <div className="text-xs font-medium text-gray-500">{tire.brand}</div>
                        <div className="font-bold text-gray-900 truncate">{tire.model}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">{tire.size}</span>
                          {/* Show calculated diameter for lifted/leveled builds */}
                          {state.buildType !== "stock" && tire.size && (() => {
                            const diameter = calculateTireDiameter(tire.size);
                            if (diameter) {
                              return (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                                  {diameter.toFixed(1)}"
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        
                        {/* Specs */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tire.loadIndex && (
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              Load: {tire.loadIndex}
                            </span>
                          )}
                          {tire.speedRating && (
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              Speed: {tire.speedRating}
                            </span>
                          )}
                        </div>
                        
                        {/* Price */}
                        <div className="mt-3 flex items-baseline justify-between">
                          <div>
                            <span className="text-xl font-bold text-gray-900">
                              ${((tire.price || 0) * 4).toLocaleString()}
                            </span>
                            <span className="ml-1 text-xs text-gray-500">set of 4</span>
                          </div>
                          <span className="text-xs text-gray-400">
                            ${(tire.price || 0).toLocaleString()}/ea
                          </span>
                        </div>
                      </div>
                      
                      {/* Select button */}
                      <div className="mt-3 rounded-lg bg-blue-600 py-2 text-center text-sm font-semibold text-white transition-colors group-hover:bg-blue-700">
                        Select This Tire
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
