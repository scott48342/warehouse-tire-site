"use client";

/**
 * Rear Wheel Configuration Selector
 * 
 * Shows when a DRW-capable HD truck (3500-class) needs user to select
 * between SRW (Single Rear Wheel) and DRW (Dual Rear Wheel / Dually).
 * 
 * This is a REQUIRED step before showing wheel or tire results for these vehicles.
 * Follows the same UX pattern as WheelDiameterSelector.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import {
  type RearWheelConfig,
  getRearWheelConfigOptions,
} from "@/lib/fitment/rearWheelConfig";

interface RearWheelConfigSelectorProps {
  /** Currently selected config (from URL param) */
  selectedConfig: RearWheelConfig | null;
  /** Pre-selected value inferred from trim (shown as default) */
  inferredConfig?: RearWheelConfig | null;
  /** Vehicle display info for context */
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  /** Base path for navigation (e.g., "/wheels" or "/tires") */
  basePath?: string;
  /** Callback when selection is made */
  onSelect?: (config: RearWheelConfig) => void;
}

export function RearWheelConfigSelector({
  selectedConfig,
  inferredConfig,
  vehicle,
  basePath,
  onSelect,
}: RearWheelConfigSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = useCallback((config: RearWheelConfig) => {
    // Call external handler if provided
    onSelect?.(config);

    // Update URL with the selection
    const params = new URLSearchParams(searchParams.toString());
    params.set("rearWheelConfig", config);
    
    const targetPath = basePath || pathname;
    router.push(`${targetPath}?${params.toString()}`);

    // Track analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "rear_wheel_config_selected", {
        event_category: "fitment",
        event_label: config,
        vehicle_year: vehicle?.year,
        vehicle_make: vehicle?.make,
        vehicle_model: vehicle?.model,
      });
    }
  }, [router, pathname, searchParams, basePath, onSelect, vehicle]);

  const options = getRearWheelConfigOptions();

  return (
    <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-5 mb-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white text-sm">
          🛻
        </span>
        <h3 className="text-base font-bold text-blue-900">
          What rear wheel setup do you have?
        </h3>
      </div>
      
      {/* Helper text */}
      <p className="text-sm text-blue-800 mb-4">
        Your {vehicle?.year} {vehicle?.make} {vehicle?.model} comes in both single and dual rear wheel configurations.
        <br />
        <span className="text-xs opacity-80">
          This changes the correct wheel and tire fitment for your truck.
        </span>
      </p>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((option) => {
          const isSelected = selectedConfig === option.value;
          const isInferred = !selectedConfig && inferredConfig === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`
                relative flex flex-col items-start gap-2 rounded-xl p-4 text-left transition-all
                ${isSelected 
                  ? "bg-blue-600 text-white shadow-lg ring-2 ring-blue-600 ring-offset-2" 
                  : isInferred
                    ? "bg-blue-100 text-blue-900 border-2 border-blue-400 hover:bg-blue-200"
                    : "bg-white text-neutral-900 border-2 border-neutral-200 hover:border-blue-400 hover:bg-blue-50"
                }
              `}
            >
              {/* Icon */}
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {option.value === 'srw' ? '🔘' : '⚙️⚙️'}
                </span>
                <span className="text-base font-bold">
                  {option.label}
                </span>
              </div>
              
              {/* Description */}
              <p className={`text-xs ${isSelected ? 'text-blue-100' : 'text-neutral-600'}`}>
                {option.description}
              </p>
              
              {/* Selection indicator */}
              {isSelected && (
                <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-blue-600">
                  ✓
                </span>
              )}
              
              {/* Inferred badge */}
              {isInferred && !isSelected && (
                <span className="absolute top-2 right-2 text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                  Detected
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Required selection prompt */}
      {!selectedConfig && (
        <p className="mt-4 text-sm text-blue-700 italic flex items-center gap-2">
          <span>👆</span>
          <span>Please select your rear wheel configuration to continue</span>
        </p>
      )}
    </div>
  );
}

/**
 * Compact badge showing current rear wheel config (for results header)
 */
export function RearWheelConfigBadge({ 
  config,
  onClick,
}: { 
  config: RearWheelConfig;
  onClick?: () => void;
}) {
  const label = config === 'drw' ? 'Dually (DRW)' : 'Single Rear (SRW)';
  const icon = config === 'drw' ? '⚙️⚙️' : '🔘';
  
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-800 hover:bg-blue-200 transition-colors"
    >
      <span>{icon}</span>
      <span>{label}</span>
      {onClick && <span className="text-blue-600 ml-1">✕</span>}
    </button>
  );
}

/**
 * Track that the rear wheel config prompt was shown (for analytics)
 */
export function trackRearWheelConfigPromptShown(vehicle: {
  year?: string;
  make?: string;
  model?: string;
}) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "rear_wheel_config_prompt_shown", {
      event_category: "fitment",
      vehicle_year: vehicle.year,
      vehicle_make: vehicle.make,
      vehicle_model: vehicle.model,
    });
  }
}
