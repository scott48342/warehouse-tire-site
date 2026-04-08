import type { TemplateFamilyConfig } from "../types";

/**
 * Half-Ton Truck Template Family V1
 * 
 * Covers: F-150, Silverado 1500, RAM 1500, Sierra 1500, Tundra, Titan
 * 
 * Calibrated for 3/4 front angle, mid camera height.
 * Base wheel diameter: 20" (most common OEM size for these trucks)
 * 
 * CALIBRATION DATE: 2026-04-08
 * APPROVED BY: Scott
 */
export const HALF_TON_TRUCK_V1: TemplateFamilyConfig = {
  familyId: "half_ton_truck_v1",
  version: 2, // Updated from v1 after calibration
  
  canvas: {
    width: 1600,
    height: 900,
  },
  
  camera: {
    angle: "3/4_front",
    height: "mid",
    fov: "consistent",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CALIBRATED ANCHOR POSITIONS
  // These values position the wheel overlays on the vehicle template
  // ═══════════════════════════════════════════════════════════════════════════
  anchors: {
    frontWheel: {
      x: 500,      // Horizontal position from left edge (px)
      y: 640,      // Vertical position from top edge (px)
      radius: 130, // Base wheel radius (px) - used for tire outer sizing
    },
    rearWheel: {
      x: 1120,     // Horizontal position from left edge (px)
      y: 655,      // Vertical position from top edge (px)
      radius: 126, // Base wheel radius (px) - slightly smaller due to perspective
    },
  },
  
  wheelScaling: {
    baseDiameter: 20,
    pixelsPerInch: 6.5,
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STANCE PROFILES
  // Body offset and wheel scale adjustments per stance mode
  // ═══════════════════════════════════════════════════════════════════════════
  stanceProfiles: {
    stock: {
      bodyYOffset: 0,
      wheelScale: 1.0,
    },
    leveled: {
      bodyYOffset: -10,
      wheelScale: 1.02,
    },
    lift_4: {
      bodyYOffset: -26,
      wheelScale: 1.04,
    },
    lift_6: {
      bodyYOffset: -38,
      wheelScale: 1.06,
    },
    lift_8: {
      bodyYOffset: -52,
      wheelScale: 1.08,
    },
  },
  
  constraints: {
    maxWheelDiameter: 26,
    minWheelDiameter: 17,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVED VISUAL CALIBRATION SETTINGS
// These values control the tire/wheel rendering appearance
// Calibrated 2026-04-08 for realistic, product-focused visualization
// ═══════════════════════════════════════════════════════════════════════════════
export const HALF_TON_TRUCK_V1_VISUAL_SETTINGS = {
  /**
   * Tire scale multiplier - controls overall tire outer diameter
   * Lower = tighter fit in wheel well, avoids "ballooned" look
   */
  tireScale: 1.02,
  
  /**
   * Wheel inset - makes wheel slightly smaller than tire opening for depth
   * 0.95 = wheel is 95% of tire inner opening (5% inset)
   */
  wheelInset: 0.95,
  
  /**
   * Wheel-to-tire ratios by diameter
   * Maps wheel size to what % of tire outer the wheel face occupies
   * Larger wheel = higher ratio = thinner sidewall
   */
  wheelToTireRatios: {
    17: 0.68,  // 32% sidewall - thick (off-road look)
    18: 0.72,  // 28% sidewall - slightly thick
    20: 0.78,  // 22% sidewall - baseline
    22: 0.84,  // 16% sidewall - thinner
    24: 0.89,  // 11% sidewall - low profile
    26: 0.93,  // 7% sidewall - very low profile
  },
  
  /**
   * Contact shadow settings
   */
  shadow: {
    centerOpacity: 0.55,
    widthMultiplier: 1.25,
    heightMultiplier: 0.18,
  },
  
  /**
   * Tire gradient colors (inner to outer)
   */
  tireGradient: {
    inner: "#2d2d2d",
    midInner: "#262626",
    mid: "#1e1e1e",
    midOuter: "#151515",
    outer: "#0d0d0d",
  },
} as const;

// Asset paths for this family
export const HALF_TON_TRUCK_V1_ASSETS = {
  stock: "/visualizer-lab/families/half_ton_truck_v1/stock.png",
  leveled: "/visualizer-lab/families/half_ton_truck_v1/leveled.png",
  lift_4: "/visualizer-lab/families/half_ton_truck_v1/lift_4.png",
  lift_6: "/visualizer-lab/families/half_ton_truck_v1/lift_6.png",
  lift_8: "/visualizer-lab/families/half_ton_truck_v1/lift_8.png",
} as const;
