/**
 * Wheel Price Overrides
 *
 * Manual corrections for SKUs whose WheelPros-sourced MSRP is wrong (e.g. the
 * feed lists dealer cost in the MSRP field). The override MSRP is fed through
 * the normal pricing math (so margin/markup still applies) — it is NOT a final
 * sell price, it's the corrected MSRP input.
 *
 * Why this exists: both the WheelPros SFTP feed AND the live WheelPros product
 * API return the same bad MSRP for certain SKUs (confirmed 2026-06-18 for the
 * Niche Kanan T112200090+20 = $306 vs $490 for sibling Niche 20" wheels), and
 * there is no separate cost/MAP field to cross-check against. The automatic
 * sibling-outlier guard (wheelPriceSanity.ts) catches most of these, but this
 * table lets us set the exact correct value for known SKUs.
 *
 * Keep this list small and intentional. Prefer the automatic guard; use this
 * only when you want a precise, hand-verified MSRP.
 *
 * @created 2026-06-18
 */

/** SKU -> corrected MSRP (USD). */
export const WHEEL_MSRP_OVERRIDES: Record<string, number> = {
  // Niche Mono T112 KANAN 20x10 Brushed Candy Gold.
  // Feed MSRP $306 is actually ~dealer cost; sibling Niche 1PC 20" wheels
  // (Misano/Verona/Gamma/Vosso) are $490. Matched to sibling MSRP. (2026-06-18)
  "T112200090+20": 490,
};

/**
 * Return the corrected MSRP for a SKU, or null if there is no override.
 * Case/format-insensitive on common SKU punctuation differences.
 */
export function getWheelMsrpOverride(sku?: string | null): number | null {
  if (!sku) return null;
  const direct = WHEEL_MSRP_OVERRIDES[sku];
  if (typeof direct === "number") return direct;
  // tolerate spacing/case differences
  const norm = sku.trim().toUpperCase();
  for (const [k, v] of Object.entries(WHEEL_MSRP_OVERRIDES)) {
    if (k.toUpperCase() === norm) return v;
  }
  return null;
}
