"use client";

import { useState, useEffect } from "react";
import { usePOS, POSBuildType, POSLiftConfig } from "./POSContext";
import { 
  getLiftProfile, 
  getRecommendationForLiftHeight,
  type LiftLevel 
} from "@/lib/liftedRecommendations";

// ============================================================================
// Types
// ============================================================================

interface QuickPreset {
  id: string;
  name: string;
  description: string;
  buildType: POSBuildType;
  liftInches: number;
  presetId: LiftLevel;
  targetTireSize?: number;
  icon: string;
}

// ============================================================================
// Constants
// ============================================================================

const LIFT_HEIGHT_OPTIONS = [
  { value: 2, label: '2"', category: "level" },
  { value: 2.5, label: '2.5"', category: "level" },
  { value: 3, label: '3"', category: "small" },
  { value: 4, label: '4"', category: "medium" },
  { value: 5, label: '5"', category: "medium" },
  { value: 6, label: '6"', category: "large" },
  { value: 8, label: '8"', category: "extreme" },
  { value: 10, label: '10"+', category: "extreme" },
];

const TIRE_SIZE_PRESETS = [
  { value: 33, label: '33"', description: "Daily driver friendly" },
  { value: 35, label: '35"', description: "Most popular upgrade" },
  { value: 37, label: '37"', description: "Serious off-road" },
  { value: 40, label: '40"+', description: "Extreme builds" },
];

const QUICK_PRESETS: QuickPreset[] = [
  {
    id: "daily-level",
    name: "Leveled Daily",
    description: "Clean look, daily-drivable",
    buildType: "leveled",
    liftInches: 2,
    presetId: "daily",
    targetTireSize: 33,
    icon: "🛻",
  },
  {
    id: "best-4inch",
    name: 'Best 4" Setup',
    description: "Popular lift + 35s",
    buildType: "lifted",
    liftInches: 4,
    presetId: "offroad",
    targetTireSize: 35,
    icon: "🔥",
  },
  {
    id: "best-6inch",
    name: 'Best 6" Setup',
    description: "Aggressive stance + 37s",
    buildType: "lifted",
    liftInches: 6,
    presetId: "offroad",
    targetTireSize: 37,
    icon: "💪",
  },
  {
    id: "daily-35s",
    name: "Daily 35s",
    description: "Practical off-road ready",
    buildType: "lifted",
    liftInches: 3,
    presetId: "offroad",
    targetTireSize: 35,
    icon: "🏕️",
  },
  {
    id: "aggressive-stance",
    name: "Aggressive Stance",
    description: "Deep offset, wide tires",
    buildType: "lifted",
    liftInches: 6,
    presetId: "extreme",
    targetTireSize: 37,
    icon: "😤",
  },
];

// ============================================================================
// Component
// ============================================================================

