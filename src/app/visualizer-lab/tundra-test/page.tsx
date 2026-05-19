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

// Wheel well clipping - makes tire tuck behind fender
interface WheelWellClip {
  clipTop: number;      // How much to clip from top (0-100, percentage of tire radius)
  clipLeft: number;     // Clip from left side
  clipRight: number;    // Clip from right side
  clipBottom: number;   // Clip from bottom (usually 0)
  archRadius: number;   // Roundness of the arch clip (0 = square, 100 = fully round)
}

// Tire texture/realism settings
interface TireTexture {
  darkness: number;           // 0-1, how dark the tire rubber is
  textureStrength: number;    // 0-1, visibility of tread/sidewall texture
  sidewallHighlight: number;  // 0-1, highlight on outer sidewall edge
  treadRingStrength: number;  // 0-1, visibility of tread pattern rings
  innerShadow: number;        // 0-1, shadow on inner edge of tire
}

// Wheel depth/offset feel
interface WheelDepth {
  insetShadow: number;    // 0-1, shadow behind wheel face
  dropShadow: number;     // 0-1, shadow below wheel
  offsetVisual: number;   // -20 to +20, visual offset simulation (negative = aggressive)
  faceScale: number;      // 0.8-1.2, wheel face scale relative to tire
}

// Ground shadow per wheel
interface GroundShadow {
  opacity: number;    // 0-1
  blur: number;       // px
  yOffset: number;    // px below tire
  scale: number;      // 0.5-2, relative to tire width
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
  // New realism defaults per preset
  groundShadowOpacity: number;
  groundShadowBlur: number;
  wheelWellClipTop: number;
}

interface VisualizerConfig {
  vehicleImage: string;
  wheelImage: string;
  frontWheel: WheelPosition;
  rearWheel: WheelPosition;
  tire: TireSettings;
  bodyLift: number;
  wheelScale: number;
  wheelDiameter: number;  // Wheel size in inches (17, 18, 20, 22, 24)
  
  // Wheel well clipping (per wheel)
  frontWheelClip: WheelWellClip;
  rearWheelClip: WheelWellClip;
  
  // Tire texture/realism
  tireTexture: TireTexture;
  
  // Wheel depth/offset
  wheelDepth: WheelDepth;
  
  // Ground shadows
  groundShadow: GroundShadow;
  
  // Visual effects (legacy)
  showTireShadow: boolean;
  showWheelShadow: boolean;
  shadowOpacity: number;
  shadowBlur: number;
  
