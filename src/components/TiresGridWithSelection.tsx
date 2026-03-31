"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { FavoritesButton } from "@/components/FavoritesButton";
import { TPMS_SET_PRICE_ESTIMATE, MOUNT_BALANCE_ESTIMATE } from "@/lib/pricing/accessoryEstimates";

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
// TIRE CARD - Clean, conversion-focused design
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
            : "border-neutral-200 hover:shadow-lg hover:border-neutral-300"
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
      
      {/* Guaranteed Fit badge */}
      <div className="bg-green-600 px-3 py-1.5 text-center">
        <span className="text-xs font-bold text-white tracking-wide">
          🟢 GUARANTEED FIT
        </span>
      </div>
      
      {/* Large Image */}
      <Link href={detailHref} className="block relative">
        <div className="aspect-square w-full overflow-hidden bg-neutral-50 p-6">
          {tire.imageUrl ? (
            <img
              src={tire.imageUrl}
              alt={model}
              className="h-full w-full object-contain transition-transform hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-6xl text-neutral-200">🛞</div>
            </div>
          )}
        </div>
        
        {/* Favorites button */}
        <div className="absolute top-3 right-3">
          <FavoritesButton
            type="tire"
            sku={tire.partNumber || ""}
            label={`${brand} ${model}`}
            href={detailHref}
            imageUrl={tire.imageUrl}
          />
        </div>
      </Link>
      
      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Brand */}
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{brand}</div>
        
        {/* Model Name */}
        <Link href={detailHref}>
          <h3 className="mt-0.5 text-lg font-extrabold text-neutral-900 hover:text-neutral-700 transition-colors line-clamp-2">
            {model}
          </h3>
        </Link>
        
        {/* Size • Terrain */}
        <div className="mt-1.5 text-sm text-neutral-600">
          {size} • {terrainType}
        </div>
        
        {/* Popular badge OR warranty */}
        <div className="mt-2">
          {isPopular ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
              🔥 Popular
            </span>
          ) : tire.badges?.warrantyMiles && tire.badges.warrantyMiles > 0 ? (
            <span className="text-sm text-neutral-500">
              {(tire.badges.warrantyMiles / 1000).toFixed(0)}k mile warranty
            </span>
          ) : null}
        </div>
        
        <div className="flex-1" />
        
        {/* Price */}
        <div className="mt-4">
          <div className="text-2xl font-extrabold text-neutral-900">
            {setPrice !== null 
              ? `$${formatPrice(setPrice)} for 4`
              : "Call for price"
            }
          </div>
          {price !== null && (
            <div className="text-sm text-neutral-500">
              (${formatPrice(price)} each)
            </div>
          )}
        </div>
        
        {/* Trust signals */}
        <div className="mt-2 flex items-center gap-4 text-xs text-neutral-600">
          <span className="flex items-center gap-1">
            <span className="text-green-600">✓</span>
            Free Shipping
          </span>
          <span className="flex items-center gap-1">
            <span className="text-green-600">✓</span>
            Fitment Guaranteed
          </span>
        </div>
        
        {/* CTA */}
        <button
          type="button"
          onClick={onSelect}
          disabled={isSelected}
          className={`
            mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl 
            text-sm font-extrabold transition-all duration-200
            ${isSelected
              ? "bg-green-600 text-white cursor-default"
              : hasSelection
                ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border-2 border-neutral-200"
                : "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-lg shadow-red-600/25"
            }
          `}
        >
          {isSelected ? (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              Selected
            </>
          ) : hasSelection ? (
            <>Switch to this tire</>
          ) : (
            <>
              Add to Package
              {setPrice !== null && (
                <span className="opacity-90">— ${formatPrice(setPrice)}</span>
              )}
            </>
          )}
        </button>
        
        {/* View specs link */}
        <Link 
          href={detailHref}
          className="mt-2 text-center text-xs font-semibold text-neutral-500 hover:text-neutral-700"
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
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tires.slice(0, 8).map((tire, idx) => (
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
      
      {expanded && tires.length > 8 && (
        <div className="mt-3 text-center">
          <button className="text-sm font-semibold text-neutral-600 hover:text-neutral-900">
            Show all {tires.length} options →
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE TOTAL
// ═══════════════════════════════════════════════════════════════════════════════
function PackageTotal({
  wheel,
  tire,
}: {
  wheel: SelectedWheel | null;
  tire: SelectedTire | null;
}) {
  const wheelPrice = wheel?.setPrice || 0;
  const tirePrice = tire?.setPrice || 0;
  const total = wheelPrice + tirePrice;
  
  // Estimates for TPMS and install (from centralized pricing)
  const tpmsEstimate = TPMS_SET_PRICE_ESTIMATE;
  const installEstimate = MOUNT_BALANCE_ESTIMATE;
  const grandTotal = total + tpmsEstimate + installEstimate;
  
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="text-sm font-bold text-neutral-700 mb-3">Your Package</div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className={wheel ? "text-neutral-900" : "text-neutral-400"}>
            {wheel ? `${wheel.brand} ${wheel.model}` : "Wheels"} × 4
          </span>
          <span className={`font-semibold ${wheel ? "text-neutral-900" : "text-neutral-400"}`}>
            {wheel ? `$${formatPrice(wheelPrice)}` : "—"}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className={tire ? "text-neutral-900" : "text-neutral-400"}>
            {tire ? `${tire.brand} ${tire.model}` : "Tires"} × 4
          </span>
          <span className={`font-semibold ${tire ? "text-neutral-900" : "text-neutral-400"}`}>
            {tire ? `$${formatPrice(tirePrice)}` : "—"}
          </span>
        </div>
        
        <div className="border-t border-neutral-100 pt-2 mt-2">
          <div className="flex justify-between text-xs text-neutral-500">
            <span>TPMS sensors (est.)</span>
            <span>${formatPrice(tpmsEstimate)}</span>
          </div>
          <div className="flex justify-between text-xs text-neutral-500">
            <span>Mount & balance (est.)</span>
            <span>${formatPrice(installEstimate)}</span>
          </div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-neutral-200">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-bold text-neutral-900">Estimated Total</span>
          <span className="text-xl font-extrabold text-neutral-900">
            ${formatPrice(grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

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
  const router = useRouter();
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
// MOBILE STICKY BAR
// ═══════════════════════════════════════════════════════════════════════════════
function MobileStickyBar({
  tire,
  wheel,
  isVisible,
}: {
  tire: SelectedTire | null;
  wheel: SelectedWheel | null;
  isVisible: boolean;
}) {
  if (!tire || !isVisible) return null;
  
  const total = (wheel?.setPrice || 0) + tire.setPrice;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden animate-slide-up">
      <div className="border-t border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 shadow-2xl shadow-green-900/20">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-500 text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-neutral-900">Package Complete</div>
                <div className="text-xs font-extrabold text-green-700">
                  ${formatPrice(total)}
                </div>
              </div>
            </div>
          </div>
          
          <Link
            href="/cart"
            className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 text-sm font-extrabold text-white shadow-lg shadow-green-600/30"
          >
            Checkout
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

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
}: TiresGridProps) {
  const { addItem, getTires, removeItem } = useCart();
  const [selectedTire, setSelectedTire] = useState<SelectedTire | null>(null);
  const [showMobileBar, setShowMobileBar] = useState(false);
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
    
    // Show mobile bar
    setTimeout(() => setShowMobileBar(true), 300);
    
    // Scroll to confirmation
    setTimeout(() => {
      if (confirmationRef.current && window.innerWidth < 768) {
        confirmationRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }, [addItem, getTires, removeItem, selectedSize, vehicle]);
  
  const handleClearSelection = useCallback(() => {
    if (selectedTire) {
      removeItem(selectedTire.sku, "tire");
    }
    setSelectedTire(null);
    setShowMobileBar(false);
  }, [selectedTire, removeItem]);
  
  // Track scroll for mobile bar
  useEffect(() => {
    if (!selectedTire) return;
    
    const handleScroll = () => {
      if (confirmationRef.current) {
        const rect = confirmationRef.current.getBoundingClientRect();
        setShowMobileBar(rect.bottom < 0);
      }
    };
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [selectedTire]);
  
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {/* Main content */}
      <div>
        {/* Wheel summary is displayed in TirePageCompactHeader - no duplicate here */}
        
        {/* Tire selection confirmation */}
        {selectedTire && (
          <div ref={confirmationRef} className="sticky top-20 z-40 mb-4">
            <TireSelectionConfirmation
              tire={selectedTire}
              wheel={selectedWheel || null}
              onClear={handleClearSelection}
            />
          </div>
        )}
        
        {/* Category sections */}
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
      
      {/* Sidebar - Package total */}
      <div className="hidden lg:block">
        <div className="sticky top-24">
          <PackageTotal
            wheel={selectedWheel || null}
            tire={selectedTire}
          />
          
          {/* Checkout CTA when complete */}
          {selectedTire && (
            <Link
              href="/cart"
              className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-green-600 text-base font-extrabold text-white shadow-lg shadow-green-600/30 transition-all hover:bg-green-700 active:scale-[0.98]"
            >
              Review & Checkout
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          )}
        </div>
      </div>
      
      {/* Mobile sticky bar */}
      <MobileStickyBar
        tire={selectedTire}
        wheel={selectedWheel || null}
        isVisible={showMobileBar}
      />
    </div>
  );
}
