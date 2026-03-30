"use client";

import { useState } from "react";
import Link from "next/link";
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
  basePath: string;
  sort: string;
  wheelSku?: string;
  
  // Flow context
  isPackageFlow?: boolean;
  isLiftedBuild?: boolean;
  liftedInches?: number;
  liftedPreset?: string;
  
  // Size URL builder params
  trim?: string;
  liftedParams?: string;
};

export function TirePageCompactHeader({
  year,
  make,
  model,
  displayTrim,
  modification,
  selectedSize,
  availableSizes,
  wheelDia,
  basePath,
  sort,
  wheelSku,
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
  
  // Filter sizes to match wheel diameter if specified
  const filteredSizes = Number.isFinite(wheelDiaNum) 
    ? availableSizes.filter(s => {
        const m = s.match(/R(\d+)/i);
        return m && parseInt(m[1]) === Math.round(wheelDiaNum);
      })
    : availableSizes;
  
  const displaySizes = filteredSizes.length > 0 ? filteredSizes : availableSizes;
  
  return (
    <div className="space-y-2">
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
          ROW 2: Tire Size Selector (compact)
          ═══════════════════════════════════════════════════════════════════════ */}
      {displaySizes.length > 0 && (
        <div className="flex items-center gap-2">
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
          
          {wheelDia && (
            <span className="text-xs text-neutral-500">
              for {Math.round(parseFloat(wheelDia))}" wheels
            </span>
          )}
          
          {isLiftedBuild && liftedInches && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {liftedInches}" Lift
            </span>
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
      
      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 3: Wheel context (compact inline, only in package flow)
          ═══════════════════════════════════════════════════════════════════════ */}
      {isPackageFlow && wheelSku && (
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-green-700">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">✓</span>
            Wheels selected
          </span>
          <span className="text-neutral-400">→</span>
          <span className="font-semibold text-neutral-900">Now choose tires</span>
        </div>
      )}
    </div>
  );
}
