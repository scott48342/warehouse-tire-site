"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FavoritesButton } from "@/components/FavoritesButton";
import { AddToCompareButton } from "@/components/AddToCompareButton";
import { FinancingBadge } from "@/components/FinancingBadge";
import {
  BestForLine,
  TrustMicroLine,
  type TireCategory,
} from "@/components/TireSRPEnhancements";
import { MiniRatings } from "@/components/PerformanceIndicators";
import { derivePerformanceRatings, parseUTQG, type PerformanceRatings } from "@/lib/tires/tireSpecs";
import { normalizeTireSize, cleanTireDisplayTitle } from "@/lib/productFormat";

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY STYLING - Matches wheel card aesthetic
// ═══════════════════════════════════════════════════════════════════════════════
const CATEGORY_STYLES: Record<string, { bg: string; icon: string }> = {
  'All-Terrain': { bg: 'bg-gradient-to-r from-amber-600 to-amber-500', icon: '🏔️' },
  'Mud-Terrain': { bg: 'bg-gradient-to-r from-orange-700 to-orange-600', icon: '🪨' },
  'Rugged-Terrain': { bg: 'bg-gradient-to-r from-stone-700 to-stone-600', icon: '⛰️' },
  'Winter': { bg: 'bg-gradient-to-r from-sky-600 to-sky-500', icon: '❄️' },
  'Performance': { bg: 'bg-gradient-to-r from-red-600 to-red-500', icon: '🏎️' },
  'Highway/Touring': { bg: 'bg-gradient-to-r from-blue-600 to-blue-500', icon: '🛣️' },
  'All-Season': { bg: 'bg-gradient-to-r from-green-600 to-green-500', icon: '🌤️' },
  'All-Weather': { bg: 'bg-gradient-to-r from-teal-600 to-teal-500', icon: '🌦️' },
  'Crossover/SUV Touring': { bg: 'bg-gradient-to-r from-green-600 to-green-500', icon: '🌤️' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOP PICK CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
export type TopPickCategory = "best-overall" | "most-popular" | "best-value" | "best-warranty";

const TOP_PICK_CONFIG: Record<TopPickCategory, { icon: string; label: string; color: string }> = {
  "best-overall": { icon: "⭐", label: "Best Overall", color: "bg-gradient-to-r from-amber-400/90 to-yellow-400/90 text-amber-950" },
  "most-popular": { icon: "📈", label: "Trending", color: "bg-gradient-to-r from-orange-400/90 to-amber-400/90 text-orange-950" },
  "best-value": { icon: "💰", label: "Best Value", color: "bg-gradient-to-r from-emerald-400/90 to-teal-400/90 text-emerald-950" },
  "best-warranty": { icon: "🛡️", label: "Best Warranty", color: "bg-gradient-to-r from-blue-400/90 to-indigo-400/90 text-blue-950" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE ANCHORING - Same pattern as wheel cards
// ═══════════════════════════════════════════════════════════════════════════════
function PriceAnchorBlock({ tireSetPrice, quantity }: { tireSetPrice: number | null; quantity: number }) {
  if (tireSetPrice === null) return null;
  
  // Estimate typical installed package for tires (installation + TPMS service)
  const minPackage = tireSetPrice + 60 + 20;  // Tires + basic install + TPMS
  const maxPackage = tireSetPrice + 120 + 40; // Tires + premium install + TPMS + balance
  
  const minRounded = Math.round(minPackage / 50) * 50;
  const maxRounded = Math.round(maxPackage / 50) * 50;
  
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Your Price:</span>
        <span className="text-base font-extrabold text-emerald-800">
          ${tireSetPrice.toLocaleString()}
        </span>
        <span className="text-[10px] text-neutral-400 font-medium">{quantity === 4 ? 'set of 4' : `×${quantity}`}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST STRIP - Matches wheel card style
// ═══════════════════════════════════════════════════════════════════════════════
function TrustStrip({ hasVehicle = false, isLocalMode = false }: { hasVehicle?: boolean; isLocalMode?: boolean }) {
  // NOTE: Free shipping only over $1500 on national site - don't show it on individual cards
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-neutral-400 font-medium">
      {hasVehicle && (
        <span className="inline-flex items-center gap-1">
          <span className="text-emerald-500">✓</span>
          <span>Guaranteed Fit</span>
        </span>
      )}
      {!isLocalMode && (
        <span className="inline-flex items-center gap-1">
          <span className="text-neutral-400">↩️</span>
          <span>Easy Returns</span>
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export type TireStyleCardProps = {
  // Core tire data
  sku: string;
  brand: string;
  model: string;
  size: string;
  imageUrl?: string;
  price?: number;
  
  // Specs
  loadIndex?: string;
  speedRating?: string;
  category?: string;
  mileageWarranty?: number;
  is3PMSF?: boolean;
  isRunFlat?: boolean;
  
  // UTQG for performance ratings
  utqg?: string;
  
  // Availability
  stockQty?: number;
  inStock?: boolean;
  
  // Vehicle context
  year?: string;
  make?: string;
  model_?: string; // vehicle model (different from tire model)
  trim?: string;
  modification?: string;
  
  // Display options
  topPickCategory?: TopPickCategory;
  highlightLabel?: { text: string; bg: string };
  whyThisTire?: string;
  rebateLabel?: string;
  
  // Build context
  wheelDia?: string;
  wheelSku?: string;
  isPackageFlow?: boolean;
  isStaggered?: boolean;
  axle?: 'front' | 'rear';
  
  // Site context
  isLocalMode?: boolean;
  
  // Link params
  viewParams?: Record<string, string>;
  source?: string;
  
  // Compare support
  compareItem?: any;
  
  // Selection handlers
  onSelect?: (qty: number) => void;
  isSelected?: boolean;
};

export function TireStyleCard({
  sku,
  brand,
  model,
  size,
  imageUrl,
  price,
  loadIndex,
  speedRating,
  category = 'All-Season',
  mileageWarranty,
  is3PMSF,
  isRunFlat,
  utqg,
  stockQty = 0,
  inStock = true,
  year,
  make,
  model_,
  trim,
  modification,
  topPickCategory,
  highlightLabel,
  whyThisTire,
  rebateLabel,
  wheelDia,
  wheelSku,
  isPackageFlow = false,
  isStaggered = false,
  axle,
  isLocalMode = false,
  viewParams = {},
  source,
  compareItem,
  onSelect,
  isSelected = false,
}: TireStyleCardProps) {
  
  const hasVehicle = Boolean(year && make && model_);
  const isTopPick = Boolean(topPickCategory);
  const topPickConfig = topPickCategory ? TOP_PICK_CONFIG[topPickCategory] : null;
  
  // Build view href
  const viewHref = useMemo(() => {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (make) params.set('make', make);
    if (model_) params.set('model', model_);
    if (trim) params.set('trim', trim);
    if (modification) params.set('modification', modification);
    params.set('size', size);
    if (source) params.set('source', source);
    Object.entries(viewParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return `/tires/${encodeURIComponent(sku)}?${params.toString()}`;
  }, [sku, year, make, model_, trim, modification, size, source, viewParams]);
  
  // Calculate set price
  const setPrice = typeof price === 'number' ? price * 4 : null;
  
  // Category styling
  const catStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES['All-Season'];
  
  // Performance ratings from UTQG
  const ratings = useMemo(() => {
    if (!utqg) return null;
    const parsed = parseUTQG(utqg);
    if (!parsed || !parsed.treadwear) return null;
    return derivePerformanceRatings(parsed, category as any, is3PMSF ?? false);
  }, [utqg, category, is3PMSF]);
  
  // Display title - clean up the model name
  const displayTitle = cleanTireDisplayTitle(model, brand);
  
  return (
    <div
      className={`
        group relative flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-250 ease-out
        ${isTopPick
          ? "border border-amber-200/70 shadow-md"
          : "border border-neutral-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5"
        }
        ${isSelected
          ? "ring-2 ring-green-500 ring-offset-2"
          : ""
        }
      `}
    >
      {/* ═══════════════════════════════════════════════════════════════════════
          TOP PICK CATEGORY BADGE
          ═══════════════════════════════════════════════════════════════════════ */}
      {topPickConfig && (
        <div className={`px-3 py-2 ${topPickConfig.color}`}>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="text-sm">{topPickConfig.icon}</span>
            <span>{topPickConfig.label}</span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FITMENT BADGE ROW (When has vehicle, not top pick)
          ═══════════════════════════════════════════════════════════════════════ */}
      {hasVehicle && !topPickConfig && (
        <div className="px-3 py-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-600 text-white">
            <span>✓</span>
            Guaranteed Fit
          </span>
          {mileageWarranty && mileageWarranty >= 40000 && (
            <span className="text-[10px] text-neutral-400">
              {Math.round(mileageWarranty / 1000)}K mi warranty
            </span>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          IMAGE AREA
          ═══════════════════════════════════════════════════════════════════════ */}
      <Link href={viewHref} className="block relative overflow-hidden">
        <div className="aspect-square w-full overflow-hidden bg-neutral-50">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayTitle}
              className="h-full w-full object-contain p-4 transition-transform duration-250 ease-out group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6">
              <div className="text-center">
                <div className="text-4xl text-neutral-300">🛞</div>
                <div className="mt-2 text-xs font-semibold text-neutral-500">Image coming soon</div>
              </div>
            </div>
          )}
        </div>
        
        {/* Category badge overlay - bottom left of image */}
        <div className="absolute bottom-3 left-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow-md ${catStyle.bg}`}>
            <span className="drop-shadow-sm">{catStyle.icon}</span>
            <span>{category}</span>
          </span>
        </div>

        {/* Highlight label - top right */}
        {highlightLabel && (
          <div className={`absolute top-3 right-3 rounded-full ${highlightLabel.bg} px-2.5 py-1 text-[10px] font-bold text-white shadow-md`}>
            {highlightLabel.text}
          </div>
        )}
        
        {/* Action buttons overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {compareItem && (
            <AddToCompareButton
              item={compareItem}
              variant="icon"
              size="sm"
            />
          )}
          <FavoritesButton
            type="tire"
            sku={sku}
            label={`${brand} ${displayTitle}`}
            href={viewHref}
            imageUrl={imageUrl}
          />
        </div>
      </Link>

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTENT AREA
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col p-4 pt-3.5">
        
        {/* Brand + Title */}
        <div>
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">{brand}</div>
          <Link href={viewHref}>
            <h3 className="mt-1 text-base font-bold text-neutral-900 hover:text-neutral-700 transition-colors line-clamp-2">
              {displayTitle}
            </h3>
          </Link>
          
          {/* Mileage warranty if applicable */}
          {mileageWarranty && mileageWarranty >= 40000 && (
            <div className="mt-0.5 text-xs text-neutral-600">
              ✓ {Math.round(mileageWarranty / 1000)}K mile warranty
            </div>
          )}
        </div>

        {/* "Why This Tire" quote for top picks */}
        {whyThisTire && (
          <div className={`mt-2 text-[11px] leading-relaxed italic ${topPickCategory ? "text-neutral-600 font-medium" : "text-neutral-400"}`}>
            "{whyThisTire}"
          </div>
        )}

        {/* Best For line */}
        <div className="mt-2">
          <BestForLine 
            category={category as TireCategory}
            mileageWarranty={mileageWarranty}
            isRunFlat={isRunFlat}
            is3PMSF={is3PMSF}
            maxItems={2}
          />
        </div>

        {/* Tire size + specs */}
        <div className="mt-2 text-sm text-neutral-600">
          <span className="font-medium">{normalizeTireSize(size) || size}</span>
          {loadIndex && speedRating && (
            <span className="ml-1 text-neutral-500">
              {loadIndex}{speedRating}
            </span>
          )}
        </div>

        {/* Rebate badge if applicable */}
        {rebateLabel && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
              🔥 {rebateLabel}
            </span>
          </div>
        )}

        {/* Vehicle fitment confirmation */}
        {hasVehicle && (
          <div className="mt-2 text-[11px] font-medium text-green-700">
            <span className="text-green-600">✓</span> Fits {year} {make} {model_}
            {wheelDia && (
              <span className="ml-2 text-blue-600">• Matches {wheelDia}&quot; wheels</span>
            )}
          </div>
        )}

        {/* Availability */}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium">
          {inStock ? (
            <>
              <span className="text-green-600">✓</span>
              <span className="text-green-700">
                {stockQty >= 20 ? 'In stock' : `${stockQty} in stock`} • Ships 1–2 days
              </span>
            </>
          ) : (
            <>
              <span className="text-amber-500">📦</span>
              <span className="text-amber-700">Available • Ships 1–2 weeks</span>
            </>
          )}
        </div>

        {/* Performance ratings if we have UTQG data */}
        {ratings && (
          <div className="mt-3">
            <MiniRatings ratings={ratings} category={category as any} />
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1 min-h-3" />

        {/* ═══════════════════════════════════════════════════════════════════════
            PRICING SECTION - Matches wheel card style
            ═══════════════════════════════════════════════════════════════════════ */}
        <div className="mt-4 pt-4 border-t border-neutral-100">
          <div className="flex flex-col gap-1">
            {/* Per tire price - secondary */}
            {typeof price === 'number' && (
              <div className="flex items-baseline gap-1 text-neutral-500">
                <span className="text-sm font-semibold">
                  ${price.toFixed(2)}
                </span>
                <span className="text-xs">per tire</span>
              </div>
            )}
            
            {/* Set of 4 total - PRIMARY */}
            <div className="flex items-baseline gap-2 px-3 py-2 bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-xl">
              <span className="text-2xl font-black text-neutral-900">
                {setPrice !== null 
                  ? `$${setPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : "Call for price"
                }
              </span>
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                for all 4
              </span>
            </div>
            
            {/* Affirm financing */}
            {setPrice !== null && setPrice >= 50 && (
              <FinancingBadge price={setPrice} variant="compact" />
            )}
          </div>

          {/* Price anchoring */}
          <PriceAnchorBlock tireSetPrice={setPrice} quantity={4} />

          {/* Stock availability indicator */}
          {inStock && stockQty > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[10px]">
                ✓
              </span>
              {stockQty >= 100 ? "100+ avail" : `${stockQty} avail`}
            </div>
          )}

          {/* Trust strip */}
          <div className="mt-3">
            <TrustStrip hasVehicle={hasVehicle} isLocalMode={isLocalMode} />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            CTA BUTTON - Matches wheel card style
            ═══════════════════════════════════════════════════════════════════════ */}
        <button
          type="button"
          onClick={() => onSelect?.(4)}
          disabled={isSelected}
          className={`
            mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-xl 
            text-sm font-bold transition-all duration-250
            ${isSelected
              ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white cursor-default shadow-md shadow-emerald-500/25"
              : "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-600 active:scale-[0.99] shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/25"
            }
          `}
        >
          {isSelected ? (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              Added to Package
            </>
          ) : isPackageFlow ? (
            <>
              ✓ Add 4 to Package
              {setPrice !== null && (
                <span className="opacity-90 font-bold">
                  • ${setPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
            </>
          ) : (
            <>
              Add Set of 4
              {setPrice !== null && (
                <span className="opacity-90 font-bold">
                  – ${setPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
            </>
          )}
        </button>

        {/* View Details link */}
        <div className="mt-2 text-center">
          <Link
            href={viewHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            View Details
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
