"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { WheelsStyleCard, type WheelFinishThumb, type WheelPair } from "./WheelsStyleCard";
import { type DBProfileForAccessories } from "@/hooks/useAccessoryFitment";
import { TPMS_SET_PRICE_ESTIMATE, MOUNT_BALANCE_ESTIMATE } from "@/lib/pricing/accessoryEstimates";
import { FitmentDiameterChips, type DiameterOption } from "./FitmentDiameterChips";
import { useCart, type CartWheelItem } from "@/lib/cart/CartContext";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
export type WheelItem = {
  sku?: string;
  brand?: string;
  brandCode?: string;
  model?: string;
  finish?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  centerbore?: string;
  imageUrl?: string;
  price?: number;
  stockQty?: number;
  inventoryType?: string;
  styleKey?: string;
  fitmentClass?: "surefit" | "specfit" | "extended";
  finishThumbs?: WheelFinishThumb[];
  pair?: WheelPair;
  boltPattern?: string;
};

export type SelectedWheel = {
  sku: string;
  rearSku?: string; // For staggered setups
  brand: string;
  model: string;
  finish?: string;
  diameter?: string;
  width?: string;
  rearWidth?: string;
  offset?: string;
  rearOffset?: string;
  boltPattern?: string;
  imageUrl?: string;
  price?: number;
  setPrice: number;
  fitmentClass?: string;
  staggered?: boolean;
};

type ViewParams = {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  modification?: string;
  sort?: string;
  page?: string;
  liftedSource?: string;
  liftedPreset?: string;
  liftedInches?: string;
  liftedTireSizes?: string;
  liftedTireDiaMin?: string;
  liftedTireDiaMax?: string;
};

