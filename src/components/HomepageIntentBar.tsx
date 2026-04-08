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
  
  // Lifted variants (lifted_35, lifted, leveled, lifted_packages)
  if (config.liftLevelAdjustable) {
    return (
      <LiftedIntentBar
        currentParams={currentParams}
        basePath={basePath}
        activeLiftLevel={resolved.liftLevel ?? "4in"}
        intentLabel={config.label}
      />
    );
  }

  // Street/Performance variants (street_performance, street_wheels, performance_tires)
  if (config.id === "street_performance" || config.id === "street_wheels" || config.id === "performance_tires") {
    return (
      <StreetPerformanceIntentBar
        currentParams={currentParams}
        basePath={basePath}
        vehicleSupportsStaggered={vehicleSupportsStaggered}
        intentLabel={config.label}
        intentId={config.id}
      />
    );
  }

  // Stock fit intent
  if (config.id === "stock") {
    return (
      <StockIntentBar
        currentParams={currentParams}
        basePath={basePath}
      />
    );
  }

  // Daily driver intent
  if (config.id === "daily_driver") {
    return (
      <DailyDriverIntentBar
        currentParams={currentParams}
        basePath={basePath}
      />
    );
  }

  // Truck wheels intent
  if (config.id === "truck_wheels") {
    return (
      <TruckWheelsIntentBar
        currentParams={currentParams}
        basePath={basePath}
      />
    );
  }

  // All-terrain tires intent
  if (config.id === "all_terrain_tires") {
    return (
      <AllTerrainIntentBar
        currentParams={currentParams}
        basePath={basePath}
      />
    );
  }

  // Generic chip bar for any remaining intents
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
 * Used for: lifted_35, lifted, leveled, lifted_packages
 */
function LiftedIntentBar({
  currentParams,
  basePath,
  activeLiftLevel,
  intentLabel = "Lifted Build",
}: {
  currentParams: Record<string, string>;
  basePath: string;
  activeLiftLevel: string;
  intentLabel?: string;
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
            <span className="text-sm font-bold text-amber-900">{intentLabel}</span>
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
 * Street/Performance Intent Bar
 * Shows: All, Staggered (if supported), Square
 * Used for: street_performance, street_wheels, performance_tires
 */
function StreetPerformanceIntentBar({
  currentParams,
  basePath,
  vehicleSupportsStaggered,
  intentLabel = "Street Performance",
  intentId = "street_performance",
}: {
  currentParams: Record<string, string>;
  basePath: string;
  vehicleSupportsStaggered: boolean;
  intentLabel?: string;
  intentId?: string;
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
            <span className="text-lg">{intentId === "performance_tires" ? "🏁" : "🏎️"}</span>
            <span className="text-sm font-bold text-red-900">{intentLabel}</span>
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
 * Stock Fit Intent Bar
 * Shows: Stock Fit, OEM+, Perfect Fit, Popular
 */
function StockIntentBar({
  currentParams,
  basePath,
}: {
  currentParams: Record<string, string>;
  basePath: string;
}) {
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
      <div className="mx-auto max-w-screen-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span className="text-sm font-bold text-green-900">Stock Fit</span>
          </div>
          <div className="h-5 w-px bg-green-300" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold bg-green-600 text-white shadow-md">
              Perfect Fit
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold bg-white text-green-800 border border-green-300">
              OEM+
            </span>
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold bg-white text-green-800 border border-green-300">
              Popular
            </span>
          </div>
          <div className="ml-auto text-xs text-green-700">
            Showing factory-compatible wheels • No modifications needed
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Daily Driver Intent Bar
 * Shows: Daily Driver, Comfort, Value, OEM+
 */
function DailyDriverIntentBar({
  currentParams,
  basePath,
}: {
  currentParams: Record<string, string>;
  basePath: string;
}) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
      <div className="mx-auto max-w-screen-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚗</span>
            <span className="text-sm font-bold text-blue-900">Daily Driver</span>
          </div>
          <div className="h-5 w-px bg-blue-300" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white shadow-md">
              Daily Driver
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold bg-white text-blue-800 border border-blue-300">
              Comfort
            </span>
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold bg-white text-blue-800 border border-blue-300">
              Value
            </span>
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold bg-white text-blue-800 border border-blue-300">
              33" Target
            </span>
          </div>
          <div className="ml-auto text-xs text-blue-700">
            Practical packages for everyday driving
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Truck Wheels Intent Bar
 * Shows: Stock, Level, Lifted, Popular Truck Fits
 */
function TruckWheelsIntentBar({
  currentParams,
  basePath,
}: {
  currentParams: Record<string, string>;
  basePath: string;
}) {
  const currentBuildType = currentParams.buildType || "";

  function buildUrl(buildType: string | null): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(currentParams)) {
      if (key !== "buildType" && key !== "page") {
        params.set(key, value);
      }
    }
    if (buildType) {
      params.set("buildType", buildType);
    }
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-200">
      <div className="mx-auto max-w-screen-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛻</span>
            <span className="text-sm font-bold text-slate-900">Truck Wheels</span>
          </div>
          <div className="h-5 w-px bg-slate-300" />
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildUrl("stock")}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold transition-all ${
                currentBuildType === "stock"
                  ? "bg-slate-700 text-white shadow-md"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
              }`}
            >
              Stock
            </Link>
            <Link
              href={buildUrl("level")}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold transition-all ${
                currentBuildType === "level"
                  ? "bg-slate-700 text-white shadow-md"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
              }`}
            >
              Level
            </Link>
            <Link
              href={buildUrl("lifted")}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold transition-all ${
                currentBuildType === "lifted"
                  ? "bg-slate-700 text-white shadow-md"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
              }`}
            >
              Lifted
            </Link>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
              !currentBuildType
                ? "bg-slate-700 text-white shadow-md"
                : "bg-white text-slate-700 border border-slate-300"
            }`}>
              Popular Truck Fits
              {!currentBuildType && (
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </span>
          </div>
          <div className="ml-auto text-xs text-slate-600">
            Truck-friendly wheels with proper fitment
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * All-Terrain Tires Intent Bar
 * Shows: All-Terrain, Rugged, Daily A/T, size chips
 */
function AllTerrainIntentBar({
  currentParams,
  basePath,
}: {
  currentParams: Record<string, string>;
  basePath: string;
}) {
  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-200">
      <div className="mx-auto max-w-screen-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏔️</span>
            <span className="text-sm font-bold text-amber-900">All-Terrain Tires</span>
          </div>
          <div className="h-5 w-px bg-amber-300" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold bg-amber-600 text-white shadow-md">
              All-Terrain
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold bg-white text-amber-800 border border-amber-300">
              Rugged Terrain
            </span>
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold bg-white text-amber-800 border border-amber-300">
              Daily A/T
            </span>
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold bg-white text-amber-800 border border-amber-300">
              33"
            </span>
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold bg-white text-amber-800 border border-amber-300">
              35"
            </span>
          </div>
          <div className="ml-auto text-xs text-amber-700">
            Off-road capable tires for trucks & SUVs
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
