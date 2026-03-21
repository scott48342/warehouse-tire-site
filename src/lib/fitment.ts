import { extractDisplayTrim } from "./vehicleDisplay";

export type Fitment = {
  year?: string;
  make?: string;
  model?: string;
  /**
   * @deprecated Use `modification` for fitment queries.
   * `trim` is retained for display labels only.
   * Will be removed in a future version.
   */
  trim?: string;
  /**
   * Canonical fitment identity (modificationId).
   * This is the ONLY field that should be used for fitment queries.
   * Format: "s_xxxxxxxx" (supplement hash) or hex API slug.
   */
  modification?: string;
};

/**
 * Build a user-facing vehicle label.
 * Filters out engine text like "5.7i" - only shows real trim names.
 */
export function fitmentLabel(f: Fitment) {
  // Clean trim - filter out engine text
  const cleanTrim = extractDisplayTrim(f.trim ?? "");
  const parts = [f.year, f.make, f.model, cleanTrim].filter(Boolean);
  return parts.length ? parts.join(" ") : "Select vehicle";
}
