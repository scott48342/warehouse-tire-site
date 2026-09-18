/**
 * Load-index gating (audit 2026-09-18, finding C2 / F3).
 *
 * BEFORE: `vehicle_fitments.oem_load_index` was displayed in the sidebar
 * ("Minimum Tire Load Index: 119") but nothing compared a tire's load index
 * against it - 110T tires carried "Guaranteed Fit" on a 2020 Raptor.
 *
 * This module is pure (no DB / no fetch) so it can be unit-tested with fixtures
 * and reused by tires/search, staggered-search and the package builder.
 *
 * Rules:
 * - OE minimum comes from the fitment record. Per-axle minimums are supported
 *   when the caller has them; otherwise a single value applies to both axles.
 * - A tire's load index badge may be "119", "126/123" (LT single/dual),
 *   "119/116Q" etc. The SINGLE-wheel value (first number) is the one that
 *   applies to a normal (non-dually) fitment.
 * - Below OE minimum -> loadIndexOk:false, badge downgraded, tire is KEPT in
 *   results (visible warning, not deletion).
 * - Missing OE minimum or unparseable tire value -> loadIndexChecked:false,
 *   loadIndexOk:null, badge unchanged.
 */

export interface LoadIndexAssessment {
  /** Parsed single-wheel load index of the tire (null when unknown) */
  loadIndex: number | null;
  /** Raw badge string as received (kept for display) */
  loadIndexRaw: string | null;
  /** OE minimum applied for this comparison (null when the record has none) */
  oemMinLoadIndex: number | null;
  /** true = meets/exceeds OE, false = below OE, null = could not check */
  loadIndexOk: boolean | null;
  /** true only when both sides were known and compared */
  loadIndexChecked: boolean;
  /** Human-readable reason when loadIndexOk === false */
  loadIndexNote: string | null;
  /** Whether a verified/guaranteed-fit badge may be shown for this tire */
  fitBadgeAllowed: boolean;
}

export interface OemLoadIndexSpec {
  /** Single value applying to both axles */
  oemLoadIndex?: number | string | null;
  /** Optional per-axle values (take precedence when present) */
  front?: number | string | null;
  rear?: number | string | null;
}

/**
 * Parse a tire load-index badge into its single-wheel numeric value.
 *   "119"      -> 119
 *   "126/123"  -> 126   (LT single/dual: single applies to SRW fitment)
 *   "119/116Q" -> 119
 *   "110T"     -> 110
 *   "XL" / "" / null -> null
 */
export function parseLoadIndex(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : null;
  const m = String(raw).trim().match(/(\d{2,3})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  // Real-world load indices run ~60..130
  if (!Number.isFinite(n) || n < 50 || n > 160) return null;
  return n;
}

/**
 * Resolve the OE minimum for a given axle. Per-axle values win; otherwise the
 * single value applies. Returns null when the record has nothing usable.
 */
export function resolveOemMinLoadIndex(
  spec: OemLoadIndexSpec | null | undefined,
  axle: "front" | "rear" | "both" = "both"
): number | null {
  if (!spec) return null;
  const front = parseLoadIndex(spec.front as string | number | null | undefined);
  const rear = parseLoadIndex(spec.rear as string | number | null | undefined);
  const single = parseLoadIndex(spec.oemLoadIndex as string | number | null | undefined);
  if (axle === "front") return front ?? single;
  if (axle === "rear") return rear ?? single;
  // "both": a square fitment must satisfy the more demanding axle
  if (front != null || rear != null) return Math.max(front ?? 0, rear ?? 0) || single;
  return single;
}

/** Compare one tire's load index against the OE minimum. */
export function assessLoadIndex(
  tireLoadIndex: string | number | null | undefined,
  oemMinLoadIndex: number | null | undefined
): LoadIndexAssessment {
  const raw = tireLoadIndex == null ? null : String(tireLoadIndex);
  const li = parseLoadIndex(tireLoadIndex);
  const oem = oemMinLoadIndex == null ? null : parseLoadIndex(oemMinLoadIndex);

  if (oem == null || li == null) {
    return {
      loadIndex: li,
      loadIndexRaw: raw,
      oemMinLoadIndex: oem,
      loadIndexOk: null,
      loadIndexChecked: false,
      loadIndexNote: null,
      fitBadgeAllowed: true, // unchanged behaviour when we cannot check
    };
  }

  const ok = li >= oem;
  return {
    loadIndex: li,
    loadIndexRaw: raw,
    oemMinLoadIndex: oem,
    loadIndexOk: ok,
    loadIndexChecked: true,
    loadIndexNote: ok ? null : `Load rating below OE (${li} < ${oem})`,
    fitBadgeAllowed: ok,
  };
}

/** Fields merged onto API tire results so clients / retests can see the gate. */
export type LoadIndexResultFields = Pick<
  LoadIndexAssessment,
  "loadIndex" | "oemMinLoadIndex" | "loadIndexOk" | "loadIndexChecked" | "loadIndexNote" | "fitBadgeAllowed"
>;

/**
 * Annotate a list of tire results in place (returns the same array).
 * Each item must expose `badges.loadIndex`; an optional `axle` field selects a
 * per-axle OE minimum when `spec` carries front/rear values.
 */
export function annotateLoadIndex<
  T extends { badges?: { loadIndex?: string | null } | null; axle?: "front" | "rear" | "both" | null }
>(items: T[], spec: OemLoadIndexSpec | null | undefined): Array<T & LoadIndexResultFields> {
  for (const item of items) {
    const oem = resolveOemMinLoadIndex(spec, item.axle ?? "both");
    const a = assessLoadIndex(item.badges?.loadIndex ?? null, oem);
    Object.assign(item, {
      loadIndex: a.loadIndex,
      oemMinLoadIndex: a.oemMinLoadIndex,
      loadIndexOk: a.loadIndexOk,
      loadIndexChecked: a.loadIndexChecked,
      loadIndexNote: a.loadIndexNote,
      fitBadgeAllowed: a.fitBadgeAllowed,
    });
  }
  return items as Array<T & LoadIndexResultFields>;
}
