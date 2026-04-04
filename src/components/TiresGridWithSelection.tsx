"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import { FavoritesButton } from "@/components/FavoritesButton";
import { StickyPackageBar } from "@/components/StickyPackageBar";
import { calculateAccessoryFitment, type DBProfileForAccessories, type WheelForAccessories } from "@/hooks/useAccessoryFitment";
import { getStockInfo } from "@/lib/tires/tireSpecs";
import type { TreadCategory } from "@/lib/tires/normalization";

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
  // ════════════════════════════════════════════════════════════════════════════
  // ENRICHED SPEC FIELDS (will populate when TireWeb enables TireLibrary access)
  // ════════════════════════════════════════════════════════════════════════════
  /** UTQG rating string (e.g., "620AB") */
  utqg?: string | null;
  /** Tread depth in 32nds of an inch */
  treadDepth?: number | null;
  /** Overall diameter in inches */
  diameter?: number | null;
  /** Tire weight in lbs */
  weight?: number | null;
  /** Has 3-Peak Mountain Snowflake rating */
  has3PMSF?: boolean;
  /** Is run-flat tire */
  isRunFlat?: boolean;
  /** Normalized tread category */
  treadCategory?: TreadCategory | null;
  /** Is on sale */
  onSale?: boolean;
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
// TIRE CARD - Conversion-Optimized Design
// Answers: What kind? How long? Can I get it? Can I trust it?
// ═══════════════════════════════════════════════════════════════════════════════

// Badge style maps for tread categories
const CATEGORY_BADGE_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  'All-Season': { bg: 'bg-green-500', text: 'text-white', icon: '🌤️' },
  'All-Weather': { bg: 'bg-teal-500', text: 'text-white', icon: '🌦️' },
  'Summer': { bg: 'bg-yellow-500', text: 'text-white', icon: '☀️' },
  'Winter': { bg: 'bg-sky-500', text: 'text-white', icon: '❄️' },
  'All-Terrain': { bg: 'bg-amber-600', text: 'text-white', icon: '🏔️' },
  'Mud-Terrain': { bg: 'bg-orange-600', text: 'text-white', icon: '🪨' },
  'Highway/Touring': { bg: 'bg-blue-500', text: 'text-white', icon: '🛣️' },
  'Performance': { bg: 'bg-red-500', text: 'text-white', icon: '🏎️' },
  'Rugged-Terrain': { bg: 'bg-stone-600', text: 'text-white', icon: '⛰️' },
};

function getMileageBadgeStyle(miles: number): { label: string; bg: string } {
  if (miles >= 80000) return { label: '80K WARRANTY', bg: 'bg-purple-600' };
  if (miles >= 60000) return { label: '60K WARRANTY', bg: 'bg-indigo-600' };
  if (miles >= 40000) return { label: '40K WARRANTY', bg: 'bg-blue-600' };
  return { label: '', bg: '' };
}

