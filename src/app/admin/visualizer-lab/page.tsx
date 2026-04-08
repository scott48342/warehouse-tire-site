"use client";

import React, { useState, useCallback, useMemo } from "react";
import { VisualizerLabRenderer, VisualizerLabControls, WheelAnalysisTool } from "@/components/visualizer-lab";
import {
  TemplateFamilyConfig,
  StanceMode,
  WheelDiameter,
  WheelAnchor,
  FamilyId,
  FAMILY_LABELS,
} from "@/lib/visualizer-lab/types";
import {
  getAvailableFamilies,
  getFamilyConfig,
  getFamilyAssetPath,
} from "@/lib/visualizer-lab/families";

// Default overrides (all zeroed out)
const DEFAULT_OVERRIDES = {
  wheelScale: 1.0,
  frontWheel: {} as Partial<WheelAnchor>,
  rearWheel: {} as Partial<WheelAnchor>,
  bodyYOffset: 0,
};

export default function VisualizerLabPage() {
  // Available families
  const availableFamilies = useMemo(() => getAvailableFamilies(), []);

  // State
  const [selectedFamily, setSelectedFamily] = useState<FamilyId>(availableFamilies[0] || "half_ton_truck_v1");
  const [stanceMode, setStanceMode] = useState<StanceMode>("stock");
  const [wheelDiameter, setWheelDiameter] = useState<WheelDiameter>(20);
  const [wheelImageUrl, setWheelImageUrl] = useState<string>("");
  const [showDebug, setShowDebug] = useState<boolean>(true);
  const [showTire, setShowTire] = useState<boolean>(true);
  const [tireScale, setTireScale] = useState<number>(1.18);
  const [overrides, setOverrides] = useState(DEFAULT_OVERRIDES);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Get current family config
  const familyConfig = useMemo(() => {
    return getFamilyConfig(selectedFamily) || null;
  }, [selectedFamily]);

  // Get vehicle template URL for current stance
  const vehicleImageUrl = useMemo(() => {
    return getFamilyAssetPath(selectedFamily, stanceMode);
  }, [selectedFamily, stanceMode]);

  // Export handler
  const handleExportConfig = useCallback(() => {
    if (!familyConfig) return;

    // Apply overrides to create modified config
    const exportConfig: TemplateFamilyConfig = {
      ...familyConfig,
      anchors: {
        frontWheel: {
          x: familyConfig.anchors.frontWheel.x + (overrides.frontWheel.x ?? 0),
          y: familyConfig.anchors.frontWheel.y + (overrides.frontWheel.y ?? 0),
          radius: familyConfig.anchors.frontWheel.radius + (overrides.frontWheel.radius ?? 0),
        },
        rearWheel: {
          x: familyConfig.anchors.rearWheel.x + (overrides.rearWheel.x ?? 0),
          y: familyConfig.anchors.rearWheel.y + (overrides.rearWheel.y ?? 0),
          radius: familyConfig.anchors.rearWheel.radius + (overrides.rearWheel.radius ?? 0),
        },
      },
      stanceProfiles: {
        ...familyConfig.stanceProfiles,
        [stanceMode]: {
          bodyYOffset: familyConfig.stanceProfiles[stanceMode].bodyYOffset + overrides.bodyYOffset,
          wheelScale: familyConfig.stanceProfiles[stanceMode].wheelScale * overrides.wheelScale,
        },
      },
    };

    const json = JSON.stringify(exportConfig, null, 2);

    // Copy to clipboard
    navigator.clipboard.writeText(json).then(() => {
      setExportMessage("✅ Config copied to clipboard!");
      setTimeout(() => setExportMessage(null), 3000);
    }).catch(() => {
      // Fallback: log to console
      console.log("📋 Exported Config:", exportConfig);
      setExportMessage("📋 Config logged to console (clipboard unavailable)");
      setTimeout(() => setExportMessage(null), 3000);
    });
  }, [familyConfig, overrides, stanceMode]);

  // Reset overrides
  const handleResetOverrides = useCallback(() => {
    setOverrides(DEFAULT_OVERRIDES);
  }, []);

  // Handle family change
  const handleFamilyChange = useCallback((familyId: FamilyId) => {
    setSelectedFamily(familyId);
    setStanceMode("stock");
    setOverrides(DEFAULT_OVERRIDES);
  }, []);

  if (!familyConfig) {
    return (
      <div className="text-center py-20">
        <div className="text-red-500 text-lg">No family config found</div>
        <p className="text-neutral-400 mt-2">Available: {availableFamilies.join(", ") || "None"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          🔬 Visualizer Lab
          <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-semibold">
            INTERNAL
          </span>
        </h1>
        <p className="text-neutral-400 text-sm mt-1">
          Template family R&D and calibration tool. Not for public use.
        </p>
      </div>

      {/* Family Selector */}
      <div className="mb-6 p-4 bg-neutral-800 rounded-xl border border-neutral-700">
        <label className="block text-sm font-semibold text-neutral-300 mb-2">
          Template Family
        </label>
        <select
          value={selectedFamily}
          onChange={(e) => handleFamilyChange(e.target.value as FamilyId)}
          className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {availableFamilies.map((fam) => (
            <option key={fam} value={fam}>
              {FAMILY_LABELS[fam]}
            </option>
          ))}
        </select>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Canvas */}
        <div className="xl:col-span-2">
          <VisualizerLabRenderer
            familyConfig={familyConfig}
            stanceMode={stanceMode}
            wheelDiameter={wheelDiameter}
            vehicleImageUrl={vehicleImageUrl}
            wheelImageUrl={wheelImageUrl || null}
            overrides={overrides}
            showDebug={showDebug}
            onOverridesChange={setOverrides}
            showTire={showTire}
            tireScale={tireScale}
          />

          {/* Export message */}
          {exportMessage && (
            <div className="mt-4 p-3 bg-green-900/50 border border-green-700 rounded-lg text-green-400 text-sm">
              {exportMessage}
            </div>
          )}

          {/* Asset Status */}
          <div className="mt-4 p-4 bg-neutral-800 rounded-xl border border-neutral-700">
            <h3 className="text-sm font-semibold text-neutral-300 mb-2">📁 Asset Status</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className={vehicleImageUrl ? "text-green-400" : "text-red-400"}>
                  {vehicleImageUrl ? "✅" : "❌"}
                </span>
                <span className="text-neutral-400">
                  Vehicle: {vehicleImageUrl || "Not configured"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={wheelImageUrl ? "text-green-400" : "text-amber-400"}>
                  {wheelImageUrl ? "✅" : "⚠️"}
                </span>
                <span className="text-neutral-400">
                  Wheel: {wheelImageUrl ? "Loaded" : "None (paste URL above)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="xl:col-span-1 space-y-6">
          {/* Wheel Analyzer - find compatible wheels */}
          <WheelAnalysisTool onSelectImage={setWheelImageUrl} />

          <VisualizerLabControls
            stanceMode={stanceMode}
            wheelDiameter={wheelDiameter}
            wheelImageUrl={wheelImageUrl}
            showDebug={showDebug}
            showTire={showTire}
            tireScale={tireScale}
            overrides={overrides}
            onStanceModeChange={setStanceMode}
            onWheelDiameterChange={setWheelDiameter}
            onWheelImageUrlChange={setWheelImageUrl}
            onShowDebugChange={setShowDebug}
            onShowTireChange={setShowTire}
            onTireScaleChange={setTireScale}
            onOverridesChange={setOverrides}
            onExportConfig={handleExportConfig}
            onResetOverrides={handleResetOverrides}
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-amber-900/30 border border-amber-700/50 rounded-xl">
        <h3 className="font-bold text-amber-400 mb-2">📋 Visualizer Lab Controls</h3>
        <div className="text-sm text-amber-200/80 space-y-2">
          <p><strong>🖱️ Direct Manipulation:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Click</strong> a wheel to select it</li>
            <li><strong>Drag center</strong> to move the wheel position</li>
            <li><strong>Drag edge</strong> to resize the wheel radius</li>
          </ul>
          <p className="mt-2"><strong>⌨️ Keyboard Controls</strong> (when wheel selected):</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Arrow keys:</strong> move 1px (shift = 10px)</li>
            <li><strong>+/-:</strong> resize radius (shift = 10px, alt = 1px)</li>
            <li><strong>Tab:</strong> switch between front/rear wheel</li>
            <li><strong>Esc:</strong> deselect</li>
          </ul>
          <p className="mt-2"><strong>📁 Assets:</strong> Add templates to <code className="bg-amber-800/50 px-1 rounded">/public/visualizer-lab/families/half_ton_truck_v1/</code></p>
          <p><strong>📋 Export:</strong> Click "Export Config" to copy calibrated JSON</p>
        </div>
      </div>

      {/* Current Config Display */}
      <details className="mt-6">
        <summary className="text-sm text-neutral-500 cursor-pointer hover:text-neutral-300">
          View Current Family Config JSON
        </summary>
        <pre className="mt-2 p-4 bg-neutral-900 rounded-xl text-xs text-neutral-400 overflow-auto max-h-96">
          {JSON.stringify(familyConfig, null, 2)}
        </pre>
      </details>
    </div>
  );
}
