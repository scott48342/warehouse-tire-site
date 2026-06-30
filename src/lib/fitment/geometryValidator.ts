/**
 * Wheel Geometry Validator
 *
 * OEM-relative position delta validation.
 * Replaces the generic offset range check with actual wheel-position geometry.
 *
 * Core calculation:
 *   backspacing = offset_mm + (width_in × 25.4 / 2)
 *   delta_backspacing = candidate_backspacing - oem_backspacing   (+ = more inboard = dangerous)
 *   delta_outboard    = candidate_outboard    - oem_outboard      (+ = more poke = aesthetic risk)
 *
 * Three profiles with asymmetric limits:
 *   - inboard is more dangerous (suspension/caliper contact)
 *   - outboard is mostly aesthetic (fender contact at lock)
 *
 * All customer-facing recommendations MUST have a resolved OEM offset.
 * Missing OEM offset → no wheels shown, vehicle added to audit queue.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type GeometryProfile = "conservative" | "daily_driver" | "aggressive";
export type VehicleClass = "car" | "suv" | "truck";

export interface WheelPosition {
  width_in: number;   // wheel width in inches
  offset_mm: number;  // ET offset in mm (positive = tucked, negative = poke)
}

export interface GeometryResult {
  // Raw deltas (always present)
  delta_backspacing_mm: number;   // + = wheel moved inward (toward strut/caliper) — DANGEROUS
  delta_outboard_mm: number;      // + = wheel moved outward (toward fender lip)
  delta_track_width_mm: number;   // both sides combined; negative = narrower track

  // Safety ceiling — exceeds ALL profiles, always excluded
  exceedsSafetyCeiling: boolean;

  // Per-profile results (set when vehicleClass is provided)
  vehicleClass?: VehicleClass;
  passesConservative?: boolean;
  passesDailyDriver?: boolean;
  passesAggressive?: boolean;

  // Which limit caused failure (for debug)
  failReason?: string;
}

/** Result when OEM offset is known and resolved */
export interface OemOffsetResolved {
  missing: false;
  offset_mm: number;    // midpoint or axle-specific value
  width_in: number;     // OEM wheel width in inches (for geometry calc)
  source: "db_range_midpoint" | "oem_wheel_sizes_axle";
}

/** Result when OEM offset cannot be determined */
export interface OemOffsetMissing {
  missing: true;
  source: "missing";
  reason: string;
}

export type OemOffsetResult = OemOffsetResolved | OemOffsetMissing;

// ─────────────────────────────────────────────────────────────────────────────
// THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────

/** Absolute hard ceiling — no profile may exceed these */
export const SAFETY_CEILING_INBOARD_MM  = 30;   // wheel back face moves 30mm+ toward strut
export const SAFETY_CEILING_OUTBOARD_MM = 75;   // wheel face moves 75mm+ toward fender

type AxisLimits = { max_inboard: number; max_outboard: number };

