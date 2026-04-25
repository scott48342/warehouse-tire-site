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
 */
export function calculateLocalOutTheDoorPrice(
  unitPrice: number,
  quantity: number = 4
): LocalPriceBreakdown {
  const tiresSubtotal = unitPrice * quantity;
  
  // Fees are per set (4 tires), scale proportionally for other quantities
  const setMultiplier = quantity / 4;
  const laborFee = LABOR_FEE_PER_SET * setMultiplier;
  const recyclingFee = RECYCLING_FEE_PER_SET * setMultiplier;
  
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
export function getOutTheDoorTotal(unitPrice: number, quantity: number = 4): number {
  return calculateLocalOutTheDoorPrice(unitPrice, quantity).total;
}

/**
 * Get simplified breakdown for UI display
 */
export function getOutTheDoorBreakdown(unitPrice: number, quantity: number = 4): {
  tiresTotal: number;
  installTotal: number;
  taxTotal: number;
  recyclingTotal: number;
  outTheDoorTotal: number;
} {
  const breakdown = calculateLocalOutTheDoorPrice(unitPrice, quantity);
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