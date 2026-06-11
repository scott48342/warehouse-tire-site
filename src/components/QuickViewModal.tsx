"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useVehicleMemory } from "@/contexts/VehicleMemoryContext";
import { useCart, type CartTireItem, type CartWheelItem } from "@/lib/cart/CartContext";
import { FinancingBadge } from "@/components/FinancingBadge";
import { normalizeTireSize, cleanTireDisplayTitle } from "@/lib/productFormat";
import { trackQuickViewEvent } from "@/lib/analytics/quickViewAnalytics";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type QuickViewProductType = "tire" | "wheel" | "package";

export type QuickViewTireData = {
  type: "tire";
  sku: string;
  brand: string;
  model: string;
  size: string;
  imageUrl?: string;
  price?: number;
  loadIndex?: string;
  speedRating?: string;
  category?: string;
  season?: string;
  mileageWarranty?: number;
  is3PMSF?: boolean;
  isRunFlat?: boolean;
  stockQty?: number;
  inStock?: boolean;
  source?: string;
  // Vehicle context from search
  year?: string;
  make?: string;
  vehicleModel?: string;
  trim?: string;
  modification?: string;
};

export type QuickViewWheelData = {
  type: "wheel";
  sku: string;
  brand: string;
  model: string;
  finish?: string;
  imageUrl?: string;
  price?: number;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  centerbore?: string;
  stockQty?: number;
  inventoryType?: string;
  fitmentClass?: "surefit" | "specfit" | "extended";
  // Vehicle context from search
  year?: string;
  make?: string;
  vehicleModel?: string;
  trim?: string;
  modification?: string;
};

export type QuickViewPackageData = {
  type: "package";
  tire: QuickViewTireData;
  wheel: QuickViewWheelData;
};

export type QuickViewData = QuickViewTireData | QuickViewWheelData | QuickViewPackageData;

type QuickViewModalProps = {
  open: boolean;
  data: QuickViewData | null;
  onClose: () => void;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY STYLING (Matching tire card)
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
};

// ═══════════════════════════════════════════════════════════════════════════════
// FITMENT BADGE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const FITMENT_CONFIG = {
  surefit: { label: "Guaranteed Fit", icon: "✓", className: "bg-green-600 text-white" },
  specfit: { label: "Good Fit", icon: "✓", className: "bg-blue-600 text-white" },
  extended: { label: "Custom Fit", icon: "⚡", className: "bg-amber-500 text-white" },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY TYPE LABELS
// ═══════════════════════════════════════════════════════════════════════════════

const INVENTORY_TYPE_LABELS: Record<string, string> = {
  ST: "In Stock",
  BW: "In Stock",
  NW: "In Stock",
  SO: "Special Order",
  CS: "Custom Build",
  DB: "Available",
  N2: "Ships Soon",
  RW: "Special Order",
};

// ═══════════════════════════════════════════════════════════════════════════════
// TIRE QUICK VIEW CONTENT
// ═══════════════════════════════════════════════════════════════════════════════

