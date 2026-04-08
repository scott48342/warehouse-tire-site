"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { HomepageIntentState, IntentChip } from "@/lib/homepage-intent/types";
import { getLiftLevelConfig, LIFT_LEVELS } from "@/lib/homepage-intent/config";

interface HomepageIntentBarProps {
  intentState: HomepageIntentState;
  /** Current URL path (e.g., "/wheels") */
  basePath: string;
  /** Vehicle supports staggered setups */
  vehicleSupportsStaggered?: boolean;
}

/**
 * HomepageIntentBar
 * 
 * Renders intent-specific chips/toggles for homepage-driven search flows.
 * Only renders when an intent is active (entry=homepage + valid intent).
 */
export function HomepageIntentBar({ 
  intentState, 
  basePath,
  vehicleSupportsStaggered = false,
}: HomepageIntentBarProps) {
  const searchParams = useSearchParams();
  
  // Don't render if no intent active
  if (!intentState.isActive || !intentState.config) {
    return null;
  }

  const { config, resolved } = intentState;

  // Build current params object for URL building
  const currentParams: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    currentParams[key] = value;
  });

  // Render based on intent type
  if (config.id === "lifted_35" && config.liftLevelAdjustable) {
    return (
      <LiftedIntentBar
        currentParams={currentParams}
        basePath={basePath}
        activeLiftLevel={resolved.liftLevel ?? "6in"}
      />
    );
  }

  if (config.id === "street_performance") {
    return (
      <StreetPerformanceIntentBar
        currentParams={currentParams}
        basePath={basePath}
        vehicleSupportsStaggered={vehicleSupportsStaggered}
      />
    );
  }

  // Generic chip bar for other intents
  if (config.chips && config.chips.length > 0) {
    return (
      <GenericIntentBar
        config={config}
        currentParams={currentParams}
        basePath={basePath}
      />
    );
  }

  return null;
}

/**
 * Lifted Build Intent Bar
 * Shows lift level chips: Leveled, 4", 6", 8"
 */
