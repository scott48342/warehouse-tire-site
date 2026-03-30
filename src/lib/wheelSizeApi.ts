/**
 * STUB: Wheel-Size API module
 * 
 * This module has been deprecated in favor of DB-first architecture.
 * All Wheel-Size API calls have been removed. Fitment data must be imported
 * via admin tools from static data sources.
 * 
 * Exports are kept for backwards compatibility but throw errors if called.
 */

// ============================================================================
// Types (stubs for backwards compatibility)
// ============================================================================

export type WheelSizeMake = {
  slug: string;
  name: string;
};

export type WheelSizeModel = {
  slug: string;
  name: string;
};

export type WheelSizeYear = {
  year: number;
};

export type WheelSizeModification = {
  slug: string;
  name?: string;
  trim?: string;
  engine?: {
    capacity?: string;
    type?: string;
    fuel?: string;
  };
  body?: string;
  regions?: string[];
  trim_levels?: string[];
};

export type WheelSizeTechnical = {
  bolt_pattern?: string;
  centre_bore?: string;
  stud_holes?: number;
  pcd?: number;
  wheel_tightening_torque?: string | number;
  wheel_fasteners?: {
    thread_size?: string;
    type?: string;
  };
};

export type WheelSizeWheelSetup = {
  is_stock: boolean;
  showing_fp_only?: boolean;
  front: {
    tire: string;
    rim_diameter: number;
    rim_width: number;
    rim_offset: number;
  };
  rear?: {
    tire: string;
    rim_diameter?: number;
    rim_width?: number;
    rim_offset?: number;
  };
};

export type WheelSizeVehicleData = {
  slug?: string;
  name?: string;
  trim?: string;
  trim_levels?: string[];
  regions?: string[];
  generation?: { name?: string; bodies?: Array<{ title?: string }> };
  wheels?: WheelSizeWheelSetup[];
  technical?: WheelSizeTechnical;
};

// ============================================================================
// Constants
// ============================================================================

export const WHEELSIZE_API_BASE = "https://api.wheel-size.com/v2/";
export const WHEEL_SIZE_ENABLED = false;

// ============================================================================
// Status Functions
// ============================================================================

export function isWheelSizeEnabled(): boolean {
  // Always return false - external API calls are disabled
  return false;
}

export function getApiKey(): string | null {
  // API key access is disabled
  return null;
}

// ============================================================================
// Stub API Functions (all throw errors)
// ============================================================================

const API_DISABLED_ERROR = "Wheel-Size API is disabled. Use database catalog instead.";

export async function getMakes(): Promise<WheelSizeMake[]> {
  throw new Error(API_DISABLED_ERROR);
}

export async function findMake(_makeName: string): Promise<WheelSizeMake | null> {
  throw new Error(API_DISABLED_ERROR);
}

export async function getModels(_makeSlug: string): Promise<WheelSizeModel[]> {
  throw new Error(API_DISABLED_ERROR);
}

export async function findModel(
  _makeSlug: string,
  _modelName: string
): Promise<WheelSizeModel | null> {
  throw new Error(API_DISABLED_ERROR);
}

export async function resolveMakeModel(
  _makeInput: string,
  _modelInput: string
): Promise<{ makeSlug: string; modelSlug: string; modelName?: string } | null> {
  throw new Error(API_DISABLED_ERROR);
}

export async function getYears(
  _makeSlug: string,
  _modelSlug: string
): Promise<number[]> {
  throw new Error(API_DISABLED_ERROR);
}

export async function getModifications(
  _makeSlug: string,
  _modelSlug: string,
  _year: number
): Promise<WheelSizeModification[]> {
  throw new Error(API_DISABLED_ERROR);
}

export async function getUSModifications(
  _makeSlug: string,
  _modelSlug: string,
  _year: number
): Promise<WheelSizeModification[]> {
  throw new Error(API_DISABLED_ERROR);
}

export async function getVehicleData(
  _makeSlug: string,
  _modelSlug: string,
  _year: number,
  _modificationSlug: string
): Promise<WheelSizeVehicleData | null> {
  throw new Error(API_DISABLED_ERROR);
}

export async function getAllVehicleData(
  _makeSlug: string,
  _modelSlug: string,
  _year: number
): Promise<WheelSizeVehicleData[]> {
  throw new Error(API_DISABLED_ERROR);
}

export async function searchByTire(
  _tireSize: string
): Promise<WheelSizeVehicleData[]> {
  throw new Error(API_DISABLED_ERROR);
}

export async function searchByRim(
  _diameter: number,
  _width: number,
  _boltPattern: string
): Promise<WheelSizeVehicleData[]> {
  throw new Error(API_DISABLED_ERROR);
}

// Aliased fetch functions (for code that uses the "fetch" prefix)
export const fetchMakes = getMakes;
export const fetchModels = getModels;
export const fetchYears = getYears;
export const fetchModifications = getModifications;
export const fetchVehicleByModification = getVehicleData;
export const searchVehicles = async (
  _query: string
): Promise<Array<{ make: string; model: string; years?: number[] }>> => {
  throw new Error(API_DISABLED_ERROR);
};

// ============================================================================
// Cache Functions (no-ops since cache is unused)
// ============================================================================

export function getCacheStats(): {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
} {
  return {
    totalEntries: 0,
    totalSize: 0,
    hitRate: 0,
  };
}

export function pruneExpiredCache(): number {
  return 0;
}

export function clearCache(): number {
  return 0;
}

// Re-export empty arrays/objects for any code that reads these directly
export const cachedMakes: WheelSizeMake[] = [];
