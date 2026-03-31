"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import { FavoritesButton } from "@/components/FavoritesButton";
import { StickyPackageBar } from "@/components/StickyPackageBar";
import { calculateAccessoryFitment, type DBProfileForAccessories, type WheelForAccessories } from "@/hooks/useAccessoryFitment";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
export type TireItem = {
  source?: "wp" | "km" | "tw";
  rawSource?: string;
  partNumber?: string;
  mfgPartNumber?: string;
  brand?: string;
  description?: string;
  displayName?: string;
  prettyName?: string;
  cost?: number;
  quantity?: { primary?: number; alternate?: number; national?: number };
  imageUrl?: string;
  badges?: {
    terrain?: string | null;
    construction?: string | null;
    warrantyMiles?: number | null;
    loadIndex?: string | null;
    speedRating?: string | null;
  };
  tireLibraryId?: number;
};

export type SelectedWheel = {
  sku: string;
  brand: string;
  model: string;
  finish?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  imageUrl?: string;
  setPrice: number;
  centerBore?: number; // Wheel center bore in mm (for hub ring calculation)
  seatType?: string;   // Lug seat type (conical, ball, flat, mag)
};

export type SelectedTire = {
  sku: string;
  brand: string;
  model: string;
  size: string;
  setPrice: number;
  imageUrl?: string;
  loadIndex?: string;
  speedRating?: string;
  source?: string;
};

type TireCategory = "best-value" | "most-popular" | "premium";

type ViewParams = {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  modification?: string;
  wheelSku?: string;
  wheelDia?: string;
  selectedSize?: string;
};

