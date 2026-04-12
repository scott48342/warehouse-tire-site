"use client";

/**
 * Wheel Size Gate Selector
 * 
 * BLOCKING fitment step for trims with multiple OEM wheel diameters.
 * This gates tire results - no results are shown until wheel size is selected.
 * 
 * Uses the same selector-step UX pattern as the main fitment flow.
 * NOT a filter - this is a required fitment selection.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";

// Re-export the logic functions for backwards compatibility
export { needsWheelSizeSelection, getAutoSelectedWheelDia } from "@/lib/tires/wheelSizeGate";

interface WheelSizeGateSelectorProps {
  /** Available OEM wheel diameters for this trim (e.g., [22, 24]) */
  availableDiameters: number[];
  /** Currently selected diameter (from URL param) */
  selectedDiameter: number | null;
  /** Base path for navigation (e.g., "/tires") */
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

export function WheelSizeGateSelector({
  availableDiameters,
  selectedDiameter,
  basePath,
  vehicle,
  onSelect,
}: WheelSizeGateSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track that the prompt was shown
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "wheel_size_prompt_shown", {
        event_category: "fitment",
        vehicle_year: vehicle?.year,
        vehicle_make: vehicle?.make,
        vehicle_model: vehicle?.model,
        vehicle_trim: vehicle?.trim,
        available_sizes: availableDiameters.join(","),
      });
    }
  }, [vehicle, availableDiameters]);

  const handleSelect = useCallback((diameter: number) => {
    // Track selection
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "wheel_size_selected", {
        event_category: "fitment",
        event_label: `${diameter}"`,
        wheel_diameter: diameter,
        vehicle_year: vehicle?.year,
        vehicle_make: vehicle?.make,
        vehicle_model: vehicle?.model,
      });
    }

    // Callback
    onSelect?.(diameter);

    // Update URL with selection
    const params = new URLSearchParams(searchParams.toString());
    params.set("wheelDia", String(diameter));
    // Clear any conflicting params
    params.delete("wheelDiaFront");
    params.delete("wheelDiaRear");
    
    const targetPath = basePath || pathname;
    router.push(`${targetPath}?${params.toString()}`);
  }, [router, pathname, searchParams, basePath, onSelect, vehicle]);

  // Sort diameters ascending
  const sortedDiameters = [...availableDiameters].sort((a, b) => a - b);

  return (
    <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white text-lg">
          🔘
        </span>
        <div>
          <h3 className="text-lg font-extrabold text-blue-900">
            What wheel size do you have?
          </h3>
          <p className="text-sm text-blue-700">
            Your selected trim came with multiple wheel size options
          </p>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-sm text-blue-800 mb-6">
        Choose your current wheel size to see the correct tire fitment for your{" "}
        <span className="font-semibold">
          {vehicle?.year} {vehicle?.make} {vehicle?.model}
          {vehicle?.trim ? ` ${vehicle.trim}` : ""}
        </span>.
      </p>

      {/* Wheel size options */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {sortedDiameters.map((diameter) => {
          const isSelected = selectedDiameter === diameter;
          
          return (
            <button
              key={diameter}
              onClick={() => handleSelect(diameter)}
              className={`
                relative flex flex-col items-center justify-center gap-2 rounded-xl p-6 text-center transition-all
                ${isSelected 
                  ? "bg-blue-600 text-white shadow-lg ring-2 ring-blue-600 ring-offset-2" 
                  : "bg-white text-neutral-900 border-2 border-neutral-200 hover:border-blue-400 hover:bg-blue-50"
                }
              `}
            >
              {/* Size */}
              <span className="text-3xl font-extrabold">
                {diameter}&quot;
              </span>
              <span className={`text-sm font-semibold ${isSelected ? 'text-blue-100' : 'text-neutral-600'}`}>
                wheels
              </span>
              
              {/* Selection indicator */}
              {isSelected && (
                <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-blue-600 text-sm font-bold">
                  ✓
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
          <span>Please select your wheel size to see tire options</span>
        </p>
      )}
    </div>
  );
}

export default WheelSizeGateSelector;
