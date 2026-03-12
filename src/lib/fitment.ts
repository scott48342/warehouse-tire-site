export type Fitment = {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  // Wheel-Size modification id/slug (trim-specific fitment)
  modification?: string;
};

export function fitmentLabel(f: Fitment) {
  const parts = [f.year, f.make, f.model, f.trim].filter(Boolean);
  return parts.length ? parts.join(" ") : "Select vehicle";
}