function TireCard({
  tire,
  size,
  isSelected,
  hasSelection,
  onSelect,
  viewParams,
  isPackageFlow = false,
}: {
  tire: TireItem;
  size: string;
  isSelected: boolean;
  hasSelection: boolean;
  onSelect: () => void;
  viewParams: ViewParams;
  isPackageFlow?: boolean;
}) {
  const brand = tire.brand || "Tire";
  const model = tire.displayName || tire.prettyName || tire.description || "";
  const price = typeof tire.cost === "number" ? tire.cost : null;
  const setPrice = price !== null ? price * 4 : null;
  const category = categorizeTire(tire);
  
  // Build detail URL based on source
  const buildDetailHref = () => {
    const sku = tire.partNumber || tire.mfgPartNumber;
    if (!sku) return "#";
    
    const params = new URLSearchParams();
    params.set("size", size);
    if (viewParams.year) params.set("year", viewParams.year);
    if (viewParams.make) params.set("make", viewParams.make);
    if (viewParams.model) params.set("model", viewParams.model);
    if (viewParams.trim) params.set("trim", viewParams.trim);
    
    // Route based on source
    const source = tire.rawSource || tire.source;
    if (source === "km") {
      return `/tires/km/${encodeURIComponent(sku)}?${params.toString()}`;
    }
    if (source?.startsWith("tireweb")) {
      // TireWeb tires use the unified detail page with source param
      params.set("source", "tireweb");
      return `/tires/${encodeURIComponent(sku)}?${params.toString()}`;
    }
    // Default: WheelPros or unknown
    return `/tires/${encodeURIComponent(sku)}?${params.toString()}`;
  };
  const detailHref = buildDetailHref();
  
  // Get normalized tread category with strict hierarchy:
  // 1. tire.treadCategory (already normalized by API)
  // 2. tire.badges.terrain (supplier metadata)
  // 3. Model name parsing (last resort)
  const inferCategoryFromModel = (modelName: string): string => {
    const m = modelName.toUpperCase();
    
    // Winter patterns (check first - most specific)
    if (/\bWINTER\b|\bBLIZZAK\b|\bX-ICE\b|\bICE\b|\bSNOW\b|\bWS\d+\b|\bARCTIC\b|\bFROST\b/.test(m)) {
      return "Winter";
    }
    
    // Mud-Terrain patterns (M/T, MT, MUD)
    if (/\bM[\/\-]?T\b|\bMUD[\s\-]?TERRAIN\b|\bMUD[\s\-]?GRAPPLER\b/.test(m)) {
      return "Mud-Terrain";
    }
    
    // Rugged-Terrain patterns (R/T, RT, RUGGED)
    if (/\bR[\/\-]?T\b|\bRUGGED[\s\-]?TERRAIN\b/.test(m)) {
      return "Rugged-Terrain";
    }
    
    // All-Terrain patterns (A/T, AT, AT2, ATX, AT-X, TERRA TRAC, KO2, GRAPPLER without MUD)
    if (/\bA[\/\-]?T\d*[A-Z]?\b|\bA[\/\-]?T[-]?[A-Z]\b|\bALL[\s\-]?TERRAIN\b|\bTERRA\s*TRAC\b|\bKO2\b|\bGRAPPLER\b/.test(m) && !/MUD/.test(m)) {
      return "All-Terrain";
    }
    
    // Highway/Touring patterns (H/T, HT, HT2, HTX, TOURING, HIGHWAY)
    if (/\bH[\/\-]?T\d*[A-Z]?\b|\bHIGHWAY\b|\bTOURING\b|\bGRAND\s*TOUR/.test(m)) {
      return "Highway/Touring";
    }
    
    // Performance patterns
    if (/\bPILOT\s*SPORT\b|\bPOTENZA\b|\bPS4S\b|\bPZERO\b|\bP\s*ZERO\b|\bUHP\b|\bSPORT\s*MAXX\b|\bEAGLE\s*F1\b|\bCONTI\s*SPORT\b/.test(m)) {
      return "Performance";
    }
    
    // All-Weather patterns
    if (/\bALL[\s\-]?WEATHER\b|\bWEATHER\s*READY\b|\b4SEASON\b|\bCROSS\s*CLIMATE\b/.test(m)) {
      return "All-Weather";
    }
    
    // Summer patterns
    if (/\bSUMMER\b/.test(m) && !/ALL/.test(m)) {
      return "Summer";
    }
    
    // Default
    return "All-Season";
  };
  
  // Apply hierarchy
  const treadCategory = tire.treadCategory || tire.badges?.terrain || inferCategoryFromModel(model);
  
  // Get stock info
  const stockInfo = getStockInfo(tire.quantity);
  
  // Popular / Top Pick indicator
  const isPopular = category === "most-popular" || stockInfo.total >= 20;
  const isTopPick = category === "premium" && stockInfo.total >= 8;
  
  // Mileage warranty
  const warrantyMiles = tire.badges?.warrantyMiles || 0;
  const mileageBadge = warrantyMiles >= 40000 ? getMileageBadgeStyle(warrantyMiles) : null;
  
  // Category badge style
  const catStyle = CATEGORY_BADGE_STYLES[treadCategory] || CATEGORY_BADGE_STYLES['All-Season'];
  
  // Build spec summary (only show available fields)
  const specs: string[] = [];
  if (tire.utqg) specs.push(`UTQG ${tire.utqg}`);
  if (tire.treadDepth) specs.push(`${tire.treadDepth}/32" depth`);
  if (tire.diameter) specs.push(`${tire.diameter}" OD`);
  if (tire.badges?.loadIndex) specs.push(`Load ${tire.badges.loadIndex}`);
  
  // Availability messaging
  const getAvailabilityMessage = () => {
    if (stockInfo.status === 'in-stock') {
      if (stockInfo.deliveryDays && stockInfo.deliveryDays <= 2) {
        return { icon: '✓', text: 'In stock • Install as soon as Friday', color: 'text-green-700' };
      }
      return { icon: '✓', text: `${stockInfo.total} in stock • Ships in 1–2 days`, color: 'text-green-700' };
    }
    if (stockInfo.status === 'low-stock') {
      return { icon: '⚡', text: `Only ${stockInfo.total} left • Ships in 3–5 days`, color: 'text-amber-700' };
    }
    return { icon: '📦', text: 'Available • Ships in 1–2 weeks', color: 'text-neutral-600' };
  };
  const availability = getAvailabilityMessage();
  
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
      {/* ══════════════════════════════════════════════════════════════════════
          1. IMAGE WITH BADGE STACK
          ══════════════════════════════════════════════════════════════════════ */}
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
        <div className="absolute top-2 right-2 z-10">
          <FavoritesButton
            type="tire"
            sku={tire.partNumber || ""}
            label={`${brand} ${model}`}
            href={detailHref}
            imageUrl={tire.imageUrl}
          />
        </div>
        
        {/* Badge Stack - Top Left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {/* Tread Category Badge */}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${catStyle.bg} ${catStyle.text}`}>
            <span className="text-xs">{catStyle.icon}</span>
            {treadCategory}
          </span>
          
          {/* Mileage Warranty Badge */}
          {mileageBadge && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ${mileageBadge.bg}`}>
              📏 {mileageBadge.label}
            </span>
          )}
          
          {/* Top Pick / Sale Badge */}
          {tire.onSale && (
            <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              🔥 SALE
            </span>
          )}
          {isTopPick && !tire.onSale && (
            <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              ⭐ TOP PICK
            </span>
          )}
          {isPopular && !isTopPick && !tire.onSale && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 shadow-sm">
              🔥 Popular
            </span>
          )}
        </div>
        
        {/* Selected checkmark overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white shadow-lg">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}
      </Link>
      
      {/* ══════════════════════════════════════════════════════════════════════
          2. CORE CONTENT BLOCK
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col p-4">
        {/* Brand */}
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{brand}</div>
        
        {/* Model Name */}
        <Link href={detailHref}>
          <h3 className="mt-0.5 text-base font-bold text-neutral-900 hover:text-neutral-700 transition-colors line-clamp-2 leading-tight min-h-[2.5rem]">
            {model}
          </h3>
        </Link>
        
        {/* Full tire size/spec */}
        <div className="mt-1 text-sm font-medium text-neutral-700">{size}</div>
        
        {/* ══════════════════════════════════════════════════════════════════════
            3. SPEC SUMMARY ROW (only available fields)
            ══════════════════════════════════════════════════════════════════════ */}
        {specs.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
            {specs.map((spec, i) => (
              <span key={spec}>
                {i > 0 && <span className="mr-2">•</span>}
                {spec}
              </span>
            ))}
          </div>
        )}
        
        {/* Speed rating if no other specs */}
        {specs.length === 0 && tire.badges?.speedRating && (
          <div className="mt-2 text-[11px] text-neutral-500">
            Speed Rating: {tire.badges.speedRating}
          </div>
        )}
        
        <div className="flex-1 min-h-3" />
        
        {/* ══════════════════════════════════════════════════════════════════════
            4. AVAILABILITY ROW
            ══════════════════════════════════════════════════════════════════════ */}
        <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium ${availability.color}`}>
          <span>{availability.icon}</span>
          <span>{availability.text}</span>
        </div>
        
        {/* ══════════════════════════════════════════════════════════════════════
            5. PRICE BLOCK
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <div className="flex items-end justify-between gap-2">
            <div>
              {/* Set of 4 total - primary */}
              <div className="text-2xl font-extrabold text-neutral-900">
                {setPrice !== null 
                  ? `$${formatPrice(setPrice)}`
                  : "Call for Price"
                }
              </div>
              {/* Per tire price - secondary */}
              {price !== null && (
                <div className="text-[11px] text-neutral-500">
                  ${formatPrice(price)}/ea × 4 tires
                </div>
              )}
            </div>
            
            {/* UTQG compact display (if available) */}
            {tire.utqg && (
              <div className="text-right shrink-0">
                <div className="text-[9px] text-neutral-400 uppercase tracking-wide">UTQG</div>
                <div className="text-sm font-mono font-bold text-neutral-700">{tire.utqg}</div>
              </div>
            )}
          </div>
        </div>
        
        {/* ══════════════════════════════════════════════════════════════════════
            6. TRUST ROW
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-500">
          <span className="inline-flex items-center gap-0.5">
            <span className="text-green-600">✓</span> Fitment Confirmed
          </span>
          <span className="inline-flex items-center gap-0.5">
            <span className="text-green-600">✓</span> Free Shipping
          </span>
          <span className="inline-flex items-center gap-0.5 hidden sm:inline-flex">
            <span className="text-green-600">✓</span> Price Match
          </span>
        </div>
        
        {/* CTA Button */}
        <button
          type="button"
          onClick={onSelect}
          disabled={isSelected}
          className={`
            mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl 
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
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              {isPackageFlow ? "Selected" : "Added to Cart"}
            </>
          ) : hasSelection ? (
            "Switch to this tire"
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {isPackageFlow ? "Add to Package" : "Add Set of 4"}
            </>
          )}
        </button>
        
        {/* View full specs link */}
        <Link 
          href={detailHref}
          className="mt-2 text-center text-[11px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          View full specs & reviews →
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
  isPackageFlow = false,
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
  isPackageFlow?: boolean;
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
              isPackageFlow={isPackageFlow}
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
  const isPackageFlow = !!wheel;
  
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
            <span className="text-sm font-extrabold text-green-800">
              {isPackageFlow ? "Tires Selected" : "Added to Cart"}
            </span>
            {isPackageFlow && (
              <span className="rounded-full bg-green-200 px-2 py-0.5 text-[10px] font-bold text-green-800">
                Package Complete!
              </span>
            )}
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
          
          {/* Package summary - only show in package flow */}
          {isPackageFlow && (
            <div className="mt-3 rounded-xl bg-white/80 border border-green-200 p-3">
              <div className="text-xs font-bold text-neutral-700 mb-1">Package Summary</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Wheels + Tires</span>
                <span className="font-extrabold text-neutral-900">${formatPrice(total)}</span>
              </div>
            </div>
          )}
          
          {/* CTAs */}
          <div className="mt-3 flex items-center gap-3">
            <Link
              href="/cart"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 text-sm font-extrabold text-white shadow-lg shadow-green-600/30 transition-all hover:bg-green-700 hover:shadow-xl active:scale-[0.98]"
            >
              {isPackageFlow ? "Review & Checkout" : "View Cart"}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <button
              onClick={onClear}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              {isPackageFlow ? "Change selection" : "Remove"}
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
          isPackageFlow={!!selectedWheel}
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
          isPackageFlow={!!selectedWheel}
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
          isPackageFlow={!!selectedWheel}
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
