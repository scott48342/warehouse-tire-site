/**
 * Trim ambiguity detection (audit 2026-09-18, finding F7).
 *
 * When a caller omits the trim and the certified rows for a year/make/model
 * DISAGREE on bolt pattern, center bore, or OE tire-size set, we must not
 * silently pick one row (previously: 2024 BMW M4 -> "CS", 2020 Civic ->
 * "Si Coupe", 2023 Ram 1500 -> TRX-sized "Base").
 *
 * Pure functions only - no DB access - so they can be unit-tested with fixtures.
 */

export type AmbiguityField = "boltPattern" | "centerBore" | "tireSizes";

export interface TrimCandidateInput {
  modificationId: string;
  displayTrim: string | null;
  boltPattern?: string | null;
  centerBoreMm?: number | string | null;
  /** Raw oem_tire_sizes column: string[] | {front,rear} | null */
  oemTireSizes?: unknown;
}

export interface TrimCandidate {
  modificationId: string;
  displayTrim: string;
}

export interface TrimAmbiguityResult {
  /** true when >1 candidate rows and at least one checked field disagrees */
  ambiguous: boolean;
  /** Alias for ambiguous - the caller must ask for a trim */
  trimRequired: boolean;
  conflictingFields: AmbiguityField[];
  candidates: TrimCandidate[];
  /**
   * Fields on which every candidate agrees (non-null values only). Callers
   * that only care about one field (e.g. check-fitment -> bolt pattern) may
   * proceed when their field is here.
   */
  agreedFields: AmbiguityField[];
  /** Shared values for agreed fields (null when the field disagrees or is unknown everywhere) */
  shared: {
    boltPattern: string | null;
    centerBoreMm: number | null;
  };
}

export const DEFAULT_AMBIGUITY_FIELDS: AmbiguityField[] = ["boltPattern", "centerBore", "tireSizes"];

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

/** Flatten string[] | {front,rear} | null into a sorted, deduped, normalized key. */
export function tireSizeSetKey(raw: unknown): string | null {
  const sizes: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) sizes.push(v.trim().toUpperCase().replace(/\s+/g, ""));
  };
  if (Array.isArray(raw)) {
    raw.forEach(push);
  } else if (raw && typeof raw === "object") {
    const o = raw as { front?: unknown; rear?: unknown };
    const toArr = (v: unknown) => (Array.isArray(v) ? v : v != null ? [v] : []);
    toArr(o.front).forEach((s) => push(typeof s === "string" ? `F:${s}` : s));
    toArr(o.rear).forEach((s) => push(typeof s === "string" ? `R:${s}` : s));
  } else if (typeof raw === "string") {
    push(raw);
  }
  if (sizes.length === 0) return null;
  return [...new Set(sizes)].sort().join("|");
}

/**
 * Assess whether the candidate rows can be used without an explicit trim.
 * Null/unknown values are ignored when comparing (a row with no bolt pattern
 * does not create a conflict by itself).
 */
export function assessTrimAmbiguity(
  rows: TrimCandidateInput[],
  fields: AmbiguityField[] = DEFAULT_AMBIGUITY_FIELDS
): TrimAmbiguityResult {
  const candidates: TrimCandidate[] = rows.map((r) => ({
    modificationId: r.modificationId,
    displayTrim: r.displayTrim || "Base",
  }));

  const keysFor = (field: AmbiguityField): Set<string> => {
    const set = new Set<string>();
    for (const r of rows) {
      let k: string | null = null;
      if (field === "boltPattern") k = normalizeBoltPatternKey(r.boltPattern);
      else if (field === "centerBore") {
        const n = normalizeCenterBore(r.centerBoreMm);
        k = n == null ? null : String(n);
      } else k = tireSizeSetKey(r.oemTireSizes);
      if (k != null) set.add(k);
    }
    return set;
  };

  const conflictingFields: AmbiguityField[] = [];
  const agreedFields: AmbiguityField[] = [];
  const shared: TrimAmbiguityResult["shared"] = { boltPattern: null, centerBoreMm: null };

  for (const field of fields) {
    const keys = keysFor(field);
    if (keys.size > 1) {
      conflictingFields.push(field);
    } else if (keys.size === 1) {
      agreedFields.push(field);
      const only = [...keys][0];
      if (field === "boltPattern") {
        // Return the original spelling from the first row that has it
        shared.boltPattern = rows.find((r) => normalizeBoltPatternKey(r.boltPattern) === only)?.boltPattern ?? null;
      } else if (field === "centerBore") {
        shared.centerBoreMm = parseFloat(only);
      }
    }
  }

  // A single row (or a single grouped row) is never ambiguous.
  const ambiguous = rows.length > 1 && conflictingFields.length > 0;

  return {
    ambiguous,
    trimRequired: ambiguous,
    conflictingFields: ambiguous ? conflictingFields : [],
    candidates,
    agreedFields,
    shared,
  };
}
