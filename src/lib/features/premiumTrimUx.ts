/**
 * Premium Trim UX Feature Flag
 * 
 * Controls the rollout of "Base"-free fitment experience:
 * - OFF: Current behavior unchanged
 * - ON: No "Base" labels, confident auto-selection for config vehicles,
 *       intentional fallback UX for non-config vehicles
 * 
 * This is a presentation-layer change only. No underlying logic changes.
 */

/**
 * Check if the premium trim UX is enabled.
 * 
 * Feature flag can be set via:
 * - NEXT_PUBLIC_ENABLE_PREMIUM_TRIM_UX=true (env variable)
 * - ?premiumTrimUx=1 (URL param for testing, client-side only)
 * 
 * @param searchParams Optional URL search params for testing override
 */
export function isPremiumTrimUxEnabled(searchParams?: URLSearchParams | Record<string, string | string[] | undefined>): boolean {
  // Check env variable first
  if (process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TRIM_UX === "true") {
    return true;
  }
  
  // Check URL param override (for testing)
  if (searchParams) {
    // Handle both URLSearchParams and Record types
    const paramValue = searchParams instanceof URLSearchParams 
      ? searchParams.get("premiumTrimUx")
      : Array.isArray(searchParams.premiumTrimUx) 
        ? searchParams.premiumTrimUx[0] 
        : searchParams.premiumTrimUx;
    
    if (paramValue === "1" || paramValue === "true") {
      return true;
    }
  }
  
  return false;
}

/**
 * Labels to use instead of "Base" when no specific trim is available.
 * Used when premium UX is enabled and we want to avoid "Base" label.
 */
export const FALLBACK_TRIM_LABELS = {
  // When we have config data but no specific trim
  CONFIG_DEFAULT: "Standard",
  
  // When user needs to select wheel size
  WHEEL_SIZE_PROMPT: "Select Your Wheel Size",
  
  // When displaying results without trim context
  NO_TRIM_NEEDED: null, // Don't show any trim
};

/**
 * Filter "Base" from trim options when premium UX is enabled.
 * 
 * @param trims Array of trim options
 * @param enabled Whether premium UX is enabled
 * @returns Filtered trims (empty array if only "Base" was present)
 */
export function filterBaseTrims<T extends { label: string }>(
  trims: T[],
  enabled: boolean
): T[] {
  if (!enabled) return trims;
  
  // Filter out trims with "Base" label
  return trims.filter(t => {
    const label = t.label.toLowerCase().trim();
    return label !== "base" && label !== "default" && label !== "standard";
  });
}

/**
 * Get the display label for a trim, with "Base" handling.
 * 
 * @param trimLabel The original trim label
 * @param enabled Whether premium UX is enabled
 * @returns Cleaned label (null if it was "Base" and premium UX is on)
 */
export function getCleanTrimLabel(
  trimLabel: string | null | undefined,
  enabled: boolean
): string | null {
  if (!trimLabel) return null;
  
  const lower = trimLabel.toLowerCase().trim();
  
  // When premium UX is enabled, don't show "Base" variants
  if (enabled) {
    if (lower === "base" || lower === "default" || lower === "unknown trim") {
      return null;
    }
  }
  
  return trimLabel;
}

/**
 * Check if a trim is effectively "Base" (aggregated/fallback data).
 */
export function isBaseTrim(trimLabel: string | null | undefined): boolean {
  if (!trimLabel) return true;
  
  const lower = trimLabel.toLowerCase().trim();
  return (
    lower === "base" || 
    lower === "default" || 
    lower === "standard" ||
    lower === "unknown trim" ||
    lower === ""
  );
}
