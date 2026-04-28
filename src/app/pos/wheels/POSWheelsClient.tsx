"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { usePOS, type POSWheel, type SetupMode } from "@/components/pos/POSContext";
import { createSelectedWheel, formatWheelSize, type WheelPairInfo } from "@/lib/fitment/staggeredFitment";
import { getLiftProfile, getRecommendationForLiftHeight } from "@/lib/liftedRecommendations";

// ============================================================================
// Types
// ============================================================================

type WheelItem = {
  sku?: string;
  title?: string;
  brand?: string;
  brandCode?: string;
  model?: string;
  finish?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  centerbore?: string;
  imageUrl?: string;
  price?: number;
  stockQty?: number;
  inventoryType?: string;
  styleKey?: string;
  fitmentClass?: "surefit" | "specfit" | "extended";
  pair?: WheelPairInfo;
};

type FacetBucket = { value: string; count: number; label?: string; isOem?: boolean };

type Facets = {
  brands: FacetBucket[];
  finishes: FacetBucket[];
  diameters: FacetBucket[];
  widths: FacetBucket[];
  offsets: FacetBucket[];
};

type Props = {
  year: string;
  make: string;
  model: string;
  trim: string;
  searchParams: Record<string, string | string[] | undefined>;
};

// ============================================================================
// Helper Functions
// ============================================================================

function safeString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
}

// Check if wheel has TRULY different front/rear specs (not just flagged as staggered)
function isTrulyStaggered(pair: WheelPairInfo | undefined): boolean {
  if (!pair?.staggered || !pair.front || !pair.rear) return false;
  // Must have different diameter OR width
  return pair.front.diameter !== pair.rear.diameter || pair.front.width !== pair.rear.width;
}

// ============================================================================
// Filter Sidebar Component
// ============================================================================

