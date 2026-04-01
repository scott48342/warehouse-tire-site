"use client";

/**
 * FitmentDiameterChips
 * 
 * Shows fitment-valid wheel diameter options as clickable chips.
 * Positioned below Package Estimate, above Top Picks.
 * 
 * Data Sources:
 * - Classic vehicles: Stock diameter + upsize range (15-20")
 * - Modern vehicles: OEM wheel sizes from fitment profile
 * 
 * Behavior:
 * - Clicking a chip updates URL with diameter param
 * - Updates wheel results, Top Picks, and tire context
 * - Preserves other active filters
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { DiameterOption } from "@/lib/fitment/diameterOptions";

// Re-export for convenience
export type { DiameterOption } from "@/lib/fitment/diameterOptions";
export { buildDiameterOptions, type BuildDiameterOptionsParams } from "@/lib/fitment/diameterOptions";

export interface FitmentDiameterChipsProps {
  /** Available diameter options */
  diameters: DiameterOption[];
  /** Currently selected diameter */
  selectedDiameter?: number | null;
  /** Whether this is a classic vehicle */
  isClassicVehicle?: boolean;
  /** Whether this is a lifted build */
  isLiftedBuild?: boolean;
  /** Stock tire/wheel diameter for reference */
  stockDiameter?: number;
  /** Callback when diameter changes (optional, defaults to URL update) */
  onDiameterChange?: (diameter: number | null) => void;
  /** Show inventory counts */
  showCounts?: boolean;
  /** Compact mode for mobile */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function FitmentDiameterChips({
  diameters,
  selectedDiameter,
  isClassicVehicle = false,
  isLiftedBuild = false,
  stockDiameter,
  onDiameterChange,
  showCounts = false,
  compact = false,
  className = "",
}: FitmentDiameterChipsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Build URL with new diameter
  const buildUrl = useCallback(
    (diameter: number | null) => {
      const params = new URLSearchParams(searchParams.toString());
      
      if (diameter !== null) {
        params.set("diameter", String(diameter));
      } else {
        params.delete("diameter");
      }
      
      // Reset to page 1 when changing diameter
      params.delete("page");
      
      return `?${params.toString()}`;
    },
    [searchParams]
  );

  // Handle chip click
  const handleClick = useCallback(
    (diameter: number | null) => {
      if (onDiameterChange) {
        onDiameterChange(diameter);
      } else {
        router.push(buildUrl(diameter), { scroll: false });
      }
    },
    [onDiameterChange, router, buildUrl]
  );

  // Sort diameters
  const sortedDiameters = useMemo(() => {
    return [...diameters].sort((a, b) => a.diameter - b.diameter);
  }, [diameters]);

  if (diameters.length === 0) {
    return null;
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold text-neutral-900 ${compact ? "text-sm" : "text-base"}`}>
            Wheel Size
          </h3>
          {isLiftedBuild && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              Lifted
            </span>
          )}
          {isClassicVehicle && !isLiftedBuild && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Classic
            </span>
          )}
        </div>
        {selectedDiameter && (
          <button
            onClick={() => handleClick(null)}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {sortedDiameters.map((option) => {
          const isSelected = selectedDiameter === option.diameter;
          const isDisabled = option.hasInventory === false;
          
          return (
            <button
              key={option.diameter}
              onClick={() => !isDisabled && handleClick(option.diameter)}
              disabled={isDisabled}
              className={`
                relative inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 
                text-sm font-semibold transition-all duration-200
                ${isSelected
                  ? "border-red-500 bg-red-50 text-red-700 shadow-sm"
                  : isDisabled
                    ? "border-neutral-100 bg-neutral-50 text-neutral-300 cursor-not-allowed"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-red-200 hover:bg-red-50/50"
                }
                ${compact ? "px-2.5 py-1.5 text-xs" : ""}
              `}
            >
              {/* Diameter value */}
              <span>{option.diameter}&quot;</span>
              
              {/* Stock badge */}
              {option.isStock && (
                <span className={`
                  rounded px-1 py-0.5 text-[10px] font-bold uppercase
                  ${isSelected ? "bg-red-200 text-red-800" : "bg-green-100 text-green-700"}
                `}>
                  Stock
                </span>
              )}
              
              {/* Upsize indicator */}
              {option.isUpsize && !option.isStock && (
                <span className={`
                  rounded px-1 py-0.5 text-[10px] font-bold uppercase
                  ${isSelected ? "bg-red-200 text-red-800" : "bg-amber-100 text-amber-700"}
                `}>
                  +
                </span>
              )}
              
              {/* Count badge */}
              {showCounts && option.count !== undefined && option.count > 0 && (
                <span className={`
                  text-[10px] font-medium
                  ${isSelected ? "text-red-600" : "text-neutral-400"}
                `}>
                  ({option.count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Helper text showing stock size and upsize info */}
      {isLiftedBuild ? (
        <p className="mt-2 text-xs text-neutral-500">
          Recommended sizes for your lift • Select to filter
        </p>
      ) : stockDiameter && sortedDiameters.some(d => d.isUpsize) ? (
        <p className="mt-2 text-xs text-neutral-500">
          Stock: {stockDiameter}&quot; • Showing fitment-compatible upsizes
        </p>
      ) : null}
    </div>
  );
}

export default FitmentDiameterChips;
