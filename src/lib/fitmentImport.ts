/**
 * Fitment Import - DISABLED (Phase A - DB-First Architecture)
 * 
 * This module previously fetched from Wheel-Size API.
 * Wheel-Size API is now forbidden. Use bulk-import scripts instead.
 * 
 * MIGRATION:
 * - For one-time data import, use scripts/bulk-import-fitment.ts
 * - For runtime fitment lookup, use lib/fitment-db/profileService.ts
 */

// ============================================================================
// WHEEL-SIZE API REMOVED (Phase A - DB-First Architecture)
// All import functions below are blocked. Use bulk-import scripts.
// ============================================================================

export type ImportResult = {
  success: boolean;
  vehicle?: any;
  fitmentImported: boolean;
  wheelSpecsCount: number;
  modificationSlug?: string;
  modificationName?: string;
  cached?: boolean;
  selectionReason?: string;
  error?: string;
  rawData?: any;
};

export type BulkImportResult = {
  success: boolean;
  totalVehicles: number;
  totalWheelSpecs: number;
  results: ImportResult[];
  error?: string;
};

/**
 * DISABLED: Wheel-Size API is forbidden (Phase A - DB-first architecture)
 */
export async function importVehicleFitment(
  _year: number,
  _make: string,
  _model: string,
  _options?: any
): Promise<ImportResult> {
  console.error("[fitmentImport] DISABLED - Wheel-Size API is forbidden (DB-first architecture)");
  return {
    success: false,
    fitmentImported: false,
    wheelSpecsCount: 0,
    error: "Wheel-Size API is FORBIDDEN. Use bulk-import scripts for data import.",
  };
}

/**
 * DISABLED: Wheel-Size API is forbidden (Phase A - DB-first architecture)
 */
export async function importAllVehicleVariants(
  _year: number,
  _make: string,
  _model: string,
  _options?: any
): Promise<BulkImportResult> {
  console.error("[fitmentImport] DISABLED - Wheel-Size API is forbidden (DB-first architecture)");
  return {
    success: false,
    totalVehicles: 0,
    totalWheelSpecs: 0,
    results: [],
    error: "Wheel-Size API is FORBIDDEN. Use bulk-import scripts for data import.",
  };
}

/**
 * DISABLED: Wheel-Size API is forbidden (Phase A - DB-first architecture)
 */
export async function listAvailableModifications(
  _year: number,
  _make: string,
  _model: string,
  _options?: any
): Promise<any[]> {
  console.error("[fitmentImport] DISABLED - Wheel-Size API is forbidden (DB-first architecture)");
  return [];
}
