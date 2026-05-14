/**
 * Tire Size Utility Functions
 * 
 * Shared helpers for extracting and normalizing tire sizes from various formats.
 * 
 * SUPPORTED FORMATS:
 * 1. String: "275/65R18"
 * 2. Object with size: { size: "275/65R18" }
 * 3. Object with tireSize: { tireSize: "275/65R18" }
 * 4. Object with axle: { size: "275/65R18", axle: "front" }
 * 5. Staggered object: { front: "245/40R19", rear: "275/35R19" }
 * 6. Staggered arrays: { front: ["245/40R19"], rear: ["275/35R19"] }
 * 7. Stringified JSON: "[\"275/65R18\"]"
 * 
 * The CANONICAL staggered format for storage is:
 * { front: "245/40R19", rear: "275/35R19" }
 * or with arrays:
 * { front: ["245/40R19"], rear: ["275/35R19"] }
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface TireSizeObject {
  size?: string;
  tireSize?: string;
  axle?: string;
  width?: number;
  aspectRatio?: number;
  diameter?: number;
}

export interface StaggeredTireSizes {
  front: string | string[];
  rear: string | string[];
}

export type TireSizeValue = string | TireSizeObject | StaggeredTireSizes;
export type TireSizeArray = (string | TireSizeObject)[];
export type OemTireSizesRaw = 
  | string                // Stringified JSON
  | string[]              // Array of strings
  | TireSizeObject[]      // Array of objects
  | StaggeredTireSizes    // { front, rear } object
  | null
  | undefined;

// ═══════════════════════════════════════════════════════════════════════════
// TIRE SIZE VALIDATION REGEX
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Matches standard metric tire sizes:
 * - 275/65R18, P275/65R18, 275/65ZR18, etc.
 */
export const TIRE_SIZE_REGEX = /^P?(\d{2,3})\/(\d{2,3})Z?R(\d{2})$/i;

/**
 * Looser regex for detecting tire size patterns (allows more variations)
 */
export const TIRE_SIZE_LOOSE_REGEX = /\d{2,3}\/\d{2,3}Z?R\d{2}/i;

// ═══════════════════════════════════════════════════════════════════════════
// CORE EXTRACTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract a tire size string from various input formats.
 * 
 * This is the main helper function that safely handles:
 * - string
 * - { size: "..." }
 * - { tireSize: "..." }
 * - { size: "...", axle: "front" }
 * - { width, aspectRatio, diameter }
 * 
 * @param value - Input value (string or object)
 * @returns Tire size string or null if extraction fails
 * 
 * @example
 * extractTireSizeString("275/65R18") // "275/65R18"
 * extractTireSizeString({ size: "275/65R18" }) // "275/65R18"
 * extractTireSizeString({ size: "275/65R18", axle: "front" }) // "275/65R18"
 * extractTireSizeString({ width: 275, aspectRatio: 65, diameter: 18 }) // "275/65R18"
 * extractTireSizeString(null) // null
 */
export function extractTireSizeString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  // Already a string
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  
  // Must be an object at this point
  if (typeof value !== 'object') {
    return null;
  }
  
  const obj = value as Record<string, unknown>;
  
  // Check for size property
  if (typeof obj.size === 'string' && obj.size.trim()) {
    return obj.size.trim();
  }
  
  // Check for tireSize property
  if (typeof obj.tireSize === 'string' && obj.tireSize.trim()) {
    return obj.tireSize.trim();
  }
  
  // Reconstruct from width/aspectRatio/diameter
  const width = Number(obj.width);
  const aspectRatio = Number(obj.aspectRatio);
  const diameter = Number(obj.diameter);
  
  if (width > 0 && aspectRatio > 0 && diameter > 0) {
    return `${width}/${aspectRatio}R${diameter}`;
  }
  
  return null;
}

/**
 * Check if an object is a staggered tire size object ({ front, rear })
 */
export function isStaggeredObject(value: unknown): value is StaggeredTireSizes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return ('front' in obj || 'rear' in obj);
}

/**
 * Extract all tire size strings from a staggered object.
 * 
 * @param staggered - Staggered object { front, rear }
 * @returns Array of all tire size strings (front + rear combined)
 */
export function extractFromStaggered(staggered: StaggeredTireSizes): string[] {
  const result: string[] = [];
  
  // Extract front
  if (staggered.front) {
    if (Array.isArray(staggered.front)) {
      for (const item of staggered.front) {
        const size = extractTireSizeString(item);
        if (size) result.push(size);
      }
    } else {
      const size = extractTireSizeString(staggered.front);
      if (size) result.push(size);
    }
  }
  
  // Extract rear
  if (staggered.rear) {
    if (Array.isArray(staggered.rear)) {
      for (const item of staggered.rear) {
        const size = extractTireSizeString(item);
        if (size) result.push(size);
      }
    } else {
      const size = extractTireSizeString(staggered.rear);
      if (size) result.push(size);
    }
  }
  
  return result;
}

/**
 * Get front tire size(s) from staggered object.
 */
export function getFrontTireSizes(staggered: StaggeredTireSizes): string[] {
  if (!staggered.front) return [];
  
  if (Array.isArray(staggered.front)) {
    return staggered.front
      .map(item => extractTireSizeString(item))
      .filter((s): s is string => s !== null);
  }
  
  const size = extractTireSizeString(staggered.front);
  return size ? [size] : [];
}

