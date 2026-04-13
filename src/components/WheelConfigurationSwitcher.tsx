"use client";

/**
 * Wheel Configuration Switcher
 * 
 * INLINE (non-blocking) component for switching between OEM wheel configurations.
 * Used when we have HIGH CONFIDENCE configuration data with is_default.
 * 
 * Unlike WheelSizeGateSelector (blocking), this shows ABOVE results
 * and allows optional switching without interrupting the flow.
 * 
 * Design: Compact pill selector with "Recommended" badge on default option.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

interface WheelConfiguration {
  wheelDiameter: number;
  isDefault: boolean;
  configurationLabel?: string | null;
  tireSize?: string;
}

interface WheelConfigurationSwitcherProps {
  /** Available configurations (from config table) */
  configurations: WheelConfiguration[];
  /** Currently active diameter (from URL or auto-selected) */
  activeDiameter: number;
  /** Vehicle info for analytics */
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  /** Optional callback when switched */
  onSwitch?: (diameter: number) => void;
}

export function WheelConfigurationSwitcher({
  configurations,
  activeDiameter,
  vehicle,
  onSwitch,
}: WheelConfigurationSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasTrackedView = useRef(false);

  // Get unique diameters, sorted ascending
  const uniqueDiameters = [...new Set(configurations.map(c => c.wheelDiameter))].sort((a, b) => a - b);
  
  // Find the default diameter
  const defaultConfig = configurations.find(c => c.isDefault);
  const defaultDiameter = defaultConfig?.wheelDiameter ?? uniqueDiameters[0];

  // Track that the switcher was shown (once per mount)
  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "wheel_config_auto_selected", {
        event_category: "fitment",
        wheel_diameter: activeDiameter,
        is_default: activeDiameter === defaultDiameter,
        vehicle_year: vehicle?.year,
        vehicle_make: vehicle?.make,
        vehicle_model: vehicle?.model,
        vehicle_trim: vehicle?.trim,
        available_sizes: uniqueDiameters.join(","),
      });
    }
  }, [activeDiameter, defaultDiameter, vehicle, uniqueDiameters]);

  const handleSwitch = useCallback((diameter: number) => {
    if (diameter === activeDiameter) return;

    // Track the switch
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "wheel_config_switch_clicked", {
        event_category: "fitment",
        event_label: `${diameter}"`,
        wheel_diameter: diameter,
        from_diameter: activeDiameter,
        vehicle_year: vehicle?.year,
        vehicle_make: vehicle?.make,
        vehicle_model: vehicle?.model,
      });
    }

    // Callback
    onSwitch?.(diameter);

    // Update URL with new selection
    const params = new URLSearchParams(searchParams.toString());
    params.set("wheelDia", String(diameter));
    // Clear any conflicting params
    params.delete("wheelDiaFront");
    params.delete("wheelDiaRear");
    
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams, activeDiameter, onSwitch, vehicle]);

  // Don't render if only one option
  if (uniqueDiameters.length <= 1) {
    return null;
  }

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Label */}
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Factory wheel options</span>
        </div>

        {/* Diameter pills */}
        <div className="flex items-center gap-2">
          {uniqueDiameters.map((diameter) => {
            const isActive = diameter === activeDiameter;
            const isDefault = diameter === defaultDiameter;
            
            return (
              <button
                key={diameter}
                onClick={() => handleSwitch(diameter)}
                className={`
                  relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-all
                  ${isActive 
                    ? "bg-neutral-900 text-white shadow-sm" 
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }
                `}
              >
                <span>{diameter}&quot;</span>
                {isDefault && (
                  <span className={`text-xs ${isActive ? 'text-neutral-300' : 'text-green-600'}`}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Helper text */}
        <span className="text-xs text-neutral-500">
          {activeDiameter === defaultDiameter 
            ? "Showing recommended setup" 
            : "Switch if your wheels differ"}
        </span>
      </div>
    </div>
  );
}

export default WheelConfigurationSwitcher;