export function POSBuildTypeStep() {
  const { state, setBuildType, goToStep } = usePOS();
  
  // Local state for configuration
  const [selectedBuildType, setSelectedBuildType] = useState<POSBuildType>(state.buildType);
  const [liftHeight, setLiftHeight] = useState<number>(state.liftConfig?.liftInches || 4);
  const [targetTireSize, setTargetTireSize] = useState<number | undefined>(state.liftConfig?.targetTireSize);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Get vehicle profile for recommendations
  const vehicleProfile = state.vehicle 
    ? getLiftProfile(state.vehicle.make, state.vehicle.model)
    : null;
  
  // Get recommendation based on current lift height
  const recommendation = vehicleProfile && liftHeight
    ? getRecommendationForLiftHeight(vehicleProfile, liftHeight)
    : null;
  
  // Determine preset ID based on lift height
  const getPresetId = (height: number): LiftLevel => {
    if (height <= 2.5) return "daily";
    if (height <= 4) return "offroad";
    return "extreme";
  };
  
  // Handle build type selection
  const handleBuildTypeSelect = (buildType: POSBuildType) => {
    setSelectedBuildType(buildType);
    if (buildType === "stock") {
      // For stock, proceed immediately
      setBuildType("stock");
    }
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
  };
  
  // Handle continue with custom configuration
  const handleContinue = () => {
    if (selectedBuildType === "stock") {
      setBuildType("stock");
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
    }
  };
  
  // Vehicle info display
  const vehicleDisplay = state.vehicle 
    ? `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}${state.vehicle.trim ? ` ${state.vehicle.trim}` : ""}`
    : "";
  
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Select Build Type</h1>
        <p className="mt-2 text-gray-600">{vehicleDisplay}</p>
      </div>
      
      {/* Build Type Cards */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {/* Stock */}
        <button
          onClick={() => handleBuildTypeSelect("stock")}
          className={`rounded-xl border-2 p-6 text-left transition-all hover:shadow-lg ${
            selectedBuildType === "stock"
              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="mb-3 text-3xl">🚗</div>
          <h3 className="text-lg font-bold text-gray-900">Stock</h3>
          <p className="mt-1 text-sm text-gray-600">
            Factory height, OEM-friendly fitment
          </p>
          <div className="mt-4 text-xs text-green-600 font-medium">
            ✓ Ready for install
          </div>
        </button>
        
        {/* Leveling Kit */}
        <button
          onClick={() => handleBuildTypeSelect("leveled")}
          className={`rounded-xl border-2 p-6 text-left transition-all hover:shadow-lg ${
            selectedBuildType === "leveled"
              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="mb-3 text-3xl">🛻</div>
          <h3 className="text-lg font-bold text-gray-900">Leveling Kit</h3>
          <p className="mt-1 text-sm text-gray-600">
            2-2.5" front lift, removes factory rake
          </p>
          <div className="mt-4 text-xs text-blue-600 font-medium">
            + Fit 33-35" tires
          </div>
        </button>
        
        {/* Lifted Truck */}
        <button
          onClick={() => handleBuildTypeSelect("lifted")}
          className={`rounded-xl border-2 p-6 text-left transition-all hover:shadow-lg ${
            selectedBuildType === "lifted"
              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="mb-3 text-3xl">🦎</div>
          <h3 className="text-lg font-bold text-gray-900">Lifted Truck</h3>
          <p className="mt-1 text-sm text-gray-600">
            Full suspension lift, 3-10"+
          </p>
          <div className="mt-4 text-xs text-orange-600 font-medium">
            + Fit 35-40" tires
          </div>
        </button>
      </div>
      
      {/* Quick Presets (for non-stock) */}
      {selectedBuildType !== "stock" && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Quick Setups
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_PRESETS.filter(p => 
              selectedBuildType === "leveled" 
                ? p.buildType === "leveled" 
                : p.buildType === "lifted"
            ).map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleQuickPreset(preset)}
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-all hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="text-2xl">{preset.icon}</span>
                <div>
                  <div className="font-semibold text-gray-900">{preset.name}</div>
                  <div className="text-sm text-gray-500">{preset.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Custom Configuration (for non-stock) */}
      {selectedBuildType !== "stock" && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              Custom Configuration
            </h2>
            <span className="text-gray-500">
              {showAdvanced ? "▲" : "▼"}
            </span>
          </button>
          
          {showAdvanced && (
            <div className="mt-6 space-y-6">
              {/* Lift Height */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Lift Height
                </label>
                <div className="flex flex-wrap gap-2">
                  {LIFT_HEIGHT_OPTIONS.filter(opt => 
                    selectedBuildType === "leveled" 
                      ? opt.category === "level"
                      : opt.category !== "level"
                  ).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setLiftHeight(option.value)}
                      className={`rounded-lg border px-4 py-2 font-medium transition-all ${
                        liftHeight === option.value
                          ? "border-blue-500 bg-blue-500 text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-blue-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Target Tire Size */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Target Tire Size (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setTargetTireSize(undefined)}
                    className={`rounded-lg border px-4 py-2 font-medium transition-all ${
                      targetTireSize === undefined
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-blue-300"
                    }`}
                  >
                    Any
                  </button>
                  {TIRE_SIZE_PRESETS.filter(size => {
                    // Filter based on what the lift can support
                    if (selectedBuildType === "leveled") return size.value <= 35;
                    if (liftHeight <= 3) return size.value <= 35;
                    if (liftHeight <= 6) return size.value <= 37;
                    return true;
                  }).map((size) => (
                    <button
                      key={size.value}
                      onClick={() => setTargetTireSize(size.value)}
                      className={`rounded-lg border px-4 py-2 font-medium transition-all ${
                        targetTireSize === size.value
                          ? "border-blue-500 bg-blue-500 text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-blue-300"
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Recommendation Preview */}
              {recommendation && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <h3 className="mb-2 font-semibold text-blue-900">
                    Fitment Guidance
                  </h3>
                  <div className="grid gap-2 text-sm text-blue-800">
                    <div>
                      <span className="font-medium">Tire Range:</span>{" "}
                      {recommendation.tireDiameterMin}-{recommendation.tireDiameterMax}"
                    </div>
                    <div>
                      <span className="font-medium">Offset Range:</span>{" "}
                      {recommendation.offsetLabel}
                    </div>
                    {recommendation.notes.length > 0 && (
                      <div className="mt-2 border-t border-blue-200 pt-2">
                        {recommendation.notes.map((note, i) => (
                          <div key={i} className="text-xs">⚠️ {note}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Continue Button */}
              <button
                onClick={handleContinue}
                className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Continue with {liftHeight}" {selectedBuildType === "leveled" ? "Level" : "Lift"}
                {targetTireSize ? ` + ${targetTireSize}" Tires` : ""}
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Stock Continue Button */}
      {selectedBuildType === "stock" && (
        <div className="text-center">
          <button
            onClick={() => setBuildType("stock")}
            className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Continue with Stock Fitment
          </button>
        </div>
      )}
      
      {/* Back Button */}
      <div className="mt-8 text-center">
        <button
          onClick={() => goToStep("vehicle")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Change Vehicle
        </button>
      </div>
      
      {/* Trust Badges */}
      <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="text-green-500">✓</span> Installed in-store
        </span>
        <span className="flex items-center gap-1">
          <span className="text-green-500">✓</span> Fitment verified
        </span>
        <span className="flex items-center gap-1">
          <span className="text-green-500">✓</span> Ready same day
        </span>
      </div>
    </div>
  );
}
