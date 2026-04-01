"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

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
  /** Vehicle config (or slug to load from /visualizer/config/) */
  config?: VehicleVisualizerConfig;
  configSlug?: string;
  /** Wheel image URL */
  wheelImage?: string;
  /** Container width */
  width?: number;
  /** Show alignment guides (for dev/tuning) */
  showGuides?: boolean;
  /** Callback when wheel positions are adjusted (for dev mode) */
  onConfigChange?: (config: VehicleVisualizerConfig) => void;
}

const DEFAULT_WHEEL = "/visualizer/wheels/wheel-basic.png";

export function WheelVisualizer({
  config: propConfig,
  configSlug,
  wheelImage = DEFAULT_WHEEL,
  width = 700,
  showGuides = false,
  onConfigChange,
}: WheelVisualizerProps) {
  const [config, setConfig] = useState<VehicleVisualizerConfig | null>(propConfig || null);
  const [loading, setLoading] = useState(!propConfig && !!configSlug);
  const [error, setError] = useState<string | null>(null);

  // Load config from slug if not provided directly
  useEffect(() => {
    if (propConfig) {
      setConfig(propConfig);
      return;
    }
    if (!configSlug) return;

    setLoading(true);
    fetch(`/visualizer/config/${configSlug}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Config not found: ${configSlug}`);
        return res.json();
      })
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [configSlug, propConfig]);

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-neutral-100 rounded-xl" style={{ width, height: width * 0.5 }}>
        <div className="text-neutral-500">Loading visualizer...</div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex items-center justify-center bg-neutral-100 rounded-xl" style={{ width, height: width * 0.5 }}>
        <div className="text-red-500">{error || "No config provided"}</div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-neutral-100" style={{ width }}>
      {/* Vehicle Image */}
      <img
        src={config.image}
        alt={config.vehicle}
        className="w-full block"
        style={{ display: "block" }}
      />

      {/* Rear Wheel */}
      <img
        src={wheelImage}
        alt="Rear wheel"
        style={{
          position: "absolute",
          width: config.rearWheel.size,
          height: config.rearWheel.size,
          top: `${config.rearWheel.top}%`,
          left: `${config.rearWheel.left}%`,
          transform: "translate(-50%, -50%)",
          objectFit: "contain",
        }}
      />

      {/* Front Wheel */}
      <img
        src={wheelImage}
        alt="Front wheel"
        style={{
          position: "absolute",
          width: config.frontWheel.size,
          height: config.frontWheel.size,
          top: `${config.frontWheel.top}%`,
          left: `${config.frontWheel.left}%`,
          transform: "translate(-50%, -50%)",
          objectFit: "contain",
        }}
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
 * Dev tool for adjusting wheel positions
 */
export function WheelVisualizerEditor({
  config: initialConfig,
  wheelImage,
}: {
  config: VehicleVisualizerConfig;
  wheelImage?: string;
}) {
  const [config, setConfig] = useState(initialConfig);

  const updateFront = (key: keyof WheelPosition, value: number) => {
    setConfig((c) => ({ ...c, frontWheel: { ...c.frontWheel, [key]: value } }));
  };

  const updateRear = (key: keyof WheelPosition, value: number) => {
    setConfig((c) => ({ ...c, rearWheel: { ...c.rearWheel, [key]: value } }));
  };

  return (
    <div className="space-y-4">
      <WheelVisualizer config={config} wheelImage={wheelImage} showGuides />

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

      {/* JSON Output */}
      <div className="p-4 bg-neutral-900 text-green-400 rounded-xl font-mono text-xs overflow-auto">
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </div>
    </div>
  );
}

export default WheelVisualizer;
