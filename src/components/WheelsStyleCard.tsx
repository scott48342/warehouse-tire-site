"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FavoritesButton } from "@/components/FavoritesButton";
import { useCart } from "@/lib/cart/CartContext";
import { calculateAccessoryFitment, type DBProfileForAccessories } from "@/hooks/useAccessoryFitment";
import { 
  isAccessoryAutoAddEnabled, 
  safeAutoAddAccessories, 
  logAccessoryEvent 
} from "@/lib/cart/accessoryAutoAdd";

export type WheelFinishThumb = {
  finish: string;
  sku: string;
  imageUrl?: string;
  price?: number;
  pair?: WheelPair;
};

export type WheelPick = {
  sku: string;
  diameter?: string;
  width?: string;
  offset?: string;
};

export type WheelPair = {
  staggered: boolean;
  front: WheelPick;
  rear?: WheelPick;
};

function fmtSizePart(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toString();
}

// ═══════════════════════════════════════════════════════════════════════════════
// FITMENT BADGE CONFIG - Conversion-optimized copy
// ═══════════════════════════════════════════════════════════════════════════════
const FITMENT_CONFIG = {
  surefit: {
    label: "Guaranteed Fit",
    sublabel: "Verified for your vehicle",
    bgClass: "bg-green-600",
    textClass: "text-white",
    icon: "✓",
  },
  specfit: {
    label: "Good Fit",
    sublabel: "Works with your vehicle",
    bgClass: "bg-blue-600",
    textClass: "text-white",
    icon: "✓",
  },
  extended: {
    label: "Custom Fit",
    sublabel: "May need modifications",
    bgClass: "bg-amber-500",
    textClass: "text-white",
    icon: "⚡",
  },
} as const;

