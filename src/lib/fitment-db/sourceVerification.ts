/**
 * Source verification gate (2026-09-18, audit J2/J4 follow-up).
 *
 * An exact database match is NOT a verified specification. `vehicle_fitments`
 * rows carry `certification_status = 'certified'` from the April 2026 schema-
 * completeness pass, which only proved that the fields were populated and
 * well-formed. Whether the VALUES came from an approved source is a separate,
 * per-field question answered by the provenance columns:
 *
 *   wheel_specs_source / wheel_specs_confidence   bolt pattern, bore, offsets, OE wheel sizes
 *   tire_sizes_source  / tire_sizes_confidence    OE tire sizes (+ tire_sizes_needs_trim_split)
 *   load_index_source                             oem_load_index / oem_speed_rating
 *   source                                        how the ROW was created (fallback provenance)
 *
 * Known regressions this gate exists for:
 *   - 2024 BMW M4: row from a web AI overview, wheel_specs_source NULL, bolt
 *     pattern disputed (5x120 on file). An exact trim match returned
 *     certifiable:true and Jake said "confirmed 5x120".
 *   - 2020 Ford F-150 Raptor: tire sizes are the model-level US AutoForce list
 *     (245/70R17 ... 315/70R17). Exact trim match returned certifiable:true and
 *     Jake presented 245/70R17 as a VERIFIED Raptor size.
 *
 * Rules (fail closed - anything not on an approved list is unverified):
 *   wheelSpecs  verified when wheel_specs_source is an approved cross-reference /
 *               print / operator source, OR (when NULL) the row itself came
 *               from an approved research source.
 *   tireSizes   verified when the source is trim-explicit (Tire Guide print), OR
 *               the source is model-level (US AutoForce GetVehicleOptions) AND
 *               the vehicle has exactly one trim row (model == trim) AND the
 *               import did not flag the row for a trim split. Model-level sizes
 *               on a multi-trim vehicle are "OE sizes for this model" - they
 *               may be browsed, never certified for a specific trim.
 *   loadIndex   verified when the source is a print, or US AutoForce with the
 *               tire sizes verified. 'usaf-max' (conflict resolved to the higher
 *               value across model sizes) is never verified.
 *
 * `certification_status`, `quality_tier` and `confidence_tag` are deliberately
 * NOT inputs: they describe completeness, not source accuracy.
 *
 * This is a RUNTIME gate. It writes nothing; the DB is untouched. When Scott
 * verifies a row against an approved source the provenance columns change and
 * the gate opens on its own. Source NAMES are internal - only the
 * verified/unverified state may leave the server (see toPublicSourceVerification).
 */

export type FieldVerification = "verified" | "unverified";
export type VerifiedField = "wheelSpecs" | "tireSizes" | "loadIndex";

/** How the tire-size list relates to the requested vehicle. */
export type TireSizesScope = "trim" | "model" | "none";

export interface SourceVerification {
  wheelSpecs: FieldVerification;
  tireSizes: FieldVerification;
  tireSizesScope: TireSizesScope;
  loadIndex: FieldVerification;
  /** true only when wheelSpecs AND tireSizes are verified */
  verified: boolean;
  unverifiedFields: VerifiedField[];
  /** INTERNAL provenance - never serialize into a public API response */
  internal: {
    rowSource: string | null;
    wheelSpecsSource: string | null;
    wheelSpecsConfidence: string | null;
    tireSizesSource: string | null;
    tireSizesConfidence: string | null;
    tireSizesNeedsTrimSplit: boolean;
    loadIndexSource: string | null;
    trimCount: number | null;
    reasons: string[];
  };
}

/** Public projection: states only, no source names. */
export interface PublicSourceVerification {
  wheelSpecs: FieldVerification;
  tireSizes: FieldVerification;
  tireSizesScope: TireSizesScope;
  loadIndex: FieldVerification;
  verified: boolean;
  unverifiedFields: VerifiedField[];
}

