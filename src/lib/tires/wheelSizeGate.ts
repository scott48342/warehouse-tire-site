/**
 * Wheel Size Gate Logic
 * 
 * Determines when a user needs to select their wheel size before seeing tire results.
 * Separated from the UI component so it can be used in Server Components.
 */

/**
 * Check if wheel size selection is needed for tire results.
 * 
 * Rules:
 * - If selected trim has exactly 1 valid OEM wheel diameter → auto-select, no prompt
 * - If selected trim has 2+ valid OEM wheel diameters → require explicit selection
 * 
 * @param oemWheelDiameters - Array of OEM wheel diameters for the selected trim
 * @param currentWheelDia - Currently selected wheel diameter (from URL param)
 * @returns true if user must select a wheel size before seeing results
 */
export function needsWheelSizeSelection(
  oemWheelDiameters: number[],
  currentWheelDia: number | null
): boolean {
  // No diameters = no data, don't gate
  if (!oemWheelDiameters || oemWheelDiameters.length === 0) {
    return false;
  }
  
  // Single diameter = auto-select, no prompt needed
  if (oemWheelDiameters.length === 1) {
    return false;
  }
  
  // Multiple diameters + no selection = need selection
  if (!currentWheelDia) {
    return true;
  }
  
  // Check if current selection is valid
  const isValidSelection = oemWheelDiameters.includes(currentWheelDia);
  return !isValidSelection;
}

/**
 * Get the auto-selected wheel diameter for single-diameter trims.
 * Returns null if multiple diameters exist (user must choose).
 */
export function getAutoSelectedWheelDia(oemWheelDiameters: number[]): number | null {
  if (!oemWheelDiameters || oemWheelDiameters.length === 0) {
    return null;
  }
  if (oemWheelDiameters.length === 1) {
    return oemWheelDiameters[0];
  }
  return null;
}

/**
 * Get display label for wheel size options
 */
export function getWheelSizeLabel(diameter: number): string {
  return `${diameter}" wheels`;
}