  // Debug
  showDebugOutlines: boolean;
  showClipMask: boolean;  // New: debug mask visibility
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LIFT_PRESETS: LiftPreset[] = [
  { name: "Stock", bodyOffset: 0, tireScale: 1.0, sidewallBoost: 0, groundShadowOpacity: 0.4, groundShadowBlur: 8, wheelWellClipTop: 15 },
  { name: "Leveling Kit", bodyOffset: -15, tireScale: 1.05, sidewallBoost: 5, groundShadowOpacity: 0.35, groundShadowBlur: 10, wheelWellClipTop: 12 },
  { name: "4\" Lift", bodyOffset: -35, tireScale: 1.15, sidewallBoost: 15, groundShadowOpacity: 0.3, groundShadowBlur: 12, wheelWellClipTop: 8 },
  { name: "6\" Lift", bodyOffset: -55, tireScale: 1.25, sidewallBoost: 25, groundShadowOpacity: 0.25, groundShadowBlur: 15, wheelWellClipTop: 5 },
];

// Wheel diameter options - 18" is the stock baseline
const WHEEL_DIAMETERS = [17, 18, 20, 22, 24];
const STOCK_WHEEL_DIAMETER = 18;

const WHEEL_ASSETS = [
  { name: "Test Wheel", path: "/visualizer/wheels/test-wheel.png" },
  { name: "Basic Wheel", path: "/visualizer/wheels/wheel-basic.png" },
];

// ============================================================================
// STOCK BASELINE - LOCKED (2026-05-18)
// These values represent perfect stock fitment for 2010 Tundra SR5
// Do not modify without re-calibrating wheel positions
// ============================================================================
const DEFAULT_CONFIG: VisualizerConfig = {
  vehicleImage: "/visualizer/vehicles/visualizer-tundra-2010-sr5-white-side.png",
  wheelImage: "/visualizer/wheels/test-wheel.png",
  frontWheel: { x: 255, y: 595, radius: 100 },
  rearWheel: { x: 1334, y: 600, radius: 100 },
  tire: {
    outerDiameterScale: 1.30,
    sidewallThickness: 30,
    profileRatio: 1.0,
  },
  bodyLift: 0,
  wheelScale: 1.0,
  wheelDiameter: 18,  // Stock 18" wheel
  
  // Wheel well clipping - tuck tire behind fender (sides set to 0 to prevent cutoff on lifted)
  frontWheelClip: { clipTop: 15, clipLeft: 0, clipRight: 0, clipBottom: 0, archRadius: 50 },
  rearWheelClip: { clipTop: 15, clipLeft: 0, clipRight: 0, clipBottom: 0, archRadius: 50 },
  
  // Tire texture/realism
  tireTexture: {
    darkness: 0.85,
    textureStrength: 0.4,
    sidewallHighlight: 0.15,
    treadRingStrength: 0.3,
    innerShadow: 0.3,
  },
  
  // Wheel depth/offset (shadows disabled - look fake when clipped)
  wheelDepth: {
    insetShadow: 0,
    dropShadow: 0,
    offsetVisual: 0,  // 0 = neutral, negative = aggressive
    faceScale: 1.0,
  },
  
  // Ground shadow
  groundShadow: {
    opacity: 0.4,
    blur: 8,
    yOffset: 5,
    scale: 1.1,
  },
  
  // Legacy visual effects (disabled - shadows look fake when clipped)
  showTireShadow: false,
  showWheelShadow: false,
  shadowOpacity: 0.4,
  shadowBlur: 8,
  
  // Debug
  showDebugOutlines: false,
  showClipMask: false,
};

// ============================================================================
// WHEEL/TIRE RENDERER COMPONENT
// ============================================================================

interface WheelTireRendererProps {
  position: WheelPosition;
  config: VisualizerConfig;
  wheelClip: WheelWellClip;
  scaleX: number;
  scaleY: number;
  label: string;
  color: string;
}

function WheelTireRenderer({
  position,
  config,
  wheelClip,
  scaleX,
  scaleY,
  label,
  color,
}: WheelTireRendererProps) {
  const scale = Math.min(scaleX, scaleY);
  
  // Calculate rendered positions
  const centerX = position.x * scaleX;
  const centerY = position.y * scaleY;
  
  // PLUS-SIZING LOGIC:
  // - Tire outer diameter stays FIXED (stock baseline)
  // - Wheel diameter changes based on selection
  // - Sidewall automatically adjusts (bigger wheel = thinner sidewall)
  
  // Stock wheel radius (18" baseline)
  const stockWheelRadius = position.radius * scale * config.wheelScale;
  
  // Tire outer radius - FIXED based on stock setup
  const finalTireRadius = stockWheelRadius * config.tire.outerDiameterScale;
  
  // Wheel radius scales with diameter selection (18" = 1.0x, 20" = 1.11x, 22" = 1.22x, etc.)
  const wheelDiameterScale = config.wheelDiameter / STOCK_WHEEL_DIAMETER;
  const baseWheelRadius = stockWheelRadius * wheelDiameterScale;
  
  // Apply wheel face scale from depth settings
  const wheelRadius = baseWheelRadius * config.wheelDepth.faceScale;
  
  // Sidewall is the visual difference (auto-calculated)
  const sidewallWidth = finalTireRadius - wheelRadius;
  
  // OEM wheel mask radius - slightly larger to fully cover original wheel
  const oemMaskRadius = position.radius * scale * 1.1;
  
  // WHEEL WELL CLIPPING - Create clip path to tuck tire behind fender
  // Clip values are percentages of tire radius
  const clipTop = (wheelClip.clipTop / 100) * finalTireRadius;
  const clipLeft = (wheelClip.clipLeft / 100) * finalTireRadius;
  const clipRight = (wheelClip.clipRight / 100) * finalTireRadius;
  const clipBottom = (wheelClip.clipBottom / 100) * finalTireRadius;
  
  // Generate clip path - inset from edges with optional arch roundness
  const archRound = (wheelClip.archRadius / 100) * Math.min(clipTop, finalTireRadius * 0.3);
  const clipPath = `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px round ${archRound}px ${archRound}px 0px 0px)`;
  
  // Tire texture settings
  const { darkness, textureStrength, sidewallHighlight, treadRingStrength, innerShadow } = config.tireTexture;
  
  // Ground shadow settings
  const gs = config.groundShadow;
  const groundShadowWidth = finalTireRadius * 2 * gs.scale;
  const groundShadowHeight = finalTireRadius * 0.3 * gs.scale;
  
  return (
    <>
      {/* GROUND SHADOW - Ellipse below tire for planted feel */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: centerX - groundShadowWidth / 2,
          top: centerY + finalTireRadius + gs.yOffset * scale,
          width: groundShadowWidth,
          height: groundShadowHeight,
          background: `radial-gradient(ellipse, rgba(0,0,0,${gs.opacity}) 0%, transparent 70%)`,
          filter: `blur(${gs.blur}px)`,
          zIndex: 5,
        }}
      />
      
      {/* OEM Wheel Mask - covers original wheels as body lifts */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          left: centerX - oemMaskRadius,
          top: centerY - oemMaskRadius + config.bodyLift * scaleY,
          width: oemMaskRadius * 2,
          height: oemMaskRadius * 2,
          background: "radial-gradient(circle, #1a1a1a 0%, #0a0a0a 60%, #000 100%)",
          zIndex: 15,
        }}
      />
      
