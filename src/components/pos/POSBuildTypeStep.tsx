"use client";

import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from "react";
import { useRouter } from "next/navigation";
import { usePOS, type POSBuildType, type POSLiftConfig, type SetupMode } from "./POSContext";
import {
  type StaggeredFitmentInfo,
  supportsStaggeredFitment,
  getDefaultSetupMode,
} from "@/lib/fitment/staggeredFitment";
import {
  getLiftProfile,
  getRecommendationForLiftHeight,
  type LiftLevel,
} from "@/lib/liftedRecommendations";

// Error Boundary for debugging
class BuildStepErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[POSBuildTypeStep] Error caught:", error);
    console.error("[POSBuildTypeStep] Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <h1 className="text-xl font-bold text-red-500 mb-4">Build Type Step Error</h1>
          <pre className="text-left text-xs text-red-300 bg-red-900/20 p-4 rounded overflow-auto">
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// Quick Preset Type
// ============================================================================

type QuickPreset = {
  buildType: POSBuildType;
  liftInches: number;
  targetTireSize: number;
  presetId: "daily" | "offroad" | "extreme";
  label: string;
  description: string;
};

// ============================================================================
// Component
// ============================================================================

function POSBuildTypeStepInner() {
  // TEMP: Return simple div to test
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-center text-white">
      <h1 className="text-2xl font-bold">Build Type Step</h1>
      <p className="mt-4">If you see this, the component renders without error.</p>
    </div>
  );
  
  /* DISABLED FOR DEBUG
  const router = useRouter();
  const { state, setBuildType, setStaggeredInfo, setSetupMode, goToStep } = usePOS();
  
  // Debug: Check if state values are valid
  console.log("[POSBuildTypeStep] state.vehicle:", state.vehicle);
  console.log("[POSBuildTypeStep] state.buildType:", state.buildType);
  console.log("[POSBuildTypeStep] typeof state.vehicle:", typeof state.vehicle);
  
  // Safety check - if no vehicle, show loading
  if (!state.vehicle) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center text-white">
        <p>Loading vehicle data...</p>
      </div>
    );
  }
  
  // Defensive: ensure vehicle properties are strings
  const safeVehicle = {
    year: String(state.vehicle.year || ""),
    make: String(state.vehicle.make || ""),
    model: String(state.vehicle.model || ""),
    trim: state.vehicle.trim ? String(state.vehicle.trim) : undefined,
  };
  */

  // Local state
  const [selectedBuildType, setSelectedBuildType] = useState<POSBuildType>(state.buildType);
  const [liftHeight, setLiftHeight] = useState<number>(state.liftConfig?.liftInches || 4);
  const [targetTireSize, setTargetTireSize] = useState<number | undefined>(state.liftConfig?.targetTireSize);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Staggered detection
  const [staggeredLoading, setStaggeredLoading] = useState(false);
  const [localStaggeredInfo, setLocalStaggeredInfo] = useState<StaggeredFitmentInfo | null>(state.staggeredInfo);
  const [selectedSetupMode, setSelectedSetupMode] = useState<SetupMode>(state.setupMode);

  // Fetch staggered info when component mounts
  useEffect(() => {
    if (!state.vehicle) return;

    const fetchStaggeredInfo = async () => {
      setStaggeredLoading(true);
      try {
        const params = new URLSearchParams({
          year: state.vehicle!.year,
          make: state.vehicle!.make,
          model: state.vehicle!.model,
        });
        if (state.vehicle!.trim) params.set("trim", state.vehicle!.trim);

        const res = await fetch(`/api/wheels/fitment-search?${params}&pageSize=1`);
        if (res.ok) {
          const data = await res.json();
          // Staggered info is at data.fitment.staggered
          const staggered = data.fitment?.staggered;
          if (staggered) {
            const info: StaggeredFitmentInfo = {
              isStaggered: staggered.isStaggered,
              reason: staggered.reason,
              frontSpec: staggered.frontSpec,
              rearSpec: staggered.rearSpec,
            };
            setLocalStaggeredInfo(info);
            setStaggeredInfo(info);
            // Default to staggered mode if vehicle supports it
            if (supportsStaggeredFitment(info)) {
              setSelectedSetupMode(getDefaultSetupMode(info));
            }
          }
        }
      } catch (err) {
        console.error("[POSBuildTypeStep] Failed to fetch staggered info:", err);
      } finally {
        setStaggeredLoading(false);
      }
    };

    fetchStaggeredInfo();
  }, [state.vehicle, setStaggeredInfo]);

  // Lift profile for vehicle (with safety check)
  let liftProfile = null;
  try {
    if (state.vehicle?.make && state.vehicle?.model) {
      liftProfile = getLiftProfile(String(state.vehicle.make), String(state.vehicle.model));
    }
  } catch (e) {
    console.error("[POSBuildTypeStep] Error getting lift profile:", e);
  }

  // Recommendation based on current lift height
  const recommendation = liftProfile
    ? getRecommendationForLiftHeight(liftProfile, liftHeight)
    : null;

  // Get preset ID from lift height
  const getPresetId = (inches: number): "daily" | "offroad" | "extreme" => {
    if (inches <= 2) return "daily";
    if (inches <= 4) return "offroad";
    return "extreme";
  };

  // Quick presets
  const quickPresets: QuickPreset[] = liftProfile
    ? [
        {
          buildType: "leveled",
          liftInches: 2,
          targetTireSize: 33,
          presetId: "daily",
          label: "Level Kit",
          description: "2\" front lift • 33\" tires",
        },
        {
          buildType: "lifted",
          liftInches: 4,
          targetTireSize: 35,
          presetId: "offroad",
          label: "Trail Ready",
          description: "4\" lift • 35\" tires",
        },
        {
          buildType: "lifted",
          liftInches: 6,
          targetTireSize: 37,
          presetId: "extreme",
          label: "Full Send",
          description: "6\"+ lift • 37\" tires",
        },
      ]
    : [];

  // Build URL for wheels page
  const buildWheelsUrl = () => {
    const params = new URLSearchParams({
      year: state.vehicle!.year,
      make: state.vehicle!.make,
      model: state.vehicle!.model,
    });
    if (state.vehicle!.trim) params.set("trim", state.vehicle!.trim);
    return `/pos/wheels?${params.toString()}`;
  };

  // Handle build type card selection
  const handleBuildTypeSelect = (type: POSBuildType) => {
    setSelectedBuildType(type);
  };

  // Handle stock continue
  const handleStockContinue = () => {
    setBuildType("stock");
    setSetupMode(selectedSetupMode);
    router.push(buildWheelsUrl());
  };

  // Handle quick preset selection
  const handleQuickPreset = (preset: QuickPreset) => {
    const config: POSLiftConfig = {
      liftInches: preset.liftInches,
      targetTireSize: preset.targetTireSize,
      presetId: preset.presetId,
      offsetMin: recommendation?.offsetMin,
      offsetMax: recommendation?.offsetMax,
      notes: recommendation?.notes,
    };
    setBuildType(preset.buildType, config);
    // Lifted builds use square fitment
    setSetupMode("square");
    router.push(buildWheelsUrl());
  };

  // Handle continue with custom configuration
  const handleContinue = () => {
    if (selectedBuildType === "stock") {
      setBuildType("stock");
      setSetupMode(selectedSetupMode);
    } else {
      const presetId = getPresetId(liftHeight);
      const config: POSLiftConfig = {
        liftInches: liftHeight,
        targetTireSize,
        presetId,
        offsetMin: recommendation?.offsetMin,
        offsetMax: recommendation?.offsetMax,
        notes: recommendation?.notes,
      };
      setBuildType(selectedBuildType, config);
      // Lifted builds use square fitment
      setSetupMode("square");
    }
    router.push(buildWheelsUrl());
  };

  // Vehicle info display
  const vehicleDisplay = state.vehicle
    ? `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}${state.vehicle.trim ? ` ${state.vehicle.trim}` : ""}`
    : "";

  // Check if vehicle supports staggered
  const isStaggeredCapable = supportsStaggeredFitment(localStaggeredInfo);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white">Select Build Type</h1>
        <p className="mt-2 text-neutral-400">{vehicleDisplay}</p>
      </div>

      {/* Build Type Cards */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {/* Stock */}
        <button
          onClick={() => handleBuildTypeSelect("stock")}
          className={`rounded-xl border-2 p-6 text-left transition-all ${
            selectedBuildType === "stock"
              ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30"
              : "border-neutral-700 bg-neutral-800 hover:border-neutral-600"
          }`}
        >
          <div className="mb-3 text-3xl">🚗</div>
          <h3 className="text-lg font-bold text-white">Stock</h3>
          <p className="mt-1 text-sm text-neutral-400">Factory height, OEM-friendly fitment</p>
          <div className="mt-4 text-xs font-medium text-green-400">✓ Ready for install</div>
        </button>

        {/* Leveling Kit */}
        <button
          onClick={() => handleBuildTypeSelect("leveled")}
          className={`rounded-xl border-2 p-6 text-left transition-all ${
            selectedBuildType === "leveled"
              ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30"
              : "border-neutral-700 bg-neutral-800 hover:border-neutral-600"
          }`}
        >
          <div className="mb-3 text-3xl">🛻</div>
          <h3 className="text-lg font-bold text-white">Leveling Kit</h3>
          <p className="mt-1 text-sm text-neutral-400">2-2.5" front lift, removes factory rake</p>
          <div className="mt-4 text-xs font-medium text-blue-400">+ Fit 33-35" tires</div>
        </button>

        {/* Lifted Truck */}
        <button
          onClick={() => handleBuildTypeSelect("lifted")}
          className={`rounded-xl border-2 p-6 text-left transition-all ${
            selectedBuildType === "lifted"
              ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30"
              : "border-neutral-700 bg-neutral-800 hover:border-neutral-600"
          }`}
        >
          <div className="mb-3 text-3xl">🦎</div>
          <h3 className="text-lg font-bold text-white">Lifted Truck</h3>
          <p className="mt-1 text-sm text-neutral-400">Full suspension lift, 3-10"+</p>
          <div className="mt-4 text-xs font-medium text-orange-400">+ Fit 35-40" tires</div>
        </button>
      </div>

      {/* Staggered Fitment Choice (for performance vehicles) */}
      {isStaggeredCapable && selectedBuildType === "stock" && (
        <div className="mb-8 rounded-xl border-2 border-purple-500/30 bg-purple-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🏎️</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">Performance Vehicle Detected</h2>
              <p className="mt-1 text-sm text-neutral-400">
                This vehicle supports staggered fitment with wider rear wheels.
              </p>

              {localStaggeredInfo?.frontSpec && localStaggeredInfo?.rearSpec && (
                <div className="mt-3 flex gap-4 text-xs text-neutral-400">
                  <span>Front: {localStaggeredInfo.frontSpec.width}" wide</span>
                  <span>Rear: {localStaggeredInfo.rearSpec.width}" wide</span>
                </div>
              )}

              {/* Setup choice buttons */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setSelectedSetupMode("square")}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    selectedSetupMode === "square"
                      ? "border-blue-500 bg-blue-500/20 ring-2 ring-blue-500/50"
                      : "border-neutral-600 bg-neutral-800 hover:border-neutral-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {selectedSetupMode === "square" && <span className="text-lg text-blue-400">✓</span>}
                    <span className="text-xl">⬜</span>
                    <span className="font-semibold text-white">Square Setup</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400">Same size all around • Tires can rotate</p>
                </button>

                <button
                  onClick={() => setSelectedSetupMode("staggered")}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    selectedSetupMode === "staggered"
                      ? "border-purple-500 bg-purple-500/20 ring-2 ring-purple-500/50"
                      : "border-neutral-600 bg-neutral-800 hover:border-neutral-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {selectedSetupMode === "staggered" && <span className="text-lg text-purple-400">✓</span>}
                    <span className="text-xl">🏁</span>
                    <span className="font-semibold text-white">Performance Staggered</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400">Wider rear • Better traction • OEM-style</p>
                </button>
              </div>

              {selectedSetupMode === "staggered" && (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <p className="text-xs text-amber-300">
                    ⚠️ Front/rear tires differ — cannot be rotated front-to-back
                  </p>
                </div>
              )}

              {selectedSetupMode === "square" && (
                <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2">
                  <p className="text-xs text-blue-300">
                    ✓ Same wheels all around — full tire rotation possible
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Presets (for non-stock) */}
      {selectedBuildType !== "stock" && quickPresets.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-white">Quick Setups</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {quickPresets.map((preset) => (
              <button
                key={preset.presetId}
                onClick={() => handleQuickPreset(preset)}
                className="rounded-xl border border-neutral-700 bg-neutral-800 p-4 text-left transition-all hover:border-blue-500 hover:bg-neutral-750"
              >
                <div className="text-sm font-bold text-white">{preset.label}</div>
                <div className="mt-1 text-xs text-neutral-400">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Continue Button */}
      <button
        onClick={selectedBuildType === "stock" ? handleStockContinue : handleContinue}
        className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition-colors hover:bg-blue-500"
      >
        {selectedBuildType === "stock" ? (
          isStaggeredCapable ? (
            <>Browse {selectedSetupMode === "staggered" ? "Staggered" : "Square"} Wheels →</>
          ) : (
            <>Browse Wheels →</>
          )
        ) : (
          <>Continue with {selectedBuildType === "leveled" ? "Leveled" : "Lifted"} Fitment →</>
        )}
      </button>
      
      {/* Helper text for staggered vehicles */}
      {isStaggeredCapable && selectedBuildType === "stock" && (
        <p className="mt-2 text-center text-xs text-neutral-500">
          Click to see {selectedSetupMode === "staggered" ? "staggered wheel pairs (wider rear)" : "matching wheel sets"}
        </p>
      )}

      {/* Back Button */}
      <button
        onClick={() => goToStep("vehicle")}
        className="mt-4 w-full text-center text-sm text-neutral-400 hover:text-white"
      >
        ← Change Vehicle
      </button>

      {/* Trust badges */}
      <div className="mt-8 flex items-center justify-center gap-6 text-xs text-neutral-500">
        <div className="flex items-center gap-1">
          <span className="text-green-500">✓</span>
          <span>Installed in-store</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-green-500">✓</span>
          <span>Fitment verified</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-green-500">✓</span>
          <span>Ready same day</span>
        </div>
      </div>
    </div>
  );
}

// Exported wrapper with error boundary
export function POSBuildTypeStep() {
  return (
    <BuildStepErrorBoundary>
      <POSBuildTypeStepInner />
    </BuildStepErrorBoundary>
  );
}
