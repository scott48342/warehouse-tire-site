/**
 * Accessory Pricing Estimates
 * 
 * These are default estimates used in package summaries before actual
 * product selection. When users select specific products (e.g., via
 * QuoteBuilder TPMS lookup), the real prices are used instead.
 * 
 * Reference SKUs for common accessories:
 * - TPMS: HTS-A78ED (typical price ~$22-28/unit)
 * - Lug nuts: varies by vehicle
 * - Hub rings: varies by vehicle
 */

// TPMS sensor typical pricing (per unit)
// Based on HTS-A78ED and similar universal sensors
export const TPMS_UNIT_PRICE_ESTIMATE = 24; // $24 per sensor
export const TPMS_QUANTITY_DEFAULT = 4;
export const TPMS_SET_PRICE_ESTIMATE = TPMS_UNIT_PRICE_ESTIMATE * TPMS_QUANTITY_DEFAULT; // $96 for 4

// Reference SKU for TPMS lookup
export const TPMS_DEFAULT_SKU = "HTS-A78ED";

// Mount & balance service estimate (for 4 tires)
export const MOUNT_BALANCE_ESTIMATE = 100;

// Package estimate helpers
export function getTpmsEstimate(quantity = 4): number {
  return TPMS_UNIT_PRICE_ESTIMATE * quantity;
}

export function getMountBalanceEstimate(): number {
  return MOUNT_BALANCE_ESTIMATE;
}
