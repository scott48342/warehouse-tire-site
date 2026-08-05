/**
 * Local Shop Pricing
 * 
 * Constants and utilities for calculating out-the-door pricing
 * for the local shop (shop.warehousetire.net).
 * 
 * These fees apply to tire installation orders.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Labor charge for mount, balance, and install (per set of 4) */
export const LABOR_FEE_PER_SET = 80.00;

/** Tire recycling/disposal fee (per set of 4) */
export const RECYCLING_FEE_PER_SET = 20.00;

/** Commercial/medium-truck labor (per set of 4 — $40/tire) */
export const COMMERCIAL_LABOR_FEE_PER_SET = 160.00;

/** Commercial/medium-truck disposal (per set of 4 — $25/tire) */
export const COMMERCIAL_RECYCLING_FEE_PER_SET = 100.00;

/**
 * Detect commercial / medium-truck sizes (decimal rims 17.5/19.5/22.5/24.5
 * or R-style like 11R22.5). These use commercial labor/disposal rates.
 * Mirrors isCommercialTruckSize in /api/tires/search.
 */
export function isCommercialTireSize(s: string | null | undefined): boolean {
  const v = String(s || "").trim().toUpperCase();
  if (/^\d{1,2}\s*R\s*\d{2}\.5$/.test(v)) return true;          // 11R22.5
  if (/^\d{5}$/.test(v)) return true;                            // 11225 compact
  if (/R\s*\d{2}\.5(?:[^0-9]|$)/.test(v)) return true;           // 225/70R19.5
  if (/^\d{3}\d{2}(?:175|195|225|245)$/.test(v)) return true;    // 22570195 compact
  return false;
}

/** Michigan sales tax rate */
export const TAX_RATE = 0.06;

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface LocalPriceBreakdown {
  /** Tire price × quantity */
  tiresSubtotal: number;
  /** Labor for install (mount/balance) */
  laborFee: number;
  /** Tire recycling fee */
  recyclingFee: number;
  /** Subtotal before tax */
  subtotalBeforeTax: number;
  /** Sales tax (6%) */
  tax: number;
  /** Total out-the-door price */
  total: number;
}

/**
 * Calculate full out-the-door price for local mode
 * Includes labor, recycling, and 6% tax (tax only on tires, not labor/fees)
 * 
 * @param unitPrice - Price per tire
 * @param quantity - Number of tires (default 4)
 * @param tireSize - Optional tire size; commercial sizes use commercial rates
 */
export function calculateLocalOutTheDoorPrice(
  unitPrice: number,
  quantity: number = 4,
  tireSize?: string | null
): LocalPriceBreakdown {
  const tiresSubtotal = unitPrice * quantity;
  
  // Fees are per set (4 tires), scale proportionally for other quantities.
  // Commercial/medium-truck sizes: $40/tire labor + $25/tire disposal.
  const commercial = isCommercialTireSize(tireSize);
  const setMultiplier = quantity / 4;
  const laborFee = (commercial ? COMMERCIAL_LABOR_FEE_PER_SET : LABOR_FEE_PER_SET) * setMultiplier;
  const recyclingFee = (commercial ? COMMERCIAL_RECYCLING_FEE_PER_SET : RECYCLING_FEE_PER_SET) * setMultiplier;
  
  const subtotalBeforeTax = tiresSubtotal + laborFee + recyclingFee;
  
  // Tax only applies to tires (product), not labor or recycling fees
  const tax = tiresSubtotal * TAX_RATE;
  const total = subtotalBeforeTax + tax;
  
  return {
    tiresSubtotal,
    laborFee,
    recyclingFee,
    subtotalBeforeTax,
    tax,
    total,
  };
}

/**
 * Get just the out-the-door total (for display on cards)
 */
export function getOutTheDoorTotal(unitPrice: number, quantity: number = 4, tireSize?: string | null): number {
  return calculateLocalOutTheDoorPrice(unitPrice, quantity, tireSize).total;
}

/**
 * Get simplified breakdown for UI display
 */
export function getOutTheDoorBreakdown(unitPrice: number, quantity: number = 4, tireSize?: string | null): {
  tiresTotal: number;
  installTotal: number;
  taxTotal: number;
  recyclingTotal: number;
  outTheDoorTotal: number;
} {
  const breakdown = calculateLocalOutTheDoorPrice(unitPrice, quantity, tireSize);
  return {
    tiresTotal: breakdown.tiresSubtotal,
    installTotal: breakdown.laborFee,
    taxTotal: breakdown.tax,
    recyclingTotal: breakdown.recyclingFee,
    outTheDoorTotal: breakdown.total,
  };
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, decimals: number = 0): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}