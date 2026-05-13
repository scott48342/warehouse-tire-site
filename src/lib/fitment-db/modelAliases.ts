/**
 * Canonical Model Alias Configuration
 * 
 * SINGLE SOURCE OF TRUTH for model name aliases.
 * Import this in coverage.ts, profileService.ts, and getFitment.ts
 * 
 * Rules:
 * 1. Keys are URL-friendly slugs (what users might type)
 * 2. Values are RAW database model names (exact DB matches)
 * 3. Exact matches always win over aliases
 * 4. Aliases are tried in array order
 */

export const MODEL_ALIASES: Record<string, string[]> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // FORD SUPER DUTY
  // DB stores "f-250", "f-350", "f-450" (short form)
  // URLs/selectors often show "f-250-super-duty" (long form)
  // Map BOTH directions to ensure coverage
  // ═══════════════════════════════════════════════════════════════════════════
  "f-250": ["f-250-super-duty"],
  "f-250-super-duty": ["f-250"],  // Reverse alias - selector might send this
  "f-350": ["f-350-super-duty"],
  "f-350-super-duty": ["f-350"],  // Reverse alias
  "f-450": ["f-450-super-duty"],
  "f-450-super-duty": ["f-450"],  // Reverse alias

  // ═══════════════════════════════════════════════════════════════════════════
  // CHRYSLER 300
  // DB has both "300" and "300c" - bidirectional aliases
  // ═══════════════════════════════════════════════════════════════════════════
  "300": ["300c", "300s", "300m"],
  "300c": ["300"],

  // ═══════════════════════════════════════════════════════════════════════════
  // CHEVROLET HD TRUCKS
  // DB has multiple formats: silverado-2500hd, silverado-2500-hd, silverado-2500
  // Need bidirectional aliases for all common user inputs
  // ═══════════════════════════════════════════════════════════════════════════
  "silverado": ["silverado-1500"],
  "silverado-2500": ["silverado-2500hd", "silverado-2500-hd"],
  "silverado-2500hd": ["silverado-2500", "silverado-2500-hd"],  // Reverse alias
  "silverado-2500-hd": ["silverado-2500hd", "silverado-2500"],  // Reverse alias - fixes selector
  "silverado-3500": ["silverado-3500hd", "silverado-3500-hd"],
  "silverado-3500hd": ["silverado-3500", "silverado-3500-hd"],  // Reverse alias
  "silverado-3500-hd": ["silverado-3500hd", "silverado-3500"],  // Reverse alias - fixes selector

  // ═══════════════════════════════════════════════════════════════════════════
  // GMC HD TRUCKS  
  // Same bidirectional pattern as Chevrolet
  // ═══════════════════════════════════════════════════════════════════════════
  "sierra": ["sierra-1500"],
  "sierra-2500": ["sierra-2500hd", "sierra-2500-hd"],
  "sierra-2500hd": ["sierra-2500", "sierra-2500-hd"],  // Reverse alias
  "sierra-2500-hd": ["sierra-2500hd", "sierra-2500"],  // Reverse alias - fixes selector
  "sierra-3500": ["sierra-3500hd", "sierra-3500-hd"],
  "sierra-3500hd": ["sierra-3500", "sierra-3500-hd"],  // Reverse alias
  "sierra-3500-hd": ["sierra-3500hd", "sierra-3500"],  // Reverse alias - fixes selector

  // ═══════════════════════════════════════════════════════════════════════════
  // RAM TRUCKS
  // DB uses model numbers directly (1500, 2500, 3500)
  // ═══════════════════════════════════════════════════════════════════════════
  "ram": ["ram-1500"],
  "ram-2500": ["2500"],
  "ram-3500": ["3500"],
};

/**
 * GM HD TRUCK RICH MODEL PRIORITY
 * 
 * The "hd" variants (no hyphen) have richer trim data than "-hd" variants.
 * Always prioritize these in query order to get better trim options.
 */
const HD_RICH_PRIORITY: Record<string, string> = {
  "silverado-2500-hd": "silverado-2500hd",
  "silverado-3500-hd": "silverado-3500hd",
  "sierra-2500-hd": "sierra-2500hd",
  "sierra-3500-hd": "sierra-3500hd",
};

/**
 * Get all model names to search (input + aliases)
 * Returns array suitable for SQL IN clause or iteration.
 * 
 * IMPORTANT (2026-05-13 fix): DB stores model names in various formats:
 * - "f-150 lightning" (spaces)
 * - "Silverado 2500 HD" (title case with spaces)
 * - "tacoma" (lowercase)
 * 
 * The models API returns display names like "F-150 Lightning" which users
 * then send to trims API. We need to match both the original (with spaces)
 * and slugified (with hyphens) versions.
 * 
 * @param model - User input model name (e.g., "F-150 Lightning")
 * @returns Array of model names to try (prioritized for data richness)
 */
export function getModelVariants(model: string): string[] {
  // Preserve the original input (just lowercase) - this matches DB format with spaces
  const lowercased = model.toLowerCase().trim();
  
  // Slugify the input (lowercase, hyphens for non-alphanumeric)
  const slugified = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  
  // Get aliases (these are RAW DB names, not normalized)
  const aliases = MODEL_ALIASES[slugified] || [];
  
  // Check if this is an HD truck with sparse data - prioritize rich variant
  const richVariant = HD_RICH_PRIORITY[slugified];
  if (richVariant) {
    // Put rich variant FIRST, then original (with spaces), then slugified, then other aliases
    const others = aliases.filter(a => a !== richVariant);
    const variants = [richVariant, lowercased, slugified, ...others];
    // Dedupe while preserving order
    return [...new Set(variants)];
  }
  
  // Try original first (with spaces), then slugified, then aliases
  const variants = [lowercased, slugified, ...aliases];
  // Dedupe while preserving order
  return [...new Set(variants)];
}

/**
 * Check if a lookup used an alias (for logging)
 */
export function wasAliasUsed(requestedModel: string, foundModel: string): boolean {
  const slugified = requestedModel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slugified !== foundModel && (MODEL_ALIASES[slugified]?.includes(foundModel) ?? false);
}

/**
 * Get all defined aliases for documentation/audit
 */
export function getAllAliases(): Record<string, string[]> {
  return { ...MODEL_ALIASES };
}
