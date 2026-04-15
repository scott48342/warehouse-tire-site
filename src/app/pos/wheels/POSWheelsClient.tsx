"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { WheelsStyleCard, type WheelFinishThumb } from "@/components/WheelsStyleCard";
import { WheelFilterSidebar } from "@/components/WheelFilterSidebar";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { usePOS, type POSWheel } from "@/components/pos/POSContext";

// ============================================================================
// Types
// ============================================================================

type WheelFinish = {
  sku: string;
  finish: string;
  imageUrl?: string;
  price?: number;
  stockQty?: number;
  inventoryType?: string;
  // Full specs for this finish variant
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  centerbore?: string;
  fitmentClass?: "surefit" | "specfit" | "extended";
};

type WheelItem = {
  sku?: string;
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
  finishThumbs?: WheelFinish[];
};

type Facets = {
  brands: Array<{ code: string; desc: string; count?: number }>;
  finishes: Array<{ value: string; count?: number }>;
  diameters: Array<{ value: string; count?: number }>;
  widths: Array<{ value: string; count?: number }>;
  offsets: Array<{ value: string; count?: number }>;
  boltPatterns: Array<{ value: string; count?: number }>;
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

// Extract wheel style code from SKU (e.g., "XD852" from "XD85229087700")
function extractStyleFromSku(sku: string): string {
  if (!sku) return "";
  // WheelPros SKUs have various patterns - extract the style prefix
  // Examples: 
  //   XD85229087700 → XD852
  //   KM54429087400 → KM544  
  //   MO96229087318 → MO962
  //   1069-7983MB → 1069
  //   AR172785114 → AR172 (American Racing pattern)
  
  // Try pattern: 1-3 letters followed by 2-4 digits (XD852, KM544, AR172)
  const alphaNumMatch = sku.match(/^([A-Z]{1,3}\d{2,4})/i);
  if (alphaNumMatch) return alphaNumMatch[1].toUpperCase();
  
  // Try pattern: digits followed by dash (1069-7983MB → 1069)
  const dashMatch = sku.match(/^(\d{3,5})-/);
  if (dashMatch) return dashMatch[1];
  
  // Fallback: first 5-6 chars as style identifier
  return sku.slice(0, 6).toUpperCase();
}

function groupWheelsByStyle(items: WheelItem[]): WheelItem[] {
  const grouped = new Map<string, WheelItem>();
  
  for (const item of items) {
    // Group by brand + STYLE CODE + diameter + width + boltPattern
    // Extract style from SKU (e.g., XD852) since techfeed.style is not available
    // This prevents different wheel designs from being grouped together
    const styleCode = extractStyleFromSku(item.sku || "") || item.styleKey || item.model || "unknown";
    const groupKey = `${item.brand}-${styleCode}-${item.diameter}-${item.width}-${item.boltPattern}`;
    
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, { ...item, finishThumbs: [] });
    }
    
    const existing = grouped.get(groupKey)!;
    if (item.finish && item.sku) {
      existing.finishThumbs = existing.finishThumbs || [];
      const alreadyHasFinish = existing.finishThumbs.some(f => f.sku === item.sku);
      if (!alreadyHasFinish) {
        // Store FULL wheel data so clicking a finish has all the specs
        existing.finishThumbs.push({
          finish: item.finish,
          sku: item.sku,
          imageUrl: item.imageUrl,
          price: item.price,
          stockQty: item.stockQty,
          inventoryType: item.inventoryType,
          // Include full specs for this finish variant
          diameter: item.diameter,
          width: item.width,
          offset: item.offset,
          boltPattern: item.boltPattern,
          centerbore: item.centerbore,
          fitmentClass: item.fitmentClass,
        });
      }
    }
  }
  
  return Array.from(grouped.values());
}

// ============================================================================
// POS Wheel Card - With finish switching
// ============================================================================