export const GEOMETRY_THRESHOLDS: Record<GeometryProfile, Record<VehicleClass, AxisLimits>> = {
  conservative: {
    // Exact replacement / daily commuter. Minimal visible stance change.
    car:   { max_inboard:  8, max_outboard: 10 },
    suv:   { max_inboard: 10, max_outboard: 15 },
    truck: { max_inboard: 12, max_outboard: 20 },
  },
  daily_driver: {
    // Standard aftermarket. Safe clearances, mild stance improvement acceptable.
    car:   { max_inboard: 12, max_outboard: 18 },
    suv:   { max_inboard: 15, max_outboard: 25 },
    truck: { max_inboard: 18, max_outboard: 35 },
  },
  aggressive: {
    // Enthusiast build. Wider range but hard safety ceiling still applies.
    car:   { max_inboard: 18, max_outboard: 35 },
    suv:   { max_inboard: 22, max_outboard: 50 },
    truck: { max_inboard: 25, max_outboard: 120 },  // negative offset lifted builds
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute wheel geometry deltas relative to OEM.
 *
 * @param candidate - The aftermarket wheel being evaluated
 * @param oem       - The OEM reference wheel (same vehicle)
 * @param vehicleClass - Optional: enables per-profile pass/fail fields
 */
export function computeWheelGeometry(
  candidate: WheelPosition,
  oem: WheelPosition,
  vehicleClass?: VehicleClass,
): GeometryResult {
  // backspacing: distance from back face of wheel to hub mounting face
  const candidateBackspacing = candidate.offset_mm + (candidate.width_in * 25.4 / 2);
  const oemBackspacing       = oem.offset_mm       + (oem.width_in       * 25.4 / 2);
  const delta_backspacing_mm = candidateBackspacing - oemBackspacing;

  // outboard: how far the wheel face extends beyond the hub
  const candidateOutboard = (candidate.width_in * 25.4 / 2) - candidate.offset_mm;
  const oemOutboard       = (oem.width_in       * 25.4 / 2) - oem.offset_mm;
  const delta_outboard_mm = candidateOutboard - oemOutboard;

  // track width change (both sides)
  const delta_track_width_mm = -delta_backspacing_mm * 2;

  // Safety ceiling
  const safetyInboard  = delta_backspacing_mm > SAFETY_CEILING_INBOARD_MM;
  const safetyOutboard = delta_outboard_mm    > SAFETY_CEILING_OUTBOARD_MM;
  const exceedsSafetyCeiling = safetyInboard || safetyOutboard;

  let failReason: string | undefined;
  if (safetyInboard)  failReason = `delta_backspacing ${delta_backspacing_mm.toFixed(1)}mm exceeds ${SAFETY_CEILING_INBOARD_MM}mm safety ceiling`;
  if (safetyOutboard) failReason = `delta_outboard ${delta_outboard_mm.toFixed(1)}mm exceeds ${SAFETY_CEILING_OUTBOARD_MM}mm safety ceiling`;

  const result: GeometryResult = {
    delta_backspacing_mm,
    delta_outboard_mm,
    delta_track_width_mm,
    exceedsSafetyCeiling,
    failReason,
  };

  if (vehicleClass) {
    result.vehicleClass = vehicleClass;
    const check = (profile: GeometryProfile): boolean => {
      if (exceedsSafetyCeiling) return false;
      const t = GEOMETRY_THRESHOLDS[profile][vehicleClass];
      const inboundOk  = delta_backspacing_mm <= t.max_inboard;
      const outboardOk = delta_outboard_mm    <= t.max_outboard;
      return inboundOk && outboardOk;
    };
    result.passesConservative = check("conservative");
    result.passesDailyDriver  = check("daily_driver");
    result.passesAggressive   = check("aggressive");
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// OEM OFFSET RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the OEM offset for a vehicle/axle.
 *
 * Priority:
 *   1. DB offset_min_mm / offset_max_mm midpoint (non-null → always use this)
 *   2. Axle-specific oem_wheel_sizes entry with an offset field (staggered only)
 *
 * Returns `missing: true` if neither is available.
 * Customer-facing code MUST treat missing as "no recommendations".
 */
export function resolveOemOffset(params: {
  offsetMinMm: number | string | null | undefined;
  offsetMaxMm: number | string | null | undefined;
  oemWheelSizes: Array<{
    diameter?: number;
    width?: number;
    offset?: number | null;
    axle?: "front" | "rear" | "both";
  }>;
  /** For staggered: which axle to resolve for */
  axle?: "front" | "rear";
  /**
   * When true and axle is specified: fail closed if no axle-specific offset found.
   * Use for staggered-capable vehicles where front/rear must be validated independently.
   * When false (default): fall back to DB range midpoint if axle-specific missing.
   */
  requireAxleSpecific?: boolean;
}): OemOffsetResult {
  const { offsetMinMm, offsetMaxMm, oemWheelSizes, axle } = params;

  // Helper: average width from a set of wheel specs
  const avgWidth = (specs: typeof oemWheelSizes): number | null => {
    const ws = specs.map(s => s.width ?? 0).filter(w => w > 0);
    return ws.length > 0 ? ws.reduce((a, b) => a + b, 0) / ws.length : null;
  };

  // ── Priority 2 first (only for staggered axles): axle-specific oem_wheel_sizes
  // Scott's requirement: "oem_wheel_sizes offset only if it is verified and axle-specific"
  if (axle) {
    const axleSpecs = oemWheelSizes.filter(
      s => s.offset != null && (s.axle === axle || s.axle === "both"),
    );
    if (axleSpecs.length > 0) {
      const offsets = axleSpecs.map(s => s.offset as number);
      const avgOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length;
      const w = avgWidth(axleSpecs) ?? avgWidth(oemWheelSizes) ?? 7;
      return {
        missing: false,
        offset_mm: avgOffset,
        width_in: w,
        source: "oem_wheel_sizes_axle",
      };
    }
    // No axle-specific offset found for this staggered axle
    if (params.requireAxleSpecific) {
      return {
        missing: true,
        source: "missing",
        reason: `No ${axle}-axle offset found in oem_wheel_sizes; staggered vehicle requires per-axle data — failing closed`,
      };
    }
  }

  // ── Priority 1: DB range midpoint
  const minNum = offsetMinMm != null ? Number(offsetMinMm) : NaN;
  const maxNum = offsetMaxMm != null ? Number(offsetMaxMm) : NaN;
  if (!isNaN(minNum) && !isNaN(maxNum)) {
    const midpoint = (minNum + maxNum) / 2;
    const w = avgWidth(oemWheelSizes) ?? 7;  // 7" is the narrow fallback — rarely reached
    return {
      missing: false,
      offset_mm: midpoint,
      width_in: w,
      source: "db_range_midpoint",
    };
  }

  // ── No OEM offset data
  return {
    missing: true,
    source: "missing",
    reason: `offset_min_mm / offset_max_mm are null for this vehicle${axle ? ` (${axle} axle)` : ""} and no axle-specific oem_wheel_sizes offset found`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE MAPPING
// ─────────────────────────────────────────────────────────────────────────────

/** Map the existing FitmentMode to a GeometryProfile */
export function mapModeToProfile(mode: string): GeometryProfile {
  switch (mode) {
    case "oem":             return "conservative";
    case "aftermarket_safe": return "daily_driver";
    case "aggressive":
    case "truck":
    default:                return "aggressive";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY-BASED FITMENT CLASS ADJUSTMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a geometry result and active profile, decide the fitment class adjustment.
 * Does NOT replace bolt-pattern / centerbore hard rules — only adds offset geometry.
 *
 * Returns:
 *   "excluded"  → geometry safety ceiling exceeded (hard exclusion)
 *   "extended"  → exceeds current profile but within aggressive (show with warning)
 *   "specfit"   → within daily_driver but outside conservative
 *   "surefit"   → within conservative
 *   null        → geometry not available; defer to existing classification
 */
export function geometryFitmentClass(
  geo: GeometryResult,
  vehicleClass: VehicleClass,
  profile: GeometryProfile,
): "excluded" | "extended" | "specfit" | "surefit" | null {
  if (!geo.passesConservative === undefined) return null; // geometry not computed per-class

  if (geo.exceedsSafetyCeiling) return "excluded";
  if (!geo.passesAggressive)    return "excluded";  // unsafe even for aggressive builds

  if (profile === "aggressive") {
    if (!geo.passesAggressive)   return "excluded";
    if (!geo.passesDailyDriver)  return "extended";
    if (!geo.passesConservative) return "specfit";
    return "surefit";
  }

  if (profile === "daily_driver") {
    if (!geo.passesDailyDriver)  return "extended"; // beyond daily_driver → extended (shown w/ caution)
    if (!geo.passesConservative) return "specfit";
    return "surefit";
  }

  // conservative
  if (!geo.passesConservative) return "excluded";
  return "surefit";
}
