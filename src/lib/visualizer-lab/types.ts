/**
 * Visualizer Lab - Template Family System
 * 
 * V1: Internal R&D tool for calibrating vehicle template families,
 * wheel overlay placement, stance modes, and anchor configurations.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Template Family Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WheelAnchor {
  /** X position in pixels from left edge */
  x: number;
  /** Y position in pixels from top edge */
  y: number;
  /** Base wheel radius in pixels (for baseDiameter) */
  radius: number;
}

export interface StanceProfile {
  /** Body Y offset in pixels (negative = raise, positive = lower) */
  bodyYOffset: number;
  /** Wheel scale multiplier (1.0 = no change, 1.1 = 10% larger) */
  wheelScale: number;
}

export interface TemplateFamilyConfig {
  /** Unique family identifier */
  familyId: string;
  /** Config version for migrations */
  version: number;
  /** Canvas dimensions */
  canvas: {
    width: number;
    height: number;
  };
  /** Camera/angle reference info */
  camera: {
    angle: "3/4_front" | "side" | "front";
    height: "low" | "mid" | "high";
    fov: "consistent" | "wide" | "narrow";
  };
  /** Wheel anchor points */
  anchors: {
    frontWheel: WheelAnchor;
    rearWheel: WheelAnchor;
  };
  /** Wheel scaling configuration */
  wheelScaling: {
    /** Base wheel diameter this config is calibrated for */
    baseDiameter: number;
    /** Pixels per inch of wheel diameter change */
    pixelsPerInch: number;
  };
  /** Stance profiles for different lift/level configurations */
  stanceProfiles: Record<StanceMode, StanceProfile>;
  /** Constraints for wheel sizing */
  constraints: {
    maxWheelDiameter: number;
    minWheelDiameter: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stance & Template Types
// ─────────────────────────────────────────────────────────────────────────────

export type StanceMode = "stock" | "leveled" | "lift_4" | "lift_6" | "lift_8";

export const STANCE_MODE_LABELS: Record<StanceMode, string> = {
  stock: "Stock",
  leveled: "Leveled (2\")",
  lift_4: "4\" Lift",
  lift_6: "6\" Lift",
  lift_8: "8\" Lift",
};

export const WHEEL_DIAMETERS = [17, 18, 20, 22, 24, 26] as const;
export type WheelDiameter = (typeof WHEEL_DIAMETERS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Template Asset Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplateAsset {
  /** Stance mode this template represents */
  stance: StanceMode;
  /** Path to template image */
  imagePath: string;
  /** Whether this asset is available */
  available: boolean;
}

export interface TemplateFamilyAssets {
  familyId: string;
  templates: TemplateAsset[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Lab State Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualizerLabState {
  /** Currently loaded family config */
  familyConfig: TemplateFamilyConfig;
  /** Selected stance mode */
  stanceMode: StanceMode;
  /** Selected wheel diameter */
  wheelDiameter: WheelDiameter;
  /** Fine-tuning overrides (not persisted to family config) */
  overrides: {
    wheelScale: number;
    frontWheel: Partial<WheelAnchor>;
    rearWheel: Partial<WheelAnchor>;
    bodyYOffset: number;
  };
  /** Debug overlay visibility */
  showDebug: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Family Registry (Future: will map vehicles to families)
// ─────────────────────────────────────────────────────────────────────────────

export type FamilyId =
  | "half_ton_truck_v1"
  | "hd_truck_v1"
  | "offroad_suv_v1"
  | "performance_car_v1"
  | "fullsize_suv_v1"
  | "midsize_truck_v1"
  | "sedan_crossover_v1";

export const FAMILY_LABELS: Record<FamilyId, string> = {
  half_ton_truck_v1: "Half-Ton Trucks (F-150, Silverado, RAM 1500)",
  hd_truck_v1: "HD Trucks (F-250/350, 2500/3500)",
  offroad_suv_v1: "Off-Road SUVs (4Runner, Wrangler, Bronco)",
  performance_car_v1: "Performance Cars (Mustang, Camaro, Corvette)",
  fullsize_suv_v1: "Full-Size SUVs (Tahoe, Expedition, Suburban)",
  midsize_truck_v1: "Mid-Size Trucks (Tacoma, Colorado, Ranger)",
  sedan_crossover_v1: "Sedans & Crossovers",
};
