"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LIFT_LEVELS } from "@/lib/homepage-intent/config";
import type { LiftLevel } from "@/lib/homepage-intent/types";

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL: Truck stance graphic for visual reinforcement
// ═══════════════════════════════════════════════════════════════════════════

function TruckStancePreview({ liftInches, tireSize }: { liftInches: number; tireSize?: string }) {
  // Adjust visual based on lift
  const groundY = liftInches <= 2 ? 44 : liftInches <= 4 ? 40 : liftInches <= 6 ? 36 : 32;
  const wheelRadius = liftInches <= 2 ? 8 : liftInches <= 4 ? 9 : liftInches <= 6 ? 10 : 11;
  const bodyY = liftInches <= 2 ? 18 : liftInches <= 4 ? 14 : liftInches <= 6 ? 10 : 6;
  
  return (
    <div className="relative">
      <svg viewBox="0 0 100 55" className="w-full h-auto max-w-[120px]" aria-hidden="true">
        {/* Ground */}
        <line x1="0" y1={groundY + wheelRadius + 2} x2="100" y2={groundY + wheelRadius + 2} 
          stroke="currentColor" strokeWidth="1" className="text-neutral-300" />
        
        {/* Truck body */}
        <g className="text-neutral-600">
          <rect x="50" y={bodyY} width="42" height="18" rx="2" fill="currentColor" />
          <rect x="15" y={bodyY} width="40" height="22" rx="2" fill="currentColor" />
          <rect x="3" y={bodyY + 8} width="15" height="14" rx="2" fill="currentColor" />
          <rect x="20" y={bodyY + 2} width="30" height="11" rx="1" className="text-neutral-400" fill="currentColor" />
        </g>
        
        {/* Wheels */}
        <g className="text-neutral-800">
          <circle cx="20" cy={groundY} r={wheelRadius} fill="currentColor" />
          <circle cx="20" cy={groundY} r={wheelRadius - 3} className="text-neutral-500" fill="currentColor" />
          <circle cx="80" cy={groundY} r={wheelRadius} fill="currentColor" />
          <circle cx="80" cy={groundY} r={wheelRadius - 3} className="text-neutral-500" fill="currentColor" />
        </g>
      </svg>
      {tireSize && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-neutral-500 bg-white px-1 rounded">
          {tireSize}"
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STICKY BUILD SUMMARY BAR
// ═══════════════════════════════════════════════════════════════════════════

export function StickyBuildBar() {
  const searchParams = useSearchParams();
  
  const buildType = searchParams.get("buildType");
  const liftLevel = searchParams.get("liftLevel") as LiftLevel | null;
  const liftedInches = searchParams.get("liftedInches");
  const offsetMin = searchParams.get("offsetMin");
  const offsetMax = searchParams.get("offsetMax");
  const liftKitSku = searchParams.get("liftKitSku");
  
  // Only show if we have lifted build context
  if (!buildType || buildType === "stock") {
    return null;
  }
  
  const liftConfig = liftLevel ? LIFT_LEVELS[liftLevel] : null;
  const inches = liftedInches ? parseInt(liftedInches) : liftConfig?.inches || 0;
  const tireSizes = liftConfig?.targetTireSizes || [];
  
  return (
    <div className="sticky top-0 z-40 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
      <div className="mx-auto max-w-7xl px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Visual + Build Info */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <TruckStancePreview liftInches={inches} tireSize={tireSizes[tireSizes.length - 1]} />
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold">{liftConfig?.label || `${inches}" Lift`}</span>
                <span className="text-amber-200">•</span>
                <span>{tireSizes.join("-")}" Tires</span>
                <span className="text-amber-200">•</span>
                <span>{offsetMin} to {offsetMax}mm</span>
              </div>
              
              {liftKitSku && (
                <span className="rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold">
                  ✓ Lift kit added
                </span>
              )}
            </div>
          </div>
          
          {/* Right: Popularity + Change */}
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-amber-100">
              🔥 Popular setup for this vehicle
            </span>
            <Link
              href="/wheels"
              className="text-xs font-semibold text-white/80 hover:text-white underline"
            >
              Change
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PACKAGE BRIDGE CTA - Enhanced with guidance and momentum
// ═══════════════════════════════════════════════════════════════════════════

interface PackageBridgeCTAProps {
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  modification?: string;
  wheelDiameter?: number;
  className?: string;
}

export function PackageBridgeCTA({
  vehicleYear,
  vehicleMake,
  vehicleModel,
  modification,
  wheelDiameter,
  className = "",
}: PackageBridgeCTAProps) {
  const searchParams = useSearchParams();
  
  const liftLevel = searchParams.get("liftLevel") as LiftLevel | null;
  const liftedInches = searchParams.get("liftedInches");
  const buildType = searchParams.get("buildType");
  
  const liftConfig = liftLevel ? LIFT_LEVELS[liftLevel] : null;
  const tireSizes = liftConfig?.targetTireSizes || [];
  const inches = liftedInches ? parseInt(liftedInches) : liftConfig?.inches || 0;
  
  // Get use-case label based on build
  const useCaseLabel = inches <= 2 ? "Daily Driver" : 
    inches <= 4 ? "Weekend Warrior" : 
    inches <= 6 ? "Trail Ready" : "Show Truck";
  
  // Build tire search URL
  const buildTireUrl = () => {
    const params = new URLSearchParams();
    params.set("year", vehicleYear);
    params.set("make", vehicleMake);
    params.set("model", vehicleModel);
    if (modification) params.set("modification", modification);
    if (wheelDiameter) params.set("wheelDiameter", String(wheelDiameter));
    if (liftLevel) params.set("liftLevel", liftLevel);
    if (liftedInches) params.set("liftedInches", liftedInches);
    if (buildType) params.set("buildType", buildType);
    if (tireSizes.length > 0) {
      params.set("targetTireSizes", tireSizes.join(","));
    }
    return `/tires?${params.toString()}`;
  };
  
  const hasBuildContext = buildType || liftLevel;
  
  return (
    <div className={`rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        
        {/* Left: Visual Preview */}
        {hasBuildContext && inches > 0 && (
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className="rounded-xl bg-white border border-green-200 p-4">
              <TruckStancePreview liftInches={inches} tireSize={tireSizes[tireSizes.length - 1]} />
            </div>
            <div className="mt-2 text-center">
              <div className="text-xs font-semibold text-green-700">{useCaseLabel}</div>
              <div className="text-[10px] text-neutral-500">{liftConfig?.label || `${inches}" Lift`}</div>
            </div>
          </div>
        )}
        
        {/* Middle: Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛞</span>
            <h3 className="text-lg font-extrabold text-neutral-900">
              Complete Your Build with Tires
            </h3>
          </div>
          
          {/* Popularity Messaging */}
          {hasBuildContext && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-amber-500">🔥</span>
              <span className="text-sm font-semibold text-amber-700">
                Top choice for {inches}" lifted builds
              </span>
            </div>
          )}
          
          <p className="mt-2 text-sm text-neutral-600">
            {hasBuildContext && tireSizes.length > 0 ? (
              <>We'll show you <strong>{tireSizes.join("-")}" tires</strong> that match your {liftConfig?.label.toLowerCase() || "lifted"} setup.</>
            ) : (
              <>Find the perfect tires to complete your wheel and tire package.</>
            )}
          </p>
          
          {/* "Most Customers Choose" Block */}
          {hasBuildContext && (
            <div className="mt-4 rounded-xl bg-white border-2 border-amber-200 p-4">
              <div className="flex items-center gap-2 text-amber-700 mb-3">
                <span className="text-lg">⭐</span>
                <span className="text-sm font-bold">Most customers choose</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <div>
                  <div className="text-xs text-neutral-500">Tire Size</div>
                  <div className="font-bold text-neutral-900">{tireSizes[tireSizes.length - 1] || "35"}"</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Wheel Offset</div>
                  <div className="font-bold text-neutral-900">{liftConfig?.offsetMin || -24}mm</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Build Style</div>
                  <div className="font-bold text-neutral-900">{useCaseLabel}</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Package Tiers */}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-white border border-green-100 p-3">
              <div className="text-xs font-semibold text-neutral-500">Budget Build</div>
              <div className="text-sm font-bold text-neutral-900">From $800</div>
              <div className="text-xs text-neutral-500">Solid value</div>
            </div>
            <div className="rounded-lg bg-white border-2 border-green-300 p-3 relative">
              <div className="absolute -top-2 left-3 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">
                POPULAR
              </div>
              <div className="text-xs font-semibold text-green-600 mt-1">Premium Package</div>
              <div className="text-sm font-bold text-neutral-900">From $1,400</div>
              <div className="text-xs text-neutral-500">Best balance</div>
            </div>
            <div className="rounded-lg bg-white border border-green-100 p-3">
              <div className="text-xs font-semibold text-neutral-500">Show Build</div>
              <div className="text-sm font-bold text-neutral-900">From $2,200</div>
              <div className="text-xs text-neutral-500">Top brands</div>
            </div>
          </div>
          
          {/* CTA */}
          <Link
            href={buildTireUrl()}
            className="mt-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-8 py-4 text-base font-bold text-white hover:bg-green-700 transition-colors shadow-lg shadow-green-600/25"
          >
            <span>Complete My Build with Tires</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          
          {/* Trust signals */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="text-green-500">✓</span> Fitment guaranteed
            </span>
            <span className="flex items-center gap-1">
              <span className="text-green-500">✓</span> Free shipping $599+
            </span>
            <span className="flex items-center gap-1">
              <span className="text-green-500">✓</span> Expert support
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPACT VERSION
// ═══════════════════════════════════════════════════════════════════════════

export function PackageBridgeCompact({
  vehicleYear,
  vehicleMake,
  vehicleModel,
  modification,
  wheelDiameter,
}: PackageBridgeCTAProps) {
  const searchParams = useSearchParams();
  
  const liftLevel = searchParams.get("liftLevel") as LiftLevel | null;
  const liftedInches = searchParams.get("liftedInches");
  const buildType = searchParams.get("buildType");
  
  const liftConfig = liftLevel ? LIFT_LEVELS[liftLevel] : null;
  const tireSizes = liftConfig?.targetTireSizes || [];
  
  const buildTireUrl = () => {
    const params = new URLSearchParams();
    params.set("year", vehicleYear);
    params.set("make", vehicleMake);
    params.set("model", vehicleModel);
    if (modification) params.set("modification", modification);
    if (wheelDiameter) params.set("wheelDiameter", String(wheelDiameter));
    if (liftLevel) params.set("liftLevel", liftLevel);
    if (liftedInches) params.set("liftedInches", liftedInches);
    if (buildType) params.set("buildType", buildType);
    if (tireSizes.length > 0) {
      params.set("targetTireSizes", tireSizes.join(","));
    }
    return `/tires?${params.toString()}`;
  };
  
  return (
    <Link
      href={buildTireUrl()}
      className="flex items-center justify-between rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3 hover:bg-green-100 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">🛞</span>
        <div>
          <div className="text-sm font-bold text-neutral-900 group-hover:text-green-700">
            Complete My Build
          </div>
          {tireSizes.length > 0 && (
            <div className="text-xs text-neutral-600">{tireSizes.join("-")}" tires recommended</div>
          )}
        </div>
      </div>
      <svg className="h-5 w-5 text-green-600 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY EXPORT (BuildContextBar - non-sticky version)
// ═══════════════════════════════════════════════════════════════════════════

export function BuildContextBar() {
  const searchParams = useSearchParams();
  
  const buildType = searchParams.get("buildType");
  const liftLevel = searchParams.get("liftLevel") as LiftLevel | null;
  const liftedSource = searchParams.get("liftedSource");
  const liftedInches = searchParams.get("liftedInches");
  const offsetMin = searchParams.get("offsetMin");
  const offsetMax = searchParams.get("offsetMax");
  const liftKitSku = searchParams.get("liftKitSku");
  
  if (!buildType && !liftLevel && !liftedSource) {
    return null;
  }
  
  const liftConfig = liftLevel ? LIFT_LEVELS[liftLevel] : null;
  const inches = liftedInches ? parseInt(liftedInches) : liftConfig?.inches || 0;
  const tireSizes = liftConfig?.targetTireSizes || [];
  const offsetRange = offsetMin && offsetMax ? `${offsetMin} to ${offsetMax}mm` : null;
  
  const buildLabel = buildType === "stock" ? "Stock Fit" :
    buildType === "level" ? "Leveled" :
    buildType === "lifted" ? "Lifted" :
    liftLevel ? LIFT_LEVELS[liftLevel]?.label : "Custom";

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
      <div className="mx-auto max-w-7xl px-4 py-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-amber-200">🔧</span>
              <span className="font-bold">Your Build:</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                {buildLabel}
                {inches > 0 && ` (${inches}")`}
              </span>
            </div>
            
            {tireSizes.length > 0 && (
              <div className="hidden sm:flex items-center gap-1">
                <span className="text-amber-200">•</span>
                <span>{tireSizes.join("-")}" Tires</span>
              </div>
            )}
            
            {offsetRange && (
              <div className="hidden md:flex items-center gap-1">
                <span className="text-amber-200">•</span>
                <span>Offset {offsetRange}</span>
              </div>
            )}
            
            {liftKitSku && (
              <div className="hidden lg:flex items-center gap-1">
                <span className="text-amber-200">•</span>
                <span className="text-green-200">✓ Lift kit in cart</span>
              </div>
            )}
          </div>
          
          <Link
            href="/wheels"
            className="text-xs font-semibold text-white/80 hover:text-white underline"
          >
            Change Build
          </Link>
        </div>
      </div>
    </div>
  );
}
