"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePOS, type POSTire } from "@/components/pos/POSContext";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { createSelectedTire, formatTireSize, formatWheelSize } from "@/lib/fitment/staggeredFitment";
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

type Props = {
  year: string;
  make: string;
  model: string;
  trim: string;
  wheelDia?: string;
  wheelWidth?: string;
  searchParams: Record<string, string | string[] | undefined>;
};

// ============================================================================
// Helper
// ============================================================================

function safeString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
}

/**
 * Parse a tire size string into components
 * e.g., "255/40R19" → { width: 255, aspect: 40, rim: 19 }
 */
function parseTireSize(size: string): { width: number; aspect: number; rim: number } | null {
  const m = size.match(/^(\d{3})\/(\d{2})R(\d{2})$/i);
  if (!m) return null;
  return {
    width: parseInt(m[1], 10),
    aspect: parseInt(m[2], 10),
    rim: parseInt(m[3], 10),
  };
}

/**
 * Calculate overall tire diameter in inches
 * Formula: rim + 2 × (width_mm × aspect% / 25.4 / 100)
 */
function calculateOverallDiameter(width: number, aspect: number, rim: number): number {
  const sidewallInches = (width * aspect / 100) / 25.4;
  return rim + (2 * sidewallInches);
}

/**
 * Calculate appropriate tire width range for a wheel width
 * Based on actual tire manufacturer fitment guidelines:
 * 
 * Wheel  | Tire Width Range
 * 7"     | 195-225mm
 * 7.5"   | 205-235mm
 * 8"     | 215-245mm
 * 8.5"   | 225-255mm
 * 9"     | 235-275mm
 * 9.5"   | 245-285mm
 * 10"    | 255-295mm
 * 10.5"  | 265-305mm
 * 11"    | 275-315mm
 * 12"    | 295-335mm
 * 
 * @param wheelWidthInches - Wheel width in inches
 * @returns { min, max } tire width in mm
 */
function getTireWidthRange(wheelWidthInches: number): { min: number; max: number } {
  // More accurate formula based on industry fitment charts
  // Min: roughly (wheel_width - 0.5") × 25.4 + 10
  // Max: roughly (wheel_width + 1.5") × 25.4 + 20 (allowing some stretch)
  const minWidth = Math.round((wheelWidthInches - 0.5) * 25.4 + 10);
  const maxWidth = Math.round((wheelWidthInches + 1.5) * 25.4 + 20);
  return { min: minWidth, max: maxWidth };
}

/**
 * Generate plus-size tire options for a different wheel diameter
 * Maintains overall diameter within ±3% of original AND fits the wheel width
 * 
 * @param oemSize - Original tire size (e.g., "255/40R19")
 * @param targetRim - Target wheel diameter (e.g., 20)
 * @param wheelWidth - Optional wheel width in inches (for filtering)
 * @returns Array of tire size strings that fit the new wheel
 */
function generatePlusSizeOptions(oemSize: string, targetRim: number, wheelWidth?: number): string[] {
  const parsed = parseTireSize(oemSize);
  if (!parsed) return [];
  
  const oemDiameter = calculateOverallDiameter(parsed.width, parsed.aspect, parsed.rim);
  const results: string[] = [];
  
  // Determine valid tire width range based on wheel width
  let minTireWidth = 195;
  let maxTireWidth = 335;
  
  if (wheelWidth && wheelWidth > 0) {
    const range = getTireWidthRange(wheelWidth);
    minTireWidth = range.min;
    maxTireWidth = range.max;
  }
  
  // Common tire widths to try (filtered by wheel width compatibility)
  const allWidths = [195, 205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315, 325, 335];
  const widths = allWidths.filter(w => w >= minTireWidth && w <= maxTireWidth);
  
  // Common aspect ratios
  const aspects = [25, 30, 35, 40, 45, 50];
  
  for (const width of widths) {
    for (const aspect of aspects) {
      const diameter = calculateOverallDiameter(width, aspect, targetRim);
      const diff = Math.abs(diameter - oemDiameter) / oemDiameter;
      
      // Within 3% of original diameter
      if (diff <= 0.03) {
        results.push(`${width}/${aspect}R${targetRim}`);
      }
    }
  }
  
  // Sort by closest to original diameter, then by width (prefer closer to OEM width)
  const oemWidth = parsed.width;
  results.sort((a, b) => {
    const pa = parseTireSize(a)!;
    const pb = parseTireSize(b)!;
    const da = Math.abs(calculateOverallDiameter(pa.width, pa.aspect, targetRim) - oemDiameter);
    const db = Math.abs(calculateOverallDiameter(pb.width, pb.aspect, targetRim) - oemDiameter);
    // Primarily sort by diameter match
    if (Math.abs(da - db) > 0.1) return da - db;
    // Secondary: prefer width closer to OEM
    return Math.abs(pa.width - oemWidth) - Math.abs(pb.width - oemWidth);
  });
  
  return results.slice(0, 8); // Return top 8 options
}

