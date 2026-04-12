/**
 * Model Name Normalization for Fitment Data
 * 
 * Provides canonical name resolution WITHOUT destructive database changes.
 * Used by fill scripts to find donors across variant model names.
 * 
 * IMPORTANT: This does NOT rename data. It enables lookup across variants.
 */

// ═══════════════════════════════════════════════════════════════════════════
// MODEL ALIAS MAP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps variant model names to their canonical form.
 * Key: variant name (lowercase)
 * Value: canonical name (lowercase)
 * 
 * Rules:
 * - Prefer the form with more records in the database
 * - Prefer the form used in official naming (e.g., "2500HD" not "2500-HD")
 */
export const MODEL_ALIASES: Record<string, string> = {
  // Chevrolet Silverado HD variants
  "silverado-2500-hd": "silverado-2500hd",
  "silverado-3500-hd": "silverado-3500hd",
  "silverado-3500": "silverado-3500hd",  // Normalize bare "3500" to "3500hd"
  
  // GMC Sierra HD variants
  "sierra-2500-hd": "sierra-2500hd",
  "sierra-3500-hd": "sierra-3500hd",
  "sierra-3500": "sierra-3500hd",  // Normalize bare "3500" to "3500hd"
  
  // Ford Super Duty variants (for future)
  "f-250-super-duty": "f-250",
  "f-350-super-duty": "f-350",
  "f250": "f-250",
  "f350": "f-350",
  "f150": "f-150",
  
  // Other common variants
  "ram-1500": "1500",  // Dodge Ram → Ram 1500
  "ram-2500": "2500",
  "ram-3500": "3500",
};

/**
 * Reverse map: canonical → all variants (including itself)
 */
export const CANONICAL_VARIANTS: Record<string, string[]> = {
  "silverado-2500hd": ["silverado-2500hd", "silverado-2500-hd"],
  "silverado-3500hd": ["silverado-3500hd", "silverado-3500-hd", "silverado-3500"],
  "sierra-2500hd": ["sierra-2500hd", "sierra-2500-hd"],
  "sierra-3500hd": ["sierra-3500hd", "sierra-3500-hd", "sierra-3500"],
  "f-250": ["f-250", "f-250-super-duty", "f250"],
  "f-350": ["f-350", "f-350-super-duty", "f350"],
  "1500": ["1500", "ram-1500"],
  "2500": ["2500", "ram-2500"],
  "3500": ["3500", "ram-3500"],
};

// ═══════════════════════════════════════════════════════════════════════════
// NORMALIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the canonical model name for a given variant.
 * Returns the input unchanged if no alias exists.
 */
export function normalizeModel(model: string): string {
  const lower = model.toLowerCase();
  return MODEL_ALIASES[lower] || lower;
}

/**
 * Get all variant names for a model (for donor lookup).
 * Returns array including the input and any known aliases.
 */
export function getModelVariants(model: string): string[] {
  const lower = model.toLowerCase();
  const canonical = normalizeModel(lower);
  
  // Check if this canonical has known variants
  if (CANONICAL_VARIANTS[canonical]) {
    return CANONICAL_VARIANTS[canonical];
  }
  
  // Check if input is itself a canonical
  if (CANONICAL_VARIANTS[lower]) {
    return CANONICAL_VARIANTS[lower];
  }
  
  // No known aliases, return just the input
  return [lower];
}

/**
 * Check if two model names should be considered the same vehicle.
 */
export function modelsMatch(model1: string, model2: string): boolean {
  return normalizeModel(model1) === normalizeModel(model2);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAKE + MODEL NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Some makes have changed over time (Dodge Ram → Ram)
 */
export const MAKE_ALIASES: Record<string, string> = {
  // Ram trucks split from Dodge in 2010
  // Keep both for lookups
};

/**
 * Get cross-make lookup pairs for certain models.
 * E.g., 2008 Dodge Ram 2500 → can look at Ram 2500 data
 */
export function getCrossMakeLookups(make: string, model: string): Array<{make: string, model: string}> {
  const lower = model.toLowerCase();
  const results: Array<{make: string, model: string}> = [];
  
  // Dodge/Ram crossover (2010 split)
  if (make.toLowerCase() === 'dodge' && lower.match(/ram-?(1500|2500|3500)/)) {
    const number = lower.match(/(1500|2500|3500)/)?.[0];
    if (number) {
      results.push({ make: 'ram', model: number });
    }
  }
  
  if (make.toLowerCase() === 'ram') {
    const number = lower.match(/(1500|2500|3500)/)?.[0];
    if (number) {
      results.push({ make: 'dodge', model: `ram-${number}` });
    }
  }
  
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// SQL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate SQL WHERE clause for model matching with variants.
 * Returns a condition like: model IN ('sierra-2500hd', 'sierra-2500-hd')
 */
export function getModelMatchSQL(model: string): { sql: string; values: string[] } {
  const variants = getModelVariants(model);
  const placeholders = variants.map((_, i) => `$${i + 1}`).join(', ');
  return {
    sql: `model IN (${placeholders})`,
    values: variants,
  };
}

// For CommonJS compatibility
if (typeof module !== 'undefined') {
  module.exports = {
    MODEL_ALIASES,
    CANONICAL_VARIANTS,
    normalizeModel,
    getModelVariants,
    modelsMatch,
    MAKE_ALIASES,
    getCrossMakeLookups,
    getModelMatchSQL,
  };
}
