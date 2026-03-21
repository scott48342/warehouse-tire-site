/**
 * Canonical Key Generation for Fitment Records
 * 
 * Keys are used to uniquely identify vehicles and enable efficient lookups.
 * Format: year:make:model:modification_id
 * 
 * All components are normalized:
 * - lowercase
 * - slugified (non-alphanumeric replaced with hyphens)
 * - trimmed
 */

import crypto from "crypto";

/**
 * Slugify a string for use in canonical keys
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Normalize make name for consistent lookups
 */
export function normalizeMake(make: string): string {
  // Handle common variations
  const normalized = make.trim().toLowerCase();
  
  const makeAliases: Record<string, string> = {
    "chevrolet": "chevrolet",
    "chevy": "chevrolet",
    "mercedes-benz": "mercedes-benz",
    "mercedes benz": "mercedes-benz",
    "mercedes": "mercedes-benz",
    "bmw": "bmw",
    "volkswagen": "volkswagen",
    "vw": "volkswagen",
    "land rover": "land-rover",
    "landrover": "land-rover",
    "alfa romeo": "alfa-romeo",
    "alfaromeo": "alfa-romeo",
    "aston martin": "aston-martin",
    "astonmartin": "aston-martin",
  };
  
  return makeAliases[normalized] || slugify(normalized);
}

/**
 * Model aliases for Wheel-Size API compatibility
 * Maps user-facing model names to API-expected slugs
 */
const modelAliases: Record<string, string> = {
  // Lexus RX variants → base model
  "rx-350": "rx",
  "rx-450h": "rx",
  "rx-500h": "rx",
  "rx-350h": "rx",
  "rx350": "rx",
  "rx450h": "rx",
  // BMW series with numbers
  "3-series": "3-series",
  "330i": "3-series",
  "m340i": "3-series",
  "5-series": "5-series",
  "530i": "5-series",
  "m550i": "5-series",
  // Mercedes classes
  "c-class": "c-class",
  "c300": "c-class",
  "e-class": "e-class",
  "e350": "e-class",
  // Audi models
  "a4": "a4",
  "s4": "a4",
  "a6": "a6",
  "s6": "a6",
};

/**
 * Normalize model name for consistent lookups
 */
export function normalizeModel(model: string): string {
  const slugified = slugify(model);
  return modelAliases[slugified] || slugified;
}

/**
 * Normalize model name specifically for Wheel-Size API calls
 * This handles the common case where user searches "RX 350" but API expects "RX"
 */
export function normalizeModelForApi(model: string): string {
  return normalizeModel(model);
}

/**
 * Generate canonical key for a vehicle
 */
export function makeCanonicalKey(
  year: number,
  make: string,
  model: string,
  modificationId: string
): string {
  const y = String(year);
  const ma = normalizeMake(make);
  const mo = normalizeModel(model);
  const mod = slugify(modificationId);
  return `${y}:${ma}:${mo}:${mod}`;
}

/**
 * Parse a canonical key back into components
 */
export function parseCanonicalKey(key: string): {
  year: number;
  make: string;
  model: string;
  modificationId: string;
} | null {
  const parts = key.split(":");
  if (parts.length !== 4) return null;
  
  const year = parseInt(parts[0], 10);
  if (isNaN(year) || year < 1900 || year > 2100) return null;
  
  return {
    year,
    make: parts[1],
    model: parts[2],
    modificationId: parts[3],
  };
}

/**
 * Generate a short hash for a vehicle (for URLs, etc.)
 */
export function makeVehicleHash(
  year: number,
  make: string,
  model: string,
  modificationId: string
): string {
  const key = makeCanonicalKey(year, make, model, modificationId);
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 12);
}

/**
 * Generate checksum for raw payload (change detection)
 */
export function makePayloadChecksum(payload: unknown): string {
  const json = JSON.stringify(payload, Object.keys(payload as object).sort());
  return crypto.createHash("sha256").update(json).digest("hex");
}

/**
 * Generate a source record ID from source + sourceId
 */
export function makeSourceKey(source: string, sourceId: string): string {
  return `${source}:${sourceId}`;
}
