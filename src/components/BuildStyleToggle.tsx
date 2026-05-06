"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { LIFT_LEVELS, getLiftLevelConfig } from "@/lib/homepage-intent/config";
import type { LiftLevel } from "@/lib/homepage-intent/types";

export type BuildType = "stock" | "level" | "lifted" | null;

interface BuildStyleToggleProps {
  currentBuildType: BuildType;
  vehicleType?: "truck" | "suv" | "car";
  className?: string;
  /** Current lift level when in lifted mode */
  currentLiftLevel?: LiftLevel | null;
  /** Show lift level selector when lifted is active */
  showLiftLevels?: boolean;
}

const BUILD_STYLES = [
  {
    value: "stock" as const,
    label: "Stock Fit",
    shortLabel: "Stock",
    icon: "✓",
    description: "Factory ride. No modifications needed.",
    color: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200",
    activeColor: "bg-green-600 text-white border-green-600",
  },
  {
    value: "level" as const,
    label: "Leveled",
    shortLabel: "Level",
    icon: "↕",
    description: "Better stance. Minimal mods.",
    color: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200",
    activeColor: "bg-blue-600 text-white border-blue-600",
  },
  {
    value: "lifted" as const,
    label: "Lifted",
    shortLabel: "Lifted",
    icon: "⬆",
    description: "Big wheels. Wide stance. Maximum presence.",
    color: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200",
    activeColor: "bg-orange-600 text-white border-orange-600",
  },
];

