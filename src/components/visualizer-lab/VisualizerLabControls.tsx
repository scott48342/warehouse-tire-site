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
  showTire: boolean;
  tireScale: number;
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
  onShowTireChange: (show: boolean) => void;
  onTireScaleChange: (scale: number) => void;
  onOverridesChange: (overrides: VisualizerLabControlsProps["overrides"]) => void;
  onExportConfig: () => void;
  onResetOverrides: () => void;
  onLoadConfig?: () => void;
}

// Slider + Input combo for precise control
function SliderWithInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  accentColor = "red",
  suffix = "",
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step?: number;
  accentColor?: "red" | "green" | "cyan";
  suffix?: string;
}) {
  const accentClasses = {
    red: "accent-red-500",
    green: "accent-green-500",
    cyan: "accent-cyan-500",
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      onChange(val);
    }
  };

  const displayValue = step < 1 ? value.toFixed(2) : value.toString();
  const sign = value >= 0 ? "+" : "";

  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1">
        {label}: {sign}{displayValue}{suffix}
      </label>
      <div className="flex gap-2 items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={`flex-1 ${accentClasses[accentColor]}`}
        />
        <input
          type="number"
          value={value}
          onChange={handleInputChange}
          step={step}
          className="w-16 px-2 py-1 bg-neutral-600 border border-neutral-500 rounded text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
      </div>
    </div>
  );
}

// Wheel adjustment panel (front or rear)
function WheelAdjustmentPanel({
  label,
  color,
  wheelOverrides,
  onUpdate,
}: {
  label: string;
  color: "green" | "cyan";
  wheelOverrides: Partial<WheelAnchor>;
  onUpdate: (key: keyof WheelAnchor, value: number) => void;
}) {
  const colorClasses = {
    green: "text-green-400",
    cyan: "text-cyan-400",
  };

  return (
    <div className="mb-4 p-3 bg-neutral-700/50 rounded-lg">
      <h4 className={`text-xs font-semibold ${colorClasses[color]} mb-3`}>{label}</h4>
      <div className="space-y-3">
        <SliderWithInput
          label="X"
          value={wheelOverrides.x ?? 0}
          onChange={(val) => onUpdate("x", val)}
          min={-500}
          max={500}
          accentColor={color}
          suffix="px"
        />
        <SliderWithInput
          label="Y"
          value={wheelOverrides.y ?? 0}
          onChange={(val) => onUpdate("y", val)}
          min={-500}
          max={500}
          accentColor={color}
          suffix="px"
        />
        <SliderWithInput
          label="Radius"
          value={wheelOverrides.radius ?? 0}
          onChange={(val) => onUpdate("radius", val)}
          min={-200}
          max={200}
          accentColor={color}
          suffix="px"
        />
      </div>
    </div>
  );
}

export function VisualizerLabControls({
  stanceMode,
  wheelDiameter,
  wheelImageUrl,
  showDebug,
  showTire,
  tireScale,
  overrides,
  onStanceModeChange,
  onWheelDiameterChange,
  onWheelImageUrlChange,
  onShowDebugChange,
  onShowTireChange,
  onTireScaleChange,
  onOverridesChange,
  onExportConfig,
  onResetOverrides,
  onLoadConfig,
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

      {/* Tire Controls */}
      <div className="p-3 bg-neutral-700/50 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-neutral-300">
            🛞 Show Tire
          </label>
          <button
            onClick={() => onShowTireChange(!showTire)}
            className={`relative w-12 h-6 rounded-full transition ${
              showTire ? "bg-green-600" : "bg-neutral-600"
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
                showTire ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
        
        {showTire && (
          <SliderWithInput
            label="Tire Scale"
            value={tireScale}
            onChange={onTireScaleChange}
            min={0.92}
            max={1.15}
            step={0.01}
            accentColor="green"
            suffix="x"
          />
        )}
        
        <p className="text-xs text-neutral-500">
          Tire outer size multiplier. Lower = tighter fit in wheel well.
        </p>
      </div>

      {/* Fine Tuning Section */}
      <div className="border-t border-neutral-700 pt-4">
        <h3 className="text-sm font-semibold text-neutral-300 mb-4">
          ⚙️ Fine Tuning (Overrides)
        </h3>

        {/* Wheel Scale */}
        <div className="mb-4">
          <SliderWithInput
            label="Wheel Scale"
            value={overrides.wheelScale}
            onChange={(val) => updateOverride("wheelScale", val)}
            min={0.5}
            max={2.0}
            step={0.01}
            accentColor="red"
            suffix="x"
          />
        </div>

        {/* Body Y Offset */}
        <div className="mb-4">
          <SliderWithInput
            label="Body Y Offset"
            value={overrides.bodyYOffset}
            onChange={(val) => updateOverride("bodyYOffset", val)}
            min={-200}
            max={200}
            accentColor="red"
            suffix="px"
          />
        </div>

        {/* Front Wheel Adjustments */}
        <WheelAdjustmentPanel
          label="FRONT WHEEL"
          color="green"
          wheelOverrides={overrides.frontWheel}
          onUpdate={updateFrontWheel}
        />

        {/* Rear Wheel Adjustments */}
        <WheelAdjustmentPanel
          label="REAR WHEEL"
          color="cyan"
          wheelOverrides={overrides.rearWheel}
          onUpdate={updateRearWheel}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-4 border-t border-neutral-700">
        <div className="flex gap-2">
          <button
            onClick={onExportConfig}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
          >
            📋 Export
          </button>
          {onLoadConfig && (
            <button
              onClick={onLoadConfig}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              📂 Load
            </button>
          )}
        </div>
        <button
          onClick={onResetOverrides}
          className="w-full px-4 py-2 bg-neutral-700 text-neutral-300 rounded-lg font-medium hover:bg-neutral-600 transition"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
