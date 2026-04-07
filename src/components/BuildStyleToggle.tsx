"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export type BuildType = "stock" | "level" | "lifted" | null;

interface BuildStyleToggleProps {
  currentBuildType: BuildType;
  vehicleType?: "truck" | "suv" | "car";
  className?: string;
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

export function BuildStyleToggle({ currentBuildType, vehicleType, className = "" }: BuildStyleToggleProps) {
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
    
    // Reset to page 1 when changing build type
    params.set("page", "1");
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, searchParams, pathname]);

  // Don't show leveled option for cars (they don't have leveling kits)
  const filteredStyles = vehicleType === "car" 
    ? BUILD_STYLES.filter(s => s.value !== "level")
    : BUILD_STYLES;

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
      {currentBuildType && (
        <div className="mt-2 text-xs text-neutral-500">
          {BUILD_STYLES.find(s => s.value === currentBuildType)?.description}
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
