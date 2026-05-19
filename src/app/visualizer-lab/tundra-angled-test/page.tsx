"use client";

/**
 * Visualizer Lab - Tundra 3/4 Angle Test
 * 
 * HYPOTHESIS: A 3/4 front-angle truck template may allow WheelPros angled 
 * wheel images (A1/A2) to work naturally with far less cleanup.
 * 
 * This experiment tests whether angled supplier wheel assets can work directly
 * with masking, tire overlays, and shadow tricks.
 * 
 * NO REGRESSION: Isolated to visualizer lab only. Does not affect production.
 */

import { useState, useRef, useEffect } from "react";

// ============================================================================
// TYPES
// ============================================================================

type WheelRenderMode = "front_face" | "angled_native" | "angled_masked";

interface WheelPosition {
  x: number;
  y: number;
  radius: number;
  // Per-wheel adjustments for 3/4 view
  scale: number;
  opacity: number;
  rotation: number;
  skewX: number;
  skewY: number;
}

interface WheelClip {
  top: number;
  left: number;
  right: number;
  bottom: number;
  feather: number;
}

interface TireSettings {
  ringThickness: number;      // 0-50, % of wheel radius
  overlayOpacity: number;     // 0-1
  darkness: number;           // 0-1
  textureStrength: number;    // 0-1
  barrelHideAmount: number;   // 0-100, how much outer edge to hide
  tireOnTop: boolean;
}

interface ShadowSettings {
  wheelInset: number;         // 0-1
  wheelDrop: number;          // 0-1
  innerShadow: number;        // 0-1
  groundOpacity: number;      // 0-1
  groundBlur: number;         // 0-50 px
  groundScale: number;        // 0.5-2
  groundYOffset: number;      // 0-50 px
}

interface LiftSettings {
  bodyOffset: number;         // px, negative = lifted
  wheelWellClearance: number; // multiplier
  suspensionShadow: number;   // 0-1
}

interface VisualizerConfig {
  vehicleImage: string;
  wheelImage: string;
  renderMode: WheelRenderMode;
  
  frontWheel: WheelPosition;
  rearWheel: WheelPosition;
  
  frontClip: WheelClip;
  rearClip: WheelClip;
  
  tire: TireSettings;
  shadows: ShadowSettings;
  lift: LiftSettings;
  
  wheelFaceScale: number;
  showMaskDebug: boolean;
  showComparison: boolean;
}

