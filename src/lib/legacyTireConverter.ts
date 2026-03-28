/**
 * Legacy Tire Size Conversion System
 * 
 * Converts pre-metric tire sizes (E70-14, F60-15, etc.) to modern P-metric equivalents.
 * This is a conversion/search/display layer ONLY - does not modify stored OEM sizes.
 * 
 * Usage:
 *   const result = convertLegacyTireSize("G70-15");
 *   // result.recommended = "225/70R15"
 *   // result.alternatives = ["235/70R15", "225/75R15"]
 */

export interface LegacyTireConversion {
  original: string;
  isLegacy: boolean;
  conversionMethod: 'lookup' | 'formula' | 'none';
  recommended: string;
  alternatives: string[];
  notes?: string;
}

// ============================================================================
// LOOKUP TABLE - Common Legacy Sizes (Priority 1)
// ============================================================================

const LEGACY_TIRE_LOOKUP: Record<string, { recommended: string; alternatives: string[] }> = {
  // 60-series (low profile for era)
  "E60-14": { recommended: "205/60R14", alternatives: ["195/60R14", "215/60R14"] },
  "E60-15": { recommended: "205/60R15", alternatives: ["195/60R15", "215/60R15"] },
  "F60-14": { recommended: "215/60R14", alternatives: ["205/60R14", "225/60R14"] },
  "F60-15": { recommended: "215/60R15", alternatives: ["205/60R15", "225/60R15"] },
  "G60-14": { recommended: "245/60R14", alternatives: ["235/60R14", "255/60R14"] },
  "G60-15": { recommended: "245/60R15", alternatives: ["235/60R15", "255/60R15"] },
  "L60-14": { recommended: "275/60R14", alternatives: ["265/60R14", "285/60R14"] },
  "L60-15": { recommended: "275/60R15", alternatives: ["265/60R15", "295/50R15"] },
  
  // 70-series (most common classic era)
  "D70-13": { recommended: "185/70R13", alternatives: ["175/70R13", "195/70R13"] },
  "D70-14": { recommended: "185/70R14", alternatives: ["175/70R14", "195/70R14"] },
  "E70-14": { recommended: "205/75R14", alternatives: ["195/75R14", "205/70R14"] },
  "E70-15": { recommended: "205/70R15", alternatives: ["195/70R15", "215/70R15"] },
  "F70-14": { recommended: "215/75R14", alternatives: ["205/75R14", "215/70R14"] },
  "F70-15": { recommended: "215/70R15", alternatives: ["205/70R15", "225/70R15"] },
  "G70-14": { recommended: "225/70R14", alternatives: ["225/75R14", "235/70R14"] },
  "G70-15": { recommended: "225/70R15", alternatives: ["235/70R15", "225/75R15"] },
  "H70-14": { recommended: "235/70R14", alternatives: ["225/70R14", "235/75R14"] },
  "H70-15": { recommended: "255/70R15", alternatives: ["235/70R15", "245/70R15"] },
  
  // 78-series (standard profile)
  "A78-13": { recommended: "165/80R13", alternatives: ["155/80R13", "175/80R13"] },
  "B78-13": { recommended: "175/80R13", alternatives: ["165/80R13", "185/80R13"] },
  "C78-13": { recommended: "185/80R13", alternatives: ["175/80R13", "195/80R13"] },
  "C78-14": { recommended: "185/75R14", alternatives: ["175/75R14", "195/75R14"] },
  "D78-14": { recommended: "195/75R14", alternatives: ["185/75R14", "205/75R14"] },
  "E78-14": { recommended: "205/75R14", alternatives: ["195/75R14", "215/75R14"] },
  "E78-15": { recommended: "205/75R15", alternatives: ["195/75R15", "215/75R15"] },
  "F78-14": { recommended: "215/75R14", alternatives: ["205/75R14", "225/75R14"] },
  "F78-15": { recommended: "215/75R15", alternatives: ["205/75R15", "225/75R15"] },
  "G78-14": { recommended: "225/75R14", alternatives: ["215/75R14", "235/75R14"] },
  "G78-15": { recommended: "225/75R15", alternatives: ["215/75R15", "235/75R15"] },
  "H78-14": { recommended: "235/75R14", alternatives: ["225/75R14", "245/75R14"] },
  "H78-15": { recommended: "235/75R15", alternatives: ["225/75R15", "245/75R15"] },
  "J78-14": { recommended: "245/75R14", alternatives: ["235/75R14", "255/75R14"] },
  "J78-15": { recommended: "225/75R15", alternatives: ["235/75R15", "215/75R15"] },
  "L78-15": { recommended: "255/75R15", alternatives: ["245/75R15", "265/75R15"] },
  
  // Radial designations (GR, HR, etc.)
  "BR70-13": { recommended: "175/70R13", alternatives: ["165/70R13", "185/70R13"] },
  "BR78-13": { recommended: "175/80R13", alternatives: ["165/80R13", "185/80R13"] },
  "CR70-14": { recommended: "185/70R14", alternatives: ["175/70R14", "195/70R14"] },
  "DR70-14": { recommended: "195/70R14", alternatives: ["185/70R14", "205/70R14"] },
  "DR78-14": { recommended: "195/75R14", alternatives: ["185/75R14", "205/75R14"] },
  "ER70-14": { recommended: "205/70R14", alternatives: ["195/70R14", "215/70R14"] },
  "ER78-14": { recommended: "205/75R14", alternatives: ["195/75R14", "215/75R14"] },
  "FR70-14": { recommended: "215/70R14", alternatives: ["205/70R14", "225/70R14"] },
  "FR70-15": { recommended: "215/70R15", alternatives: ["205/70R15", "225/70R15"] },
  "FR78-14": { recommended: "215/75R14", alternatives: ["205/75R14", "225/75R14"] },
  "FR78-15": { recommended: "215/75R15", alternatives: ["205/75R15", "225/75R15"] },
  "GR60-14": { recommended: "245/60R14", alternatives: ["235/60R14", "255/60R14"] },
  "GR60-15": { recommended: "245/60R15", alternatives: ["235/60R15", "255/60R15"] },
  "GR70-14": { recommended: "225/70R14", alternatives: ["215/70R14", "235/70R14"] },
  "GR70-15": { recommended: "225/70R15", alternatives: ["235/70R15", "225/75R15"] },
  "GR78-14": { recommended: "225/75R14", alternatives: ["215/75R14", "235/75R14"] },
  "GR78-15": { recommended: "225/75R15", alternatives: ["215/75R15", "235/75R15"] },
  "HR70-14": { recommended: "235/70R14", alternatives: ["225/70R14", "245/70R14"] },
  "HR70-15": { recommended: "255/70R15", alternatives: ["245/70R15", "255/60R15"] },
  "HR78-14": { recommended: "235/75R14", alternatives: ["225/75R14", "245/75R14"] },
  "HR78-15": { recommended: "235/75R15", alternatives: ["225/75R15", "245/75R15"] },
  "JR78-15": { recommended: "245/75R15", alternatives: ["235/75R15", "255/75R15"] },
  "LR70-15": { recommended: "275/70R15", alternatives: ["265/70R15", "285/70R15"] },
  "LR78-15": { recommended: "255/75R15", alternatives: ["245/75R15", "265/75R15"] },
  
  // Performance/specialty
  "P225/70R15": { recommended: "225/70R15", alternatives: [] }, // Already modern, passthrough
  "P255/60R15": { recommended: "255/60R15", alternatives: [] },
};

