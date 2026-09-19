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
 * IMPORTANT (per reviewer 2026-09-18):
 * - The sidebar minima are NOT verified OEM values. Field is `requiredLoadIndex`,
 *   NOT `oemMinLoadIndex`. Never label "OE"/"OEM"/"factory" in UI or API.
 * - Below required → EXCLUDE from packages, BLOCK fit-certified paths.
 * - Plain browse MAY show tire with incompatibility message, NO fit badge.
 * - Missing/unverified minimum → NO green badge (degrade to neutral state).
 *
 * Rules:
 * - Required minimum comes from the fitment record (unverified source).
 * - A tire's load index badge may be "119", "126/123" (LT single/dual),
 *   "119/116Q" etc. The SINGLE-wheel value (first number) is the one that
 *   applies to a normal (non-dually) fitment.
 * - Below required -> loadIndexOk:false, excluded from packages, no fit badge.
 * - Missing required or unparseable tire value -> loadIndexChecked:false,
 *   loadIndexOk:null, NO fit badge (fitBadgeAllowed:false, not true).
 */

export type FitBlockReason =
  | "load_index_below_required"
  | "load_index_unverified"
  | "trim_required"
  | "source_unverified"
  /** Mixed front/rear wheel diameters requested on a vehicle whose OE fitment is not staggered (audit L1). */
  | "aftermarket_stagger"
  /** Mixed front/rear diameters requested; OE record lists several rim sizes but does not say which axle is which (audit L1 follow-up). */
  | "stagger_unverified"
  /** Sizes searched are not this vehicle's OE sizes (plus/minus sizing, lifted, classic upsize, direct fallback). */
  | "oe_size_unmatched";

export interface LoadIndexAssessment {
  /** Parsed single-wheel load index of the tire (null when unknown) */
  loadIndex: number | null;
  /** Same as loadIndex (spec field name) */
  tireLoadIndex: number | null;
  /** Raw badge string as received (kept for display) */
  loadIndexRaw: string | null;
  /** Required minimum from vehicle record (null when record has none) */
  requiredLoadIndex: number | null;
  /**
   * Source of the required value. Today the only source is the vehicle record,
   * whose minima are NOT authority-verified and NOT axle-specific, so it is
   * always "vehicle_record_unverified" when present. Certification
   * (fitBadgeAllowed) requires a source listed in VERIFIED_LOAD_SOURCES.
   */
  requiredLoadIndexSource: RequiredLoadIndexSource | null;
  /** true = meets/exceeds required, false = below required, null = could not check */
  loadIndexOk: boolean | null;
  /** true only when both sides were known and compared */
  loadIndexChecked: boolean;
  /** Human-readable reason when loadIndexOk === false */
  loadIndexNote: string | null;
  /**
   * Whether a verified/guaranteed-fit badge may be shown for this tire.
   * true ONLY when the requirement comes from a verified source AND the tire
   * meets it. An unverified requirement can never certify fit, even when the
   * tire index is equal or higher (loadIndexOk stays true in that case -
   * compatibility and certification are separate outputs).
   */
  fitBadgeAllowed: boolean;
  /**
   * Whether this tire may be included in recommended/compatible packages.
   * false when loadIndexOk === false. true otherwise (including when unchecked).
   */
  packageEligible: boolean;
  /**
   * Reason code when packageEligible is false.
   */
  packageExclusionReason: "load_index_below_required" | "load_requirement_per_axle_unknown" | null;
  /**
   * Why no fit badge / certified path is allowed (null when fitBadgeAllowed).
   * `load_index_below_required` also blocks package/cart certified paths;
   * `load_index_unverified` and `trim_required` only block the badge.
   */
  fitBlockReason: FitBlockReason | null;
}

export type RequiredLoadIndexSource = "vehicle_record_unverified" | "verified_manufacturer";

/**
 * Sources that may certify fit. Empty-by-design today: no load requirement in
 * the DB has been verified against a manufacturer/Tire Guide authority. Add a
 * source here only when a verified column/provenance exists.
 */
export const VERIFIED_LOAD_SOURCES: ReadonlySet<RequiredLoadIndexSource> = new Set<RequiredLoadIndexSource>([
  "verified_manufacturer",
]);

export function isVerifiedLoadSource(source: RequiredLoadIndexSource | null | undefined): boolean {
  return source != null && VERIFIED_LOAD_SOURCES.has(source);
}

