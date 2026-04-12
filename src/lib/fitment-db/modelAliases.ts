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
 * Get all model names to search (input + aliases)
 * Returns array suitable for SQL IN clause or iteration.
 * 
 * @param model - User input model name
 * @returns Array of model names to try (input first, then aliases)
 */
export function getModelVariants(model: string): string[] {
  // Slugify the input (lowercase, hyphens for non-alphanumeric)
  const slugified = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  
  // Get aliases (these are RAW DB names, not normalized)
  const aliases = MODEL_ALIASES[slugified] || [];
  
  // Return input first (exact match wins), then aliases
  return [slugified, ...aliases];
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