// ============================================================================
// FORMULA CONVERSION - Width Letter Mapping (Priority 2)
// ============================================================================

const WIDTH_LETTER_MAP: Record<string, number> = {
  'A': 155,
  'B': 165,
  'C': 175,
  'D': 185,
  'E': 195,
  'F': 205,
  'G': 215,
  'H': 225,
  'I': 235,
  'J': 245,
  'K': 255, // rare
  'L': 255,
  'M': 265, // rare
  'N': 275, // rare
};

// Aspect ratio family mappings
const ASPECT_RATIO_MAP: Record<string, number> = {
  '60': 60,
  '70': 70, // primary
  '75': 75, // fallback for 70
  '78': 75, // 78 → 75 modern equivalent
  '80': 80,
  '82': 80, // rare, map to 80
};

// ============================================================================
// LEGACY SIZE DETECTION
// ============================================================================

/**
 * Detect if a tire size is a legacy (pre-metric) format
 */
export function isLegacyTireSize(size: string): boolean {
  if (!size) return false;
  
  const normalized = size.toUpperCase().trim();
  
  // Already modern P-metric format (P205/55R16, 225/45R17, LT265/70R17)
  if (/^(P|LT)?\d{3}\/\d{2}R\d{2}/.test(normalized)) {
    return false;
  }
  
  // Legacy patterns:
  // Letter + number + dash + number: E70-14, G60-15, H78-15
  // Two letters + number + dash + number: GR70-15, HR78-14
  if (/^[A-L]R?\d{2}-\d{2}$/.test(normalized)) {
    return true;
  }
  
  // With R designation: BR70-13, GR78-15
  if (/^[A-L]R\d{2}-\d{2}$/.test(normalized)) {
    return true;
  }
  
  return false;
}

// ============================================================================
// FORMULA-BASED CONVERSION
// ============================================================================

interface ParsedLegacySize {
  widthLetter: string;
  aspectFamily: string;
  rimDiameter: number;
  isRadial: boolean;
}

function parseLegacySize(size: string): ParsedLegacySize | null {
  const normalized = size.toUpperCase().trim();
  
  // Match patterns like: E70-14, GR70-15, H78-14
  const match = normalized.match(/^([A-L])(R)?(\d{2})-(\d{2})$/);
  if (!match) return null;
  
  return {
    widthLetter: match[1],
    isRadial: match[2] === 'R',
    aspectFamily: match[3],
    rimDiameter: parseInt(match[4], 10),
  };
}

