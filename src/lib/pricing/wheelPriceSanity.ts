/**
 * Wheel Price Sanity (sibling-outlier guard)
 *
 * Problem: the WheelPros feed (SFTP *and* live API) sometimes lists DEALER COST
 * in the MSRP field for a SKU, so we'd sell that wheel at ~cost. There is no
 * separate cost/MAP field to detect it directly. But the corruption shows up as
 * a clear LOW OUTLIER vs sibling wheels of the same brand + diameter:
 *
 *   Niche 1PC 20": Kanan $306  vs  Misano/Verona/Gamma/Vosso $490  (ratio 0.62)
 *   American Racing: $195      vs  median $466                     (ratio 0.42)
 *
 * Legit budget brands cluster TIGHT (Petrol all $280-326, ratio ~0.98), so a
 * within-brand+diameter outlier test catches the corrupt SKUs without harming
 * budget brands.
 *
 * This builds a brand+diameter -> median MSRP index from the techfeed (loaded
 * in-memory already) and, when a wheel's MSRP is an implausibly low outlier vs
 * that median, returns the median as a corrected MSRP. The corrected value is
 * still fed through the normal pricing math (markup/derive), so we never sell
 * at the bogus near-cost number.
 *
 * Conservative by design:
 *  - only ACTS when there are enough siblings (>= MIN_SIBLINGS) to be confident
 *  - only ACTS when the MSRP is below OUTLIER_RATIO * median
 *  - never RAISES a price that's already at/above the median
 *
 * @created 2026-06-18
 */

import { getAllTechfeedWheels } from "@/lib/techfeed/wheels";

/** Need at least this many same brand+diameter wheels to trust the median. */
const MIN_SIBLINGS = 4;
/** MSRP below this fraction of the sibling median is treated as corrupt. */
const OUTLIER_RATIO = 0.75;

interface SiblingStats {
  median: number;
  count: number;
}

let indexPromise: Promise<Map<string, SiblingStats>> | null = null;
/** Synchronous handle to the built index (null until warmWheelSiblingIndex resolves). */
let indexReady: Map<string, SiblingStats> | null = null;

function keyOf(brandCd: string, diameter: number): string {
  return `${brandCd.trim().toUpperCase()}|${diameter}`;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Build (and cache) the brand+diameter -> {median, count} index from the
 * techfeed. Built lazily once per server instance.
 */
async function getSiblingIndex(): Promise<Map<string, SiblingStats>> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const idx = new Map<string, SiblingStats>();
      try {
        const wheels = await getAllTechfeedWheels();
        const buckets = new Map<string, number[]>();
        for (const w of wheels) {
          const brand = w.brand_cd || w.brand_desc;
          const diaNum = w.diameter ? Math.round(parseFloat(w.diameter)) : NaN;
          const msrp = w.msrp ? Number(w.msrp) : NaN;
          if (!brand || !Number.isFinite(diaNum) || !Number.isFinite(msrp) || msrp <= 1) continue;
          const k = keyOf(brand, diaNum);
          (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(msrp);
        }
        for (const [k, vals] of buckets) {
          idx.set(k, { median: median(vals), count: vals.length });
        }
      } catch {
        // leave index empty -> guard becomes a no-op
      }
      indexReady = idx;
      return idx;
    })();
  }
  return indexPromise;
}

/**
 * Warm the sibling index (call once, e.g. alongside techfeed warmup). After
 * this resolves, sanitizeWheelMsrpSync works without awaiting.
 */
export async function warmWheelSiblingIndex(): Promise<void> {
  await getSiblingIndex();
}

/**
 * Core outlier decision against a prebuilt index. Returns corrected MSRP (the
 * sibling median) when the value is an implausibly low outlier; otherwise the
 * original msrp.
 */
function decide(
  idx: Map<string, SiblingStats>,
  sku: string | null | undefined,
  brand: string,
  diaNum: number,
  msrp: number
): { msrp: number; corrected: boolean; siblingMedian?: number } {
  const stats = idx.get(keyOf(brand, diaNum));
  if (!stats || stats.count < MIN_SIBLINGS || stats.median <= 1) {
    return { msrp, corrected: false };
  }
  if (msrp < stats.median * OUTLIER_RATIO) {
    if (sku) {
      console.log(
        `[pricing] SIBLING_OUTLIER wheel ${sku}: MSRP ${msrp} < ${OUTLIER_RATIO} * sibling median ${stats.median} (${brand} ${diaNum}", n=${stats.count}) -> using median`
      );
    }
    return { msrp: Math.round(stats.median * 100) / 100, corrected: true, siblingMedian: stats.median };
  }
  return { msrp, corrected: false, siblingMedian: stats.median };
}

function normDiameter(diameter: number | string | null | undefined): number {
  return typeof diameter === "number"
    ? Math.round(diameter)
    : diameter
      ? Math.round(parseFloat(String(diameter)))
      : NaN;
}

/**
 * Synchronous sibling-outlier guard. Uses the prebuilt in-memory index; if the
 * index isn't warm yet it is a no-op (returns msrp unchanged) and kicks off a
 * background warm so subsequent calls work. Safe to call from sync pricing paths.
 */
export function sanitizeWheelMsrpSync(opts: {
  sku?: string | null;
  brandCd?: string | null;
  diameter?: number | string | null;
  msrp: number | null;
}): { msrp: number | null; corrected: boolean; siblingMedian?: number } {
  const { msrp } = opts;
  if (msrp === null || !Number.isFinite(msrp) || msrp <= 1) return { msrp, corrected: false };
  const brand = (opts.brandCd || "").toString();
  const diaNum = normDiameter(opts.diameter);
  if (!brand || !Number.isFinite(diaNum)) return { msrp, corrected: false };
  if (!indexReady) {
    // not warm yet -> kick off warm, act as no-op this time
    void getSiblingIndex();
    return { msrp, corrected: false };
  }
  return decide(indexReady, opts.sku, brand, diaNum, msrp);
}

/**
 * Given a wheel's brand/diameter/msrp, return a corrected MSRP when the value
 * looks like a corrupt low outlier vs its siblings; otherwise return the
 * original msrp unchanged. Returns null only if msrp itself is null.
 *
 * Best-effort and async (reads the in-memory techfeed index). Callers that
 * can't await may skip this and rely on the override table.
 */
export async function sanitizeWheelMsrp(opts: {
  sku?: string | null;
  brandCd?: string | null;
  diameter?: number | string | null;
  msrp: number | null;
}): Promise<{ msrp: number | null; corrected: boolean; siblingMedian?: number }> {
  const { msrp } = opts;
  if (msrp === null || !Number.isFinite(msrp) || msrp <= 1) {
    return { msrp, corrected: false };
  }
  const brand = (opts.brandCd || "").toString();
  const diaNum = normDiameter(opts.diameter);
  if (!brand || !Number.isFinite(diaNum)) return { msrp, corrected: false };

  const idx = await getSiblingIndex();
  return decide(idx, opts.sku, brand, diaNum, msrp);
}

/** Reset the cached index (e.g. after a techfeed refresh). */
export function resetWheelSiblingIndex(): void {
  indexPromise = null;
}
