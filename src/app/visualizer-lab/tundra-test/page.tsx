"use client";

/**
 * Visualizer Lab - Tundra Test (Enhanced)
 * 
 * Isolated proof-of-concept for wheel/tire overlay positioning with:
 * - Separate wheel + tire layer rendering
 * - Ride height / lift simulation
 * - Real wheel asset support
 * - Shadow and depth effects
 * - Save/Load configuration
 * 
 * NO REGRESSION: This page does not affect any existing ecommerce flows.
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface WheelPosition {
  x: number;
  y: number;
  radius: number;
}

interface TireSettings {
  outerDiameterScale: number;  // Overall tire size (1.0 = same as wheel)
  sidewallThickness: number;   // Sidewall height in pixels (natural coords)
  profileRatio: number;        // Visual aspect ratio simulation
}

interface LiftPreset {
  name: string;
  bodyOffset: number;
  tireScale: number;
  sidewallBoost: number;
}

interface VisualizerConfig {
  vehicleImage: string;
  wheelImage: string;
  frontWheel: WheelPosition;
  rearWheel: WheelPosition;
  tire: TireSettings;
  bodyLift: number;
  wheelScale: number;
  // Visual effects
  showTireShadow: boolean;
  showWheelShadow: boolean;
  shadowOpacity: number;
  shadowBlur: number;
  // Debug
  showDebugOutlines: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LIFT_PRESETS: LiftPreset[] = [
  { name: "Stock", bodyOffset: 0, tireScale: 1.0, sidewallBoost: 0 },
  { name: "Leveling Kit", bodyOffset: -15, tireScale: 1.05, sidewallBoost: 5 },
  { name: "4\" Lift", bodyOffset: -35, tireScale: 1.15, sidewallBoost: 15 },
  { name: "6\" Lift", bodyOffset: -55, tireScale: 1.25, sidewallBoost: 25 },
];

const WHEEL_ASSETS = [
  { name: "Test Wheel", path: "/visualizer/wheels/test-wheel.png" },
  { name: "Basic Wheel", path: "/visualizer/wheels/wheel-basic.png" },
];

const DEFAULT_CONFIG: VisualizerConfig = {
  vehicleImage: "/visualizer/vehicles/visualizer-tundra-2010-sr5-white-side.png",
  wheelImage: "/visualizer/wheels/test-wheel.png",
  frontWheel: { x: 260, y: 622, radius: 92 },
  rearWheel: { x: 1385, y: 627, radius: 92 },
  tire: {
    outerDiameterScale: 1.35,
    sidewallThickness: 30,
    profileRatio: 1.0,
  },
  bodyLift: 0,
  wheelScale: 1.0,
  showTireShadow: true,
  showWheelShadow: true,
  shadowOpacity: 0.4,
  shadowBlur: 8,
  showDebugOutlines: false,
};

// ============================================================================
// WHEEL/TIRE RENDERER COMPONENT
// ============================================================================

interface WheelTireRendererProps {
  position: WheelPosition;
  config: VisualizerConfig;
  scaleX: number;
  scaleY: number;
  label: string;
  color: string;
}

function WheelTireRenderer({
  position,
  config,
  scaleX,
  scaleY,
  label,
  color,
}: WheelTireRendererProps) {
  const scale = Math.min(scaleX, scaleY);
  
  // Calculate rendered positions
  const centerX = position.x * scaleX;
  const centerY = position.y * scaleY;
  const wheelRadius = position.radius * scale * config.wheelScale;
  
  // Tire dimensions
  const tireOuterRadius = wheelRadius * config.tire.outerDiameterScale;
  const sidewallRendered = config.tire.sidewallThickness * scale;
  
  // Actual tire outer radius (wheel + sidewall)
  const actualTireRadius = wheelRadius + sidewallRendered;
  
  // Use the larger of calculated or scaled outer radius
  const finalTireRadius = Math.max(tireOuterRadius, actualTireRadius);
  
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: centerX - finalTireRadius,
        top: centerY - finalTireRadius + config.bodyLift * scaleY,
        width: finalTireRadius * 2,
        height: finalTireRadius * 2,
      }}
    >
      {/* Tire Shadow (bottom layer) */}
      {config.showTireShadow && (
        <div
          className="absolute rounded-full"
          style={{
            left: 4,
            top: 6,
            width: finalTireRadius * 2,
            height: finalTireRadius * 2,
            background: `rgba(0,0,0,${config.shadowOpacity})`,
            filter: `blur(${config.shadowBlur}px)`,
          }}
        />
      )}
      
      {/* Tire (black ring behind wheel) */}
      <div
        className="absolute rounded-full"
        style={{
          left: 0,
          top: 0,
          width: finalTireRadius * 2,
          height: finalTireRadius * 2,
          background: "radial-gradient(circle, #1a1a1a 0%, #0d0d0d 70%, #000 100%)",
          boxShadow: "inset 0 0 20px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,0,0,0.4)",
        }}
      />
      
      {/* Tire tread texture overlay */}
      <div
        className="absolute rounded-full"
        style={{
          left: 0,
          top: 0,
          width: finalTireRadius * 2,
          height: finalTireRadius * 2,
          background: `repeating-radial-gradient(
            circle at center,
            transparent 0px,
            transparent 2px,
            rgba(30,30,30,0.3) 2px,
            rgba(30,30,30,0.3) 4px
          )`,
          opacity: 0.5,
        }}
      />
      
      {/* Wheel Shadow */}
      {config.showWheelShadow && (
        <div
          className="absolute rounded-full"
          style={{
            left: finalTireRadius - wheelRadius + 2,
            top: finalTireRadius - wheelRadius + 3,
            width: wheelRadius * 2,
            height: wheelRadius * 2,
            background: `rgba(0,0,0,${config.shadowOpacity * 0.5})`,
            filter: `blur(${config.shadowBlur * 0.5}px)`,
          }}
        />
      )}
      
      {/* Wheel (center, on top of tire) */}
      <div
        className="absolute rounded-full overflow-hidden"
        style={{
          left: finalTireRadius - wheelRadius,
          top: finalTireRadius - wheelRadius,
          width: wheelRadius * 2,
          height: wheelRadius * 2,
        }}
      >
        <img
          src={config.wheelImage}
          alt={`${label} wheel`}
          className="w-full h-full object-contain"
          style={{
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
          }}
        />
      </div>
      
      {/* Debug outlines */}
      {config.showDebugOutlines && (
        <>
          {/* Tire outline */}
          <div
            className="absolute rounded-full border-2 border-dashed"
            style={{
              left: 0,
              top: 0,
              width: finalTireRadius * 2,
              height: finalTireRadius * 2,
              borderColor: color,
              opacity: 0.5,
            }}
          />
          {/* Wheel outline */}
          <div
            className="absolute rounded-full border-2"
            style={{
              left: finalTireRadius - wheelRadius,
              top: finalTireRadius - wheelRadius,
              width: wheelRadius * 2,
              height: wheelRadius * 2,
              borderColor: color,
              opacity: 0.7,
            }}
          />
          {/* Center point */}
          <div
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: finalTireRadius - 4,
              top: finalTireRadius - 4,
              backgroundColor: color,
            }}
          />
        </>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function TundraTestPage() {
  const [config, setConfig] = useState<VisualizerConfig>(DEFAULT_CONFIG);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [copied, setCopied] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<{ name: string; config: VisualizerConfig }[]>([]);
  const [saveName, setSaveName] = useState("");
  const [activeTab, setActiveTab] = useState<"wheels" | "tires" | "lift" | "effects" | "save">("wheels");
  const imageRef = useRef<HTMLImageElement>(null);

  // Track rendered image dimensions for coordinate scaling
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });

  // Load saved configs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("visualizer-lab-configs");
    if (saved) {
      try {
        setSavedConfigs(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved configs:", e);
      }
    }
  }, []);

  // Handle already-cached images - check periodically until ref is available
  useEffect(() => {
    const checkImage = () => {
      const img = imageRef.current;
      if (img && img.complete && img.naturalWidth > 0 && !imageLoaded) {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        setRenderedSize({ width: img.clientWidth, height: img.clientHeight });
        setImageLoaded(true);
        return true;
      }
      return false;
    };
    
    // Check immediately
    if (checkImage()) return;
    
    // Also check after a short delay (for SSR hydration)
    const timeouts = [50, 150, 300, 500].map(ms => 
      setTimeout(checkImage, ms)
    );
    
    return () => timeouts.forEach(clearTimeout);
  }, [config.vehicleImage, imageLoaded]);

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

  // Scale factors
  const effectiveNaturalWidth = naturalSize.width || 1920;
  const effectiveNaturalHeight = naturalSize.height || 1080;
  const effectiveRenderedWidth = renderedSize.width || 1920;
  const effectiveRenderedHeight = renderedSize.height || 1080;
  
  const scaleX = effectiveRenderedWidth / effectiveNaturalWidth;
  const scaleY = effectiveRenderedHeight / effectiveNaturalHeight;

  // Update functions
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

  const updateTire = (key: keyof TireSettings, value: number) => {
    setConfig((prev) => ({
      ...prev,
      tire: { ...prev.tire, [key]: value },
    }));
  };

  const applyLiftPreset = (preset: LiftPreset) => {
    setConfig((prev) => ({
      ...prev,
      bodyLift: preset.bodyOffset,
      wheelScale: preset.tireScale,
      tire: {
        ...prev.tire,
        sidewallThickness: DEFAULT_CONFIG.tire.sidewallThickness + preset.sidewallBoost,
      },
    }));
  };

  const copyConfig = async () => {
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visualizer-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        setConfig({ ...DEFAULT_CONFIG, ...imported });
      } catch (err) {
        alert("Invalid config file");
      }
    };
    reader.readAsText(file);
  };

  const saveConfig = () => {
    if (!saveName.trim()) return;
    
    const newConfigs = [...savedConfigs, { name: saveName, config: { ...config } }];
    setSavedConfigs(newConfigs);
    localStorage.setItem("visualizer-lab-configs", JSON.stringify(newConfigs));
    setSaveName("");
  };

  const loadConfig = (saved: { name: string; config: VisualizerConfig }) => {
    setConfig(saved.config);
  };

  const deleteConfig = (index: number) => {
    const newConfigs = savedConfigs.filter((_, i) => i !== index);
    setSavedConfigs(newConfigs);
    localStorage.setItem("visualizer-lab-configs", JSON.stringify(newConfigs));
  };

  const resetDefaults = () => {
    setConfig(DEFAULT_CONFIG);
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-red-500">🧪 Visualizer Lab v2</h1>
          <p className="text-neutral-400">
            Tundra Test — Enhanced wheel/tire rendering with lift simulation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preview Area */}
          <div className="lg:col-span-2">
            <div className="bg-neutral-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold">Preview</h2>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.showDebugOutlines}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showDebugOutlines: e.target.checked }))
                    }
                    className="accent-red-500"
                  />
                  Debug Outlines
                </label>
              </div>
              
              {/* Vehicle + Wheels Container */}
              <div
                className="relative bg-gradient-to-b from-neutral-600 to-neutral-800 rounded-lg overflow-hidden"
                style={{ minHeight: 400 }}
              >
                {/* Vehicle Image */}
                <img
                  ref={imageRef}
                  src={config.vehicleImage}
                  alt="2010 Toyota Tundra SR5"
                  className="w-full h-auto relative"
                  style={{
                    transform: `translateY(${config.bodyLift}px)`,
                    zIndex: 10,
                  }}
                  onLoad={handleImageLoad}
                  onError={() => setImageLoaded(false)}
                />

                {/* Wheel/Tire Overlays */}
                {imageLoaded && (
                  <>
                    <WheelTireRenderer
                      position={config.frontWheel}
                      config={config}
                      scaleX={scaleX}
                      scaleY={scaleY}
                      label="Front"
                      color="#22c55e"
                    />
                    <WheelTireRenderer
                      position={config.rearWheel}
                      config={config}
                      scaleX={scaleX}
                      scaleY={scaleY}
                      label="Rear"
                      color="#3b82f6"
                    />
                  </>
                )}

                {/* Image not loaded state */}
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                    <div className="text-center">
                      <p className="text-lg">⚠️ Vehicle image not found</p>
                      <p className="text-sm mt-2">{config.vehicleImage}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Image Info */}
              <div className="mt-3 text-xs text-neutral-500 flex gap-4 flex-wrap">
                <span>Natural: {naturalSize.width}×{naturalSize.height}</span>
                <span>Rendered: {renderedSize.width.toFixed(0)}×{renderedSize.height.toFixed(0)}</span>
                <span>Scale: {scaleX.toFixed(3)}</span>
              </div>
            </div>

            {/* Lift Presets - Quick Access */}
            <div className="bg-neutral-800 rounded-lg p-4 mt-4">
              <h3 className="font-semibold text-neutral-300 mb-3">⚡ Quick Lift Presets</h3>
              <div className="flex gap-2 flex-wrap">
                {LIFT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyLiftPreset(preset)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      config.bodyLift === preset.bodyOffset
                        ? "bg-red-600 text-white"
                        : "bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="flex gap-1 bg-neutral-800 rounded-lg p-1">
              {(["wheels", "tires", "lift", "effects", "save"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-red-600 text-white"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Wheels Tab */}
            {activeTab === "wheels" && (
              <>
                {/* Wheel Asset Selector */}
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-300 mb-3">🎡 Wheel Asset</h3>
                  <select
                    value={config.wheelImage}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, wheelImage: e.target.value }))
                    }
                    className="w-full bg-neutral-700 text-white rounded px-3 py-2"
                  >
                    {WHEEL_ASSETS.map((asset) => (
                      <option key={asset.path} value={asset.path}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                  
                  <div className="mt-3">
                    <label className="text-sm text-neutral-400">
                      Wheel Scale: {config.wheelScale.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min={0.7}
                      max={1.5}
                      step={0.01}
                      value={config.wheelScale}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, wheelScale: Number(e.target.value) }))
                      }
                      className="w-full accent-red-500"
                    />
                  </div>
                </div>

                {/* Front Wheel Position */}
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-green-400 mb-3">🟢 Front Wheel</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-neutral-400">X: {config.frontWheel.x}</label>
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
                      <label className="text-xs text-neutral-400">Y: {config.frontWheel.y}</label>
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
                      <label className="text-xs text-neutral-400">Radius: {config.frontWheel.radius}</label>
                      <input
                        type="range"
                        min={30}
                        max={200}
                        value={config.frontWheel.radius}
                        onChange={(e) => updateFrontWheel("radius", Number(e.target.value))}
                        className="w-full accent-green-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Rear Wheel Position */}
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-400 mb-3">🔵 Rear Wheel</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-neutral-400">X: {config.rearWheel.x}</label>
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
                      <label className="text-xs text-neutral-400">Y: {config.rearWheel.y}</label>
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
                      <label className="text-xs text-neutral-400">Radius: {config.rearWheel.radius}</label>
                      <input
                        type="range"
                        min={30}
                        max={200}
                        value={config.rearWheel.radius}
                        onChange={(e) => updateRearWheel("radius", Number(e.target.value))}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Tires Tab */}
            {activeTab === "tires" && (
              <div className="bg-neutral-800 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-300 mb-3">🛞 Tire Settings</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-neutral-400">
                      Outer Diameter Scale: {config.tire.outerDiameterScale.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min={1.0}
                      max={2.0}
                      step={0.01}
                      value={config.tire.outerDiameterScale}
                      onChange={(e) => updateTire("outerDiameterScale", Number(e.target.value))}
                      className="w-full accent-red-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      1.0 = same as wheel, 1.5 = 50% larger tire
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm text-neutral-400">
                      Sidewall Thickness: {config.tire.sidewallThickness}px
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={80}
                      value={config.tire.sidewallThickness}
                      onChange={(e) => updateTire("sidewallThickness", Number(e.target.value))}
                      className="w-full accent-red-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Low = low-profile, High = meaty truck tire
                    </p>
                  </div>

                  <div className="pt-3 border-t border-neutral-700">
                    <p className="text-sm text-neutral-300 mb-2">Quick Tire Sizes:</p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          updateTire("outerDiameterScale", 1.2);
                          updateTire("sidewallThickness", 20);
                        }}
                        className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-sm"
                      >
                        20" + Low Profile
                      </button>
                      <button
                        onClick={() => {
                          updateTire("outerDiameterScale", 1.35);
                          updateTire("sidewallThickness", 35);
                        }}
                        className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-sm"
                      >
                        20" + 33" Tire
                      </button>
                      <button
                        onClick={() => {
                          updateTire("outerDiameterScale", 1.5);
                          updateTire("sidewallThickness", 50);
                        }}
                        className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-sm"
                      >
                        17" + 35" Tire
                      </button>
                      <button
                        onClick={() => {
                          updateTire("outerDiameterScale", 1.6);
                          updateTire("sidewallThickness", 60);
                        }}
                        className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-sm"
                      >
                        17" + 37" Tire
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lift Tab */}
            {activeTab === "lift" && (
              <div className="bg-neutral-800 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-300 mb-3">📐 Ride Height / Lift</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-neutral-400">
                      Body Lift: {config.bodyLift}px
                    </label>
                    <input
                      type="range"
                      min={-80}
                      max={20}
                      value={config.bodyLift}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, bodyLift: Number(e.target.value) }))
                      }
                      className="w-full accent-red-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Negative = body lifted (wheels stay, body goes up)
                    </p>
                  </div>

                  <div className="pt-3 border-t border-neutral-700">
                    <p className="text-sm text-neutral-300 mb-2">Presets:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {LIFT_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => applyLiftPreset(preset)}
                          className={`px-3 py-2 rounded font-medium transition-colors ${
                            config.bodyLift === preset.bodyOffset
                              ? "bg-red-600 text-white"
                              : "bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Effects Tab */}
            {activeTab === "effects" && (
              <div className="bg-neutral-800 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-300 mb-3">✨ Visual Effects</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.showTireShadow}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, showTireShadow: e.target.checked }))
                      }
                      className="accent-red-500"
                    />
                    <span className="text-sm">Tire Shadow</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.showWheelShadow}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, showWheelShadow: e.target.checked }))
                      }
                      className="accent-red-500"
                    />
                    <span className="text-sm">Wheel Shadow</span>
                  </label>

                  <div>
                    <label className="text-sm text-neutral-400">
                      Shadow Opacity: {config.shadowOpacity.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={config.shadowOpacity}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, shadowOpacity: Number(e.target.value) }))
                      }
                      className="w-full accent-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400">
                      Shadow Blur: {config.shadowBlur}px
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      value={config.shadowBlur}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, shadowBlur: Number(e.target.value) }))
                      }
                      className="w-full accent-red-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Save Tab */}
            {activeTab === "save" && (
              <div className="space-y-4">
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-300 mb-3">💾 Save Configuration</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Config name..."
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      className="flex-1 bg-neutral-700 text-white rounded px-3 py-2 text-sm"
                    />
                    <button
                      onClick={saveConfig}
                      disabled={!saveName.trim()}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-neutral-600 rounded font-medium text-sm"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-300 mb-3">📂 Saved Configs</h3>
                  {savedConfigs.length === 0 ? (
                    <p className="text-sm text-neutral-500">No saved configurations</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {savedConfigs.map((saved, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <button
                            onClick={() => loadConfig(saved)}
                            className="flex-1 text-left px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-sm truncate"
                          >
                            {saved.name}
                          </button>
                          <button
                            onClick={() => deleteConfig(i)}
                            className="px-2 py-2 bg-neutral-700 hover:bg-red-600 rounded text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-300 mb-3">📤 Import/Export</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={exportConfig}
                      className="flex-1 px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-sm"
                    >
                      Export JSON
                    </button>
                    <label className="flex-1 px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-sm text-center cursor-pointer">
                      Import JSON
                      <input
                        type="file"
                        accept=".json"
                        onChange={importConfig}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Actions - Always Visible */}
            <div className="flex gap-2">
              <button
                onClick={copyConfig}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors text-sm"
              >
                {copied ? "✓ Copied!" : "📋 Copy"}
              </button>
              <button
                onClick={resetDefaults}
                className="bg-neutral-700 hover:bg-neutral-600 text-white py-2 px-4 rounded-lg font-medium transition-colors text-sm"
              >
                ↺ Reset
              </button>
            </div>

            {/* Live JSON (collapsed) */}
            <details className="bg-neutral-800 rounded-lg">
              <summary className="p-4 cursor-pointer font-semibold text-neutral-300">
                📄 Config JSON
              </summary>
              <pre className="text-xs text-neutral-300 bg-neutral-900 p-3 mx-4 mb-4 rounded overflow-auto max-h-48">
                {JSON.stringify(config, null, 2)}
              </pre>
            </details>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-neutral-500">
          <p>
            Visualizer Lab v2 — Isolated test page. Does not affect production flows.
          </p>
        </div>
      </div>
    </div>
  );
}
