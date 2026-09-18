/**
 * Trim ambiguity detection (audit 2026-09-18, finding F7; rewritten per
 * fix-batch1-REQUIREMENTS R3).
 *
 * When a caller omits the trim, the certified rows for a year/make/model are
 * compared FIELD BY FIELD with tri-state results:
 *
 *   agree     every candidate has a value and all values are equal
 *   disagree  every candidate has a value and at least two differ
 *   unknown   at least one candidate is missing the value (or the candidate
 *             set was truncated) - unknown NEVER counts as agreement
 *
 * A vehicle is `certifiable` without a trim only when EVERY compared field is
 * `agree` (or there is exactly one candidate row). Partial agreement is
 * exposed as `sharedSpecs` for browsing, with `certifiable: false`.
 *
 * Pure functions only - no DB access - so they can be unit-tested with fixtures.
 */

export type FieldState = "agree" | "disagree" | "unknown";

export type AmbiguityField =
  | "boltPattern"
  | "centerBore"
  | "threadSize"
  | "oemWheelSizes"
  | "oemTireSizes"
  | "requiredLoadIndex"
  | "staggered";

export const DEFAULT_AMBIGUITY_FIELDS: AmbiguityField[] = [
  "boltPattern",
  "centerBore",
  "threadSize",
  "oemWheelSizes",
  "oemTireSizes",
  "requiredLoadIndex",
  "staggered",
];

export interface TrimCandidateInput {
  modificationId: string;
  displayTrim: string | null;
  boltPattern?: string | null;
  centerBoreMm?: number | string | null;
  threadSize?: string | null;
  /** Raw oem_wheel_sizes column: Array<string | {diameter,width,offset?,axle?|position?}> | null */
  oemWheelSizes?: unknown;
  /** Row-level offset range (used when wheel entries carry no offset) */
  offsetMinMm?: number | string | null;
  offsetMaxMm?: number | string | null;
  /** Raw oem_tire_sizes column: string[] | {front,rear} | null */
  oemTireSizes?: unknown;
  /** vehicle_fitments.oem_load_index (NOT verified OEM; see loadIndexGate) */
  requiredLoadIndex?: number | string | null;
}

export interface TrimCandidate {
  modificationId: string;
  displayTrim: string;
}

export interface SharedSpecs {
  boltPattern: string | null;
  centerBoreMm: number | null;
  threadSize: string | null;
  /** Normalized wheel-size keys (axle:diaxwidth@offset) when every trim agrees */
  oemWheelSizes: string[] | null;
  /** Normalized tire-size keys when every trim agrees */
  oemTireSizes: string[] | null;
  requiredLoadIndex: number | null;
  staggered: boolean | null;
}

export type AmbiguityResolution =
  | "single"        // exactly one candidate row - use it (existing behaviour)
  | "auto"          // >1 rows, every compared field agrees - safe to auto-select
  | "trim_required" // >1 rows, at least one field disagree/unknown
  | "error";        // assessment failed (DB error, truncated, no rows) - fail closed

export interface TrimAmbiguityResult {
  resolution: AmbiguityResolution;
  /** true when at least one compared field is `disagree` */
  ambiguous: boolean;
  /** true unless resolution is single/auto - the caller must ask for a trim */
  trimRequired: boolean;
  /** true only when every compared field agrees (or single row). Required for any fits:true / badge. */
  certifiable: boolean;
  fieldStates: Record<AmbiguityField, FieldState>;
  conflictingFields: AmbiguityField[];
  unknownFields: AmbiguityField[];
  agreedFields: AmbiguityField[];
  candidates: TrimCandidate[];
  /** Values for agreed fields only; null for disagree/unknown. Browsing only - never certification. */
  sharedSpecs: SharedSpecs;
  /** @deprecated alias of sharedSpecs (kept for callers written against the first draft) */
  shared: SharedSpecs;
  /** Candidate set exceeded the query limit - every field reported unknown */
  truncated: boolean;
  error?: string;
}

