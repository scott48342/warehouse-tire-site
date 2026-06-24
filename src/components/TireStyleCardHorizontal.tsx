"use client";

import Link from "next/link";
import type { TopPickCategory } from "@/components/TireStyleCard";
import type { RebateMatchData } from "@/hooks/useRebateMatch";
import { RebateSRPBadge } from "@/components/RebateBlock";

// ─── Category styles (mirrors TireStyleCard) ─────────────────────────────────
const CATEGORY_STYLES: Record<string, { bg: string; icon: string }> = {
  "All-Terrain":           { bg: "bg-gradient-to-r from-amber-600 to-amber-500",   icon: "🏔️" },
  "Mud-Terrain":           { bg: "bg-gradient-to-r from-orange-700 to-orange-600", icon: "🪨" },
  "Rugged-Terrain":        { bg: "bg-gradient-to-r from-stone-700 to-stone-600",   icon: "⛰️" },
  "Winter":                { bg: "bg-gradient-to-r from-sky-600 to-sky-500",       icon: "❄️" },
  "Performance":           { bg: "bg-gradient-to-r from-red-600 to-red-500",       icon: "🏎️" },
  "Highway/Touring":       { bg: "bg-gradient-to-r from-blue-600 to-blue-500",     icon: "🛣️" },
  "All-Season":            { bg: "bg-gradient-to-r from-green-600 to-green-500",   icon: "🌤️" },
  "All-Weather":           { bg: "bg-gradient-to-r from-teal-600 to-teal-500",     icon: "🌦️" },
  "Summer":                { bg: "bg-gradient-to-r from-yellow-500 to-yellow-400", icon: "☀️" },
  "Crossover/SUV Touring": { bg: "bg-gradient-to-r from-green-600 to-green-500",   icon: "🌤️" },
};

// ─── Top pick config ──────────────────────────────────────────────────────────
const TOP_PICK_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  "best-overall":  { icon: "⭐", label: "Best Overall",  color: "bg-gradient-to-r from-amber-400/90 to-yellow-400/90 text-amber-950" },
  "most-popular":  { icon: "📈", label: "Trending",      color: "bg-gradient-to-r from-orange-400/90 to-amber-400/90 text-orange-950" },
  "best-value":    { icon: "💰", label: "Best Value",    color: "bg-gradient-to-r from-emerald-400/90 to-teal-400/90 text-emerald-950" },
  "best-warranty": { icon: "🛡️", label: "Best Warranty", color: "bg-gradient-to-r from-blue-400/90 to-indigo-400/90 text-blue-950" },
};

// ─── Props ────────────────────────────────────────────────────────────────────
export type TireStyleCardHorizontalProps = {
  sku: string;
  brand: string;
  /** Tire model / display name */
  title: string;
  imageUrl?: string;
  /** Price per tire */
  price?: number;
  /** Tire size string e.g. "235/75R15" */
  size: string;
  /** Tread category e.g. "All-Season", "All-Terrain" */
  category?: string;
  /** UTQG string e.g. "740 A A" */
  utqg?: string;
  /** Mileage warranty in miles */
  mileageWarranty?: number;
  /** Total stock count across all warehouses (no location codes shown) */
  stockQty?: number;
  topPickCategory?: TopPickCategory;
  /** Pre-built detail page href */
  viewHref: string;
  /** Called when the Add to Cart / Add to Package button is clicked */
  onAddToCart?: () => void;
  isSelected?: boolean;
  hasSelection?: boolean;
  isPackageFlow?: boolean;
  rebateMatch?: RebateMatchData | null;
};