type TiresGridProps = {
  tires: TireItem[];
  selectedSize: string;
  viewParams: ViewParams;
  selectedWheel?: SelectedWheel | null;
  /** DB fitment profile for accessory calculation (threadSize, seatType, centerBoreMm) */
  dbProfile?: DBProfileForAccessories | null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const PREMIUM_BRANDS = ["michelin", "bridgestone", "continental", "goodyear", "pirelli"];
const MID_TIER_BRANDS = ["cooper", "toyo", "bfgoodrich", "yokohama", "hankook", "falken", "general", "kumho", "nexen"];
const VALUE_BRANDS = ["westlake", "lionhart", "lexani", "atturo", "fullway", "roadone", "accelera", "sentury"];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function categorizeTire(tire: TireItem): TireCategory {
  const brand = String(tire.brand || "").toLowerCase();
  const price = typeof tire.cost === "number" ? tire.cost : 999;
  
  // Premium: known premium brands OR very expensive
  if (PREMIUM_BRANDS.includes(brand) || price >= 200) {
    return "premium";
  }
  
  // Best Value: budget brands OR cheap
  if (VALUE_BRANDS.includes(brand) || price < 100) {
    return "best-value";
  }
  
  // Most Popular: everything else (mid-tier brands)
  return "most-popular";
}

function getStockLevel(tire: TireItem): number {
  const q = tire.quantity || {};
  return (q.primary || 0) + (q.alternate || 0) + (q.national || 0);
}

function formatPrice(price: number): string {
  return price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTED WHEEL SUMMARY - REMOVED (displayed in TirePageCompactHeader)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// TIRE CARD - Clean, conversion-focused design with improved readability
// ═══════════════════════════════════════════════════════════════════════════════
function TireCard({
  tire,
  size,
  isSelected,
  hasSelection,
  onSelect,
  viewParams,
}: {
  tire: TireItem;
  size: string;
  isSelected: boolean;
  hasSelection: boolean;
  onSelect: () => void;
  viewParams: ViewParams;
}) {
  const brand = tire.brand || "Tire";
  const model = tire.displayName || tire.prettyName || tire.description || "";
  const price = typeof tire.cost === "number" ? tire.cost : null;
  const setPrice = price !== null ? price * 4 : null;
  const stock = getStockLevel(tire);
  const category = categorizeTire(tire);
  
  // Build detail URL
  const detailHref = tire.partNumber 
    ? `/tires/${encodeURIComponent(tire.partNumber)}?size=${encodeURIComponent(size)}`
    : "#";
  
  // Terrain type from badges or model name
  const terrainType = tire.badges?.terrain || 
    (model.toLowerCase().includes("all-terrain") || model.toLowerCase().includes("a/t") ? "All-Terrain" :
     model.toLowerCase().includes("mud") || model.toLowerCase().includes("m/t") ? "Mud-Terrain" :
     model.toLowerCase().includes("highway") || model.toLowerCase().includes("h/t") ? "Highway" :
     "All-Season");
  
  // Popular indicator (high stock = popular)
  const isPopular = category === "most-popular" || stock >= 20;
  
  return (
    <div 
      className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200 ${
        isSelected 
          ? "border-green-500 ring-2 ring-green-500 ring-offset-2 scale-[1.01]" 
          : hasSelection
            ? "border-neutral-200 opacity-75 hover:opacity-100"
            : "border-neutral-200 hover:shadow-md hover:border-neutral-300"
      }`}
    >
      {/* Selected badge */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white shadow-lg animate-bounce-once">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      
      {/* Guaranteed Fit badge - more compact */}
      <div className="bg-green-600 px-2 py-1 text-center">
        <span className="text-[10px] font-bold text-white tracking-wide">
          ✓ GUARANTEED FIT
        </span>
      </div>
      
      {/* Image - slightly smaller aspect for less vertical space */}
      <Link href={detailHref} className="block relative">
        <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-50 p-4">
          {tire.imageUrl ? (
            <img
              src={tire.imageUrl}
              alt={model}
              className="h-full w-full object-contain transition-transform hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-5xl text-neutral-200">🛞</div>
            </div>
          )}
        </div>
        
        {/* Favorites button */}
        <div className="absolute top-2 right-2">
          <FavoritesButton
            type="tire"
            sku={tire.partNumber || ""}
            label={`${brand} ${model}`}
            href={detailHref}
            imageUrl={tire.imageUrl}
          />
        </div>
        
        {/* Popular badge overlay */}
        {isPopular && (
          <div className="absolute bottom-2 left-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 shadow-sm">
              🔥 Popular
            </span>
          </div>
        )}
      </Link>
      
      {/* Content - improved spacing */}
      <div className="flex flex-1 flex-col p-4">
        {/* Brand - smaller */}
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{brand}</div>
        
        {/* Model Name - max 2 lines, better sizing */}
        <Link href={detailHref}>
          <h3 className="mt-0.5 text-base font-bold text-neutral-900 hover:text-neutral-700 transition-colors line-clamp-2 leading-tight min-h-[2.5rem]">
            {model}
          </h3>
        </Link>
        
        {/* Secondary specs - smaller, muted */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
          <span className="font-medium text-neutral-600">{size}</span>
          <span>•</span>
          <span>{terrainType}</span>
          {tire.badges?.warrantyMiles && tire.badges.warrantyMiles > 0 && (
            <>
              <span>•</span>
              <span>{(tire.badges.warrantyMiles / 1000).toFixed(0)}k mi</span>
            </>
          )}
        </div>
        
        <div className="flex-1 min-h-2" />
        
        {/* Price block - cleaner layout */}
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="text-xl font-extrabold text-neutral-900">
                {setPrice !== null 
                  ? `$${formatPrice(setPrice)}`
                  : "Call"
                }
              </div>
              {price !== null && (
                <div className="text-[11px] text-neutral-500">
                  ${formatPrice(price)}/ea × 4
                </div>
              )}
            </div>
            
            {/* Trust signals - ultra compact */}
            <div className="text-right text-[10px] text-neutral-500 hidden sm:block">
              <div className="flex items-center gap-1 justify-end">
                <span className="text-green-600">✓</span>
                Free Ship
              </div>
            </div>
          </div>
        </div>
        
        {/* CTA - stronger presence */}
        <button
          type="button"
          onClick={onSelect}
          disabled={isSelected}
          className={`
            mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl 
            text-sm font-bold transition-all duration-200
            ${isSelected
              ? "bg-green-600 text-white cursor-default"
              : hasSelection
                ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-200"
                : "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-lg shadow-red-600/20"
            }
          `}
        >
          {isSelected ? (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              Selected
            </>
          ) : hasSelection ? (
            "Switch to this"
          ) : (
            "Add to Package"
          )}
        </button>
        
        {/* View specs link */}
        <Link 
          href={detailHref}
          className="mt-1.5 text-center text-[11px] font-medium text-neutral-400 hover:text-neutral-600"
        >
          View specs →
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY SECTION
// ═══════════════════════════════════════════════════════════════════════════════
function CategorySection({
  title,
  subtitle,
  icon,
  tires,
  size,
  selectedTire,
  onSelectTire,
  viewParams,
  defaultExpanded = true,
}: {
  title: string;
  subtitle: string;
  icon: string;
  tires: TireItem[];
  size: string;
  selectedTire: SelectedTire | null;
  onSelectTire: (tire: TireItem) => void;
  viewParams: ViewParams;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  if (tires.length === 0) return null;
  
  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between rounded-xl bg-white border border-neutral-200 px-4 py-3 hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div className="text-left">
            <div className="text-base font-extrabold text-neutral-900">{title}</div>
            <div className="text-xs text-neutral-500">{subtitle}</div>
          </div>
          <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-600">
            {tires.length}
          </span>
        </div>
        <svg 
          className={`h-5 w-5 text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {expanded && (
        <div className="mt-4 grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {tires.slice(0, 10).map((tire, idx) => (
            <TireCard
              key={tire.partNumber || idx}
              tire={tire}
              size={size}
              isSelected={selectedTire?.sku === tire.partNumber}
              hasSelection={!!selectedTire}
              onSelect={() => onSelectTire(tire)}
              viewParams={viewParams}
            />
          ))}
        </div>
      )}
      
      {expanded && tires.length > 10 && (
        <div className="mt-4 text-center">
          <button className="rounded-lg bg-neutral-100 px-6 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-200 transition-colors">
            Show all {tires.length} options →
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE TOTAL - REMOVED (replaced by StickyPackageBar)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTION CONFIRMATION
// ═══════════════════════════════════════════════════════════════════════════════
function TireSelectionConfirmation({
  tire,
  wheel,
  onClear,
}: {
  tire: SelectedTire;
  wheel: SelectedWheel | null;
  onClear: () => void;
}) {
  const total = (wheel?.setPrice || 0) + tire.setPrice;
  
  return (
    <div className="animate-slide-up rounded-2xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4 shadow-lg shadow-green-100/50">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500 text-white shadow-lg shadow-green-500/30">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-green-800">Tires Selected</span>
            <span className="rounded-full bg-green-200 px-2 py-0.5 text-[10px] font-bold text-green-800">
              Package Complete!
            </span>
          </div>
          
          <div className="mt-2 flex items-center gap-3">
            {tire.imageUrl && (
              <img 
                src={tire.imageUrl} 
                alt={tire.model} 
                className="h-14 w-14 rounded-lg object-contain bg-white border border-green-100"
              />
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-neutral-900 truncate">
                {tire.brand} {tire.model}
              </div>
              <div className="text-xs text-neutral-600">{tire.size}</div>
              <div className="mt-0.5 text-sm font-extrabold text-green-700">
                ${formatPrice(tire.setPrice)} for 4
              </div>
            </div>
          </div>
          
          {/* Package summary */}
          <div className="mt-3 rounded-xl bg-white/80 border border-green-200 p-3">
            <div className="text-xs font-bold text-neutral-700 mb-1">Package Summary</div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">Wheels + Tires</span>
              <span className="font-extrabold text-neutral-900">${formatPrice(total)}</span>
            </div>
          </div>
          
          {/* CTAs */}
          <div className="mt-3 flex items-center gap-3">
            <Link
              href="/cart"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 text-sm font-extrabold text-white shadow-lg shadow-green-600/30 transition-all hover:bg-green-700 hover:shadow-xl active:scale-[0.98]"
            >
              Review & Checkout
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <button
              onClick={onClear}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              Change selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE STICKY BAR - REMOVED (replaced by unified StickyPackageBar)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SKIP TIRES OPTION
// ═══════════════════════════════════════════════════════════════════════════════
function SkipTiresOption() {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center">
      <div className="text-sm text-neutral-600">
        Already have tires? 
        <Link 
          href="/cart" 
          className="ml-2 font-semibold text-neutral-700 hover:text-neutral-900 underline underline-offset-2"
        >
          Continue with wheels only →
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function TiresGridWithSelection({
  tires,
  selectedSize,
  viewParams,
  selectedWheel,
  dbProfile,
}: TiresGridProps) {
  const { addItem, getTires, getWheels, removeItem, addAccessories, setAccessoryState, replaceAccessorySku } = useCart();
  const [selectedTire, setSelectedTire] = useState<SelectedTire | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  
  // Get vehicle from viewParams
  const vehicle = viewParams.year && viewParams.make && viewParams.model ? {
    year: viewParams.year,
    make: viewParams.make,
    model: viewParams.model,
    trim: viewParams.trim,
    modification: viewParams.modification,
  } : undefined;
  
  // Categorize tires
  const categorized = useMemo(() => {
    const bestValue: TireItem[] = [];
    const mostPopular: TireItem[] = [];
    const premium: TireItem[] = [];
    
    // Sort each category by price
    for (const tire of tires) {
      const category = categorizeTire(tire);
      if (category === "best-value") bestValue.push(tire);
      else if (category === "most-popular") mostPopular.push(tire);
      else premium.push(tire);
    }
    
    const sortByPrice = (a: TireItem, b: TireItem) => 
      (a.cost || 999) - (b.cost || 999);
    
    return {
      bestValue: bestValue.sort(sortByPrice),
      mostPopular: mostPopular.sort(sortByPrice),
      premium: premium.sort(sortByPrice),
    };
  }, [tires]);
  
  // Handle tire selection
  const handleSelectTire = useCallback((tire: TireItem) => {
    const price = typeof tire.cost === "number" ? tire.cost : 0;
    const setPrice = price * 4;
    
    // Remove existing tires from cart
    const existingTires = getTires();
    for (const t of existingTires) {
      removeItem(t.sku, "tire");
    }
    
    // Add wheel to cart if part of package build (from URL params)
    // Check if wheel already in cart to avoid duplicates
    if (selectedWheel && selectedWheel.sku) {
      const existingWheels = getWheels();
      const wheelAlreadyInCart = existingWheels.some(w => w.sku === selectedWheel.sku);
      
      if (!wheelAlreadyInCart) {
        addItem({
          type: "wheel",
          sku: selectedWheel.sku,
          brand: selectedWheel.brand || "Wheel",
          model: selectedWheel.model || "",
          finish: selectedWheel.finish,
          diameter: selectedWheel.diameter,
          width: selectedWheel.width,
          offset: selectedWheel.offset,
          imageUrl: selectedWheel.imageUrl,
          unitPrice: typeof selectedWheel.setPrice === "number" ? selectedWheel.setPrice / 4 : 0,
          quantity: 4,
          vehicle,
        });
        
        // ═══════════════════════════════════════════════════════════════════════
        // ACCESSORY FITMENT - Calculate and auto-add required accessories
        // ═══════════════════════════════════════════════════════════════════════
        if (dbProfile) {
          const wheelForFitment: WheelForAccessories = {
            sku: selectedWheel.sku,
            centerBore: selectedWheel.centerBore,
            seatType: selectedWheel.seatType,
          };
          
          const fitmentResult = calculateAccessoryFitment(dbProfile, wheelForFitment);
          
          console.log("[TiresGridWithSelection] Accessory fitment result:", {
            wheelSku: selectedWheel.sku,
            hasDbProfile: true,
            lugNuts: fitmentResult.fitment?.lugNuts.status,
            hubRings: fitmentResult.fitment?.hubRings.status,
            requiredCount: fitmentResult.requiredItems.length,
          });
          
          // Set accessory state for UI
          if (fitmentResult.state) {
            setAccessoryState(fitmentResult.state);
          }
          
          // Auto-add required accessories
          if (fitmentResult.requiredItems.length > 0) {
            console.log("[TiresGridWithSelection] Auto-adding accessories:", 
              fitmentResult.requiredItems.map(i => `${i.category}: ${i.name}`)
            );
            addAccessories(fitmentResult.requiredItems);
            
            // Replace lug kit placeholder SKU with real Gorilla kit SKU (server lookup)
            const lug = fitmentResult.requiredItems.find(i => i.category === "lug_nut");
            if (lug?.spec?.threadSize) {
              const placeholderSku = lug.sku;
              const qs = new URLSearchParams({ threadSize: lug.spec.threadSize });
              if (lug.spec.seatType) qs.set("seatType", lug.spec.seatType);
              
              fetch(`/api/accessories/lugkits?${qs.toString()}`, {
                headers: { Accept: "application/json" },
              })
                .then(r => r.json().catch(() => null).then(j => ({ ok: r.ok, j })))
                .then(({ ok, j }) => {
                  if (ok && j?.choice?.sku) {
                    const next = {
                      ...lug,
                      sku: String(j.choice.sku),
                      meta: {
                        ...(lug.meta || {}),
                        placeholder: false,
                        source: "wheelpros",
                        brandCode: j.choice.brandCode,
                        nipCost: j.choice.nip,
                        msrp: j.choice.msrp,
                        title: j.choice.title,
                        threadKey: j.choice.threadKey,
                      },
                    };
                    replaceAccessorySku(placeholderSku, next);
                  }
                })
                .catch(() => {});
            }
          }
        } else {
          console.log("[TiresGridWithSelection] Skipping accessory fitment - no dbProfile");
        }
      }
    }
    
    // Add new tire to cart
    addItem({
      type: "tire",
      sku: tire.partNumber || "",
      brand: tire.brand || "Tire",
      model: tire.displayName || tire.prettyName || tire.description || "",
      size: selectedSize,
      loadIndex: tire.badges?.loadIndex || undefined,
      speedRating: tire.badges?.speedRating || undefined,
      imageUrl: tire.imageUrl,
      unitPrice: price,
      quantity: 4,
      vehicle,
      source: tire.rawSource,
    });
    
    // Update state
    setSelectedTire({
      sku: tire.partNumber || "",
      brand: tire.brand || "Tire",
      model: tire.displayName || tire.prettyName || tire.description || "",
      size: selectedSize,
      setPrice,
      imageUrl: tire.imageUrl,
      loadIndex: tire.badges?.loadIndex || undefined,
      speedRating: tire.badges?.speedRating || undefined,
      source: tire.rawSource,
    });
    
    // Scroll to confirmation on mobile
    setTimeout(() => {
      if (confirmationRef.current && window.innerWidth < 768) {
        confirmationRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }, [addItem, getTires, getWheels, removeItem, selectedSize, vehicle, selectedWheel, dbProfile, addAccessories, setAccessoryState, replaceAccessorySku]);
  
  const handleClearSelection = useCallback(() => {
    if (selectedTire) {
      removeItem(selectedTire.sku, "tire");
    }
    setSelectedTire(null);
  }, [selectedTire, removeItem]);
  
  return (
    <div className="relative">
      {/* Main content - full width, no sidebar */}
      <div>
        {/* Wheel summary is displayed in TirePageCompactHeader - no duplicate here */}
        
        {/* Tire selection confirmation - inline toast style */}
        {selectedTire && (
          <div ref={confirmationRef} className="sticky top-20 z-40 mb-4">
            <TireSelectionConfirmation
              tire={selectedTire}
              wheel={selectedWheel || null}
              onClear={handleClearSelection}
            />
          </div>
        )}
        
        {/* Category sections - full width grid */}
        <CategorySection
          title="Best Value"
          subtitle="Quality tires at great prices"
          icon="💰"
          tires={categorized.bestValue}
          size={selectedSize}
          selectedTire={selectedTire}
          onSelectTire={handleSelectTire}
          viewParams={viewParams}
          defaultExpanded={true}
        />
        
        <CategorySection
          title="Most Popular"
          subtitle="Customer favorites with proven performance"
          icon="⭐"
          tires={categorized.mostPopular}
          size={selectedSize}
          selectedTire={selectedTire}
          onSelectTire={handleSelectTire}
          viewParams={viewParams}
          defaultExpanded={true}
        />
        
        <CategorySection
          title="Premium"
          subtitle="Top-tier brands for maximum performance"
          icon="✨"
          tires={categorized.premium}
          size={selectedSize}
          selectedTire={selectedTire}
          onSelectTire={handleSelectTire}
          viewParams={viewParams}
          defaultExpanded={categorized.bestValue.length === 0 && categorized.mostPopular.length === 0}
        />
        
        {/* Skip tires option */}
        {selectedWheel && !selectedTire && (
          <SkipTiresOption />
        )}
      </div>
      
      {/* Sticky package bar - unified for desktop + mobile */}
      {selectedWheel && (
        <StickyPackageBar
          wheelSku={selectedWheel.sku}
          wheelBrand={selectedWheel.brand}
          wheelModel={selectedWheel.model}
          wheelPrice={selectedWheel.setPrice}
          wheelImage={selectedWheel.imageUrl}
          tireSku={selectedTire?.sku}
          tireBrand={selectedTire?.brand}
          tireModel={selectedTire?.model}
          tirePrice={selectedTire ? selectedTire.setPrice / 4 : undefined}
          tireSize={selectedTire?.size}
          tireCount={4}
        />
      )}
    </div>
  );
}
