"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { WheelBadgeStack, AvailabilityIndicator, FitmentConfirmation, type WheelBadgeInfo, type AvailabilityLabel } from "./WheelBadges";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type HeroWheelItem = {
  sku: string;
  brand: string;
  brandCode?: string;
  model: string;
  finish?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  imageUrl?: string;
  price?: number;
  fitmentClass?: "surefit" | "specfit" | "extended";
  availability?: {
    label: AvailabilityLabel;
    localStock?: number;
    globalStock?: number;
  };
  ranking?: {
    score: number;
    priceTier?: "value" | "mid" | "premium";
  };
  viewHref: string;
};

// Tier 1 brands (premium/popular)
const TIER_1_BRANDS = new Set([
  "FM", "FT", "MO", "XD", "KM", "RC", "AR", // Fuel, Moto Metal, XD, KMC, Raceline, American Racing
  "FUEL", "MOTO METAL", "XD SERIES", "KMC", "RACELINE", "AMERICAN RACING",
]);

// ═══════════════════════════════════════════════════════════════════════════
// HERO SELECTION LOGIC
// ═══════════════════════════════════════════════════════════════════════════

export interface HeroSelectionConfig {
  maxItems?: number;
  requireInStock?: boolean;
  preferTier1Brands?: boolean;
  requireImages?: boolean;
  minScore?: number;
  maxPerBrand?: number;
  maxPerModel?: number;
}

/**
 * Selects top wheel picks for the hero row based on:
 * - availability.label === 'in_stock' (required by default)
 * - Tier 1 brands preferred
 * - has images (required by default)
 * - high ranking score
 * - model deduping (max 1 per model key)
 * - brand diversity (max 2 per brand)
 */
export function selectHeroItems(
  items: HeroWheelItem[],
  config: HeroSelectionConfig = {}
): HeroWheelItem[] {
  const {
    maxItems = 8,
    requireInStock = true,
    preferTier1Brands = true,
    requireImages = true,
    minScore = 0,
    maxPerBrand = 2,
    maxPerModel = 1,
  } = config;

  // Step 1: Filter eligible items
  let eligible = items.filter((item) => {
    // Must have image (if required)
    if (requireImages && !item.imageUrl) return false;
    
    // Must be in stock (if required)
    if (requireInStock && item.availability?.label !== "in_stock") return false;
    
    // Must meet minimum score
    const score = item.ranking?.score ?? 0;
    if (score < minScore) return false;
    
    // Must have price
    if (typeof item.price !== "number" || item.price <= 0) return false;
    
    return true;
  });

  // Step 2: Score each item for hero selection
  const scored = eligible.map((item) => {
    let heroScore = item.ranking?.score ?? 50;
    
    // Boost Tier 1 brands
    const brandCode = (item.brandCode || item.brand || "").toUpperCase();
    if (preferTier1Brands && TIER_1_BRANDS.has(brandCode)) {
      heroScore += 15;
    }
    
    // Boost in_stock
    if (item.availability?.label === "in_stock") {
      heroScore += 10;
    }
    
    // Boost surefit
    if (item.fitmentClass === "surefit") {
      heroScore += 10;
    } else if (item.fitmentClass === "specfit") {
      heroScore += 5;
    }
    
    // Slight boost for mid-range price (sweet spot)
    if (item.ranking?.priceTier === "mid") {
      heroScore += 5;
    }
    
    return { item, heroScore };
  });

  // Step 3: Sort by hero score
  scored.sort((a, b) => b.heroScore - a.heroScore);

  // Step 4: Apply diversity rules (brand & model deduping)
  const selected: HeroWheelItem[] = [];
  const brandCount = new Map<string, number>();
  const modelSeen = new Set<string>();

  for (const { item } of scored) {
    if (selected.length >= maxItems) break;

    // Model deduping
    const modelKey = `${(item.brandCode || item.brand || "").toLowerCase()}:${(item.model || "").toLowerCase()}`;
    const modelCount = Array.from(modelSeen).filter(m => m === modelKey).length;
    if (modelCount >= maxPerModel) continue;

    // Brand diversity
    const brand = (item.brandCode || item.brand || "").toUpperCase();
    const currentBrandCount = brandCount.get(brand) || 0;
    if (currentBrandCount >= maxPerBrand) continue;

    // Add to selection
    selected.push(item);
    brandCount.set(brand, currentBrandCount + 1);
    modelSeen.add(modelKey);
  }

  return selected;
}