type WheelsGridProps = {
  wheels: WheelItem[];
  viewParams: ViewParams;
  dbProfile?: DBProfileForAccessories | null;
  diameterParam?: string;
  widthParam?: string;
  showRecommended?: boolean;
  recommendedWheels?: WheelItem[];
  /** Fitment-valid diameter options */
  fitmentDiameters?: DiameterOption[];
  /** Is this a classic vehicle */
  isClassicVehicle?: boolean;
  /** Is this a lifted build */
  isLiftedBuild?: boolean;
  /** Stock wheel diameter */
  stockDiameter?: number | null;
  /** Show diameter chips */
  showDiameterChips?: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUCCESS ANIMATION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function SuccessCheckmark({ show }: { show: boolean }) {
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="animate-success-pop flex h-24 w-24 items-center justify-center rounded-full bg-green-500 shadow-2xl shadow-green-500/50">
        <svg 
          className="h-12 w-12 text-white animate-success-check" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={3} 
            d="M5 13l4 4L19 7" 
          />
        </svg>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTION CONFIRMATION BLOCK
// ═══════════════════════════════════════════════════════════════════════════════
function SelectionConfirmation({ 
  wheel, 
  tiresHref,
  onClear,
  onAddToCart,
  isAddingToCart,
}: { 
  wheel: SelectedWheel;
  tiresHref: string;
  onClear: () => void;
  onAddToCart: () => void;
  isAddingToCart: boolean;
}) {
  return (
    <div className="animate-slide-up rounded-2xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4 shadow-lg shadow-green-100/50">
      <div className="flex items-start gap-4">
        {/* Checkmark */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500 text-white shadow-lg shadow-green-500/30">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-green-800">Wheel Selected</span>
            {wheel.staggered && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                Staggered Setup
              </span>
            )}
          </div>
          
          <div className="mt-1 flex items-center gap-3">
            {wheel.imageUrl && (
              <img 
                src={wheel.imageUrl} 
                alt={wheel.model} 
                className="h-14 w-14 rounded-lg object-contain bg-white border border-green-100"
              />
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-neutral-900 truncate">
                {wheel.brand} {wheel.model}
              </div>
              <div className="text-xs text-neutral-600">
                {wheel.staggered ? (
                  <>
                    F: {wheel.diameter}&quot; × {wheel.width}&quot; • R: {wheel.diameter}&quot; × {wheel.rearWidth}&quot;
                  </>
                ) : (
                  <>
                    {wheel.diameter && `${wheel.diameter}"`}
                    {wheel.diameter && wheel.width && " × "}
                    {wheel.width && `${wheel.width}"`}
                  </>
                )}
                {wheel.finish && ` • ${wheel.finish}`}
              </div>
              <div className="mt-0.5 text-sm font-extrabold text-green-700">
                ${wheel.setPrice.toLocaleString()} for 4
              </div>
            </div>
          </div>
          
          {/* What's next options */}
          <div className="mt-4 space-y-3">
            {/* Option 1: Complete Package (Wheels + Tires) - RECOMMENDED */}
            <div className="rounded-xl border-2 border-green-300 bg-white p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  RECOMMENDED
                </span>
                <span className="text-xs text-neutral-600">Save time with matched tires</span>
              </div>
              <Link
                href={tiresHref}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 text-sm font-extrabold text-white shadow-lg shadow-green-600/30 transition-all hover:bg-green-700 hover:shadow-xl active:scale-[0.98]"
              >
                Build Complete Package
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <p className="mt-2 text-[11px] text-neutral-500 text-center">
                We&apos;ll show tires that fit these wheels perfectly
              </p>
            </div>
            
            {/* Option 2: Wheels Only */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-neutral-600">Already have tires?</span>
              </div>
              <button
                onClick={onAddToCart}
                disabled={isAddingToCart}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-neutral-300 bg-white text-sm font-bold text-neutral-700 transition-all hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.98] disabled:opacity-60"
              >
                {isAddingToCart ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Adding...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Add Wheels Only to Cart
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Change selection link */}
          <div className="mt-3 text-center">
            <button
              onClick={onClear}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              ← Change wheel selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE STICKY BAR
// ═══════════════════════════════════════════════════════════════════════════════
function MobileStickyBar({ 
  wheel, 
  tiresHref,
  isVisible,
  onAddToCart,
  isAddingToCart,
}: { 
  wheel: SelectedWheel | null;
  tiresHref: string;
  isVisible: boolean;
  onAddToCart: () => void;
  isAddingToCart: boolean;
}) {
  if (!wheel || !isVisible) return null;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden animate-slide-up">
      <div className="border-t border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 shadow-2xl shadow-green-900/20">
        <div className="space-y-2">
          {/* Wheel info row */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-500 text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-neutral-900 truncate">
                {wheel.brand} {wheel.model}
              </div>
              <div className="text-xs font-extrabold text-green-700">
                ${wheel.setPrice.toLocaleString()} for 4 wheels
              </div>
            </div>
          </div>
          
          {/* CTA buttons row */}
          <div className="flex gap-2">
            <Link
              href={tiresHref}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 text-sm font-extrabold text-white shadow-lg shadow-green-600/30"
            >
              + Tires
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <button
              onClick={onAddToCart}
              disabled={isAddingToCart}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-neutral-300 bg-white text-sm font-bold text-neutral-700 disabled:opacity-60"
            >
              {isAddingToCart ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Wheels Only
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC PACKAGE ESTIMATE
// ═══════════════════════════════════════════════════════════════════════════════
function PackageEstimate({ 
  wheelSetPrice, 
  isSelected 
}: { 
  wheelSetPrice: number | null;
  isSelected: boolean;
}) {
  // Estimate tire price range
  // Tire price range estimates
  const tireEstimateMin = 600; // ~$150/tire
  const tireEstimateMax = 1200; // ~$300/tire
  // Accessory estimates from centralized pricing
  const tpmsEstimate = TPMS_SET_PRICE_ESTIMATE;
  const installEstimate = MOUNT_BALANCE_ESTIMATE;
  
  if (wheelSetPrice === null) {
    return (
      <div className="rounded-xl bg-neutral-100 px-4 py-3">
        <div className="text-xs font-semibold text-neutral-500">Typical Package Estimate</div>
        <div className="text-lg font-extrabold text-neutral-700">
          $2,500 – $4,500
        </div>
        <div className="text-[11px] text-neutral-500">Wheels + tires + install</div>
      </div>
    );
  }
  
  const minPackage = wheelSetPrice + tireEstimateMin + tpmsEstimate + installEstimate;
  const maxPackage = wheelSetPrice + tireEstimateMax + tpmsEstimate + installEstimate;
  
  // Round to nearest $50
  const minRounded = Math.round(minPackage / 50) * 50;
  const maxRounded = Math.round(maxPackage / 50) * 50;
  
  return (
    <div className={`rounded-xl px-4 py-3 transition-all duration-300 ${
      isSelected 
        ? "bg-green-50 border border-green-200" 
        : "bg-neutral-100"
    }`}>
      <div className={`text-xs font-semibold ${isSelected ? "text-green-700" : "text-neutral-500"}`}>
        {isSelected ? "Your Package Estimate" : "Typical Package Estimate"}
      </div>
      <div className={`text-lg font-extrabold transition-colors ${
        isSelected ? "text-green-800" : "text-neutral-700"
      }`}>
        ${minRounded.toLocaleString()} – ${maxRounded.toLocaleString()}
      </div>
      <div className={`text-[11px] ${isSelected ? "text-green-600" : "text-neutral-500"}`}>
        {isSelected 
          ? `Wheels $${wheelSetPrice.toLocaleString()} + tires + install` 
          : "Wheels + tires + install"
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function WheelsGridWithSelection({
  wheels,
  viewParams,
  dbProfile,
  diameterParam,
  widthParam,
  showRecommended = false,
  recommendedWheels = [],
  fitmentDiameters = [],
  isClassicVehicle = false,
  isLiftedBuild = false,
  stockDiameter = null,
  showDiameterChips = true,
}: WheelsGridProps) {
  const [selectedWheel, setSelectedWheel] = useState<SelectedWheel | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showMobileBar, setShowMobileBar] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  
  // Cart context
  const { addItem, setIsOpen: setCartOpen } = useCart();
  
  // Build tires href with wheel context
  const tiresHref = (() => {
    const params = new URLSearchParams();
    if (viewParams.year) params.set("year", viewParams.year);
    if (viewParams.make) params.set("make", viewParams.make);
    if (viewParams.model) params.set("model", viewParams.model);
    if (viewParams.modification) params.set("modification", viewParams.modification);
    
    // Pass wheel specs for tire matching
    if (selectedWheel?.sku) params.set("wheelSku", selectedWheel.sku);
    if (selectedWheel?.diameter) params.set("wheelDia", selectedWheel.diameter);
    if (selectedWheel?.width) params.set("wheelWidth", selectedWheel.width);
    if (selectedWheel?.offset) params.set("wheelOffset", selectedWheel.offset);
    
    // Pass wheel display info for tire page summary
    if (selectedWheel?.brand && selectedWheel?.model) {
      params.set("wheelName", `${selectedWheel.brand} ${selectedWheel.model}`);
    }
    if (selectedWheel?.imageUrl) params.set("wheelImage", selectedWheel.imageUrl);
    if (selectedWheel?.setPrice) params.set("wheelPrice", String(selectedWheel.setPrice));
    if (selectedWheel?.finish) params.set("wheelFinish", selectedWheel.finish);
    
    // Pass lifted context if present
    if (viewParams.liftedSource) params.set("liftedSource", viewParams.liftedSource);
    if (viewParams.liftedPreset) params.set("liftedPreset", viewParams.liftedPreset);
    if (viewParams.liftedInches) params.set("liftedInches", viewParams.liftedInches);
    if (viewParams.liftedTireSizes) params.set("liftedTireSizes", viewParams.liftedTireSizes);
    
    const qs = params.toString();
    return `/tires${qs ? `?${qs}` : ""}`;
  })();
  
  // Handle wheel selection
  const handleWheelSelect = useCallback((wheel: SelectedWheel) => {
    setSelectedWheel(wheel);
    setShowSuccessAnimation(true);
    
    // Hide success animation after delay
    setTimeout(() => {
      setShowSuccessAnimation(false);
    }, 800);
    
    // Show mobile bar after short delay
    setTimeout(() => {
      setShowMobileBar(true);
    }, 300);
    
    // Scroll to confirmation on mobile
    setTimeout(() => {
      if (confirmationRef.current && window.innerWidth < 768) {
        confirmationRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }, []);
  
  const handleClearSelection = useCallback(() => {
    setSelectedWheel(null);
    setShowMobileBar(false);
  }, []);
  
  // Add wheels only to cart
  const handleAddWheelsToCart = useCallback(() => {
    if (!selectedWheel) return;
    
    setIsAddingToCart(true);
    
    // Build the cart item
    const cartItem: CartWheelItem = {
      type: "wheel",
      sku: selectedWheel.sku,
      rearSku: selectedWheel.rearSku,
      brand: selectedWheel.brand,
      model: selectedWheel.model,
      finish: selectedWheel.finish,
      diameter: selectedWheel.diameter,
      width: selectedWheel.width,
      rearWidth: selectedWheel.rearWidth,
      offset: selectedWheel.offset,
      rearOffset: selectedWheel.rearOffset,
      boltPattern: selectedWheel.boltPattern,
      imageUrl: selectedWheel.imageUrl,
      unitPrice: selectedWheel.price || (selectedWheel.setPrice / 4),
      quantity: 4,
      fitmentClass: selectedWheel.fitmentClass as "surefit" | "specfit" | "extended" | undefined,
      vehicle: viewParams.year && viewParams.make && viewParams.model ? {
        year: viewParams.year,
        make: viewParams.make,
        model: viewParams.model,
        trim: viewParams.trim,
        modification: viewParams.modification,
      } : undefined,
      staggered: selectedWheel.staggered,
    };
    
    // Add to cart
    addItem(cartItem);
    
    // Show cart drawer after short delay
    setTimeout(() => {
      setIsAddingToCart(false);
      setCartOpen(true);
      // Clear selection since item is now in cart
      setSelectedWheel(null);
      setShowMobileBar(false);
    }, 300);
  }, [selectedWheel, viewParams, addItem, setCartOpen]);
  
  // Track scroll for mobile bar visibility
  useEffect(() => {
    if (!selectedWheel) return;
    
    const handleScroll = () => {
      // Show mobile bar when scrolled past selection
      if (confirmationRef.current) {
        const rect = confirmationRef.current.getBoundingClientRect();
        setShowMobileBar(rect.bottom < 0);
      }
    };
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [selectedWheel]);
  
  // Render wheel card with selection state
  const renderWheelCard = (w: WheelItem, idx: number, isRecommended = false) => {
    const isSelected = selectedWheel?.sku === w.sku;
    const brand = typeof w.brand === "string" ? w.brand : w.brand != null ? String(w.brand) : (w.brandCode || "Wheel");
    const model = typeof w.model === "string" ? w.model : w.model != null ? String(w.model) : w.sku || "Wheel";
    
    return (
      <div 
        key={`${isRecommended ? "rec-" : ""}${w.sku || idx}`}
        className={`relative transition-all duration-300 ${
          isSelected 
            ? "ring-2 ring-green-500 ring-offset-2 rounded-2xl scale-[1.02]" 
            : selectedWheel 
              ? "opacity-75 hover:opacity-100" 
              : ""
        }`}
      >
        {/* Selected badge */}
        {isSelected && (
          <div className="absolute -top-2 -right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white shadow-lg animate-bounce-once">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        
        <WheelsStyleCard
          brand={brand}
          title={model}
          baseSku={String(w.sku || "")}
          baseFinish={w.finish ? String(w.finish) : undefined}
          baseImageUrl={w.imageUrl}
          price={w.price}
          stockQty={w.stockQty}
          inventoryType={w.inventoryType}
          sizeLabel={
            diameterParam || widthParam
              ? { diameter: diameterParam || w.diameter, width: widthParam || w.width }
              : w.diameter || w.width
                ? { diameter: w.diameter, width: w.width }
                : undefined
          }
          pair={w.pair}
          specLabel={{
            boltPattern: w.boltPattern,
            offset: w.offset,
          }}
          finishThumbs={w.finishThumbs}
          fitmentClass={w.fitmentClass}
          isPopular={isRecommended && (idx === 0 || idx === 1)}
          viewParams={viewParams}
          dbProfile={dbProfile}
          wheelCenterBore={w.centerbore ? Number(w.centerbore) : undefined}
          // Selection props
          isSelected={isSelected}
          hasSelection={!!selectedWheel}
          onSelect={(wheelState) => {
            // Use current card state (may have changed if user selected a different finish)
            const effectivePrice = wheelState?.price ?? w.price;
            const setPrice = typeof effectivePrice === "number" ? effectivePrice * 4 : 0;
            
            // Extract staggered info from pair if available
            const isStaggered = w.pair?.staggered || false;
            const rearSku = isStaggered && w.pair?.rear?.sku ? w.pair.rear.sku : undefined;
            const rearWidth = isStaggered && w.pair?.rear?.width ? w.pair.rear.width : undefined;
            const rearOffset = isStaggered && w.pair?.rear?.offset ? w.pair.rear.offset : undefined;
            
            handleWheelSelect({
              sku: wheelState?.sku || String(w.sku || ""),
              rearSku,
              brand,
              model,
              finish: wheelState?.finish ?? w.finish,
              diameter: w.diameter,
              width: w.width,
              rearWidth,
              offset: w.offset,
              rearOffset,
              boltPattern: w.boltPattern,
              imageUrl: wheelState?.imageUrl ?? w.imageUrl,
              price: effectivePrice,
              setPrice,
              fitmentClass: w.fitmentClass,
              staggered: isStaggered,
            });
          }}
        />
      </div>
    );
  };
  
  return (
    <>
      {/* Success Animation Overlay */}
      <SuccessCheckmark show={showSuccessAnimation} />
      
      {/* Selection Confirmation - sticky on desktop */}
      {selectedWheel && (
        <div 
          ref={confirmationRef}
          className="sticky top-20 z-40 mb-4"
        >
          <SelectionConfirmation
            wheel={selectedWheel}
            tiresHref={tiresHref}
            onClear={handleClearSelection}
            onAddToCart={handleAddWheelsToCart}
            isAddingToCart={isAddingToCart}
          />
        </div>
      )}
      
      {/* Package Estimate - updates dynamically */}
      <div className="mb-4">
        <PackageEstimate 
          wheelSetPrice={selectedWheel?.setPrice ?? null}
          isSelected={!!selectedWheel}
        />
      </div>
      
      {/* Fitment Diameter Chips - positioned below estimate, above Top Picks */}
      {showDiameterChips && fitmentDiameters.length > 0 && viewParams.year && viewParams.make && viewParams.model && (
        <div className="mb-4">
          <FitmentDiameterChips
            diameters={fitmentDiameters}
            selectedDiameter={diameterParam ? parseInt(diameterParam, 10) : null}
            isClassicVehicle={isClassicVehicle}
            isLiftedBuild={isLiftedBuild}
            stockDiameter={stockDiameter ?? undefined}
            showCounts={true}
          />
        </div>
      )}
      
      {/* Recommended Wheels */}
      {showRecommended && recommendedWheels.length > 0 && (
        <div className="mb-6 rounded-2xl bg-gradient-to-b from-slate-50/80 to-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <div>
                <h2 className="text-base font-extrabold text-neutral-900">
                  Top Picks for Your {viewParams.year} {viewParams.make} {viewParams.model}
                </h2>
                <p className="text-xs text-neutral-500">
                  Hand-picked based on fitment, popularity, and value
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recommendedWheels.slice(0, 4).map((w, idx) => renderWheelCard(w, idx, true))}
          </div>
        </div>
      )}
      
      {/* All Wheels Header */}
      {showRecommended && recommendedWheels.length > 0 && (
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-extrabold text-neutral-900">All Wheels</h3>
          <span className="text-xs text-neutral-500">{wheels.length} styles that fit</span>
        </div>
      )}
      
      {/* Main Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {wheels.length ? (
          wheels.map((w, idx) => renderWheelCard(w, idx))
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            No wheel results. Try clearing filters.
          </div>
        )}
      </div>
      
      {/* Persistent Next Step CTA - desktop */}
      {selectedWheel && (
        <div className="hidden md:block sticky bottom-4 z-40 mt-6">
          <div className="mx-auto max-w-2xl">
            <div className="flex gap-3 rounded-2xl bg-white/95 backdrop-blur-sm border border-green-200 p-3 shadow-2xl shadow-green-900/10">
              {/* Primary: Build complete package */}
              <Link
                href={tiresHref}
                className="flex h-14 flex-1 items-center justify-center gap-3 rounded-xl bg-green-600 text-base font-extrabold text-white shadow-lg shadow-green-600/30 transition-all hover:bg-green-700 hover:shadow-xl active:scale-[0.99]"
              >
                <span>Build Complete Package</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              
              {/* Secondary: Wheels only */}
              <button
                onClick={handleAddWheelsToCart}
                disabled={isAddingToCart}
                className="flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-neutral-300 bg-white px-5 text-sm font-bold text-neutral-700 transition-all hover:border-neutral-400 hover:bg-neutral-50 active:scale-[0.99] disabled:opacity-60"
              >
                {isAddingToCart ? (
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Wheels Only
                  </>
                )}
              </button>
            </div>
            <div className="mt-2 text-center text-xs text-neutral-500">
              ${selectedWheel.setPrice.toLocaleString()} for 4 wheels selected
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Sticky Bar */}
      <MobileStickyBar
        wheel={selectedWheel}
        tiresHref={tiresHref}
        isVisible={showMobileBar}
        onAddToCart={handleAddWheelsToCart}
        isAddingToCart={isAddingToCart}
      />
    </>
  );
}
