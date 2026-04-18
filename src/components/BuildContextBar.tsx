"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LIFT_LEVELS } from "@/lib/homepage-intent/config";
import type { LiftLevel } from "@/lib/homepage-intent/types";

/**
 * BuildContextBar
 * 
 * Shows the current build context (lift level, tire size, offset range)
 * at the top of the wheels/tires page when coming from the build flow.
 */
export function BuildContextBar() {
  const searchParams = useSearchParams();
  
  const buildType = searchParams.get("buildType");
  const liftLevel = searchParams.get("liftLevel") as LiftLevel | null;
  const liftedSource = searchParams.get("liftedSource");
  const liftedInches = searchParams.get("liftedInches");
  const offsetMin = searchParams.get("offsetMin");
  const offsetMax = searchParams.get("offsetMax");
  const liftKitSku = searchParams.get("liftKitSku");
  
  // Only show if we have build context
  if (!buildType && !liftLevel && !liftedSource) {
    return null;
  }
  
  // Get lift config
  const liftConfig = liftLevel ? LIFT_LEVELS[liftLevel] : null;
  const inches = liftedInches ? parseInt(liftedInches) : liftConfig?.inches || 0;
  const tireSizes = liftConfig?.targetTireSizes || [];
  const offsetRange = offsetMin && offsetMax ? `${offsetMin} to ${offsetMax}mm` : null;
  
  // Display text
  const buildLabel = buildType === "stock" ? "Stock Fit" :
    buildType === "level" ? "Leveled" :
    buildType === "lifted" ? "Lifted" :
    liftLevel ? LIFT_LEVELS[liftLevel]?.label : "Custom";

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
      <div className="mx-auto max-w-7xl px-4 py-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Left: Build Info */}
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
          
          {/* Right: Change Build Link */}
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

/**
 * PackageBridgeCTA
 * 
 * Shows a CTA to add tires after selecting wheels.
 * Pre-filters tires by the recommended size range from the build context.
 */
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
  
  // Get recommended tire sizes
  const liftConfig = liftLevel ? LIFT_LEVELS[liftLevel] : null;
  const tireSizes = liftConfig?.targetTireSizes || [];
  
  // Build tire search URL with filters
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
    // Pass tire size recommendations
    if (tireSizes.length > 0) {
      params.set("targetTireSizes", tireSizes.join(","));
    }
    return `/tires?${params.toString()}`;
  };
  
  // Only show if we have build context
  const hasBuildContext = buildType || liftLevel;
  
  return (
    <div className={`rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-2xl">🛞</span>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-extrabold text-neutral-900">
            Complete Your Build with Tires
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            {hasBuildContext && tireSizes.length > 0 ? (
              <>We'll show you <strong>{tireSizes.join("-")}" tires</strong> that match your {liftConfig?.label.toLowerCase() || "lifted"} setup.</>
            ) : (
              <>Find the perfect tires to complete your wheel and tire package.</>
            )}
          </p>
          
          {/* Recommended Packages Preview */}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-white border border-green-100 p-3">
              <div className="text-xs font-semibold text-neutral-500">Budget Build</div>
              <div className="text-sm font-bold text-neutral-900">From $800</div>
              <div className="text-xs text-neutral-500">Wheels + Tires</div>
            </div>
            <div className="rounded-lg bg-white border-2 border-green-300 p-3">
              <div className="text-xs font-semibold text-green-600">Most Popular</div>
              <div className="text-sm font-bold text-neutral-900">From $1,400</div>
              <div className="text-xs text-neutral-500">Premium Package</div>
            </div>
            <div className="rounded-lg bg-white border border-green-100 p-3">
              <div className="text-xs font-semibold text-neutral-500">Show Build</div>
              <div className="text-sm font-bold text-neutral-900">From $2,200</div>
              <div className="text-xs text-neutral-500">Top Brands</div>
            </div>
          </div>
          
          <Link
            href={buildTireUrl()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white hover:bg-green-700 transition-colors"
          >
            <span>Add Tires to Complete This Build</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version for inline use
 */
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
      className="flex items-center justify-between rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3 hover:bg-green-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">🛞</span>
        <div>
          <div className="text-sm font-bold text-neutral-900">Add Tires</div>
          {tireSizes.length > 0 && (
            <div className="text-xs text-neutral-600">{tireSizes.join("-")}" recommended</div>
          )}
        </div>
      </div>
      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
