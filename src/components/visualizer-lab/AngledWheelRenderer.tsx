/**
 * Angled Wheel Compatibility Renderer
 * 
 * Makes angled wheel images (-A1-, -A2-) usable in the visualizer by:
 * - Cropping/zooming toward the wheel face
 * - Adding tire ring overlays to hide barrel depth
 * - Applying circular masks to hide perspective issues
 * - Adding shadows and tire sidewall layers
 * 
 * NO REGRESSION: Isolated to visualizer lab only.
 */

import { CSSProperties } from "react";

// ============================================================================
// TYPES
// ============================================================================

export interface AngledWheelSettings {
  // Crop/Zoom controls
  cropZoom: number;        // 1.0 - 2.0, how much to zoom into the wheel face
  cropX: number;           // -50 to 50, horizontal offset (% of wheel width)
  cropY: number;           // -50 to 50, vertical offset (% of wheel height)
  
  // Perspective correction
  rotation: number;        // -30 to 30, degrees to rotate the wheel
  skewX: number;           // -20 to 20, horizontal skew
  skewY: number;           // -20 to 20, vertical skew
  
  // Tire overlay to hide barrel
  tireRingThickness: number;     // 0 - 50, thickness of outer tire ring (% of radius)
  tireOverlayOpacity: number;    // 0 - 1, opacity of tire overlay
  barrelHideAmount: number;      // 0 - 100, how much of outer edge to hide
  
  // Inner masking
  innerShadowStrength: number;   // 0 - 1, shadow around wheel center
  faceMaskRadius: number;        // 50 - 100, % of wheel area to show
  faceMaskFeather: number;       // 0 - 50, blur on mask edge (px)
  
  // Layer control
  tireOnTop: boolean;            // Whether tire overlay renders on top of wheel
}

export interface AngledWheelRendererProps {
  imageUrl: string;
  settings: AngledWheelSettings;
  size: number;            // Rendered size in pixels
  showDebug?: boolean;
  className?: string;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

export const DEFAULT_ANGLED_SETTINGS: AngledWheelSettings = {
  cropZoom: 1.2,
  cropX: 0,
  cropY: 0,
  rotation: 0,
  skewX: 0,
  skewY: 0,
  tireRingThickness: 15,
  tireOverlayOpacity: 1,
  barrelHideAmount: 20,
  innerShadowStrength: 0.5,
  faceMaskRadius: 85,
  faceMaskFeather: 10,
  tireOnTop: true,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function AngledWheelRenderer({
  imageUrl,
  settings,
  size,
  showDebug = false,
  className = "",
}: AngledWheelRendererProps) {
  const s = settings;
  const radius = size / 2;
  
  // Calculate mask for hiding barrel/perspective
  const maskRadius = (s.faceMaskRadius / 100) * radius;
  const feather = s.faceMaskFeather;
  
  // Tire ring dimensions
  const tireThickness = (s.tireRingThickness / 100) * radius;
  const barrelHide = (s.barrelHideAmount / 100) * radius;
  
  // Transform for the wheel image
  const wheelTransform = [
    `scale(${s.cropZoom})`,
    `translate(${s.cropX}%, ${s.cropY}%)`,
    `rotate(${s.rotation}deg)`,
    `skewX(${s.skewX}deg)`,
    `skewY(${s.skewY}deg)`,
  ].join(" ");
  
  // Mask gradient for hiding outer barrel
  const maskGradient = `radial-gradient(circle at center, 
    black 0%, 
    black ${maskRadius - feather}px, 
    transparent ${maskRadius}px
  )`;
  
  return (
    <div 
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Debug outline */}
      {showDebug && (
        <div 
          className="absolute inset-0 border-2 border-dashed border-yellow-500 rounded-full pointer-events-none"
          style={{ zIndex: 100 }}
        />
      )}
      
      {/* TIRE BASE LAYER - Behind wheel */}
      {!s.tireOnTop && (
        <TireOverlay 
          size={size} 
          thickness={tireThickness} 
          opacity={s.tireOverlayOpacity}
          innerShadow={s.innerShadowStrength}
        />
      )}
      
      {/* WHEEL IMAGE with transforms and mask */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          maskImage: maskGradient,
          WebkitMaskImage: maskGradient,
        }}
      >
        {/* Inner barrel hide (dark ring behind wheel) */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at center,
              transparent 0%,
              transparent ${radius - barrelHide - 10}px,
              rgba(0,0,0,0.8) ${radius - barrelHide}px,
              rgba(0,0,0,0.9) ${radius}px
            )`,
            zIndex: 1,
          }}
        />
        
        {/* Wheel image */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 2 }}
        >
          <img
            src={imageUrl}
            alt="Wheel"
            className="w-full h-full object-contain"
            style={{
              transform: wheelTransform,
              transformOrigin: "center center",
            }}
          />
        </div>
        
        {/* Inner shadow overlay */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle at center,
              rgba(0,0,0,${0.3 * s.innerShadowStrength}) 0%,
              rgba(0,0,0,${0.1 * s.innerShadowStrength}) 40%,
              transparent 70%
            )`,
            zIndex: 3,
          }}
        />
      </div>
      
      {/* TIRE OVERLAY LAYER - On top of wheel */}
      {s.tireOnTop && (
        <TireOverlay 
          size={size} 
          thickness={tireThickness} 
          opacity={s.tireOverlayOpacity}
          innerShadow={s.innerShadowStrength}
        />
      )}
    </div>
  );
}

