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
  
  // Wheel-Size API uses "mercedes" not "mercedes-benz"
  const makeAliases: Record<string, string> = {
    "chevrolet": "chevrolet",
    "chevy": "chevrolet",
    "mercedes-benz": "mercedes",
    "mercedes benz": "mercedes",
    "mercedes": "mercedes",
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
 * 
 * Pattern: "user-facing-slug" → "api-slug"
 */
const modelAliases: Record<string, string> = {
  // ===== Lexus =====
  "rx-350": "rx",
  "rx-450h": "rx",
  "rx-500h": "rx",
  "rx-350h": "rx",
  "rx350": "rx",
  "rx450h": "rx",
  
  // ===== BMW - Map model numbers to series =====
  // Note: Wheel-Size API uses "3 series" (space) not "3-series" (hyphen)
  // 2-series
  "228i": "2-series",
  "230i": "2-series",
  "m240i": "2-series",
  "m2": "2-series",
  "2-series": "2-series",
  // 3-series
  "3-series": "3-series",
  "3 series": "3-series", // API variant
  "318i": "3-series",
  "320i": "3-series",
  "328i": "3-series",
  "330i": "3-series",
  "335i": "3-series",
  "340i": "3-series",
  "m340i": "3-series",
  "m3": "3-series",
  // 4-series
  "4-series": "4-series",
  "4 series": "4-series",
  "428i": "4-series",
  "430i": "4-series",
  "430i-xdrive": "4-series",
  "430i-gran-coupe": "4-series",
  "435i": "4-series",
  "440i": "4-series",
  "440i-xdrive": "4-series",
  "m440i": "4-series",
  "m4": "4-series",
  // 5-series
  "5-series": "5-series",
  "5 series": "5-series",
  "525i": "5-series",
  "528i": "5-series",
  "530i": "5-series",
  "535i": "5-series",
  "540i": "5-series",
  "545i": "5-series",
  "550i": "5-series",
  "m550i": "5-series",
  "m5": "5-series",
  // 6-series
  "6-series": "6-series",
  "6 series": "6-series",
  "640i": "6-series",
  "650i": "6-series",
  "m6": "6-series",
  // 7-series
  "7-series": "7-series",
  "7 series": "7-series",
  "740i": "7-series",
  "745i": "7-series",
  "750i": "7-series",
  "760i": "7-series",
  // 8-series
  "8-series": "8-series",
  "8 series": "8-series",
  "840i": "8-series",
  "850i": "8-series",
  "m850i": "8-series",
  "m8": "8-series",
  // X-series (already match, but include for completeness)
  "x1": "x1",
  "x2": "x2",
  "x3": "x3",
  "x4": "x4",
  "x5": "x5",
  "x5-xdrive40i": "x5",
  "x6": "x6",
  "x7": "x7",
  // Z-series
  "z3": "z3",
  "z4": "z4",
  
  // ===== Mercedes-Benz - Map model codes to classes =====
  // A-Class
  "a-class": "a-class",
  "a220": "a-class",
  "a250": "a-class",
  "a35": "a-class",
  "amg-a35": "a-class",
  // C-Class
  "c-class": "c-class",
  "c200": "c-class",
  "c250": "c-class",
  "c300": "c-class",
  "c350": "c-class",
  "c400": "c-class",
  "c450": "c-class",
  "c43": "c-class",
  "c63": "c-class",
  "amg-c43": "c-class",
  "amg-c63": "c-class",
  // CLA
  "cla": "cla",
  "cla-250": "cla",
  "cla-45": "cla",
  "cla250": "cla",
  "cla45": "cla",
  // CLS
  "cls": "cls",
  "cls450": "cls",
  "cls550": "cls",
  // E-Class
  "e-class": "e-class",
  "e300": "e-class",
  "e350": "e-class",
  "e400": "e-class",
  "e450": "e-class",
  "e550": "e-class",
  "e53": "e-class",
  "e63": "e-class",
  "amg-e53": "e-class",
  "amg-e63": "e-class",
  // S-Class
  "s-class": "s-class",
  "s450": "s-class",
  "s500": "s-class",
  "s550": "s-class",
  "s560": "s-class",
  "s580": "s-class",
  "s63": "s-class",
  // GLA
  "gla": "gla",
  "gla250": "gla",
  "gla-250": "gla",
  "gla35": "gla",
  "gla45": "gla",
  // GLB
  "glb": "glb",
  "glb250": "glb",
  "glb-250": "glb",
  // GLC
  "glc": "glc",
  "glc-300": "glc",
  "glc300": "glc",
  "glc350": "glc",
  "glc43": "glc",
  "glc63": "glc",
  // GLE
  "gle": "gle",
  "gle-350": "gle",
  "gle350": "gle",
  "gle450": "gle",
  "gle53": "gle",
  "gle63": "gle",
  // GLS
  "gls": "gls",
  "gls450": "gls",
  "gls550": "gls",
  "gls580": "gls",
  "gls63": "gls",
  
  // ===== Tesla =====
  "model-3": "model-3",
  "model-3-standard-range": "model-3",
  "model-3-standard-range-plus": "model-3",
  "model-3-long-range": "model-3",
  "model-3-performance": "model-3",
  "model-3-lr": "model-3",
  "model-3-sr": "model-3",
  "model-y": "model-y",
  "model-y-long-range": "model-y",
  "model-y-performance": "model-y",
  "model-s": "model-s",
  "model-s-plaid": "model-s",
  "model-s-long-range": "model-s",
  "model-x": "model-x",
  "model-x-plaid": "model-x",
  "model-x-long-range": "model-x",
  
  // ===== Audi =====
  "a3": "a3",
  "s3": "a3",
  "rs3": "a3",
  "a4": "a4",
  "s4": "a4",
  "rs4": "a4",
  "a5": "a5",
  "s5": "a5",
  "rs5": "a5",
  "a6": "a6",
  "s6": "a6",
  "rs6": "a6",
  "a7": "a7",
  "s7": "a7",
  "rs7": "a7",
  "a8": "a8",
  "s8": "a8",
  "q3": "q3",
  "q5": "q5",
  "sq5": "q5",
  "q7": "q7",
  "sq7": "q7",
  "q8": "q8",
  "sq8": "q8",
  "rsq8": "q8",
  
  // ===== Hyundai EVs =====
  "ioniq-5": "ioniq-5",
  "ioniq-5-sel": "ioniq-5",
  "ioniq-5-limited": "ioniq-5",
  "ioniq-6": "ioniq-6",
  
  // ===== Kia EVs =====
  "ev6": "ev6",
  "ev6-gt-line": "ev6",
  "ev6-gt": "ev6",
  "ev9": "ev9",
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
