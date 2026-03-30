"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";

type CompactHeaderProps = {
  // Vehicle info
  year: string;
  make: string;
  model: string;
  displayTrim?: string;
  modification?: string;
  
  // Tire sizing
  selectedSize: string;
  availableSizes: string[];
  wheelDia?: string;
  wheelWidth?: string;
  basePath: string;
  sort: string;
  wheelSku?: string;
  
  // Wheel display info (from wheel selection)
  wheelName?: string;
  wheelImage?: string;
  wheelPrice?: number | null;
  wheelFinish?: string;
  
  // Flow context
  isPackageFlow?: boolean;
  isLiftedBuild?: boolean;
  liftedInches?: number;
  liftedPreset?: string;
  
  // Size URL builder params
  trim?: string;
  liftedParams?: string;
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function TirePageCompactHeader({
  year,
  make,
  model,
  displayTrim,
  modification,
  selectedSize,
  availableSizes,
  wheelDia,
  wheelWidth,
  basePath,
  sort,
  wheelSku,
  wheelName,
  wheelImage,
  wheelPrice,
  wheelFinish,
  isPackageFlow,
  isLiftedBuild,
  liftedInches,
  liftedPreset,
  trim,
  liftedParams = "",
}: CompactHeaderProps) {
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showGarage, setShowGarage] = useState(false);
  
  const wheelDiaNum = wheelDia ? parseFloat(wheelDia) : NaN;
  const wheelWidthNum = wheelWidth ? parseFloat(wheelWidth) : NaN;
  
  // Build wheel size string (e.g., "20x9")
  const wheelSizeDisplay = Number.isFinite(wheelDiaNum) && Number.isFinite(wheelWidthNum)
    ? `${Math.round(wheelDiaNum)}x${wheelWidthNum}`
    : Number.isFinite(wheelDiaNum)
      ? `${Math.round(wheelDiaNum)}"`
      : null;
  
  // Filter sizes to match wheel diameter if specified
  const filteredSizes = Number.isFinite(wheelDiaNum) 
    ? availableSizes.filter(s => {
        const m = s.match(/R(\d+)/i);
        return m && parseInt(m[1]) === Math.round(wheelDiaNum);
      })
    : availableSizes;
  
  const displaySizes = filteredSizes.length > 0 ? filteredSizes : availableSizes;
  
  return (
    <div className="space-y-3">
      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 1: Vehicle + Trust + Sort (all in one line)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border border-neutral-200 px-3 py-2">
        {/* Left: Vehicle info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-sm">✓</span>
            <span className="text-sm font-bold text-neutral-900">
              {year} {make} {model}
            </span>
            {displayTrim && (
              <span className="text-sm text-neutral-500">{displayTrim}</span>
            )}
          </div>
          
          {/* Verified fit badge */}
          <span className="hidden sm:inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
            Verified Fit
          </span>
          
          {/* Trust signals - compact */}
          <div className="hidden md:flex items-center gap-3 text-[11px] text-neutral-500 border-l border-neutral-200 pl-3">
            <span>✓ Free shipping</span>
            <span>✓ Install available</span>
          </div>
        </div>
        
        {/* Right: Garage + Sort */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGarage(!showGarage)}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
          >
            My Garage
            <svg className={`h-3 w-3 transition-transform ${showGarage ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <AutoSubmitSelect
            name="sort"
            defaultValue={sort}
            className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-xs font-semibold"
            options={[
              { value: "price_asc", label: "Price ↑" },
              { value: "price_desc", label: "Price ↓" },
              { value: "best", label: "Best Match" },
              { value: "brand_asc", label: "Brand A-Z" },
            ]}
          />
        </div>
      </div>
      
      {/* Collapsible Garage (hidden by default) */}
      {showGarage && (
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-sm">
          <div className="text-xs font-semibold text-neutral-500 mb-2">Saved Vehicles</div>
          <div className="text-neutral-600">
            {/* Garage content would go here */}
            <span className="text-neutral-400 italic">No saved vehicles yet</span>
          </div>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 2: Your Wheel Summary (package flow only) - Rich card with image
          ═══════════════════════════════════════════════════════════════════════ */}
      {isPackageFlow && wheelSku && (
        <div className="rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-3">
          <div className="flex items-center gap-3">
            {/* Wheel Image */}
            <div className="relative h-16 w-16 flex-shrink-0 rounded-lg bg-white border border-neutral-200 overflow-hidden">
              {wheelImage ? (
                <Image
                  src={wheelImage}
                  alt={wheelName || "Selected wheel"}
                  fill
                  className="object-contain p-1"
                  sizes="64px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl text-neutral-300">
                  ⚙️
                </div>
              )}
              {/* Checkmark overlay */}
              <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white shadow-sm">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            
            {/* Wheel Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">Your Wheels</span>
                <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white">Step 1 ✓</span>
              </div>
              <div className="mt-0.5 text-sm font-bold text-neutral-900 truncate">
                {wheelName || `Wheel ${wheelSku}`}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-neutral-600">
                {wheelSizeDisplay && (
                  <span className="font-medium">{wheelSizeDisplay}</span>
                )}
                {wheelFinish && (
                  <span className="text-neutral-500">{wheelFinish}</span>
                )}
                {wheelPrice && wheelPrice > 0 && (
                  <span className="font-bold text-green-700">
                    Wheels: {formatPrice(wheelPrice)}
                  </span>
                )}
              </div>
            </div>
            
            {/* Arrow indicator */}
            <div className="hidden sm:flex items-center gap-2 text-green-600">
              <span className="text-xs font-semibold">Step 2</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 3: Tire Size Selector with specs
          ═══════════════════════════════════════════════════════════════════════ */}
      {displaySizes.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Compact size display */}
            <button
              onClick={() => setShowSizeSelector(!showSizeSelector)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                showSizeSelector 
                  ? "bg-neutral-900 text-white" 
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              <span className="text-green-500">✓</span>
              <span>{selectedSize || displaySizes[0]}</span>
              {displaySizes.length > 1 && (
                <svg className={`h-3 w-3 transition-transform ${showSizeSelector ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            
            {/* Wheel diameter context */}
            {wheelDia && (
              <span className="text-xs text-neutral-500">
                for {Math.round(parseFloat(wheelDia))}" wheels
              </span>
            )}
            
            {/* Lifted badge */}
            {isLiftedBuild && liftedInches && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {liftedInches}" Lift
              </span>
            )}
          </div>
          
          {/* Reassurance text when in package flow */}
          {isPackageFlow && wheelSku && (
            <p className="text-[11px] text-green-700 pl-1">
              ✓ Matched to your selected {wheelSizeDisplay ? `${wheelSizeDisplay} ` : ""}wheels
            </p>
          )}
        </div>
      )}
      
      {/* Expanded size selector */}
      {showSizeSelector && displaySizes.length > 1 && (
        <div className="flex flex-wrap gap-1.5 rounded-lg bg-neutral-50 border border-neutral-200 p-2">
          {displaySizes.map((s) => {
            const active = s === selectedSize;
            const href = `${basePath}?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}${wheelSku ? `&wheelSku=${encodeURIComponent(wheelSku)}` : ""}${wheelDia ? `&wheelDia=${encodeURIComponent(wheelDia)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}&size=${encodeURIComponent(s)}${liftedParams}`;
            
            return (
              <Link
                key={s}
                href={href}
                onClick={() => setShowSizeSelector(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-400"
                }`}
              >
                {s}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
