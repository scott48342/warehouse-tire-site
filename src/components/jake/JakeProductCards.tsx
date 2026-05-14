"use client";

import React, { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ParsedProduct {
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
}

interface PackageSummary {
  tire?: ParsedProduct;
  wheel?: ParsedProduct;
  totalPrice?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIRE CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeProductCardProps {
  product: ParsedProduct;
  onClick?: () => void;
  showCompare?: boolean;
  isComparing?: boolean;
  onCompareToggle?: () => void;
  compareDisabled?: boolean;
  isLocal?: boolean; // Local site shows out-the-door pricing
  installCostPerTire?: number; // Installation cost per tire (default $25)
  taxRate?: number; // Sales tax rate (default 6% for Michigan)
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
  // Includes: tires + installation + tax
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
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
          <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
        </svg>
      ) : (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <a
      href={product.productUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="block bg-[#1a1a1a] hover:bg-[#222] border border-white/10 hover:border-white/20 rounded-lg overflow-hidden transition-all group"
    >
      <div className="flex gap-3 p-3">
        {/* Image */}
        <div className="w-16 h-16 bg-white/5 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
          {product.imageUrl && !imgError ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              width={64}
              height={64}
              className="object-contain w-full h-full"
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
              <p className="text-white font-semibold text-sm leading-tight group-hover:text-red-400 transition-colors line-clamp-2">
                {product.brand} {product.model}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {product.size && (
                  <span className="text-white/50 text-xs">{product.size}</span>
                )}
                {product.terrain && (
                  <span className="text-xs px-1.5 py-0.5 bg-white/10 rounded text-white/60">
                    {product.terrain}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              {showOutTheDoor ? (
                <>
                  <p className="text-white font-bold text-sm">${outTheDoorPrice.toFixed(0)} installed</p>
                  <p className="text-white/40 text-xs">set of 4, out the door</p>
                </>
              ) : (
                <>
                  <p className="text-white font-bold text-sm">{product.price}</p>
                  {product.setPrice && (
                    <p className="text-white/40 text-xs">{product.setPrice}/set</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {product.warranty && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {product.warranty}
              </span>
            )}
            {product.fitmentLabel && (
              <span className="text-xs text-blue-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {product.fitmentLabel}
              </span>
            )}
            {product.inStock && (
              <span className="text-xs text-green-500">In Stock</span>
            )}
            {/* Compare Button */}
            {showCompare && onCompareToggle && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCompareToggle();
                }}
                disabled={compareDisabled && !isComparing}
                className={`px-2 py-0.5 text-xs rounded transition-all ${
                  isComparing
                    ? "bg-blue-600 text-white"
                    : compareDisabled
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : "bg-white/10 hover:bg-blue-600/50 text-white/70 hover:text-white"
                }`}
              >
                {isComparing ? "✓ Compare" : "+ Compare"}
              </button>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center text-white/30 group-hover:text-red-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </a>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface JakePackageCardProps {
  packageSummary: PackageSummary;
  cartUrl?: string;
  onCheckout?: () => void;
}

export function JakePackageCard({ packageSummary, cartUrl, onCheckout }: JakePackageCardProps) {
  const { tire, wheel, totalPrice } = packageSummary;

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-white/20 rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-white font-bold text-sm uppercase tracking-wide">Your Package</span>
        </div>

        <div className="space-y-3">
          {/* Wheel */}
          {wheel && (
            <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
              <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center">
                <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                  <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{wheel.brand} {wheel.model}</p>
                <p className="text-white/50 text-xs">{wheel.size} • {wheel.finish || "Wheel"}</p>
              </div>
              <div className="text-right">
                <p className="text-white font-semibold text-sm">{wheel.price}</p>
                <p className="text-white/40 text-xs">×4</p>
              </div>
            </div>
          )}

          {/* Tire */}
          {tire && (
            <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
              <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center">
                <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                  <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{tire.brand} {tire.model}</p>
                <p className="text-white/50 text-xs">{tire.size}</p>
              </div>
              <div className="text-right">
                <p className="text-white font-semibold text-sm">{tire.price}</p>
                <p className="text-white/40 text-xs">×4</p>
              </div>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">Package Total</span>
            <span className="text-white font-bold text-xl">{totalPrice}</span>
          </div>
        </div>

        {/* CTA */}
        {cartUrl && (
          <a
            href={cartUrl}
            onClick={onCheckout}
            className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Checkout Now
          </a>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL CARD (Standalone)
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
  };
  onClick?: () => void;
}

export function JakeWheelCard({ wheel, onClick }: JakeWheelCardProps) {
  const [imgError, setImgError] = useState(false);
  
  return (
    <a
      href={wheel.productUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="block bg-[#1a1a1a] hover:bg-[#222] border border-white/10 hover:border-white/20 rounded-lg overflow-hidden transition-all group"
    >
      <div className="aspect-square relative bg-gradient-to-br from-white/5 to-white/0">
        {wheel.imageUrl && !imgError ? (
          <img
            src={wheel.imageUrl}
            alt={`${wheel.brand} ${wheel.model}`}
            className="absolute inset-0 w-full h-full object-contain p-4"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-16 h-16 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
              <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
            </svg>
          </div>
        )}
        {wheel.fitmentLabel && (
          <div className="absolute top-2 left-2">
            <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded font-medium">
              {wheel.fitmentLabel}
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-white font-semibold text-sm leading-tight group-hover:text-red-400 transition-colors line-clamp-2 min-h-[2.5rem]">
          {wheel.brand} {wheel.model}
        </p>
        <p className="text-white/50 text-xs mt-0.5">{wheel.size} • {wheel.finish || "Custom"}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-white font-bold">{wheel.price}</span>
          <span className="text-white/40 text-xs">each</span>
        </div>
        {wheel.priceSet && (
          <p className="text-white/50 text-xs">{wheel.priceSet} / set of 4</p>
        )}
      </div>
    </a>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIRE RESULTS GRID
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeTireGridProps {
  tires: ParsedProduct[];
  onTireClick?: (tire: ParsedProduct) => void;
}

export function JakeTireGrid({ tires, onTireClick }: JakeTireGridProps) {
  if (tires.length === 0) return null;

  return (
    <div className="grid gap-2 mt-3">
      {tires.map((tire, idx) => (
        <JakeProductCard
          key={idx}
          product={tire}
          onClick={() => onTireClick?.(tire)}
        />
      ))}
    </div>
  );
}

export default JakeProductCard;
