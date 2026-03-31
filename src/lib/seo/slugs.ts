/**
 * SEO Slug Utilities
 * 
 * Convert between URL slugs and display names
 */

// ============================================================================
// Slug Generation
// ============================================================================

/**
 * Convert a display name to a URL-safe slug
 * "Ford F-150" → "ford-f-150"
 * "Mercedes-Benz" → "mercedes-benz"
 */
export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Convert a slug to display format
 * "ford-f-150" → "Ford F-150"
 * "mercedes-benz" → "Mercedes-Benz"
 */
export function fromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word, idx) => {
      // Keep numbers as-is
      if (/^\d+$/.test(word)) return word;
      // Known acronyms/special cases
      if (["gmc", "bmw", "ram", "amg", "gt", "hd", "ev", "suv"].includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      // Title case
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    // Fix common patterns
    .replace(/(\d+) Hd/gi, "$1 HD")
    .replace(/F (\d+)/gi, "F-$1")
    .replace(/(\d+) Super Duty/gi, "$1 Super Duty");
}

// ============================================================================
// Make/Model Display Names
// ============================================================================

const makeDisplayNames: Record<string, string> = {
  "mercedes": "Mercedes-Benz",
  "mercedes-benz": "Mercedes-Benz",
  "alfa-romeo": "Alfa Romeo",
  "land-rover": "Land Rover",
  "aston-martin": "Aston Martin",
  "rolls-royce": "Rolls-Royce",
  "bmw": "BMW",
  "gmc": "GMC",
  "ram": "RAM",
};

const modelDisplayNames: Record<string, string> = {
  "f-150": "F-150",
  "f-250": "F-250",
  "f-350": "F-350",
  "f-250-super-duty": "F-250 Super Duty",
  "f-350-super-duty": "F-350 Super Duty",
  "silverado-1500": "Silverado 1500",
  "silverado-2500hd": "Silverado 2500 HD",
  "silverado-3500hd": "Silverado 3500 HD",
  "sierra-1500": "Sierra 1500",
  "sierra-2500hd": "Sierra 2500 HD",
  "sierra-3500hd": "Sierra 3500 HD",
  "1500": "1500",
  "2500": "2500",
  "3500": "3500",
  "rav4": "RAV4",
  "rx-350": "RX 350",
  "nx-350": "NX 350",
  "cr-v": "CR-V",
  "hr-v": "HR-V",
  "cx-5": "CX-5",
  "cx-9": "CX-9",
  "cx-30": "CX-30",
  "cx-50": "CX-50",
  "q5": "Q5",
  "q7": "Q7",
  "x3": "X3",
  "x5": "X5",
  "glc": "GLC",
  "gle": "GLE",
  "model-3": "Model 3",
  "model-y": "Model Y",
  "model-s": "Model S",
  "model-x": "Model X",
  "mach-e": "Mach-E",
  "mustang-mach-e": "Mustang Mach-E",
  "grand-cherokee": "Grand Cherokee",
  "grand-cherokee-l": "Grand Cherokee L",
  "wrangler": "Wrangler",
  "4runner": "4Runner",
};

/**
 * Get display name for a make slug
 */
export function getMakeDisplay(slug: string): string {
  const lower = slug.toLowerCase();
  return makeDisplayNames[lower] || fromSlug(slug);
}

/**
 * Get display name for a model slug
 */
export function getModelDisplay(slug: string): string {
  const lower = slug.toLowerCase();
  return modelDisplayNames[lower] || fromSlug(slug);
}

// ============================================================================
// URL Building
// ============================================================================

/**
 * Build SEO URL path for a vehicle
 */
export function buildVehicleUrl(
  productType: "wheels" | "tires" | "packages",
  year: number | string,
  make: string,
  model: string,
  trim?: string | null
): string {
  const parts = [
    `/${productType}`,
    String(year),
    toSlug(make),
    toSlug(model),
  ];
  
  if (trim) {
    parts.push(toSlug(trim));
  }
  
  return parts.join("/");
}

/**
 * Build canonical URL (absolute)
 */
export function buildCanonicalUrl(
  productType: "wheels" | "tires" | "packages",
  year: number | string,
  make: string,
  model: string,
  trim?: string | null
): string {
  const path = buildVehicleUrl(productType, year, make, model, trim);
  return `https://shop.warehousetiredirect.com${path}`;
}
