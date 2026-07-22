"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart/CartContext";
import {
  isAccessoryAutoAddEnabled,
  safeAutoAddAccessories,
} from "@/lib/cart/accessoryAutoAdd";
import { calculateAccessoryFitment, type DBProfileForAccessories } from "@/hooks/useAccessoryFitment";
import type {
  WheelFinishThumb,
  WheelPair,
  TopPickCategory,
} from "@/components/WheelsStyleCard";
import type { FitmentLevel, BuildRequirement } from "@/lib/fitment/guidance";

// ─── local helpers (not exported from WheelsStyleCard) ───────────────────────

function fmtSizePart(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toString();
}

const FITMENT_CONFIG = {
  surefit:  { label: "✓ Sure Fit",   className: "bg-green-600 text-white" },
  specfit:  { label: "⚡ Spec Fit",   className: "bg-blue-600  text-white" },
  extended: { label: "Custom Fit",   className: "bg-amber-500 text-white" },
} as const;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface WheelsStyleCardHorizontalProps {
  brand: string;
  title: string;
  baseSku: string;
  baseFinish?: string;
  baseImageUrl?: string;
  price?: number;
  stockQty?: number;
  inventoryType?: string;
  sizeLabel?: { diameter?: string; width?: string };
  finishThumbs?: WheelFinishThumb[];
  viewParams?: Record<string, string | undefined>;
  specLabel?: { boltPattern?: string; offset?: string };
  pair?: WheelPair;
  fitmentClass?: "surefit" | "specfit" | "extended";
  // Extended offset fitment (2026-07-22)
  offsetExtended?: boolean;
  offsetExtendedReason?: string;
  /** WSI wheel with stock but no price - show Request Quote (2026-07-22) */
  requestQuote?: boolean;
  isPopular?: boolean;
  dbProfile?: DBProfileForAccessories | null;
  wheelCenterBore?: number;
  wheelSeatType?: string;
  fitmentLevel?: FitmentLevel;
  buildRequirement?: BuildRequirement;
  isSelected?: boolean;
  hasSelection?: boolean;
  onSelect?: (wheelState: { imageUrl?: string; price?: number; finish?: string; sku: string }) => void;
  showOffset?: boolean;
  topPickCategory?: TopPickCategory;
  isTopPick?: boolean;
  freeShipping?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WheelsStyleCardHorizontal({
  brand,
  title,
  baseSku,
  baseFinish,
  baseImageUrl,
  price,
  stockQty,
  inventoryType,
  sizeLabel,
  finishThumbs,
  viewParams,
  specLabel,
  pair,
  fitmentClass,
  dbProfile,
  wheelCenterBore,
  wheelSeatType,
  isSelected = false,
  hasSelection = false,
  onSelect,
  freeShipping = false,
}: WheelsStyleCardHorizontalProps) {
  const { addItem, addAccessories, setAccessoryState } = useCart();

  const thumbs = useMemo(
    () => (finishThumbs || []).filter((t) => t?.sku),
    [finishThumbs],
  );

  const effectiveInitialSku = pair?.front?.sku || baseSku;

  const [selectedSku, setSelectedSku]                   = useState<string>(effectiveInitialSku);
  const [selectedImage, setSelectedImage]               = useState<string | undefined>(baseImageUrl);
  const [selectedFinish, setSelectedFinish]             = useState<string | undefined>(baseFinish);
  const [selectedPrice, setSelectedPrice]               = useState<number | undefined>(price);
  const [selectedStockQty, setSelectedStockQty]         = useState<number | undefined>(stockQty);
  const [selectedInventoryType, setSelectedInventoryType] = useState<string | undefined>(inventoryType);
  const [selectedPair, setSelectedPair]                 = useState<WheelPair | undefined>(pair);
  const [isAdding, setIsAdding]                         = useState(false);

  const setPrice =
    typeof selectedPrice === "number" ? selectedPrice * 4 : null;

  const currentDiameter = selectedPair?.front?.diameter ?? sizeLabel?.diameter;
  const currentWidth    = selectedPair?.front?.width    ?? sizeLabel?.width;
  const currentOffset   = selectedPair?.front?.offset   ?? specLabel?.offset;

  // ─── URL params ────────────────────────────────────────────────────────────
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
    const cp  = selectedPair || pair;
    const dia = cp?.front?.diameter ?? sizeLabel?.diameter;
    const wid = cp?.front?.width    ?? sizeLabel?.width;
    const off = cp?.front?.offset   ?? specLabel?.offset;
    const bolt = specLabel?.boltPattern;
    if (dia)  sp.set("wheelDia",    String(dia));
    if (wid)  sp.set("wheelWidth",  String(wid));
    if (off)  sp.set("wheelOffset", String(off));
    if (bolt) sp.set("wheelBolt",   String(bolt));
    // Pass rear wheel info for staggered PDP display
    if (cp?.staggered && cp?.rear) {
      if (cp.rear.sku)      sp.set("rearSku",   cp.rear.sku);
      if (cp.rear.diameter) sp.set("rearDia",   String(cp.rear.diameter));
      if (cp.rear.width)    sp.set("rearWidth", String(cp.rear.width));
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
  }, [viewParams, selectedPair, pair, sizeLabel, specLabel]);

  const viewHref = `/wheels/${encodeURIComponent(selectedSku || baseSku)}${qs}`;

  // ─── Cart add ──────────────────────────────────────────────────────────────
  function addToPackage() {
    setIsAdding(true);

    const year         = viewParams?.year;
    const make         = viewParams?.make;
    const model        = viewParams?.model;
    const trim         = viewParams?.trim;
    const modification = viewParams?.modification;

    const vehicle =
      year && make && model
        ? { year, make, model, trim: trim || undefined, modification: modification || undefined }
        : undefined;

    const cp            = selectedPair || pair;
    const effectiveSku  = selectedSku || cp?.front?.sku || baseSku;
    const effectiveDia  = cp?.front?.diameter ?? sizeLabel?.diameter;
    const effectiveW    = cp?.front?.width    ?? sizeLabel?.width;
    const effectiveOff  = cp?.front?.offset   ?? specLabel?.offset;

    setTimeout(() => {
      addItem({
        type:         "wheel",
        sku:          effectiveSku,
        brand,
        model:        title,
        finish:       selectedFinish,
        diameter:     effectiveDia,
        width:        effectiveW,
        offset:       effectiveOff,
        boltPattern:  specLabel?.boltPattern,
        imageUrl:     selectedImage,
        unitPrice:    typeof selectedPrice === "number" ? selectedPrice : 0,
        quantity:     4,
        fitmentClass,
        vehicle,
      });

      // Auto-add accessories (fail-soft)
      try {
        if (isAccessoryAutoAddEnabled() && dbProfile) {
          const fitmentResult = calculateAccessoryFitment(dbProfile, {
            sku:         effectiveSku,
            centerBore:  wheelCenterBore,
            seatType:    wheelSeatType,
            boltPattern: specLabel?.boltPattern,
          });
          if (fitmentResult.state) setAccessoryState(fitmentResult.state);
          if (fitmentResult.requiredItems.length > 0) {
            safeAutoAddAccessories(
              effectiveSku,
              fitmentResult.requiredItems,
              (item) => addAccessories([item]),
            );
          }
        }
      } catch (err) {
        console.error("[WheelsStyleCardHorizontal] Accessory auto-add error (non-fatal):", err);
      }

      setIsAdding(false);
    }, 150);
  }

  // ─── Derived display values ────────────────────────────────────────────────
  const fitmentConfig = fitmentClass ? FITMENT_CONFIG[fitmentClass] : null;

  /** Simple stock label — no warehouse location codes */
  const stockLabel = (() => {
    if (!selectedStockQty && selectedInventoryType === "check_availability")
      return (
        <span className="text-[9px] text-neutral-400 text-center leading-tight">
          Check
          <br />
          Avail.
        </span>
      );
    if (!selectedStockQty || selectedStockQty <= 0)
      return (
        <span className="text-[9px] text-red-500 font-bold text-center leading-tight">
          ✗ Out
          <br />
          of Stock
        </span>
      );
    if (selectedStockQty <= 3)
      return (
        <span className="text-[9px] text-amber-600 font-bold text-center leading-tight">
          ⚠ Only {selectedStockQty}
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

  // Finish swatches — max 5 dots + "+N more" link
  const MAX_SWATCHES = 5;
  const visibleThumbs = thumbs.slice(0, MAX_SWATCHES);
  const extraCount    = thumbs.length > MAX_SWATCHES ? thumbs.length - MAX_SWATCHES : 0;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`
        flex flex-row bg-white border rounded-xl overflow-hidden shadow-sm
        transition-all duration-200
        ${
          isSelected
            ? "border-green-500 ring-2 ring-green-500 ring-offset-1"
            : "border-neutral-200 hover:shadow-md hover:border-neutral-300"
        }
      `}
    >
      {/* ══ IMAGE PANEL — fixed 130 px ════════════════════════════════════════ */}
      <div className="relative w-[130px] min-w-[130px] bg-neutral-50 flex items-center justify-center p-2">
        {/* Fitment pill — top-left */}
        {fitmentConfig && (
          <span
            className={`
              absolute top-2 left-2
              text-[9px] font-bold uppercase tracking-wide
              px-1.5 py-0.5 rounded leading-tight
              ${fitmentConfig.className}
            `}
          >
            {fitmentConfig.label}
          </span>
        )}

        {/* Wheel image */}
        {selectedImage ? (
          <img
            src={selectedImage}
            alt={title}
            className="w-full aspect-square object-contain"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center text-neutral-300 text-3xl">
            ⚙️
          </div>
        )}
      </div>

      {/* ══ INFO PANEL ════════════════════════════════════════════════════════ */}
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

        {/* Size: staggered front+rear display OR standard single size */}
        {(selectedPair?.staggered && selectedPair.rear) ? (
          <div className="mt-0.5 space-y-0.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
              ⚡ Staggered Set
            </span>
            <div className="text-[11px] leading-snug">
              <span className="font-semibold text-blue-600">F 2×</span>
              <span className="text-neutral-600 ml-1">
                {selectedPair.front.diameter && `${fmtSizePart(String(selectedPair.front.diameter))}″`}
                {selectedPair.front.diameter && selectedPair.front.width && " × "}
                {selectedPair.front.width && `${fmtSizePart(String(selectedPair.front.width))}″`}
                {selectedPair.front.offset && <> ET{selectedPair.front.offset}</>}
              </span>
            </div>
            <div className="text-[11px] leading-snug">
              <span className="font-semibold text-orange-600">R 2×</span>
              <span className="text-neutral-600 ml-1">
                {selectedPair.rear.diameter && `${fmtSizePart(String(selectedPair.rear.diameter))}″`}
                {selectedPair.rear.diameter && selectedPair.rear.width && " × "}
                {selectedPair.rear.width && `${fmtSizePart(String(selectedPair.rear.width))}″`}
                {selectedPair.rear.offset && <> ET{selectedPair.rear.offset}</>}
              </span>
            </div>
          </div>
        ) : (currentDiameter || currentWidth || currentOffset || wheelCenterBore) ? (
          <div className="text-[11px] text-neutral-500 leading-snug">
            {currentDiameter && `${fmtSizePart(currentDiameter)}″`}
            {currentDiameter && currentWidth && " × "}
            {currentWidth && `${fmtSizePart(currentWidth)}″`}
            {currentOffset && (
              <> · ET{Number(currentOffset) >= 0 ? `+${currentOffset}` : currentOffset}</>
            )}
            {wheelCenterBore && <> · {wheelCenterBore}mm CB</>}
          </div>
        ) : null}

        {/* Finish swatches */}
        {visibleThumbs.length > 1 && (
          <div className="flex gap-1 flex-wrap items-center mt-0.5">
            {visibleThumbs.map((t) => {
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
                    if (typeof t.stockQty === "number") setSelectedStockQty(t.stockQty);
                    if (t.inventoryType) setSelectedInventoryType(t.inventoryType);
                    if (t.pair) setSelectedPair(t.pair);
                  }}
                  className={`
                    h-5 w-5 overflow-hidden rounded border-2 transition-all flex-shrink-0
                    ${active
                      ? "border-neutral-900"
                      : "border-neutral-200 hover:border-neutral-400"
                    }
                  `}
                  title={t.finish}
                  aria-pressed={active}
                >
                  {t.imageUrl ? (
                    <img
                      src={t.imageUrl}
                      alt={t.finish}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-neutral-200" />
                  )}
                </button>
              );
            })}
            {extraCount > 0 && (
              <Link
                href={viewHref}
                className="text-[10px] font-semibold text-neutral-400 hover:text-neutral-700 leading-none"
              >
                +{extraCount}
              </Link>
            )}
          </div>
        )}

        {/* Price — pushed to bottom of info panel */}
        <div className="flex items-baseline gap-1.5 mt-auto pt-1">
          {typeof selectedPrice === "number" ? (
            <>
              <span className="text-base font-extrabold text-neutral-900">
                ${selectedPrice.toFixed(0)}
              </span>
              <span className="text-[11px] text-neutral-400">ea</span>
              {setPrice !== null && (
                <span className="text-[11px] text-neutral-400">
                  ·&nbsp;$
                  {setPrice.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}{" "}
                  {selectedPair?.staggered && selectedPair.rear ? "staggered 2+2" : "set"}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-neutral-500">Call for price</span>
          )}
        </div>

        {/* Free shipping badge */}
        {freeShipping && (
          <span className="text-[10px] font-bold text-green-600 leading-none">
            🚚 Free Shipping
          </span>
        )}
      </div>

      {/* ══ CTA PANEL — fixed ~88 px ══════════════════════════════════════════ */}
      <div className="flex flex-col gap-1.5 justify-center items-stretch px-2 py-2.5 min-w-[88px] max-w-[88px] border-l border-neutral-100">
        {/* Add / Select button */}
        <button
          type="button"
          onClick={() => {
            if (isSelected) return;
            if (onSelect) {
              onSelect({
                imageUrl: selectedImage,
                price:    selectedPrice,
                finish:   selectedFinish,
                sku:      selectedSku || baseSku,
              });
            } else {
              addToPackage();
            }
          }}
          disabled={isAdding || isSelected}
          className={`
            text-[10px] font-bold uppercase rounded-md px-2 py-2
            leading-tight text-center transition-all
            ${
              isSelected
                ? "bg-green-500 text-white cursor-default"
                : isAdding
                  ? "bg-neutral-200 text-neutral-400 cursor-wait"
                  : hasSelection
                    ? "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                    : "bg-red-600 text-white hover:bg-red-500 active:scale-[0.98]"
            }
          `}
        >
          {isSelected ? (
            "✓ Selected"
          ) : isAdding ? (
            "Adding…"
          ) : hasSelection ? (
            "Switch"
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

        {/* Stock status — no warehouse location */}
        <div className="flex justify-center">{stockLabel}</div>
      </div>
    </div>
  );
}