// ─── Component ───────────────────────────────────────────────────────────────
export function TireStyleCardHorizontal({
  brand,
  title,
  imageUrl,
  price,
  size,
  category = "All-Season",
  utqg,
  mileageWarranty,
  stockQty = 0,
  topPickCategory,
  viewHref,
  onAddToCart,
  isSelected = false,
  hasSelection = false,
  isPackageFlow = false,
  rebateMatch,
}: TireStyleCardHorizontalProps) {
  const setPrice = typeof price === "number" ? price * 4 : null;
  const catStyle = CATEGORY_STYLES[category] ?? CATEGORY_STYLES["All-Season"];
  const topPickConfig = topPickCategory ? TOP_PICK_CONFIG[topPickCategory] : null;

  // Stock label — no warehouse location codes
  const stockLabel = (() => {
    if (stockQty <= 0)
      return (
        <span className="text-[9px] text-red-500 font-bold text-center leading-tight">
          ✗ Out
          <br />
          of Stock
        </span>
      );
    if (stockQty <= 3)
      return (
        <span className="text-[9px] text-amber-600 font-bold text-center leading-tight">
          ⚠ Only {stockQty}
          <br />
          left
        </span>
      );
    return (
      <span className="text-[9px] text-green-600 font-semibold text-center leading-tight">
        ✔ In
        <br />
        Stock
      </span>
    );
  })();

  return (
    <div
      className={`flex flex-row bg-white border rounded-xl overflow-hidden shadow-sm transition-all duration-200 ${
        isSelected
          ? "border-green-500 ring-2 ring-green-500 ring-offset-1"
          : "border-neutral-200 hover:shadow-md hover:border-neutral-300"
      }`}
    >
      {/* ══ IMAGE PANEL — 120 px fixed ════════════════════════════════════════ */}
      <div className="relative w-[120px] min-w-[120px] bg-neutral-50 flex items-center justify-center p-2">
        {/* Category pill — bottom-left */}
        <div className="absolute bottom-2 left-1.5 z-10">
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm ${catStyle.bg}`}
          >
            {catStyle.icon}
          </span>
        </div>

        {/* Top pick badge — top-right */}
        {topPickConfig && (
          <div className="absolute top-2 right-1.5 z-10">
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow-sm ${topPickConfig.color}`}
            >
              {topPickConfig.icon}
            </span>
          </div>
        )}

        {/* Tire image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full aspect-square object-contain"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center text-neutral-300 text-3xl">
            🛞
          </div>
        )}
      </div>

      {/* ══ INFO PANEL — flex-1 ═══════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col gap-0.5">
        {/* Brand */}
        <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
          {brand}
        </span>

        {/* Title */}
        <Link href={viewHref}>
          <h3 className="text-sm font-bold text-neutral-900 line-clamp-1 hover:text-neutral-600 transition-colors">
            {title}
          </h3>
        </Link>

        {/* Size */}
        <div className="text-[11px] text-neutral-500 leading-snug">{size}</div>

        {/* UTQG */}
        {utqg && (
          <div className="text-[10px] text-neutral-400">UTQG {utqg}</div>
        )}

        {/* Mileage warranty */}
        {mileageWarranty && mileageWarranty >= 40000 && (
          <div className="text-[10px] text-neutral-400">
            {Math.round(mileageWarranty / 1000)}K mi warranty
          </div>
        )}

        {/* Rebate badge */}
        {rebateMatch && (
          <div className="mt-0.5">
            <RebateSRPBadge match={rebateMatch} compact />
          </div>
        )}

        {/* Price — pushed to bottom of info panel */}
        <div className="flex items-baseline gap-1.5 mt-auto pt-1">
          {typeof price === "number" ? (
            <>
              <span className="text-base font-extrabold text-neutral-900">
                ${price.toFixed(0)}
              </span>
              <span className="text-[11px] text-neutral-400">ea</span>
              {setPrice !== null && (
                <span className="text-[11px] text-neutral-400">
                  ·&nbsp;$
                  {setPrice.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}{" "}
                  set
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-neutral-500">Call for price</span>
          )}
        </div>
      </div>

      {/* ══ CTA PANEL — 88 px fixed ═══════════════════════════════════════════ */}
      <div className="flex flex-col gap-1.5 justify-center items-stretch px-2 py-2.5 min-w-[88px] max-w-[88px] border-l border-neutral-100">
        {/* Primary CTA */}
        <button
          type="button"
          onClick={() => {
            if (!isSelected) onAddToCart?.();
          }}
          disabled={isSelected}
          className={`
            text-[10px] font-bold uppercase rounded-md px-2 py-2
            leading-tight text-center transition-all
            ${
              isSelected
                ? "bg-green-500 text-white cursor-default"
                : hasSelection
                  ? "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                  : "bg-red-600 text-white hover:bg-red-500 active:scale-[0.98]"
            }
          `}
        >
          {isSelected ? (
            "✓ Selected"
          ) : hasSelection ? (
            "Switch"
          ) : isPackageFlow ? (
            <>
              Add to
              <br />
              Package
            </>
          ) : (
            <>
              Add 4
              <br />
              to Cart
            </>
          )}
        </button>

        {/* Details link */}
        <Link
          href={viewHref}
          className="text-center text-[10px] font-semibold border border-neutral-200 rounded-md px-2 py-1.5 hover:bg-neutral-50 transition-colors text-neutral-600"
        >
          Details
        </Link>

        {/* Stock status — no warehouse location codes */}
        <div className="flex justify-center">{stockLabel}</div>
      </div>
    </div>
  );
}
