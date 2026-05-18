/**
 * Canonical Model Alias Configuration
 * 
 * SINGLE SOURCE OF TRUTH for model name aliases.
 * Import this in coverage.ts, profileService.ts, and getFitment.ts
 * 
 * Rules:
 * 1. Keys are URL-friendly slugs (what users might type)
 * 2. Values are RAW database model names (exact DB matches)
 * 3. Exact matches always win over aliases
 * 4. Aliases are tried in array order
 */

export const MODEL_ALIASES: Record<string, string[]> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // FORD SUPER DUTY
  // DB stores "f-250", "f-350", "f-450" (short form)
  // URLs/selectors often show "f-250-super-duty" (long form)
  // Map BOTH directions to ensure coverage
  // ═══════════════════════════════════════════════════════════════════════════
  "f-250": ["f-250-super-duty"],
  "f-250-super-duty": ["f-250"],  // Reverse alias - selector might send this
  "f-350": ["f-350-super-duty"],
  "f-350-super-duty": ["f-350"],  // Reverse alias
  "f-450": ["f-450-super-duty"],
  "f-450-super-duty": ["f-450"],  // Reverse alias

  // ═══════════════════════════════════════════════════════════════════════════
  // CHRYSLER 300
  // DB has both "300" and "300c" - bidirectional aliases
  // ═══════════════════════════════════════════════════════════════════════════
  "300": ["300c", "300s", "300m"],
  "300c": ["300"],

  // ═══════════════════════════════════════════════════════════════════════════
  // CHEVROLET HD TRUCKS
  // DB has multiple formats: silverado-2500hd, silverado-2500-hd, silverado-2500
  // Need bidirectional aliases for all common user inputs
  // ═══════════════════════════════════════════════════════════════════════════
  "silverado": ["silverado-1500"],
  "silverado-2500": ["silverado-2500hd", "silverado-2500-hd"],
  "silverado-2500hd": ["silverado-2500", "silverado-2500-hd"],  // Reverse alias
  "silverado-2500-hd": ["silverado-2500hd", "silverado-2500"],  // Reverse alias - fixes selector
  "silverado-3500": ["silverado-3500hd", "silverado-3500-hd"],
  "silverado-3500hd": ["silverado-3500", "silverado-3500-hd"],  // Reverse alias
  "silverado-3500-hd": ["silverado-3500hd", "silverado-3500"],  // Reverse alias - fixes selector

  // ═══════════════════════════════════════════════════════════════════════════
  // GMC HD TRUCKS  
  // Same bidirectional pattern as Chevrolet
  // ═══════════════════════════════════════════════════════════════════════════
  "sierra": ["sierra-1500"],
  "sierra-2500": ["sierra-2500hd", "sierra-2500-hd"],
  "sierra-2500hd": ["sierra-2500", "sierra-2500-hd"],  // Reverse alias
  "sierra-2500-hd": ["sierra-2500hd", "sierra-2500"],  // Reverse alias - fixes selector
  "sierra-3500": ["sierra-3500hd", "sierra-3500-hd"],
  "sierra-3500hd": ["sierra-3500", "sierra-3500-hd"],  // Reverse alias
  "sierra-3500-hd": ["sierra-3500hd", "sierra-3500"],  // Reverse alias - fixes selector

  // ═══════════════════════════════════════════════════════════════════════════
  // RAM TRUCKS
  // DB uses model numbers directly (1500, 2500, 3500)
  // ═══════════════════════════════════════════════════════════════════════════
  "ram": ["ram-1500"],
  "ram-2500": ["2500"],
  "ram-3500": ["3500"],

  // ═══════════════════════════════════════════════════════════════════════════
  // MAZDA NAMING VARIATIONS
  // DB stores "Mazda6" and "Mazda3" (no space)
  // Users might search "Mazda 6" or "Mazda 3" (with space)
  // ═══════════════════════════════════════════════════════════════════════════
  "mazda-6": ["mazda6"],
  "mazda6": ["mazda-6"],  // Reverse alias
  "mazda-3": ["mazda3"],
  "mazda3": ["mazda-3"],  // Reverse alias

  // ═══════════════════════════════════════════════════════════════════════════
  // CHEVROLET BOLT VARIATIONS
  // DB stores "Bolt Ev" and "Bolt Euv"
  // Users might search just "Bolt"
  // ═══════════════════════════════════════════════════════════════════════════
  "bolt": ["bolt-ev", "bolt-euv"],
  "bolt-ev": ["bolt", "bolt ev"],
  "bolt-euv": ["bolt", "bolt euv"],

  // ═══════════════════════════════════════════════════════════════════════════
  // HYUNDAI IONIQ VARIATIONS
  // DB stores "Ioniq 5" and "Ioniq 6" (with space)
  // Users might search "IONIQ5", "Ioniq-5", or "IONIQ 5"
  // ═══════════════════════════════════════════════════════════════════════════
  "ioniq5": ["ioniq-5", "ioniq 5"],
  "ioniq-5": ["ioniq5", "ioniq 5"],
  "ioniq6": ["ioniq-6", "ioniq 6"],
  "ioniq-6": ["ioniq6", "ioniq 6"],

  // ═══════════════════════════════════════════════════════════════════════════
  // MERCEDES-BENZ AMG VARIATIONS
  // DB stores "C Class Amg", "E Class Amg", "S Class Amg", etc.
  // Users might search "AMG C 43", "C43 AMG", "AMG C-Class", etc.
  // ═══════════════════════════════════════════════════════════════════════════
  // C-Class AMG variations
  "c-class-amg": ["c class amg"],
  "c-class": ["c class"],
  "amg-c-43": ["c-class-amg", "c class amg", "c43-amg"],
  "amg-c-63": ["c-class-amg", "c class amg", "c63-amg"],
  "c43-amg": ["c-class-amg", "c class amg", "amg-c-43"],
  "c63-amg": ["c-class-amg", "c class amg", "amg-c-63"],
  "amg-c43": ["c-class-amg", "c class amg"],
  "amg-c63": ["c-class-amg", "c class amg"],
  
  // E-Class AMG variations  
  "e-class-amg": ["e class amg"],
  "e-class": ["e class"],
  "amg-e-53": ["e-class-amg", "e class amg"],
  "amg-e-63": ["e-class-amg", "e class amg"],
  "e53-amg": ["e-class-amg", "e class amg"],
  "e63-amg": ["e-class-amg", "e class amg"],
  
  // S-Class AMG variations
  "s-class-amg": ["s class amg"],
  "s-class": ["s class"],
  "amg-s-63": ["s-class-amg", "s class amg"],
  "s63-amg": ["s-class-amg", "s class amg"],
  
  // GLA/GLB/GLC/GLE/GLS AMG variations
  "gla-class-amg": ["gla class amg"],
  "glc-class-coupe": ["glc class coupe"],
  "gle-class-coupe": ["gle class coupe"],
  
  // CLA/CLS variations
  "cla-class": ["cla class", "cla"],
  "cla-class-amg": ["cla class amg"],
  "cls-class": ["cls class"],
  "cls-class-amg": ["cls class amg"],
  
  // AMG GT (standalone model)
  "amg-gt": ["amg gt"],
  
  // A-Class AMG
  "a-class-amg": ["a class amg"],
  
  // G-Class variations
  "g-class": ["g class"],
  "g-class-amg": ["g class amg"],
  "amg-g-63": ["g-class-amg", "g class amg"],
  "g63-amg": ["g-class-amg", "g class amg"],
  
  // SL-Class AMG
  "sl-class-amg": ["sl class amg"],

  // ═══════════════════════════════════════════════════════════════════════════
  // BMW MODEL NUMBER → SERIES MAPPINGS
  // Users commonly search "328i" but DB stores "3 Series" with trim "328i"
  // NOTE: DB stores with capital S (e.g., "3 Series"), values here are RAW DB names
  // The query uses ILIKE so case doesn't matter, but spaces do
  // ═══════════════════════════════════════════════════════════════════════════
  // 2-Series (includes M2)
  "228i": ["2 Series", "2 series"],
  "230i": ["2 Series", "2 series"],
  "m240i": ["2 Series", "2 series"],
  
  // 3-Series - most common confusion
  "318i": ["3 Series", "3 series"],
  "320i": ["3 Series", "3 series"],
  "323i": ["3 Series", "3 series"],
  "325i": ["3 Series", "3 series"],
  "328i": ["3 Series", "3 series"],
  "330i": ["3 Series", "3 series"],
  "335i": ["3 Series", "3 series"],
  "340i": ["3 Series", "3 series"],
  "m340i": ["3 Series", "3 series"],
  "328xi": ["3 Series", "3 series"],
  "330xi": ["3 Series", "3 series"],
  "335xi": ["3 Series", "3 series"],
  "328i-xdrive": ["3 Series", "3 series"],
  "330i-xdrive": ["3 Series", "3 series"],
  "335i-xdrive": ["3 Series", "3 series"],
  
  // 4-Series
  "428i": ["4 Series", "4 series"],
  "430i": ["4 Series", "4 series"],
  "435i": ["4 Series", "4 series"],
  "440i": ["4 Series", "4 series"],
  "m440i": ["4 Series", "4 series"],
  
  // 5-Series
  "525i": ["5 Series", "5 series"],
  "528i": ["5 Series", "5 series"],
  "530i": ["5 Series", "5 series"],
  "535i": ["5 Series", "5 series"],
  "540i": ["5 Series", "5 series"],
  "545i": ["5 Series", "5 series"],
  "550i": ["5 Series", "5 series"],
  "m550i": ["5 Series", "5 series"],
  
  // 6-Series
  "640i": ["6 Series", "6 series"],
  "650i": ["6 Series", "6 series"],
  
  // 7-Series
  "740i": ["7 Series", "7 series"],
  "745i": ["7 Series", "7 series"],
  "750i": ["7 Series", "7 series"],
  "760i": ["7 Series", "7 series"],
  
  // 8-Series
  "840i": ["8 Series", "8 series"],
  "850i": ["8 Series", "8 series"],
  
  // X-Series (SUVs) - often searched without "X"
  "x1": ["X1"],
  "x2": ["X2"],
  "x3": ["X3"],
  "x4": ["X4"],
  "x5": ["X5"],
  "x6": ["X6"],
  "x7": ["X7"],
};