export function WheelsStyleCard({
  brand,
  title,
  baseSku,
  baseFinish,
  baseImageUrl,
  price,
  sizeLabel,
  finishThumbs,
  viewParams,
  specLabel,
  selectToTires,
  pair,
  fitmentClass,
  isPopular,
  dbProfile,
  wheelCenterBore,
  wheelSeatType,
}: {
  brand: string;
  title: string;
  baseSku: string;
  baseFinish?: string;
  baseImageUrl?: string;
  price?: number;
  sizeLabel?: { diameter?: string; width?: string };
  finishThumbs?: WheelFinishThumb[];
  viewParams?: Record<string, string | undefined>;
  specLabel?: { boltPattern?: string; offset?: string };
  /** @deprecated No longer used - single CTA flow */
  selectToTires?: boolean;
  pair?: WheelPair;
  fitmentClass?: "surefit" | "specfit" | "extended";
  isPopular?: boolean;
  dbProfile?: DBProfileForAccessories | null;
  wheelCenterBore?: number;
  wheelSeatType?: string;
}) {
  const { addItem, addAccessories, setAccessoryState } = useCart();
  const thumbs = useMemo(() => (finishThumbs || []).filter((t) => t?.sku), [finishThumbs]);

  const effectiveInitialSku = pair?.front?.sku || baseSku;
  
  const [selectedSku, setSelectedSku] = useState<string>(effectiveInitialSku);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(baseImageUrl);
  const [selectedFinish, setSelectedFinish] = useState<string | undefined>(baseFinish);
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>(price);
  const [selectedPair, setSelectedPair] = useState<WheelPair | undefined>(pair);
  const [isAdding, setIsAdding] = useState(false);

  // Calculate set price (4 wheels)
  const setPrice = typeof selectedPrice === "number" ? selectedPrice * 4 : null;
  const fromSetPrice = useMemo(() => {
    const ps = (finishThumbs || [])
      .map((t) => (typeof t?.price === "number" ? t.price * 4 : null))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!ps.length) return null;
    return Math.min(...ps);
  }, [finishThumbs]);

  // Build URL params
  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(viewParams || {})) {
      if (v) sp.set(k, v);
    }
    if (!sp.get("year") || !sp.get("make") || !sp.get("model")) {
      sp.delete("year");
      sp.delete("make");
      sp.delete("model");
      sp.delete("trim");
      sp.delete("modification");
    }
    
    const currentPair = selectedPair || pair;
    const dia = currentPair?.front?.diameter ?? sizeLabel?.diameter;
    const wid = currentPair?.front?.width ?? sizeLabel?.width;
    const off = currentPair?.front?.offset ?? specLabel?.offset;
    const bolt = specLabel?.boltPattern;
    
    if (dia) sp.set("wheelDia", String(dia));
    if (wid) sp.set("wheelWidth", String(wid));
    if (off) sp.set("wheelOffset", String(off));
    if (bolt) sp.set("wheelBolt", String(bolt));
    
    const s = sp.toString();
    return s ? `?${s}` : "";
  }, [viewParams, selectedPair, pair, sizeLabel, specLabel]);

  const viewHref = `/wheels/${encodeURIComponent(selectedSku || baseSku)}${qs}`;

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLE CTA: Add to Package
  // ═══════════════════════════════════════════════════════════════════════════
  function addToPackage() {
    setIsAdding(true);
    
    const year = viewParams?.year;
    const make = viewParams?.make;
    const model = viewParams?.model;
    const trim = viewParams?.trim;
    const modification = viewParams?.modification;
    
    const vehicle = year && make && model
      ? { year, make, model, trim: trim || undefined, modification: modification || undefined }
      : undefined;

    const currentPair = selectedPair || pair;
    const effectiveSku = selectedSku || currentPair?.front?.sku || baseSku;
    const effectiveDia = currentPair?.front?.diameter ?? sizeLabel?.diameter;
    const effectiveWidth = currentPair?.front?.width ?? sizeLabel?.width;
    const effectiveOffset = currentPair?.front?.offset ?? specLabel?.offset;

    setTimeout(() => {
      // Add wheel to cart
      addItem({
        type: "wheel",
        sku: effectiveSku,
        brand,
        model: title,
        finish: selectedFinish,
        diameter: effectiveDia,
        width: effectiveWidth,
        offset: effectiveOffset,
        boltPattern: specLabel?.boltPattern,
        imageUrl: selectedImage,
        unitPrice: typeof selectedPrice === "number" ? selectedPrice : 0,
        quantity: 4,
        fitmentClass,
        vehicle,
      });

      // Auto-add accessories (fail-soft)
      try {
        if (isAccessoryAutoAddEnabled() && dbProfile) {
          const fitmentResult = calculateAccessoryFitment(dbProfile, {
            sku: effectiveSku,
            centerBore: wheelCenterBore,
            seatType: wheelSeatType,
            boltPattern: specLabel?.boltPattern,
          });

          if (fitmentResult.state) {
            setAccessoryState(fitmentResult.state);
          }

          if (fitmentResult.requiredItems.length > 0) {
            safeAutoAddAccessories(
              effectiveSku,
              fitmentResult.requiredItems,
              (item) => addAccessories([item])
            );
          }
        }
      } catch (err) {
        console.error("[WheelsStyleCard] Accessory auto-add error (non-fatal):", err);
      }

      setIsAdding(false);
    }, 150);
  }

  const bolt = specLabel?.boltPattern ? String(specLabel.boltPattern).trim() : "";
  const fitmentConfig = fitmentClass ? FITMENT_CONFIG[fitmentClass] : null;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-lg">
      
      {/* ═══════════════════════════════════════════════════════════════════════
          TOP: FITMENT BADGE (Full width, prominent)
          ═══════════════════════════════════════════════════════════════════════ */}
      {fitmentConfig ? (
        <div className={`${fitmentConfig.bgClass} ${fitmentConfig.textClass} px-4 py-2.5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{fitmentConfig.icon}</span>
              <div>
                <div className="text-sm font-extrabold">{fitmentConfig.label}</div>
                <div className="text-xs opacity-90">{fitmentConfig.sublabel}</div>
              </div>
            </div>
            {isPopular ? (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                🔥 Popular
              </span>
            ) : null}
          </div>
        </div>
      ) : isPopular ? (
        <div className="bg-amber-500 text-white px-4 py-2">
          <span className="text-sm font-bold">🔥 Popular Choice</span>
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          IMAGE (Larger, more prominent)
          ═══════════════════════════════════════════════════════════════════════ */}
      <Link href={viewHref} className="block relative">
        <div className="aspect-square w-full overflow-hidden bg-neutral-50">
          {selectedImage ? (
            <img
              src={selectedImage}
              alt={title}
              className="h-full w-full object-contain p-4 transition-transform hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6">
              <div className="text-center">
                <div className="text-4xl text-neutral-300">⚙️</div>
                <div className="mt-2 text-xs font-semibold text-neutral-500">Image coming soon</div>
              </div>
            </div>
          )}
        </div>
        
        {/* Favorites button overlay */}
        <div className="absolute top-3 right-3">
          <FavoritesButton
            type="wheel"
            sku={selectedSku || baseSku}
            label={`${brand} ${title}${selectedFinish ? ` - ${selectedFinish}` : ""}`}
            href={viewHref}
            imageUrl={selectedImage}
          />
        </div>
      </Link>

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTENT AREA
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col p-4">
        
        {/* Brand & Title */}
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{brand}</div>
          <Link href={viewHref}>
            <h3 className="mt-0.5 text-lg font-extrabold text-neutral-900 hover:text-neutral-700 transition-colors line-clamp-2">
              {title}
            </h3>
          </Link>
        </div>

        {/* Specs Row */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
          {(selectedPair?.front?.diameter || sizeLabel?.diameter) && (
            <span className="font-semibold text-neutral-800">
              {fmtSizePart(selectedPair?.front?.diameter || sizeLabel?.diameter || "")}"
            </span>
          )}
          {(selectedPair?.front?.width || sizeLabel?.width) && (
            <span>
              × {fmtSizePart(selectedPair?.front?.width || sizeLabel?.width || "")}"
            </span>
          )}
          {bolt && (
            <>
              <span className="text-neutral-400">•</span>
              <span>{bolt}</span>
            </>
          )}
        </div>

        {/* Finish selector (if multiple) */}
        {thumbs.length > 1 ? (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5">
              {thumbs.slice(0, 6).map((t) => {
                const active = t.sku === selectedSku;
                return (
                  <button
                    key={t.sku}
                    type="button"
                    onClick={() => {
                      setSelectedSku(t.sku);
                      setSelectedFinish(t.finish);
                      if (t.imageUrl) setSelectedImage(t.imageUrl);
                      if (typeof t.price === "number") setSelectedPrice(t.price);
                      if (t.pair) setSelectedPair(t.pair);
                    }}
                    className={`h-9 w-9 overflow-hidden rounded-lg border-2 transition-all ${
                      active 
                        ? "border-neutral-900 ring-2 ring-neutral-900/20" 
                        : "border-neutral-200 hover:border-neutral-400"
                    }`}
                    title={t.finish}
                    aria-pressed={active}
                  >
                    {t.imageUrl ? (
                      <img src={t.imageUrl} alt={t.finish} className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <div className="h-full w-full bg-neutral-100" />
                    )}
                  </button>
                );
              })}
              {thumbs.length > 6 && (
                <Link 
                  href={viewHref}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-xs font-bold text-neutral-500 hover:border-neutral-400"
                >
                  +{thumbs.length - 6}
                </Link>
              )}
            </div>
            {selectedFinish && (
              <div className="mt-1.5 text-xs text-neutral-600">{selectedFinish}</div>
            )}
          </div>
        ) : selectedFinish ? (
          <div className="mt-2 text-sm text-neutral-600">{selectedFinish}</div>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* ═══════════════════════════════════════════════════════════════════════
            PRICING (Set of 4 prominent, per-wheel secondary)
            ═══════════════════════════════════════════════════════════════════════ */}
        <div className="mt-4 rounded-xl bg-neutral-50 p-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-extrabold text-neutral-900">
                {setPrice !== null 
                  ? `$${setPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : fromSetPrice !== null 
                    ? `From $${fromSetPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : "Call for price"
                }
              </div>
              <div className="text-xs text-neutral-500">
                for set of 4
                {typeof selectedPrice === "number" && (
                  <span className="ml-1">
                    (${selectedPrice.toFixed(0)} each)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Trust signals */}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-600">
            <span className="flex items-center gap-1">
              <span className="text-green-600">✓</span>
              Free Shipping
            </span>
            <span className="flex items-center gap-1">
              <span className="text-green-600">✓</span>
              Fitment Guarantee
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            SINGLE PRIMARY CTA: Add to Package
            ═══════════════════════════════════════════════════════════════════════ */}
        <button
          type="button"
          onClick={addToPackage}
          disabled={isAdding}
          className={`
            mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl 
            text-base font-extrabold transition-all
            ${isAdding 
              ? "bg-neutral-300 text-neutral-500 cursor-wait" 
              : "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-lg shadow-red-600/25"
            }
          `}
        >
          {isAdding ? (
            <>
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Adding to Package...
            </>
          ) : (
            <>
              Add to Package
              {setPrice !== null && (
                <span className="opacity-90">
                  — ${setPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
            </>
          )}
        </button>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECONDARY: View Details link (small, de-emphasized)
            ═══════════════════════════════════════════════════════════════════════ */}
        <div className="mt-2 text-center">
          <Link
            href={viewHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            View full specs & details
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
