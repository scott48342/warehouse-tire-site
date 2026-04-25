"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { WheelsStyleCard, type WheelFinishThumb, type WheelPair } from "./WheelsStyleCard";
import { calculateAccessoryFitment, type DBProfileForAccessories, type WheelForAccessories } from "@/hooks/useAccessoryFitment";
import { TPMS_SET_PRICE_ESTIMATE, MOUNT_BALANCE_ESTIMATE } from "@/lib/pricing/accessoryEstimates";
import { FitmentDiameterChips, type DiameterOption } from "./FitmentDiameterChips";
import { useCart, type CartWheelItem } from "@/lib/cart/CartContext";
import { type FitmentLevel, type BuildRequirement } from "@/lib/fitment/guidance";

// Add gtag type for analytics
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

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
  // Fitment guidance (2026-04-07)
  fitmentGuidance?: {
    level: FitmentLevel;
    levelLabel: string;
    buildRequirement: BuildRequirement;
    buildLabel: string;
  };
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
  centerbore?: string; // For accessory calculation
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

/** Staggered fitment info from API */
type StaggeredFitmentInfo = {
  isStaggered: boolean;
  reason: string;
  frontSpec?: {
    diameter: number;
    width: number;
    offset: number | null;
    tireSize: string | null;
  };
  rearSpec?: {
    diameter: number;
    width: number;
    offset: number | null;
    tireSize: string | null;
  };
} | null;

/** Setup mode for staggered-capable vehicles */
type SetupMode = "square" | "staggered";

