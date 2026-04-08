"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { LIFT_LEVELS, getLiftLevelConfig } from "@/lib/homepage-intent/config";
import type { LiftLevel } from "@/lib/homepage-intent/types";

interface LiftLevelSelectorProps {
  currentLiftLevel: LiftLevel;
  className?: string;
}

/**
 * LiftLevelSelector
 * 
 * Shows lift level chips (Leveled, 4", 6", 8") in the Build Style area
 * for homepage intent lifted builds. Replaces the normal Stock/Level/Lifted toggle.
 */
export function LiftLevelSelector({ currentLiftLevel, className = "" }: LiftLevelSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleSelect = useCallback((liftLevel: LiftLevel) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Update lift level
    params.set("liftLevel", liftLevel);
    
    // Get offset range for this lift level and update
    const liftConfig = getLiftLevelConfig(liftLevel);
    if (liftConfig) {
      params.set("offsetMin", String(liftConfig.offsetMin));
      params.set("offsetMax", String(liftConfig.offsetMax));
      params.set("liftedInches", String(liftConfig.inches));
    }
    
    // Reset to page 1 when changing lift level
    params.set("page", "1");
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, searchParams, pathname]);

  const liftLevels = Object.values(LIFT_LEVELS);
  const currentConfig = getLiftLevelConfig(currentLiftLevel);

  return (
    <div className={className}>
      <div className="mb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
        Lift Height
      </div>
      <div className="flex flex-wrap gap-2">
        {liftLevels.map((level) => {
          const isActive = currentLiftLevel === level.id;
          return (
            <button
              key={level.id}
              onClick={() => handleSelect(level.id)}
              className={`
                inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-all
                ${isActive 
                  ? "bg-amber-600 text-white border-amber-600 shadow-md" 
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:border-amber-300"
                }
              `}
            >
              <span>⬆</span>
              <span>{level.label}</span>
              {isActive && (
                <svg className="h-3.5 w-3.5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Current selection info */}
      {currentConfig && (
        <div className="mt-2 text-xs text-amber-700">
          {currentConfig.label}: Offset {currentConfig.offsetMin}mm to {currentConfig.offsetMax}mm • 
          Fits {currentConfig.targetTireSizes.map(s => `${s}"`).join("-")} tires
        </div>
      )}
    </div>
  );
}