function POSWheelCard({ 
  wheel, 
  onSelect 
}: { 
  wheel: WheelItem; 
  onSelect: (wheel: WheelItem) => void;
}) {
  // Track currently selected finish (stores full finish data)
  const [currentFinishData, setCurrentFinishData] = useState<WheelFinish | null>(null);
  
  // Derive current display values from selected finish or default wheel
  const currentSku = currentFinishData?.sku || wheel.sku;
  const currentImage = currentFinishData?.imageUrl || wheel.imageUrl;
  const currentFinish = currentFinishData?.finish || wheel.finish;
  const currentPrice = currentFinishData?.price ?? wheel.price;
  const currentOffset = currentFinishData?.offset || wheel.offset;
  const currentFitmentClass = currentFinishData?.fitmentClass || wheel.fitmentClass;
  
  const hasMultipleFinishes = wheel.finishThumbs && wheel.finishThumbs.length > 1;
  
  // Handle finish thumbnail click - store FULL finish data
  const handleFinishClick = (e: React.MouseEvent, finish: WheelFinish) => {
    e.stopPropagation(); // Prevent card selection
    setCurrentFinishData(finish);
  };
  
  // Handle card selection - uses current finish data with all specs
  const handleSelect = () => {
    if (currentFinishData) {
      // Use the selected finish's full data
      onSelect({
        ...wheel,
        sku: currentFinishData.sku,
        imageUrl: currentFinishData.imageUrl,
        finish: currentFinishData.finish,
        price: currentFinishData.price,
        diameter: currentFinishData.diameter || wheel.diameter,
        width: currentFinishData.width || wheel.width,
        offset: currentFinishData.offset || wheel.offset,
        boltPattern: currentFinishData.boltPattern || wheel.boltPattern,
        centerbore: currentFinishData.centerbore || wheel.centerbore,
        fitmentClass: currentFinishData.fitmentClass || wheel.fitmentClass,
      });
    } else {
      // Use default wheel data
      onSelect(wheel);
    }
  };
  
  const setPrice = (currentPrice || 0) * 4;
  
  return (
    <div className="group rounded-xl border-2 border-gray-200 bg-white overflow-hidden transition-all hover:border-blue-500 hover:shadow-lg">
      {/* Clickable image area */}
      <button
        onClick={handleSelect}
        className="w-full text-left focus:outline-none"
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          {currentImage ? (
            <img 
              src={currentImage} 
              alt={`${wheel.brand} ${wheel.model}`}
              className="h-full w-full object-contain transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl text-gray-300">⚙️</div>
          )}
          
          {/* Fitment badge */}
          {currentFitmentClass && (
            <div className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-bold ${
              currentFitmentClass === "surefit" ? "bg-green-100 text-green-800" :
              currentFitmentClass === "specfit" ? "bg-blue-100 text-blue-800" :
              "bg-amber-100 text-amber-800"
            }`}>
              {currentFitmentClass === "surefit" ? "✓ SureFit" :
               currentFitmentClass === "specfit" ? "SpecFit" : "Extended"}
            </div>
          )}
        </div>
      </button>
      
      {/* Info section */}
      <div className="p-4">
        <div className="text-xs font-medium text-gray-500">{wheel.brand}</div>
        <div className="font-bold text-gray-900 truncate">{wheel.model}</div>
        <div className="text-sm text-gray-600">
          {wheel.diameter}" × {wheel.width}"
          {currentOffset && ` ET${currentOffset}`}
        </div>
        {currentFinish && (
          <div className="mt-1 text-xs text-gray-500 truncate">{currentFinish}</div>
        )}
        
        {/* Finish options - clickable to switch */}
        {hasMultipleFinishes && (
          <div className="mt-3 flex gap-1.5">
            {wheel.finishThumbs!.slice(0, 5).map((f, i) => {
              const isActive = f.sku === currentSku;
              return (
                <button
                  key={f.sku || i}
                  onClick={(e) => handleFinishClick(e, f)}
                  className={`h-8 w-8 rounded-full overflow-hidden border-2 transition-all ${
                    isActive 
                      ? "border-blue-500 ring-2 ring-blue-200" 
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                  title={f.finish}
                >
                  {f.imageUrl ? (
                    <img src={f.imageUrl} alt={f.finish} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gray-200" />
                  )}
                </button>
              );
            })}
            {wheel.finishThumbs!.length > 5 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500 font-medium">
                +{wheel.finishThumbs!.length - 5}
              </div>
            )}
          </div>
        )}
        
        {/* Price */}
        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <span className="text-xl font-bold text-gray-900">
              ${setPrice.toLocaleString()}
            </span>
            <span className="ml-1 text-xs text-gray-500">set of 4</span>
          </div>
          <span className="text-xs text-gray-400">
            ${(currentPrice || 0).toLocaleString()}/ea
          </span>
        </div>
        
        {/* Select button */}
        <button
          onClick={handleSelect}
          className="mt-3 w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Select This Wheel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function POSWheelsClient({ year, make, model, trim, searchParams }: Props) {
  const router = useRouter();
  const urlParams = useSearchParams();
  const { state, setWheel, goToStep } = usePOS();
  
  // State
  const [wheels, setWheels] = useState<WheelItem[]>([]);
  const [facets, setFacets] = useState<Facets>({
    brands: [],
    finishes: [],
    diameters: [],
    widths: [],
    offsets: [],
    boltPatterns: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [vehicleBoltPattern, setVehicleBoltPattern] = useState<string | undefined>();
  
  // Extract filter params
  const sort = safeString(searchParams.sort) || "price_asc";
  const page = Math.max(1, Number(safeString(searchParams.page)) || 1);
  const brandCd = safeString(searchParams.brand_cd);
  const finish = safeString(searchParams.finish);
  const diameterParam = safeString(searchParams.diameter);
  const widthParam = safeString(searchParams.width);
  const offsetParam = safeString(searchParams.offset);
  const priceMinRaw = safeString(searchParams.priceMin);
  const priceMaxRaw = safeString(searchParams.priceMax);
  const priceMin = priceMinRaw ? Number(priceMinRaw) : null;
  const priceMax = priceMaxRaw ? Number(priceMaxRaw) : null;
  
  const hasVehicle = Boolean(year && make && model);
  
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
          pageSize: "800", // Larger to get plus-sizes (20", 22", etc.)
          fields: "inventory,price,images,properties",
        });
        
        if (trim) params.set("trim", trim);
        if (brandCd) params.set("brand_cd", brandCd);
        if (finish) params.set("abbreviated_finish_desc", finish);
        if (diameterParam) params.set("diameter", diameterParam);
        if (widthParam) params.set("width", widthParam);
        
        const res = await fetch(`/api/wheels/fitment-search?${params}`);
        if (!res.ok) throw new Error("Failed to fetch wheels");
        
        const data = await res.json();
        
        // Extract bolt pattern from fitment
        if (data.fitment?.envelope?.boltPattern) {
          setVehicleBoltPattern(data.fitment.envelope.boltPattern);
        }
        
        // Process results
        const rawItems = data.results || data.items || [];
        const processed: WheelItem[] = rawItems.map((it: any) => {
          const brandObj = it?.brand && typeof it.brand === "object" ? it.brand : null;
          const brand = brandObj?.description ?? brandObj?.parent ?? brandObj?.code ?? (typeof it?.brand === "string" ? it.brand : undefined);
          const brandCode = brandObj?.code || undefined;
          
          const props = it?.properties || {};
          const prices = it?.prices || {};
          const msrp = prices?.msrp;
          const firstPrice = Array.isArray(msrp) ? msrp[0] : undefined;
          const price = firstPrice?.currencyAmount != null ? Number(firstPrice.currencyAmount) : undefined;
          
          const img0 = Array.isArray(it?.images) ? it.images[0] : undefined;
          const imageUrl = img0?.imageUrlLarge || img0?.imageUrlMedium || img0?.imageUrlOriginal || undefined;
          
          const inventory = it?.inventory;
          const localStock = typeof inventory?.localStock === "number" ? inventory.localStock : 0;
          const globalStock = typeof inventory?.globalStock === "number" ? inventory.globalStock : 0;
          
          return {
            sku: it?.sku || it?.partNumber,
            brand,
            brandCode,
            model: props?.model || it?.techfeed?.style || "",
            finish: it?.techfeed?.finish || props?.abbreviated_finish_desc || props?.finish,
            diameter: props?.diameter ? String(props.diameter) : undefined,
            width: props?.width ? String(props.width) : undefined,
            offset: props?.offset ? String(props.offset) : undefined,
            boltPattern: props?.boltPatternMetric || props?.boltPattern,
            centerbore: props?.centerbore ? String(props.centerbore) : undefined,
            imageUrl,
            price,
            stockQty: localStock + globalStock,
            inventoryType: inventory?.type?.toUpperCase(),
            styleKey: it?.techfeed?.style,
            fitmentClass: it?.fitmentValidation?.fitmentClass,
          };
        });
        
        // Group by style
        const grouped = groupWheelsByStyle(processed);
        
        // Sort
        const sorted = [...grouped].sort((a, b) => {
          const aPrice = a.price ?? Infinity;
          const bPrice = b.price ?? Infinity;
          switch (sort) {
            case "price_desc": return bPrice - aPrice;
            case "brand_asc": return (a.brand || "").localeCompare(b.brand || "");
            default: return aPrice - bPrice;
          }
        });
        
        setWheels(sorted);
        setTotalCount(data.totalCount || sorted.length);
        
        // Build facets from results
        const brandMap = new Map<string, { code: string; desc: string; count: number }>();
        const finishMap = new Map<string, number>();
        const diameterMap = new Map<string, number>();
        const widthMap = new Map<string, number>();
        const offsetMap = new Map<string, number>();
        const bpMap = new Map<string, number>();
        
        for (const w of processed) {
          if (w.brandCode) {
            const existing = brandMap.get(w.brandCode);
            if (existing) {
              existing.count++;
            } else {
              brandMap.set(w.brandCode, { code: w.brandCode, desc: w.brand || w.brandCode, count: 1 });
            }
          }
          if (w.finish) finishMap.set(w.finish, (finishMap.get(w.finish) || 0) + 1);
          if (w.diameter) diameterMap.set(w.diameter, (diameterMap.get(w.diameter) || 0) + 1);
          if (w.width) widthMap.set(w.width, (widthMap.get(w.width) || 0) + 1);
          if (w.offset) offsetMap.set(w.offset, (offsetMap.get(w.offset) || 0) + 1);
          if (w.boltPattern) bpMap.set(w.boltPattern, (bpMap.get(w.boltPattern) || 0) + 1);
        }
        
        setFacets({
          brands: Array.from(brandMap.values()).sort((a, b) => a.desc.localeCompare(b.desc)),
          finishes: Array.from(finishMap.entries()).map(([value, count]) => ({ value, count })),
          diameters: Array.from(diameterMap.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => parseFloat(a.value) - parseFloat(b.value)),
          widths: Array.from(widthMap.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => parseFloat(a.value) - parseFloat(b.value)),
          offsets: Array.from(offsetMap.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => parseFloat(a.value) - parseFloat(b.value)),
          boltPatterns: Array.from(bpMap.entries()).map(([value, count]) => ({ value, count })),
        });
        
      } catch (err) {
        console.error("[POS Wheels] Fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    
    fetchWheels();
  }, [year, make, model, trim, brandCd, finish, diameterParam, widthParam, sort, hasVehicle]);
  
  // Client-side filtering for price
  const filteredWheels = useMemo(() => {
    let result = wheels;
    
    if (priceMin != null) {
      result = result.filter(w => (w.price ?? 0) >= priceMin);
    }
    if (priceMax != null) {
      result = result.filter(w => (w.price ?? Infinity) <= priceMax);
    }
    if (offsetParam) {
      result = result.filter(w => w.offset === offsetParam);
    }
    
    return result;
  }, [wheels, priceMin, priceMax, offsetParam]);
  
  // Pagination
  const itemsPerPage = 24;
  const totalPages = Math.max(1, Math.ceil(filteredWheels.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const pagedWheels = filteredWheels.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);
  
  // Handle wheel selection
  const handleSelectWheel = useCallback((wheel: WheelItem) => {
    const posWheel: POSWheel = {
      sku: wheel.sku || "",
      brand: wheel.brand || "",
      model: wheel.model || "",
      finish: wheel.finish,
      diameter: wheel.diameter || "",
      width: wheel.width || "",
      offset: wheel.offset,
      boltPattern: wheel.boltPattern,
      imageUrl: wheel.imageUrl,
      unitPrice: wheel.price || 0,
      setPrice: (wheel.price || 0) * 4,
      quantity: 4,
      fitmentClass: wheel.fitmentClass,
    };
    
    setWheel(posWheel);
    
    // Navigate to tires selection
    router.push(`/pos/tires?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}&wheelDia=${wheel.diameter}&wheelWidth=${wheel.width}`);
  }, [setWheel, router, year, make, model, trim]);
  
  // Build URL for filter changes
  const buildFilterUrl = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams();
    params.set("year", year);
    params.set("make", make);
    params.set("model", model);
    if (trim) params.set("trim", trim);
    if (sort && sort !== "price_asc") params.set("sort", sort);
    if (brandCd && updates.brand_cd !== null) params.set("brand_cd", updates.brand_cd ?? brandCd);
    if (finish && updates.finish !== null) params.set("finish", updates.finish ?? finish);
    if (diameterParam && updates.diameter !== null) params.set("diameter", updates.diameter ?? diameterParam);
    if (widthParam && updates.width !== null) params.set("width", updates.width ?? widthParam);
    if (offsetParam && updates.offset !== null) params.set("offset", updates.offset ?? offsetParam);
    if (priceMin && updates.priceMin !== null) params.set("priceMin", updates.priceMin ?? String(priceMin));
    if (priceMax && updates.priceMax !== null) params.set("priceMax", updates.priceMax ?? String(priceMax));
    
    // Apply updates
    for (const [key, val] of Object.entries(updates)) {
      if (val === null) {
        params.delete(key);
      } else if (val) {
        params.set(key, val);
      }
    }
    
    return `/pos/wheels?${params.toString()}`;
  }, [year, make, model, trim, sort, brandCd, finish, diameterParam, widthParam, offsetParam, priceMin, priceMax]);
  
  // No vehicle selected
  if (!hasVehicle) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold text-gray-900">Select a Vehicle First</h1>
          <p className="mt-2 text-gray-600">Please go back and select a vehicle to browse wheels.</p>
          <Link href="/pos" className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white">
            Back to Vehicle Selection
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
            <Link href="/pos" className="text-sm text-blue-600 hover:underline">
              ← Back to POS
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Select Wheels</h1>
            <p className="text-sm text-gray-600">
              {year} {make} {model} {trim}
              {vehicleBoltPattern && <span className="ml-2 text-gray-400">• {vehicleBoltPattern}</span>}
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
      </div>
      
      {/* Main content */}
      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar filters */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-4">
              <WheelFilterSidebar
                data={{
                  brands: brandCd ? [brandCd] : [],
                  finishes: finish ? [finish] : [],
                  diameters: diameterParam ? [diameterParam] : [],
                  widths: widthParam ? [widthParam] : [],
                  offsets: offsetParam ? [offsetParam] : [],
                  priceMin,
                  priceMax,
                  boltPattern: "",
                  
                  brandOptions: facets.brands,
                  finishOptions: facets.finishes,
                  diameterOptions: facets.diameters,
                  widthOptions: facets.widths,
                  offsetOptions: facets.offsets,
                  boltPatternOptions: facets.boltPatterns,
                  
                  basePath: "/pos/wheels",
                  year,
                  make,
                  model,
                  trim,
                  modification: "",
                  sort,
                  fitLevel: "oem",
                  
                  vehicleBoltPattern,
                  totalCount: filteredWheels.length,
                }}
              />
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
                  Loading wheels...
                </div>
              </div>
            ) : error ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
                <p className="text-red-800">{error}</p>
              </div>
            ) : filteredWheels.length === 0 ? (
              <div className="rounded-lg bg-gray-100 p-12 text-center">
                <p className="text-gray-600">No wheels found matching your criteria.</p>
                <Link 
                  href={`/pos/wheels?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}`}
                  className="mt-4 inline-block text-blue-600 hover:underline"
                >
                  Clear all filters
                </Link>
              </div>
            ) : (
              <>
                {/* Results count */}
                <div className="mb-4 text-sm text-gray-600">
                  Showing {pagedWheels.length} of {filteredWheels.length} wheels
                </div>
                
                {/* Quick diameter filter chips */}
                {facets.diameters.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="text-sm font-medium text-gray-700 py-1">Size:</span>
                    <Link
                      href={`/pos/wheels?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}${brandCd ? `&brand_cd=${brandCd}` : ""}${finish ? `&finish=${finish}` : ""}&sort=${sort}`}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        !diameterParam 
                          ? "bg-blue-600 text-white" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      All
                    </Link>
                    {facets.diameters
                      .sort((a, b) => parseFloat(a.value) - parseFloat(b.value))
                      .map((d) => (
                        <Link
                          key={d.value}
                          href={`/pos/wheels?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}&diameter=${d.value}${brandCd ? `&brand_cd=${brandCd}` : ""}${finish ? `&finish=${finish}` : ""}&sort=${sort}`}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            diameterParam === d.value 
                              ? "bg-blue-600 text-white" 
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {d.value}" <span className="text-xs opacity-70">({d.count})</span>
                        </Link>
                      ))}
                  </div>
                )}
                
                {/* Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pagedWheels.map((wheel) => (
                    <POSWheelCard
                      key={wheel.sku || `${wheel.brand}-${wheel.model}-${wheel.finish}`}
                      wheel={wheel}
                      onSelect={handleSelectWheel}
                    />
                  ))}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    {safePage > 1 && (
                      <Link
                        href={buildFilterUrl({ page: String(safePage - 1) })}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
                      >
                        Previous
                      </Link>
                    )}
                    
                    <span className="px-4 text-sm text-gray-600">
                      Page {safePage} of {totalPages}
                    </span>
                    
                    {safePage < totalPages && (
                      <Link
                        href={buildFilterUrl({ page: String(safePage + 1) })}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
                      >
                        Next
                      </Link>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
