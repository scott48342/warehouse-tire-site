"use client";

import { useMemo } from "react";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE JOURNEY BAR
// Guides users through the wheel + tire package flow
// ═══════════════════════════════════════════════════════════════════════════════

export type JourneyStep = "wheels" | "tires" | "review";

type StepConfig = {
  id: JourneyStep;
  label: string;
  shortLabel: string;
  icon: string;
  href?: string;
};

const STEPS: StepConfig[] = [
  { id: "wheels", label: "Wheels", shortLabel: "Wheels", icon: "⚙️" },
  { id: "tires", label: "Tires", shortLabel: "Tires", icon: "🛞" },
  { id: "review", label: "Review", shortLabel: "Review", icon: "✓" },
];

function getStepIndex(step: JourneyStep): number {
  return STEPS.findIndex((s) => s.id === step);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE ESTIMATE CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
function calculateEstimate(params: {
  wheelSetPrice?: number | null;
  tireSetPrice?: number | null;
  hasAccessories?: boolean;
}): { min: number; max: number } | null {
  const { wheelSetPrice, tireSetPrice, hasAccessories } = params;

  // Need at least wheel price to estimate
  if (!wheelSetPrice && !tireSetPrice) return null;

  // Base estimates
  let min = 0;
  let max = 0;

  if (wheelSetPrice) {
    min += wheelSetPrice;
    max += wheelSetPrice;
  } else {
    // No wheels selected yet - estimate range
    min += 800; // Budget wheels set
    max += 2400; // Premium wheels set
  }

  if (tireSetPrice) {
    min += tireSetPrice;
    max += tireSetPrice;
  } else {
    // No tires selected yet - estimate range
    min += 600; // Budget tires set
    max += 1400; // Premium tires set
  }

  // TPMS sensors ($60-$100)
  min += 60;
  max += 100;

  // Installation ($80-$150)
  min += 80;
  max += 150;

  // Hub rings/accessories if needed ($20-$60)
  if (hasAccessories) {
    min += 20;
    max += 60;
  }

  return { min, max };
}

function formatPriceRange(range: { min: number; max: number }): string {
  const minRounded = Math.round(range.min / 100) * 100;
  const maxRounded = Math.round(range.max / 100) * 100;
  return `$${minRounded.toLocaleString()}–$${maxRounded.toLocaleString()}`;
}

export function PackageJourneyBar({
  currentStep,
  wheelSetPrice,
  tireSetPrice,
  hasAccessories = false,
  vehicleParams,
  className = "",
}: {
  currentStep: JourneyStep;
  wheelSetPrice?: number | null;
  tireSetPrice?: number | null;
  hasAccessories?: boolean;
  vehicleParams?: Record<string, string | undefined>;
  className?: string;
}) {
  const currentIndex = getStepIndex(currentStep);
  const nextStep = STEPS[currentIndex + 1];

  const estimate = useMemo(
    () => calculateEstimate({ wheelSetPrice, tireSetPrice, hasAccessories }),
    [wheelSetPrice, tireSetPrice, hasAccessories]
  );

  // Build URLs for each step
  const buildUrl = (step: JourneyStep): string => {
    const params = new URLSearchParams();
    if (vehicleParams) {
      for (const [k, v] of Object.entries(vehicleParams)) {
        if (v) params.set(k, v);
      }
    }
    params.set("package", "1");

    switch (step) {
      case "wheels":
        return `/wheels?${params.toString()}`;
      case "tires":
        return `/tires?${params.toString()}`;
      case "review":
        return `/package/review?${params.toString()}`;
      default:
        return "#";
    }
  };

  return (
    <div
      className={`sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-sm ${className}`}
    >
      <div className="mx-auto max-w-screen-2xl px-4">
        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between py-3">
          {/* Left: Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-sm">
              📦
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Build Your Package</h2>
              <p className="text-xs text-neutral-500">
                Step {currentIndex + 1} of {STEPS.length}
              </p>
            </div>
          </div>

          {/* Center: Step Indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => {
              const isActive = step.id === currentStep;
              const isComplete = index < currentIndex;
              const isFuture = index > currentIndex;

              return (
                <div key={step.id} className="flex items-center">
                  {/* Connector line */}
                  {index > 0 && (
                    <div
                      className={`h-0.5 w-8 mx-1 ${
                        isComplete ? "bg-green-500" : "bg-neutral-200"
                      }`}
                    />
                  )}

                  {/* Step circle + label */}
                  {isComplete || isActive ? (
                    <Link
                      href={buildUrl(step.id)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-all ${
                        isActive
                          ? "bg-red-600 text-white shadow-md"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      <span className="text-sm">{isComplete ? "✓" : step.icon}</span>
                      <span className="text-sm font-semibold">{step.label}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-neutral-100 text-neutral-400">
                      <span className="text-sm">{step.icon}</span>
                      <span className="text-sm font-medium">{step.label}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Price Estimate */}
          <div className="text-right">
            {estimate ? (
              <>
                <div className="text-xs text-neutral-500">Estimated total</div>
                <div className="text-sm font-bold text-neutral-900">
                  {formatPriceRange(estimate)}
                </div>
              </>
            ) : (
              <div className="text-xs text-neutral-400">Select wheels to see estimate</div>
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="sm:hidden py-3">
          {/* Top row: Title + Price */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📦</span>
              <span className="text-sm font-bold text-neutral-900">Build Your Package</span>
            </div>
            {estimate && (
              <div className="text-right">
                <div className="text-[10px] text-neutral-500">Est. total</div>
                <div className="text-xs font-bold text-neutral-900">
                  {formatPriceRange(estimate)}
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-1">
            {STEPS.map((step, index) => {
              const isActive = step.id === currentStep;
              const isComplete = index < currentIndex;

              return (
                <div key={step.id} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      isComplete
                        ? "bg-green-500"
                        : isActive
                        ? "bg-red-600"
                        : "bg-neutral-200"
                    }`}
                  />
                  <div
                    className={`mt-1 text-center text-[10px] font-medium ${
                      isActive
                        ? "text-red-600"
                        : isComplete
                        ? "text-green-600"
                        : "text-neutral-400"
                    }`}
                  >
                    {isComplete ? "✓" : ""} {step.shortLabel}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Context text */}
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-neutral-600">
            <span>
              You're on: <strong>{STEPS[currentIndex].label}</strong>
            </span>
            {nextStep && (
              <>
                <span className="text-neutral-300">→</span>
                <span>
                  Next: <strong>{nextStep.label}</strong>
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINI VARIANT (for use in sidebars or compact spaces)
// ═══════════════════════════════════════════════════════════════════════════════
export function PackageJourneyBarMini({
  currentStep,
  wheelSetPrice,
  tireSetPrice,
  vehicleParams,
}: {
  currentStep: JourneyStep;
  wheelSetPrice?: number | null;
  tireSetPrice?: number | null;
  vehicleParams?: Record<string, string | undefined>;
}) {
  const currentIndex = getStepIndex(currentStep);
  const nextStep = STEPS[currentIndex + 1];

  const estimate = useMemo(
    () => calculateEstimate({ wheelSetPrice, tireSetPrice }),
    [wheelSetPrice, tireSetPrice]
  );

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📦</span>
        <span className="text-sm font-bold text-neutral-900">Build Your Package</span>
      </div>

      {/* Mini progress dots */}
      <div className="flex items-center justify-center gap-3 mb-3">
        {STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isComplete = index < currentIndex;

          return (
            <div key={step.id} className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                  isComplete
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-red-600 text-white"
                    : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {isComplete ? "✓" : step.icon}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isActive ? "text-red-600" : isComplete ? "text-green-600" : "text-neutral-400"
                }`}
              >
                {step.shortLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Context */}
      <div className="text-center text-xs text-neutral-600 mb-3">
        <span>
          You're on: <strong>{STEPS[currentIndex].label}</strong>
        </span>
        {nextStep && (
          <span className="ml-2">
            → Next: <strong>{nextStep.label}</strong>
          </span>
        )}
      </div>

      {/* Price estimate */}
      {estimate && (
        <div className="rounded-lg bg-neutral-50 p-2 text-center">
          <div className="text-[10px] text-neutral-500">Estimated total</div>
          <div className="text-sm font-bold text-neutral-900">{formatPriceRange(estimate)}</div>
        </div>
      )}
    </div>
  );
}
