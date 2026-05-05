"use client";

/**
 * OEM Package Chooser
 * 
 * Customer-friendly package selector for multi-config trims.
 * Shows descriptive package labels instead of raw wheel sizes.
 * 
 * Example:
 * - "18" Standard Big Horn" with subtext "275/65R18"
 * - "20" Sport / Night / Off-Road Package" with subtext "275/55R20"
 * 
 * Falls back to WheelSizeGateSelector when no package labels are available.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";
import type { PackageChoiceOption } from "@/lib/fitment/oemPackageChoices";
import { WheelSizeGateSelector } from "./WheelSizeGateSelector";

interface OemPackageChooserProps {
  /** Available wheel diameters (fallback if no package choices) */
  availableDiameters: number[];
  /** Currently selected diameter */
  selectedDiameter: number | null;
  /** OEM package choices with customer-friendly labels */
  packageChoices: {
    available: boolean;
    choices: PackageChoiceOption[];
    title: string;
    helperText: string;
  };
  /** Vehicle info for display */
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  /** Base path for navigation */
  basePath?: string;
  /** Callback when selection is made */
  onSelect?: (diameter: number, tireSize: string) => void;
}

export function OemPackageChooser({
  availableDiameters,
  selectedDiameter,
  packageChoices,
  vehicle,
  basePath,
  onSelect,
}: OemPackageChooserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // If no package choices available, fall back to generic selector
  if (!packageChoices.available || packageChoices.choices.length === 0) {
    return (
      <WheelSizeGateSelector
        availableDiameters={availableDiameters}
        selectedDiameter={selectedDiameter}
        vehicle={vehicle}
        basePath={basePath}
        onSelect={onSelect ? (d) => onSelect(d, "") : undefined}
      />
    );
  }

  // Track prompt shown
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "oem_package_prompt_shown", {
        event_category: "fitment",
        vehicle_year: vehicle?.year,
        vehicle_make: vehicle?.make,
        vehicle_model: vehicle?.model,
        vehicle_trim: vehicle?.trim,
        package_count: packageChoices.choices.length,
      });
    }
  }, [vehicle, packageChoices.choices.length]);

  const handleSelect = useCallback((choice: PackageChoiceOption) => {
    // Track selection
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "oem_package_selected", {
        event_category: "fitment",
        event_label: choice.packageLabel,
        wheel_diameter: choice.wheelDiameter,
        tire_size: choice.tireSize,
        vehicle_year: vehicle?.year,
        vehicle_make: vehicle?.make,
        vehicle_model: vehicle?.model,
      });
    }

    // Callback
    onSelect?.(choice.wheelDiameter, choice.tireSize);

    // Update URL with selection
    const params = new URLSearchParams(searchParams.toString());
    params.set("wheelDia", String(choice.wheelDiameter));
    // Also set the tire size for accurate searches
    params.set("tireSize", choice.tireSize);
    if (choice.tireSizeRear) {
      params.set("tireSizeRear", choice.tireSizeRear);
    }
    // Clear any conflicting params
    params.delete("wheelDiaFront");
    params.delete("wheelDiaRear");
    
    const targetPath = basePath || pathname;
    router.push(`${targetPath}?${params.toString()}`);
  }, [router, pathname, searchParams, basePath, onSelect, vehicle]);

  // Sort by display order / diameter
  const sortedChoices = [...packageChoices.choices].sort(
    (a, b) => a.wheelDiameter - b.wheelDiameter
  );

  return (
    <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white text-lg">
          🔧
        </span>
        <div>
          <h3 className="text-lg font-extrabold text-blue-900">
            {packageChoices.title || "Select your factory wheel package"}
          </h3>
          <p className="text-sm text-blue-700">
            {packageChoices.helperText || "Choose the setup that matches your vehicle"}
          </p>
        </div>
      </div>

      {/* Vehicle context */}
      {vehicle && (
        <p className="text-sm text-blue-800 mb-6">
          Choose the factory configuration for your{" "}
          <span className="font-semibold">
            {vehicle.year} {vehicle.make} {vehicle.model}
            {vehicle.trim ? ` ${vehicle.trim}` : ""}
          </span>
        </p>
      )}

      {/* Package options */}
      <div className="space-y-3">
        {sortedChoices.map((choice) => {
          const isSelected = selectedDiameter === choice.wheelDiameter;
          
          return (
            <button
              key={choice.wheelDiameter}
              onClick={() => handleSelect(choice)}
              className={`
                relative w-full flex items-center gap-4 rounded-xl p-4 text-left transition-all
                ${isSelected 
                  ? "bg-blue-600 text-white shadow-lg ring-2 ring-blue-600 ring-offset-2" 
                  : "bg-white text-neutral-900 border-2 border-neutral-200 hover:border-blue-400 hover:bg-blue-50"
                }
              `}
            >
              {/* Wheel size badge */}
              <div className={`
                flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg font-extrabold text-xl
                ${isSelected ? "bg-blue-500 text-white" : "bg-neutral-100 text-neutral-800"}
              `}>
                {choice.wheelDiameter}&quot;
              </div>
              
              {/* Label and tire size */}
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-base ${isSelected ? "text-white" : "text-neutral-900"}`}>
                  {choice.packageLabel}
                </div>
                <div className={`text-sm ${isSelected ? "text-blue-100" : "text-neutral-500"}`}>
                  {choice.tireSize}
                  {choice.tireSizeRear && choice.tireSizeRear !== choice.tireSize && (
                    <span> / {choice.tireSizeRear} (rear)</span>
                  )}
                </div>
                {choice.packageDescription && (
                  <div className={`text-xs mt-1 ${isSelected ? "text-blue-200" : "text-neutral-400"}`}>
                    {choice.packageDescription}
                  </div>
                )}
              </div>
              
              {/* Selection indicator */}
              {isSelected && (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue-600 text-lg font-bold">
                  ✓
                </span>
              )}
              
              {/* Staggered indicator */}
              {choice.isStaggered && (
                <span className={`
                  absolute top-2 right-2 rounded px-2 py-0.5 text-xs font-semibold
                  ${isSelected ? "bg-blue-500 text-blue-100" : "bg-amber-100 text-amber-700"}
                `}>
                  Staggered
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Required selection prompt */}
      {!selectedDiameter && (
        <p className="mt-6 text-sm text-blue-700 italic flex items-center gap-2">
          <span>👆</span>
          <span>Please select your factory wheel package to see tire options</span>
        </p>
      )}
    </div>
  );
}

export default OemPackageChooser;