type WheelsGridProps = {
  wheels: WheelItem[];
  /** All wheels (unpaginated) - used for staggered pair matching across pages */
  allWheels?: WheelItem[];
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
  /** Staggered fitment info from API */
  staggeredInfo?: StaggeredFitmentInfo;
  /** Initial setup mode from URL */
  initialSetupMode?: SetupMode;
  /** Callback when setup mode changes (for URL sync) */
  onSetupModeChange?: (mode: SetupMode) => void;
  /** Show offset in wheel card size display (for lifted homepage intent) */
  showOffset?: boolean;
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
  onBuildPackage,
  isAddingToCart,
}: { 
  wheel: SelectedWheel;
  tiresHref: string;
  onClear: () => void;
  onAddToCart: () => void;
  onBuildPackage: () => void;
  isAddingToCart: boolean;
}) {
  return (
    <div className="animate-slide-up w-full max-w-sm">
      {/* Compact card module */}
      <div className="rounded-2xl bg-white border border-neutral-200 shadow-lg overflow-hidden">
        {/* Selected wheel summary - header */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            {wheel.imageUrl && (
              <img 
                src={wheel.imageUrl} 
                alt={wheel.model} 
                className="h-14 w-14 rounded-xl object-contain bg-white border border-neutral-200"
              />
            )}
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-green-700">Selected</span>
                {wheel.staggered && (
                  <span className="text-[10px] text-amber-600">• Staggered</span>
                )}
              </div>
              <div className="mt-1 text-sm font-bold text-neutral-900 truncate">
                {wheel.brand} {wheel.model}
              </div>
              <div className="text-xs text-neutral-500">
                {wheel.staggered ? (
                  <>F: {wheel.diameter}&quot;×{wheel.width}&quot; / R: {wheel.diameter}&quot;×{wheel.rearWidth}&quot;</>
                ) : (
                  <>{wheel.diameter}&quot; × {wheel.width}&quot;</>
                )}
                {wheel.finish && ` · ${wheel.finish}`}
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-lg font-bold text-neutral-900">
                ${wheel.setPrice.toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-500">set of 4</div>
            </div>
          </div>
        </div>
        
        {/* Action blocks - stacked */}
        <div className="p-4 space-y-3">
          {/* PRIMARY: Add Tires - distinct block */}
          <button
            onClick={onBuildPackage}
            disabled={isAddingToCart}
            className="group w-full rounded-xl bg-red-600 p-4 text-left transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">Add Tires & Complete Package</div>
                <div className="mt-0.5 text-xs text-red-200">We'll match tires to these wheels</div>
              </div>
              {isAddingToCart ? (
                <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-white transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              )}
            </div>
          </button>
          
          {/* SECONDARY: Wheels Only - distinct block */}
          <button
            onClick={onAddToCart}
            disabled={isAddingToCart}
            className="group w-full rounded-xl border border-neutral-200 bg-white p-4 text-left transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.98] disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-800">Add Wheels Only</div>
                <div className="mt-0.5 text-xs text-neutral-500">Skip tires, checkout now</div>
              </div>
              {isAddingToCart ? (
                <svg className="h-5 w-5 animate-spin text-neutral-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )}
            </div>
          </button>
        </div>
        
        {/* Change selection link */}
        <div className="px-4 pb-3 pt-1">
          <button
            onClick={onClear}
            className="w-full text-center text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            Change wheel selection
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGGERED SETUP CHOOSER
// ═══════════════════════════════════════════════════════════════════════════════
function StaggeredSetupChooser({
  staggeredInfo,
  selectedMode,
  onModeChange,
}: {
  staggeredInfo: NonNullable<StaggeredFitmentInfo>;
  selectedMode: SetupMode;
  onModeChange: (mode: SetupMode) => void;
}) {
  const { frontSpec, rearSpec } = staggeredInfo;
  
  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🏁</span>
        <div>
          <h3 className="text-sm font-extrabold text-neutral-900">
            Choose Your Wheel Setup
          </h3>
          <p className="text-xs text-neutral-600">
            Your vehicle came with a staggered setup from the factory
          </p>
        </div>
      </div>
      
      {/* Setup Options */}
      <div className="grid grid-cols-2 gap-3">
        {/* Square Setup */}
        <button
          onClick={() => onModeChange("square")}
          className={`relative rounded-xl border-2 p-3 text-left transition-all ${
            selectedMode === "square"
              ? "border-neutral-400 bg-neutral-50 ring-2 ring-neutral-200"
              : "border-neutral-200 bg-white hover:border-neutral-300"
          }`}
        >
          {selectedMode === "square" && (
            <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-500 text-white">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          <div className="text-xs font-bold text-neutral-900 mb-1">Square Setup</div>
          <div className="text-[11px] text-neutral-600">
            Same size all 4 corners
          </div>
          <div className="mt-1 text-[10px] text-neutral-400">
            Easier tire rotation
          </div>
          {frontSpec && (
            <div className="mt-2 text-[10px] font-medium text-neutral-500 bg-neutral-100 rounded px-2 py-1">
              All: {frontSpec.diameter}&quot; × {frontSpec.width}&quot;
            </div>
          )}
        </button>
        
        {/* Staggered Setup - Premium styling */}
        <button
          onClick={() => onModeChange("staggered")}
          className={`relative rounded-xl border-2 p-3 text-left transition-all ${
            selectedMode === "staggered"
              ? "border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 ring-2 ring-amber-300 shadow-lg shadow-amber-200/50"
              : "border-neutral-200 bg-white hover:border-amber-300 hover:bg-amber-50/50"
          }`}
        >
          {selectedMode === "staggered" && (
            <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/30">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-extrabold text-neutral-900">Performance Staggered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">OEM SPEC</span>
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">RECOMMENDED</span>
          </div>
          <div className="mt-1.5 text-[10px] text-amber-700 font-medium">
            Better traction • Aggressive stance
          </div>
          {frontSpec && rearSpec && (
            <div className="mt-2 space-y-0.5 bg-white/60 rounded px-2 py-1.5">
              <div className="text-[10px] font-medium text-neutral-600">
                Front: {frontSpec.diameter}&quot; × {frontSpec.width}&quot;
                {frontSpec.tireSize && <span className="text-neutral-400 ml-1">{frontSpec.tireSize}</span>}
              </div>
              <div className="text-[10px] font-medium text-neutral-600">
                Rear: {rearSpec.diameter}&quot; × {rearSpec.width}&quot;
                {rearSpec.tireSize && <span className="text-neutral-400 ml-1">{rearSpec.tireSize}</span>}
              </div>
            </div>
          )}
        </button>
      </div>
      
      {/* Info text based on selection */}
      <div className="mt-3 text-[11px] text-neutral-500">
        {selectedMode === "square" ? (
          <>💡 Square setup works great. Same wheels all around = easier tire rotation.</>
        ) : (
          <>💡 <span className="font-medium text-amber-700">Performance staggered</span> — wider rear wheels for better grip and the aggressive factory look.</>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE STICKY BAR - REMOVED (duplicate CTA removed for cleaner UX)
// ═══════════════════════════════════════════════════════════════════════════════
function MobileStickyBar({ 
  wheel, 
  isVisible,
  onAddToCart,
  onBuildPackage,
  isAddingToCart,
}: { 
  wheel: SelectedWheel | null;
  isVisible: boolean;
  onAddToCart: () => void;
  onBuildPackage: () => void;
  isAddingToCart: boolean;
}) {
  // Removed - SelectionConfirmation now handles all CTAs in one place
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC PACKAGE ESTIMATE
// ═══════════════════════════════════════════════════════════════════════════════
// Shows realistic price ranges based on selected/browsed wheel size
// Ranges are conservative to avoid scaring users with inflated estimates
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get tire price estimate range based on wheel diameter
 * Conservative estimates based on mid-market pricing
 */
function getTireEstimateForDiameter(diameter: number | null): { min: number; max: number } {
  const dia = diameter ?? 17; // Default to 17" if unknown
  
  if (dia <= 17) {
    // 15-17": Budget-friendly sizes
    return { min: 400, max: 700 }; // ~$100-175/tire
  } else if (dia <= 18) {
    // 18": Common upgrade size
    return { min: 480, max: 800 }; // ~$120-200/tire
  } else if (dia <= 20) {
    // 19-20": Popular truck/SUV sizes
    return { min: 560, max: 960 }; // ~$140-240/tire
  } else if (dia <= 22) {
    // 21-22": Larger sizes
    return { min: 680, max: 1200 }; // ~$170-300/tire
  } else {
    // 24"+: Premium sizes
    return { min: 800, max: 1400 }; // ~$200-350/tire
  }
}

/**
 * Get wheel set price estimate based on diameter
 * Used when no wheel is selected yet (browsing)
 */
function getWheelEstimateForDiameter(diameter: number | null, isLiftedBuild: boolean): { min: number; max: number } {
  const dia = diameter ?? 17;
  
  // Lifted builds typically choose more expensive wheels
  const liftMultiplier = isLiftedBuild ? 1.3 : 1.0;
  
  if (dia <= 17) {
    return { 
      min: Math.round(400 * liftMultiplier), 
      max: Math.round(800 * liftMultiplier) 
    };
  } else if (dia <= 18) {
    return { 
      min: Math.round(500 * liftMultiplier), 
      max: Math.round(1000 * liftMultiplier) 
    };
  } else if (dia <= 20) {
    return { 
      min: Math.round(600 * liftMultiplier), 
      max: Math.round(1200 * liftMultiplier) 
    };
  } else if (dia <= 22) {
    return { 
      min: Math.round(800 * liftMultiplier), 
      max: Math.round(1600 * liftMultiplier) 
    };
  } else {
    return { 
      min: Math.round(1000 * liftMultiplier), 
      max: Math.round(2000 * liftMultiplier) 
    };
  }
}

function PackageEstimate({ 
  wheelSetPrice, 
  isSelected,
  selectedDiameter,
  isLiftedBuild = false,
}: { 
  wheelSetPrice: number | null;
  isSelected: boolean;
  selectedDiameter?: number | null;
  isLiftedBuild?: boolean;
}) {
  // Accessory estimates from centralized pricing
  const tpmsEstimate = TPMS_SET_PRICE_ESTIMATE;
  const installEstimate = MOUNT_BALANCE_ESTIMATE;
  const accessoriesTotal = tpmsEstimate + installEstimate; // ~$356
  
  // Get tire estimate based on diameter
  const tireEstimate = getTireEstimateForDiameter(selectedDiameter ?? null);
  
  // When no wheel selected, show estimate based on browsed diameter
  if (wheelSetPrice === null) {
    const wheelEstimate = getWheelEstimateForDiameter(selectedDiameter ?? null, isLiftedBuild);
    
    // Calculate total range
    const minTotal = wheelEstimate.min + tireEstimate.min + accessoriesTotal;
    const maxTotal = wheelEstimate.max + tireEstimate.max + accessoriesTotal;
    
    // Round to nearest $50
    const minRounded = Math.round(minTotal / 50) * 50;
    const maxRounded = Math.round(maxTotal / 50) * 50;
    
    // Cap max to avoid scary numbers (unless lifted)
    const cappedMax = isLiftedBuild 
      ? maxRounded 
      : Math.min(maxRounded, selectedDiameter && selectedDiameter >= 22 ? 3500 : 2800);
    
    return (
      <div className="rounded-xl bg-neutral-100 px-4 py-3">
        <div className="text-xs font-semibold text-neutral-500">Estimated Price Range</div>
        <div className="text-lg font-extrabold text-neutral-700">
          ${minRounded.toLocaleString()} – ${cappedMax.toLocaleString()}
        </div>
        <div className="text-[11px] text-neutral-500">
          Wheels + tires + install
          {selectedDiameter ? ` (${selectedDiameter}" wheels)` : ""}
        </div>
      </div>
    );
  }
  
  // When wheel is selected, calculate based on actual wheel price
  const minPackage = wheelSetPrice + tireEstimate.min + accessoriesTotal;
  const maxPackage = wheelSetPrice + tireEstimate.max + accessoriesTotal;
  
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
        {isSelected ? "Your Package Estimate" : "Estimated Price Range"}
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
  allWheels,
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
  staggeredInfo = null,
  initialSetupMode,
  onSetupModeChange,
  showOffset = false,
}: WheelsGridProps) {
  const [selectedWheel, setSelectedWheel] = useState<SelectedWheel | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showMobileBar, setShowMobileBar] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  
  // Determine if this vehicle supports staggered fitment
  const supportsStaggered = Boolean(staggeredInfo?.isStaggered);
  
  // Staggered setup mode state
  // Priority: URL param (initialSetupMode) > default (staggered if supported)
  const [setupMode, setSetupMode] = useState<SetupMode>(() => {
    if (initialSetupMode && (initialSetupMode === "square" || initialSetupMode === "staggered")) {
      return initialSetupMode;
    }
    return supportsStaggered ? "staggered" : "square";
  });
  
  // Sync setup mode when staggeredInfo becomes available (handles SSR hydration)
  // Only auto-switch if no explicit mode was set via URL
  useEffect(() => {
    if (supportsStaggered && setupMode === "square" && !initialSetupMode) {
      // If staggered is supported but mode is still square, switch to staggered (recommended)
      setSetupMode("staggered");
    }
  }, [supportsStaggered, initialSetupMode]); // Only run when supportsStaggered changes
  
  // Track when staggered chooser is shown (once per page view)
  const hasTrackedChooserRef = useRef(false);
  useEffect(() => {
    if (supportsStaggered && staggeredInfo && !hasTrackedChooserRef.current) {
      hasTrackedChooserRef.current = true;
      if (typeof window !== "undefined" && window.gtag && staggeredInfo.frontSpec && staggeredInfo.rearSpec) {
        window.gtag("event", "staggered_chooser_shown", {
          vehicle_year: viewParams.year,
          vehicle_make: viewParams.make,
          vehicle_model: viewParams.model,
          vehicle_trim: viewParams.trim || viewParams.modification,
          front_diameter: staggeredInfo.frontSpec.diameter,
          front_width: staggeredInfo.frontSpec.width,
          rear_diameter: staggeredInfo.rearSpec.diameter,
          rear_width: staggeredInfo.rearSpec.width,
          default_mode: "staggered", // We now default to staggered
        });
      }
    }
  }, [supportsStaggered, staggeredInfo, viewParams]);
  
  // Track setup mode selection for analytics + notify parent for URL sync
  const handleSetupModeChange = useCallback((mode: SetupMode) => {
    setSetupMode(mode);
    // Notify parent for URL sync
    onSetupModeChange?.(mode);
    // Track the selection
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "staggered_setup_select", {
        setup_mode: mode,
        vehicle_year: viewParams.year,
        vehicle_make: viewParams.make,
        vehicle_model: viewParams.model,
        vehicle_trim: viewParams.trim || viewParams.modification,
      });
    }
  }, [viewParams, onSetupModeChange]);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // PHASE 2: Filter wheels based on setup mode + match to staggered specs
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // Helper to check if wheel matches front or rear spec
  // Tolerance: 1.5" for width (staggered vehicles often use wider rear wheels like 11" instead of OEM 10")
  // Tolerance: 2.0" for diameter (allows plus-sizing: 20" OEM → 18"-22" range)
  const matchesStaggeredSpec = useCallback((wheel: WheelItem, spec: NonNullable<StaggeredFitmentInfo>["frontSpec"], widthTolerance: number = 1.5, diaTolerance: number = 2.0): boolean => {
    if (!spec) return false;
    const wheelDia = parseFloat(wheel.diameter || "0");
    const wheelWidth = parseFloat(wheel.width || "0");
    return Math.abs(wheelDia - spec.diameter) <= diaTolerance && Math.abs(wheelWidth - spec.width) <= widthTolerance;
  }, []);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // STAGGERED PAIRS: Compute COMPLETE pairs first (both front + rear must exist)
  // This is the source of truth for what can be shown in staggered mode
  // ═══════════════════════════════════════════════════════════════════════════════
  const staggeredPairs = useMemo(() => {
    if (!supportsStaggered || !staggeredInfo?.frontSpec || !staggeredInfo?.rearSpec) {
      return null;
    }
    
    const { frontSpec, rearSpec } = staggeredInfo;
    
    // Use allWheels (all unpaginated wheels) for pair matching if available,
    // otherwise fall back to the paginated wheels prop
    const wheelsToScan = allWheels || wheels;
    
    // Group wheels by style + diameter (brand + model + finish + diameter)
    // This ensures front/rear pairs are at the SAME diameter (e.g., both 20", or both 22")
    const styleGroups = new Map<string, { front: WheelItem | null; rear: WheelItem | null }>();
    
    for (const wheel of wheelsToScan) {
      // Round diameter to nearest inch for grouping (19.0, 20.0, 22.0, etc.)
      const wheelDia = Math.round(parseFloat(wheel.diameter || "0"));
      const styleKey = `${wheel.brand}|${wheel.model}|${wheel.finish || ""}|${wheelDia}`.toLowerCase();
      
      if (!styleGroups.has(styleKey)) {
        styleGroups.set(styleKey, { front: null, rear: null });
      }
      
      const group = styleGroups.get(styleKey)!;
      
      // Check if this wheel matches front spec (width-based, diameter already grouped)
      if (matchesStaggeredSpec(wheel, frontSpec)) {
        if (!group.front || (wheel.imageUrl && !group.front.imageUrl)) {
          group.front = wheel;
        }
      }
      // Check if this wheel matches rear spec (can be same wheel if specs overlap)
      if (matchesStaggeredSpec(wheel, rearSpec)) {
        if (!group.rear || (wheel.imageUrl && !group.rear.imageUrl)) {
          group.rear = wheel;
        }
      }
    }
    
    // ONLY return COMPLETE pairs where front and rear are ACTUALLY DIFFERENT
    // (different SKUs or different widths - not the same wheel for both positions)
    const completePairs: Array<{ styleKey: string; front: WheelItem; rear: WheelItem }> = [];
    for (const [styleKey, group] of styleGroups.entries()) {
      if (group.front && group.rear) {
        // Verify front and rear are different (not the same wheel matching both specs)
        const frontWidth = parseFloat(group.front.width || "0");
        const rearWidth = parseFloat(group.rear.width || "0");
        const frontSku = group.front.sku || "";
        const rearSku = group.rear.sku || "";
        
        // Must be different SKUs OR different widths to be a true staggered pair
        if (frontSku !== rearSku || Math.abs(frontWidth - rearWidth) >= 0.5) {
          completePairs.push({ styleKey, front: group.front, rear: group.rear });
        }
      }
    }
    
    return completePairs.length > 0 ? completePairs : null;
  }, [wheels, allWheels, supportsStaggered, staggeredInfo, matchesStaggeredSpec]);
  
  // Set of style keys that have complete pairs (for fast lookup)
  const completePairStyles = useMemo(() => {
    if (!staggeredPairs) return new Set<string>();
    return new Set(staggeredPairs.map(p => p.styleKey));
  }, [staggeredPairs]);
  
  const filteredWheels = useMemo(() => {
    if (!supportsStaggered || !staggeredInfo) {
      // Non-staggered vehicle - show all wheels as-is
      return wheels;
    }
    
    if (setupMode === "staggered") {
      // ═══════════════════════════════════════════════════════════════════════════
      // STAGGERED MODE: Trust API's pair property
      // The fitment-search API computes staggered pairs server-side
      // ═══════════════════════════════════════════════════════════════════════════
      return wheels.filter(w => w.pair?.staggered === true);
    } else {
      // Square mode: Show wheels that work on all 4 corners
      // For staggered-capable vehicles, this means wheels that match FRONT spec
      // (smaller/narrower - safe for all positions)
      const frontSpec = staggeredInfo.frontSpec;
      const rearSpec = staggeredInfo.rearSpec;
      if (frontSpec) {
        // Max width for square: front spec + 1" tolerance
        // Exclude anything wider (even if it lacks pair data)
        const maxSquareWidth = frontSpec.width + 1.0;
        
        return wheels.filter(w => {
          const wheelWidth = parseFloat(w.width || "0");
          
          // STRICT: If wheel is too wide for front position, exclude it
          // This catches rear-width wheels that don't have pair data
          if (wheelWidth > maxSquareWidth) return false;
          
          // If wheel matches front spec, include it
          if (matchesStaggeredSpec(w, frontSpec, 1.0, 0.5)) return true;
          
          // If wheel has staggered pair data but didn't match front spec, exclude
          // (it's a rear wheel that shouldn't be in square mode)
          if (w.pair?.staggered) return false;
          
          // Generic wheel without pair data and within width limit - include
          return true;
        });
      }
      // Fallback: show all non-staggered wheels
      return wheels.filter(w => !w.pair?.staggered);
    }
  }, [wheels, setupMode, supportsStaggered, staggeredInfo, staggeredPairs, completePairStyles, matchesStaggeredSpec]);
  
  // For staggered mode, deduplicate by style (show one card per style, not per SKU)
  // The API already provides pair data, so we just need to dedupe
  const wheelsWithPairs = useMemo(() => {
    if (setupMode !== "staggered") {
      return filteredWheels;
    }
    
    // Deduplicate: only show one card per style (brand + model + finish)
    // The API marks both front and rear SKUs with pair.staggered, so we pick one per style
    const seenStyles = new Set<string>();
    const result: WheelItem[] = [];
    
    for (const wheel of filteredWheels) {
      // Use brand + model + finish for style grouping (ignore diameter/width since those differ for front/rear)
      const styleKey = `${wheel.brand}|${wheel.model}|${wheel.finish || ""}`.toLowerCase();
      
      if (seenStyles.has(styleKey)) continue;
      seenStyles.add(styleKey);
      
      result.push(wheel);
    }
    
    return result;
  }, [filteredWheels, setupMode]);
  
  // Final wheels to display
  const displayWheels = setupMode === "staggered" ? wheelsWithPairs : filteredWheels;
  
  // Also filter recommended wheels by setup mode
  // For staggered mode, compute pairs specifically for recommended wheels
  // (they may not be in allWheels, so we need to scan them separately)
  const recommendedStaggeredPairs = useMemo(() => {
    if (!supportsStaggered || !staggeredInfo?.frontSpec || !staggeredInfo?.rearSpec || !recommendedWheels.length) {
      return new Set<string>();
    }
    
    const { frontSpec, rearSpec } = staggeredInfo;
    const styleGroups = new Map<string, { front: WheelItem | null; rear: WheelItem | null }>();
    
    for (const wheel of recommendedWheels) {
      const wheelDia = Math.round(parseFloat(wheel.diameter || "0"));
      const styleKey = `${wheel.brand}|${wheel.model}|${wheel.finish || ""}|${wheelDia}`.toLowerCase();
      if (!styleGroups.has(styleKey)) {
        styleGroups.set(styleKey, { front: null, rear: null });
      }
      const group = styleGroups.get(styleKey)!;
      if (matchesStaggeredSpec(wheel, frontSpec)) group.front = wheel;
      if (matchesStaggeredSpec(wheel, rearSpec)) group.rear = wheel;
    }
    
    // Return styleKeys that have DIFFERENT front and rear wheels
    const pairs = new Set<string>();
    for (const [styleKey, group] of styleGroups.entries()) {
      if (group.front && group.rear) {
        const frontWidth = parseFloat(group.front.width || "0");
        const rearWidth = parseFloat(group.rear.width || "0");
        const frontSku = group.front.sku || "";
        const rearSku = group.rear.sku || "";
        // Must be different to be a true staggered pair
        if (frontSku !== rearSku || Math.abs(frontWidth - rearWidth) >= 0.5) {
          pairs.add(styleKey);
        }
      }
    }
    return pairs;
  }, [recommendedWheels, supportsStaggered, staggeredInfo, matchesStaggeredSpec]);
  
  // For staggered mode, only show recommended wheels that have pair data from API
  const filteredRecommended = useMemo(() => {
    if (!supportsStaggered || !recommendedWheels.length) {
      return recommendedWheels;
    }
    
    if (setupMode === "staggered") {
      // In staggered mode, show recommended wheels with pair.staggered from API
      return recommendedWheels.filter(w => w.pair?.staggered === true);
    } else {
      // Square mode: show wheels that DON'T have staggered pair data
      return recommendedWheels.filter(w => !w.pair?.staggered);
    }
  }, [recommendedWheels, setupMode, supportsStaggered]);
  
  // Cart context
  const { addItem, addAccessories, setAccessoryState, replaceAccessorySku, setIsOpen: setCartOpen } = useCart();
  
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
    
    // Pass staggered setup mode and specs if in staggered mode
    if (setupMode === "staggered" && selectedWheel?.staggered) {
      params.set("setup", "staggered");
      // Pass staggered tire sizes from vehicle fitment for tire matching
      if (staggeredInfo?.frontSpec?.tireSize) {
        params.set("frontTireSize", staggeredInfo.frontSpec.tireSize);
      }
      if (staggeredInfo?.rearSpec?.tireSize) {
        params.set("rearTireSize", staggeredInfo.rearSpec.tireSize);
      }
      // Also pass rear wheel specs for staggered packages (match tires page param names)
      if (selectedWheel.rearSku) params.set("wheelSkuRear", selectedWheel.rearSku);
      if (selectedWheel.rearWidth) params.set("wheelWidthRear", selectedWheel.rearWidth);
      if (selectedWheel.rearOffset) params.set("wheelOffsetRear", selectedWheel.rearOffset);
      // Pass rear diameter for proper tire matching
      if (selectedWheel.diameter) params.set("wheelDiaRear", selectedWheel.diameter); // Same dia typically
    }
    
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
    
    const vehicleInfo = viewParams.year && viewParams.make && viewParams.model ? {
      year: viewParams.year,
      make: viewParams.make,
      model: viewParams.model,
      trim: viewParams.trim,
      modification: viewParams.modification,
    } : undefined;
    
    if (selectedWheel.staggered && selectedWheel.rearSku) {
      // ═══════════════════════════════════════════════════════════════════════════
      // STAGGERED: Add as single item with front/rear SKUs and quantity 4
      // Cart will display as "2 front + 2 rear" but priced per wheel × 4
      // ═══════════════════════════════════════════════════════════════════════════
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
        quantity: 4, // Total wheels (2 front + 2 rear)
        fitmentClass: selectedWheel.fitmentClass as "surefit" | "specfit" | "extended" | undefined,
        vehicle: vehicleInfo,
        staggered: true,
      };
      
      addItem(cartItem);
    } else {
      // ═══════════════════════════════════════════════════════════════════════════
      // SQUARE: Standard 4-wheel setup, all same SKU
      // ═══════════════════════════════════════════════════════════════════════════
      const cartItem: CartWheelItem = {
        type: "wheel",
        sku: selectedWheel.sku,
        brand: selectedWheel.brand,
        model: selectedWheel.model,
        finish: selectedWheel.finish,
        diameter: selectedWheel.diameter,
        width: selectedWheel.width,
        offset: selectedWheel.offset,
        boltPattern: selectedWheel.boltPattern,
        imageUrl: selectedWheel.imageUrl,
        unitPrice: selectedWheel.price || (selectedWheel.setPrice / 4),
        quantity: 4,
        fitmentClass: selectedWheel.fitmentClass as "surefit" | "specfit" | "extended" | undefined,
        vehicle: vehicleInfo,
        staggered: false,
      };
      
      addItem(cartItem);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ACCESSORY FITMENT - Calculate and auto-add required accessories
    // ═══════════════════════════════════════════════════════════════════════════
    if (dbProfile) {
      const wheelForFitment: WheelForAccessories = {
        sku: selectedWheel.sku,
        centerBore: selectedWheel.centerbore ? Number(selectedWheel.centerbore) : undefined,
        boltPattern: selectedWheel.boltPattern,
      };

      const fitmentResult = calculateAccessoryFitment(dbProfile, wheelForFitment);
      
      console.log("[WheelsGrid] Accessory fitment result:", {
        wheelSku: selectedWheel.sku,
        wheelCenterBore: selectedWheel.centerbore,
        vehicleCenterBore: dbProfile.centerBoreMm,
        lugNuts: fitmentResult.fitment?.lugNuts,
        hubRings: fitmentResult.fitment?.hubRings,
        requiredItems: fitmentResult.requiredItems.map(i => `${i.category}: ${i.name}`),
      });
      
      if (fitmentResult.state) {
        setAccessoryState(fitmentResult.state);
      }

      // Auto-add required accessories
      if (fitmentResult.requiredItems.length > 0) {
        // Replace lug kit placeholder SKU with real Gorilla kit SKU
        const lug = fitmentResult.requiredItems.find((i) => i.category === "lug_nut");
        if (lug?.spec?.threadSize) {
          const placeholderSku = lug.sku;
          const qs = new URLSearchParams({
            threadSize: lug.spec.threadSize,
          });
          if (lug.spec.seatType) qs.set("seatType", lug.spec.seatType);

          fetch(`/api/accessories/lugkits?${qs.toString()}`, {
            headers: { Accept: "application/json" },
          })
            .then((r) => r.json().catch(() => null).then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => {
              if (ok && j?.choice?.sku) {
                const next = {
                  ...lug,
                  sku: String(j.choice.sku),
                  meta: {
                    ...(lug.meta || {}),
                    placeholder: false,
                    source: "wheelpros",
                    brandCode: j.choice.brandCode,
                    nipCost: j.choice.nip,
                    msrp: j.choice.msrp,
                    title: j.choice.title,
                    threadKey: j.choice.threadKey,
                  },
                };
                replaceAccessorySku(placeholderSku, next);
              }
            })
            .catch(() => {});
        }

        console.log("[WheelsGrid] Auto-adding accessories:", fitmentResult.requiredItems.map(i => `${i.category}: ${i.name}`));
        addAccessories(fitmentResult.requiredItems);
      }
    }
    
    // Track add-to-cart with setup type
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "add_to_cart", {
        currency: "USD",
        value: selectedWheel.setPrice,
        items: [{
          item_id: selectedWheel.sku,
          item_name: `${selectedWheel.brand} ${selectedWheel.model}`,
          item_brand: selectedWheel.brand,
          item_category: "wheel",
          quantity: 4,
          price: selectedWheel.price || (selectedWheel.setPrice / 4),
        }],
        setup_type: selectedWheel.staggered ? "staggered" : "square",
        staggered: selectedWheel.staggered,
        rear_sku: selectedWheel.rearSku,
      });
    }
    
    // Show cart drawer after short delay
    setTimeout(() => {
      setIsAddingToCart(false);
      setCartOpen(true);
      // Clear selection since item is now in cart
      setSelectedWheel(null);
      setShowMobileBar(false);
    }, 300);
  }, [selectedWheel, viewParams, addItem, addAccessories, setAccessoryState, replaceAccessorySku, setCartOpen, dbProfile]);
  
  // Build package: Add wheels + accessories, then navigate to tires
  const handleBuildPackage = useCallback(() => {
    if (!selectedWheel) return;
    
    setIsAddingToCart(true);
    
    const vehicleInfo = viewParams.year && viewParams.make && viewParams.model ? {
      year: viewParams.year,
      make: viewParams.make,
      model: viewParams.model,
      trim: viewParams.trim,
      modification: viewParams.modification,
    } : undefined;
    
    // Create cart item (same logic as handleAddWheelsToCart)
    const cartItem: CartWheelItem = selectedWheel.staggered && selectedWheel.rearSku ? {
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
      vehicle: vehicleInfo,
      staggered: true,
    } : {
      type: "wheel",
      sku: selectedWheel.sku,
      brand: selectedWheel.brand,
      model: selectedWheel.model,
      finish: selectedWheel.finish,
      diameter: selectedWheel.diameter,
      width: selectedWheel.width,
      offset: selectedWheel.offset,
      boltPattern: selectedWheel.boltPattern,
      imageUrl: selectedWheel.imageUrl,
      unitPrice: selectedWheel.price || (selectedWheel.setPrice / 4),
      quantity: 4,
      fitmentClass: selectedWheel.fitmentClass as "surefit" | "specfit" | "extended" | undefined,
      vehicle: vehicleInfo,
      staggered: false,
    };
    
    addItem(cartItem);
    
    // Add accessories
    if (dbProfile) {
      const wheelForFitment: WheelForAccessories = {
        sku: selectedWheel.sku,
        centerBore: selectedWheel.centerbore ? Number(selectedWheel.centerbore) : undefined,
        boltPattern: selectedWheel.boltPattern,
      };

      const fitmentResult = calculateAccessoryFitment(dbProfile, wheelForFitment);
      
      console.log("[WheelsGrid] Build package - accessory fitment:", {
        wheelSku: selectedWheel.sku,
        requiredItems: fitmentResult.requiredItems.map(i => `${i.category}: ${i.name}`),
      });
      
      if (fitmentResult.state) {
        setAccessoryState(fitmentResult.state);
      }

      if (fitmentResult.requiredItems.length > 0) {
        const lug = fitmentResult.requiredItems.find((i) => i.category === "lug_nut");
        if (lug?.spec?.threadSize) {
          const placeholderSku = lug.sku;
          const qs = new URLSearchParams({ threadSize: lug.spec.threadSize });
          if (lug.spec.seatType) qs.set("seatType", lug.spec.seatType);

          fetch(`/api/accessories/lugkits?${qs.toString()}`, {
            headers: { Accept: "application/json" },
          })
            .then((r) => r.json().catch(() => null).then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => {
              if (ok && j?.choice?.sku) {
                replaceAccessorySku(placeholderSku, {
                  ...lug,
                  sku: String(j.choice.sku),
                  meta: { ...(lug.meta || {}), placeholder: false, source: "wheelpros" },
                });
              }
            })
            .catch(() => {});
        }
        addAccessories(fitmentResult.requiredItems);
      }
    }
    
    // Navigate to tires page after short delay
    setTimeout(() => {
      setIsAddingToCart(false);
      setSelectedWheel(null);
      setShowMobileBar(false);
      // Navigate to tires page
      window.location.href = tiresHref;
    }, 300);
  }, [selectedWheel, viewParams, addItem, addAccessories, setAccessoryState, replaceAccessorySku, dbProfile, tiresHref]);
  
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
  // Determine Top Pick category based on position
  const getTopPickCategory = (idx: number): "best-overall" | "most-popular" | "best-style" | "best-value" | undefined => {
    switch (idx) {
      case 0: return "best-overall";
      case 1: return "most-popular";
      case 2: return "best-style";
      case 3: return "best-value";
      default: return undefined;
    }
  };
  
  const renderWheelCard = (w: WheelItem, idx: number, isRecommended = false) => {
    const isSelected = selectedWheel?.sku === w.sku;
    const brand = typeof w.brand === "string" ? w.brand : w.brand != null ? String(w.brand) : (w.brandCode || "Wheel");
    const model = typeof w.model === "string" ? w.model : w.model != null ? String(w.model) : w.sku || "Wheel";
    
    // Top Pick props (only for first 4 recommended wheels)
    const topPickCategory = isRecommended && idx < 4 ? getTopPickCategory(idx) : undefined;
    const isTopPick = isRecommended && idx < 4;
    
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
          // Fitment guidance (2026-04-07)
          fitmentLevel={w.fitmentGuidance?.level}
          buildRequirement={w.fitmentGuidance?.buildRequirement}
          // Homepage intent: show offset for lifted builds
          showOffset={showOffset}
          // Selection props
          isSelected={isSelected}
          hasSelection={!!selectedWheel}
          // NEW: Top Pick category props for guided selection
          topPickCategory={topPickCategory}
          isTopPick={isTopPick}
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
              centerbore: w.centerbore,
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
      
      {/* Staggered Setup Chooser - show for staggered-capable vehicles */}
      {supportsStaggered && staggeredInfo && !selectedWheel && (
        <StaggeredSetupChooser
          staggeredInfo={staggeredInfo}
          selectedMode={setupMode}
          onModeChange={handleSetupModeChange}
        />
      )}
      
      {/* Selection Confirmation - REMOVED per user request
          Users will click directly into wheel detail page instead */}
      
      {/* Package Estimate - REMOVED with SelectionConfirmation */}
      
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
      
      {/* ═══════════════════════════════════════════════════════════════════════════
          TOP PICKS MODULE - Editorial / Guided Selection Experience
          REFINED: Softer background, reduced visual weight, improved legend
          ═══════════════════════════════════════════════════════════════════════════ */}
      {showRecommended && filteredRecommended.length > 0 && (
        <div className="mb-8 rounded-2xl bg-gradient-to-b from-stone-50/60 via-white to-neutral-50/40 border border-neutral-200/80 shadow-sm overflow-hidden">
          {/* Header - refined, less intense */}
          <div className="bg-gradient-to-r from-stone-100/70 to-neutral-100/50 px-5 py-3.5 border-b border-neutral-200/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/90 to-orange-400/90 text-white shadow-sm">
                  <span className="text-base">⭐</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-800">
                    Top Picks for Your {viewParams.model}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {setupMode === "staggered" 
                      ? "Staggered setups, expertly matched"
                      : "Hand-picked for fitment, style, and value"}
                  </p>
                </div>
              </div>
              {/* Quick decision helper - refined */}
              <div className="hidden md:flex items-center gap-2 text-[11px] text-neutral-400">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 border border-neutral-150">
                  <span className="text-green-600">✓</span> Verified Fitment
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 border border-neutral-150">
                  <span className="text-neutral-400">🔧</span> Hardware Included
                </span>
              </div>
            </div>
          </div>
          
          {/* Cards - increased spacing */}
          <div className="p-5 pt-6">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {filteredRecommended.slice(0, 4).map((w, idx) => renderWheelCard(w, idx, true))}
            </div>
            
            {/* Legend row - refined, more intentional */}
            <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-center gap-5 text-[11px] text-neutral-400 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-amber-400">⭐</span> Best Overall
              </span>
              <span className="text-neutral-200">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-orange-400">🔥</span> Most Popular
              </span>
              <span className="text-neutral-200">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-purple-400">💎</span> Best Style
              </span>
              <span className="text-neutral-200">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-emerald-400">🛞</span> Best Value
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* All Wheels Header */}
      {(showRecommended && filteredRecommended.length > 0) || displayWheels.length > 0 ? (
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-extrabold text-neutral-900">
            {setupMode === "staggered" ? "Staggered Wheel Sets" : "All Wheels"}
          </h3>
          <span className="text-xs text-neutral-500">
            {displayWheels.length} {setupMode === "staggered" ? "staggered sets" : "styles"} that fit
          </span>
        </div>
      ) : null}
      
      {/* Staggered Mode Info Banner */}
      {setupMode === "staggered" && staggeredInfo && displayWheels.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <span className="text-lg">⚡</span>
            <span className="font-medium">
              Showing wheel sets with {staggeredInfo.frontSpec?.diameter}&quot;×{staggeredInfo.frontSpec?.width}&quot; front 
              and {staggeredInfo.rearSpec?.diameter}&quot;×{staggeredInfo.rearSpec?.width}&quot; rear
            </span>
          </div>
          <div className="mt-1 text-xs text-amber-700">
            Each set includes 2 front + 2 rear wheels matched to your vehicle&apos;s staggered specs
          </div>
        </div>
      )}
      
      {/* Main Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {displayWheels.length ? (
          displayWheels.map((w, idx) => renderWheelCard(w, idx))
        ) : (
          <div className="col-span-full rounded-2xl border border-neutral-200 bg-white p-6 text-center">
            <div className="text-neutral-700 font-medium">
              {setupMode === "staggered" 
                ? "No complete staggered wheel sets available. We need matching front and rear wheels in the same style."
                : "No wheel results. Try clearing filters."}
            </div>
            {setupMode === "staggered" && supportsStaggered && (
              <button
                onClick={() => setSetupMode("square")}
                className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Switch to Square Setup →
              </button>
            )}
          </div>
        )}
      </div>
      {/* Desktop + Mobile sticky CTAs REMOVED - single CTA block in SelectionConfirmation only */}
      
      {/* Mobile Sticky Bar - disabled */}
      <MobileStickyBar
        wheel={selectedWheel}
        isVisible={showMobileBar}
        onAddToCart={handleAddWheelsToCart}
        onBuildPackage={handleBuildPackage}
        isAddingToCart={isAddingToCart}
      />
    </>
  );
}