/**
 * GM HD TRUCK RICH MODEL PRIORITY
 * 
 * The "hd" variants (no hyphen) have richer trim data than "-hd" variants.
 * Always prioritize these in query order to get better trim options.
 */
const HD_RICH_PRIORITY: Record<string, string> = {
  "silverado-2500-hd": "silverado-2500hd",
  "silverado-3500-hd": "silverado-3500hd",
  "sierra-2500-hd": "sierra-2500hd",
  "sierra-3500-hd": "sierra-3500hd",
};

/**
 * Get all model names to search (input + aliases)
 * Returns array suitable for SQL IN clause or iteration.
 * 
 * IMPORTANT (2026-05-13 fix): DB stores model names in various formats:
 * - "f-150 lightning" (spaces)
 * - "Silverado 2500 HD" (title case with spaces)
 * - "tacoma" (lowercase)
 * 
 * The models API returns display names like "F-150 Lightning" which users
 * then send to trims API. We need to match both the original (with spaces)
 * and slugified (with hyphens) versions.
 * 
 * @param model - User input model name (e.g., "F-150 Lightning")
 * @returns Array of model names to try (prioritized for data richness)
 */
export function getModelVariants(model: string): string[] {
  // Preserve the original input (just lowercase) - this matches DB format with spaces
  const lowercased = model.toLowerCase().trim();
  
  // Slugify the input (lowercase, hyphens for non-alphanumeric)
  const slugified = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  
  // Get aliases (these are RAW DB names, not normalized)
  const aliases = MODEL_ALIASES[slugified] || [];
  
  // Check if this is an HD truck with sparse data - prioritize rich variant
  const richVariant = HD_RICH_PRIORITY[slugified];
  if (richVariant) {
    // Put rich variant FIRST, then original (with spaces), then slugified, then other aliases
    const others = aliases.filter(a => a !== richVariant);
    const variants = [richVariant, lowercased, slugified, ...others];
    // Dedupe while preserving order
    return [...new Set(variants)];
  }
  
  // Try original first (with spaces), then slugified, then aliases
  const variants = [lowercased, slugified, ...aliases];
  // Dedupe while preserving order
  return [...new Set(variants)];
}