// ============================================================================
// TIRE OVERLAY COMPONENT
// ============================================================================

interface TireOverlayProps {
  size: number;
  thickness: number;
  opacity: number;
  innerShadow: number;
}

function TireOverlay({ size, thickness, opacity, innerShadow }: TireOverlayProps) {
  const radius = size / 2;
  const innerRadius = radius - thickness;
  
  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ opacity }}
    >
      {/* Outer tire ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at center,
            transparent 0%,
            transparent ${innerRadius - 5}px,
            #1a1a1a ${innerRadius}px,
            #0f0f0f ${innerRadius + thickness * 0.3}px,
            #1a1a1a ${innerRadius + thickness * 0.7}px,
            #0a0a0a ${radius}px
          )`,
          zIndex: 10,
        }}
      />
      
      {/* Tire sidewall highlight */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 30%,
            transparent 0%,
            transparent ${innerRadius}px,
            rgba(255,255,255,0.05) ${innerRadius + thickness * 0.2}px,
            transparent ${innerRadius + thickness * 0.5}px
          )`,
          zIndex: 11,
        }}
      />
      
      {/* Inner shadow where tire meets wheel */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: `inset 0 0 ${20 * innerShadow}px rgba(0,0,0,0.6)`,
          zIndex: 12,
        }}
      />
    </div>
  );
}

// ============================================================================
// SETTINGS CONTROL PANEL
// ============================================================================

interface AngledSettingsControlsProps {
  settings: AngledWheelSettings;
  onChange: (settings: AngledWheelSettings) => void;
}

export function AngledSettingsControls({ settings, onChange }: AngledSettingsControlsProps) {
  const update = <K extends keyof AngledWheelSettings>(key: K, value: AngledWheelSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };
  
  return (
    <div className="space-y-4 text-sm">
      {/* Crop/Zoom Section */}
      <div className="bg-neutral-700/50 rounded-lg p-3">
        <h4 className="font-semibold text-orange-400 mb-2">📐 Crop & Zoom</h4>
        <div className="space-y-2">
          <SliderControl
            label="Zoom"
            value={settings.cropZoom}
            min={1} max={2} step={0.05}
            onChange={(v) => update("cropZoom", v)}
          />
          <SliderControl
            label="Offset X"
            value={settings.cropX}
            min={-50} max={50} step={1}
            onChange={(v) => update("cropX", v)}
          />
          <SliderControl
            label="Offset Y"
            value={settings.cropY}
            min={-50} max={50} step={1}
            onChange={(v) => update("cropY", v)}
          />
        </div>
      </div>
      
      {/* Perspective Section */}
      <div className="bg-neutral-700/50 rounded-lg p-3">
        <h4 className="font-semibold text-blue-400 mb-2">🔄 Perspective</h4>
        <div className="space-y-2">
          <SliderControl
            label="Rotation"
            value={settings.rotation}
            min={-30} max={30} step={1}
            onChange={(v) => update("rotation", v)}
          />
          <SliderControl
            label="Skew X"
            value={settings.skewX}
            min={-20} max={20} step={1}
            onChange={(v) => update("skewX", v)}
          />
          <SliderControl
            label="Skew Y"
            value={settings.skewY}
            min={-20} max={20} step={1}
            onChange={(v) => update("skewY", v)}
          />
        </div>
      </div>
      
      {/* Tire Overlay Section */}
      <div className="bg-neutral-700/50 rounded-lg p-3">
        <h4 className="font-semibold text-green-400 mb-2">🛞 Tire Overlay</h4>
        <div className="space-y-2">
          <SliderControl
            label="Tire Ring"
            value={settings.tireRingThickness}
            min={0} max={50} step={1}
            onChange={(v) => update("tireRingThickness", v)}
          />
          <SliderControl
            label="Tire Opacity"
            value={settings.tireOverlayOpacity}
            min={0} max={1} step={0.05}
            onChange={(v) => update("tireOverlayOpacity", v)}
          />
          <SliderControl
            label="Barrel Hide"
            value={settings.barrelHideAmount}
            min={0} max={100} step={5}
            onChange={(v) => update("barrelHideAmount", v)}
          />
          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={settings.tireOnTop}
              onChange={(e) => update("tireOnTop", e.target.checked)}
              className="accent-green-500"
            />
            <span className="text-neutral-300">Tire on top of wheel</span>
          </label>
        </div>
      </div>
      
      {/* Masking Section */}
      <div className="bg-neutral-700/50 rounded-lg p-3">
        <h4 className="font-semibold text-purple-400 mb-2">🎭 Masking</h4>
        <div className="space-y-2">
          <SliderControl
            label="Face Mask"
            value={settings.faceMaskRadius}
            min={50} max={100} step={1}
            onChange={(v) => update("faceMaskRadius", v)}
          />
          <SliderControl
            label="Mask Feather"
            value={settings.faceMaskFeather}
            min={0} max={50} step={1}
            onChange={(v) => update("faceMaskFeather", v)}
          />
          <SliderControl
            label="Inner Shadow"
            value={settings.innerShadowStrength}
            min={0} max={1} step={0.05}
            onChange={(v) => update("innerShadowStrength", v)}
          />
        </div>
      </div>
      
      {/* Reset Button */}
      <button
        onClick={() => onChange(DEFAULT_ANGLED_SETTINGS)}
        className="w-full py-2 bg-neutral-600 hover:bg-neutral-500 rounded-lg text-neutral-200 font-medium"
      >
        Reset to Defaults
      </button>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function SliderControl({ label, value, min, max, step, onChange }: SliderControlProps) {
  return (
    <div>
      <div className="flex justify-between text-xs text-neutral-400 mb-1">
        <span>{label}</span>
        <span>{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-red-500"
      />
    </div>
  );
}

// ============================================================================
// SIDE-BY-SIDE PREVIEW COMPONENT
// ============================================================================

interface AngledWheelPreviewProps {
  imageUrl: string;
  settings: AngledWheelSettings;
  wheelName?: string;
}

export function AngledWheelPreview({ imageUrl, settings, wheelName }: AngledWheelPreviewProps) {
  return (
    <div className="bg-neutral-800 rounded-lg p-4">
      <h3 className="font-semibold text-neutral-300 mb-3">
        👁️ Side-by-Side Preview {wheelName && `— ${wheelName}`}
      </h3>
      
      <div className="grid grid-cols-3 gap-4">
        {/* Raw angled image */}
        <div className="text-center">
          <div className="bg-neutral-700 rounded-lg p-2 mb-2">
            <img
              src={imageUrl}
              alt="Raw angled"
              className="w-full aspect-square object-contain"
            />
          </div>
          <p className="text-xs text-neutral-400">Raw Angled</p>
        </div>
        
        {/* Processed with angled compatibility */}
        <div className="text-center">
          <div className="bg-neutral-700 rounded-lg p-2 mb-2 flex items-center justify-center">
            <AngledWheelRenderer
              imageUrl={imageUrl}
              settings={settings}
              size={200}
            />
          </div>
          <p className="text-xs text-neutral-400">Angled Compat</p>
        </div>
        
        {/* Simulated on vehicle */}
        <div className="text-center">
          <div className="bg-gradient-to-b from-neutral-600 to-neutral-700 rounded-lg p-2 mb-2 flex items-center justify-center relative overflow-hidden">
            {/* Fake fender arch */}
            <div 
              className="absolute top-0 left-0 right-0 h-8 bg-neutral-800"
              style={{
                borderRadius: "0 0 50% 50%",
              }}
            />
            <div className="relative" style={{ clipPath: "inset(15% 0 0 0 round 20px 20px 0 0)" }}>
              <AngledWheelRenderer
                imageUrl={imageUrl}
                settings={settings}
                size={200}
              />
            </div>
          </div>
          <p className="text-xs text-neutral-400">On Vehicle (sim)</p>
        </div>
      </div>
    </div>
  );
}