export interface LoadIndexGateOptions {
  /**
   * R3 trim gate. When false (trim omitted and certified trims do not fully
   * agree) NO fit badge may be shown regardless of load index.
   */
  certifiable?: boolean;
  /**
   * Why `certifiable` is false. "source_unverified" (2026-09-18, J2): the trim
   * resolved but its OE tire sizes have no approved-source provenance (e.g.
   * model-level US AutoForce list on a multi-trim vehicle). Default trim_required.
   */
  blockReason?: Exclude<FitBlockReason, "load_index_below_required" | "load_index_unverified">;
  /**
   * H5 interim (2026-09-19): the vehicle record holds ONE load index but its
   * OE fitment lists several tire sizes and/or a front/rear split, so that
   * number describes ONE of the OE tires, not a per-axle/per-size minimum.
   * Fail closed: no minimum is asserted, no badge, the tire is NOT
   * package-eligible, and the raw comparison against the stored value is
   * exposed ONLY as `recordLoadIndexComparison` (informational). It is never
   * used to reject a tire: a higher optional/rear OE rating would otherwise
   * falsely reject a valid front/other-size tire.
   */
  loadRequirementScope?: "single" | "per_axle_unknown";
}

export interface RequiredLoadIndexSpec {
  /** Single value applying to both axles (from vehicle_fitments.oem_load_index) */
  requiredLoadIndex?: number | string | null;
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
 * Resolve the required minimum for a given axle. Per-axle values win; otherwise
 * the single value applies. Returns null when the record has nothing usable.
 */
export function resolveRequiredLoadIndex(
  spec: RequiredLoadIndexSpec | null | undefined,
  axle: "front" | "rear" | "both" = "both"
): number | null {
  if (!spec) return null;
  const front = parseLoadIndex(spec.front as string | number | null | undefined);
  const rear = parseLoadIndex(spec.rear as string | number | null | undefined);
  const single = parseLoadIndex(spec.requiredLoadIndex as string | number | null | undefined);
  if (axle === "front") return front ?? single;
  if (axle === "rear") return rear ?? single;
  // "both": a square fitment must satisfy the more demanding axle
  if (front != null || rear != null) return Math.max(front ?? 0, rear ?? 0) || single;
  return single;
}

/** Compare one tire's load index against the required minimum. */
export function assessLoadIndex(
  tireLoadIndex: string | number | null | undefined,
  requiredLoadIndex: number | null | undefined,
  requiredLoadIndexSource: RequiredLoadIndexSource = "vehicle_record_unverified"
): LoadIndexAssessment {
  const raw = tireLoadIndex == null ? null : String(tireLoadIndex);
  const li = parseLoadIndex(tireLoadIndex);
  const required = requiredLoadIndex == null ? null : parseLoadIndex(requiredLoadIndex);
  const sourceVerified = isVerifiedLoadSource(requiredLoadIndexSource);

  // Case 1: No required minimum in record -> cannot verify fit, no badge
  if (required == null) {
    return {
      loadIndex: li,
      tireLoadIndex: li,
      loadIndexRaw: raw,
      requiredLoadIndex: null,
      requiredLoadIndexSource: null,
      loadIndexOk: null,
      loadIndexChecked: false,
      loadIndexNote: null,
      fitBadgeAllowed: false, // NO badge when we cannot verify
      packageEligible: true, // Can still appear in packages (unverified)
      packageExclusionReason: null,
      fitBlockReason: "load_index_unverified",
    };
  }

  // Case 2: Required minimum exists but tire load index unknown -> cannot verify
  if (li == null) {
    return {
      loadIndex: null,
      tireLoadIndex: null,
      loadIndexRaw: raw,
      requiredLoadIndex: required,
      requiredLoadIndexSource,
      loadIndexOk: null,
      loadIndexChecked: false,
      loadIndexNote: "Tire load rating unknown",
      fitBadgeAllowed: false, // NO badge when we cannot verify
      packageEligible: true, // Can still appear (unknown, not known-bad)
      packageExclusionReason: null,
      fitBlockReason: "load_index_unverified",
    };
  }

  // Case 3: Both known -> compare
  const ok = li >= required;
  // Certification requires BOTH: tire meets requirement AND the requirement is
  // from a verified source. Compatibility (loadIndexOk) is reported separately.
  const badge = ok && sourceVerified;
  return {
    loadIndex: li,
    tireLoadIndex: li,
    loadIndexRaw: raw,
    requiredLoadIndex: required,
    requiredLoadIndexSource,
    loadIndexOk: ok,
    loadIndexChecked: true,
    loadIndexNote: ok ? null : `Load rating ${li} is below the ${required} this vehicle requires`,
    fitBadgeAllowed: badge,
    packageEligible: ok, // EXCLUDE from packages when below required
    packageExclusionReason: ok ? null : "load_index_below_required",
    fitBlockReason: !ok ? "load_index_below_required" : badge ? null : "load_index_unverified",
  };
}

/**
 * Gate for fit-certified construction paths (add-to-package, package review,
 * add-to-cart as a vehicle-fitted item). Returns the reason code when the tire
 * MUST be blocked. Only a known-below-required load index blocks; unverified
 * data merely removes the badge (see fitBadgeAllowed).
 */
export function certifiedPathBlock(
  a: Pick<LoadIndexAssessment, "loadIndexOk">
): { blocked: true; reason: "load_index_below_required" } | { blocked: false; reason: null } {
  return a.loadIndexOk === false
    ? { blocked: true, reason: "load_index_below_required" }
    : { blocked: false, reason: null };
}

/** Fields merged onto API tire results so clients / retests can see the gate. */
export type LoadIndexResultFields = Pick<
  LoadIndexAssessment,
  | "loadIndex"
  | "requiredLoadIndex"
  | "requiredLoadIndexSource"
  | "loadIndexOk"
  | "loadIndexChecked"
  | "loadIndexNote"
  | "fitBadgeAllowed"
  | "packageEligible"
  | "packageExclusionReason"
  | "fitBlockReason"
  | "tireLoadIndex"
> & {
  /** Informational only (scope per_axle_unknown): how the tire compares to the raw single record value. Not a minimum. */
  recordLoadIndex?: number | null;
  recordLoadIndexComparison?: "below_record_value" | "meets_record_value" | "unknown" | null;
};

/**
 * Annotate a list of tire results in place (returns the same array).
 * Each item must expose `badges.loadIndex`; an optional `axle` field selects a
 * per-axle required minimum when `spec` carries front/rear values.
 */
export function annotateLoadIndex<
  T extends { badges?: { loadIndex?: string | null } | null; axle?: "front" | "rear" | "both" | null }
>(
  items: T[],
  spec: RequiredLoadIndexSpec | null | undefined,
  options: LoadIndexGateOptions = {}
): Array<T & LoadIndexResultFields> {
  const trimBlocked = options.certifiable === false;
  const blockReason: FitBlockReason = options.blockReason ?? "trim_required";
  const perAxleUnknown = options.loadRequirementScope === "per_axle_unknown";
  for (const item of items) {
    const recordValue = resolveRequiredLoadIndex(spec, item.axle ?? "both");
    let recordComparison: "below_record_value" | "meets_record_value" | "unknown" | null = null;
    let a: LoadIndexAssessment;
    if (perAxleUnknown) {
      // The stored value is NOT a minimum here. Assess with no requirement
      // (=> unchecked, no badge) and then fail closed on package eligibility.
      a = assessLoadIndex(item.badges?.loadIndex ?? null, null);
      const li = a.loadIndex;
      recordComparison = li == null || recordValue == null ? "unknown" : li >= recordValue ? "meets_record_value" : "below_record_value";
      a.loadIndexNote = "OE load index varies by tire size/axle on this vehicle; minimum not verified";
      a.fitBadgeAllowed = false;
      a.packageEligible = false;
      a.packageExclusionReason = "load_requirement_per_axle_unknown";
      a.fitBlockReason = "load_index_unverified";
    } else {
      a = assessLoadIndex(item.badges?.loadIndex ?? null, recordValue);
    }
    // Trim gate outranks the load-index reason unless the tire is known-below
    // (that reason also blocks certified paths and must stay visible).
    if (trimBlocked && a.loadIndexOk !== false) {
      a.fitBadgeAllowed = false;
      a.fitBlockReason = blockReason;
    }
    Object.assign(item, {
      loadIndex: a.loadIndex,
      tireLoadIndex: a.tireLoadIndex,
      fitBlockReason: a.fitBlockReason,
      requiredLoadIndex: a.requiredLoadIndex,
      requiredLoadIndexSource: a.requiredLoadIndexSource,
      loadIndexOk: a.loadIndexOk,
      loadIndexChecked: a.loadIndexChecked,
      loadIndexNote: a.loadIndexNote,
      fitBadgeAllowed: a.fitBadgeAllowed,
      packageEligible: a.packageEligible,
      packageExclusionReason: a.packageExclusionReason,
      ...(perAxleUnknown ? { recordLoadIndex: recordValue, recordLoadIndexComparison: recordComparison } : {}),
    });
  }
  return items as Array<T & LoadIndexResultFields>;
}

/**
 * Filter out tires that are NOT eligible for packages (loadIndexOk === false).
 * Returns a new array with only package-eligible tires.
 */
export function filterPackageEligible<T extends { packageEligible?: boolean }>(
  items: T[]
): T[] {
  return items.filter((item) => item.packageEligible !== false);
}

/**
 * Count how many tires failed the load-index gate.
 */
export function countLoadIndexFailures<T extends { loadIndexOk?: boolean | null }>(
  items: T[]
): { total: number; failed: number; passed: number; unchecked: number } {
  let failed = 0;
  let passed = 0;
  let unchecked = 0;
  for (const item of items) {
    if (item.loadIndexOk === false) failed++;
    else if (item.loadIndexOk === true) passed++;
    else unchecked++;
  }
  return { total: items.length, failed, passed, unchecked };
}