/**
 * Check if a lookup used an alias (for logging)
 */
export function wasAliasUsed(requestedModel: string, foundModel: string): boolean {
  const slugified = requestedModel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slugified !== foundModel && (MODEL_ALIASES[slugified]?.includes(foundModel) ?? false);
}

/**
 * Get all defined aliases for documentation/audit
 */
export function getAllAliases(): Record<string, string[]> {
  return { ...MODEL_ALIASES };
}

// ═══════════════════════════════════════════════════════════════════════════
// BMW MODEL NUMBER EXTRACTION (2026-05-18)
// 
// BMW uses model numbers like "328i", "535i", "750Li" that are actually:
// - Model: X Series (where X is the first digit)
// - Trim: The full number (328i, 535i, etc.)
//
// This function extracts both when the input appears to be a BMW model number.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * BMW model number patterns:
 * - 3-digit number followed by optional suffix: 328, 328i, 328xi, 328d, M340i
 * - First digit indicates series: 3xx = 3 Series, 5xx = 5 Series, etc.
 * - Suffixes: i (injection), d (diesel), e (electric/PHEV), xi/xDrive (AWD)
 * - M variants: M3, M4, M5, M340i, M550i (performance)
 * - X variants: X1, X3, X5, etc. (SUVs) - NOT handled here, they're direct models
 */
