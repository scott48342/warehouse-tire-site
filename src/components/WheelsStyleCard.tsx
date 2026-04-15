"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FavoritesButton } from "@/components/FavoritesButton";
import { AddToCompareButton } from "@/components/AddToCompareButton";
import { normalizeWheelForCompare } from "@/context/CompareContext";
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
// TOP PICK CATEGORY TYPES - For guided selection
// ═══════════════════════════════════════════════════════════════════════════════
export type TopPickCategory = "best-overall" | "most-popular" | "best-style" | "best-value";

// REFINED: Softer, more cohesive color palette (less saturated, more premium)
const TOP_PICK_CONFIG: Record<TopPickCategory, { icon: string; label: string; color: string }> = {
  "best-overall": { icon: "⭐", label: "Best Overall", color: "bg-gradient-to-r from-amber-400/90 to-yellow-400/90 text-amber-950" },
  "most-popular": { icon: "🔥", label: "Most Popular", color: "bg-gradient-to-r from-orange-400/90 to-amber-400/90 text-orange-950" },
  "best-style": { icon: "💎", label: "Best Style Upgrade", color: "bg-gradient-to-r from-purple-400/90 to-violet-400/90 text-purple-950" },
  "best-value": { icon: "🛞", label: "Best Value", color: "bg-gradient-to-r from-emerald-400/90 to-teal-400/90 text-emerald-950" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL STYLE TAGS - For quick decision making
// ═══════════════════════════════════════════════════════════════════════════════
export type WheelStyleTag = 
  | "clean-style" 
  | "aggressive-look" 
  | "luxury-finish" 
  | "oem-plus" 
  | "flush-fit"
  | "deep-dish"
  | "concave"
  | "off-road"
  | "classic";

const STYLE_TAG_CONFIG: Record<WheelStyleTag, { label: string; className: string }> = {
  "clean-style": { label: "Clean Style", className: "bg-slate-100 text-slate-700" },
  "aggressive-look": { label: "Aggressive Look", className: "bg-orange-100 text-orange-700" },
  "luxury-finish": { label: "Luxury Finish", className: "bg-purple-100 text-purple-700" },
  "oem-plus": { label: "OEM+ Fit", className: "bg-blue-100 text-blue-700" },
  "flush-fit": { label: "Flush Fit", className: "bg-green-100 text-green-700" },
  "deep-dish": { label: "Deep Dish", className: "bg-amber-100 text-amber-700" },
  "concave": { label: "Slight Concave", className: "bg-indigo-100 text-indigo-700" },
  "off-road": { label: "Off-Road Ready", className: "bg-stone-200 text-stone-700" },
  "classic": { label: "Classic Style", className: "bg-neutral-200 text-neutral-700" },
};

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
// FITMENT BADGE CONFIG - Slim, conversion-optimized design
// ═══════════════════════════════════════════════════════════════════════════════
const FITMENT_CONFIG = {
  surefit: {
    label: "Guaranteed Fit",
    icon: "✓",
    className: "bg-green-600 text-white",
  },
  specfit: {
    label: "Good Fit",
    icon: "✓",
    className: "bg-blue-600 text-white",
  },
  extended: {
    label: "Custom Fit",
    icon: "⚡",
    className: "bg-amber-500 text-white",
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
  topPickCategory?: TopPickCategory;
}): string | null {
  const { brand, style, width, diameter, finish, vehicleModel, fitmentClass, isStockSize, topPickCategory } = params;
  
  // Top Pick specific copy
  if (topPickCategory) {
    switch (topPickCategory) {
      case "best-overall":
        return "Perfect blend of style, fitment, and value";
      case "most-popular":
        return "Customer favorite for this vehicle";
      case "best-style":
        return "Bold upgrade for a head-turning look";
      case "best-value":
        return "Great look without breaking the bank";
    }
  }
  
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
// STYLE TAG INFERENCE - Determine visual tags based on wheel attributes
// ═══════════════════════════════════════════════════════════════════════════════
function inferStyleTags(params: {
  style?: string;
  finish?: string;
  width?: string;
  offset?: string;
  brand?: string;
}): WheelStyleTag[] {
  const { style, finish, width, offset, brand } = params;
  const tags: WheelStyleTag[] = [];
  
  const styleLower = (style || "").toLowerCase();
  const finishLower = (finish || "").toLowerCase();
  const brandLower = (brand || "").toLowerCase();
  const numWidth = parseFloat(width || "0");
  const numOffset = parseFloat(offset || "0");
  
  // Off-road indicators
  if (
    styleLower.includes("off-road") || 
    styleLower.includes("offroad") ||
    brandLower.includes("fuel") ||
    brandLower.includes("method") ||
    brandLower.includes("black rhino")
  ) {
    tags.push("off-road");
  }
  
  // Aggressive look (wide width or negative offset)
  if (numWidth >= 10 || numOffset < -10) {
    tags.push("aggressive-look");
  }
  
  // Deep dish (very negative offset)
  if (numOffset < -20) {
    tags.push("deep-dish");
  }
  
  // Luxury finish
  if (
    finishLower.includes("chrome") || 
    finishLower.includes("polished") ||
    brandLower.includes("asanti") ||
    brandLower.includes("lexani") ||
    brandLower.includes("dub")
  ) {
    tags.push("luxury-finish");
  }
  
  // Flush fit (moderate positive offset)
  if (numOffset >= 30 && numOffset <= 50) {
    tags.push("flush-fit");
  }
  
  // Clean style (default for standard looks)
  if (
    tags.length === 0 &&
    !finishLower.includes("milled") &&
    numWidth < 9.5
  ) {
    tags.push("clean-style");
  }
  
  // Concave styling
  if (styleLower.includes("concave")) {
    tags.push("concave");
  }
  
  // Classic style
  if (styleLower.includes("classic") || styleLower.includes("vintage") || styleLower.includes("retro")) {
    tags.push("classic");
  }
  
  // OEM+ fit (stock-like offset range)
  if (numOffset >= 20 && numOffset <= 45 && numWidth <= 9) {
    tags.push("oem-plus");
  }
  
  return tags.slice(0, 2); // Max 2 tags
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
// PRICE ANCHORING - Typical package range with YOUR PRICE highlight
// REFINED: Improved hierarchy - "Your Price" is clearer but doesn't overpower main price
// ═══════════════════════════════════════════════════════════════════════════════
function PriceAnchorBlock({ wheelSetPrice }: { wheelSetPrice: number | null }) {
  if (wheelSetPrice === null) return null;
  
  // Estimate typical package: wheels + tires + TPMS + installation
  const minPackage = wheelSetPrice + 600 + 60 + 80;
  const maxPackage = wheelSetPrice + 1200 + 100 + 120;
  
  const minRounded = Math.round(minPackage / 100) * 100;
  const maxRounded = Math.round(maxPackage / 100) * 100;
  
  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-[11px] text-neutral-400 font-medium">
        Typical package: ${minRounded.toLocaleString()}–${maxRounded.toLocaleString()}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Your Price:</span>
        <span className="text-base font-extrabold text-emerald-800">
          ${wheelSetPrice.toLocaleString()}
        </span>
        <span className="text-[10px] text-neutral-400 font-medium">wheels only</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE TAGS DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════
function StyleTagsDisplay({ tags }: { tags: WheelStyleTag[] }) {
  if (tags.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5">
      {tags.map((tag) => {
        const config = STYLE_TAG_CONFIG[tag];
        return (
          <span
            key={tag}
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${config.className}`}
          >
            {config.label}
          </span>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST STRIP - Near CTA for conversion confidence (refined colors)
// ═══════════════════════════════════════════════════════════════════════════════
function TrustStrip({ showHardware = true }: { showHardware?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-neutral-400 font-medium">
      <span className="inline-flex items-center gap-1">
        <span className="text-emerald-500">✓</span>
        <span>Guaranteed Fit</span>
      </span>
      {showHardware && (
        <span className="inline-flex items-center gap-1">
          <span className="text-emerald-500">✓</span>
          <span>Hardware Included</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <span className="text-neutral-400">🚚</span>
        <span>Free Shipping</span>
      </span>
    </div>
  );
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
  // NEW: Top Pick category for guided selection
  topPickCategory,
  // NEW: Is this card in the Top Picks section
  isTopPick = false,
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
  // NEW: Top Pick category for guided selection
  topPickCategory?: TopPickCategory;
  // NEW: Is this card in the Top Picks section
  isTopPick?: boolean;
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
  const currentOffset = selectedPair?.front?.offset || specLabel?.offset;
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
    topPickCategory,
  }), [brand, style, currentWidth, currentDiameter, selectedFinish, vehicleModel, fitmentClass, isStockSize, topPickCategory]);
  
  const styleTags = useMemo(() => inferStyleTags({
    style,
    finish: selectedFinish,
    width: currentWidth,
    offset: currentOffset,
    brand,
  }), [style, selectedFinish, currentWidth, currentOffset, brand]);
  
  const sizeContext = useMemo(() => getSizeContext({
    isStockSize,
    width: currentWidth,
    diameter: currentDiameter,
    stockWidth,
    stockDiameter,
  }), [isStockSize, currentWidth, currentDiameter, stockWidth, stockDiameter]);
  
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

  // Top Pick category badge config
  const topPickConfig = topPickCategory ? TOP_PICK_CONFIG[topPickCategory] : null;

  return (
    <div 
      className={`
        group relative flex flex-col overflow-hidden rounded-2xl border bg-white
        transition-all duration-250 ease-out
        ${isTopPick 
          ? "border-amber-100/80 bg-gradient-to-b from-amber-50/30 to-white shadow-sm" 
          : "border-neutral-200"
        }
        ${isSelected
          ? "ring-2 ring-green-500 ring-offset-2 scale-[1.01]"
          : "hover:shadow-md hover:border-neutral-300 hover:-translate-y-0.5"
        }
      `}
    >
      
      {/* ═══════════════════════════════════════════════════════════════════════
          TOP PICK CATEGORY BADGE (Above title, refined styling)
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
          SLIM FITMENT BADGE (Compact, not overwhelming)
          ═══════════════════════════════════════════════════════════════════════ */}
      {fitmentConfig && !topPickConfig && (
        <div className="px-3 py-1.5 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${fitmentConfig.className}`}>
            <span>{fitmentConfig.icon}</span>
            {fitmentConfig.label}
          </span>
          <span className="text-[10px] text-neutral-400">Hardware included</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          IMAGE (With subtle hover zoom effect - refined to 1.03)
          ═══════════════════════════════════════════════════════════════════════ */}
      <Link href={viewHref} className="block relative overflow-hidden">
        <div className="aspect-square w-full overflow-hidden bg-neutral-50">
          {selectedImage ? (
            <img
              src={selectedImage}
              alt={title}
              className="h-full w-full object-contain p-4 transition-transform duration-250 ease-out group-hover:scale-[1.03]"
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
        
        {/* Action buttons overlay (Favorites + Compare) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <AddToCompareButton
            item={normalizeWheelForCompare({
              sku: selectedSku || baseSku,
              brand,
              model: title,
              finish: selectedFinish,
              imageUrl: selectedImage,
              price: selectedPrice,
              diameter: selectedPair?.front?.diameter ?? sizeLabel?.diameter,
              width: selectedPair?.front?.width ?? sizeLabel?.width,
              offset: selectedPair?.front?.offset ?? specLabel?.offset,
              boltPattern: specLabel?.boltPattern,
              centerbore: String(wheelCenterBore || ""),
              fitmentClass,
              stockQty: selectedStockQty,
              inventoryType: selectedInventoryType,
            })}
            variant="icon"
            size="sm"
          />
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
          CONTENT AREA (Refined spacing for premium feel)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col p-4 pt-3.5">
        
        {/* ═══════════════════════════════════════════════════════════════════════
            TITLE STRUCTURE (Improved spacing: badge → brand → title)
            ═══════════════════════════════════════════════════════════════════════ */}
        <div>
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">{brand}</div>
          <Link href={viewHref}>
            <h3 className="mt-1 text-base font-bold text-neutral-900 hover:text-neutral-700 transition-colors line-clamp-1">
              {title}
            </h3>
          </Link>
          
          {/* Show staggered badge + front/rear specs for staggered wheels */}
          {selectedPair?.staggered && selectedPair.rear ? (
            <div className="mt-2">
              {/* Staggered badge */}
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 mb-2">
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
                <div className="mt-2 text-xs text-neutral-600">{selectedFinish}</div>
              )}
            </div>
          ) : (
            /* Standard square setup - Line 2: Size + Offset (if showOffset) + Finish */
            <div className="mt-1 text-sm text-neutral-600">
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
            "WHY THIS WHEEL" HELPER TEXT (Refined spacing)
            ═══════════════════════════════════════════════════════════════════════ */}
        {whyThisWheel && (
          <div className={`mt-2.5 text-[11px] leading-relaxed italic ${topPickCategory ? "text-neutral-600 font-medium" : "text-neutral-400"}`}>
            "{whyThisWheel}"
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            STYLE TAGS (Visual decision helpers)
            ═══════════════════════════════════════════════════════════════════════ */}
        <StyleTagsDisplay tags={styleTags} />

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
        {effectiveSocialProof && !topPickCategory && (
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
        <div className="flex-1 min-h-3" />

        {/* ═══════════════════════════════════════════════════════════════════════
            PRICING (Enhanced with package value perception)
            ═══════════════════════════════════════════════════════════════════════ */}
        <div className="mt-4 pt-4 border-t border-neutral-100">
          <div className="flex flex-col gap-1">
            {/* Per wheel price - secondary */}
            {typeof selectedPrice === "number" ? (
              <div className="flex items-baseline gap-1 text-neutral-500">
                <span className="text-sm font-semibold">
                  ${selectedPrice.toFixed(0)}
                </span>
                <span className="text-xs">per wheel</span>
              </div>
            ) : null}
            
            {/* Set of 4 total - PRIMARY */}
            <div className="flex items-baseline gap-2 px-3 py-2 bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-xl">
              <span className="text-2xl font-black text-neutral-900">
                {setPrice !== null 
                  ? `$${setPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : fromSetPrice !== null 
                    ? `From $${fromSetPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : "Call for price"
                }
              </span>
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                {selectedPair?.staggered && selectedPair.rear ? (
                  <>staggered set</>
                ) : (
                  <>set of 4</>
                )}
              </span>
            </div>
          </div>

          {/* Price anchoring with YOUR PRICE highlight */}
          <PriceAnchorBlock wheelSetPrice={setPrice} />

          {/* Stock availability */}
          {typeof selectedStockQty === "number" && selectedStockQty > 0 ? (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[10px]">
                ✓
              </span>
              {selectedStockQty >= 20 ? "20+ in stock" : `${selectedStockQty} in stock`}
            </div>
          ) : selectedInventoryType && INVENTORY_TYPE_LABELS[selectedInventoryType]?.show ? (
            <div className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${INVENTORY_TYPE_LABELS[selectedInventoryType].className.split(" ")[0]}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${INVENTORY_TYPE_LABELS[selectedInventoryType].className.split(" ")[1]}`}>
                ✓
              </span>
              {INVENTORY_TYPE_LABELS[selectedInventoryType].label}
            </div>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════════════
              TRUST STRIP (Near CTA)
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="mt-3">
            <TrustStrip showHardware={!!fitmentClass} />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            PRIMARY CTA: Refined gradient & subtle shadow (premium feel)
            ═══════════════════════════════════════════════════════════════════════ */}
        <button
          type="button"
          onClick={() => {
            if (isSelected) return;
            if (onSelect) {
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
            mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-xl 
            text-sm font-bold transition-all duration-250
            ${isSelected
              ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white cursor-default shadow-md shadow-emerald-500/25"
              : isAdding 
                ? "bg-neutral-200 text-neutral-400 cursor-wait" 
                : hasSelection
                  ? "bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 active:scale-[0.99]"
                  : "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-600 active:scale-[0.99] shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/25"
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
              Add Full Set
              {setPrice !== null && (
                <span className="opacity-90 font-bold">
                  – ${setPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
            </>
          )}
        </button>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECONDARY: View Details link
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
