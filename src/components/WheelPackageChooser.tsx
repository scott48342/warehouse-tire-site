"use client";

/**
 * Wheel Package Chooser
 * 
 * BLOCKING fitment step for trims with multiple OEM wheel packages.
 * This gates wheel results - no results are shown until package is selected.
 * 
 * Used when a trim like "Ram 1500 Big Horn" has multiple factory wheel options
 * (e.g., 18" Standard vs 20" Sport Package).
 * 
 * After selection, applies wheelDiameter filter and proceeds to results.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";

export interface PackageChoiceOption {
  wheelDiameter: number;
  tireSize: string;
  tireSizeRear: string | null;
  packageLabel: string;
  packageDescription: string | null;
  isStaggered: boolean;
}

interface WheelPackageChooserProps {
  /** Available package choices for this trim */
  choices: PackageChoiceOption[];
  /** Title for the chooser */
  title: string;
  /** Helper text */
  helperText: string;
  /** Currently selected wheel diameter (from URL param) */
  selectedDiameter: number | null;
  /** Base path for navigation (e.g., "/wheels") */
  basePath?: string;
  /** Vehicle info for display */
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  /** Callback when selection is made */
  onSelect?: (diameter: number) => void;
}

export function WheelPackageChooser({
  choices,
  title,
  helperText,
  selectedDiameter,
  basePath,
  vehicle,
  onSelect,
}: WheelPackageChooserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track that the prompt was shown
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "wheel_package_prompt_shown", {
        event_category: "fitment",
        vehicle_year: vehicle?.year,
        vehicle_make: vehicle?.make,
        vehicle_model: vehicle?.model,
        vehicle_trim: vehicle?.trim,
        package_count: choices.length,
      });
    }
  }, [vehicle, choices]);

  const handleSelect = useCallback((diameter: number, packageLabel: string) => {
    // Track selection
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "wheel_package_selected", {
        event_category: "fitment",
        event_label: packageLabel,
        wheel_diameter: diameter,
        vehicle_year: vehicle?.year,
        vehicle_make: vehicle?.make,
        vehicle_model: vehicle?.model,
      });
    }

    // Callback
    onSelect?.(diameter);

    // Update URL with selection - use wheelDia to filter wheel results
    const params = new URLSearchParams(searchParams.toString());
    params.set("wheelDia", String(diameter));
    // Also set diameter filter for wheel search
    params.set("diameter", String(diameter));
    
    const targetPath = basePath || pathname;
    router.push(`${targetPath}?${params.toString()}`);
  }, [router, pathname, searchParams, basePath, onSelect, vehicle]);

  // Sort choices by wheel diameter ascending
  const sortedChoices = [...choices].sort((a, b) => a.wheelDiameter - b.wheelDiameter);

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white text-lg">
          🔘
        </span>
        <div>
          <h3 className="text-lg font-extrabold text-amber-900">
            {title}
          </h3>
          <p className="text-sm text-amber-700">
            {helperText}
          </p>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-sm text-amber-800 mb-6">
        Select the factory wheel package for your{" "}
        <span className="font-semibold">
          {vehicle?.year} {vehicle?.make} {vehicle?.model}
          {vehicle?.trim ? ` ${vehicle.trim}` : ""}
        </span>{" "}
        to see compatible aftermarket wheels.
      </p>

      {/* Package options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sortedChoices.map((choice) => {
          const isSelected = selectedDiameter === choice.wheelDiameter;
          
          return (
            <button
              key={choice.wheelDiameter}
              onClick={() => handleSelect(choice.wheelDiameter, choice.packageLabel)}
              className={`
                relative flex flex-col items-start justify-center gap-2 rounded-xl p-5 text-left transition-all
                ${isSelected 
                  ? "bg-amber-600 text-white shadow-lg ring-2 ring-amber-600 ring-offset-2" 
                  : "bg-white text-neutral-900 border-2 border-neutral-200 hover:border-amber-400 hover:bg-amber-50"
                }
              `}
            >
              {/* Wheel size badge */}
              <span className={`
                inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold
                ${isSelected ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800'}
              `}>
                {choice.wheelDiameter}&quot; Wheels
              </span>
              
              {/* Package label */}
              <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-neutral-900'}`}>
                {choice.packageLabel}
              </span>
              
              {/* Package description */}
              {choice.packageDescription && (
                <span className={`text-sm ${isSelected ? 'text-amber-100' : 'text-neutral-500'}`}>
                  {choice.packageDescription}
                </span>
              )}
              
              {/* Tire size info */}
              <span className={`text-xs font-mono ${isSelected ? 'text-amber-200' : 'text-neutral-400'}`}>
                OEM: {choice.tireSize}
                {choice.tireSizeRear && choice.tireSizeRear !== choice.tireSize && (
                  <> / {choice.tireSizeRear} (staggered)</>
                )}
              </span>
              
              {/* Selection indicator */}
              {isSelected && (
                <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-amber-600 text-sm font-bold">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Required selection prompt */}
      {!selectedDiameter && (
        <p className="mt-6 text-sm text-amber-700 italic flex items-center gap-2">
          <span>👆</span>
          <span>Please select your factory wheel package to see compatible wheels</span>
        </p>
      )}
    </div>
  );
}

export default WheelPackageChooser;