const BMW_MODEL_NUMBER_PATTERN = /^([mM]?)(\d)(\d{2})([a-zA-Z]*)$/;
const BMW_M_SERIES_PATTERN = /^[mM](\d)$/;  // M3, M4, M5, etc.

export interface BmwModelExtraction {
  /** Whether the input was recognized as a BMW model number */
  isBmwModelNumber: boolean;
  /** The series model name (e.g., "3 Series", "5 Series") */
  modelName: string | null;
  /** The trim to search for (e.g., "328i", "M340i") */
  trimName: string | null;
  /** Original input, normalized */
  originalInput: string;
}

/**
 * Extract BMW model and trim from a model number input.
 * 
 * Examples:
 * - "328i" → model: "3 Series", trim: "328i"
 * - "328xi" → model: "3 Series", trim: "328xi"
 * - "335i" → model: "3 Series", trim: "335i"
 * - "535i" → model: "5 Series", trim: "535i"
 * - "750Li" → model: "7 Series", trim: "750Li"
 * - "M340i" → model: "3 Series", trim: "M340i"
 * - "M3" → model: "M3", trim: null (M3 is its own model)
 * - "X5" → not handled (X5 is a direct model name)
 * - "3 Series" → not a model number, return as-is
 * 
 * @param make - Vehicle make (only applies to BMW)
 * @param model - User input model (e.g., "328i")
 * @returns Extraction result with model and trim
 */
export function extractBmwModelAndTrim(make: string, model: string): BmwModelExtraction {
  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.trim();
  
  // Only applies to BMW
  if (normalizedMake !== "bmw") {
    return {
      isBmwModelNumber: false,
      modelName: null,
      trimName: null,
      originalInput: normalizedModel,
    };
  }
  
  // Check for M-series standalone models (M3, M4, M5, M6, M8)
  // These are their own models in the DB, not trims
  const mSeriesMatch = normalizedModel.match(BMW_M_SERIES_PATTERN);
  if (mSeriesMatch) {
    return {
      isBmwModelNumber: false,  // M3/M4/etc are direct models, not model numbers
      modelName: null,
      trimName: null,
      originalInput: normalizedModel,
    };
  }
  
  // Check for standard BMW model number pattern
  // Examples: 328i, 335i, 528i, 750Li, M340i, 330e
  const modelMatch = normalizedModel.match(BMW_MODEL_NUMBER_PATTERN);
  if (modelMatch) {
    const [, mPrefix, seriesDigit, , suffix] = modelMatch;
    const series = parseInt(seriesDigit, 10);
    
    // Valid series: 1, 2, 3, 4, 5, 6, 7, 8
    if (series >= 1 && series <= 8) {
      const seriesName = `${series} Series`;
      // Preserve original casing for the trim name
      const trimName = normalizedModel;
      
      console.log(`[modelAliases] BMW model number extracted: "${model}" → model="${seriesName}", trim="${trimName}"`);
      
      return {
        isBmwModelNumber: true,
        modelName: seriesName,
        trimName: trimName,
        originalInput: normalizedModel,
      };
    }
  }
  
  // Also handle variants with xDrive suffix: "328i xDrive", "330i xDrive"
  const xDriveMatch = normalizedModel.match(/^([mM]?)(\d)(\d{2})([a-zA-Z]*)\s*[xX][Dd]rive$/i);
  if (xDriveMatch) {
    const [, , seriesDigit] = xDriveMatch;
    const series = parseInt(seriesDigit, 10);
    
    if (series >= 1 && series <= 8) {
      const seriesName = `${series} Series`;
      // Normalize xDrive casing
      const trimName = normalizedModel.replace(/[xX][Dd]rive/i, "xDrive");
      
      console.log(`[modelAliases] BMW xDrive model extracted: "${model}" → model="${seriesName}", trim="${trimName}"`);
      
      return {
        isBmwModelNumber: true,
        modelName: seriesName,
        trimName: trimName,
        originalInput: normalizedModel,
      };
    }
  }
  
  // Not a recognized BMW model number pattern
  return {
    isBmwModelNumber: false,
    modelName: null,
    trimName: null,
    originalInput: normalizedModel,
  };
}
