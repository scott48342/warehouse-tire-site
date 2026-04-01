"use client";

import { useState, useEffect } from "react";

export interface WheelPosition {
  top: number;    // % from top
  left: number;   // % from left
  size: number;   // px width
}

export interface VehicleVisualizerConfig {
  vehicle: string;
  slug: string;
  image: string;
  frontWheel: WheelPosition;
  rearWheel: WheelPosition;
}

interface WheelVisualizerProps {
  /** Vehicle config (or slug to load from API) */
  config?: VehicleVisualizerConfig;
  configSlug?: string;
  /** Wheel image URL - pass product.imageUrl here */
  wheelImage?: string;
  /** Container width */
  width?: number;
  /** Show alignment guides (for dev/tuning) */
  showGuides?: boolean;
  /** Callback when wheel positions are adjusted (for dev mode) */
  onConfigChange?: (config: VehicleVisualizerConfig) => void;
  /** Optional className for container */
  className?: string;
}

const DEFAULT_WHEEL = "/visualizer/wheels/wheel-basic.png";

// Shared wheel styling for realistic integration
const wheelStyle = (position: WheelPosition, isRear: boolean = false) => ({
  position: "absolute" as const,
  width: position.size,
  height: position.size,
  top: `${position.top}%`,
  left: `${position.left}%`,
  transform: "translate(-50%, -50%)",
  objectFit: "contain" as const,
  // Depth effects - makes wheels look integrated, not "placed on top"
  filter: "drop-shadow(0px 4px 6px rgba(0,0,0,0.4))",
  opacity: isRear ? 0.92 : 0.95, // Rear slightly more faded for depth
  transition: "all 0.3s ease-out", // Smooth wheel switching
});

