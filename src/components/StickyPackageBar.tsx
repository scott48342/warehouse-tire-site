"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";

type PackageBarProps = {
  wheelSku?: string;
  wheelBrand?: string;
  wheelModel?: string;
  wheelPrice?: number;
  wheelImage?: string;
  tireSku?: string;
  tireBrand?: string;
  tireModel?: string;
  tirePrice?: number;
  tireSize?: string;
  tireCount?: number;
};

function formatPrice(price: number): string {
  return price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * StickyPackageBar - Lightweight sticky bottom bar showing package progress
 * 
 * Shows: selected wheel (if any), selected tire count, estimated total, CTA
 * Designed to replace the cramped right sidebar on tire listing page.
 */
export function StickyPackageBar({
  wheelSku,
  wheelBrand,
  wheelModel,
  wheelPrice,
  wheelImage,
  tireSku,
  tireBrand,
  tireModel,
  tirePrice,
  tireSize,
  tireCount = 4,
}: PackageBarProps) {
  const { getTotal, hasWheels, hasTires } = useCart();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Show bar when there's something to show (wheels selected)
  const isVisible = wheelSku || hasWheels();
  
  if (!isVisible) return null;
  
  const total = getTotal();
  const wheelTotal = wheelPrice || 0;
  const tireTotal = (tirePrice || 0) * tireCount;
  const packageTotal = wheelTotal + tireTotal;
  const isComplete = !!(wheelSku && tireSku) || (hasWheels() && hasTires());
  
  return (
    <>
      {/* Spacer to prevent content from being hidden behind sticky bar */}
      <div className="h-20 lg:h-24" />
      
      {/* Sticky Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        {/* Expanded detail view */}
        {isExpanded && (
          <div className="border-t border-neutral-200 bg-white px-4 py-4 shadow-2xl lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Wheels */}
                  <div className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3">
                    {wheelImage ? (
                      <img 
                        src={wheelImage} 
                        alt={wheelModel || "Wheel"} 
                        className="h-12 w-12 rounded-lg object-contain bg-white border border-neutral-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white border border-neutral-200 text-2xl text-neutral-300">
                        ⚙️
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-green-600">
                        ✓ Wheels (4)
                      </div>
                      <div className="text-sm font-bold text-neutral-900 truncate">
                        {wheelBrand} {wheelModel}
                      </div>
                      {wheelPrice && wheelPrice > 0 && (
                        <div className="text-sm font-semibold text-neutral-600">
                          ${formatPrice(wheelPrice)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Tires */}
                  <div className={`flex items-center gap-3 rounded-xl p-3 ${
                    tireSku 
                      ? "bg-green-50" 
                      : "bg-amber-50 border border-dashed border-amber-200"
                  }`}>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg border text-2xl ${
                      tireSku
                        ? "bg-white border-green-200 text-neutral-700"
                        : "bg-white border-amber-200 text-neutral-300"
                    }`}>
                      🛞
                    </div>
                    <div className="min-w-0 flex-1">
                      {tireSku ? (
                        <>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-green-600">
                            ✓ Tires ({tireCount})
                          </div>
                          <div className="text-sm font-bold text-neutral-900 truncate">
                            {tireBrand} {tireModel}
                          </div>
                          {tirePrice && tirePrice > 0 && (
                            <div className="text-sm font-semibold text-neutral-600">
                              ${formatPrice(tireTotal)}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                            Select Tires
                          </div>
                          <div className="text-sm text-neutral-600">
                            Choose tires below to complete package
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Collapse button */}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="hidden lg:flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Compact bar */}
        <div className={`border-t bg-white shadow-2xl ${
          isComplete 
            ? "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50" 
            : "border-neutral-200"
        }`}>
          <div className="mx-auto max-w-7xl px-4 py-3 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Package summary */}
              <div className="flex items-center gap-4 min-w-0 flex-1">
                {/* Package icon + progress */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="hidden sm:flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-black/5 transition-colors"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${
                    isComplete ? "bg-green-500" : "bg-neutral-800"
                  }`}>
                    {isComplete ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-lg">📦</span>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-neutral-900">
                      {isComplete ? "Package Complete" : "Building Package"}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {wheelSku && !tireSku && "Wheels selected • Select tires"}
                      {wheelSku && tireSku && "Wheels + Tires selected"}
                    </div>
                  </div>
                  <svg className={`h-4 w-4 text-neutral-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                
                {/* Mobile: simpler view */}
                <div className="sm:hidden flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${
                    isComplete ? "bg-green-500" : "bg-neutral-800"
                  }`}>
                    {isComplete ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-sm">📦</span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900">
                      {isComplete ? "Complete" : "Building"}
                    </div>
                  </div>
                </div>
                
                {/* Trust signals - desktop only */}
                <div className="hidden lg:flex items-center gap-4 text-xs text-neutral-500 border-l border-neutral-200 pl-4">
                  <span className="flex items-center gap-1">
                    <span className="text-green-600">✓</span>
                    Free Shipping
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-green-600">✓</span>
                    Fitment Guaranteed
                  </span>
                </div>
              </div>
              
              {/* Center: Total */}
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Est. Total
                </div>
                <div className="text-xl font-extrabold text-neutral-900 lg:text-2xl">
                  ${formatPrice(total > 0 ? total : packageTotal)}
                </div>
              </div>
              
              {/* Right: CTA */}
              {isComplete ? (
                <Link
                  href="/cart"
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 text-sm font-extrabold text-white shadow-lg shadow-green-600/30 transition-all hover:bg-green-700 hover:shadow-xl active:scale-[0.98] lg:h-14 lg:px-8 lg:text-base"
                >
                  <span className="hidden sm:inline">Review Package</span>
                  <span className="sm:hidden">Review</span>
                  <svg className="h-4 w-4 lg:h-5 lg:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              ) : (
                <div className="rounded-xl bg-neutral-100 px-4 py-3 lg:px-6">
                  <div className="text-xs font-semibold text-neutral-600 lg:text-sm">
                    <span className="hidden sm:inline">Select tires to continue</span>
                    <span className="sm:hidden">Add tires ↓</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Inline package summary - shown above the grid as alternative
 * Use when sticky bar feels too intrusive
 */
export function InlinePackageSummary({
  wheelBrand,
  wheelModel,
  wheelPrice,
  wheelImage,
  tireBrand,
  tireModel,
  tirePrice,
  tireCount = 4,
  hasSelection,
}: {
  wheelBrand?: string;
  wheelModel?: string;
  wheelPrice?: number;
  wheelImage?: string;
  tireBrand?: string;
  tireModel?: string;
  tirePrice?: number;
  tireCount?: number;
  hasSelection: boolean;
}) {
  const wheelTotal = wheelPrice || 0;
  const tireTotal = (tirePrice || 0) * tireCount;
  const total = wheelTotal + tireTotal;
  
  if (!wheelBrand) return null;
  
  return (
    <div className={`rounded-xl border p-3 mb-4 ${
      hasSelection 
        ? "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50" 
        : "border-neutral-200 bg-white"
    }`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {wheelImage && (
            <img 
              src={wheelImage} 
              alt={wheelModel} 
              className="h-10 w-10 rounded-lg object-contain bg-white border border-neutral-200"
            />
          )}
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="text-green-600">✓</span>
              <span className="font-semibold">{wheelBrand} Wheels</span>
            </span>
            {tireBrand && (
              <span className="flex items-center gap-1">
                <span className="text-green-600">✓</span>
                <span className="font-semibold">{tireBrand} Tires</span>
              </span>
            )}
            {!tireBrand && (
              <span className="text-amber-600 font-medium">Select tires below ↓</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-neutral-500">Package</div>
            <div className="text-lg font-extrabold">${formatPrice(total)}</div>
          </div>
          {hasSelection && (
            <Link
              href="/cart"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
            >
              Continue →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