/** Minimal row shape (matches vehicle_fitments drizzle select; all optional so partial profiles work). */
export interface SourceVerificationRow {
  source?: string | null;
  wheelSpecsSource?: string | null;
  wheelSpecsConfidence?: string | null;
  tireSizesSource?: string | null;
  tireSizesConfidence?: string | null;
  tireSizesNeedsTrimSplit?: boolean | null;
  loadIndexSource?: string | null;
  boltPattern?: string | null;
  oemTireSizes?: unknown;
}

export interface SourceVerificationOptions {
  /**
   * Number of live trim rows for this year/make/model. Required to verify
   * model-level tire sizes (only when exactly 1). Unknown (undefined/null) is
   * treated as "more than one" - fail closed.
   */
  trimCount?: number | null;
}

// ---------------------------------------------------------------------------
// Approved source lists. Extend ONLY after Scott approves the source. Each
// entry is a literal value observed in the provenance columns.
// ---------------------------------------------------------------------------

/**
 * wheel_specs_source values that establish bolt pattern / bore / offset.
 * Not approved (observed, left unverified on purpose): "roadkill-xref" (third-
 * party list of unknown provenance), "audit-pass3-bolt-fix" (derived from the
 * roadkill disagreement pass), "reddit-correction-2026-09-16" (customer report).
 */
export const APPROVED_WHEEL_SPEC_SOURCES: ReadonlySet<string> = new Set([
  "xref:wheelpros",
  "wheelpros-xref",
  "scott+wheelpros-xref",
  "tireguide-pro",
  "scott",
  "fwr-spotcheck+platform",
]);

/**
 * Row `source` values trusted for wheel specs when wheel_specs_source is NULL.
 * tireguide-pro = Tire Guide Pro print; manual-research / tgp_solutions =
 * operator-corrected rows (MEMORY: treat like manual research).
 */
export const APPROVED_ROW_SOURCES_FOR_WHEEL_SPECS: ReadonlySet<string> = new Set([
  "tireguide-pro",
  "manual-research",
  "tgp_solutions",
]);

/** Trim/axle-explicit tire-size sources. */
export const TRIM_EXPLICIT_TIRE_SOURCES: ReadonlySet<string> = new Set(["tireguide-pro"]);

/** Model-level tire-size sources (US AutoForce GetVehicleOptions returns sizes per year/make/model). */
export const MODEL_LEVEL_TIRE_SOURCES: ReadonlySet<string> = new Set(["usaf", "usaf+reddit"]);

const LOW_CONFIDENCE = new Set(["LOW"]);

function norm(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s ? s : null;
}