interface LiftPreset {
  name: string;
  bodyOffset: number;
  wheelWellClearance: number;
  suspensionShadow: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LIFT_PRESETS: LiftPreset[] = [
  { name: "Stock", bodyOffset: 0, wheelWellClearance: 1.0, suspensionShadow: 0.3 },
  { name: "Leveling Kit", bodyOffset: -12, wheelWellClearance: 1.1, suspensionShadow: 0.35 },
  { name: "4\" Lift", bodyOffset: -30, wheelWellClearance: 1.25, suspensionShadow: 0.4 },
  { name: "6\" Lift", bodyOffset: -45, wheelWellClearance: 1.4, suspensionShadow: 0.5 },
];

// Default config optimized for 3/4 angle view
const DEFAULT_CONFIG: VisualizerConfig = {
  vehicleImage: "/visualizer/vehicles/visualizer-tundra-2010-sr5-white-3q-front-v1.png",
  wheelImage: "",
  renderMode: "angled_masked",
  
  // Front wheel - larger and more prominent in 3/4 view
  frontWheel: {
    x: 320,
    y: 520,
    radius: 110,
    scale: 1.0,
    opacity: 1.0,
    rotation: -5,    // Slight rotation to match 3/4 angle
    skewX: 0,
    skewY: 0,
  },
  
  // Rear wheel - smaller, partially obscured in 3/4 view
  rearWheel: {
    x: 980,
    y: 530,
    radius: 85,
    scale: 0.85,
    opacity: 0.9,
    rotation: -8,
    skewX: 0,
    skewY: 0,
  },
  
  // Wheel well clipping
  frontClip: { top: 18, left: 5, right: 0, bottom: 0, feather: 8 },
  rearClip: { top: 20, left: 0, right: 5, bottom: 0, feather: 8 },
  
  // Tire overlay
  tire: {
    ringThickness: 18,
    overlayOpacity: 1.0,
    darkness: 0.85,
    textureStrength: 0.4,
    barrelHideAmount: 25,
    tireOnTop: true,
  },
  
  // Shadows
  shadows: {
    wheelInset: 0.4,
    wheelDrop: 0.3,
    innerShadow: 0.5,
    groundOpacity: 0.4,
    groundBlur: 12,
    groundScale: 1.2,
    groundYOffset: 8,
  },
  
  // Lift
  lift: {
    bodyOffset: 0,
    wheelWellClearance: 1.0,
    suspensionShadow: 0.3,
  },
  
  wheelFaceScale: 1.0,
  showMaskDebug: false,
  showComparison: false,
};

// Sample angled wheels from WheelPros
const SAMPLE_WHEELS = [
  {
    name: "KMC TORX",
    url: "https://assets.wheelpros.com/transform/bd9a2463-a0de-4e9e-88e2-c52e181bc5af/KMC-KM553-TORX-17X9-6-ET-12-MATTE-BLACK-W-GLOSS-BLACK-LIP-A1-png?size=500"
  },
  {
    name: "KMC KM702",
    url: "https://assets.wheelpros.com/transform/0e96f9a7-fb75-4a0e-ae84-094a35ccfbd6/KMC-KM7024-SATIN-GRAY-MILLED-png?size=500"
  },
  {
    name: "KMC KM548",
    url: "https://assets.wheelpros.com/transform/21fc78f7-2663-4e99-b539-71cc504a8bbc/KMC-KM548-6LUG-17x9-ET-12-MATTE-BRONZE-W_-BLK-LIP-A1-png?size=500"
  },
  {
    name: "Fuel Reaction",
    url: "https://assets.wheelpros.com/transform/d7c07a32-bb44-4b96-b4f5-3bc8f2c3b4e1/FUEL-D75320908250-REACTION-A1-png?size=500"
  },
  {
    name: "Method Race 305",
    url: "https://assets.wheelpros.com/transform/3c1a5a5f-8d64-4d29-a8f5-2b8fc9f1e5b3/METHOD-MR30578560500-305-NV-A1-png?size=500"
  },
];

// ============================================================================
// WHEEL RENDERER COMPONENT (3/4 ANGLE OPTIMIZED)
// ============================================================================

interface WheelRendererProps {
  position: WheelPosition;
  clip: WheelClip;
  config: VisualizerConfig;
  scaleX: number;
  scaleY: number;
  label: "front" | "rear";
}

function WheelRenderer({
  position,
  clip,
  config,
  scaleX,
  scaleY,
  label,
}: WheelRendererProps) {
  const scale = Math.min(scaleX, scaleY);
  
  // Position calculations
  const centerX = position.x * scaleX;
  const centerY = position.y * scaleY;
  const baseRadius = position.radius * scale * position.scale;
  const wheelRadius = baseRadius * config.wheelFaceScale;
  
  // Tire dimensions
  const tireThickness = (config.tire.ringThickness / 100) * baseRadius;
  const tireRadius = wheelRadius + tireThickness;
  const barrelHide = (config.tire.barrelHideAmount / 100) * baseRadius;
  
  // Clipping calculations
  const clipTop = (clip.top / 100) * tireRadius;
  const clipLeft = (clip.left / 100) * tireRadius;
  const clipRight = (clip.right / 100) * tireRadius;
  const clipBottom = (clip.bottom / 100) * tireRadius;
  const clipPath = `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px round ${clip.feather}px)`;
  
  // Transforms for 3/4 angle matching
  const wheelTransform = [
    `rotate(${position.rotation}deg)`,
    `skewX(${position.skewX}deg)`,
    `skewY(${position.skewY}deg)`,
  ].join(" ");
  
  // Shadow settings
  const { wheelInset, wheelDrop, innerShadow, groundOpacity, groundBlur, groundScale, groundYOffset } = config.shadows;
  
  // Tire settings
  const { darkness, textureStrength, overlayOpacity, tireOnTop } = config.tire;
  
  // Ground shadow dimensions
  const groundShadowWidth = tireRadius * 2 * groundScale;
  const groundShadowHeight = tireRadius * 0.35 * groundScale;
  
  // Debug color
  const debugColor = label === "front" ? "#22c55e" : "#3b82f6";
  
  return (
    <>
      {/* GROUND SHADOW */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: centerX - groundShadowWidth / 2,
          top: centerY + tireRadius + groundYOffset * scale,
          width: groundShadowWidth,
          height: groundShadowHeight,
          background: `radial-gradient(ellipse, rgba(0,0,0,${groundOpacity}) 0%, transparent 70%)`,
          filter: `blur(${groundBlur}px)`,
          zIndex: 5,
          opacity: position.opacity,
        }}
      />
      
      {/* OEM WHEEL MASK - covers original wheel as body lifts */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          left: centerX - baseRadius * 1.1,
          top: centerY - baseRadius * 1.1 + config.lift.bodyOffset * scaleY,
          width: baseRadius * 2.2,
          height: baseRadius * 2.2,
          background: "radial-gradient(circle, #1a1a1a 0%, #0a0a0a 60%, #000 100%)",
          zIndex: 15,
        }}
      />
      
