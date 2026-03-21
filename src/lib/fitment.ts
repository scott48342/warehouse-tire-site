import { extractDisplayTrim } from "./vehicleDisplay";

export type Fitment = {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  // Wheel-Size modification id/slug (trim-specific fitment)
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