// ═══════════════════════════════════════════════════════════════════════════
// HERO CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function HeroCard({ item }: { item: HeroWheelItem }) {
  const badgeInfo: WheelBadgeInfo = {
    availability: item.availability,
    ranking: item.ranking,
    isTopPick: (item.ranking?.score ?? 0) >= 90,
    isBestValue: item.ranking?.priceTier === "mid" && (item.ranking?.score ?? 0) >= 75,
  };

  return (
    <Link
      href={item.viewHref}
      className="group flex-shrink-0 w-[260px] sm:w-[280px] rounded-2xl border border-neutral-200 bg-white p-4 hover:shadow-lg hover:border-neutral-300 transition-all duration-200"
    >
      {/* Badges row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <WheelBadgeStack info={badgeInfo} size="sm" />
        {item.availability && (
          <AvailabilityIndicator 
            label={item.availability.label} 
            showLabel={false}
            size="sm"
          />
        )}
      </div>

      {/* Image */}
      <div className="overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={`${item.brand} ${item.model}`}
            className="h-36 w-full object-contain bg-white group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="h-36 flex items-center justify-center bg-white text-neutral-400 text-sm">
            No image
          </div>
        )}
      </div>

      {/* Details */}
      <div className="mt-3">
        <div className="text-xs font-semibold text-neutral-500">{item.brand}</div>
        <h3 className="text-sm font-bold text-neutral-900 line-clamp-1 group-hover:text-red-600 transition-colors">
          {item.model}
        </h3>
        {item.finish && (
          <div className="text-xs text-neutral-600 mt-0.5">{item.finish}</div>
        )}
      </div>

      {/* Size */}
      {(item.diameter || item.width) && (
        <div className="mt-2 text-xs font-medium text-neutral-700">
          {item.diameter && `${item.diameter}"`}
          {item.diameter && item.width && " × "}
          {item.width && `${item.width}"`}
          {item.offset && <span className="text-neutral-500 ml-1">• {item.offset}mm</span>}
        </div>
      )}

      {/* Fitment confirmation */}
      <FitmentConfirmation fitmentClass={item.fitmentClass} className="mt-2" />

      {/* Price */}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-lg font-bold text-neutral-900">
          ${item.price?.toFixed(2) ?? "—"}
        </span>
        <span className="text-xs text-neutral-500">each</span>
      </div>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HERO ROW COMPONENT (Horizontal Scroll Carousel)
// ═══════════════════════════════════════════════════════════════════════════

interface HeroRowProps {
  items: HeroWheelItem[];
  title?: string;
  subtitle?: string;
  vehicleLabel?: string;
  config?: HeroSelectionConfig;
  className?: string;
}

export function HeroRow({
  items,
  title = "🔥 Top Picks for Your Vehicle",
  subtitle,
  vehicleLabel,
  config,
  className = "",
}: HeroRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Select hero items
  const heroItems = selectHeroItems(items, config);

  // Update scroll button visibility
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateScrollState = () => {
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    };

    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [heroItems.length]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = 300;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  // Don't render if no hero items
  if (heroItems.length === 0) return null;

  return (
    <section className={`mb-8 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-neutral-600 mt-0.5">{subtitle}</p>
          )}
          {vehicleLabel && !subtitle && (
            <p className="text-sm text-neutral-600 mt-0.5">
              Selected for your {vehicleLabel}
            </p>
          )}
        </div>

        {/* Scroll buttons (desktop) */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="p-2 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            aria-label="Scroll left"
          >
            <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="p-2 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            aria-label="Scroll right"
          >
            <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {heroItems.map((item) => (
          <div key={item.sku} className="snap-start">
            <HeroCard item={item} />
          </div>
        ))}
      </div>

      {/* Scroll hint (mobile) */}
      {heroItems.length > 2 && (
        <div className="flex sm:hidden justify-center mt-2">
          <span className="text-xs text-neutral-400">Swipe to see more →</span>
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Convert wheel result to HeroWheelItem
// ═══════════════════════════════════════════════════════════════════════════

export function toHeroItem(
  wheel: any,
  viewParams: Record<string, string | undefined>
): HeroWheelItem {
  const sku = wheel.sku || wheel.pair?.front?.sku || "";
  
  // Build view href
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(viewParams)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  const viewHref = `/wheels/${encodeURIComponent(sku)}${qs ? `?${qs}` : ""}`;

  return {
    sku,
    brand: wheel.brand || "",
    brandCode: wheel.brandCode || "",
    model: wheel.model || wheel.title || "",
    finish: wheel.finish || "",
    diameter: wheel.diameter || wheel.pair?.front?.diameter || "",
    width: wheel.width || wheel.pair?.front?.width || "",
    offset: wheel.offset || wheel.pair?.front?.offset || "",
    imageUrl: wheel.imageUrl || "",
    price: wheel.price,
    fitmentClass: wheel.fitmentClass,
    availability: wheel.availability ? {
      label: wheel.availability.label || "check_availability",
      localStock: wheel.availability.localStock,
      globalStock: wheel.availability.globalStock,
    } : undefined,
    ranking: wheel.ranking ? {
      score: wheel.ranking.score || 50,
      priceTier: wheel.ranking.priceTier,
    } : undefined,
    viewHref,
  };
}