/**
 * Get rear tire size(s) from staggered object.
 */
export function getRearTireSizes(staggered: StaggeredTireSizes): string[] {
  if (!staggered.rear) return [];
  
  if (Array.isArray(staggered.rear)) {
    return staggered.rear
      .map(item => extractTireSizeString(item))
      .filter((s): s is string => s !== null);
  }
  
  const size = extractTireSizeString(staggered.rear);
  return size ? [size] : [];
}

// ═══════════════════════════════════════════════════════════════════════════
// NORMALIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize any oem_tire_sizes format to a flat string array.
 * 
 * This handles all supported formats and always returns string[].
 * Use this when you need a simple list of all tire sizes.
 * 
 * @param raw - Raw value from database (any format)
 * @returns Array of tire size strings (deduplicated)
 * 
 * @example
 * normalizeToStringArray(["275/65R18"]) // ["275/65R18"]
 * normalizeToStringArray({ front: "245/40R19", rear: "275/35R19" }) // ["245/40R19", "275/35R19"]
 * normalizeToStringArray([{ size: "275/65R18" }]) // ["275/65R18"]
 */
export function normalizeToStringArray(raw: unknown): string[] {
  if (!raw) return [];
  
  // Handle stringified JSON
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return normalizeToStringArray(parsed);
    } catch {
      // Single tire size string
      const size = extractTireSizeString(raw);
      return size ? [size] : [];
    }
  }
  
  // Handle staggered object: { front, rear }
  if (isStaggeredObject(raw)) {
    return extractFromStaggered(raw);
  }
  
  // Must be an array at this point
  if (!Array.isArray(raw)) {
    return [];
  }
  
  const result: string[] = [];
  
  for (const item of raw) {
    const size = extractTireSizeString(item);
    if (size) {
      result.push(size);
    }
  }
  
  // Deduplicate
  return [...new Set(result)];
}

/**
 * Check if a normalized value contains valid tire sizes.
 * 
 * This is an enhanced version of hasValidTireSizes that handles all formats.
 * 
 * @param raw - Raw value from database
 * @returns true if at least one valid tire size exists
 */
export function hasValidTireSizesEnhanced(raw: unknown): boolean {
  const sizes = normalizeToStringArray(raw);
  return sizes.some(size => TIRE_SIZE_LOOSE_REGEX.test(size));
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGGERED FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a canonical staggered tire size object for DB storage.
 * 
 * This is the format that should be written to oem_tire_sizes for staggered vehicles:
 * { front: "245/40R19", rear: "275/35R19" }
 * 
 * @param front - Front tire size string
 * @param rear - Rear tire size string
 * @returns Canonical staggered object
 */
export function createStaggeredObject(front: string, rear: string): StaggeredTireSizes {
  return { front, rear };
}

/**
 * Check if a raw value represents a staggered setup.
 * 
 * Returns true if:
 * - It's a { front, rear } object with different sizes
 * - It's an array with exactly 2 different sizes (ambiguous but possible)
 */
export function isStaggeredSetup(raw: unknown): boolean {
  if (isStaggeredObject(raw)) {
    const frontSizes = getFrontTireSizes(raw);
    const rearSizes = getRearTireSizes(raw);
    
    // Has both front and rear
    if (frontSizes.length > 0 && rearSizes.length > 0) {
      // Check if sizes are actually different
      const allFront = new Set(frontSizes);
      const allRear = new Set(rearSizes);
      
      // If any rear size is different from all front sizes, it's staggered
      for (const rear of allRear) {
        if (!allFront.has(rear)) return true;
      }
    }
    
    return false;
  }
  
  // For arrays, we can't determine staggered vs square without explicit markers
  return false;
}

/**
 * Parse a staggered object and return structured front/rear data.
 * 
 * @param raw - Raw value (should be staggered object)
 * @returns Parsed front/rear sizes or null if not staggered
 */
export function parseStaggeredData(raw: unknown): { 
  front: string[]; 
  rear: string[];
  isStaggered: boolean;
} | null {
  if (!isStaggeredObject(raw)) {
    return null;
  }
  
  const front = getFrontTireSizes(raw);
  const rear = getRearTireSizes(raw);
  
  return {
    front,
    rear,
    isStaggered: isStaggeredSetup(raw),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TIRE SIZE PARSING
// ═══════════════════════════════════════════════════════════════════════════

export interface ParsedTireSize {
  original: string;
  width: number;
  aspectRatio: number;
  rimDiameter: number;
}

/**
 * Parse a tire size string into components.
 * 
 * @param size - Tire size string (e.g., "275/65R18", "P255/40ZR19")
 * @returns Parsed components or null if invalid
 */
export function parseTireSize(size: string): ParsedTireSize | null {
  const match = size.match(TIRE_SIZE_REGEX);
  if (!match) return null;
  
  return {
    original: size,
    width: parseInt(match[1], 10),
    aspectRatio: parseInt(match[2], 10),
    rimDiameter: parseInt(match[3], 10),
  };
}

/**
 * Parse a tire size, accepting both string and object inputs.
 * 
 * @param value - String or object with tire size
 * @returns Parsed components or null if invalid
 */
export function parseTireSizeFromAny(value: unknown): ParsedTireSize | null {
  const sizeStr = extractTireSizeString(value);
  if (!sizeStr) return null;
  return parseTireSize(sizeStr);
}
