"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

interface ConfigurationOption {
  wheelDiameter: number;
  isDefault: boolean;
  configurationLabel?: string | null;
  tireSize: string;
}

interface WheelConfigurationSwitcherProps {
  configurations: ConfigurationOption[];
  activeDiameter: number;
  vehicle?: { year: string; make: string; model: string; trim?: string };
  className?: string;
}

/**
 * Inline wheel configuration switcher for multi-diameter vehicles.
 * 
 * Replaces the blocking "What size wheels do you have?" gate with a 
 * confident default + optional switch pattern.
 * 
 * Only shown for vehicles with verified config data.
 */
export default function WheelConfigurationSwitcher({
  configurations,
  activeDiameter,
  vehicle,
  className = "",
}: WheelConfigurationSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const vehicleDescription = vehicle 
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`
    : "unknown";

  const handleSwitch = useCallback((newDiameter: number) => {
    if (newDiameter === activeDiameter) return;

    // Track analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "wheel_config_switch_clicked", {
        from_diameter: activeDiameter,
        to_diameter: newDiameter,
        vehicle: vehicleDescription,
      });
    }

    // Update URL with new wheelDia
    const params = new URLSearchParams(searchParams.toString());
    params.set("wheelDia", newDiameter.toString());

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [activeDiameter, pathname, router, searchParams, vehicleDescription]);

  // Get unique diameters from configurations
  const uniqueDiameters = [...new Set(configurations.map(c => c.wheelDiameter))].sort((a, b) => a - b);

  // Don't show for single-diameter vehicles
  if (uniqueDiameters.length <= 1) {
    return null;
  }

  // Build options from unique diameters
  const sortedOptions = uniqueDiameters.map(diameter => {
    const config = configurations.find(c => c.wheelDiameter === diameter);
    return {
      diameter,
      isDefault: config?.isDefault ?? false,
      tireSize: config?.tireSize ?? "",
    };
  });

  return (
    <div className={`bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">
            Your vehicle came with multiple factory wheel options
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            Showing recommended setup. Switch if your vehicle has a different factory wheel size.
          </p>
        </div>
        
        <div className="flex gap-2">
          {sortedOptions.map((option) => {
            const isSelected = option.diameter === activeDiameter;
            const isRecommended = option.isDefault;
            
            return (
              <button
                key={option.diameter}
                onClick={() => handleSwitch(option.diameter)}
                disabled={isPending}
                className={`
                  relative px-4 py-2 rounded-lg font-medium text-sm transition-all
                  ${isPending ? "opacity-50 cursor-wait" : ""}
                  ${isSelected
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-blue-700 border border-blue-200 hover:border-blue-400 hover:bg-blue-50"
                  }
                `}
              >
                {option.diameter}"
                {isRecommended && (
                  <span className={`
                    absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 rounded-full
                    ${isSelected ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700"}
                  `}>
                    OEM
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {isPending && (
        <div className="mt-2 text-xs text-blue-600">
          Updating results...
        </div>
      )}
    </div>
  );
}
