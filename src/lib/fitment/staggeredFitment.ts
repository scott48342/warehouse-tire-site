/**
 * Shared Staggered Fitment Module
 * 
 * Canonical source of truth for staggered fitment logic.
 * Used by both retail site and POS.
 * 
 * RETAIL decides what fits (API returns staggered info + pair data).
 * POS decides installed price and quote presentation.
 */

// ============================================================================
// Types
// ============================================================================

/** Staggered fitment info from fitment-search API */
export interface StaggeredFitmentInfo {
  isStaggered: boolean;
  reason: string;
  frontSpec?: {
    diameter: number;
    width: number;
    offset: number | null;
    tireSize: string | null;
  };
  rearSpec?: {
    diameter: number;
    width: number;
    offset: number | null;
    tireSize: string | null;
  };
}

/** Wheel pair info from fitment-search API (attached to each wheel) */
export interface WheelPairInfo {
  staggered: boolean;
  front: {
    sku: string;
    diameter?: number;
    width?: number;
    offset?: number;
  };
  rear: {
    sku: string;
    diameter?: number;
    width?: number;
    offset?: number;
  };
}

/** Setup mode for staggered-capable vehicles */
export type SetupMode = "square" | "staggered";

/** Selected wheel with optional staggered rear data */
export interface SelectedWheelWithStaggered {
  sku: string;
  rearSku?: string;
  brand: string;
  model: string;
  finish?: string;
  diameter: string;
  width: string;
  rearDiameter?: string;
  rearWidth?: string;
  offset?: string;
  rearOffset?: string;
  boltPattern?: string;
  imageUrl?: string;
  unitPrice: number;
  setPrice: number; // Total for all 4 wheels
  fitmentClass?: "surefit" | "specfit" | "extended";
  staggered?: boolean;
}

/** Selected tire with optional staggered rear data */
export interface SelectedTireWithStaggered {
  sku: string;
  rearSku?: string;
  brand: string;
  model: string;
  size: string;
  rearSize?: string;
  imageUrl?: string;
  unitPrice: number;
  setPrice: number; // Total for all 4 tires
  staggered?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if vehicle supports staggered fitment based on API response
 */
export function supportsStaggeredFitment(staggeredInfo: StaggeredFitmentInfo | null | undefined): boolean {
  return Boolean(staggeredInfo?.isStaggered);
}

/**
 * Get the default setup mode for a vehicle
 * Staggered-capable vehicles default to staggered (OEM recommendation)
 */
export function getDefaultSetupMode(staggeredInfo: StaggeredFitmentInfo | null | undefined): SetupMode {
  return supportsStaggeredFitment(staggeredInfo) ? "staggered" : "square";
}

/**
 * Create a SelectedWheelWithStaggered from API wheel data
 * Handles both square and staggered setups
 * 
 * For staggered: uses pair.front for front specs, pair.rear for rear specs
 * For square: uses wheel's own diameter/width
 */
export function createSelectedWheel(
  wheel: {
    sku?: string;
    brand?: string;
    model?: string;
    finish?: string;
    diameter?: string;
    width?: string;
    offset?: string;
    boltPattern?: string;
    imageUrl?: string;
    price?: number;
    fitmentClass?: "surefit" | "specfit" | "extended";
    pair?: WheelPairInfo;
  },
  setupMode: SetupMode
): SelectedWheelWithStaggered {
  const isStaggered = setupMode === "staggered" && wheel.pair?.staggered;
  const unitPrice = wheel.price || 0;
  
  // For staggered, use pair.front/rear specs; for square, use wheel's own specs
  const frontDiameter = isStaggered && wheel.pair?.front?.diameter 
    ? String(wheel.pair.front.diameter) 
    : wheel.diameter || "";
  const frontWidth = isStaggered && wheel.pair?.front?.width 
    ? String(wheel.pair.front.width) 
    : wheel.width || "";
  const frontOffset = isStaggered && wheel.pair?.front?.offset != null
    ? String(wheel.pair.front.offset)
    : wheel.offset;
  const frontSku = isStaggered && wheel.pair?.front?.sku
    ? wheel.pair.front.sku
    : wheel.sku || "";
  
  return {
    sku: frontSku,
    rearSku: isStaggered ? wheel.pair?.rear?.sku : undefined,
    brand: wheel.brand || "",
    model: wheel.model || "",
    finish: wheel.finish,
    diameter: frontDiameter,
    width: frontWidth,
    rearDiameter: isStaggered && wheel.pair?.rear?.diameter ? String(wheel.pair.rear.diameter) : undefined,
    rearWidth: isStaggered && wheel.pair?.rear?.width ? String(wheel.pair.rear.width) : undefined,
    offset: frontOffset,
    rearOffset: isStaggered && wheel.pair?.rear?.offset != null ? String(wheel.pair.rear.offset) : undefined,
    boltPattern: wheel.boltPattern,
    imageUrl: wheel.imageUrl,
    unitPrice,
    setPrice: unitPrice * 4, // Always qty 4 (2 front + 2 rear, or 4 same)
    fitmentClass: wheel.fitmentClass,
    staggered: isStaggered,
  };
}

/**
 * Create a SelectedTireWithStaggered
 * Handles both square and staggered setups
 */
export function createSelectedTire(
  tire: {
    sku?: string;
    brand?: string;
    model?: string;
    size?: string;
    imageUrl?: string;
    price?: number;
  },
  rearTire?: {
    sku?: string;
    size?: string;
    price?: number;
  },
  setupMode: SetupMode = "square"
): SelectedTireWithStaggered {
  const isStaggered = setupMode === "staggered" && !!rearTire;
  const unitPrice = tire.price || 0;
  const rearPrice = rearTire?.price || unitPrice;
  
  // For staggered, average the front/rear prices for setPrice
  const avgPrice = isStaggered ? (unitPrice + rearPrice) / 2 : unitPrice;
  
  return {
    sku: tire.sku || "",
    rearSku: isStaggered ? rearTire?.sku : undefined,
    brand: tire.brand || "",
    model: tire.model || "",
    size: tire.size || "",
    rearSize: isStaggered ? rearTire?.size : undefined,
    imageUrl: tire.imageUrl,
    unitPrice,
    setPrice: avgPrice * 4, // Always qty 4
    staggered: isStaggered,
  };
}

/**
 * Format wheel size display string
 */
export function formatWheelSize(
  wheel: { diameter?: string; width?: string; rearDiameter?: string; rearWidth?: string; staggered?: boolean }
): string {
  if (wheel.staggered && (wheel.rearWidth || wheel.rearDiameter)) {
    const rearDia = wheel.rearDiameter || wheel.diameter;
    const rearW = wheel.rearWidth || wheel.width;
    return `F: ${wheel.diameter}"×${wheel.width}" / R: ${rearDia}"×${rearW}"`;
  }
  return `${wheel.diameter}" × ${wheel.width}"`;
}

/**
 * Format tire size display string
 */
export function formatTireSize(
  tire: { size?: string; rearSize?: string; staggered?: boolean }
): string {
  if (tire.staggered && tire.rearSize) {
    return `F: ${tire.size} / R: ${tire.rearSize}`;
  }
  return tire.size || "";
}

/**
 * Calculate total wheels/tires price for display
 * Always returns price for 4 items (set)
 */
export function calculateSetPrice(unitPrice: number, quantity: number = 4): number {
  return unitPrice * quantity;
}