export function WheelVisualizer({
  config: propConfig,
  configSlug,
  wheelImage = DEFAULT_WHEEL,
  width = 700,
  showGuides = false,
  onConfigChange,
  className = "",
}: WheelVisualizerProps) {
  const [config, setConfig] = useState<VehicleVisualizerConfig | null>(propConfig || null);
  const [loading, setLoading] = useState(!propConfig && !!configSlug);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // Sync config when prop changes
  useEffect(() => {
    if (propConfig) {
      setConfig(propConfig);
    }
  }, [propConfig]);

  // Load config from slug if not provided directly
  useEffect(() => {
    if (propConfig) return;
    if (!configSlug) return;

    setLoading(true);
    fetch(`/api/admin/visualizer?slug=${configSlug}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Config not found: ${configSlug}`);
        return res.json();
      })
      .then((data) => {
        // Transform DB format to component format
        setConfig({
          vehicle: data.vehicle,
          slug: data.slug,
          image: data.image,
          frontWheel: data.front_wheel || data.frontWheel,
          rearWheel: data.rear_wheel || data.rearWheel,
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [configSlug, propConfig]);

  // Reset image error when wheel image changes
  useEffect(() => {
    setImgError(false);
  }, [wheelImage]);

  if (loading) {
    return (
      <div 
        className={`flex items-center justify-center bg-neutral-100 rounded-xl ${className}`} 
        style={{ width, height: width * 0.5 }}
      >
        <div className="text-neutral-500">Loading visualizer...</div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div 
        className={`flex items-center justify-center bg-neutral-100 rounded-xl ${className}`} 
        style={{ width, height: width * 0.5 }}
      >
        <div className="text-red-500">{error || "No config provided"}</div>
      </div>
    );
  }

  const currentWheel = imgError ? DEFAULT_WHEEL : wheelImage;

  return (
    <div className={`relative overflow-hidden rounded-xl bg-neutral-100 ${className}`} style={{ width }}>
      {/* Vehicle Image */}
      <img
        src={config.image}
        alt={config.vehicle}
        className="w-full block"
        style={{ display: "block" }}
      />

      {/* Rear Wheel (rendered first, sits behind) */}
      <img
        src={currentWheel}
        alt="Rear wheel"
        style={wheelStyle(config.rearWheel, true)}
        onError={() => setImgError(true)}
      />

      {/* Front Wheel */}
      <img
        src={currentWheel}
        alt="Front wheel"
        style={wheelStyle(config.frontWheel, false)}
        onError={() => setImgError(true)}
      />

      {/* Alignment Guides (dev mode) */}
      {showGuides && (
        <>
          {/* Horizontal center line */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-red-500 opacity-50"
            style={{ top: "50%" }}
          />
          {/* Vertical lines at wheel positions */}
          <div
            className="absolute top-0 bottom-0 border-l border-dashed border-blue-500 opacity-50"
            style={{ left: `${config.rearWheel.left}%` }}
          />
          <div
            className="absolute top-0 bottom-0 border-l border-dashed border-blue-500 opacity-50"
            style={{ left: `${config.frontWheel.left}%` }}
          />
          {/* Position labels */}
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Front: {config.frontWheel.left}%, {config.frontWheel.top}% | 
            Rear: {config.rearWheel.left}%, {config.rearWheel.top}%
          </div>
        </>
      )}

      {/* Vehicle label */}
      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
        {config.vehicle}
      </div>
    </div>
  );
}

/**
 * Interactive Visualizer with wheel picker
 * Use this on product pages to let users see wheels on their vehicle
 */
export function WheelVisualizerWithPicker({
  config,
  configSlug,
  wheels,
  initialWheelIndex = 0,
  width = 700,
  onWheelSelect,
}: {
  config?: VehicleVisualizerConfig;
  configSlug?: string;
  wheels: Array<{ id: string; name: string; imageUrl: string; price?: number }>;
  initialWheelIndex?: number;
  width?: number;
  onWheelSelect?: (wheel: { id: string; name: string; imageUrl: string }) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(initialWheelIndex);
  const selectedWheel = wheels[selectedIndex];

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    if (onWheelSelect && wheels[index]) {
      onWheelSelect(wheels[index]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Visualizer */}
      <WheelVisualizer
        config={config}
        configSlug={configSlug}
        wheelImage={selectedWheel?.imageUrl}
        width={width}
      />

      {/* Wheel Picker */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {wheels.map((wheel, index) => (
          <button
            key={wheel.id}
            onClick={() => handleSelect(index)}
            className={`flex-shrink-0 p-2 rounded-lg border-2 transition-all ${
              index === selectedIndex
                ? "border-red-600 bg-red-50"
                : "border-neutral-200 hover:border-neutral-400"
            }`}
          >
            <img
              src={wheel.imageUrl}
              alt={wheel.name}
              className="w-16 h-16 object-contain"
            />
            <div className="text-xs text-center mt-1 truncate max-w-[70px]">
              {wheel.name}
            </div>
            {wheel.price && (
              <div className="text-xs text-center font-semibold text-red-600">
                ${wheel.price}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Dev tool for adjusting wheel positions
 */
export function WheelVisualizerEditor({
  config: initialConfig,
  wheelImage,
  onSave,
}: {
  config: VehicleVisualizerConfig;
  wheelImage?: string;
  onSave?: (config: VehicleVisualizerConfig) => Promise<void>;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [currentWheel, setCurrentWheel] = useState(wheelImage || DEFAULT_WHEEL);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const updateFront = (key: keyof WheelPosition, value: number) => {
    setConfig((c) => ({ ...c, frontWheel: { ...c.frontWheel, [key]: value } }));
    setSaveStatus("idle");
  };

  const updateRear = (key: keyof WheelPosition, value: number) => {
    setConfig((c) => ({ ...c, rearWheel: { ...c.rearWheel, [key]: value } }));
    setSaveStatus("idle");
  };

  const updateConfig = (key: keyof VehicleVisualizerConfig, value: string) => {
    setConfig((c) => ({ ...c, [key]: value }));
    setSaveStatus("idle");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      if (onSave) {
        await onSave(config);
      } else {
        // Default save to API
        const res = await fetch("/api/admin/visualizer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        if (!res.ok) throw new Error("Save failed");
      }
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <WheelVisualizer config={config} wheelImage={currentWheel} showGuides />

      {/* Wheel URL Input */}
      <div className="p-4 bg-white border border-neutral-200 rounded-xl">
        <label className="block text-sm font-semibold text-neutral-700 mb-1">
          Test Wheel Image URL
        </label>
        <input
          type="text"
          value={currentWheel}
          onChange={(e) => setCurrentWheel(e.target.value)}
          placeholder="https://example.com/wheel.png or /visualizer/wheels/..."
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Paste any wheel image URL to preview (WheelPros, local, etc.)
        </p>
      </div>

      {/* Config Metadata */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-white border border-neutral-200 rounded-xl">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-1">
            Vehicle Name
          </label>
          <input
            type="text"
            value={config.vehicle}
            onChange={(e) => updateConfig("vehicle", e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-1">
            Slug (URL-friendly)
          </label>
          <input
            type="text"
            value={config.slug}
            onChange={(e) => updateConfig("slug", e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-semibold text-neutral-700 mb-1">
            Vehicle Image Path
          </label>
          <input
            type="text"
            value={config.image}
            onChange={(e) => updateConfig("image", e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 bg-neutral-100 rounded-xl">
        {/* Front Wheel Controls */}
        <div>
          <h4 className="font-bold mb-2">Front Wheel</h4>
          <label className="block text-sm">
            Top: {config.frontWheel.top}%
            <input
              type="range"
              min={0}
              max={100}
              value={config.frontWheel.top}
              onChange={(e) => updateFront("top", Number(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block text-sm">
            Left: {config.frontWheel.left}%
            <input
              type="range"
              min={0}
              max={100}
              value={config.frontWheel.left}
              onChange={(e) => updateFront("left", Number(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block text-sm">
            Size: {config.frontWheel.size}px
            <input
              type="range"
              min={50}
              max={300}
              value={config.frontWheel.size}
              onChange={(e) => updateFront("size", Number(e.target.value))}
              className="w-full"
            />
          </label>
        </div>

        {/* Rear Wheel Controls */}
        <div>
          <h4 className="font-bold mb-2">Rear Wheel</h4>
          <label className="block text-sm">
            Top: {config.rearWheel.top}%
            <input
              type="range"
              min={0}
              max={100}
              value={config.rearWheel.top}
              onChange={(e) => updateRear("top", Number(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block text-sm">
            Left: {config.rearWheel.left}%
            <input
              type="range"
              min={0}
              max={100}
              value={config.rearWheel.left}
              onChange={(e) => updateRear("left", Number(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block text-sm">
            Size: {config.rearWheel.size}px
            <input
              type="range"
              min={50}
              max={300}
              value={config.rearWheel.size}
              onChange={(e) => updateRear("size", Number(e.target.value))}
              className="w-full"
            />
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
            saving
              ? "bg-neutral-400 cursor-not-allowed"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {saving ? "Saving..." : "💾 Save Configuration"}
        </button>
        {saveStatus === "success" && (
          <span className="text-green-600 font-semibold">✓ Saved!</span>
        )}
        {saveStatus === "error" && (
          <span className="text-red-600 font-semibold">✗ Save failed</span>
        )}
      </div>

      {/* JSON Output */}
      <div className="p-4 bg-neutral-900 text-green-400 rounded-xl font-mono text-xs overflow-auto">
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </div>
    </div>
  );
}

export default WheelVisualizer;
