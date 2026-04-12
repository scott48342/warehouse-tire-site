/**
 * Wheel Diameter Filter for Tire Sizes
 * 
 * Extracts wheel diameter from tire sizes and filters to show only
 * sizes matching the user's selected wheel diameter.
 * 
 * CRITICAL: Prevents showing 24" tire sizes to users with 22" wheels.
 * 
 * Usage:
 * 1. Extract available diameters from OEM tire sizes
 * 2. If multiple diameters exist, prompt user to select
 * 3. Filter tire sizes to only show matching diameter
 */

/**
 * Extract rim diameter (wheel size in inches) from a tire size string.
 * 
 * Handles formats:
 * - Standard metric: "275/55R20" → 20
 * - With P prefix: "P275/55R20" → 20
 * - With speed rating: "275/55ZR20" → 20
 * - Flotation: "35x12.50R22" → 22
 * - Half sizes: "265/70R17.5" → 17 (rounds down)
 * 
 * @returns Diameter in inches, or null if not parseable
 */
export function extractRimDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  
  const s = tireSize.toUpperCase().trim();
  
  // Standard metric: P?###/##?R## or ###/##ZR##
  const metricMatch = s.match(/R(\d{2}(?:\.\d)?)/);
  if (metricMatch) {
    return Math.floor(parseFloat(metricMatch[1]));
  }
  
  // Flotation: ##x##.##R##
  const flotationMatch = s.match(/X[\d.]+R(\d{2})/);
  if (flotationMatch) {
    return parseInt(flotationMatch[1], 10);
  }
  
  return null;
}

/**
 * Get unique wheel diameters from a list of tire sizes.
 * Sorted ascending (e.g., [20, 22, 24]).
 */
export function getAvailableWheelDiameters(tireSizes: string[]): number[] {
  const diameters = new Set<number>();
  
  for (const size of tireSizes) {
    const diameter = extractRimDiameter(size);
    if (diameter !== null) {
      diameters.add(diameter);
    }
  }
  
  return Array.from(diameters).sort((a, b) => a - b);
}

/**
 * Check if multiple wheel diameters exist in the tire sizes.
 * When true, user should be prompted to select their wheel size.
 */
export function hasMultipleWheelDiameters(tireSizes: string[]): boolean {
  return getAvailableWheelDiameters(tireSizes).length > 1;
}

/**
 * Filter tire sizes to only those matching a specific wheel diameter.
 * 
 * @param tireSizes - Array of tire size strings (e.g., ["275/55R20", "285/40R24"])
 * @param wheelDiameter - Target wheel diameter in inches (e.g., 20)
 * @returns Filtered array containing only sizes for that wheel diameter
 */
export function filterTireSizesByDiameter(
  tireSizes: string[],
  wheelDiameter: number
): string[] {
  return tireSizes.filter(size => {
    const diameter = extractRimDiameter(size);
    return diameter === wheelDiameter;
  });
}

/**
 * Create a display label for a wheel diameter.
 * e.g., 20 → '20" Wheels', 22 → '22" Wheels'
 */
export function getWheelDiameterLabel(diameter: number): string {
  return `${diameter}" Wheels`;
}

/**
 * Analyze tire sizes and return info about wheel diameter options.
 * 
 * This is the main function to call when displaying tire sizes.
 * 
 * @returns Analysis result with:
 * - needsSelection: true if user must choose a wheel diameter
 * - availableDiameters: list of wheel sizes available
 * - defaultDiameter: suggested default (smallest OEM size)
 */
export function analyzeTireSizeOptions(tireSizes: string[]): {
  needsSelection: boolean;
  availableDiameters: number[];
  defaultDiameter: number | null;
  tireSizesByDiameter: Map<number, string[]>;
} {
  const availableDiameters = getAvailableWheelDiameters(tireSizes);
  
  // Build map of tire sizes by diameter for quick lookup
  const tireSizesByDiameter = new Map<number, string[]>();
  for (const diameter of availableDiameters) {
    tireSizesByDiameter.set(diameter, filterTireSizesByDiameter(tireSizes, diameter));
  }
  
  return {
    needsSelection: availableDiameters.length > 1,
    availableDiameters,
    defaultDiameter: availableDiameters.length > 0 ? availableDiameters[0] : null,
    tireSizesByDiameter,
  };
}

// ============================================================================
// Export for testing
// ============================================================================

export const __test = {
  extractRimDiameter,
  getAvailableWheelDiameters,
  filterTireSizesByDiameter,
};