function FilterSidebar({
  facets,
  filters,
  onFilterChange,
  setupMode,
  onSetupModeChange,
  vehicleSupportsStaggered,
  staggeredCount,
  squareCount,
}: {
  facets: Facets;
  filters: { brand?: string; finish?: string; diameter?: string };
  onFilterChange: (key: string, value: string | undefined) => void;
  setupMode: SetupMode;
  onSetupModeChange: (mode: SetupMode) => void;
  vehicleSupportsStaggered: boolean;
  staggeredCount: number;
  squareCount: number;
}) {
  return (
    <div className="w-64 shrink-0 space-y-6">
      {/* Setup Mode Toggle - only for staggered-capable vehicles */}
      {vehicleSupportsStaggered && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-neutral-900">Setup Type</h3>
          <div className="space-y-2">
            <button
              onClick={() => onSetupModeChange("staggered")}
              className={`flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-all ${
                setupMode === "staggered"
                  ? "border-purple-500 bg-purple-50"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {setupMode === "staggered" && <span className="text-purple-600">✓</span>}
                  <span className="font-medium text-neutral-900">🏁 Staggered</span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">Wider rear wheels</p>
              </div>
              <span className="text-xs text-neutral-400">{staggeredCount}</span>
            </button>
            
            <button
              onClick={() => onSetupModeChange("square")}
              className={`flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-all ${
                setupMode === "square"
                  ? "border-blue-500 bg-blue-50"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {setupMode === "square" && <span className="text-blue-600">✓</span>}
                  <span className="font-medium text-neutral-900">⬜ Square</span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">Same all around</p>
              </div>
              <span className="text-xs text-neutral-400">{squareCount}</span>
            </button>
          </div>
        </div>
      )}

      {/* Brand Filter */}
      {facets.brands.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-neutral-900">Brand</h3>
          <select
            value={filters.brand || ""}
            onChange={(e) => onFilterChange("brand", e.target.value || undefined)}
            className="w-full rounded border border-neutral-300 p-2 text-sm"
          >
            <option value="">All Brands</option>
            {facets.brands.slice(0, 15).map((b) => (
              <option key={b.value} value={b.value}>
                {b.value} ({b.count})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Diameter Filter */}
      {facets.diameters.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-neutral-900">Diameter</h3>
          <div className="flex flex-wrap gap-2">
            {facets.diameters.map((d) => (
              <button
                key={d.value}
                onClick={() => onFilterChange("diameter", filters.diameter === d.value ? undefined : d.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  filters.diameter === d.value
                    ? "bg-blue-600 text-white"
                    : d.isOem
                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {d.label || `${d.value}"`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Finish Filter */}
      {facets.finishes.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-neutral-900">Finish</h3>
          <select
            value={filters.finish || ""}
            onChange={(e) => onFilterChange("finish", e.target.value || undefined)}
            className="w-full rounded border border-neutral-300 p-2 text-sm"
          >
            <option value="">All Finishes</option>
            {facets.finishes.slice(0, 20).map((f) => (
              <option key={f.value} value={f.value}>
                {f.value} ({f.count})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Clear Filters */}
      {(filters.brand || filters.finish || filters.diameter) && (
        <button
          onClick={() => {
            onFilterChange("brand", undefined);
            onFilterChange("finish", undefined);
            onFilterChange("diameter", undefined);
          }}
          className="w-full rounded-lg border border-neutral-300 bg-white py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Wheel Card Component
// ============================================================================

function POSWheelCard({
  wheel,
  showAsStaggered,
  onSelect,
}: {
  wheel: WheelItem;
  showAsStaggered: boolean;
  onSelect: (wheel: WheelItem) => void;
}) {
  const currentPrice = wheel.price || 0;
  
  // Calculate set price - for staggered, we'd need both front and rear prices
  // For now, assume same price per wheel (simplified)
  const setPrice = currentPrice * 4;
  
  // Check if this wheel has a truly staggered pair (different F/R specs)
  const hasTrueStaggeredPair = isTrulyStaggered(wheel.pair);
  const displayStaggered = showAsStaggered && hasTrueStaggeredPair;
  
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:shadow-md">
      {/* Image */}
      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-neutral-100">
        {wheel.imageUrl ? (
          <img src={wheel.imageUrl} alt={wheel.model} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-neutral-300">🛞</div>
        )}
        
        {/* Fitment class badge */}
        {wheel.fitmentClass && (
          <div className={`absolute top-2 right-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
            wheel.fitmentClass === "surefit"
              ? "bg-green-100 text-green-700"
              : wheel.fitmentClass === "specfit"
              ? "bg-blue-100 text-blue-700"
              : "bg-amber-100 text-amber-700"
          }`}>
            {wheel.fitmentClass === "surefit" ? "OEM Fit" : wheel.fitmentClass === "specfit" ? "Spec Fit" : "Extended"}
          </div>
        )}
        
        {/* Staggered badge */}
        {displayStaggered && (
          <div className="absolute top-2 left-2 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
            🏁 Staggered
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="mb-2">
        <div className="text-sm font-bold text-neutral-900">{wheel.brand}</div>
        <div className="text-sm text-neutral-600 line-clamp-1">{wheel.model}</div>
      </div>
      
      {/* Specs */}
      <div className="mb-2 text-xs text-neutral-500">
        {displayStaggered && wheel.pair ? (
          <>
            <div className="flex gap-2">
              <span className="font-medium text-neutral-700">F:</span>
              <span>{wheel.pair.front.diameter}" × {wheel.pair.front.width}" ET{wheel.pair.front.offset}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-medium text-neutral-700">R:</span>
              <span>{wheel.pair.rear.diameter}" × {wheel.pair.rear.width}" ET{wheel.pair.rear.offset}</span>
            </div>
          </>
        ) : (
          <div>{wheel.diameter}" × {wheel.width}" ET{wheel.offset}</div>
        )}
        {wheel.finish && <div className="mt-1 text-neutral-400">{wheel.finish}</div>}
      </div>
      
      {/* Price */}
      <div className="mb-3 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-neutral-900">${currentPrice.toLocaleString()}</span>
          <span className="text-xs text-neutral-500">each</span>
        </div>
        <div className="text-sm text-neutral-600">
          <span className="font-semibold">${setPrice.toLocaleString()}</span>
          <span className="ml-1">set of 4</span>
        </div>
      </div>
      
      {/* Select button */}
      <button
        onClick={() => onSelect(wheel)}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        Select This Wheel
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function POSWheelsClient({ year, make, model, trim, searchParams }: Props) {
  const router = useRouter();
  const { state, setWheel, setSetupMode, setStaggeredInfo, isStaggered: contextIsStaggered, supportsStaggered } = usePOS();

  // Local setup mode (synced with context but also works standalone)
  const [localSetupMode, setLocalSetupMode] = useState<SetupMode>(state.setupMode);
  
  // State
  const [wheels, setWheels] = useState<WheelItem[]>([]);
  const [facets, setFacets] = useState<Facets>({
    brands: [],
    finishes: [],
    diameters: [],
    widths: [],
    offsets: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicleBoltPattern, setVehicleBoltPattern] = useState<string | undefined>();
  const [vehicleSupportsStaggered, setVehicleSupportsStaggered] = useState(false);

  // Local filters
  const [filters, setFilters] = useState<{ brand?: string; finish?: string; diameter?: string }>({});

  // Extract URL params
  const sort = safeString(searchParams.sort) || "price_asc";
  const page = Math.max(1, Number(safeString(searchParams.page)) || 1);

  const hasVehicle = Boolean(year && make && model);

  // Sync local mode with context
  useEffect(() => {
    setLocalSetupMode(state.setupMode);
  }, [state.setupMode]);

  // Handle setup mode change
  const handleSetupModeChange = useCallback((mode: SetupMode) => {
    setLocalSetupMode(mode);
    setSetupMode(mode);
  }, [setSetupMode]);

  // Handle filter change
  const handleFilterChange = useCallback((key: string, value: string | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Track if we've initialized staggered mode (to prevent infinite loop)
  const [hasInitializedStaggered, setHasInitializedStaggered] = useState(false);

  // Fetch wheels
  useEffect(() => {
    if (!hasVehicle) {
      setWheels([]);
      setLoading(false);
      return;
    }

    const fetchWheels = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          year,
          make,
          model,
          pageSize: "800",
          fields: "inventory,price,images,properties",
        });

        if (trim) params.set("trim", trim);
        if (sort) params.set("sort", sort);

        // Add lifted configuration params with offset filtering
        if (state.buildType !== "stock" && state.liftConfig) {
          params.set("liftInches", String(state.liftConfig.liftInches));
          if (state.liftConfig.targetTireSize) {
            params.set("targetTireSize", String(state.liftConfig.targetTireSize));
          }
          
          // Get offset range from lift recommendations
          const liftProfile = getLiftProfile(make, model);
          if (liftProfile) {
            const rec = getRecommendationForLiftHeight(liftProfile, state.liftConfig.liftInches);
            if (rec) {
              params.set("offsetMin", String(rec.offsetMin));
              params.set("offsetMax", String(rec.offsetMax));
              console.log(`[POSWheels] Lift ${state.liftConfig.liftInches}" → offset range [${rec.offsetMin}, ${rec.offsetMax}]`);
            }
          }
        }

        const res = await fetch(`/api/wheels/fitment-search?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch wheels");

        const data = await res.json();
        
        // Store bolt pattern and staggered capability
        if (data.fitment?.envelope?.boltPattern) {
          setVehicleBoltPattern(data.fitment.envelope.boltPattern);
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // CRITICAL: Store full staggered info in context (includes tire sizes)
        // This is the SOURCE OF TRUTH from retail fitment API
        // POSTiresClient reads staggeredInfo.frontSpec.tireSize / rearSpec.tireSize
        // ═══════════════════════════════════════════════════════════════════
        const staggeredInfo = data.fitment?.staggered;
        if (staggeredInfo?.isStaggered) {
          setVehicleSupportsStaggered(true);
          
          // Store the FULL staggered info including tire sizes
          setStaggeredInfo(staggeredInfo);
          
          console.log("[POSWheelsClient] Staggered info from API:", {
            isStaggered: staggeredInfo.isStaggered,
            reason: staggeredInfo.reason,
            frontTireSize: staggeredInfo.frontSpec?.tireSize,
            rearTireSize: staggeredInfo.rearSpec?.tireSize,
          });
          
          // Only set staggered mode once on initial load (prevent re-render loop)
          if (!hasInitializedStaggered) {
            setHasInitializedStaggered(true);
            setLocalSetupMode("staggered");
            setSetupMode("staggered");
          }
        } else {
          // Clear staggered info for non-staggered vehicles
          setStaggeredInfo(null);
        }

        // Normalize wheel data
        const normalizedWheels: WheelItem[] = (data.results || []).map((w: any) => {
          const brandName = typeof w.brand === "string"
            ? w.brand
            : w.brand?.description || w.properties?.brand_desc || "Unknown";

          const priceVal = w.prices?.msrp?.[0]?.currencyAmount;
          const price = typeof priceVal === "string" ? parseFloat(priceVal) : (priceVal || 0);
          const imageUrl = w.images?.[0]?.imageUrlLarge || w.images?.[0]?.imageUrlMedium || "";

          return {
            sku: w.sku || "",
            brand: brandName,
            brandCode: w.brand?.code || w.properties?.brand_cd,
            model: w.title || w.properties?.style_desc || "",
            finish: w.properties?.abbreviated_finish_desc || w.properties?.fancy_finish_desc,
            diameter: String(w.properties?.diameter || ""),
            width: String(w.properties?.width || ""),
            offset: w.properties?.offset ? String(w.properties.offset) : undefined,
            boltPattern: w.properties?.boltPatternMetric || w.properties?.boltPattern,
            centerbore: w.properties?.centerbore ? String(w.properties.centerbore) : undefined,
            imageUrl,
            price,
            stockQty: w.inventory?.localStock || 0,
            inventoryType: w.inventory?.type,
            fitmentClass: w.fitmentValidation?.fitmentClass,
            pair: w.pair,
          };
        });

        setWheels(normalizedWheels);

        // Build facets from API response
        if (data.facets) {
          const brandBuckets = data.facets.brand_cd?.buckets || [];
          const finishBuckets = data.facets.abbreviated_finish_desc?.buckets || [];
          const diameterBuckets = data.facets.wheel_diameter?.buckets || [];
          
          setFacets({
            brands: brandBuckets.map((b: any) => ({ value: b.value, count: b.count })),
            finishes: finishBuckets.map((f: any) => ({ value: f.value, count: f.count })),
            diameters: diameterBuckets.map((d: any) => ({ 
              value: d.value, 
              count: d.count, 
              label: d.label || `${d.value}"`,
              isOem: d.isOem 
            })),
            widths: [],
            offsets: [],
          });
        }
      } catch (err) {
        console.error("[POSWheelsClient] Fetch error:", err);
        setError("Unable to load wheels. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchWheels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, make, model, trim, sort, hasVehicle, state.buildType, state.liftConfig, hasInitializedStaggered]);

  // Filter and count wheels
  const { filteredWheels, staggeredCount, squareCount } = useMemo(() => {
    let result = [...wheels];
    let staggered = 0;
    let square = 0;

    // Count staggered vs square wheels (before filtering)
    wheels.forEach(w => {
      if (isTrulyStaggered(w.pair)) {
        staggered++;
      } else {
        square++;
      }
    });

    // Apply setup mode filter
    if (localSetupMode === "staggered") {
      result = result.filter(w => isTrulyStaggered(w.pair));
    }

    // Apply local filters
    if (filters.brand) {
      result = result.filter(w => w.brandCode === filters.brand);
    }
    if (filters.finish) {
      result = result.filter(w => w.finish === filters.finish);
    }
    if (filters.diameter) {
      result = result.filter(w => w.diameter === filters.diameter);
    }

    return { filteredWheels: result, staggeredCount: staggered, squareCount: square };
  }, [wheels, localSetupMode, filters]);

  // Pagination
  const itemsPerPage = 24;
  const totalPages = Math.max(1, Math.ceil(filteredWheels.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const pagedWheels = filteredWheels.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  // Handle wheel selection
  const handleSelectWheel = useCallback((wheel: WheelItem) => {
    const selectedWheel = createSelectedWheel(wheel, localSetupMode);
    
    const posWheel: POSWheel = {
      ...selectedWheel,
      quantity: 4,
    };

    setWheel(posWheel);

    // Navigate to tires
    const params = new URLSearchParams({ year, make, model });
    if (trim) params.set("trim", trim);
    
    // For staggered, use pair.front/rear specs; otherwise use wheel's own specs
    if (localSetupMode === "staggered" && wheel.pair?.front && wheel.pair?.rear) {
      params.set("staggered", "true");
      params.set("wheelDia", String(wheel.pair.front.diameter));
      params.set("wheelWidth", String(wheel.pair.front.width));
      params.set("rearDia", String(wheel.pair.rear.diameter));
      params.set("rearWidth", String(wheel.pair.rear.width));
    } else {
      params.set("wheelDia", wheel.diameter || "");
      params.set("wheelWidth", wheel.width || "");
    }

    router.push(`/pos/tires?${params.toString()}`);
  }, [setWheel, localSetupMode, router, year, make, model, trim]);

  // No vehicle
  if (!hasVehicle) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold text-neutral-900">Select a Vehicle First</h1>
          <p className="mt-2 text-neutral-600">Please go back and select a vehicle to browse wheels.</p>
          <Link href="/pos" className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white">
            Back to Vehicle Selection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/pos" className="text-sm text-blue-600 hover:underline">
              ← Back to POS
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">Select Wheels</h1>
            <p className="text-sm text-neutral-600">
              {year} {make} {model} {trim}
              {vehicleBoltPattern && <span className="ml-2 text-neutral-400">• {vehicleBoltPattern}</span>}
              {localSetupMode === "staggered" && (
                <span className="ml-2 rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                  🏁 Staggered Mode
                </span>
              )}
              {state.buildType !== "stock" && state.liftConfig && (
                <span className={`ml-2 rounded px-2 py-0.5 text-xs font-medium ${
                  state.buildType === "lifted" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {state.buildType === "leveled" ? "Leveled" : `${state.liftConfig.liftInches}" Lift`}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-500">Sort by</span>
            <AutoSubmitSelect
              name="sort"
              defaultValue={sort}
              className="h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm"
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
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {state.wheel.imageUrl && (
                  <img src={state.wheel.imageUrl} alt="" className="h-16 w-16 object-contain" />
                )}
                <div>
                  <div className="text-xs font-medium text-green-700">✓ Wheel Selected</div>
                  <div className="font-bold text-neutral-900">{state.wheel.brand} {state.wheel.model}</div>
                  <div className="text-sm text-neutral-600">
                    {formatWheelSize(state.wheel)}
                    {state.wheel.finish && ` • ${state.wheel.finish}`}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-neutral-900">${state.wheel.setPrice.toLocaleString()}</div>
                <div className="text-xs text-neutral-500">set of 4</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main content with sidebar */}
      <div className="mx-auto flex max-w-screen-2xl gap-6 px-6 py-6">
        {/* Sidebar */}
        <FilterSidebar
          facets={facets}
          filters={filters}
          onFilterChange={handleFilterChange}
          setupMode={localSetupMode}
          onSetupModeChange={handleSetupModeChange}
          vehicleSupportsStaggered={vehicleSupportsStaggered}
          staggeredCount={staggeredCount}
          squareCount={squareCount}
        />

        {/* Main content */}
        <div className="flex-1">
          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-flex items-center gap-3 text-neutral-600">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading wheels...
              </div>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-600">{error}</div>
          ) : filteredWheels.length === 0 ? (
            <div className="py-12 text-center text-neutral-500">
              <p>No wheels found for this configuration.</p>
              {localSetupMode === "staggered" && (
                <p className="mt-2">Try switching to Square setup for more options.</p>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-neutral-600">
                Showing {pagedWheels.length} of {filteredWheels.length} wheels
                {localSetupMode === "staggered" && (
                  <span className="ml-2 text-purple-600">(staggered pairs only)</span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pagedWheels.map((wheel, idx) => (
                  <POSWheelCard
                    key={wheel.sku || idx}
                    wheel={wheel}
                    showAsStaggered={localSetupMode === "staggered"}
                    onSelect={handleSelectWheel}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <span className="text-sm text-neutral-500">Page {safePage} of {totalPages}</span>
                  {safePage < totalPages && (
                    <Link
                      href={`/pos/wheels?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}&page=${safePage + 1}`}
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Next
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
