/**
 * Synthetic (non-catalog) SKUs the storefront sells, and the SERVER-side rules
 * that price them at checkout. UI components import these constants so the
 * displayed price and the charged price cannot drift (checkout price authority,
 * release review 2026-09-19).
 */
import { parseThreadSize } from "@/lib/fitment/accessories";

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

/** Optional upsells offered by CompleteYourSetup / the cart upsell (synthetic SKUs). */
export const LUG_KIT_CHROME_SKU = "LUG-KIT-CHROME";
export const LUG_KIT_CHROME_UNIT_USD = 79.99;
export const HUB_CENTRIC_RINGS_SKU = "HUB-CENTRIC-RINGS";
export const HUB_CENTRIC_RINGS_UNIT_USD = 24.99;

/** Fixed-price synthetic SKUs (server authority). */
export const FIXED_PRICE_SKUS: Readonly<Record<string, number>> = Object.freeze({
  [TPMS_SENSOR_UNIVERSAL_SKU]: TPMS_SENSOR_UNIVERSAL_UNIT_USD,
  [LUG_KIT_CHROME_SKU]: LUG_KIT_CHROME_UNIT_USD,
  [HUB_CENTRIC_RINGS_SKU]: HUB_CENTRIC_RINGS_UNIT_USD,
});

/**
 * Included install hardware (release review 2026-09-19, tightened after Codex
 * acceptance question): a $0 line is honoured ONLY when the SERVER decides the
 * line is included hardware. Nothing the client sends (`required`, `category`,
 * `unitPrice`) can create the entitlement; it can only choose which eligible
 * line takes a free slot.
 *
 *  - Kind comes from the SKU: the fitment engine's placeholder formats
 *    (`LUGKIT-<thread>` with a parseable thread, `HR-<outer>-<inner>` hub rings)
 *    or the catalog's own `accessories.category` for a real part number.
 *  - Entitlement requires a wheel set in the same order: one lug kit and one
 *    hub-ring set per wheel set, unit quantity <= wheel sets.
 *  - A real part number is included only while the catalog price is at or
 *    under INCLUDED_HARDWARE_MAX_UNIT_USD; above that it is charged catalog
 *    price. A lift kit relabelled "lug_nut, required, $0" is charged.
 *  - An unknown SKU that is not a recognised placeholder is always rejected.
 */
export const INCLUDED_HARDWARE_MAX_UNIT_USD = 75;

export type IncludedHardwareKind = "lug_kit" | "hub_ring" | "valve_stem";

const LUG_KIT_PLACEHOLDER = /^LUGKIT-(.+)$/i;
// Canonical form is tenths of a mm (`HR-73.1-70.5`, see formatHubRingSku). Whole-mm
// digits (`HR-73-71`, pre-2026-09-20 carts) still PARSE so they reach the server
// comparison and are rejected as hardware_mismatch instead of silently unpriceable.
const HUB_RING_PLACEHOLDER = /^HR-(\d{2,3}(?:\.\d)?)-(\d{2,3}(?:\.\d)?)$/i;

/** Placeholder SKUs the fitment engine emits before a catalog kit is looked up. */
export function includedHardwarePlaceholderKind(sku: string): IncludedHardwareKind | null {
  const s = String(sku || "").trim();
  const lug = LUG_KIT_PLACEHOLDER.exec(s);
  if (lug) return parseThreadSize(lug[1]) ? "lug_kit" : null;
  if (HUB_RING_PLACEHOLDER.test(s)) return "hub_ring";
  return null;
}

/** Thread the client's `LUGKIT-<thread>` placeholder CLAIMS (validated server-side at checkout). */
export function parseLugKitPlaceholder(sku: string) {
  const lug = LUG_KIT_PLACEHOLDER.exec(String(sku || "").trim());
  return lug ? parseThreadSize(lug[1]) : null;
}

/**
 * Outer/inner mm the client's `HR-<outer>-<inner>` placeholder CLAIMS (validated
 * server-side at checkout). `tenths` is false when the SKU carries whole-mm digits
 * only, which can never identify one physical ring.
 */
export function parseHubRingPlaceholder(sku: string): { outer: number; inner: number; tenths: boolean } | null {
  const m = HUB_RING_PLACEHOLDER.exec(String(sku || "").trim());
  if (!m) return null;
  return { outer: Number(m[1]), inner: Number(m[2]), tenths: m[1].includes(".") && m[2].includes(".") };
}

/** Catalog category (from `accessories.category`, never the client) -> hardware kind. */
export function includedHardwareKindFromCatalogCategory(category: unknown): IncludedHardwareKind | null {
  const key = String(category || "").toLowerCase().replace(/[^a-z]/g, "");
  if (key === "lugnut" || key === "lugnuts" || key === "lugbolt" || key === "lugbolts") return "lug_kit";
  if (key === "hubring" || key === "hubrings" || key === "hubcentricring" || key === "hubcentricrings") return "hub_ring";
  if (key === "valvestem" || key === "valvestems") return "valve_stem";
  return null;
}