function LiftedIntentBar({
  currentParams,
  basePath,
  activeLiftLevel,
}: {
  currentParams: Record<string, string>;
  basePath: string;
  activeLiftLevel: string;
}) {
  const liftLevels = Object.values(LIFT_LEVELS);

  function buildLiftUrl(liftId: string): string {
    const params = new URLSearchParams();
    
    // Preserve all current params
    for (const [key, value] of Object.entries(currentParams)) {
      if (key !== "liftLevel" && key !== "offsetMin" && key !== "offsetMax" && key !== "page") {
        params.set(key, value);
      }
    }
    
    // Set new lift level
    params.set("liftLevel", liftId);
    
    // Get offset range for this lift level
    const liftConfig = getLiftLevelConfig(liftId);
    if (liftConfig) {
      params.set("offsetMin", String(liftConfig.offsetMin));
      params.set("offsetMax", String(liftConfig.offsetMax));
    }
    
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
      <div className="mx-auto max-w-screen-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Intent label */}
          <div className="flex items-center gap-2">
            <span className="text-lg">🏔️</span>
            <span className="text-sm font-bold text-amber-900">Lifted Build</span>
          </div>
          
          {/* Divider */}
          <div className="h-5 w-px bg-amber-300" />
          
          {/* Lift level chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-amber-700 font-medium">Lift Height:</span>
            {liftLevels.map((level) => {
              const isActive = level.id === activeLiftLevel;
              return (
                <Link
                  key={level.id}
                  href={buildLiftUrl(level.id)}
                  className={`
                    inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold
                    transition-all duration-200
                    ${isActive
                      ? "bg-amber-600 text-white shadow-md"
                      : "bg-white text-amber-800 border border-amber-300 hover:bg-amber-100"
                    }
                  `}
                >
                  {level.label}
                  {isActive && (
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </Link>
              );
            })}
          </div>
          
          {/* Current offset info */}
          <div className="ml-auto text-xs text-amber-700">
            {(() => {
              const config = getLiftLevelConfig(activeLiftLevel);
              if (!config) return null;
              return (
                <span>
                  Offset: {config.offsetMin}mm to {config.offsetMax}mm • 
                  Target tires: {config.targetTireSizes.map(s => `${s}"`).join(", ")}
                </span>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Street Performance Intent Bar
 * Shows: Street Performance, Staggered (if supported), Square
 */
function StreetPerformanceIntentBar({
  currentParams,
  basePath,
  vehicleSupportsStaggered,
}: {
  currentParams: Record<string, string>;
  basePath: string;
  vehicleSupportsStaggered: boolean;
}) {
  const currentSetup = currentParams.setup || "";

  function buildSetupUrl(setup: string | null): string {
    const params = new URLSearchParams();
    
    // Preserve all current params except setup and page
    for (const [key, value] of Object.entries(currentParams)) {
      if (key !== "setup" && key !== "page") {
        params.set(key, value);
      }
    }
    
    // Set new setup (or remove if null)
    if (setup) {
      params.set("setup", setup);
    }
    
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-200">
      <div className="mx-auto max-w-screen-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Intent label */}
          <div className="flex items-center gap-2">
            <span className="text-lg">🏎️</span>
            <span className="text-sm font-bold text-red-900">Street Performance</span>
          </div>
          
          {/* Divider */}
          <div className="h-5 w-px bg-red-300" />
          
          {/* Setup chips */}
          <div className="flex flex-wrap items-center gap-2">
            {/* All Performance chip (no setup filter) */}
            <Link
              href={buildSetupUrl(null)}
              className={`
                inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold
                transition-all duration-200
                ${!currentSetup
                  ? "bg-red-600 text-white shadow-md"
                  : "bg-white text-red-800 border border-red-300 hover:bg-red-100"
                }
              `}
            >
              All Performance
              {!currentSetup && (
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </Link>

            {/* Staggered chip - only show if vehicle supports it */}
            {vehicleSupportsStaggered && (
              <Link
                href={buildSetupUrl("staggered")}
                className={`
                  inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold
                  transition-all duration-200
                  ${currentSetup === "staggered"
                    ? "bg-red-600 text-white shadow-md"
                    : "bg-white text-red-800 border border-red-300 hover:bg-red-100"
                  }
                `}
              >
                Staggered
                {currentSetup === "staggered" && (
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </Link>
            )}

            {/* Square chip */}
            <Link
              href={buildSetupUrl("square")}
              className={`
                inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold
                transition-all duration-200
                ${currentSetup === "square"
                  ? "bg-red-600 text-white shadow-md"
                  : "bg-white text-red-800 border border-red-300 hover:bg-red-100"
                }
              `}
            >
              Square
              {currentSetup === "square" && (
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </Link>
          </div>

          {/* Info text */}
          <div className="ml-auto text-xs text-red-700">
            {vehicleSupportsStaggered 
              ? "Your vehicle supports staggered setups (wider rear)"
              : "Showing square setups (same size all around)"
            }
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generic Intent Bar for future intents
 */
function GenericIntentBar({
  config,
  currentParams,
  basePath,
}: {
  config: { id: string; label: string; chips?: IntentChip[] };
  currentParams: Record<string, string>;
  basePath: string;
}) {
  if (!config.chips) return null;

  return (
    <div className="bg-neutral-50 border-b border-neutral-200">
      <div className="mx-auto max-w-screen-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-neutral-900">{config.label}</span>
          <div className="h-5 w-px bg-neutral-300" />
          <div className="flex flex-wrap items-center gap-2">
            {config.chips.map((chip) => (
              <span
                key={chip.id}
                className={`
                  inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold
                  ${chip.defaultActive
                    ? "bg-neutral-800 text-white"
                    : "bg-white text-neutral-700 border border-neutral-300"
                  }
                `}
              >
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