export interface AssessOptions {
  fields?: AmbiguityField[];
  /** Candidate rows were truncated by a query limit -> fail closed */
  truncated?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalizers
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeBoltPatternKey(bp: string | null | undefined): string | null {
  if (!bp) return null;
  const k = String(bp).toUpperCase().replace(/\s+/g, "").replace(/[×x]/g, "X");
  return k || null;
}

export function normalizeCenterBore(cb: number | string | null | undefined): number | null {
  if (cb == null || cb === "") return null;
  const n = typeof cb === "number" ? cb : parseFloat(String(cb));
  if (!Number.isFinite(n) || n <= 0) return null;
  // 0.1mm granularity is enough to compare 70.5 vs 63.4 while ignoring float noise
  return Math.round(n * 10) / 10;
}

export function normalizeThreadSizeKey(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const k = String(ts).toUpperCase().replace(/\s+/g, "").replace(/[×]/g, "X");
  return k || null;
}

export function normalizeLoadIndex(li: number | string | null | undefined): number | null {
  if (li == null || li === "") return null;
  const n = typeof li === "number" ? li : parseInt(String(li), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

interface ParsedTireSizes {
  keys: string[];
  /** true when front and rear sets are both present and differ */
  staggered: boolean | null;
}

/**
 * Normalize string[] | {front,rear} | string | null into sorted, deduped keys.
 * Object form prefixes axle (F:/R:) so a staggered set never equals a square one.
 * Returns null when no usable size is present.
 */
export function parseTireSizes(raw: unknown): ParsedTireSizes | null {
  const norm = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim().toUpperCase().replace(/\s+/g, "") : null;
  const toArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v != null ? [v] : []);

  if (Array.isArray(raw)) {
    const keys = [...new Set(raw.map(norm).filter((s): s is string => !!s))].sort();
    return keys.length ? { keys, staggered: false } : null;
  }
  if (raw && typeof raw === "object") {
    const o = raw as { front?: unknown; rear?: unknown };
    const front = [...new Set(toArr(o.front).map(norm).filter((s): s is string => !!s))].sort();
    const rear = [...new Set(toArr(o.rear).map(norm).filter((s): s is string => !!s))].sort();
    if (!front.length && !rear.length) return null;
    const keys = [...front.map((s) => `F:${s}`), ...rear.map((s) => `R:${s}`)];
    const staggered = front.length && rear.length ? front.join("|") !== rear.join("|") : null;
    return { keys, staggered };
  }
  if (typeof raw === "string") {
    const k = norm(raw);
    return k ? { keys: [k], staggered: false } : null;
  }
  return null;
}

/** @deprecated use parseTireSizes; kept for the first-draft callers/tests */
export function tireSizeSetKey(raw: unknown): string | null {
  const p = parseTireSizes(raw);
  return p ? p.keys.join("|") : null;
}

interface ParsedWheelSizes {
  keys: string[];
  /** false when any entry lacks diameter/width/offset (offset may come from the row range) */
  complete: boolean;
  staggered: boolean | null;
}

/**
 * Normalize oem_wheel_sizes entries to `axle:DIAxWIDTH@OFFSET` keys.
 * Entry offset wins; otherwise the row-level offset range (min..max) is used;
 * otherwise the entry is incomplete and the field must be reported unknown.
 */
export function parseWheelSizesForCompare(
  raw: unknown,
  offsetMinMm?: number | string | null,
  offsetMaxMm?: number | string | null
): ParsedWheelSizes | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rowMin = normNum(offsetMinMm);
  const rowMax = normNum(offsetMaxMm);
  const rowOffset = rowMin != null && rowMax != null ? (rowMin === rowMax ? String(rowMin) : `${rowMin}..${rowMax}`) : null;

  let complete = true;
  const keys: string[] = [];
  const byAxle: Record<string, string[]> = { front: [], rear: [], both: [] };

  for (const item of raw) {
    let diameter: number | null = null;
    let width: number | null = null;
    let offset: string | null = null;
    let axle: "front" | "rear" | "both" = "both";

    if (typeof item === "string") {
      const m = item.trim().match(/^(\d+(?:\.\d+)?)\s*[Jj]?\s*[xX]\s*(\d+(?:\.\d+)?)$/);
      if (m) {
        width = parseFloat(m[1]);
        diameter = parseFloat(m[2]);
      }
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      diameter = normNum(o.diameter ?? o.rimDiameter);
      width = normNum(o.width ?? o.rimWidth);
      const off = normNum(o.offset);
      offset = off != null ? String(off) : null;
      const ax = o.axle ?? o.position;
      axle = ax === "front" || ax === "rear" ? ax : "both";
    }

    if (diameter == null || width == null) {
      complete = false;
      continue;
    }
    if (offset == null) offset = rowOffset;
    if (offset == null) {
      complete = false;
      offset = "?";
    }
    const key = `${axle}:${diameter}x${width}@${offset}`;
    keys.push(key);
    byAxle[axle].push(`${diameter}x${width}@${offset}`);
  }

  if (keys.length === 0) return null;
  const front = byAxle.front.sort();
  const rear = byAxle.rear.sort();
  const staggered = front.length && rear.length ? front.join("|") !== rear.join("|") : front.length || rear.length ? true : false;
  return { keys: [...new Set(keys)].sort(), complete, staggered };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-row field keys
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the comparison key for a field on one row, or null when the value is missing. */
function fieldKey(row: TrimCandidateInput, field: AmbiguityField): string | null {
  switch (field) {
    case "boltPattern":
      return normalizeBoltPatternKey(row.boltPattern);
    case "centerBore": {
      const n = normalizeCenterBore(row.centerBoreMm);
      return n == null ? null : String(n);
    }
    case "threadSize":
      return normalizeThreadSizeKey(row.threadSize);
    case "oemWheelSizes": {
      const p = parseWheelSizesForCompare(row.oemWheelSizes, row.offsetMinMm, row.offsetMaxMm);
      return p && p.complete ? p.keys.join("|") : null;
    }
    case "oemTireSizes": {
      const p = parseTireSizes(row.oemTireSizes);
      return p ? p.keys.join("|") : null;
    }
    case "requiredLoadIndex": {
      const n = normalizeLoadIndex(row.requiredLoadIndex);
      return n == null ? null : String(n);
    }
    case "staggered": {
      // Staggered flag from tire sizes (front/rear object) or axle-tagged wheel entries.
      const t = parseTireSizes(row.oemTireSizes);
      if (t && t.staggered != null) return t.staggered ? "1" : "0";
      const w = parseWheelSizesForCompare(row.oemWheelSizes, row.offsetMinMm, row.offsetMaxMm);
      if (w && w.staggered != null) return w.staggered ? "1" : "0";
      // Plain string[] tire sizes with no axle info => square set
      if (t && Array.isArray(row.oemTireSizes)) return "0";
      return null;
    }
  }
}

function emptyShared(): SharedSpecs {
  return {
    boltPattern: null,
    centerBoreMm: null,
    threadSize: null,
    oemWheelSizes: null,
    oemTireSizes: null,
    requiredLoadIndex: null,
    staggered: null,
  };
}

function allStates(state: FieldState, fields: AmbiguityField[]): Record<AmbiguityField, FieldState> {
  const out = {} as Record<AmbiguityField, FieldState>;
  for (const f of DEFAULT_AMBIGUITY_FIELDS) out[f] = fields.includes(f) ? state : "unknown";
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a fail-closed result (used for DB errors, truncated candidate sets, or
 * any situation where the rows could not be compared).
 */
export function failClosedAmbiguity(
  reason: string,
  candidates: TrimCandidate[] = [],
  opts: { truncated?: boolean; fields?: AmbiguityField[] } = {}
): TrimAmbiguityResult {
  const fields = opts.fields ?? DEFAULT_AMBIGUITY_FIELDS;
  const shared = emptyShared();
  return {
    resolution: "error",
    ambiguous: false,
    trimRequired: true,
    certifiable: false,
    fieldStates: allStates("unknown", fields),
    conflictingFields: [],
    unknownFields: [...fields],
    agreedFields: [],
    candidates,
    sharedSpecs: shared,
    shared,
    truncated: opts.truncated === true,
    error: reason,
  };
}

/**
 * Assess whether the candidate rows can be used without an explicit trim.
 */
export function assessTrimAmbiguity(
  rows: TrimCandidateInput[],
  fieldsOrOptions: AmbiguityField[] | AssessOptions = DEFAULT_AMBIGUITY_FIELDS
): TrimAmbiguityResult {
  const options: AssessOptions = Array.isArray(fieldsOrOptions) ? { fields: fieldsOrOptions } : fieldsOrOptions;
  const fields = options.fields ?? DEFAULT_AMBIGUITY_FIELDS;

  const candidates: TrimCandidate[] = rows.map((r) => ({
    modificationId: r.modificationId,
    displayTrim: r.displayTrim || "Base",
  }));

  if (options.truncated) {
    return failClosedAmbiguity("candidate set truncated by query limit", candidates, { truncated: true, fields });
  }
  if (rows.length === 0) {
    return failClosedAmbiguity("no candidate rows", candidates, { fields });
  }

  const fieldStates = {} as Record<AmbiguityField, FieldState>;
  const conflictingFields: AmbiguityField[] = [];
  const unknownFields: AmbiguityField[] = [];
  const agreedFields: AmbiguityField[] = [];
  const shared = emptyShared();

  for (const field of DEFAULT_AMBIGUITY_FIELDS) {
    if (!fields.includes(field)) {
      fieldStates[field] = "unknown";
      continue;
    }
    const keys = rows.map((r) => fieldKey(r, field));
    let state: FieldState;
    if (keys.some((k) => k == null)) {
      state = "unknown";
    } else {
      state = new Set(keys as string[]).size === 1 ? "agree" : "disagree";
    }
    fieldStates[field] = state;

    if (state === "disagree") conflictingFields.push(field);
    else if (state === "unknown") unknownFields.push(field);
    else {
      agreedFields.push(field);
      const only = keys[0] as string;
      const first = rows[0];
      switch (field) {
        case "boltPattern":
          shared.boltPattern = first.boltPattern ?? null;
          break;
        case "centerBore":
          shared.centerBoreMm = parseFloat(only);
          break;
        case "threadSize":
          shared.threadSize = first.threadSize ?? null;
          break;
        case "oemWheelSizes":
          shared.oemWheelSizes = only.split("|");
          break;
        case "oemTireSizes":
          shared.oemTireSizes = only.split("|");
          break;
        case "requiredLoadIndex":
          shared.requiredLoadIndex = parseInt(only, 10);
          break;
        case "staggered":
          shared.staggered = only === "1";
          break;
      }
    }
  }

  // Exactly one candidate row: nothing to disagree with - existing behaviour.
  // (A grouped/canonical record that was exploded into >1 rows arrives here as
  // >1 rows and IS compared field by field.)
  if (rows.length === 1) {
    return {
      resolution: "single",
      ambiguous: false,
      trimRequired: false,
      certifiable: true,
      fieldStates,
      conflictingFields: [],
      unknownFields,
      agreedFields,
      candidates,
      sharedSpecs: shared,
      shared,
      truncated: false,
    };
  }

  const certifiable = conflictingFields.length === 0 && unknownFields.length === 0;
  const ambiguous = conflictingFields.length > 0;

  return {
    resolution: certifiable ? "auto" : "trim_required",
    ambiguous,
    trimRequired: !certifiable,
    certifiable,
    fieldStates,
    conflictingFields,
    unknownFields,
    agreedFields,
    candidates,
    sharedSpecs: shared,
    shared,
    truncated: false,
  };
}
