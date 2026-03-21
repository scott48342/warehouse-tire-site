/**
 * Trim/Submodel Normalization
 * 
 * Maps raw engine codes and technical identifiers to customer-friendly trim names.
 * Preserves original value for fitment lookup while showing friendly labels.
 */

type TrimMapping = {
  /** Pattern to match against engine/trim string (case-insensitive) */
  pattern: RegExp;
  /** Display label for the customer */
  label: string;
};

type VehicleTrimMappings = {
  [year: string]: {
    [make: string]: {
      [model: string]: TrimMapping[];
    };
  };
};

/**
 * Known engine-to-trim mappings by year/make/model
 * Add more vehicles as needed
 */
const TRIM_MAPPINGS: VehicleTrimMappings = {
  "1993": {
    chevrolet: {
      camaro: [
        { pattern: /^5\.7/i, label: "Z28" },
        { pattern: /^3\.(4|8)/i, label: "Base" },
      ],
    },
    pontiac: {
      firebird: [
        { pattern: /^5\.7/i, label: "Trans Am" },
        { pattern: /^3\.(4|8)/i, label: "Base" },
      ],
    },
  },
  "1994": {
    chevrolet: {
      camaro: [
        { pattern: /^5\.7/i, label: "Z28" },
        { pattern: /^3\.(4|8)/i, label: "Base" },
      ],
    },
    pontiac: {
      firebird: [
        { pattern: /^5\.7/i, label: "Trans Am" },
        { pattern: /^3\.(4|8)/i, label: "Base" },
      ],
    },
  },
  "1995": {
    chevrolet: {
      camaro: [
        { pattern: /^5\.7/i, label: "Z28" },
        { pattern: /^3\.(4|8)/i, label: "Base" },
      ],
    },
    pontiac: {
      firebird: [
        { pattern: /^5\.7/i, label: "Trans Am" },
        { pattern: /^3\.(4|8)/i, label: "Base" },
      ],
    },
  },
  "1996": {
    chevrolet: {
      camaro: [
        { pattern: /^5\.7/i, label: "Z28" },
        { pattern: /^3\.(4|8)/i, label: "Base" },
      ],
    },
    pontiac: {
      firebird: [
        { pattern: /^5\.7/i, label: "Trans Am" },
        { pattern: /^3\.(4|8)/i, label: "Base" },
      ],
    },
  },
  "1997": {
    chevrolet: {
      camaro: [
        { pattern: /^5\.7/i, label: "Z28" },
        { pattern: /^3\.8/i, label: "Base" },
      ],
    },
    pontiac: {
      firebird: [
        { pattern: /^5\.7/i, label: "Trans Am" },
        { pattern: /^3\.8/i, label: "Formula" },
      ],
    },
  },
  "1998": {
    chevrolet: {
      camaro: [
        { pattern: /^5\.7/i, label: "Z28" },
        { pattern: /^3\.8/i, label: "Base" },
      ],
    },
    pontiac: {
      firebird: [
        { pattern: /^5\.7/i, label: "Trans Am" },
        { pattern: /^3\.8/i, label: "Base" },
      ],
    },
  },
  "1999": {
    chevrolet: {
      camaro: [
        { pattern: /^5\.7/i, label: "Z28" },
        { pattern: /^3\.8/i, label: "Base" },
      ],
    },
    pontiac: {
      firebird: [
        { pattern: /^5\.7/i, label: "Trans Am" },
        { pattern: /^3\.8/i, label: "Base" },
      ],
    },
  },
  "2000": {
    chevrolet: {
      camaro: [
        { pattern: /^5\.7/i, label: "Z28" },
        { pattern: /^3\.8/i, label: "Base" },
      ],
    },
    pontiac: {
      firebird: [
        { pattern: /^5\.7/i, label: "Trans Am" },
        { pattern: /^3\.8/i, label: "Base" },
      ],
    },
  },
  "2001": {
    chevrolet: {
      camaro: [
        { pattern: /^5\.7/i, label: "Z28" },
        { pattern: /^3\.8/i, label: "Base" },
      ],
    },
    pontiac: {
      firebird: [
        { pattern: /^5\.7/i, label: "Trans Am" },
        { pattern: /^3\.8/i, label: "Base" },
      ],
    },
  },
  "2002": {
    chevrolet: {
      camaro: [
        { pattern: /^5\.7/i, label: "Z28" },
        { pattern: /^3\.8/i, label: "Base" },
      ],
    },
    pontiac: {
      firebird: [
        { pattern: /^5\.7/i, label: "Trans Am" },
        { pattern: /^3\.8/i, label: "Base" },
      ],
    },
  },
};