export function BuildStyleToggle({ 
  currentBuildType, 
  vehicleType, 
  className = "",
  currentLiftLevel,
  showLiftLevels = true,
}: BuildStyleToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleSelect = useCallback((buildType: BuildType) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (buildType) {
      params.set("buildType", buildType);
      
      // Set appropriate offset ranges based on build type
      if (buildType === "stock") {
        // Stock mode: strict OEM-friendly range
        // Most trucks/SUVs have OEM offsets between 0 and +50mm
        // No negative offsets - those require modifications
        params.set("offsetMin", "0");
        params.set("offsetMax", "50");
        // Clear ALL lifted params
        params.delete("liftLevel");
        params.delete("liftedInches");
        params.delete("liftedSource");
        params.delete("liftedPreset");
        params.delete("liftedTireSizes");
      } else if (buildType === "level") {
        // Leveled mode: allows slightly wider wheels
        // -12mm to +35mm range works for most leveled trucks
        params.set("offsetMin", "-12");
        params.set("offsetMax", "35");
        // Clear ALL lifted params
        params.delete("liftLevel");
        params.delete("liftedInches");
        params.delete("liftedSource");
        params.delete("liftedPreset");
        params.delete("liftedTireSizes");
      } else if (buildType === "lifted") {
        // If selecting lifted and no lift level set, default to 4in
        const currentLiftLevel = params.get("liftLevel") || "4in";
        params.set("liftLevel", currentLiftLevel);
        const liftConfig = getLiftLevelConfig(currentLiftLevel as LiftLevel);
        if (liftConfig) {
          params.set("offsetMin", String(liftConfig.offsetMin));
          params.set("offsetMax", String(liftConfig.offsetMax));
          params.set("liftedInches", String(liftConfig.inches));
          // CRITICAL: Set liftedSource and liftedPreset for tire page context
          params.set("liftedSource", "lifted");
          params.set("liftedPreset", currentLiftLevel);
          // Set recommended tire sizes for this lift level
          params.set("liftedTireSizes", liftConfig.targetTireSizes.join(","));
        }
      }
    } else {
      params.delete("buildType");
      // Clear ALL lifted params when deselecting
      params.delete("liftLevel");
      params.delete("liftedInches");
      params.delete("liftedSource");
      params.delete("liftedPreset");
      params.delete("liftedTireSizes");
      params.delete("offsetMin");
      params.delete("offsetMax");
    }
    
    // Reset to page 1 when changing build type
    params.set("page", "1");
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, searchParams, pathname]);

  const handleLiftLevelSelect = useCallback((liftLevel: LiftLevel) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Ensure we're in lifted mode
    params.set("buildType", "lifted");
    params.set("liftLevel", liftLevel);
    
    // Get offset range for this lift level and update
    const liftConfig = getLiftLevelConfig(liftLevel);
    if (liftConfig) {
      params.set("offsetMin", String(liftConfig.offsetMin));
      params.set("offsetMax", String(liftConfig.offsetMax));
      params.set("liftedInches", String(liftConfig.inches));
      // CRITICAL: Set liftedSource and liftedPreset for tire page context
      params.set("liftedSource", "lifted");
      params.set("liftedPreset", liftLevel);
      // Set recommended tire sizes for this lift level
      params.set("liftedTireSizes", liftConfig.targetTireSizes.join(","));
    }
    
    // Reset to page 1 when changing lift level
    params.set("page", "1");
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, searchParams, pathname]);

  // Don't show leveled option for cars (they don't have leveling kits)
  const filteredStyles = vehicleType === "car" 
    ? BUILD_STYLES.filter(s => s.value !== "level" && s.value !== "lifted")
    : BUILD_STYLES;

  const isLifted = currentBuildType === "lifted";
  const liftLevels = Object.values(LIFT_LEVELS);
  const activeLiftLevel = currentLiftLevel || "4in";
  const currentConfig = getLiftLevelConfig(activeLiftLevel);

  return (
    <div className={`${className}`}>
      <div className="mb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
        Build Style
      </div>
      <div className="flex flex-wrap gap-2">
        {filteredStyles.map((style) => {
          const isActive = currentBuildType === style.value;
          return (
            <button
              key={style.value}
              onClick={() => handleSelect(isActive ? null : style.value)}
              className={`
                inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-all
                ${isActive ? style.activeColor : style.color}
              `}
              title={style.description}
            >
              <span>{style.icon}</span>
              <span className="hidden sm:inline">{style.label}</span>
              <span className="sm:hidden">{style.shortLabel}</span>
            </button>
          );
        })}
        
        {/* Clear button when a build type is selected */}
        {currentBuildType && (
          <button
            onClick={() => handleSelect(null)}
            className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition-all"
          >
            <span>×</span>
            <span className="hidden sm:inline">Show All</span>
          </button>
        )}
      </div>
      
      {/* Description for selected style */}
      {currentBuildType && !isLifted && (
        <div className="mt-2 text-xs text-neutral-500">
          {BUILD_STYLES.find(s => s.value === currentBuildType)?.description}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          LIFT LEVEL SELECTOR - Shows when Lifted is selected
          Allows customer to pick their lift height (Leveled, 4", 6", 8")
          ═══════════════════════════════════════════════════════════════════════ */}
      {isLifted && showLiftLevels && vehicleType !== "car" && (
        <div className="mt-4 rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
          <div className="mb-2 text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Select Your Lift Height
          </div>
          <div className="flex flex-wrap gap-2">
            {liftLevels.map((level) => {
              const isLevelActive = activeLiftLevel === level.id;
              return (
                <button
                  key={level.id}
                  onClick={() => handleLiftLevelSelect(level.id)}
                  className={`
                    inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-all
                    ${isLevelActive 
                      ? "bg-amber-600 text-white border-amber-600 shadow-md" 
                      : "bg-white text-amber-800 border-amber-300 hover:bg-amber-100 hover:border-amber-400"
                    }
                  `}
                >
                  <span>⬆</span>
                  <span>{level.label}</span>
                  {isLevelActive && (
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
            <div className="mt-3 text-xs text-amber-700">
              <span className="font-semibold">{currentConfig.label}:</span>{" "}
              Offset {currentConfig.offsetMin}mm to {currentConfig.offsetMax}mm • 
              Fits {(() => {
                // Extract unique overall diameters from tire sizes (e.g., "37x12.50R22" → "37", "285/70R17" → ~33)
                const diameters = new Set<number>();
                currentConfig.targetTireSizes.forEach(s => {
                  const flotation = s.match(/^(\d+)x/);
                  if (flotation) {
                    diameters.add(parseInt(flotation[1], 10));
                  } else {
                    const metric = s.match(/^(\d+)\/(\d+)R(\d+)/);
                    if (metric) {
                      const width = parseInt(metric[1], 10);
                      const aspect = parseInt(metric[2], 10);
                      const rim = parseInt(metric[3], 10);
                      const od = Math.round((width * aspect / 100 * 2 / 25.4) + rim);
                      diameters.add(od);
                    }
                  }
                });
                const sorted = [...diameters].sort((a, b) => a - b);
                return sorted.length > 1 ? `${sorted[0]}"-${sorted[sorted.length - 1]}"` : `${sorted[0]}"`;
              })()} tires
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline version for mobile/narrow layouts
 */
export function BuildStyleToggleCompact({ currentBuildType, vehicleType, className = "" }: BuildStyleToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleSelect = useCallback((buildType: BuildType) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (buildType) {
      params.set("buildType", buildType);
    } else {
      params.delete("buildType");
    }
    
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, searchParams, pathname]);

  const filteredStyles = vehicleType === "car" 
    ? BUILD_STYLES.filter(s => s.value !== "level")
    : BUILD_STYLES;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {filteredStyles.map((style) => {
        const isActive = currentBuildType === style.value;
        return (
          <button
            key={style.value}
            onClick={() => handleSelect(isActive ? null : style.value)}
            className={`
              inline-flex items-center justify-center rounded-lg border px-2 py-1 text-xs font-bold transition-all
              ${isActive ? style.activeColor : `bg-white text-neutral-600 border-neutral-200 hover:${style.color.split(' ')[0]}`}
            `}
            title={style.description}
          >
            <span>{style.icon}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Get build style configuration for a given build type
 */
export function getBuildStyleConfig(buildType: BuildType) {
  return BUILD_STYLES.find(s => s.value === buildType) || null;
}