function TireQuickViewContent({
  data,
  onAddToCart,
  onViewDetails,
  hasVehicle,
  vehicleLabel,
}: {
  data: QuickViewTireData;
  onAddToCart: () => void;
  onViewDetails: () => void;
  hasVehicle: boolean;
  vehicleLabel: string;
}) {
  const displayTitle = cleanTireDisplayTitle(data.model, data.brand);
  const setPrice = typeof data.price === "number" ? data.price * 4 : null;
  const catStyle = CATEGORY_STYLES[data.category || "All-Season"] || CATEGORY_STYLES["All-Season"];

  // Build view href
  const viewHref = (() => {
    const params = new URLSearchParams();
    if (data.year) params.set("year", data.year);
    if (data.make) params.set("make", data.make);
    if (data.vehicleModel) params.set("model", data.vehicleModel);
    if (data.trim) params.set("trim", data.trim);
    if (data.modification) params.set("modification", data.modification);
    params.set("size", data.size);
    if (data.source) params.set("source", data.source);
    return `/tires/${encodeURIComponent(data.sku)}?${params.toString()}`;
  })();

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Image Section */}
      <div className="relative">
        <div className="aspect-square bg-neutral-50 rounded-2xl overflow-hidden">
          {data.imageUrl ? (
            <img
              src={data.imageUrl}
              alt={displayTitle}
              className="h-full w-full object-contain p-6"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <div className="text-6xl text-neutral-300">🛞</div>
                <div className="mt-2 text-sm font-semibold text-neutral-500">Image coming soon</div>
              </div>
            </div>
          )}
        </div>
        
        {/* Category badge */}
        {data.category && (
          <div className="absolute bottom-4 left-4">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-md ${catStyle.bg}`}>
              <span>{catStyle.icon}</span>
              <span>{data.category}</span>
            </span>
          </div>
        )}
      </div>

      {/* Details Section */}
      <div className="flex flex-col">
        {/* Brand + Title */}
        <div className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
          {data.brand}
        </div>
        <h2 className="mt-1 text-2xl font-bold text-neutral-900">
          {displayTitle}
        </h2>

        {/* Fitment badge */}
        {hasVehicle && (
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-600 text-white">
              <span>✓</span>
              Fits Your Vehicle
            </span>
            <span className="text-sm text-neutral-600">{vehicleLabel}</span>
          </div>
        )}

        {/* Size + Specs */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-neutral-900">
              {normalizeTireSize(data.size) || data.size}
            </span>
            {data.loadIndex && data.speedRating && (
              <span className="text-neutral-500">
                {data.loadIndex}{data.speedRating}
              </span>
            )}
          </div>

          {/* Specs Grid */}
          <div className="grid grid-cols-2 gap-3 mt-4 p-4 bg-neutral-50 rounded-xl">
            {data.loadIndex && (
              <div>
                <div className="text-xs text-neutral-500 uppercase">Load Index</div>
                <div className="text-sm font-semibold text-neutral-900">{data.loadIndex}</div>
              </div>
            )}
            {data.speedRating && (
              <div>
                <div className="text-xs text-neutral-500 uppercase">Speed Rating</div>
                <div className="text-sm font-semibold text-neutral-900">{data.speedRating}</div>
              </div>
            )}
            {data.season && (
              <div>
                <div className="text-xs text-neutral-500 uppercase">Season</div>
                <div className="text-sm font-semibold text-neutral-900">{data.season}</div>
              </div>
            )}
            {data.category && (
              <div>
                <div className="text-xs text-neutral-500 uppercase">Category</div>
                <div className="text-sm font-semibold text-neutral-900">{data.category}</div>
              </div>
            )}
            {data.mileageWarranty && data.mileageWarranty > 0 && (
              <div>
                <div className="text-xs text-neutral-500 uppercase">Warranty</div>
                <div className="text-sm font-semibold text-neutral-900">
                  {Math.round(data.mileageWarranty / 1000)}K miles
                </div>
              </div>
            )}
            {(data.is3PMSF || data.isRunFlat) && (
              <div>
                <div className="text-xs text-neutral-500 uppercase">Features</div>
                <div className="flex flex-wrap gap-1">
                  {data.is3PMSF && (
                    <span className="text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">
                      3PMSF ❄️
                    </span>
                  )}
                  {data.isRunFlat && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      Run-Flat
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Availability */}
        <div className="mt-4 flex items-center gap-2 text-sm">
          {data.inStock !== false ? (
            <>
              <span className="text-green-600">✓</span>
              <span className="text-green-700 font-medium">
                {typeof data.stockQty === "number" && data.stockQty < 20
                  ? `${data.stockQty} in stock`
                  : "In stock"}
                {" • Ships 1–2 days"}
              </span>
            </>
          ) : (
            <>
              <span className="text-amber-500">📦</span>
              <span className="text-amber-700 font-medium">Available • Ships 1–2 weeks</span>
            </>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-4" />

        {/* Pricing */}
        <div className="mt-6 pt-4 border-t border-neutral-100">
          {typeof data.price === "number" && (
            <div className="flex items-baseline gap-2 text-neutral-500">
              <span className="text-lg font-semibold">${data.price.toFixed(2)}</span>
              <span className="text-sm">per tire</span>
            </div>
          )}
          
          <div className="mt-2 flex items-baseline gap-3 px-4 py-3 bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-xl">
            <span className="text-3xl font-black text-neutral-900">
              {setPrice !== null
                ? `$${setPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : "Call for price"}
            </span>
            <span className="text-sm font-semibold text-neutral-500 uppercase">for all 4</span>
          </div>

          {setPrice !== null && setPrice >= 50 && (
            <div className="mt-2">
              <FinancingBadge price={setPrice} variant="compact" />
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onAddToCart}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold hover:from-red-500 hover:to-red-600 transition-all shadow-md shadow-red-500/20"
          >
            Add Set of 4 to Cart
          </button>
          <Link
            href={viewHref}
            onClick={onViewDetails}
            className="flex-1 h-12 rounded-xl border border-neutral-200 bg-white text-neutral-900 font-bold hover:bg-neutral-50 transition-all flex items-center justify-center"
          >
            View Full Details
          </Link>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL QUICK VIEW CONTENT
// ═══════════════════════════════════════════════════════════════════════════════

function WheelQuickViewContent({
  data,
  onAddToCart,
  onViewDetails,
  hasVehicle,
  vehicleLabel,
}: {
  data: QuickViewWheelData;
  onAddToCart: () => void;
  onViewDetails: () => void;
  hasVehicle: boolean;
  vehicleLabel: string;
}) {
  const setPrice = typeof data.price === "number" ? data.price * 4 : null;
  const fitmentConfig = data.fitmentClass ? FITMENT_CONFIG[data.fitmentClass] : null;

  // Build view href
  const viewHref = (() => {
    const params = new URLSearchParams();
    if (data.year) params.set("year", data.year);
    if (data.make) params.set("make", data.make);
    if (data.vehicleModel) params.set("model", data.vehicleModel);
    if (data.trim) params.set("trim", data.trim);
    if (data.modification) params.set("modification", data.modification);
    if (data.diameter) params.set("wheelDia", data.diameter);
    if (data.width) params.set("wheelWidth", data.width);
    if (data.offset) params.set("wheelOffset", data.offset);
    if (data.boltPattern) params.set("wheelBolt", data.boltPattern);
    return `/wheels/${encodeURIComponent(data.sku)}?${params.toString()}`;
  })();

  const formatOffset = (offset?: string) => {
    if (!offset) return null;
    const num = Number(offset);
    return Number.isFinite(num) ? (num >= 0 ? `+${num}` : String(num)) : offset;
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Image Section */}
      <div className="relative">
        <div className="aspect-square bg-neutral-50 rounded-2xl overflow-hidden">
          {data.imageUrl ? (
            <img
              src={data.imageUrl}
              alt={`${data.brand} ${data.model}`}
              className="h-full w-full object-contain p-6"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <div className="text-6xl text-neutral-300">⚙️</div>
                <div className="mt-2 text-sm font-semibold text-neutral-500">Image coming soon</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Section */}
      <div className="flex flex-col">
        {/* Brand + Title */}
        <div className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
          {data.brand}
        </div>
        <h2 className="mt-1 text-2xl font-bold text-neutral-900">
          {data.model}
        </h2>
        {data.finish && (
          <div className="mt-1 text-neutral-600">{data.finish}</div>
        )}

        {/* Fitment badge */}
        {hasVehicle && (
          <div className="mt-3 flex items-center gap-2">
            {fitmentConfig ? (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${fitmentConfig.className}`}>
                <span>{fitmentConfig.icon}</span>
                {fitmentConfig.label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-600 text-white">
                <span>✓</span>
                Fits Your Vehicle
              </span>
            )}
            <span className="text-sm text-neutral-600">{vehicleLabel}</span>
          </div>
        )}

        {/* Size + Specs */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3">
            {data.diameter && (
              <span className="text-lg font-bold text-neutral-900">
                {data.diameter}" × {data.width}"
              </span>
            )}
            {data.offset && (
              <span className="text-neutral-500">
                ET{formatOffset(data.offset)}
              </span>
            )}
          </div>

          {/* Specs Grid */}
          <div className="grid grid-cols-2 gap-3 mt-4 p-4 bg-neutral-50 rounded-xl">
            {data.diameter && (
              <div>
                <div className="text-xs text-neutral-500 uppercase">Diameter</div>
                <div className="text-sm font-semibold text-neutral-900">{data.diameter}"</div>
              </div>
            )}
            {data.width && (
              <div>
                <div className="text-xs text-neutral-500 uppercase">Width</div>
                <div className="text-sm font-semibold text-neutral-900">{data.width}"</div>
              </div>
            )}
            {data.offset && (
              <div>
                <div className="text-xs text-neutral-500 uppercase">Offset</div>
                <div className="text-sm font-semibold text-neutral-900">ET{formatOffset(data.offset)}</div>
              </div>
            )}
            {data.boltPattern && (
              <div>
                <div className="text-xs text-neutral-500 uppercase">Bolt Pattern</div>
                <div className="text-sm font-semibold text-neutral-900">{data.boltPattern}</div>
              </div>
            )}
            {data.finish && (
              <div className="col-span-2">
                <div className="text-xs text-neutral-500 uppercase">Finish</div>
                <div className="text-sm font-semibold text-neutral-900">{data.finish}</div>
              </div>
            )}
          </div>
        </div>

        {/* Availability */}
        <div className="mt-4 flex items-center gap-2 text-sm">
          {typeof data.stockQty === "number" && data.stockQty > 0 ? (
            <>
              <span className="text-green-600">✓</span>
              <span className="text-green-700 font-medium">
                {data.stockQty >= 20 ? "20+ in stock" : `${data.stockQty} in stock`}
              </span>
            </>
          ) : data.inventoryType && INVENTORY_TYPE_LABELS[data.inventoryType] ? (
            <>
              <span className="text-blue-500">📦</span>
              <span className="text-blue-700 font-medium">
                {INVENTORY_TYPE_LABELS[data.inventoryType]}
              </span>
            </>
          ) : (
            <>
              <span className="text-neutral-400">📦</span>
              <span className="text-neutral-600 font-medium">Contact for availability</span>
            </>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-4" />

        {/* Pricing */}
        <div className="mt-6 pt-4 border-t border-neutral-100">
          {typeof data.price === "number" && (
            <div className="flex items-baseline gap-2 text-neutral-500">
              <span className="text-lg font-semibold">${data.price.toFixed(0)}</span>
              <span className="text-sm">per wheel</span>
            </div>
          )}
          
          <div className="mt-2 flex items-baseline gap-3 px-4 py-3 bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-xl">
            <span className="text-3xl font-black text-neutral-900">
              {setPrice !== null
                ? `$${setPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : "Call for price"}
            </span>
            <span className="text-sm font-semibold text-neutral-500 uppercase">set of 4</span>
          </div>

          {setPrice !== null && setPrice >= 50 && (
            <div className="mt-2">
              <FinancingBadge price={setPrice} variant="compact" />
            </div>
          )}

          {/* Trust strip */}
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-neutral-400">
            <span className="inline-flex items-center gap-1">
              <span className="text-emerald-500">✓</span>
              Hardware Included
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-emerald-500">✓</span>
              Guaranteed Fit
            </span>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onAddToCart}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold hover:from-red-500 hover:to-red-600 transition-all shadow-md shadow-red-500/20"
          >
            Add Set of 4 to Cart
          </button>
          <Link
            href={viewHref}
            onClick={onViewDetails}
            className="flex-1 h-12 rounded-xl border border-neutral-200 bg-white text-neutral-900 font-bold hover:bg-neutral-50 transition-all flex items-center justify-center"
          >
            View Full Details
          </Link>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE QUICK VIEW CONTENT
// ═══════════════════════════════════════════════════════════════════════════════

function PackageQuickViewContent({
  data,
  onAddToCart,
  onViewDetails,
  hasVehicle,
  vehicleLabel,
}: {
  data: QuickViewPackageData;
  onAddToCart: () => void;
  onViewDetails: () => void;
  hasVehicle: boolean;
  vehicleLabel: string;
}) {
  const { tire, wheel } = data;
  const tireSetPrice = typeof tire.price === "number" ? tire.price * 4 : 0;
  const wheelSetPrice = typeof wheel.price === "number" ? wheel.price * 4 : 0;
  const totalPrice = tireSetPrice + wheelSetPrice;

  return (
    <div className="space-y-6">
      {/* Fitment badge */}
      {hasVehicle && (
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-green-600 text-white">
            <span>✓</span>
            Complete Package for Your Vehicle
          </span>
          <span className="text-sm text-green-700">{vehicleLabel}</span>
        </div>
      )}

      {/* Package Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Wheel Card */}
        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-white rounded-lg overflow-hidden flex-shrink-0">
              {wheel.imageUrl ? (
                <img src={wheel.imageUrl} alt={wheel.model} className="w-full h-full object-contain p-2" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-neutral-300">⚙️</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-neutral-500 uppercase">Wheels (×4)</div>
              <div className="font-bold text-neutral-900 truncate">{wheel.brand} {wheel.model}</div>
              <div className="text-sm text-neutral-600">{wheel.diameter}" × {wheel.width}"</div>
              {wheelSetPrice > 0 && (
                <div className="mt-1 font-bold text-neutral-900">
                  ${wheelSetPrice.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tire Card */}
        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-white rounded-lg overflow-hidden flex-shrink-0">
              {tire.imageUrl ? (
                <img src={tire.imageUrl} alt={tire.model} className="w-full h-full object-contain p-2" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-neutral-300">🛞</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-neutral-500 uppercase">Tires (×4)</div>
              <div className="font-bold text-neutral-900 truncate">{tire.brand} {tire.model}</div>
              <div className="text-sm text-neutral-600">{tire.size}</div>
              {tireSetPrice > 0 && (
                <div className="mt-1 font-bold text-neutral-900">
                  ${tireSetPrice.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Total Pricing */}
      <div className="p-4 bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-neutral-600">Package Total</div>
            <div className="text-3xl font-black text-neutral-900">
              ${totalPrice.toLocaleString()}
            </div>
          </div>
          {totalPrice >= 50 && (
            <FinancingBadge price={totalPrice} variant="compact" />
          )}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onAddToCart}
          className="flex-1 h-12 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold hover:from-red-500 hover:to-red-600 transition-all shadow-md shadow-red-500/20"
        >
          Add Package to Cart
        </button>
        <button
          type="button"
          onClick={onViewDetails}
          className="flex-1 h-12 rounded-xl border border-neutral-200 bg-white text-neutral-900 font-bold hover:bg-neutral-50 transition-all"
        >
          View Full Details
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function QuickViewModal({ open, data, onClose }: QuickViewModalProps) {
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const { activeVehicle, hasCompleteVehicle } = useVehicleMemory();
  const { addItem } = useCart();
  const [isClosing, setIsClosing] = useState(false);

  // Track open event
  useEffect(() => {
    if (open && data) {
      trackQuickViewEvent("quick_view_opened", {
        product_sku: data.type === "package" ? `${data.wheel.sku}+${data.tire.sku}` : data.sku,
        product_type: data.type,
        has_active_vehicle: hasCompleteVehicle,
      });
    }
  }, [open, data, hasCompleteVehicle]);

  // Manage dialog open/close
  useEffect(() => {
    const dlg = dlgRef.current;
    if (!dlg) return;

    if (open) {
      dlg.showModal();
      document.body.style.overflow = "hidden";
    } else {
      dlg.close();
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleClose = useCallback(() => {
    if (!data) return;
    
    setIsClosing(true);
    trackQuickViewEvent("quick_view_closed", {
      product_sku: data.type === "package" ? `${data.wheel.sku}+${data.tire.sku}` : data.sku,
      product_type: data.type,
      has_active_vehicle: hasCompleteVehicle,
    });
    
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 150);
  }, [data, hasCompleteVehicle, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === dlgRef.current) {
      handleClose();
    }
  }, [handleClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        handleClose();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  const vehicleLabel = activeVehicle
    ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`
    : "";

  const handleAddToCart = useCallback(() => {
    if (!data) return;

    if (data.type === "tire") {
      const item: CartTireItem = {
        type: "tire",
        sku: data.sku,
        brand: data.brand,
        model: data.model,
        size: data.size,
        loadIndex: data.loadIndex,
        speedRating: data.speedRating,
        imageUrl: data.imageUrl,
        unitPrice: data.price || 0,
        quantity: 4,
        source: data.source,
        vehicle: activeVehicle
          ? {
              year: activeVehicle.year,
              make: activeVehicle.make,
              model: activeVehicle.model,
              trim: activeVehicle.trim,
              modification: activeVehicle.modification,
            }
          : undefined,
      };
      addItem(item, "quick_view");
      
      trackQuickViewEvent("quick_view_add_to_cart", {
        product_sku: data.sku,
        product_type: "tire",
        has_active_vehicle: hasCompleteVehicle,
      });
    } else if (data.type === "wheel") {
      const item: CartWheelItem = {
        type: "wheel",
        sku: data.sku,
        brand: data.brand,
        model: data.model,
        finish: data.finish,
        diameter: data.diameter,
        width: data.width,
        offset: data.offset,
        boltPattern: data.boltPattern,
        imageUrl: data.imageUrl,
        unitPrice: data.price || 0,
        quantity: 4,
        fitmentClass: data.fitmentClass,
        vehicle: activeVehicle
          ? {
              year: activeVehicle.year,
              make: activeVehicle.make,
              model: activeVehicle.model,
              trim: activeVehicle.trim,
              modification: activeVehicle.modification,
            }
          : undefined,
      };
      addItem(item, "quick_view");
      
      trackQuickViewEvent("quick_view_add_to_cart", {
        product_sku: data.sku,
        product_type: "wheel",
        has_active_vehicle: hasCompleteVehicle,
      });
    } else if (data.type === "package") {
      // Add wheel
      const wheelItem: CartWheelItem = {
        type: "wheel",
        sku: data.wheel.sku,
        brand: data.wheel.brand,
        model: data.wheel.model,
        finish: data.wheel.finish,
        diameter: data.wheel.diameter,
        width: data.wheel.width,
        offset: data.wheel.offset,
        boltPattern: data.wheel.boltPattern,
        imageUrl: data.wheel.imageUrl,
        unitPrice: data.wheel.price || 0,
        quantity: 4,
        fitmentClass: data.wheel.fitmentClass,
        vehicle: activeVehicle
          ? {
              year: activeVehicle.year,
              make: activeVehicle.make,
              model: activeVehicle.model,
              trim: activeVehicle.trim,
              modification: activeVehicle.modification,
            }
          : undefined,
      };
      addItem(wheelItem, "quick_view");

      // Add tire
      const tireItem: CartTireItem = {
        type: "tire",
        sku: data.tire.sku,
        brand: data.tire.brand,
        model: data.tire.model,
        size: data.tire.size,
        loadIndex: data.tire.loadIndex,
        speedRating: data.tire.speedRating,
        imageUrl: data.tire.imageUrl,
        unitPrice: data.tire.price || 0,
        quantity: 4,
        source: data.tire.source,
        vehicle: activeVehicle
          ? {
              year: activeVehicle.year,
              make: activeVehicle.make,
              model: activeVehicle.model,
              trim: activeVehicle.trim,
              modification: activeVehicle.modification,
            }
          : undefined,
      };
      addItem(tireItem, "quick_view");
      
      trackQuickViewEvent("quick_view_add_to_cart", {
        product_sku: `${data.wheel.sku}+${data.tire.sku}`,
        product_type: "package",
        has_active_vehicle: hasCompleteVehicle,
      });
    }

    handleClose();
  }, [data, activeVehicle, hasCompleteVehicle, addItem, handleClose]);

  const handleViewDetails = useCallback(() => {
    if (!data) return;
    
    trackQuickViewEvent("quick_view_view_details", {
      product_sku: data.type === "package" ? `${data.wheel.sku}+${data.tire.sku}` : data.sku,
      product_type: data.type,
      has_active_vehicle: hasCompleteVehicle,
    });
    
    handleClose();
  }, [data, hasCompleteVehicle, handleClose]);

  if (!data) return null;

  return (
    <dialog
      ref={dlgRef}
      className={`
        fixed inset-0 z-[100] m-0 h-full w-full max-h-full max-w-full
        bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm
        ${isClosing ? "opacity-0" : "opacity-100"}
        transition-opacity duration-150
      `}
      onClick={handleBackdropClick}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`
            relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl
            ${isClosing ? "scale-95" : "scale-100"}
            transition-transform duration-150
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Quick View
              </div>
              <h2 className="text-lg font-bold text-neutral-900">
                {data.type === "package"
                  ? "Package Details"
                  : data.type === "tire"
                  ? "Tire Details"
                  : "Wheel Details"}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="h-10 w-10 rounded-xl border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors flex items-center justify-center"
              aria-label="Close quick view"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {data.type === "tire" && (
              <TireQuickViewContent
                data={data}
                onAddToCart={handleAddToCart}
                onViewDetails={handleViewDetails}
                hasVehicle={hasCompleteVehicle}
                vehicleLabel={vehicleLabel}
              />
            )}
            {data.type === "wheel" && (
              <WheelQuickViewContent
                data={data}
                onAddToCart={handleAddToCart}
                onViewDetails={handleViewDetails}
                hasVehicle={hasCompleteVehicle}
                vehicleLabel={vehicleLabel}
              />
            )}
            {data.type === "package" && (
              <PackageQuickViewContent
                data={data}
                onAddToCart={handleAddToCart}
                onViewDetails={handleViewDetails}
                hasVehicle={hasCompleteVehicle}
                vehicleLabel={vehicleLabel}
              />
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}

export default QuickViewModal;
