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
import {
  type FitmentLevel,
  type BuildRequirement,
} from "@/lib/fitment/guidance";
import {
  FitmentGuidanceStrip,
} from "@/components/FitmentGuidanceBadges";

export type WheelFinishThumb = {
  finish: string;
  sku: string;
  imageUrl?: string;
  price?: number;
  stockQty?: number;
  inventoryType?: string;
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

// ═══════════════════════════════════════════════════════════════════════════════
// A/B TEST CONFIG - CTA Variants
// ═══════════════════════════════════════════════════════════════════════════════
export type CTAVariant = "A" | "B";

const CTA_TEXT: Record<CTAVariant, string> = {
  A: "Add to Package",
  B: "Build My Package",
};

// ═══════════════════════════════════════════════════════════════════════════════
// SOCIAL PROOF TYPES
// ═══════════════════════════════════════════════════════════════════════════════
export type SocialProofType = "rating" | "popular" | "bestseller" | "trending" | "staff-pick";

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY TYPE LABELS - Map WheelPros codes to friendly display
// ═══════════════════════════════════════════════════════════════════════════════
const INVENTORY_TYPE_LABELS: Record<string, { label: string; className: string; show: boolean }> = {
  ST: { label: "In Stock", className: "text-green-700 bg-green-100", show: true },
  BW: { label: "In Stock", className: "text-green-700 bg-green-100", show: true },
  NW: { label: "In Stock", className: "text-green-700 bg-green-100", show: true },
  SO: { label: "Special Order", className: "text-blue-700 bg-blue-100", show: true },
  CS: { label: "Custom Build", className: "text-purple-700 bg-purple-100", show: true },
  DB: { label: "Available", className: "text-neutral-600 bg-neutral-100", show: true },
  N2: { label: "Ships Soon", className: "text-amber-700 bg-amber-100", show: true },
  RW: { label: "Special Order", className: "text-blue-700 bg-blue-100", show: true },
};

type SocialProofConfig = {
  rating?: { score: number; count: number };
  badge?: SocialProofType;
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
    sublabel: "Verified for your vehicle • Hardware included",
    bgClass: "bg-green-600",
    textClass: "text-white",
    icon: "✓",
  },
  specfit: {
    label: "Good Fit",
    sublabel: "Works with your vehicle • Hardware included",
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

// ═══════════════════════════════════════════════════════════════════════════════
// "WHY THIS WHEEL" HELPER - Context-aware copy generation
// ═══════════════════════════════════════════════════════════════════════════════
function generateWhyThisWheel(params: {
  brand?: string;
  style?: string;
  width?: string;
  diameter?: string;
  finish?: string;
  vehicleModel?: string;
  fitmentClass?: string;
  isStockSize?: boolean;
}): string | null {
  const { brand, style, width, diameter, finish, vehicleModel, fitmentClass, isStockSize } = params;
  
  const hints: string[] = [];
  
  // Style-based hints
  const styleLower = (style || "").toLowerCase();
  if (styleLower.includes("off-road") || styleLower.includes("offroad") || styleLower.includes("at") || styleLower.includes("mt")) {
    hints.push("Aggressive off-road look");
  } else if (styleLower.includes("sport") || styleLower.includes("racing")) {
    hints.push("Sporty, lightweight design");
  } else if (styleLower.includes("classic") || styleLower.includes("vintage")) {
    hints.push("Timeless classic style");
  } else if (styleLower.includes("luxury") || styleLower.includes("chrome")) {
    hints.push("Premium luxury finish");
  }
  
  // Width-based hints (wider = more aggressive)
  const numWidth = parseFloat(width || "");
  if (numWidth >= 10) {
    hints.push("Wide stance for bold presence");
  } else if (numWidth >= 9) {
    hints.push("Slightly wider for sportier look");
  }
  
  // Diameter-based hints
  const numDia = parseFloat(diameter || "");
  if (numDia >= 22) {
    hints.push("Large diameter for commanding presence");
  } else if (numDia >= 20) {
    hints.push("20\"+ size for upgraded look");
  }
  
  // Finish hints
  const finishLower = (finish || "").toLowerCase();
  if (finishLower.includes("black") && finishLower.includes("milled")) {
    hints.push("Black milled accents");
  } else if (finishLower.includes("matte black") || finishLower.includes("satin black")) {
    hints.push("Murdered-out aesthetic");
  } else if (finishLower.includes("chrome") || finishLower.includes("polished")) {
    hints.push("Eye-catching shine");
  } else if (finishLower.includes("bronze") || finishLower.includes("copper")) {
    hints.push("Unique bronze tones");
  }
  
  // Vehicle-specific
  if (vehicleModel) {
    const modelLower = vehicleModel.toLowerCase();
    if (modelLower.includes("tahoe") || modelLower.includes("suburban") || modelLower.includes("yukon")) {
      hints.push(`Popular for ${vehicleModel}`);
    } else if (modelLower.includes("f-150") || modelLower.includes("f150") || modelLower.includes("silverado") || modelLower.includes("ram")) {
      hints.push(`Popular truck upgrade`);
    } else if (modelLower.includes("wrangler") || modelLower.includes("bronco") || modelLower.includes("4runner")) {
      hints.push(`Trail-ready styling`);
    }
  }
  
  // Return top 2 hints joined
  if (hints.length === 0) return null;
  return hints.slice(0, 2).join(" • ");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIZE CONTEXT - Stock vs Upgraded messaging
// ═══════════════════════════════════════════════════════════════════════════════
function getSizeContext(params: {
  isStockSize?: boolean;
  width?: string;
  diameter?: string;
  stockWidth?: number;
  stockDiameter?: number;
}): { text: string; icon: string; type: "stock" | "upgraded" } | null {
  const { isStockSize, width, diameter, stockWidth, stockDiameter } = params;
  
  // Explicit stock size flag
  if (isStockSize === true) {
    return {
      text: "Stock size • No modifications needed",
      icon: "✓",
      type: "stock",
    };
  }
  
  // If we have stock specs to compare
  const numWidth = parseFloat(width || "");
  const numDia = parseFloat(diameter || "");
  
  if (stockWidth && stockDiameter) {
    if (numWidth <= stockWidth && numDia <= stockDiameter) {
      return {
        text: "Stock size • No modifications needed",
        icon: "✓",
        type: "stock",
      };
    }
  }
  
  // Explicit upgraded sizing
  if (isStockSize === false || numWidth >= 9.5 || numDia >= 20) {
    return {
      text: "Wider stance • More aggressive look",
      icon: "↔",
      type: "upgraded",
    };
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOCIAL PROOF BADGE RENDERER
// ═══════════════════════════════════════════════════════════════════════════════
function SocialProofBadge({ config }: { config: SocialProofConfig }) {
  // Priority: rating > badge
  if (config.rating && config.rating.count > 0) {
    const { score, count } = config.rating;
    const fullStars = Math.floor(score);
    const hasHalf = score - fullStars >= 0.5;
    
    return (
      <div className="flex items-center gap-1 text-xs">
        <div className="flex text-amber-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={i < fullStars ? "" : i === fullStars && hasHalf ? "opacity-50" : "opacity-20"}>
              ★
            </span>
          ))}
        </div>
        <span className="text-neutral-600 font-medium">{score.toFixed(1)}</span>
        <span className="text-neutral-400">({count.toLocaleString()})</span>
      </div>
    );
  }
  
  if (config.badge) {
    const badgeConfig: Record<SocialProofType, { icon: string; text: string; className: string }> = {
      popular: { icon: "🔥", text: "Popular", className: "bg-amber-50 text-amber-700 border-amber-200" },
      bestseller: { icon: "⭐", text: "Best Seller", className: "bg-green-50 text-green-700 border-green-200" },
      trending: { icon: "📈", text: "Trending", className: "bg-blue-50 text-blue-700 border-blue-200" },
      "staff-pick": { icon: "👍", text: "Staff Pick", className: "bg-purple-50 text-purple-700 border-purple-200" },
      rating: { icon: "★", text: "Top Rated", className: "bg-amber-50 text-amber-700 border-amber-200" },
    };
    
    const badge = badgeConfig[config.badge];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.className}`}>
        {badge.icon} {badge.text}
      </span>
    );
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE ANCHORING - Typical package range
// ═══════════════════════════════════════════════════════════════════════════════
function getPriceAnchor(wheelSetPrice: number | null): string | null {
  if (wheelSetPrice === null) return null;
  
  // Estimate typical package: wheels + tires + TPMS
  // Tires: roughly $150-$300 each for truck/SUV = $600-$1200 for 4
  // TPMS: $60-$100 for 4
  // Installation: $80-$120
  const minPackage = wheelSetPrice + 600 + 60 + 80;
  const maxPackage = wheelSetPrice + 1200 + 100 + 120;
  
  // Round to nearest $100
  const minRounded = Math.round(minPackage / 100) * 100;
  const maxRounded = Math.round(maxPackage / 100) * 100;
  
  return `Typical package: $${minRounded.toLocaleString()}–$${maxRounded.toLocaleString()}`;
}

export function WheelsStyleCard({
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
  selectToTires,
  pair,
  fitmentClass,
  isPopular,
  dbProfile,
  wheelCenterBore,
  wheelSeatType,
  // New conversion props
  style,
  isStockSize,
  stockWidth,
  stockDiameter,
  socialProof,
  ctaVariant = "A",
  // Fitment guidance props (2026-04-07)
  fitmentLevel,
  buildRequirement,
  // Selection state props
  isSelected = false,
  hasSelection = false,
  onSelect,
  // Homepage intent: show offset in size display (for lifted builds)
  showOffset = false,
}: {
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
  /** @deprecated No longer used - single CTA flow */
  selectToTires?: boolean;
  pair?: WheelPair;
  fitmentClass?: "surefit" | "specfit" | "extended";
  isPopular?: boolean;
  dbProfile?: DBProfileForAccessories | null;
  wheelCenterBore?: number;
  wheelSeatType?: string;
  // New conversion props
  style?: string;
  isStockSize?: boolean;
  stockWidth?: number;
  stockDiameter?: number;
  socialProof?: SocialProofConfig;
  ctaVariant?: CTAVariant;
  // Fitment guidance props (2026-04-07)
  fitmentLevel?: FitmentLevel;
  buildRequirement?: BuildRequirement;
  // Selection state props
  isSelected?: boolean;
  hasSelection?: boolean;
  onSelect?: (wheelState: { imageUrl?: string; price?: number; finish?: string; sku: string }) => void;
  // Homepage intent: show offset in size display (for lifted builds)
  showOffset?: boolean;
}) {
  const { addItem, addAccessories, setAccessoryState } = useCart();
  const thumbs = useMemo(() => (finishThumbs || []).filter((t) => t?.sku), [finishThumbs]);

  const effectiveInitialSku = pair?.front?.sku || baseSku;
  
  const [selectedSku, setSelectedSku] = useState<string>(effectiveInitialSku);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(baseImageUrl);
  const [selectedFinish, setSelectedFinish] = useState<string | undefined>(baseFinish);
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>(price);
  const [selectedStockQty, setSelectedStockQty] = useState<number | undefined>(stockQty);
  const [selectedInventoryType, setSelectedInventoryType] = useState<string | undefined>(inventoryType);
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

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSION HELPERS - Computed values
  // ═══════════════════════════════════════════════════════════════════════════
  const currentDiameter = selectedPair?.front?.diameter || sizeLabel?.diameter;
  const currentWidth = selectedPair?.front?.width || sizeLabel?.width;
  const vehicleModel = viewParams?.model;
  
  const whyThisWheel = useMemo(() => generateWhyThisWheel({
    brand,
    style,
    width: currentWidth,
    diameter: currentDiameter,
    finish: selectedFinish,
    vehicleModel,
    fitmentClass,
    isStockSize,
  }), [brand, style, currentWidth, currentDiameter, selectedFinish, vehicleModel, fitmentClass, isStockSize]);
  
  const sizeContext = useMemo(() => getSizeContext({
    isStockSize,
    width: currentWidth,
    diameter: currentDiameter,
    stockWidth,
    stockDiameter,
  }), [isStockSize, currentWidth, currentDiameter, stockWidth, stockDiameter]);
  
  const priceAnchor = useMemo(() => getPriceAnchor(setPrice), [setPrice]);
  
  // Derive social proof - use prop or fallback to isPopular
  const effectiveSocialProof: SocialProofConfig | undefined = socialProof || (isPopular ? { badge: "popular" } : undefined);

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
  // SINGLE CTA: Add to Package / Build My Package
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
  
  // Hide legacy "Good Fit" banner when fitmentGuidance shows "aggressive"
  // Aggressive fitment should NOT show the misleading "Good Fit" label
  const showLegacyFitmentBanner = fitmentConfig && fitmentLevel !== "aggressive";

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-lg">
      
      {/* ═══════════════════════════════════════════════════════════════════════
          TOP: FITMENT BADGE (Full width, prominent)
          Hidden for aggressive fitment - those get the fitmentGuidance badge instead
          ═══════════════════════════════════════════════════════════════════════ */}
      {showLegacyFitmentBanner ? (
        <div className={`${fitmentConfig.bgClass} ${fitmentConfig.textClass} px-4 py-2.5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{fitmentConfig.icon}</span>
              <div>
                <div className="text-sm font-extrabold">{fitmentConfig.label}</div>
                <div className="text-xs opacity-90">{fitmentConfig.sublabel}</div>
              </div>
            </div>
          </div>
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
        
        {/* ═══════════════════════════════════════════════════════════════════════
            SIMPLIFIED TITLE STRUCTURE
            Line 1: Brand + Model name
            Line 2: Size + Finish (or Staggered specs)
            ═══════════════════════════════════════════════════════════════════════ */}
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{brand}</div>
          <Link href={viewHref}>
            <h3 className="mt-0.5 text-lg font-extrabold text-neutral-900 hover:text-neutral-700 transition-colors line-clamp-1">
              {title}
            </h3>
          </Link>
          
          {/* Show staggered badge + front/rear specs for staggered wheels */}
          {selectedPair?.staggered && selectedPair.rear ? (
            <div className="mt-1.5">
              {/* Staggered badge */}
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 mb-1.5">
                ⚡ Staggered Set
              </span>
              {/* Front/Rear specs */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-blue-50 px-2 py-1.5">
                  <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Front (×2)</div>
                  <div className="font-bold text-blue-900">
                    {selectedPair.front.diameter && `${fmtSizePart(selectedPair.front.diameter)}"`}
                    {selectedPair.front.diameter && selectedPair.front.width && " × "}
                    {selectedPair.front.width && `${fmtSizePart(selectedPair.front.width)}"`}
                  </div>
                  {selectedPair.front.offset && (
                    <div className="text-[10px] text-blue-600">ET{selectedPair.front.offset}</div>
                  )}
                </div>
                <div className="rounded-lg bg-orange-50 px-2 py-1.5">
                  <div className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide">Rear (×2)</div>
                  <div className="font-bold text-orange-900">
                    {selectedPair.rear.diameter && `${fmtSizePart(selectedPair.rear.diameter)}"`}
                    {selectedPair.rear.diameter && selectedPair.rear.width && " × "}
                    {selectedPair.rear.width && `${fmtSizePart(selectedPair.rear.width)}"`}
                  </div>
                  {selectedPair.rear.offset && (
                    <div className="text-[10px] text-orange-600">ET{selectedPair.rear.offset}</div>
                  )}
                </div>
              </div>
              {/* Finish below */}
              {selectedFinish && (
                <div className="mt-1.5 text-xs text-neutral-600">{selectedFinish}</div>
              )}
            </div>
          ) : (
            /* Standard square setup - Line 2: Size + Offset (if showOffset) + Finish */
            <div className="mt-0.5 text-sm text-neutral-600">
              {(currentDiameter || currentWidth) && (
                <span className="font-medium">
                  {currentDiameter && `${fmtSizePart(currentDiameter)}"`}
                  {currentDiameter && currentWidth && " × "}
                  {currentWidth && `${fmtSizePart(currentWidth)}"`}
                  {/* Show offset for lifted homepage intent builds */}
                  {showOffset && specLabel?.offset && (
                    <span className="ml-1 text-amber-700 font-bold">
                      {Number(specLabel.offset) >= 0 ? `+${specLabel.offset}` : specLabel.offset}
                    </span>
                  )}
                </span>
              )}
              {(currentDiameter || currentWidth) && selectedFinish && (
                <span className="mx-1.5 text-neutral-300">|</span>
              )}
              {selectedFinish && <span>{selectedFinish}</span>}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            "WHY THIS WHEEL" HELPER TEXT
            ═══════════════════════════════════════════════════════════════════════ */}
        {whyThisWheel && (
          <div className="mt-2 text-xs text-neutral-500 italic">
            {whyThisWheel}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            SIZE CONTEXT (Stock vs Upgraded) - Deprecated, replaced by Fitment Guidance
            ═══════════════════════════════════════════════════════════════════════ */}
        {!fitmentLevel && sizeContext && (
          <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
            sizeContext.type === "stock" ? "text-green-700" : "text-blue-700"
          }`}>
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
              sizeContext.type === "stock" ? "bg-green-100" : "bg-blue-100"
            }`}>
              {sizeContext.icon}
            </span>
            {sizeContext.text}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            FITMENT GUIDANCE BADGES (2026-04-07)
            Shows: Perfect Fit / Recommended / Popular Upgrade / Aggressive Fitment
            Plus: Works with Stock / Requires Level / Requires Lift / May Require Trimming
            ═══════════════════════════════════════════════════════════════════════ */}
        {fitmentLevel && (
          <div className="mt-2">
            <FitmentGuidanceStrip
              level={fitmentLevel}
              buildRequirement={buildRequirement || "stock"}
              variant="compact"
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            SOCIAL PROOF (One badge per card)
            ═══════════════════════════════════════════════════════════════════════ */}
        {effectiveSocialProof && (
          <div className="mt-2">
            <SocialProofBadge config={effectiveSocialProof} />
          </div>
        )}

        {/* Specs Row - Bolt pattern only (size moved to title area) */}
        {bolt && (
          <div className="mt-2 text-xs text-neutral-500">
            {bolt}
          </div>
        )}

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
                      if (typeof t.stockQty === "number") setSelectedStockQty(t.stockQty);
                      if (t.inventoryType) setSelectedInventoryType(t.inventoryType);
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
          </div>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* ═══════════════════════════════════════════════════════════════════════
            PRICING (Set of 4 prominent, per-wheel secondary, price anchor)
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
                {selectedPair?.staggered && selectedPair.rear ? (
                  <>for staggered set (2F + 2R)</>
                ) : (
                  <>for set of 4</>
                )}
                {typeof selectedPrice === "number" && (
                  <span className="ml-1">
                    (${selectedPrice.toFixed(0)} each)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Price anchoring */}
          {priceAnchor && (
            <div className="mt-1.5 text-[11px] text-neutral-400 font-medium">
              {priceAnchor}
            </div>
          )}

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

          {/* Stock availability - show qty if available, otherwise inventory type */}
          {typeof selectedStockQty === "number" && selectedStockQty > 0 ? (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[10px]">
                ✓
              </span>
              {selectedStockQty >= 20 ? "20+ in stock" : `${selectedStockQty} in stock`}
            </div>
          ) : selectedInventoryType && INVENTORY_TYPE_LABELS[selectedInventoryType]?.show ? (
            <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${INVENTORY_TYPE_LABELS[selectedInventoryType].className.split(" ")[0]}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${INVENTORY_TYPE_LABELS[selectedInventoryType].className.split(" ")[1]}`}>
                ✓
              </span>
              {INVENTORY_TYPE_LABELS[selectedInventoryType].label}
            </div>
          ) : null}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            SINGLE PRIMARY CTA: Selection-aware states
            - Not selected (no selection): "Add to Package"
            - Selected: "Selected ✓" (green, disabled-looking)
            - Not selected (has selection): "Compare or Switch"
            ═══════════════════════════════════════════════════════════════════════ */}
        <button
          type="button"
          onClick={() => {
            if (isSelected) return; // Already selected, no action
            if (onSelect) {
              // Pass current wheel state including selectedImage
              onSelect({
                imageUrl: selectedImage,
                price: selectedPrice,
                finish: selectedFinish,
                sku: selectedSku || baseSku,
              });
            } else {
              addToPackage();
            }
          }}
          disabled={isAdding || isSelected}
          data-cta-variant={ctaVariant}
          data-selected={isSelected}
          className={`
            mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl 
            text-base font-extrabold transition-all duration-200
            ${isSelected
              ? "bg-green-600 text-white cursor-default shadow-lg shadow-green-600/25"
              : isAdding 
                ? "bg-neutral-300 text-neutral-500 cursor-wait" 
                : hasSelection
                  ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border-2 border-neutral-200 hover:border-neutral-300 active:scale-[0.98]"
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
          ) : isAdding ? (
            <>
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Adding...
            </>
          ) : hasSelection ? (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Compare or Switch
            </>
          ) : (
            <>
              {CTA_TEXT[ctaVariant]}
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
