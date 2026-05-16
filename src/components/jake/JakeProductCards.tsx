"use client";

import React, { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParsedProduct {
  type: "tire" | "wheel";
  name: string;
  brand?: string;
  model?: string;
  price?: string;
  priceNum?: number;
  warranty?: string;
  size?: string;
  finish?: string;
  fitmentLabel?: string;
  imageUrl?: string;
  productUrl?: string;
  inStock?: boolean;
  setPrice?: string;
  terrain?: string;
  loadRange?: string;
  speedRating?: string;
  // New v2 fields
  recommendationBadge?: RecommendationBadge;
  noiseLevel?: "quiet" | "moderate" | "loud";
  wetGrip?: "excellent" | "good" | "average";
  snowRated?: boolean; // 3PMSF
  loadIndex?: number;
}

interface PackageSummary {
  tire?: ParsedProduct;
  wheel?: ParsedProduct;
  totalPrice?: string;
  totalPriceNum?: number;
  // New v2 fields
  badges?: PackageBadge[];
  buildRequirement?: string;
  monthlyPayment?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMENDATION BADGES
// ═══════════════════════════════════════════════════════════════════════════════

export type RecommendationBadge = 
  | "jakes-pick"
  | "best-value"
  | "quietest"
  | "best-highway"
  | "most-aggressive"
  | "best-winter"
  | "best-towing"
  | "longest-warranty"
  | "best-wet-grip"
  | "lightweight"
  | "ev-optimized";

type PackageBadge =
  | "aggressive-look"
  | "daily-friendly"
  | "quiet-ride"
  | "great-towing"
  | "off-road-ready"
  | "lightweight"
  | "oem-plus"
  | "show-winner";

const RECOMMENDATION_BADGE_CONFIG: Record<RecommendationBadge, { label: string; color: string; icon: string }> = {
  "jakes-pick": { label: "Jake's Pick", color: "bg-red-600", icon: "🎯" },
  "best-value": { label: "Best Value", color: "bg-green-600", icon: "💰" },
  "quietest": { label: "Quietest Option", color: "bg-blue-600", icon: "🔇" },
  "best-highway": { label: "Best for Highway", color: "bg-purple-600", icon: "🛣️" },
  "most-aggressive": { label: "Most Aggressive", color: "bg-orange-600", icon: "🔥" },
  "best-winter": { label: "Best Winter Grip", color: "bg-cyan-600", icon: "❄️" },
  "best-towing": { label: "Best for Towing", color: "bg-amber-600", icon: "🚛" },
  "longest-warranty": { label: "Longest Warranty", color: "bg-emerald-600", icon: "🛡️" },
  "best-wet-grip": { label: "Best Wet Grip", color: "bg-sky-600", icon: "💧" },
  "lightweight": { label: "Lightweight", color: "bg-violet-600", icon: "🪶" },
  "ev-optimized": { label: "EV Optimized", color: "bg-teal-600", icon: "⚡" },
};

const PACKAGE_BADGE_CONFIG: Record<PackageBadge, { label: string; icon: string }> = {
  "aggressive-look": { label: "Aggressive Look", icon: "🔥" },
  "daily-friendly": { label: "Daily Driver Friendly", icon: "🚗" },
  "quiet-ride": { label: "Quiet Ride", icon: "🔇" },
  "great-towing": { label: "Great for Towing", icon: "🚛" },
  "off-road-ready": { label: "Off-Road Ready", icon: "🏔️" },
  "lightweight": { label: "Lightweight Setup", icon: "🪶" },
  "oem-plus": { label: "OEM+ Style", icon: "✨" },
  "show-winner": { label: "Show Winner", icon: "🏆" },
};

const FINISH_LABELS: Record<string, { label: string; color: string }> = {
  "black": { label: "Satin Black", color: "bg-gray-800" },
  "gloss black": { label: "Gloss Black", color: "bg-black" },
  "matte black": { label: "Matte Black", color: "bg-gray-900" },
  "bronze": { label: "Bronze", color: "bg-amber-700" },
  "chrome": { label: "Chrome", color: "bg-gradient-to-r from-gray-300 to-gray-100" },
  "machined": { label: "Machined", color: "bg-gradient-to-r from-gray-400 to-gray-200" },
  "gunmetal": { label: "Gunmetal", color: "bg-gray-600" },
  "red": { label: "Red Accent", color: "bg-red-600" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMENDATION BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function RecommendationBadgeTag({ badge }: { badge: RecommendationBadge }) {
  const config = RECOMMENDATION_BADGE_CONFIG[badge];
  if (!config) return null;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${config.color} text-white text-xs font-semibold rounded-full shadow-lg`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOISE LEVEL INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

function NoiseLevelIndicator({ level }: { level: "quiet" | "moderate" | "loud" }) {
  const bars = level === "quiet" ? 1 : level === "moderate" ? 2 : 3;
  const color = level === "quiet" ? "bg-green-500" : level === "moderate" ? "bg-yellow-500" : "bg-orange-500";
  const label = level === "quiet" ? "Quiet" : level === "moderate" ? "Moderate" : "Loud";
  
  return (
    <div className="flex items-center gap-1" title={`Road Noise: ${label}`}>
      <span className="text-white/40 text-xs">🔊</span>
      <div className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-1 rounded-full ${i <= bars ? color : "bg-white/10"}`}
            style={{ height: `${8 + i * 2}px` }}
          />
        ))}
      </div>
      <span className="text-white/40 text-xs ml-0.5">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIRE CARD v2 - Premium Visual
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeProductCardProps {
  product: ParsedProduct;
  onClick?: () => void;
  showCompare?: boolean;
  isComparing?: boolean;
  onCompareToggle?: () => void;
  compareDisabled?: boolean;
  isLocal?: boolean;
  installCostPerTire?: number;
  taxRate?: number;
}

export function JakeProductCard({ 
  product, 
  onClick, 
  showCompare = false,
  isComparing = false,
  onCompareToggle,
  compareDisabled = false,
  isLocal = false,
  installCostPerTire = 25,
  taxRate = 0.06,
}: JakeProductCardProps) {
  const isTire = product.type === "tire";
  const [imgError, setImgError] = useState(false);

  // Calculate out-the-door pricing for local site (tires only)
  const priceNum = product.priceNum || parseFloat(String(product.price || "0").replace(/[$,]/g, ""));
  const tireSetPrice = priceNum * 4;
  const installTotal = installCostPerTire * 4;
  const subtotal = tireSetPrice + installTotal;
  const taxAmount = subtotal * taxRate;
  const outTheDoorPrice = subtotal + taxAmount;
  const showOutTheDoor = isLocal && isTire && priceNum > 0;

  const PlaceholderIcon = () => (
    <div className="text-white/20">
      {isTire ? (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
          <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
        </svg>
      ) : (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
          <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
          <line x1="12" y1="3" x2="12" y2="8" strokeWidth={1.5} />
          <line x1="12" y1="16" x2="12" y2="21" strokeWidth={1.5} />
          <line x1="3" y1="12" x2="8" y2="12" strokeWidth={1.5} />
          <line x1="16" y1="12" x2="21" y2="12" strokeWidth={1.5} />
        </svg>
      )}
    </div>
  );

  return (
    <div className="relative">
      {/* Recommendation Badge - Floating */}
      {product.recommendationBadge && (
        <div className="absolute -top-2 left-3 z-10">
          <RecommendationBadgeTag badge={product.recommendationBadge} />
        </div>
      )}
      
      <a
        href={product.productUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={`block bg-[#1a1a1a] hover:bg-[#222] border border-white/10 hover:border-white/20 rounded-xl overflow-hidden transition-all group ${product.recommendationBadge ? "mt-3" : ""}`}
      >
        <div className="flex gap-4 p-4">
          {/* Image - Larger for v2 */}
          <div className="w-20 h-20 bg-gradient-to-br from-white/10 to-white/5 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
            {product.imageUrl && !imgError ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                width={80}
                height={80}
                className="object-contain w-full h-full p-1"
                onError={() => setImgError(true)}
              />
            ) : (
              <PlaceholderIcon />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold text-base leading-tight group-hover:text-red-400 transition-colors line-clamp-2">
                  {product.brand} {product.model}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {product.size && (
                    <span className="text-white/60 text-sm font-medium">{product.size}</span>
                  )}
                  {product.terrain && (
                    <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-white/70 font-medium">
                      {product.terrain}
                    </span>
                  )}
                  {product.snowRated && (
                    <span className="text-xs px-2 py-0.5 bg-cyan-600/30 text-cyan-300 rounded-full font-medium" title="3-Peak Mountain Snowflake Rated">
                      ❄️ Snow Rated
                    </span>
                  )}
                </div>
              </div>
              
              {/* Price */}
              <div className="text-right flex-shrink-0">
                {showOutTheDoor ? (
                  <>
                    <p className="text-white font-bold text-lg">${outTheDoorPrice.toFixed(0)}</p>
                    <p className="text-green-400 text-xs font-medium">installed, out the door</p>
                  </>
                ) : (
                  <>
                    <p className="text-white font-bold text-lg">{product.price}</p>
                    {product.setPrice && (
                      <p className="text-white/50 text-xs">{product.setPrice}/set</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Feature Row */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {product.warranty && (
                <span className="text-xs text-green-400 flex items-center gap-1 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {product.warranty}
                </span>
              )}
              {product.loadRange && (
                <span className="text-xs text-amber-400 font-medium">
                  Load Range {product.loadRange}
                </span>
              )}
              {product.noiseLevel && (
                <NoiseLevelIndicator level={product.noiseLevel} />
              )}
              {product.inStock && (
                <span className="text-xs text-green-500 font-medium">✓ In Stock</span>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {/* Compare Button */}
              {showCompare && onCompareToggle && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onCompareToggle();
                  }}
                  disabled={compareDisabled && !isComparing}
                  className={`px-3 py-1 text-xs rounded-full transition-all font-medium ${
                    isComparing
                      ? "bg-blue-600 text-white"
                      : compareDisabled
                        ? "bg-white/5 text-white/30 cursor-not-allowed"
                        : "bg-white/10 hover:bg-blue-600/50 text-white/70 hover:text-white"
                  }`}
                >
                  {isComparing ? "✓ Comparing" : "+ Compare"}
                </button>
              )}
              
              {/* Add to Build Hint */}
              <span className="text-white/40 text-xs italic hidden group-hover:inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Click to ask Jake
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center text-white/30 group-hover:text-red-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </a>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM PACKAGE CARD v2
// ═══════════════════════════════════════════════════════════════════════════════

interface JakePackageCardProps {
  packageSummary: PackageSummary;
  cartUrl?: string;
  onCheckout?: () => void;
  onAskJake?: () => void;
}

export function JakePackageCard({ packageSummary, cartUrl, onCheckout, onAskJake }: JakePackageCardProps) {
  const { tire, wheel, totalPrice, totalPriceNum, badges, buildRequirement, monthlyPayment } = packageSummary;
  const [wheelImgError, setWheelImgError] = useState(false);
  const [tireImgError, setTireImgError] = useState(false);

  return (
    <div className="bg-gradient-to-br from-[#1f1f1f] to-[#141414] border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header with Badges */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg">Your Package</span>
          </div>
          {buildRequirement && (
            <span className="text-xs px-2 py-1 bg-blue-600/20 text-blue-300 rounded-full font-medium">
              {buildRequirement}
            </span>
          )}
        </div>
        
        {/* Package Badges */}
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {badges.map((badge) => {
              const config = PACKAGE_BADGE_CONFIG[badge];
              return config ? (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-white/80 text-xs rounded-full font-medium"
                >
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Visual Product Display */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-center gap-4">
          {/* Wheel Image - Large */}
          {wheel && (
            <div className="relative">
              <div className="w-28 h-28 bg-gradient-to-br from-white/10 to-white/5 rounded-xl flex items-center justify-center overflow-hidden">
                {wheel.imageUrl && !wheelImgError ? (
                  <img
                    src={wheel.imageUrl}
                    alt={`${wheel.brand} ${wheel.model}`}
                    className="w-full h-full object-contain p-2"
                    onError={() => setWheelImgError(true)}
                  />
                ) : (
                  <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                    <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
                  </svg>
                )}
              </div>
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full whitespace-nowrap font-medium">
                Wheel
              </span>
            </div>
          )}
          
          {/* Plus Sign */}
          {wheel && tire && (
            <div className="text-white/30 text-2xl font-light">+</div>
          )}
          
          {/* Tire Image - Large */}
          {tire && (
            <div className="relative">
              <div className="w-28 h-28 bg-gradient-to-br from-white/10 to-white/5 rounded-xl flex items-center justify-center overflow-hidden">
                {tire.imageUrl && !tireImgError ? (
                  <img
                    src={tire.imageUrl}
                    alt={`${tire.brand} ${tire.model}`}
                    className="w-full h-full object-contain p-2"
                    onError={() => setTireImgError(true)}
                  />
                ) : (
                  <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                    <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
                  </svg>
                )}
              </div>
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full whitespace-nowrap font-medium">
                Tire
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Product Details */}
      <div className="px-5 space-y-3">
        {/* Wheel Details */}
        {wheel && (
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
            <div>
              <p className="text-white font-semibold text-sm">{wheel.brand} {wheel.model}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white/50 text-xs">{wheel.size}</span>
                {wheel.finish && (
                  <span className="text-xs px-1.5 py-0.5 bg-white/10 rounded text-white/60">
                    {wheel.finish}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-bold">{wheel.price}</p>
              <p className="text-white/40 text-xs">× 4</p>
            </div>
          </div>
        )}

        {/* Tire Details */}
        {tire && (
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
            <div>
              <p className="text-white font-semibold text-sm">{tire.brand} {tire.model}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white/50 text-xs">{tire.size}</span>
                {tire.terrain && (
                  <span className="text-xs px-1.5 py-0.5 bg-white/10 rounded text-white/60">
                    {tire.terrain}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-bold">{tire.price}</p>
              <p className="text-white/40 text-xs">× 4</p>
            </div>
          </div>
        )}
      </div>

      {/* Total & CTA */}
      <div className="p-5 mt-2">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-white/50 text-sm">Package Total</p>
            {monthlyPayment && (
              <p className="text-green-400 text-xs font-medium">
                or {monthlyPayment}/mo with financing
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-3xl">{totalPrice}</p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-2">
          {cartUrl && (
            <a
              href={cartUrl}
              onClick={onCheckout}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-green-500/20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Checkout This Package
            </a>
          )}
          
          {onAskJake && (
            <button
              onClick={onAskJake}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white font-medium rounded-xl transition-all text-sm"
            >
              💬 Ask Jake to Customize
            </button>
          )}
        </div>
        
        {/* Build Assurance */}
        <p className="text-center text-white/40 text-xs mt-3">
          Jake can adjust this package anytime
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM WHEEL CARD v2
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeWheelCardProps {
  wheel: {
    brand: string;
    model: string;
    size: string;
    finish?: string;
    price: string;
    priceSet?: string;
    imageUrl?: string;
    productUrl: string;
    fitmentLabel?: string;
    inStock?: boolean;
    recommendationBadge?: RecommendationBadge;
  };
  onClick?: () => void;
  showCompare?: boolean;
  isComparing?: boolean;
  onCompareToggle?: () => void;
}

export function JakeWheelCard({ wheel, onClick, showCompare, isComparing, onCompareToggle }: JakeWheelCardProps) {
  const [imgError, setImgError] = useState(false);
  
  // Normalize finish for styling
  const finishLower = (wheel.finish || "").toLowerCase();
  const finishConfig = Object.entries(FINISH_LABELS).find(([key]) => finishLower.includes(key))?.[1];
  
  return (
    <div className="relative group">
      {/* Recommendation Badge */}
      {wheel.recommendationBadge && (
        <div className="absolute -top-2 left-3 z-10">
          <RecommendationBadgeTag badge={wheel.recommendationBadge} />
        </div>
      )}
      
      <a
        href={wheel.productUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={`block bg-[#1a1a1a] hover:bg-[#222] border border-white/10 hover:border-white/20 rounded-xl overflow-hidden transition-all ${wheel.recommendationBadge ? "mt-3" : ""}`}
      >
        {/* Large Wheel Image */}
        <div className="aspect-square relative bg-gradient-to-br from-white/10 to-white/0">
          {wheel.imageUrl && !imgError ? (
            <img
              src={wheel.imageUrl}
              alt={`${wheel.brand} ${wheel.model}`}
              className="absolute inset-0 w-full h-full object-contain p-6 group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-20 h-20 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
              </svg>
            </div>
          )}
          
          {/* Fitment Badge */}
          {wheel.fitmentLabel && (
            <div className="absolute top-3 left-3">
              <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded-full font-semibold shadow-lg">
                {wheel.fitmentLabel}
              </span>
            </div>
          )}
          
          {/* Finish Badge */}
          {wheel.finish && finishConfig && (
            <div className="absolute top-3 right-3">
              <span className={`text-xs px-2 py-1 ${finishConfig.color} text-white rounded-full font-semibold shadow-lg`}>
                {finishConfig.label}
              </span>
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="p-4">
          <p className="text-white font-bold text-base leading-tight group-hover:text-red-400 transition-colors line-clamp-2 min-h-[2.5rem]">
            {wheel.brand} {wheel.model}
          </p>
          <p className="text-white/50 text-sm mt-1">{wheel.size}</p>
          
          <div className="mt-3 flex items-end justify-between">
            <div>
              <span className="text-white font-bold text-xl">{wheel.price}</span>
              <span className="text-white/40 text-xs ml-1">each</span>
            </div>
            {wheel.inStock && (
              <span className="text-xs text-green-500 font-medium">✓ In Stock</span>
            )}
          </div>
          
          {wheel.priceSet && (
            <p className="text-white/50 text-sm mt-1">{wheel.priceSet} / set of 4</p>
          )}
          
          {/* Compare Button */}
          {showCompare && onCompareToggle && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCompareToggle();
              }}
              className={`mt-3 w-full py-2 text-xs rounded-lg transition-all font-medium ${
                isComparing
                  ? "bg-blue-600 text-white"
                  : "bg-white/10 hover:bg-blue-600/50 text-white/70 hover:text-white"
              }`}
            >
              {isComparing ? "✓ Comparing" : "+ Compare"}
            </button>
          )}
        </div>
      </a>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARE PANEL v1
// ═══════════════════════════════════════════════════════════════════════════════

interface CompareItem {
  name: string;
  brand?: string;
  model?: string;
  price?: string;
  priceNum?: number;
  warranty?: string;
  terrain?: string;
  noiseLevel?: "quiet" | "moderate" | "loud";
  loadRange?: string;
  imageUrl?: string;
  productUrl?: string;
}

interface JakeCompareCardProps {
  items: CompareItem[];
  onRemove?: (index: number) => void;
  onClear?: () => void;
}

export function JakeCompareCard({ items, onRemove, onClear }: JakeCompareCardProps) {
  if (items.length < 2) return null;
  
  const compareFields = [
    { key: "price", label: "Price" },
    { key: "warranty", label: "Warranty" },
    { key: "terrain", label: "Type" },
    { key: "noiseLevel", label: "Road Noise" },
    { key: "loadRange", label: "Load Range" },
  ];
  
  return (
    <div className="bg-[#1a1a1a] border border-white/20 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-white font-bold">Compare ({items.length})</h3>
        {onClear && (
          <button onClick={onClear} className="text-white/50 hover:text-white text-sm">
            Clear All
          </button>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: `150px repeat(${items.length}, 1fr)` }}>
          {/* Header Row - Product Names */}
          <div className="p-3 bg-white/5"></div>
          {items.map((item, idx) => (
            <div key={idx} className="p-3 bg-white/5 text-center relative">
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name} className="w-16 h-16 mx-auto object-contain mb-2" />
              )}
              <p className="text-white text-sm font-semibold line-clamp-2">{item.brand} {item.model}</p>
              {onRemove && (
                <button
                  onClick={() => onRemove(idx)}
                  className="absolute top-2 right-2 w-5 h-5 bg-white/10 hover:bg-red-600 rounded-full flex items-center justify-center text-white/50 hover:text-white text-xs"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          
          {/* Compare Rows */}
          {compareFields.map((field) => (
            <React.Fragment key={field.key}>
              <div className="p-3 text-white/60 text-sm font-medium border-t border-white/10">
                {field.label}
              </div>
              {items.map((item, idx) => {
                const value = item[field.key as keyof CompareItem];
                let display = value || "—";
                
                if (field.key === "noiseLevel" && value) {
                  display = value === "quiet" ? "🔇 Quiet" : value === "moderate" ? "🔉 Moderate" : "🔊 Loud";
                }
                
                return (
                  <div key={idx} className="p-3 text-white text-sm text-center border-t border-white/10">
                    {String(display)}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIRE RESULTS GRID
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeTireGridProps {
  tires: ParsedProduct[];
  onTireClick?: (tire: ParsedProduct) => void;
  showCompare?: boolean;
  comparingItems?: ParsedProduct[];
  onCompareToggle?: (tire: ParsedProduct) => void;
}

export function JakeTireGrid({ tires, onTireClick, showCompare, comparingItems = [], onCompareToggle }: JakeTireGridProps) {
  if (tires.length === 0) return null;

  return (
    <div className="grid gap-3 mt-3">
      {tires.map((tire, idx) => (
        <JakeProductCard
          key={idx}
          product={tire}
          onClick={() => onTireClick?.(tire)}
          showCompare={showCompare}
          isComparing={comparingItems.some(c => c.name === tire.name)}
          onCompareToggle={() => onCompareToggle?.(tire)}
          compareDisabled={comparingItems.length >= 4 && !comparingItems.some(c => c.name === tire.name)}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL RESULTS GRID
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeWheelGridProps {
  wheels: Array<{
    brand: string;
    model: string;
    size: string;
    finish?: string;
    price: string;
    priceSet?: string;
    imageUrl?: string;
    productUrl: string;
    fitmentLabel?: string;
    inStock?: boolean;
    recommendationBadge?: RecommendationBadge;
  }>;
  onWheelClick?: (wheel: any) => void;
  showCompare?: boolean;
  comparingItems?: any[];
  onCompareToggle?: (wheel: any) => void;
}

export function JakeWheelGrid({ wheels, onWheelClick, showCompare, comparingItems = [], onCompareToggle }: JakeWheelGridProps) {
  if (wheels.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
      {wheels.map((wheel, idx) => (
        <JakeWheelCard
          key={idx}
          wheel={wheel}
          onClick={() => onWheelClick?.(wheel)}
          showCompare={showCompare}
          isComparing={comparingItems.some(c => c.model === wheel.model)}
          onCompareToggle={() => onCompareToggle?.(wheel)}
        />
      ))}
    </div>
  );
}

export default JakeProductCard;