      {/* CLIPPING DEBUG MASK - Shows where clipping will occur */}
      {config.showClipMask && (
        <div
          className="absolute pointer-events-none border-2 border-dashed border-yellow-400"
          style={{
            left: centerX - finalTireRadius + clipLeft,
            top: centerY - finalTireRadius + clipTop,
            width: finalTireRadius * 2 - clipLeft - clipRight,
            height: finalTireRadius * 2 - clipTop - clipBottom,
            borderRadius: `${archRound}px ${archRound}px 0 0`,
            zIndex: 100,
            background: 'rgba(255, 255, 0, 0.1)',
          }}
        />
      )}
      
      {/* Main wheel/tire overlay - CLIPPED to tuck behind fender */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: centerX - finalTireRadius,
          top: centerY - finalTireRadius,
          width: finalTireRadius * 2,
          height: finalTireRadius * 2,
          clipPath: clipPath,
          zIndex: 20,
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
      
      {/* TIRE BASE - Main rubber color */}
      <div
        className="absolute rounded-full"
        style={{
          left: 0,
          top: 0,
          width: finalTireRadius * 2,
          height: finalTireRadius * 2,
          background: `radial-gradient(circle, 
            rgb(${Math.floor(30 * darkness)}, ${Math.floor(30 * darkness)}, ${Math.floor(32 * darkness)}) 0%, 
            rgb(${Math.floor(15 * darkness)}, ${Math.floor(15 * darkness)}, ${Math.floor(17 * darkness)}) 70%, 
            rgb(${Math.floor(5 * darkness)}, ${Math.floor(5 * darkness)}, ${Math.floor(5 * darkness)}) 100%)`,
          boxShadow: `inset 0 0 ${20 * innerShadow}px rgba(0,0,0,0.8), inset 0 0 ${40 * innerShadow}px rgba(0,0,0,0.4)`,
        }}
      />
      
      {/* TIRE SIDEWALL RINGS - Subtle depth rings */}
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
            transparent ${3 + sidewallWidth * 0.1}px,
            rgba(40,40,42,${0.2 * treadRingStrength}) ${3 + sidewallWidth * 0.1}px,
            rgba(40,40,42,${0.2 * treadRingStrength}) ${6 + sidewallWidth * 0.15}px
          )`,
          opacity: textureStrength,
        }}
      />
      
      {/* TIRE SIDEWALL HIGHLIGHT - Outer edge catch light */}
      <div
        className="absolute rounded-full"
        style={{
          left: 0,
          top: 0,
          width: finalTireRadius * 2,
          height: finalTireRadius * 2,
          background: `radial-gradient(circle at 30% 30%, 
            rgba(255,255,255,${0.08 * sidewallHighlight}) 0%, 
            transparent 40%,
            transparent 85%,
            rgba(255,255,255,${0.03 * sidewallHighlight}) 95%,
            transparent 100%)`,
        }}
      />
      
      {/* TIRE INNER SHADOW - Where tire meets wheel */}
      <div
        className="absolute rounded-full"
        style={{
          left: finalTireRadius - wheelRadius - sidewallWidth * 0.3,
          top: finalTireRadius - wheelRadius - sidewallWidth * 0.3,
          width: (wheelRadius + sidewallWidth * 0.3) * 2,
          height: (wheelRadius + sidewallWidth * 0.3) * 2,
          background: `radial-gradient(circle, 
            rgba(0,0,0,${0.5 * innerShadow}) 0%, 
            rgba(0,0,0,${0.3 * innerShadow}) 60%,
            transparent 100%)`,
          filter: `blur(${3}px)`,
        }}
      />
      
      {/* WHEEL INSET SHADOW - Behind wheel face for depth */}
      {config.wheelDepth.insetShadow > 0 && (
        <div
          className="absolute rounded-full"
          style={{
            left: finalTireRadius - wheelRadius - 2,
            top: finalTireRadius - wheelRadius - 2,
            width: wheelRadius * 2 + 4,
            height: wheelRadius * 2 + 4,
            background: `radial-gradient(circle, 
              rgba(0,0,0,${0.6 * config.wheelDepth.insetShadow}) 70%,
              rgba(0,0,0,${0.3 * config.wheelDepth.insetShadow}) 85%,
              transparent 100%)`,
            filter: `blur(${4}px)`,
          }}
        />
      )}
      
      {/* WHEEL DROP SHADOW - Below wheel for depth */}
      {config.wheelDepth.dropShadow > 0 && (
        <div
          className="absolute rounded-full"
          style={{
            left: finalTireRadius - wheelRadius + 3,
            top: finalTireRadius - wheelRadius + 5,
            width: wheelRadius * 2,
            height: wheelRadius * 2,
            background: `rgba(0,0,0,${0.4 * config.wheelDepth.dropShadow})`,
            filter: `blur(${6}px)`,
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
    </>
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

  // Custom wheel URL/SKU input state
  const [customWheelUrl, setCustomWheelUrl] = useState("");
  const [wheelLoading, setWheelLoading] = useState(false);
  const [wheelError, setWheelError] = useState("");
  const [loadedWheelName, setLoadedWheelName] = useState("");

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

  // Check for wheel from normalizer (sessionStorage)
  useEffect(() => {
    const normalizerWheel = sessionStorage.getItem("normalizer-preview-wheel");
    if (normalizerWheel) {
      setConfig(prev => ({ ...prev, wheelImage: normalizerWheel }));
      setLoadedWheelName("From Normalizer");
      // Clear it so it doesn't persist on refresh
      sessionStorage.removeItem("normalizer-preview-wheel");
    }
  }, []);

  // Handle already-cached images (onLoad fires before React attaches handler)
  useEffect(() => {
    const img = imageRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setRenderedSize({ width: img.clientWidth, height: img.clientHeight });
      setImageLoaded(true);
    }
  }, [config.vehicleImage]);

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

  // Load custom wheel from URL or SKU
  const loadCustomWheel = async () => {
    const input = customWheelUrl.trim();
    if (!input) return;
    
    setWheelLoading(true);
    setWheelError("");
    setLoadedWheelName("");
    
    try {
      // Check if it's a URL (starts with http)
      if (input.startsWith("http")) {
        // Direct URL - just use it
        setConfig((prev) => ({ ...prev, wheelImage: input }));
        setLoadedWheelName("Custom URL");
      } else {
        // Assume it's a SKU - fetch from our wheels API
        const res = await fetch(`/api/wheels/sku/${encodeURIComponent(input)}`);
        if (!res.ok) {
          throw new Error(`Wheel not found: ${input}`);
        }
        const wheel = await res.json();
        
        // Get the wheel image URL from the images array
        const imageUrl = wheel.images?.[0];
        if (!imageUrl) {
          throw new Error("No image found for this wheel");
        }
        
        setConfig((prev) => ({ ...prev, wheelImage: imageUrl }));
        setLoadedWheelName(`${wheel.brand || ""} ${wheel.model || wheel.title || input}`.trim());
      }
    } catch (err) {
      setWheelError(err instanceof Error ? err.message : "Failed to load wheel");
    } finally {
      setWheelLoading(false);
    }
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
                className="relative bg-gradient-to-b from-neutral-600 to-neutral-800 rounded-lg"
                style={{ minHeight: 400, overflow: 'visible' }}
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
                      wheelClip={config.frontWheelClip}
                      scaleX={scaleX}
                      scaleY={scaleY}
                      label="Front"
                      color="#22c55e"
                    />
                    <WheelTireRenderer
                      position={config.rearWheel}
                      config={config}
                      wheelClip={config.rearWheelClip}
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
                  
                  {/* Preset wheels dropdown */}
                  <select
                    value={WHEEL_ASSETS.find(a => a.path === config.wheelImage)?.path || "custom"}
                    onChange={(e) => {
                      if (e.target.value !== "custom") {
                        setConfig((prev) => ({ ...prev, wheelImage: e.target.value }));
                        setCustomWheelUrl("");
                      }
                    }}
                    className="w-full bg-neutral-700 text-white rounded px-3 py-2"
                  >
                    {WHEEL_ASSETS.map((asset) => (
                      <option key={asset.path} value={asset.path}>
                        {asset.name}
                      </option>
                    ))}
                    <option value="custom">— Custom URL/SKU —</option>
                  </select>
                  
                  {/* Custom wheel URL/SKU input */}
                  <div className="mt-3">
                    <label className="text-xs text-neutral-400 block mb-1">
                      Paste wheel image URL or SKU:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customWheelUrl}
                        onChange={(e) => setCustomWheelUrl(e.target.value)}
                        placeholder="https://... or SKU like KM54220050512"
                        className="flex-1 bg-neutral-700 text-white rounded px-3 py-2 text-sm"
                      />
                      <button
                        onClick={loadCustomWheel}
                        disabled={!customWheelUrl.trim() || wheelLoading}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-neutral-600 rounded font-medium text-sm"
                      >
                        {wheelLoading ? "..." : "Load"}
                      </button>
                    </div>
                    {wheelError && (
                      <p className="text-xs text-red-400 mt-1">{wheelError}</p>
                    )}
                    {loadedWheelName && (
                      <p className="text-xs text-green-400 mt-1">✓ {loadedWheelName}</p>
                    )}
                  </div>
                  
                  {/* Wheel Diameter Selector */}
                  <div className="mt-4">
                    <label className="text-sm text-neutral-400 block mb-2">
                      Wheel Diameter: {config.wheelDiameter}"
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {WHEEL_DIAMETERS.map((diameter) => (
                        <button
                          key={diameter}
                          onClick={() => setConfig((prev) => ({ ...prev, wheelDiameter: diameter }))}
                          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                            config.wheelDiameter === diameter
                              ? "bg-red-600 text-white"
                              : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
                          }`}
                        >
                          {diameter}"
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-neutral-500 mt-2">
                      18" = Stock • Tire diameter stays the same
                    </p>
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

            {/* Effects Tab - Realism Controls */}
            {activeTab === "effects" && (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {/* WHEEL WELL CLIPPING */}
                <div className="bg-neutral-800 rounded-lg p-3">
                  <h3 className="font-semibold text-yellow-400 mb-2 text-sm">✂️ Wheel Well Clipping</h3>
                  <label className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={config.showClipMask}
                      onChange={(e) => setConfig((prev) => ({ ...prev, showClipMask: e.target.checked }))}
                      className="accent-yellow-500" />
                    <span className="text-xs text-yellow-400">Show Clip Debug</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-green-400 mb-1">Front</p>
                      <label className="text-xs text-neutral-500">Top: {config.frontWheelClip.clipTop}%</label>
                      <input type="range" min={0} max={40} value={config.frontWheelClip.clipTop}
                        onChange={(e) => setConfig((prev) => ({ ...prev, frontWheelClip: { ...prev.frontWheelClip, clipTop: Number(e.target.value) } }))}
                        className="w-full accent-green-500 h-1" />
                      <label className="text-xs text-neutral-500">Arch: {config.frontWheelClip.archRadius}%</label>
                      <input type="range" min={0} max={100} value={config.frontWheelClip.archRadius}
                        onChange={(e) => setConfig((prev) => ({ ...prev, frontWheelClip: { ...prev.frontWheelClip, archRadius: Number(e.target.value) } }))}
                        className="w-full accent-green-500 h-1" />
                    </div>
                    <div>
                      <p className="text-xs text-blue-400 mb-1">Rear</p>
                      <label className="text-xs text-neutral-500">Top: {config.rearWheelClip.clipTop}%</label>
                      <input type="range" min={0} max={40} value={config.rearWheelClip.clipTop}
                        onChange={(e) => setConfig((prev) => ({ ...prev, rearWheelClip: { ...prev.rearWheelClip, clipTop: Number(e.target.value) } }))}
                        className="w-full accent-blue-500 h-1" />
                      <label className="text-xs text-neutral-500">Arch: {config.rearWheelClip.archRadius}%</label>
                      <input type="range" min={0} max={100} value={config.rearWheelClip.archRadius}
                        onChange={(e) => setConfig((prev) => ({ ...prev, rearWheelClip: { ...prev.rearWheelClip, archRadius: Number(e.target.value) } }))}
                        className="w-full accent-blue-500 h-1" />
                    </div>
                  </div>
                </div>
                
                {/* TIRE TEXTURE */}
                <div className="bg-neutral-800 rounded-lg p-3">
                  <h3 className="font-semibold text-neutral-300 mb-2 text-sm">🛞 Tire Texture</h3>
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-500">Darkness: {config.tireTexture.darkness.toFixed(2)}</label>
                    <input type="range" min={0.5} max={1} step={0.05} value={config.tireTexture.darkness}
                      onChange={(e) => setConfig((prev) => ({ ...prev, tireTexture: { ...prev.tireTexture, darkness: Number(e.target.value) } }))}
                      className="w-full accent-red-500 h-1" />
                    <label className="text-xs text-neutral-500">Texture: {config.tireTexture.textureStrength.toFixed(2)}</label>
                    <input type="range" min={0} max={1} step={0.05} value={config.tireTexture.textureStrength}
                      onChange={(e) => setConfig((prev) => ({ ...prev, tireTexture: { ...prev.tireTexture, textureStrength: Number(e.target.value) } }))}
                      className="w-full accent-red-500 h-1" />
                    <label className="text-xs text-neutral-500">Highlight: {config.tireTexture.sidewallHighlight.toFixed(2)}</label>
                    <input type="range" min={0} max={0.5} step={0.02} value={config.tireTexture.sidewallHighlight}
                      onChange={(e) => setConfig((prev) => ({ ...prev, tireTexture: { ...prev.tireTexture, sidewallHighlight: Number(e.target.value) } }))}
                      className="w-full accent-red-500 h-1" />
                  </div>
                </div>
                
                {/* WHEEL DEPTH */}
                <div className="bg-neutral-800 rounded-lg p-3">
                  <h3 className="font-semibold text-neutral-300 mb-2 text-sm">🎯 Wheel Depth</h3>
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-500">Inset Shadow: {config.wheelDepth.insetShadow.toFixed(2)}</label>
                    <input type="range" min={0} max={1} step={0.05} value={config.wheelDepth.insetShadow}
                      onChange={(e) => setConfig((prev) => ({ ...prev, wheelDepth: { ...prev.wheelDepth, insetShadow: Number(e.target.value) } }))}
                      className="w-full accent-red-500 h-1" />
                    <label className="text-xs text-neutral-500">Drop Shadow: {config.wheelDepth.dropShadow.toFixed(2)}</label>
                    <input type="range" min={0} max={1} step={0.05} value={config.wheelDepth.dropShadow}
                      onChange={(e) => setConfig((prev) => ({ ...prev, wheelDepth: { ...prev.wheelDepth, dropShadow: Number(e.target.value) } }))}
                      className="w-full accent-red-500 h-1" />
                    <label className="text-xs text-neutral-500">Face Scale: {config.wheelDepth.faceScale.toFixed(2)}</label>
                    <input type="range" min={0.8} max={1.2} step={0.02} value={config.wheelDepth.faceScale}
                      onChange={(e) => setConfig((prev) => ({ ...prev, wheelDepth: { ...prev.wheelDepth, faceScale: Number(e.target.value) } }))}
                      className="w-full accent-red-500 h-1" />
                  </div>
                </div>
                
                {/* GROUND SHADOW */}
                <div className="bg-neutral-800 rounded-lg p-3">
                  <h3 className="font-semibold text-neutral-300 mb-2 text-sm">🌑 Ground Shadow</h3>
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-500">Opacity: {config.groundShadow.opacity.toFixed(2)}</label>
                    <input type="range" min={0} max={0.8} step={0.05} value={config.groundShadow.opacity}
                      onChange={(e) => setConfig((prev) => ({ ...prev, groundShadow: { ...prev.groundShadow, opacity: Number(e.target.value) } }))}
                      className="w-full accent-red-500 h-1" />
                    <label className="text-xs text-neutral-500">Blur: {config.groundShadow.blur}px</label>
                    <input type="range" min={0} max={30} value={config.groundShadow.blur}
                      onChange={(e) => setConfig((prev) => ({ ...prev, groundShadow: { ...prev.groundShadow, blur: Number(e.target.value) } }))}
                      className="w-full accent-red-500 h-1" />
                    <label className="text-xs text-neutral-500">Y Offset: {config.groundShadow.yOffset}px</label>
                    <input type="range" min={0} max={30} value={config.groundShadow.yOffset}
                      onChange={(e) => setConfig((prev) => ({ ...prev, groundShadow: { ...prev.groundShadow, yOffset: Number(e.target.value) } }))}
                      className="w-full accent-red-500 h-1" />
                    <label className="text-xs text-neutral-500">Scale: {config.groundShadow.scale.toFixed(2)}</label>
                    <input type="range" min={0.5} max={2} step={0.1} value={config.groundShadow.scale}
                      onChange={(e) => setConfig((prev) => ({ ...prev, groundShadow: { ...prev.groundShadow, scale: Number(e.target.value) } }))}
                      className="w-full accent-red-500 h-1" />
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
