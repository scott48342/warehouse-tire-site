import type { TemplateFamilyConfig } from "../types";

/**
 * Half-Ton Truck Template Family V1
 * 
 * Covers: F-150, Silverado 1500, RAM 1500, Sierra 1500, Tundra, Titan
 * 
 * Calibrated for 3/4 front angle, mid camera height.
 * Base wheel diameter: 20" (most common OEM size for these trucks)
 */
export const HALF_TON_TRUCK_V1: TemplateFamilyConfig = {
  familyId: "half_ton_truck_v1",
  version: 1,
  
  canvas: {
    width: 1600,
    height: 900,
  },
  
  camera: {
    angle: "3/4_front",
    height: "mid",
    fov: "consistent",
  },
  
  anchors: {
    frontWheel: {
      x: 500,
      y: 640,
      radius: 130,
    },
    rearWheel: {
      x: 1120,
      y: 655,
      radius: 126,
    },
  },
  
  wheelScaling: {
    baseDiameter: 20,
    pixelsPerInch: 6.5,
  },
  
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

// Asset paths for this family
export const HALF_TON_TRUCK_V1_ASSETS = {
  stock: "/visualizer-lab/families/half_ton_truck_v1/stock.png",
  leveled: "/visualizer-lab/families/half_ton_truck_v1/leveled.png",
  lift_4: "/visualizer-lab/families/half_ton_truck_v1/lift_4.png",
  lift_6: "/visualizer-lab/families/half_ton_truck_v1/lift_6.png",
  lift_8: "/visualizer-lab/families/half_ton_truck_v1/lift_8.png",
} as const;