function convertByFormula(size: string): LegacyTireConversion | null {
  const parsed = parseLegacySize(size);
  if (!parsed) return null;
  
  const width = WIDTH_LETTER_MAP[parsed.widthLetter];
  if (!width) return null;
  
  // Determine aspect ratio
  let aspect = ASPECT_RATIO_MAP[parsed.aspectFamily];
  if (!aspect) {
    // Default fallback
    aspect = 75;
  }
  
  const recommended = `${width}/${aspect}R${parsed.rimDiameter}`;
  
  // Generate alternatives (±10mm width, and alternate aspect if applicable)
  const alternatives: string[] = [];
  
  // Wider option
  const widerWidth = width + 10;
  if (widerWidth <= 275) {
    alternatives.push(`${widerWidth}/${aspect}R${parsed.rimDiameter}`);
  }
  
  // Narrower option
  const narrowerWidth = width - 10;
  if (narrowerWidth >= 155) {
    alternatives.push(`${narrowerWidth}/${aspect}R${parsed.rimDiameter}`);
  }
  
  // Alternate aspect for 70/78 series
  if (parsed.aspectFamily === '70' && aspect === 70) {
    alternatives.push(`${width}/75R${parsed.rimDiameter}`);
  } else if (parsed.aspectFamily === '78' && aspect === 75) {
    alternatives.push(`${width}/80R${parsed.rimDiameter}`);
  }
  
  return {
    original: size,
    isLegacy: true,
    conversionMethod: 'formula',
    recommended,
    alternatives: [...new Set(alternatives)], // dedupe
    notes: `Formula conversion: ${parsed.widthLetter}=${width}mm, ${parsed.aspectFamily}→${aspect} aspect`,
  };
}

// ============================================================================
// MAIN CONVERSION FUNCTION
// ============================================================================

/**
 * Convert a legacy tire size to modern P-metric equivalent
 * 
 * @param size - Original tire size (e.g., "G70-15", "E70-14", "225/70R15")
 * @returns Conversion result with recommended size and alternatives
 */
export function convertLegacyTireSize(size: string): LegacyTireConversion {
  if (!size) {
    return {
      original: size,
      isLegacy: false,
      conversionMethod: 'none',
      recommended: size,
      alternatives: [],
    };
  }
  
  const normalized = size.toUpperCase().trim();
  
  // Check if already modern format
  if (!isLegacyTireSize(normalized)) {
    // Clean up P-metric format if needed
    const cleaned = normalized.replace(/^P/, '');
    return {
      original: size,
      isLegacy: false,
      conversionMethod: 'none',
      recommended: cleaned,
      alternatives: [],
    };
  }
  
  // Priority 1: Lookup table
  const lookupResult = LEGACY_TIRE_LOOKUP[normalized];
  if (lookupResult) {
    return {
      original: size,
      isLegacy: true,
      conversionMethod: 'lookup',
      recommended: lookupResult.recommended,
      alternatives: lookupResult.alternatives,
    };
  }
  
  // Priority 2: Formula conversion
  const formulaResult = convertByFormula(normalized);
  if (formulaResult) {
    return formulaResult;
  }
  
  // Fallback: Return original
  return {
    original: size,
    isLegacy: true,
    conversionMethod: 'none',
    recommended: size,
    alternatives: [],
    notes: 'Unknown legacy format - manual lookup required',
  };
}

// ============================================================================
// BATCH CONVERSION FOR FITMENT DATA
// ============================================================================

/**
 * Convert an array of OEM tire sizes, handling both legacy and modern formats
 */
export function convertTireSizesForSearch(sizes: string[]): {
  searchSizes: string[];
  displayMap: Map<string, { original: string; converted: string; isLegacy: boolean }>;
} {
  const searchSizes: string[] = [];
  const displayMap = new Map<string, { original: string; converted: string; isLegacy: boolean }>();
  
  for (const size of sizes) {
    const conversion = convertLegacyTireSize(size);
    
    // Add recommended size for search
    if (conversion.recommended && !searchSizes.includes(conversion.recommended)) {
      searchSizes.push(conversion.recommended);
    }
    
    // Add alternatives for broader search
    for (const alt of conversion.alternatives) {
      if (!searchSizes.includes(alt)) {
        searchSizes.push(alt);
      }
    }
    
    // Track for display
    displayMap.set(size, {
      original: size,
      converted: conversion.recommended,
      isLegacy: conversion.isLegacy,
    });
  }
  
  return { searchSizes, displayMap };
}

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

export const _testing = {
  LEGACY_TIRE_LOOKUP,
  WIDTH_LETTER_MAP,
  ASPECT_RATIO_MAP,
  parseLegacySize,
  convertByFormula,
};