/**
 * Generic engine displacement patterns for fallback normalization
 * Maps common engine codes to displacement-based labels when no specific mapping exists
 */
const ENGINE_PATTERNS: Array<{ pattern: RegExp; test: (s: string) => boolean }> = [
  // Patterns that look like engine displacements (e.g., "3.8i", "5.7L", "2.0T")
  { pattern: /^\d+\.\d+[iLtT]?$/i, test: (s) => /^\d+\.\d+[iLtT]?$/i.test(s) },
];

/**
 * Check if a string looks like a raw engine code rather than a trim name
 */
export function isEngineCode(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  // Common engine code patterns
  return (
    /^\d+\.\d+[iLtT]?$/i.test(trimmed) || // "3.8i", "5.7L", "2.0T"
    /^V\d+$/i.test(trimmed) || // "V6", "V8"
    /^L\d{2}$/i.test(trimmed) || // "L86", "LT1" style GM codes
    /^[A-Z]\d{2,3}$/i.test(trimmed) // Other alphanumeric engine codes
  );
}

/**
 * Normalize a trim/submodel option for display
 * 
 * @param value - The raw value (engine code, slug, etc.) used for fitment lookup
 * @param year - Vehicle year
 * @param make - Vehicle make
 * @param model - Vehicle model
 * @returns Normalized { value, label } object
 */
export function normalizeTrim(
  value: string,
  year: string,
  make: string,
  model: string
): { value: string; label: string } {
  if (!value) {
    return { value: "", label: "" };
  }

  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();
  const normalizedValue = value.trim();

  // Check for specific vehicle mappings
  const yearMappings = TRIM_MAPPINGS[year];
  if (yearMappings) {
    const makeMappings = yearMappings[normalizedMake];
    if (makeMappings) {
      const modelMappings = makeMappings[normalizedModel];
      if (modelMappings) {
        for (const mapping of modelMappings) {
          if (mapping.pattern.test(normalizedValue)) {
            return { value: normalizedValue, label: mapping.label };
          }
        }
      }
    }
  }

  // If it looks like an engine code but we don't have a mapping, 
  // show as "Base" with the engine in parentheses
  if (isEngineCode(normalizedValue)) {
    return { value: normalizedValue, label: `Base (${normalizedValue})` };
  }

  // Otherwise, use the value as the label (it's probably already a trim name)
  return { value: normalizedValue, label: normalizedValue };
}

/**
 * Normalize an array of trim options, deduplicating by label
 * 
 * @param options - Array of raw values or {value, label} objects
 * @param year - Vehicle year
 * @param make - Vehicle make  
 * @param model - Vehicle model
 * @returns Deduplicated array of { value, label } objects
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

    // If we already have a good label, check if it's an engine code
    let normalized: { value: string; label: string };
    if (existingLabel && !isEngineCode(existingLabel)) {
      // Label looks good, keep it
      normalized = { value: raw, label: existingLabel };
    } else {
      // Normalize based on the raw value
      normalized = normalizeTrim(raw, year, make, model);
    }

    if (!normalized.value || !normalized.label) continue;

    const labelKey = normalized.label.toLowerCase();
    
    // Keep the first occurrence of each label
    if (!seen.has(labelKey)) {
      seen.set(labelKey, normalized);
    }
  }

  return Array.from(seen.values());
}
