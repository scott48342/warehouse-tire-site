/**
 * Trim/Submodel Normalization
 * 
 * Maps raw engine codes and technical identifiers to customer-friendly trim names.
 * NEVER displays modification IDs or raw engine codes to users.
 */

type TrimMapping = {
  /** Pattern to match against engine string (case-insensitive) */
  enginePattern: RegExp;
  /** Display label for the customer */
  label: string;
};

type VehicleModelMappings = {
  [model: string]: TrimMapping[];
};

type VehicleMakeMappings = {
  [make: string]: VehicleModelMappings;
};

/**
 * Known engine-to-trim mappings by make/model
 * Years are handled by range - these patterns apply across model generations
 */
const ENGINE_TO_TRIM_MAPPINGS: VehicleMakeMappings = {
  chevrolet: {
    camaro: [
      { enginePattern: /^5\.7/i, label: "Z28" },
      { enginePattern: /^3\.(4|8)/i, label: "Base" },
      { enginePattern: /^6\.2/i, label: "SS" },
      { enginePattern: /^2\.0/i, label: "Turbo" },
      { enginePattern: /^3\.6/i, label: "LT" },
    ],
    corvette: [
      { enginePattern: /^5\.7/i, label: "Base" },
      { enginePattern: /^6\.0/i, label: "Z06" },
      { enginePattern: /^6\.2/i, label: "Stingray" },
      { enginePattern: /^7\.0/i, label: "Z06" },
    ],
  },
  pontiac: {
    firebird: [
      { enginePattern: /^5\.7/i, label: "Trans Am" },
      { enginePattern: /^3\.(4|8)/i, label: "Base" },
      { enginePattern: /^5\.0/i, label: "Formula" },
    ],
    "grand prix": [
      { enginePattern: /^3\.8/i, label: "GT" },
      { enginePattern: /^3\.1/i, label: "SE" },
      { enginePattern: /^5\.3/i, label: "GXP" },
    ],
  },
  ford: {
    mustang: [
      { enginePattern: /^5\.0/i, label: "GT" },
      { enginePattern: /^4\.6/i, label: "GT" },
      { enginePattern: /^3\.8/i, label: "Base" },
      { enginePattern: /^3\.7/i, label: "V6" },
      { enginePattern: /^2\.3/i, label: "EcoBoost" },
      { enginePattern: /^5\.4/i, label: "Shelby GT500" },
      { enginePattern: /^5\.8/i, label: "Shelby GT500" },
    ],
  },
  dodge: {
    challenger: [
      { enginePattern: /^6\.4/i, label: "Scat Pack" },
      { enginePattern: /^6\.2/i, label: "Hellcat" },
      { enginePattern: /^5\.7/i, label: "R/T" },
      { enginePattern: /^3\.6/i, label: "SXT" },
    ],
    charger: [
      { enginePattern: /^6\.4/i, label: "Scat Pack" },
      { enginePattern: /^6\.2/i, label: "Hellcat" },
      { enginePattern: /^5\.7/i, label: "R/T" },
      { enginePattern: /^3\.6/i, label: "SXT" },
    ],
  },
};

/**
 * Check if a string looks like an engine code
 */
function isEngineCode(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return (
    /^\d+\.\d+[iLtT]?$/i.test(trimmed) || // "3.8i", "5.7L", "2.0T"
    /^V\d+$/i.test(trimmed) || // "V6", "V8"
    /^L\d{2,3}$/i.test(trimmed) || // "L86", "LT1", "LS3"
    /^[A-Z]{2,3}\d{1,2}$/i.test(trimmed) // "LS1", "LT4"
  );
}

/**
 * Check if a string looks like a modification ID (hex or UUID-like)
 */
function isModificationId(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return (
    /^[0-9a-f]{8,}$/i.test(trimmed) || // hex ID
    /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(trimmed) // UUID prefix
  );
}

/**
 * Normalize a trim label from raw trim and engine strings
 * 
 * @param trimStr - The trim level string (e.g., "Base", "LT", "Z28", or empty)
 * @param engineStr - The engine string (e.g., "5.7i", "3.8L", or empty)
 * @param year - Vehicle year
 * @param make - Vehicle make
 * @param model - Vehicle model
 * @returns Friendly display label, or empty string if none determined
 */
export function normalizeTrimLabel(
  trimStr: string,
  engineStr: string,
  year: string,
  make: string,
  model: string
): string {
  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();
  const cleanTrim = trimStr.trim();
  const cleanEngine = engineStr.trim();

  // If we have a good trim string that's not an engine code or ID, use it
  if (cleanTrim && !isEngineCode(cleanTrim) && !isModificationId(cleanTrim)) {
    return cleanTrim;
  }

  // Try to map engine to a friendly trim name
  const makeMappings = ENGINE_TO_TRIM_MAPPINGS[normalizedMake];
  if (makeMappings) {
    const modelMappings = makeMappings[normalizedModel];
    if (modelMappings) {
      // Check against engine string
      for (const mapping of modelMappings) {
        if (mapping.enginePattern.test(cleanEngine)) {
          return mapping.label;
        }
        // Also check if trim string is actually an engine code
        if (cleanTrim && mapping.enginePattern.test(cleanTrim)) {
          return mapping.label;
        }
      }
    }
  }

  // If trim looks like an engine code but we have no mapping, return empty
  // (caller should default to "Base")
  if (cleanTrim && isEngineCode(cleanTrim)) {
    return "";
  }

  // If we have engine info but no mapping, return empty
  if (cleanEngine && !cleanTrim) {
    return "";
  }

  return cleanTrim;
}

/**
 * Normalize a raw trim/submodel value for display
 * Used when we only have a single value (not separate trim/engine)
 * 
 * @param rawValue - Raw trim value that might be an engine code
 * @param year - Vehicle year
 * @param make - Vehicle make
 * @param model - Vehicle model
 * @returns { value, label } with friendly label
 */
export function normalizeTrim(
  rawValue: string,
  year: string,
  make: string,
  model: string
): { value: string; label: string } {
  if (!rawValue) {
    return { value: "", label: "" };
  }

  const clean = rawValue.trim();

  // Never show modification IDs
  if (isModificationId(clean)) {
    return { value: clean, label: "Base" };
  }

  // If it's not an engine code, use as-is
  if (!isEngineCode(clean)) {
    return { value: clean, label: clean };
  }

  // Try to map engine code to friendly name
  const label = normalizeTrimLabel("", clean, year, make, model);
  return { value: clean, label: label || "Base" };
}

/**
 * Normalize an array of trim options, deduplicating by label
 */
export function normalizeTrims(
  options: Array<string | { value: string; label?: string }>,
  year: string,
  make: string,
  model: string
): Array<{ value: string; label: string }> {
  const seen = new Map<string, { value: string; label: string }>();

  for (const opt of options) {
    const raw = typeof opt === "string" ? opt : opt.value;
    const existingLabel = typeof opt === "object" ? opt.label : undefined;

    let label: string;
    if (existingLabel && !isEngineCode(existingLabel) && !isModificationId(existingLabel)) {
      label = existingLabel;
    } else {
      const normalized = normalizeTrim(raw, year, make, model);
      label = normalized.label || "Base";
    }

    if (!raw) continue;

    const labelKey = label.toLowerCase();
    if (!seen.has(labelKey)) {
      seen.set(labelKey, { value: raw, label });
    }
  }

  return Array.from(seen.values());
}
