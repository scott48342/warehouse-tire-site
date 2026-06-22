/**
 * Shared YMM (Year/Make/Model) search helpers.
 *
 * Single source of truth for how every YMM entry point (header launcher +
 * homepage heroes, desktop and mobile) builds its canonical results URL and
 * decides when a trim selection is required.
 *
 * WHY THIS EXISTS:
 * Historically each picker built its own URL and trim logic inline. That drift
 * is exactly how the staggered/trim-gate bugs crept in separately. These helpers
 * keep all entry points behaviorally identical without changing any visual UI,
 * database, resolver, or API.
 *
 * CANONICAL PARAM CONTRACT:
 * - We standardize on `modification=<slug>` as the resolved vehicle identifier.
 *   The trims API returns `value` = a canonical slug (e.g.
 *   "2024-ford-f-150-king-ranch-64d6fb"), which is the cleanest internal id.
 * - Results pages (/tires, /wheels) already reconcile legacy `trim=<slug>` URLs
 *   via looksLikeModificationSlug(), so existing links keep working.
 * - We optionally also pass a human-readable `trim` LABEL for display only, but
 *   only when it is a real label (contains a space / not a slug), so it never
 *   collides with the modification slug resolution.
 */

export type YmmProductType = "tires" | "wheels" | "packages" | "vehicles";

export interface VehicleSearchInput {
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  /** The trim selector value. This is the canonical modification slug. */
  trimValue?: string | null;
  /** Optional human-readable trim label (e.g. "King Ranch") for display only. */
  trimLabel?: string | null;
  /** Destination intent. Defaults to "tires". */
  productType?: YmmProductType;
  /** Extra query params to merge (e.g. wheelSku carry-over, package flag). */
  extraParams?: Record<string, string | undefined>;
}

/** Returns the base path for a given product intent. */
export function vehicleSearchBasePath(productType?: YmmProductType): string {
  switch (productType) {
    case "wheels":
      return "/wheels";
    case "packages":
    case "vehicles":
      return "/wheels"; // package/vehicle flows land on /wheels (with package flag)
    case "tires":
    default:
      return "/tires";
  }
}

/**
 * Heuristic: does this string look like a canonical modification slug rather
 * than a display label? Mirrors the results-page reconciliation so the two
 * stay in lockstep.
 *
 * Slugs look like: "2024-ford-f-150-king-ranch-64d6fb" or "s_1a2b3c4d".
 * Labels look like: "King Ranch", "Lariat", "SS".
 */
export function looksLikeModificationSlug(s: string | null | undefined): boolean {
  if (!s) return false;
  if (/^s_[a-f0-9]{8}$/.test(s)) return true;
  if (/^manual_[a-f0-9]{6,}$/i.test(s)) return true; // manual_<hex> canonical ids
  if (/^[a-f0-9]{10}$/.test(s)) return true;
  if (/^\d{4}-[a-z0-9-]+-[a-f0-9]{4,}$/i.test(s)) return true;
  if (s.includes("-") && /[a-f0-9]{4,}$/i.test(s)) return true;
  return false;
}

/**
 * Build the canonical YMM results URL.
 *
 * Standardizes on `modification=<slug>`. If the provided trimValue is NOT a
 * slug (e.g. a plain label was passed), it falls back to `trim=<value>` so the
 * results page can still resolve it. A real display label is added as `trim`
 * only when it differs from the slug and is human-readable.
 */
export function buildVehicleSearchUrl(input: VehicleSearchInput): string {
  const {
    year,
    make,
    model,
    trimValue,
    trimLabel,
    productType = "tires",
    extraParams,
  } = input;

  const params = new URLSearchParams();
  if (year != null && year !== "") params.set("year", String(year));
  if (make) params.set("make", String(make));
  if (model) params.set("model", String(model));

  const tv = trimValue ? String(trimValue).trim() : "";
  if (tv) {
    if (looksLikeModificationSlug(tv)) {
      // Canonical: the selector value is the resolved modification slug.
      params.set("modification", tv);
      // Add a clean display label when available and distinct from the slug.
      if (trimLabel && trimLabel.trim() && trimLabel.trim() !== tv) {
        params.set("trim", trimLabel.trim());
      }
    } else {
      // Backward compatible: a plain label/value was passed; let the results
      // page resolve it via the trim param (it already handles this).
      params.set("trim", tv);
    }
  }

  // Package/vehicle intent carries the package flag like the legacy flows.
  if (productType === "packages" || productType === "vehicles") {
    params.set("package", "1");
  }

  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      if (v != null && v !== "") params.set(k, v);
    }
  }

  return `${vehicleSearchBasePath(productType)}?${params.toString()}`;
}

/**
 * Shared trim gate.
 *
 * When a model exposes more than one meaningful trim, fitment can be
 * trim-specific (especially staggered setups like Camaro SS/ZL1). In that case
 * we require a trim selection so we never search on model-aggregated data.
 *
 * Returns true when a trim MUST be selected before searching.
 */
export function shouldRequireTrim(
  trimsCount: number,
  selectedTrim: string | null | undefined,
): boolean {
  return trimsCount > 1 && !(selectedTrim && String(selectedTrim).trim());
}