      {/* DEBUG MASK OUTLINE */}
      {config.showMaskDebug && (
        <div
          className="absolute pointer-events-none border-2 border-dashed"
          style={{
            left: centerX - tireRadius + clipLeft,
            top: centerY - tireRadius + clipTop,
            width: tireRadius * 2 - clipLeft - clipRight,
            height: tireRadius * 2 - clipTop - clipBottom,
            borderColor: debugColor,
            borderRadius: `${clip.feather}px`,
            zIndex: 100,
            background: 'rgba(255, 255, 0, 0.1)',
          }}
        />
      )}
      
      {/* MAIN WHEEL/TIRE ASSEMBLY - CLIPPED */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: centerX - tireRadius,
          top: centerY - tireRadius,
          width: tireRadius * 2,
          height: tireRadius * 2,
          clipPath: clipPath,
          zIndex: 20,
          opacity: position.opacity,
        }}
      >
        {/* TIRE LAYER - Behind wheel if tireOnTop is false */}
        {!tireOnTop && (
          <TireOverlay
            tireRadius={tireRadius}
            wheelRadius={wheelRadius}
            darkness={darkness}
            textureStrength={textureStrength}
            opacity={overlayOpacity}
            innerShadow={innerShadow}
          />
        )}
        
        {/* BARREL HIDE LAYER */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at center,
              transparent 0%,
              transparent ${wheelRadius - 5}px,
              rgba(0,0,0,0.7) ${wheelRadius}px,
              rgba(0,0,0,0.85) ${wheelRadius + barrelHide}px,
              rgba(0,0,0,0.9) ${tireRadius}px
            )`,
            zIndex: 2,
          }}
        />
        
        {/* WHEEL INSET SHADOW */}
        {wheelInset > 0 && (
          <div
            className="absolute rounded-full"
            style={{
              left: tireRadius - wheelRadius - 3,
              top: tireRadius - wheelRadius - 3,
              width: wheelRadius * 2 + 6,
              height: wheelRadius * 2 + 6,
              background: `radial-gradient(circle, 
                rgba(0,0,0,${0.5 * wheelInset}) 60%,
                rgba(0,0,0,${0.2 * wheelInset}) 85%,
                transparent 100%)`,
              filter: `blur(4px)`,
              zIndex: 3,
            }}
          />
        )}
        
        {/* WHEEL DROP SHADOW */}
        {wheelDrop > 0 && (
          <div
            className="absolute rounded-full"
            style={{
              left: tireRadius - wheelRadius + 4,
              top: tireRadius - wheelRadius + 6,
              width: wheelRadius * 2,
              height: wheelRadius * 2,
              background: `rgba(0,0,0,${0.35 * wheelDrop})`,
              filter: `blur(6px)`,
              zIndex: 3,
            }}
          />
        )}
        
        {/* WHEEL IMAGE */}
        {config.wheelImage && (
          <div
            className="absolute rounded-full overflow-hidden"
            style={{
              left: tireRadius - wheelRadius,
              top: tireRadius - wheelRadius,
              width: wheelRadius * 2,
              height: wheelRadius * 2,
              zIndex: 4,
            }}
          >
            <img
              src={config.wheelImage}
              alt={`${label} wheel`}
              className="w-full h-full object-contain"
              style={{
                transform: wheelTransform,
                transformOrigin: "center center",
                filter: label === "rear" ? "brightness(0.9)" : "none",
              }}
            />
          </div>
        )}
        
        {/* TIRE LAYER - On top of wheel if tireOnTop is true */}
        {tireOnTop && (
          <TireOverlay
            tireRadius={tireRadius}
            wheelRadius={wheelRadius}
            darkness={darkness}
            textureStrength={textureStrength}
            opacity={overlayOpacity}
            innerShadow={innerShadow}
          />
        )}
      </div>
    </>
  );
}

// ============================================================================
// TIRE OVERLAY COMPONENT
// ============================================================================

interface TireOverlayProps {
  tireRadius: number;
  wheelRadius: number;
  darkness: number;
  textureStrength: number;
  opacity: number;
  innerShadow: number;
}

function TireOverlay({
  tireRadius,
  wheelRadius,
  darkness,
  textureStrength,
  opacity,
  innerShadow,
}: TireOverlayProps) {
  const tireWidth = tireRadius - wheelRadius;
  
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity, zIndex: 10 }}>
      {/* Tire base ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at center,
            transparent 0%,
            transparent ${wheelRadius - 2}px,
            rgb(${Math.floor(25 * darkness)}, ${Math.floor(25 * darkness)}, ${Math.floor(27 * darkness)}) ${wheelRadius}px,
            rgb(${Math.floor(15 * darkness)}, ${Math.floor(15 * darkness)}, ${Math.floor(17 * darkness)}) ${wheelRadius + tireWidth * 0.5}px,
            rgb(${Math.floor(10 * darkness)}, ${Math.floor(10 * darkness)}, ${Math.floor(12 * darkness)}) ${tireRadius}px
          )`,
        }}
      />
      
      {/* Sidewall texture rings */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `repeating-radial-gradient(
            circle at center,
            transparent 0px,
            transparent ${wheelRadius + 2}px,
            rgba(50,50,52,${0.15 * textureStrength}) ${wheelRadius + 4}px,
            transparent ${wheelRadius + 6}px
          )`,
        }}
      />
      
      {/* Sidewall highlight */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 35%,
            transparent 0%,
            transparent ${wheelRadius}px,
            rgba(255,255,255,0.04) ${wheelRadius + tireWidth * 0.3}px,
            transparent ${wheelRadius + tireWidth * 0.6}px
          )`,
        }}
      />
      
      {/* Inner shadow where tire meets wheel */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: `inset 0 0 ${15 * innerShadow}px rgba(0,0,0,0.5)`,
        }}
      />
    </div>
  );
}

// ============================================================================
// SLIDER CONTROL COMPONENT
// ============================================================================

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  color?: string;
}

function Slider({ label, value, min, max, step = 1, onChange, color = "red" }: SliderProps) {
  return (
    <div>
      <div className="flex justify-between text-xs text-neutral-400 mb-1">
        <span>{label}</span>
        <span>{step < 1 ? value.toFixed(2) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-1 accent-${color}-500`}
      />
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function TundraAngledTestPage() {
  const [config, setConfig] = useState<VisualizerConfig>(DEFAULT_CONFIG);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 1600, height: 900 });
  const [renderedSize, setRenderedSize] = useState({ width: 1600, height: 900 });
  const [activeTab, setActiveTab] = useState<"wheels" | "tire" | "mask" | "shadows" | "lift" | "export">("wheels");
  const [customUrl, setCustomUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Scale factors
  const scaleX = renderedSize.width / naturalSize.width;
  const scaleY = renderedSize.height / naturalSize.height;

  // Handle image load
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setRenderedSize({ width: img.clientWidth, height: img.clientHeight });
    setImageLoaded(true);
  };

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

  // Config update helpers
  const updateConfig = <K extends keyof VisualizerConfig>(key: K, value: VisualizerConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateFrontWheel = <K extends keyof WheelPosition>(key: K, value: WheelPosition[K]) => {
    setConfig(prev => ({ ...prev, frontWheel: { ...prev.frontWheel, [key]: value } }));
  };

  const updateRearWheel = <K extends keyof WheelPosition>(key: K, value: WheelPosition[K]) => {
    setConfig(prev => ({ ...prev, rearWheel: { ...prev.rearWheel, [key]: value } }));
  };

  const updateFrontClip = <K extends keyof WheelClip>(key: K, value: WheelClip[K]) => {
    setConfig(prev => ({ ...prev, frontClip: { ...prev.frontClip, [key]: value } }));
  };

  const updateRearClip = <K extends keyof WheelClip>(key: K, value: WheelClip[K]) => {
    setConfig(prev => ({ ...prev, rearClip: { ...prev.rearClip, [key]: value } }));
  };

  const updateTire = <K extends keyof TireSettings>(key: K, value: TireSettings[K]) => {
    setConfig(prev => ({ ...prev, tire: { ...prev.tire, [key]: value } }));
  };

  const updateShadows = <K extends keyof ShadowSettings>(key: K, value: ShadowSettings[K]) => {
    setConfig(prev => ({ ...prev, shadows: { ...prev.shadows, [key]: value } }));
  };

  const updateLift = <K extends keyof LiftSettings>(key: K, value: LiftSettings[K]) => {
    setConfig(prev => ({ ...prev, lift: { ...prev.lift, [key]: value } }));
  };

  const applyLiftPreset = (preset: LiftPreset) => {
    setConfig(prev => ({
      ...prev,
      lift: {
        bodyOffset: preset.bodyOffset,
        wheelWellClearance: preset.wheelWellClearance,
        suspensionShadow: preset.suspensionShadow,
      },
    }));
  };

  const loadWheel = (url: string) => {
    updateConfig("wheelImage", url);
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
    a.download = `tundra-34-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetDefaults = () => {
    setConfig(DEFAULT_CONFIG);
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-orange-500">🧪 3/4 Angle Visualizer Test</h1>
          <p className="text-neutral-400">
            Testing whether 3/4 angle truck + angled wheel images work together naturally
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Hypothesis: Angled WheelPros images may look better on angled truck template
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preview Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Main Preview */}
            <div className="bg-neutral-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold">3/4 Angle Preview</h2>
                <div className="flex items-center gap-4">
                  {/* Render Mode */}
                  <select
                    value={config.renderMode}
                    onChange={(e) => updateConfig("renderMode", e.target.value as WheelRenderMode)}
                    className="bg-neutral-700 text-white rounded px-2 py-1 text-sm"
                  >
                    <option value="front_face">Front Face</option>
                    <option value="angled_native">Angled Native</option>
                    <option value="angled_masked">Angled + Masked</option>
                  </select>
                  
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.showMaskDebug}
                      onChange={(e) => updateConfig("showMaskDebug", e.target.checked)}
                      className="accent-orange-500"
                    />
                    Debug Masks
                  </label>
                </div>
              </div>
              
              {/* Vehicle Container */}
              <div
                className="relative bg-gradient-to-br from-neutral-500 via-neutral-600 to-neutral-700 rounded-lg overflow-hidden"
                style={{ minHeight: 450 }}
              >
                {/* Placeholder gradient if no image */}
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                    <div className="text-center">
                      <p className="text-4xl mb-2">🚗</p>
                      <p className="text-lg">3/4 Angle Truck Template</p>
                      <p className="text-sm mt-2 text-neutral-500">
                        Place image at: /public/visualizer/vehicles/tundra-34-angle-white.png
                      </p>
                      <p className="text-xs mt-4 text-orange-400">
                        Using placeholder layout for testing
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Vehicle Image */}
                <img
                  ref={imageRef}
                  src={config.vehicleImage}
                  alt="3/4 Angle Truck"
                  className="w-full h-auto relative"
                  style={{
                    transform: `translateY(${config.lift.bodyOffset}px)`,
                    zIndex: 10,
                    opacity: imageLoaded ? 1 : 0,
                  }}
                  onLoad={handleImageLoad}
                  onError={() => setImageLoaded(false)}
                />
                
                {/* Wheel Overlays - Always render for testing */}
                <WheelRenderer
                  position={config.frontWheel}
                  clip={config.frontClip}
                  config={config}
                  scaleX={imageLoaded ? scaleX : 1}
                  scaleY={imageLoaded ? scaleY : 1}
                  label="front"
                />
                <WheelRenderer
                  position={config.rearWheel}
                  clip={config.rearClip}
                  config={config}
                  scaleX={imageLoaded ? scaleX : 1}
                  scaleY={imageLoaded ? scaleY : 1}
                  label="rear"
                />
              </div>
              
              {/* Info Bar */}
              <div className="mt-3 text-xs text-neutral-500 flex gap-4 flex-wrap">
                <span>Mode: {config.renderMode}</span>
                <span>Front: ({config.frontWheel.x}, {config.frontWheel.y})</span>
                <span>Rear: ({config.rearWheel.x}, {config.rearWheel.y})</span>
                {config.wheelImage && <span className="text-green-400">✓ Wheel loaded</span>}
              </div>
            </div>

            {/* Lift Presets */}
            <div className="bg-neutral-800 rounded-lg p-4">
              <h3 className="font-semibold text-neutral-300 mb-3">⚡ Lift Presets</h3>
              <div className="flex gap-2 flex-wrap">
                {LIFT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyLiftPreset(preset)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      config.lift.bodyOffset === preset.bodyOffset
                        ? "bg-orange-600 text-white"
                        : "bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Comparison View */}
            {config.showComparison && (
              <div className="bg-neutral-800 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-300 mb-3">📊 Side-by-Side Comparison</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="bg-neutral-700 rounded-lg p-2 aspect-video flex items-center justify-center">
                      <span className="text-neutral-400">Side-facing (existing)</span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">Original side view</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-neutral-700 rounded-lg p-2 aspect-video flex items-center justify-center">
                      <span className="text-neutral-400">3/4 Angle (new)</span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">3/4 angle view</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-1 bg-neutral-800 rounded-lg p-1">
              {(["wheels", "tire", "mask", "shadows", "lift", "export"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-orange-600 text-white"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* WHEELS TAB */}
            {activeTab === "wheels" && (
              <div className="space-y-4">
                {/* Sample Wheels */}
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-300 mb-3">🎡 Sample Angled Wheels</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {SAMPLE_WHEELS.map((wheel) => (
                      <button
                        key={wheel.name}
                        onClick={() => loadWheel(wheel.url)}
                        className={`p-1 rounded border-2 transition-all hover:border-orange-500 ${
                          config.wheelImage === wheel.url
                            ? "border-orange-500 bg-orange-500/20"
                            : "border-transparent bg-neutral-700/50"
                        }`}
                        title={wheel.name}
                      >
                        <img
                          src={wheel.url}
                          alt={wheel.name}
                          className="w-full aspect-square object-contain"
                        />
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Custom URL */}
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-300 mb-3">🔗 Custom Wheel URL</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 bg-neutral-700 text-white rounded px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => loadWheel(customUrl)}
                      disabled={!customUrl}
                      className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-600 rounded font-medium text-sm"
                    >
                      Load
                    </button>
                  </div>
                </div>

                {/* Front Wheel Position */}
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-green-400 mb-3">🟢 Front Wheel</h3>
                  <div className="space-y-2">
                    <Slider label="X" value={config.frontWheel.x} min={0} max={800} onChange={(v) => updateFrontWheel("x", v)} />
                    <Slider label="Y" value={config.frontWheel.y} min={0} max={700} onChange={(v) => updateFrontWheel("y", v)} />
                    <Slider label="Radius" value={config.frontWheel.radius} min={50} max={200} onChange={(v) => updateFrontWheel("radius", v)} />
                    <Slider label="Scale" value={config.frontWheel.scale} min={0.5} max={1.5} step={0.05} onChange={(v) => updateFrontWheel("scale", v)} />
                    <Slider label="Rotation" value={config.frontWheel.rotation} min={-30} max={30} onChange={(v) => updateFrontWheel("rotation", v)} />
                    <Slider label="Skew X" value={config.frontWheel.skewX} min={-20} max={20} onChange={(v) => updateFrontWheel("skewX", v)} />
                    <Slider label="Skew Y" value={config.frontWheel.skewY} min={-20} max={20} onChange={(v) => updateFrontWheel("skewY", v)} />
                  </div>
                </div>

                {/* Rear Wheel Position */}
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-400 mb-3">🔵 Rear Wheel</h3>
                  <div className="space-y-2">
                    <Slider label="X" value={config.rearWheel.x} min={400} max={1200} onChange={(v) => updateRearWheel("x", v)} />
                    <Slider label="Y" value={config.rearWheel.y} min={0} max={700} onChange={(v) => updateRearWheel("y", v)} />
                    <Slider label="Radius" value={config.rearWheel.radius} min={30} max={150} onChange={(v) => updateRearWheel("radius", v)} />
                    <Slider label="Scale" value={config.rearWheel.scale} min={0.5} max={1.5} step={0.05} onChange={(v) => updateRearWheel("scale", v)} />
                    <Slider label="Opacity" value={config.rearWheel.opacity} min={0.5} max={1} step={0.05} onChange={(v) => updateRearWheel("opacity", v)} />
                    <Slider label="Rotation" value={config.rearWheel.rotation} min={-30} max={30} onChange={(v) => updateRearWheel("rotation", v)} />
                  </div>
                </div>
              </div>
            )}

            {/* TIRE TAB */}
            {activeTab === "tire" && (
              <div className="bg-neutral-800 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-300 mb-3">🛞 Tire Overlay</h3>
                <div className="space-y-2">
                  <Slider label="Ring Thickness" value={config.tire.ringThickness} min={0} max={50} onChange={(v) => updateTire("ringThickness", v)} />
                  <Slider label="Overlay Opacity" value={config.tire.overlayOpacity} min={0} max={1} step={0.05} onChange={(v) => updateTire("overlayOpacity", v)} />
                  <Slider label="Darkness" value={config.tire.darkness} min={0.5} max={1} step={0.05} onChange={(v) => updateTire("darkness", v)} />
                  <Slider label="Texture" value={config.tire.textureStrength} min={0} max={1} step={0.05} onChange={(v) => updateTire("textureStrength", v)} />
                  <Slider label="Barrel Hide" value={config.tire.barrelHideAmount} min={0} max={100} onChange={(v) => updateTire("barrelHideAmount", v)} />
                  
                  <label className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-700">
                    <input
                      type="checkbox"
                      checked={config.tire.tireOnTop}
                      onChange={(e) => updateTire("tireOnTop", e.target.checked)}
                      className="accent-orange-500"
                    />
                    <span className="text-neutral-300 text-sm">Tire renders on top of wheel</span>
                  </label>
                </div>
              </div>
            )}

            {/* MASK TAB */}
            {activeTab === "mask" && (
              <div className="space-y-4">
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-green-400 mb-3">🟢 Front Wheel Clip</h3>
                  <div className="space-y-2">
                    <Slider label="Top" value={config.frontClip.top} min={0} max={40} onChange={(v) => updateFrontClip("top", v)} />
                    <Slider label="Left" value={config.frontClip.left} min={0} max={40} onChange={(v) => updateFrontClip("left", v)} />
                    <Slider label="Right" value={config.frontClip.right} min={0} max={40} onChange={(v) => updateFrontClip("right", v)} />
                    <Slider label="Bottom" value={config.frontClip.bottom} min={0} max={40} onChange={(v) => updateFrontClip("bottom", v)} />
                    <Slider label="Feather" value={config.frontClip.feather} min={0} max={30} onChange={(v) => updateFrontClip("feather", v)} />
                  </div>
                </div>
                
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-400 mb-3">🔵 Rear Wheel Clip</h3>
                  <div className="space-y-2">
                    <Slider label="Top" value={config.rearClip.top} min={0} max={40} onChange={(v) => updateRearClip("top", v)} />
                    <Slider label="Left" value={config.rearClip.left} min={0} max={40} onChange={(v) => updateRearClip("left", v)} />
                    <Slider label="Right" value={config.rearClip.right} min={0} max={40} onChange={(v) => updateRearClip("right", v)} />
                    <Slider label="Bottom" value={config.rearClip.bottom} min={0} max={40} onChange={(v) => updateRearClip("bottom", v)} />
                    <Slider label="Feather" value={config.rearClip.feather} min={0} max={30} onChange={(v) => updateRearClip("feather", v)} />
                  </div>
                </div>
              </div>
            )}

            {/* SHADOWS TAB */}
            {activeTab === "shadows" && (
              <div className="space-y-4">
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-300 mb-3">🎨 Wheel Shadows</h3>
                  <div className="space-y-2">
                    <Slider label="Inset Shadow" value={config.shadows.wheelInset} min={0} max={1} step={0.05} onChange={(v) => updateShadows("wheelInset", v)} />
                    <Slider label="Drop Shadow" value={config.shadows.wheelDrop} min={0} max={1} step={0.05} onChange={(v) => updateShadows("wheelDrop", v)} />
                    <Slider label="Inner Shadow" value={config.shadows.innerShadow} min={0} max={1} step={0.05} onChange={(v) => updateShadows("innerShadow", v)} />
                    <Slider label="Face Scale" value={config.wheelFaceScale} min={0.8} max={1.2} step={0.02} onChange={(v) => updateConfig("wheelFaceScale", v)} />
                  </div>
                </div>
                
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-300 mb-3">🌍 Ground Shadows</h3>
                  <div className="space-y-2">
                    <Slider label="Opacity" value={config.shadows.groundOpacity} min={0} max={1} step={0.05} onChange={(v) => updateShadows("groundOpacity", v)} />
                    <Slider label="Blur" value={config.shadows.groundBlur} min={0} max={50} onChange={(v) => updateShadows("groundBlur", v)} />
                    <Slider label="Scale" value={config.shadows.groundScale} min={0.5} max={2} step={0.1} onChange={(v) => updateShadows("groundScale", v)} />
                    <Slider label="Y Offset" value={config.shadows.groundYOffset} min={0} max={50} onChange={(v) => updateShadows("groundYOffset", v)} />
                  </div>
                </div>
              </div>
            )}

            {/* LIFT TAB */}
            {activeTab === "lift" && (
              <div className="bg-neutral-800 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-300 mb-3">📐 Lift Settings</h3>
                <div className="space-y-2">
                  <Slider label="Body Offset" value={config.lift.bodyOffset} min={-60} max={10} onChange={(v) => updateLift("bodyOffset", v)} />
                  <Slider label="Well Clearance" value={config.lift.wheelWellClearance} min={0.8} max={2} step={0.05} onChange={(v) => updateLift("wheelWellClearance", v)} />
                  <Slider label="Suspension Shadow" value={config.lift.suspensionShadow} min={0} max={1} step={0.05} onChange={(v) => updateLift("suspensionShadow", v)} />
                </div>
                
                <div className="mt-4 pt-4 border-t border-neutral-700">
                  <p className="text-sm text-neutral-400 mb-2">Quick Presets:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {LIFT_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => applyLiftPreset(preset)}
                        className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                          config.lift.bodyOffset === preset.bodyOffset
                            ? "bg-orange-600 text-white"
                            : "bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* EXPORT TAB */}
            {activeTab === "export" && (
              <div className="space-y-4">
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-300 mb-3">💾 Export / Save</h3>
                  <div className="space-y-2">
                    <button
                      onClick={copyConfig}
                      className="w-full py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-neutral-200 font-medium"
                    >
                      {copied ? "✓ Copied!" : "📋 Copy Config JSON"}
                    </button>
                    <button
                      onClick={exportConfig}
                      className="w-full py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-neutral-200 font-medium"
                    >
                      📥 Export JSON File
                    </button>
                    <button
                      onClick={resetDefaults}
                      className="w-full py-2 bg-red-900/50 hover:bg-red-900/70 rounded-lg text-red-200 font-medium"
                    >
                      🔄 Reset to Defaults
                    </button>
                  </div>
                </div>
                
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-300 mb-3">⚙️ Options</h3>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.showComparison}
                      onChange={(e) => updateConfig("showComparison", e.target.checked)}
                      className="accent-orange-500"
                    />
                    <span className="text-neutral-300 text-sm">Show side-by-side comparison</span>
                  </label>
                </div>
                
                {/* Current Config Preview */}
                <div className="bg-neutral-800 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-300 mb-3">📄 Current Config</h3>
                  <pre className="text-xs text-neutral-400 bg-neutral-900 p-2 rounded max-h-48 overflow-auto">
                    {JSON.stringify(config, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
