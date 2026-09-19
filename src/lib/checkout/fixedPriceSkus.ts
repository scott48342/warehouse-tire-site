/**
 * Synthetic (non-catalog) SKUs the storefront sells, and the SERVER-side rules
 * that price them at checkout. UI components import these constants so the
 * displayed price and the charged price cannot drift (checkout price authority,
 * release review 2026-09-19).
 */

/** Universal pre-programmed TPMS sensors, sold per sensor. */
export const TPMS_SENSOR_UNIVERSAL_SKU = "TPMS-SENSOR-UNIVERSAL";
export const TPMS_SENSOR_UNIVERSAL_UNIT_USD = 49.99;

/** 2-year road hazard protection: 20% of the average tire price per tire, $15 minimum. */
export const ROAD_HAZARD_SKU = "RH-PROTECT-2YR";
export const ROAD_HAZARD_RATE = 0.2;
export const ROAD_HAZARD_MIN_PER_TIRE_USD = 15;

export function roadHazardPerTireUsd(tireSubtotalUsd: number, tireCount: number): number {
  if (!(tireCount > 0)) return 0;
  const avg = tireSubtotalUsd / tireCount;
  return Math.round(Math.max(ROAD_HAZARD_MIN_PER_TIRE_USD, avg * ROAD_HAZARD_RATE) * 100) / 100;
}

/** Fixed-price synthetic SKUs (server authority). */
export const FIXED_PRICE_SKUS: Readonly<Record<string, number>> = Object.freeze({
  [TPMS_SENSOR_UNIVERSAL_SKU]: TPMS_SENSOR_UNIVERSAL_UNIT_USD,
});

/**
 * Hardware that ships free with a wheel purchase (lug nuts / hub rings / valve
 * stems the fitment engine marks `required`). A $0 line is honoured ONLY for
 * these categories, and only while the catalog says the part is cheap hardware
 * - a lift kit relabelled "lug_nut, required, $0" is still charged catalog price.
 */
export const INCLUDED_HARDWARE_MAX_UNIT_USD = 75;

const INCLUDED_HARDWARE_CATEGORIES = new Set(["lugnut", "lugnuts", "lugbolt", "lugbolts", "hubring", "hubrings", "valvestem", "valvestems"]);

export function isIncludedHardwareCategory(category: unknown): boolean {
  const key = String(category || "").toLowerCase().replace(/[^a-z]/g, "");
  return INCLUDED_HARDWARE_CATEGORIES.has(key);
}
