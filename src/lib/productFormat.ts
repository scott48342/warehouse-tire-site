/**
 * Product name formatting utilities
 * Cleans up supplier data for customer-facing display
 */

/**
 * Cleans product names from supplier feeds for display.
 * - Removes K&M's "/e" (economy tier) prefix
 * - Normalizes whitespace
 */
export function formatProductName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .replace(/\s*\/e\s+/gi, " ") // Remove "/e " prefix (K&M economy tier)
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Formats brand + model into a clean display name
 */
export function formatTireDisplayName(
  brand: string | null | undefined,
  model: string | null | undefined
): string {
  const cleanBrand = (brand || "").trim();
  const cleanModel = formatProductName(model);

  if (cleanBrand && cleanModel) {
    // If model already starts with brand name, don't duplicate
    if (cleanModel.toLowerCase().startsWith(cleanBrand.toLowerCase())) {
      return cleanModel;
    }
    return `${cleanBrand} ${cleanModel}`;
  }
  return cleanModel || cleanBrand || "Unknown Tire";
}
