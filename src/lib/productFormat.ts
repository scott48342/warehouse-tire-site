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

/**
 * Cleans tire card display titles for customer-facing presentation.
 * 
 * This is a DISPLAY-ONLY transformation - does NOT modify raw product data.
 * Used when rendering tire result cards where:
 * - Brand is already shown separately above the title
 * - Load markers like "/sl" are noise in the title (SL = Standard Load, default for most tires)
 * 
 * Rules:
 * 1. Remove leading brand name if it matches the separately-displayed brand
 * 2. Remove "/sl", "/SL", "SL" load markers when used as title clutter
 * 3. Normalize spacing
 * 4. Preserve meaningful model text (don't over-strip)
 * 
 * Examples:
 * - "Lexani /sl Lxht-206" → "LXHT-206" (brand shown separately, /sl removed)
 * - "Thunderer /sl Rngr Highway Terrain" → "RNGR Highway Terrain"
 * - "Continental ExtremeContact DWS06 Plus" → "ExtremeContact DWS06 Plus"
 * - "Michelin Defender LTX M/S" → "Defender LTX M/S" (M/S is meaningful, kept)
 */
export function cleanTireDisplayTitle(
  title: string | null | undefined,
  brand: string | null | undefined
): string {
  if (!title) return "";
  
  let cleaned = String(title).trim();
  const brandLower = (brand || "").trim().toLowerCase();
  
  // 1. Remove leading brand name (case-insensitive) if it matches the brand
  // This handles: "Lexani /sl Lxht-206" → "/sl Lxht-206"
  if (brandLower && cleaned.toLowerCase().startsWith(brandLower)) {
    cleaned = cleaned.slice(brandLower.length).trim();
  }
  
  // 2. Remove "/sl" and "SL" load markers when they appear as title noise
  // Standard Load is the default - no need to show it
  // Patterns: "/sl", "/SL", leading "SL " (but not "SL" inside words like "Assurance")
  cleaned = cleaned
    .replace(/^\/sl\b/gi, "") // Leading "/sl"
    .replace(/\s+\/sl\b/gi, "") // " /sl" anywhere
    .replace(/^sl\s+/gi, "") // Leading "SL " (standalone)
    .trim();
  
  // 3. Also handle other common noisy load markers that clutter titles
  // "/xl" when redundant, but XL (Extra Load) is sometimes meaningful - keep if explicitly in specs
  // For now, only strip the most common noise: /sl
  
  // 4. Normalize spacing and clean up any resulting artifacts
  cleaned = cleaned
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/^[\/\-\s]+/, "") // Remove leading punctuation artifacts
    .trim();
  
  // 5. If we stripped everything, fall back to original (safety net)
  if (!cleaned) {
    return String(title).trim();
  }
  
  return cleaned;
}
