"use client";

import React from "react";
import {
  StanceMode,
  WheelDiameter,
  STANCE_MODE_LABELS,
  WHEEL_DIAMETERS,
  WheelAnchor,
} from "@/lib/visualizer-lab/types";

interface VisualizerLabControlsProps {
  stanceMode: StanceMode;
  wheelDiameter: WheelDiameter;
  wheelImageUrl: string;
  showDebug: boolean;
  overrides: {
    wheelScale: number;
    frontWheel: Partial<WheelAnchor>;
    rearWheel: Partial<WheelAnchor>;
    bodyYOffset: number;
  };
  onStanceModeChange: (mode: StanceMode) => void;
  onWheelDiameterChange: (diameter: WheelDiameter) => void;
  onWheelImageUrlChange: (url: string) => void;
  onShowDebugChange: (show: boolean) => void;
  onOverridesChange: (overrides: VisualizerLabControlsProps["overrides"]) => void;
  onExportConfig: () => void;
  onResetOverrides: () => void;
}

export function VisualizerLabControls({
  stanceMode,
  wheelDiameter,
  wheelImageUrl,
  showDebug,
  overrides,
  onStanceModeChange,
  onWheelDiameterChange,
  onWheelImageUrlChange,
  onShowDebugChange,
  onOverridesChange,
  onExportConfig,
  onResetOverrides,
}: VisualizerLabControlsProps) {
  const updateOverride = <K extends keyof typeof overrides>(
    key: K,
    value: (typeof overrides)[K]
  ) => {
    onOverridesChange({ ...overrides, [key]: value });
  };

  const updateFrontWheel = (key: keyof WheelAnchor, value: number) => {
    updateOverride("frontWheel", { ...overrides.frontWheel, [key]: value });
  };

  const updateRearWheel = (key: keyof WheelAnchor, value: number) => {
    updateOverride("rearWheel", { ...overrides.rearWheel, [key]: value });
  };

  return (
    <div className="space-y-6 p-4 bg-neutral-800 rounded-xl border border-neutral-700">
      {/* Stance Mode Selection */}
      <div>
        <label className="block text-sm font-semibold text-neutral-300 mb-2">
          Stance Mode
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.keys(STANCE_MODE_LABELS) as StanceMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onStanceModeChange(mode)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                stanceMode === mode
                  ? "bg-red-600 text-white"
                  : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
              }`}
            >
              {STANCE_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* Wheel Diameter Selection */}
      <div>
        <label className="block text-sm font-semibold text-neutral-300 mb-2">
          Wheel Diameter
        </label>
        <div className="flex flex-wrap gap-2">
          {WHEEL_DIAMETERS.map((dia) => (
            <button
              key={dia}
              onClick={() => onWheelDiameterChange(dia)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                wheelDiameter === dia
                  ? "bg-red-600 text-white"
                  : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
              }`}
            >
              {dia}"
            </button>
          ))}
        </div>
      </div>

      {/* Wheel Image URL */}
      <div>
        <label className="block text-sm font-semibold text-neutral-300 mb-2">
          Wheel Image URL
        </label>
        <input
          type="text"
          value={wheelImageUrl}
          onChange={(e) => onWheelImageUrlChange(e.target.value)}
          placeholder="https://cdn.example.com/wheel.png"
          className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Paste a wheel image URL from WheelPros or your catalog
        </p>
      </div>

      {/* Debug Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-neutral-300">
          Show Debug Overlays
        </label>
        <button
          onClick={() => onShowDebugChange(!showDebug)}
          className={`relative w-12 h-6 rounded-full transition ${
            showDebug ? "bg-red-600" : "bg-neutral-600"
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
              showDebug ? "left-7" : "left-1"
            }`}
          />
        </button>
      </div>

      {/* Fine Tuning Section */}
      <div className="border-t border-neutral-700 pt-4">
        <h3 className="text-sm font-semibold text-neutral-300 mb-4">
          ⚙️ Fine Tuning (Overrides)
        </h3>

        {/* Wheel Scale */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-400 mb-1">
            Wheel Scale: {overrides.wheelScale.toFixed(2)}x
          </label>
          <input
            type="range"
            min="0.8"
            max="1.2"
            step="0.01"
            value={overrides.wheelScale}
            onChange={(e) => updateOverride("wheelScale", parseFloat(e.target.value))}
            className="w-full accent-red-500"
          />
        </div>

        {/* Body Y Offset */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-400 mb-1">
            Body Y Offset: {overrides.bodyYOffset >= 0 ? "+" : ""}{overrides.bodyYOffset}px
          </label>
          <input
            type="range"
            min="-50"
            max="50"
            step="1"
            value={overrides.bodyYOffset}
            onChange={(e) => updateOverride("bodyYOffset", parseInt(e.target.value))}
            className="w-full accent-red-500"
          />
        </div>

        {/* Front Wheel Adjustments */}
        <div className="mb-4 p-3 bg-neutral-700/50 rounded-lg">
          <h4 className="text-xs font-semibold text-green-400 mb-2">FRONT WHEEL</h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                X: {(overrides.frontWheel.x ?? 0) >= 0 ? "+" : ""}{overrides.frontWheel.x ?? 0}
              </label>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={overrides.frontWheel.x ?? 0}
                onChange={(e) => updateFrontWheel("x", parseInt(e.target.value))}
                className="w-full accent-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Y: {(overrides.frontWheel.y ?? 0) >= 0 ? "+" : ""}{overrides.frontWheel.y ?? 0}
              </label>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={overrides.frontWheel.y ?? 0}
                onChange={(e) => updateFrontWheel("y", parseInt(e.target.value))}
                className="w-full accent-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                R: {(overrides.frontWheel.radius ?? 0) >= 0 ? "+" : ""}{overrides.frontWheel.radius ?? 0}
              </label>
              <input
                type="range"
                min="-50"
                max="50"
                step="1"
                value={overrides.frontWheel.radius ?? 0}
                onChange={(e) => updateFrontWheel("radius", parseInt(e.target.value))}
                className="w-full accent-green-500"
              />
            </div>
          </div>
        </div>

        {/* Rear Wheel Adjustments */}
        <div className="mb-4 p-3 bg-neutral-700/50 rounded-lg">
          <h4 className="text-xs font-semibold text-cyan-400 mb-2">REAR WHEEL</h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                X: {(overrides.rearWheel.x ?? 0) >= 0 ? "+" : ""}{overrides.rearWheel.x ?? 0}
              </label>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={overrides.rearWheel.x ?? 0}
                onChange={(e) => updateRearWheel("x", parseInt(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Y: {(overrides.rearWheel.y ?? 0) >= 0 ? "+" : ""}{overrides.rearWheel.y ?? 0}
              </label>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={overrides.rearWheel.y ?? 0}
                onChange={(e) => updateRearWheel("y", parseInt(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                R: {(overrides.rearWheel.radius ?? 0) >= 0 ? "+" : ""}{overrides.rearWheel.radius ?? 0}
              </label>
              <input
                type="range"
                min="-50"
                max="50"
                step="1"
                value={overrides.rearWheel.radius ?? 0}
                onChange={(e) => updateRearWheel("radius", parseInt(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-neutral-700">
        <button
          onClick={onExportConfig}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
        >
          📋 Export Config
        </button>
        <button
          onClick={onResetOverrides}
          className="px-4 py-2 bg-neutral-700 text-neutral-300 rounded-lg font-medium hover:bg-neutral-600 transition"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
