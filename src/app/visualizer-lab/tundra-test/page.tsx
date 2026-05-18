"use client";

/**
 * Visualizer Lab - Tundra Test
 * 
 * Isolated proof-of-concept for wheel overlay positioning.
 * NO REGRESSION: This page does not affect any existing ecommerce flows.
 * 
 * Purpose: Test whether we can overlay wheel/tire images onto a vehicle
 * side-profile image with accurate positioning controls.
 */

import { useState, useRef, useEffect, useCallback } from "react";

interface WheelPosition {
  x: number;
  y: number;
  radius: number;
}

interface VisualizerConfig {
  vehicleImage: string;
  wheelImage: string;
  frontWheel: WheelPosition;
  rearWheel: WheelPosition;
  vehicleVerticalOffset: number;
  tireScale: number;
}

const DEFAULT_CONFIG: VisualizerConfig = {
  vehicleImage: "/visualizer/vehicles/visualizer-tundra-2010-sr5-white-side.png",
  wheelImage: "/visualizer/wheels/test-wheel.png",
  frontWheel: { x: 159, y: 680, radius: 95 },
  rearWheel: { x: 1185, y: 680, radius: 92 },
  vehicleVerticalOffset: 0,
  tireScale: 1,
};

export default function TundraTestPage() {
  const [config, setConfig] = useState<VisualizerConfig>(DEFAULT_CONFIG);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Track rendered image dimensions for coordinate scaling
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });

  // Update rendered size on resize
  useEffect(() => {
    const updateSize = () => {
      if (imageRef.current && imageLoaded) {
        setRenderedSize({
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [imageLoaded]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setRenderedSize({ width: img.clientWidth, height: img.clientHeight });
    setImageLoaded(true);
  };

  // Scale factor from natural to rendered coordinates
  // Use default dimensions (1400x800) if image not loaded for debugging
  const effectiveNaturalWidth = naturalSize.width || 1400;
  const effectiveNaturalHeight = naturalSize.height || 800;
  const effectiveRenderedWidth = renderedSize.width || 1400;
  const effectiveRenderedHeight = renderedSize.height || 800;
  
  const scaleX = effectiveRenderedWidth / effectiveNaturalWidth;
  const scaleY = effectiveRenderedHeight / effectiveNaturalHeight;

  // Convert natural coordinates to rendered coordinates
  const toRendered = useCallback(
    (pos: WheelPosition) => ({
      x: pos.x * scaleX,
      y: pos.y * scaleY,
      radius: pos.radius * Math.min(scaleX, scaleY),
    }),
    [scaleX, scaleY]
  );

  const updateFrontWheel = (key: keyof WheelPosition, value: number) => {
    setConfig((prev) => ({
      ...prev,
      frontWheel: { ...prev.frontWheel, [key]: value },
    }));
  };

  const updateRearWheel = (key: keyof WheelPosition, value: number) => {
    setConfig((prev) => ({
      ...prev,
      rearWheel: { ...prev.rearWheel, [key]: value },
    }));
  };

  const copyConfig = async () => {
    const exportConfig = {
      vehicleImage: config.vehicleImage,
      wheelImage: config.wheelImage,
      frontWheel: config.frontWheel,
      rearWheel: config.rearWheel,
      vehicleVerticalOffset: config.vehicleVerticalOffset,
      tireScale: config.tireScale,
    };
    await navigator.clipboard.writeText(JSON.stringify(exportConfig, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetDefaults = () => {
    setConfig(DEFAULT_CONFIG);
  };

  const frontRendered = toRendered(config.frontWheel);
  const rearRendered = toRendered(config.rearWheel);

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-red-500">🧪 Visualizer Lab</h1>
          <p className="text-neutral-400">
            Tundra Test — Wheel overlay positioning proof-of-concept
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preview Area */}
          <div className="lg:col-span-2">
            <div className="bg-neutral-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">Preview</h2>
              
              {/* Vehicle + Wheels Container */}
              <div
                ref={containerRef}
                className="relative bg-neutral-700 rounded-lg overflow-hidden"
                style={{ minHeight: 500, height: imageLoaded ? 'auto' : 500 }}
              >
                {/* Vehicle Image */}
                <img
                  ref={imageRef}
                  src={config.vehicleImage}
                  alt="2010 Toyota Tundra SR5"
                  className="w-full h-auto"
                  style={{
                    transform: `translateY(${config.vehicleVerticalOffset}px)`,
                  }}
                  onLoad={handleImageLoad}
                  onError={() => setImageLoaded(false)}
                />

                {/* Wheel Overlays - always show for debugging */}
                {(
                  <>
                    {/* Front Wheel */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: frontRendered.x - frontRendered.radius * config.tireScale,
                        top: frontRendered.y - frontRendered.radius * config.tireScale + config.vehicleVerticalOffset * scaleY,
                        width: frontRendered.radius * 2 * config.tireScale,
                        height: frontRendered.radius * 2 * config.tireScale,
                      }}
                    >
                      <img
                        src={config.wheelImage}
                        alt="Front wheel"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 border-2 border-green-500 rounded-full opacity-50" />
                    </div>

                    {/* Rear Wheel */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: rearRendered.x - rearRendered.radius * config.tireScale,
                        top: rearRendered.y - rearRendered.radius * config.tireScale + config.vehicleVerticalOffset * scaleY,
                        width: rearRendered.radius * 2 * config.tireScale,
                        height: rearRendered.radius * 2 * config.tireScale,
                      }}
                    >
                      <img
                        src={config.wheelImage}
                        alt="Rear wheel"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 border-2 border-blue-500 rounded-full opacity-50" />
                    </div>
                  </>
                )}

                {/* Image not loaded state */}
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                    <div className="text-center">
                      <p className="text-lg">⚠️ Vehicle image not found</p>
                      <p className="text-sm mt-2">
                        Add image to: {config.vehicleImage}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Image Info */}
              <div className="mt-3 text-sm text-neutral-400 flex gap-4">
                <span>Natural: {naturalSize.width}×{naturalSize.height}</span>
                <span>Rendered: {renderedSize.width.toFixed(0)}×{renderedSize.height.toFixed(0)}</span>
                <span>Scale: {scaleX.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Front Wheel Controls */}
            <div className="bg-neutral-800 rounded-lg p-4">
              <h3 className="font-semibold text-green-400 mb-3">🟢 Front Wheel</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-neutral-400">X: {config.frontWheel.x}</label>
                  <input
                    type="range"
                    min={0}
                    max={naturalSize.width || 2000}
                    value={config.frontWheel.x}
                    onChange={(e) => updateFrontWheel("x", Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-neutral-400">Y: {config.frontWheel.y}</label>
                  <input
                    type="range"
                    min={0}
                    max={naturalSize.height || 1000}
                    value={config.frontWheel.y}
                    onChange={(e) => updateFrontWheel("y", Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-neutral-400">Radius: {config.frontWheel.radius}</label>
                  <input
                    type="range"
                    min={20}
                    max={200}
                    value={config.frontWheel.radius}
                    onChange={(e) => updateFrontWheel("radius", Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                </div>
              </div>
            </div>

            {/* Rear Wheel Controls */}
            <div className="bg-neutral-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-400 mb-3">🔵 Rear Wheel</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-neutral-400">X: {config.rearWheel.x}</label>
                  <input
                    type="range"
                    min={0}
                    max={naturalSize.width || 2000}
                    value={config.rearWheel.x}
                    onChange={(e) => updateRearWheel("x", Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-neutral-400">Y: {config.rearWheel.y}</label>
                  <input
                    type="range"
                    min={0}
                    max={naturalSize.height || 1000}
                    value={config.rearWheel.y}
                    onChange={(e) => updateRearWheel("y", Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-neutral-400">Radius: {config.rearWheel.radius}</label>
                  <input
                    type="range"
                    min={20}
                    max={200}
                    value={config.rearWheel.radius}
                    onChange={(e) => updateRearWheel("radius", Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Global Controls */}
            <div className="bg-neutral-800 rounded-lg p-4">
              <h3 className="font-semibold text-neutral-300 mb-3">⚙️ Global</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-neutral-400">
                    Vehicle Vertical Offset: {config.vehicleVerticalOffset}
                  </label>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={config.vehicleVerticalOffset}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        vehicleVerticalOffset: Number(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-sm text-neutral-400">
                    Tire Scale: {config.tireScale.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.01}
                    value={config.tireScale}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        tireScale: Number(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={copyConfig}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                {copied ? "✓ Copied!" : "📋 Copy Config"}
              </button>
              <button
                onClick={resetDefaults}
                className="bg-neutral-700 hover:bg-neutral-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                ↺ Reset
              </button>
            </div>

            {/* Live JSON */}
            <div className="bg-neutral-800 rounded-lg p-4">
              <h3 className="font-semibold text-neutral-300 mb-3">📄 Config JSON</h3>
              <pre className="text-xs text-neutral-300 bg-neutral-900 p-3 rounded overflow-auto max-h-64">
                {JSON.stringify(
                  {
                    vehicleImage: config.vehicleImage,
                    wheelImage: config.wheelImage,
                    frontWheel: config.frontWheel,
                    rearWheel: config.rearWheel,
                    vehicleVerticalOffset: config.vehicleVerticalOffset,
                    tireScale: config.tireScale,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-neutral-500">
          <p>
            Visualizer Lab — Isolated test page. Does not affect production flows.
          </p>
        </div>
      </div>
    </div>
  );
}