// ============================================================================
// Tire Card Component (Square)
// ============================================================================

function POSTireCard({
  tire,
  onSelect,
}: {
  tire: TireItem;
  onSelect: (tire: TireItem) => void;
}) {
  const currentPrice = tire.price || 0;
  const setPrice = currentPrice * 4;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:shadow-md">
      {/* Image */}
      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-neutral-100">
        {tire.imageUrl ? (
          <img src={tire.imageUrl} alt={tire.model} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-neutral-300">🛞</div>
        )}
      </div>

      {/* Info */}
      <div className="mb-2">
        <div className="text-sm font-bold text-neutral-900">{tire.brand}</div>
        <div className="text-sm text-neutral-600">{tire.model}</div>
      </div>

      {/* Size */}
      <div className="mb-2 text-xs text-neutral-500">
        {tire.size}
        {tire.loadIndex && tire.speedRating && (
          <span className="ml-1">({tire.loadIndex}{tire.speedRating})</span>
        )}
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
        onClick={() => onSelect(tire)}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        Select This Tire
      </button>
    </div>
  );
}

// ============================================================================
// Staggered Pair Card Component
// ============================================================================

function POSStaggeredTireCard({
  pair,
  onSelect,
}: {
  pair: { front: TireItem; rear: TireItem };
  onSelect: (pair: { front: TireItem; rear: TireItem }) => void;
}) {
  const frontPrice = pair.front.price || 0;
  const rearPrice = pair.rear.price || 0;
  const setPrice = (frontPrice * 2) + (rearPrice * 2); // 2 front + 2 rear

  return (
    <div className="rounded-xl border-2 border-purple-200 bg-white p-4 transition-all hover:shadow-md hover:border-purple-400">
      {/* Staggered Badge */}
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">🏁 Staggered Pair</span>
      </div>

      {/* Image */}
      <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-lg bg-neutral-100">
        {pair.front.imageUrl ? (
          <img src={pair.front.imageUrl} alt={pair.front.model} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-neutral-300">🛞</div>
        )}
      </div>

      {/* Info */}
      <div className="mb-2">
        <div className="text-sm font-bold text-neutral-900">{pair.front.brand}</div>
        <div className="text-sm text-neutral-600">{pair.front.model}</div>
      </div>

      {/* Sizes */}
      <div className="mb-3 space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-700">F:</span>
          <span className="text-neutral-600">{pair.front.size}</span>
          <span className="text-neutral-400">${frontPrice} × 2</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-700">R:</span>
          <span className="text-neutral-600">{pair.rear.size}</span>
          <span className="text-neutral-400">${rearPrice} × 2</span>
        </div>
      </div>

      {/* Price */}
      <div className="mb-3 rounded-lg bg-purple-50 p-2 text-center">
        <div className="text-xl font-bold text-neutral-900">${setPrice.toLocaleString()}</div>
        <div className="text-xs text-neutral-500">set of 4 (2F + 2R)</div>
      </div>

      {/* Select button */}
      <button
        onClick={() => onSelect(pair)}
        className="w-full rounded-lg bg-purple-600 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-purple-700"
      >
        Select This Pair
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function POSTiresClient({ year, make, model, trim, wheelDia, wheelWidth, searchParams }: Props) {
  const router = useRouter();
  const { state, setTire, isStaggered, goToStep } = usePOS();

  const [tires, setTires] = useState<TireItem[]>([]);
  const [staggeredPairs, setStaggeredPairs] = useState<Array<{ front: TireItem; rear: TireItem }>>([]);
  const [facets, setFacets] = useState<Facets>({ brands: [], sizes: [], speedRatings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Available tire sizes for size chip selector
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [showAllSizes, setShowAllSizes] = useState(false);

  // URL-based staggered params (for custom wheel setups)
  const staggeredUrlParam = safeString(searchParams.staggered) === "true";
  const rearDiaParam = safeString(searchParams.rearDia);
  const rearWidthParam = safeString(searchParams.rearWidth);
  
  // Get staggered tire sizes from context (set by build type step from fitment API)
  const frontTireSizeFromContext = state.staggeredInfo?.frontSpec?.tireSize;
  const rearTireSizeFromContext = state.staggeredInfo?.rearSpec?.tireSize;
  
  // For URL-based staggered with different diameters, we need to calculate tire sizes
  // based on the wheel diameters and OEM overall diameter
  const [calculatedFrontSize, setCalculatedFrontSize] = useState<string | null>(null);
  const [calculatedRearSize, setCalculatedRearSize] = useState<string | null>(null);
  
  // Effective tire sizes: from context or calculated from wheel specs
  const frontTireSize = frontTireSizeFromContext || calculatedFrontSize;
  const rearTireSize = rearTireSizeFromContext || calculatedRearSize;
  
  // Staggered mode: from context OR from URL params
  const isStaggeredMode = (isStaggered && Boolean(frontTireSize) && Boolean(rearTireSize)) ||
                          (staggeredUrlParam && Boolean(rearDiaParam));

  // Extract filter params
  const sort = safeString(searchParams.sort) || "price_asc";
  const brand = safeString(searchParams.brand);
  const sizeParam = safeString(searchParams.size);
  
  // Selected size: from URL param, or default to OEM/staggered size
  const selectedSize = sizeParam || (isStaggeredMode ? frontTireSize : null);

  const hasVehicle = Boolean(year && make && model);
  const hasWheel = Boolean(state.wheel?.diameter);
  const effectiveWheelDia = wheelDia || state.wheel?.diameter;

  // Calculate tire sizes for custom wheel setups (different front/rear diameters)
  useEffect(() => {
    if (!staggeredUrlParam || !hasVehicle || frontTireSizeFromContext) return;
    
    const calculateSizes = async () => {
      try {
        // Fetch OEM tire sizes to get reference overall diameter
        const params = new URLSearchParams({ year, make, model });
        if (trim) params.set("modification", trim);
        const res = await fetch(`/api/vehicles/tire-sizes?${params}`);
        if (!res.ok) return;
        
        const data = await res.json();
        const oemSizes: string[] = data.tireSizes || [];
        if (oemSizes.length === 0) return;
        
        // Use first OEM size as reference for overall diameter
        const refSize = oemSizes[0];
        const frontDia = parseInt(wheelDia || "0", 10);
        const frontWidth = parseFloat(wheelWidth || "0");
        const rearDia = parseInt(rearDiaParam || "0", 10);
        const rearWidth = parseFloat(rearWidthParam || "0");
        
        if (frontDia > 0) {
          const frontOptions = generatePlusSizeOptions(refSize, frontDia, frontWidth || undefined);
          if (frontOptions.length > 0) setCalculatedFrontSize(frontOptions[0]);
        }
        
        if (rearDia > 0) {
          // For rear, use second OEM size if available (for staggered vehicles)
          const rearRefSize = oemSizes.length > 1 ? oemSizes[1] : oemSizes[0];
          const rearOptions = generatePlusSizeOptions(rearRefSize, rearDia, rearWidth || undefined);
          if (rearOptions.length > 0) setCalculatedRearSize(rearOptions[0]);
        }
      } catch (err) {
        console.error("[POSTiresClient] Failed to calculate tire sizes:", err);
      }
    };
    
    calculateSizes();
  }, [staggeredUrlParam, hasVehicle, year, make, model, trim, wheelDia, wheelWidth, rearDiaParam, rearWidthParam, frontTireSizeFromContext]);

  // Fetch available tire sizes for size chip selector
  useEffect(() => {
    if (!hasVehicle) return;
    
    const fetchSizes = async () => {
      try {
        const params = new URLSearchParams({ year, make, model });
        if (trim) params.set("modification", trim);
        
        const res = await fetch(`/api/vehicles/tire-sizes?${params}`);
        if (!res.ok) return;
        
        const data = await res.json();
        const oemSizes: string[] = data.tireSizes || data.sizes || [];
        let sizes: string[] = [];
        
        if (effectiveWheelDia) {
          const targetDia = parseInt(effectiveWheelDia, 10);
          
          // Check if we have OEM sizes for this diameter
          const oemForDia = oemSizes.filter((s: string) => {
            const m = s.match(/R(\d+)/i);
            return m && parseInt(m[1], 10) === targetDia;
          });
          
          if (oemForDia.length > 0) {
            // Use OEM sizes for this diameter
            sizes = oemForDia;
          } else if (oemSizes.length > 0) {
            // Plus-sizing: generate equivalent sizes for new diameter
            // Use the first OEM size as the reference for overall diameter
            const referenceSize = oemSizes[0];
            sizes = generatePlusSizeOptions(referenceSize, targetDia);
            
            // If we have staggered sizes, also generate plus-sizes for rear
            if (oemSizes.length > 1 && oemSizes[1] !== oemSizes[0]) {
              const rearPlusSizes = generatePlusSizeOptions(oemSizes[1], targetDia);
              // Add any unique rear sizes
              for (const s of rearPlusSizes) {
                if (!sizes.includes(s)) sizes.push(s);
              }
            }
          }
        } else {
          // No wheel diameter specified, show all OEM sizes
          sizes = oemSizes;
        }
        
        setAvailableSizes(sizes);
      } catch (err) {
        console.error("[POSTiresClient] Failed to fetch tire sizes:", err);
      }
    };
    
    fetchSizes();
  }, [year, make, model, trim, effectiveWheelDia, hasVehicle]);

  // Fetch tires (staggered uses dedicated staggered-search API, square uses regular search)
  useEffect(() => {
    if (!hasVehicle) {
      setTires([]);
      setStaggeredPairs([]);
      setLoading(false);
      return;
    }

    const normalizeTire = (t: any): TireItem => ({
      sku: t.sku || "",
      brand: t.brand || "",
      model: t.model || t.line || "",
      size: t.size || "",
      displayName: t.displayName || `${t.brand} ${t.model}`,
      imageUrl: t.imageUrl || t.images?.[0]?.imageUrlLarge,
      price: t.price || t.sellPrice || 0,
      loadIndex: t.loadIndex,
      speedRating: t.speedRating,
      sidewall: t.sidewall,
      warranty: t.warranty,
    });

    const fetchTires = async () => {
      setLoading(true);
      setError(null);

      try {
        // ═══════════════════════════════════════════════════════════════════
        // STAGGERED MODE: Use dedicated staggered-search API (same as retail)
        // This API finds matched pairs (same brand/model in different sizes)
        // ═══════════════════════════════════════════════════════════════════
        
        // If URL says staggered but we don't have tire sizes yet, wait for calculation
        if (staggeredUrlParam && rearDiaParam && (!frontTireSize || !rearTireSize)) {
          console.log("[POSTiresClient] Waiting for staggered tire sizes to be calculated...");
          setLoading(true);
          return; // Effect will re-run when calculated sizes are set
        }
        
        if (isStaggeredMode && frontTireSize && rearTireSize) {
          const staggeredUrl = `/api/tires/staggered-search?frontSize=${encodeURIComponent(frontTireSize)}&rearSize=${encodeURIComponent(rearTireSize)}&minQty=2`;
          const res = await fetch(staggeredUrl);
          
          if (res.ok) {
            const data = await res.json();
            const pairs: Array<{ front: TireItem; rear: TireItem }> = (data.pairs || []).map((p: any) => ({
              front: normalizeTire(p.front),
              rear: normalizeTire(p.rear),
            }));
            
            setStaggeredPairs(pairs);
            setTires([]);
            console.log(`[POSTiresClient] Staggered search: ${pairs.length} pairs for ${frontTireSize} / ${rearTireSize}`);
          } else {
            console.error("[POSTiresClient] Staggered search failed:", res.status);
            setStaggeredPairs([]);
            setTires([]);
          }
          
          setLoading(false);
          return;
        }

        // ═══════════════════════════════════════════════════════════════════
        // SQUARE MODE: Regular tire search by vehicle + wheel diameter
        // ═══════════════════════════════════════════════════════════════════
        const params = new URLSearchParams({ year, make, model });
        if (trim) params.set("trim", trim);
        if (wheelDia || state.wheel?.diameter) {
          params.set("wheelDia", wheelDia || state.wheel?.diameter || "");
        }
        if (brand) params.set("brand", brand);
        if (selectedSize) params.set("size", selectedSize);
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
        const tireResults: TireItem[] = (data.results || []).map(normalizeTire);

        // Build facets
        if (data.facets) {
          setFacets({
            brands: data.facets.brands || [],
            sizes: data.facets.sizes || [],
            speedRatings: data.facets.speedRatings || [],
          });
        }

        setTires(tireResults);
        setStaggeredPairs([]);
      } catch (err) {
        console.error("[POSTiresClient] Fetch error:", err);
        setError("Unable to load tires. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTires();
  }, [year, make, model, trim, wheelDia, brand, selectedSize, hasVehicle, state.wheel?.diameter, state.buildType, state.liftConfig, isStaggeredMode, frontTireSize, rearTireSize, staggeredUrlParam, rearDiaParam]);

  // Handle tire selection (square mode)
  const handleSelectTire = useCallback((tire: TireItem) => {
    const selectedTire = createSelectedTire(tire, undefined, "square");
    const posTire: POSTire = {
      ...selectedTire,
      quantity: 4,
      loadIndex: tire.loadIndex,
      speedRating: tire.speedRating,
    };
    setTire(posTire);
    goToStep("pricing");
    router.push("/pos");
  }, [setTire, goToStep, router]);

  // Handle staggered pair selection
  const handleSelectPair = useCallback((pair: { front: TireItem; rear: TireItem }) => {
    const selectedTire = createSelectedTire(pair.front, pair.rear, "staggered");
    const posTire: POSTire = {
      ...selectedTire,
      quantity: 4,
      loadIndex: pair.front.loadIndex,
      speedRating: pair.front.speedRating,
    };
    setTire(posTire);
    goToStep("pricing");
    router.push("/pos");
  }, [setTire, goToStep, router]);

  // No vehicle selected
  if (!hasVehicle) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold text-neutral-900">Select a Vehicle First</h1>
          <p className="mt-2 text-neutral-600">Please go back and select a vehicle.</p>
          <Link href="/pos" className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white">
            Back to POS
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
            <Link
              href={`/pos/wheels?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}`}
              className="text-sm text-blue-600 hover:underline"
            >
              ← Back to Wheels
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">Select Tires</h1>
            <p className="text-sm text-neutral-600">
              {year} {make} {model} {trim}
              {isStaggered && (
                <span className="ml-2 rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                  🏁 Staggered
                </span>
              )}
              {state.buildType !== "stock" && state.liftConfig && (
                <span className={`ml-2 rounded px-2 py-0.5 text-xs font-medium ${
                  state.buildType === "lifted"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-blue-100 text-blue-700"
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
                  <img src={state.wheel.imageUrl} alt="" className="h-12 w-12 object-contain" />
                )}
                <div>
                  <div className="text-xs font-medium text-green-700">✓ Wheels Selected</div>
                  <div className="font-bold text-neutral-900">{state.wheel.brand} {state.wheel.model}</div>
                  <div className="text-sm text-neutral-600">
                    {formatWheelSize(state.wheel)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-neutral-900">${state.wheel.setPrice.toLocaleString()}</div>
                <div className="text-xs text-neutral-500">set of 4</div>
              </div>
            </div>
          </div>
        )}

        {/* Staggered info - from context or URL params */}
        {isStaggeredMode && (frontTireSize || rearTireSize) && (
          <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏁</span>
              <div>
                <div className="font-semibold text-purple-900">Staggered Tires</div>
                <div className="text-sm text-purple-700">
                  Front: {frontTireSize || "calculating..."} • Rear: {rearTireSize || "calculating..."}
                </div>
                {wheelDia !== rearDiaParam && rearDiaParam && (
                  <div className="mt-1 text-xs text-purple-600">
                    Mixed diameter: {wheelDia}" front / {rearDiaParam}" rear
                  </div>
                )}
                <div className="mt-1 text-xs text-purple-600">
                  Showing matched pairs (same brand/model in both sizes).
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tire Size Chips - for square mode only (staggered uses fixed sizes) */}
        {!isStaggeredMode && availableSizes.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-neutral-500">Tire Size</span>
              {effectiveWheelDia && (
                <span className="text-[11px] text-neutral-400">for {effectiveWheelDia}" wheels</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(showAllSizes ? availableSizes : availableSizes.slice(0, 5)).map((s) => {
                const active = s === selectedSize;
                const href = `/pos/tires?year=${year}&make=${make}&model=${model}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${effectiveWheelDia ? `&wheelDia=${effectiveWheelDia}` : ""}&size=${encodeURIComponent(s)}`;
                return (
                  <Link
                    key={s}
                    href={href}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? "bg-neutral-900 text-white shadow-sm"
                        : "bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
                    }`}
                  >
                    {active && <span className="mr-1 text-green-400">✓</span>}
                    {s}
                  </Link>
                );
              })}
              
              {/* Show more button */}
              {availableSizes.length > 5 && !showAllSizes && (
                <button
                  onClick={() => setShowAllSizes(true)}
                  className="rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 transition-colors"
                >
                  +{availableSizes.length - 5} more
                </button>
              )}
              
              {/* Collapse button */}
              {showAllSizes && availableSizes.length > 5 && (
                <button
                  onClick={() => setShowAllSizes(false)}
                  className="rounded-full border border-neutral-200 px-2 py-1 text-[10px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  Show less
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-flex items-center gap-3 text-neutral-600">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading tires...
            </div>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-600">{error}</div>
        ) : isStaggeredMode ? (
          // Staggered mode - show matched pairs
          staggeredPairs.length === 0 ? (
            <div className="mx-auto max-w-lg py-12 text-center">
              <div className="text-4xl mb-4">🛞</div>
              <p className="text-lg font-medium text-neutral-700">No Staggered Tire Pairs Available</p>
              <p className="mt-2 text-sm text-neutral-500">
                Staggered setups need matched front/rear pairs, but we couldn't find any
                for {frontTireSize} (F) / {rearTireSize} (R).
              </p>
              <div className="mt-6 space-y-3">
                <p className="text-sm font-medium text-neutral-600">Options:</p>
                <Link
                  href={`/pos/wheels?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}`}
                  className="inline-block rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  ← Try Different Wheels
                </Link>
                <p className="text-xs text-neutral-400">
                  Or select a square (same size all around) wheel setup
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded bg-purple-100 px-2 py-1 text-sm font-medium text-purple-700">🏁 Staggered Mode</span>
                <span className="text-sm text-neutral-600">
                  {staggeredPairs.length} matched pairs ({frontTireSize} / {rearTireSize})
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {staggeredPairs.map((pair, idx) => (
                  <POSStaggeredTireCard
                    key={`${pair.front.sku}-${pair.rear.sku}` || idx}
                    pair={pair}
                    onSelect={handleSelectPair}
                  />
                ))}
              </div>
            </>
          )
        ) : (
          // Square mode - show single tire grid
          tires.length === 0 ? (
            <div className="py-12 text-center text-neutral-500">
              No tires found for this configuration.
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-neutral-600">
                Showing {tires.length} tires
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tires.map((tire, idx) => (
                  <POSTireCard
                    key={tire.sku || idx}
                    tire={tire}
                    onSelect={handleSelectTire}
                  />
                ))}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
