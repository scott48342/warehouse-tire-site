"use client";

/**
 * Wheel Diameter Selector
 * 
 * Shows when a vehicle trim has multiple OEM wheel diameters (e.g., 22" and 24").
 * Prompts user to select their wheel size so we only show correct tire sizes.
 * 
 * CRITICAL: Prevents showing 24" tire sizes to users with 22" wheels.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

interface WheelDiameterSelectorProps {
  availableDiameters: number[];
  selectedDiameter: number | null;
  /** Base path for navigation (e.g., "/tires") */
  basePath?: string;
}

export function WheelDiameterSelector({
  availableDiameters,
  selectedDiameter,
  basePath = "/tires",
}: WheelDiameterSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = useCallback((diameter: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("wheelDia", String(diameter));
    // Remove any stale wheel size params that might conflict
    params.delete("wheelDiaFront");
    params.delete("wheelDiaRear");
    router.push(`${basePath}?${params.toString()}`);
  }, [router, searchParams, basePath]);

  if (availableDiameters.length <= 1) {
    return null; // No selector needed for single diameter
  }

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-sm text-white">⚠️</span>
        <h3 className="text-sm font-bold text-amber-900">
          What size wheels do you have?
        </h3>
      </div>
      
      <p className="text-xs text-amber-800 mb-4">
        Your vehicle comes with multiple wheel size options. Select your wheel diameter to see the correct tire sizes.
      </p>

      <div className="flex flex-wrap gap-3">
        {availableDiameters.map((diameter) => {
          const isSelected = selectedDiameter === diameter;
          return (
            <button
              key={diameter}
              onClick={() => handleSelect(diameter)}
              className={`
                flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all
                ${isSelected 
                  ? "bg-neutral-900 text-white shadow-md ring-2 ring-neutral-900 ring-offset-2" 
                  : "bg-white text-neutral-900 border-2 border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50"
                }
              `}
            >
              <span className="text-lg">{diameter}&quot;</span>
              <span className="text-xs opacity-80">wheels</span>
              {isSelected && (
                <span className="ml-1 text-green-400">✓</span>
              )}
            </button>
          );
        })}
      </div>

      {!selectedDiameter && (
        <p className="mt-3 text-xs text-amber-700 italic">
          👆 Please select your wheel size to continue
        </p>
      )}
    </div>
  );
}

/**
 * Inline wheel diameter badge (for compact display)
 */
export function WheelDiameterBadge({ 
  diameter, 
  onClick 
}: { 
  diameter: number; 
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-800 hover:bg-blue-200 transition-colors"
    >
      <span>{diameter}&quot; wheels</span>
      {onClick && <span className="text-blue-600">✕</span>}
    </button>
  );
}