export function assessSourceVerification(
  row: SourceVerificationRow | null | undefined,
  opts: SourceVerificationOptions = {}
): SourceVerification {
  const reasons: string[] = [];
  const rowSource = norm(row?.source);
  const wheelSpecsSource = norm(row?.wheelSpecsSource);
  const wheelSpecsConfidence = norm(row?.wheelSpecsConfidence)?.toUpperCase() ?? null;
  const tireSizesSource = norm(row?.tireSizesSource);
  const tireSizesConfidence = norm(row?.tireSizesConfidence)?.toUpperCase() ?? null;
  const tireSizesNeedsTrimSplit = row?.tireSizesNeedsTrimSplit === true;
  const loadIndexSource = norm(row?.loadIndexSource);
  const trimCount =
    typeof opts.trimCount === "number" && Number.isFinite(opts.trimCount) && opts.trimCount >= 0
      ? opts.trimCount
      : null;

  // --- wheel specs -----------------------------------------------------------
  let wheelSpecs: FieldVerification = "unverified";
  if (!row) {
    reasons.push("wheelSpecs: no row");
  } else if (wheelSpecsSource) {
    if (APPROVED_WHEEL_SPEC_SOURCES.has(wheelSpecsSource)) {
      if (wheelSpecsConfidence && LOW_CONFIDENCE.has(wheelSpecsConfidence)) {
        reasons.push(`wheelSpecs: approved source but LOW confidence`);
      } else {
        wheelSpecs = "verified";
      }
    } else {
      reasons.push(`wheelSpecs: source not on approved list`);
    }
  } else if (rowSource && APPROVED_ROW_SOURCES_FOR_WHEEL_SPECS.has(rowSource)) {
    wheelSpecs = "verified";
  } else {
    reasons.push(rowSource ? `wheelSpecs: no field provenance; row source not approved` : `wheelSpecs: no provenance`);
  }

  // --- tire sizes ------------------------------------------------------------
  let tireSizes: FieldVerification = "unverified";
  let tireSizesScope: TireSizesScope = "none";
  if (!row) {
    reasons.push("tireSizes: no row");
  } else if (!tireSizesSource) {
    reasons.push("tireSizes: no provenance");
  } else if (tireSizesConfidence && LOW_CONFIDENCE.has(tireSizesConfidence)) {
    tireSizesScope = TRIM_EXPLICIT_TIRE_SOURCES.has(tireSizesSource) ? "trim" : "model";
    reasons.push("tireSizes: LOW confidence");
  } else if (TRIM_EXPLICIT_TIRE_SOURCES.has(tireSizesSource)) {
    tireSizesScope = "trim";
    tireSizes = "verified";
  } else if (MODEL_LEVEL_TIRE_SOURCES.has(tireSizesSource)) {
    tireSizesScope = "model";
    if (tireSizesNeedsTrimSplit) {
      reasons.push("tireSizes: model-level source flagged for trim split");
    } else if (trimCount === 1) {
      tireSizes = "verified";
    } else {
      reasons.push(
        trimCount === null
          ? "tireSizes: model-level source; trim count unknown (fail closed)"
          : `tireSizes: model-level source on a ${trimCount}-trim vehicle; trim attribution unverified`
      );
    }
  } else {
    reasons.push("tireSizes: source not on approved list");
  }

  // --- load index ------------------------------------------------------------
  let loadIndex: FieldVerification = "unverified";
  if (!row || !loadIndexSource) {
    reasons.push("loadIndex: no provenance");
  } else if (loadIndexSource === "tireguide-pro") {
    loadIndex = "verified";
  } else if (loadIndexSource === "usaf") {
    if (tireSizes === "verified") loadIndex = "verified";
    else reasons.push("loadIndex: US AutoForce value inherits unverified tire sizes");
  } else {
    // "usaf-max" and anything unknown
    reasons.push(`loadIndex: source '${loadIndexSource}' is not a verified minimum`);
  }

  const unverifiedFields: VerifiedField[] = [];
  if (wheelSpecs !== "verified") unverifiedFields.push("wheelSpecs");
  if (tireSizes !== "verified") unverifiedFields.push("tireSizes");
  if (loadIndex !== "verified") unverifiedFields.push("loadIndex");

  return {
    wheelSpecs,
    tireSizes,
    tireSizesScope,
    loadIndex,
    verified: wheelSpecs === "verified" && tireSizes === "verified",
    unverifiedFields,
    internal: {
      rowSource,
      wheelSpecsSource,
      wheelSpecsConfidence,
      tireSizesSource,
      tireSizesConfidence,
      tireSizesNeedsTrimSplit,
      loadIndexSource,
      trimCount,
      reasons,
    },
  };
}

/** A gate that verifies nothing (used when no row/profile is available - fail closed). */
export function unverifiedSourceVerification(reason: string): SourceVerification {
  const sv = assessSourceVerification(null);
  sv.internal.reasons = [reason];
  return sv;
}

/** Strip internal provenance before the object leaves the server. */
export function toPublicSourceVerification(
  sv: SourceVerification | null | undefined
): PublicSourceVerification | null {
  if (!sv) return null;
  return {
    wheelSpecs: sv.wheelSpecs,
    tireSizes: sv.tireSizes,
    tireSizesScope: sv.tireSizesScope,
    loadIndex: sv.loadIndex,
    verified: sv.verified,
    unverifiedFields: [...sv.unverifiedFields],
  };
}

/** Convenience: the wheel-side gate (bolt pattern / bore / offsets). */
export function wheelSpecsVerified(sv: SourceVerification | null | undefined): boolean {
  return sv?.wheelSpecs === "verified";
}

/** Convenience: the tire-side gate (OE tire sizes for THIS trim). */
export function tireSizesVerified(sv: SourceVerification | null | undefined): boolean {
  return sv?.tireSizes === "verified";
}
