/**
 * Vehicle Display Helpers
 * 
 * Separates internal fitment params from customer-facing display labels.
 * Never shows raw engine text (like "5.7i") as a trim label.
 */

/**
 * Patterns that indicate engine/technical text rather than a submodel name.
 * These should NOT be displayed as customer-facing trim labels.
 */
const ENGINE_PATTERNS = [
  // Displacement patterns (most common)
  /^\d+\.\d+[a-z]?$/i,           // 5.7i, 3.5, 2.0T, 5.7
  /^\d+\.\d+L$/i,                // 5.7L, 3.5L
  /^\d+\.\d+\s*L$/i,             // 5.7 L (with space)
  /^\d+L$/i,                     // 3L, 5L (no decimal)
  
  // V-engine patterns
  /^V\d+$/i,                     // V6, V8, V10, V12
  /^V-?\d+$/i,                   // V-6, V-8
  /^I\d$/i,                      // I4, I6 (inline engines)
  /^Inline[- ]?\d$/i,            // Inline-4, Inline 6
  /^Flat[- ]?\d$/i,              // Flat-4, Flat-6 (Subaru/Porsche)
  
  // Cubic inch displacement (American classics)
  /^\d{3}$/,                     // 350, 454, 302, 351
  /^\d{3}[a-z]?$/i,              // 350i, 454ci
  
  // Engine codes
  /^[A-Z]?\d{2,4}[a-z]?$/i,      // LS1, LT1, K24, 2JZ
  /^[A-Z]{2}\d{1,2}$/i,          // SR20, RB26, JZ
  /^LS\d?$/i,                    // LS, LS1, LS2, LS3, LS6, LS7
  /^LT\d?$/i,                    // LT, LT1, LT4, LT5
  /^LM\d$/i,                     // LM7, LM4 (truck engines)
  /^L\d{2}$/i,                   // L76, L99 (GM engines)
  /^VQ\d{2}$/i,                  // VQ35, VQ37 (Nissan)
  /^2JZ/i,                       // 2JZ-GTE, 2JZ-GE
  /^RB\d{2}/i,                   // RB26, RB25 (Nissan)
  /^SR\d{2}/i,                   // SR20 (Nissan)
  /^B\d{2}[A-Z]?$/i,             // B18, B16A (Honda)
  /^K\d{2}[A-Z]?$/i,             // K20, K24A (Honda)
  /^EJ\d{2,3}$/i,                // EJ25, EJ257 (Subaru)
  /^FA\d{2}$/i,                  // FA20 (Subaru/Toyota)
  
  // Turbo/forced induction
  /^Turbo$/i,                    // Turbo
  /^\d+\.\d+\s*Turbo$/i,         // 2.0 Turbo
  /^\d+\.\d+T$/i,                // 2.0T (turbo designation)
  /^Twin\s*Turbo$/i,             // Twin Turbo
  /^Bi-?Turbo$/i,                // BiTurbo, Bi-Turbo
  /^Supercharged$/i,             // Supercharged
  /^SC$/i,                       // SC (supercharged abbreviation)
  
  // Branded engine names
  /^EcoBoost$/i,                 // Ford EcoBoost
  /^HEMI$/i,                     // Chrysler/Dodge HEMI
  /^Coyote$/i,                   // Ford Coyote
  /^Voodoo$/i,                   // Ford Voodoo (GT350)
  /^Predator$/i,                 // Ford Predator (GT500)
  /^Godzilla$/i,                 // Ford 7.3L
  /^Pentastar$/i,                // Chrysler Pentastar
  /^Triton$/i,                   // Ford Triton
  /^Modular$/i,                  // Ford Modular
  /^PowerStroke$/i,              // Ford PowerStroke diesel
  /^Duramax$/i,                  // GM Duramax diesel
  /^Cummins$/i,                  // Cummins diesel
  /^TDI$/i,                      // VW/Audi TDI diesel
  /^CDI$/i,                      // Mercedes CDI diesel
  /^BlueTEC$/i,                  // Mercedes BlueTEC diesel
  /^SkyActiv$/i,                 // Mazda SkyActiv
  /^VTEC$/i,                     // Honda VTEC
  /^VVT-?i$/i,                   // Toyota VVT-i
  /^Duratec$/i,                  // Ford Duratec
  /^Zetec$/i,                    // Ford Zetec
  
  // Fuel types (standalone)
  /^Diesel$/i,                   // Diesel
  /^Hybrid$/i,                   // Hybrid
  /^Electric$/i,                 // Electric
  /^PHEV$/i,                     // Plug-in Hybrid
  /^BEV$/i,                      // Battery Electric
  /^CNG$/i,                      // Compressed Natural Gas
  /^FFV$/i,                      // Flex Fuel Vehicle
  
  // Combined patterns
  /^\d+\.\d+[a-z]*\s*\/\s*\d+\.\d+[a-z]*$/i, // 5.7i / 3.8L (combined engine options)
  /^\d+\.\d+[a-z]*\s+[A-Z]+$/i,  // 5.7i V8, 3.5L V6
  /^[A-Z]+\s+\d+\.\d+$/i,        // V8 5.7
];

/**
 * Patterns that indicate a real submodel/trim name.
 * These ARE appropriate for customer-facing display.
 */
const SUBMODEL_PATTERNS = [
  /Base/i,
  /Sport/i,
  /Limited/i,
  /Premium/i,
  /Touring/i,
  /XLT/i,
  /Lariat/i,
  /Platinum/i,
  /King\s*Ranch/i,
  /Raptor/i,
  /Tremor/i,
  /Z28/i,
  /SS$/i,
  /RS$/i,
  /ZL1/i,
  /GT$/i,
  /GT-R/i,
  /Shelby/i,
  /Mach\s*\d/i,
  /SRT/i,
  /R\/T/i,
  /Hellcat/i,
  /Demon/i,
  /Scat\s*Pack/i,
  /Trail\s*Boss/i,
  /High\s*Country/i,
  /Denali/i,
  /AT4/i,
  /Elevation/i,
  /\bSEL\b/i,   // SEL as word (not substring of "Diesel")
  /\bSE\b/i,    // SE as word (not substring)
  /\bLE\b/i,    // LE as word
  /\bXLE\b/i,   // XLE as word
  /TRD/i,
  /SR5/i,
  /Trail/i,
  /Off-Road/i,
  /Pro$/i,
  /Overland/i,
  /Rubicon/i,
  /Sahara/i,
  /Willys/i,
  /Laredo/i,
  /Summit/i,
  /Trailhawk/i,
  /SL$/i,
  /SV$/i,
  /Midnight/i,
  /Harley/i,
  /FX\d/i,
  /STX/i,
  /XL$/i,
  /4x4/i,
  /AWD/i,
  /RWD/i,
  /2WD/i,
  /Crew\s*Cab/i,
  /Double\s*Cab/i,
  /Quad\s*Cab/i,
  /Regular\s*Cab/i,
  /Extended\s*Cab/i,
  /SuperCrew/i,
  /SuperCab/i,
  /Coupe/i,
  /Sedan/i,
  /Convertible/i,
  /Hatchback/i,
  /Wagon/i,
];

/**
 * Check if a string looks like a raw modificationId (hex hash or supplement ID).
 * These should NEVER be displayed to customers.
 */
export function isModificationId(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  
  // Supplement IDs: s_xxxxxxxx (8 hex chars after s_)
  if (/^s_[a-f0-9]{8}$/i.test(trimmed)) return true;
  
  // Wheel-Size API hex slugs: 10 hex characters
  if (/^[a-f0-9]{10}$/i.test(trimmed)) return true;
  
  // Generic hex strings (8+ chars, all hex)
  if (/^[a-f0-9]{8,}$/i.test(trimmed)) return true;
  
  return false;
}

/**
 * Check if a string looks like engine/technical text rather than a submodel name.
 */
export function isEngineLikeText(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  
  // First check if it's a modification ID (hex hash)
  if (isModificationId(trimmed)) return true;
  
  // Check if it matches engine patterns
  for (const pattern of ENGINE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  
  // If it's very short and all numbers/dots, likely engine
  if (/^[\d.]+$/.test(trimmed) && trimmed.length <= 5) return true;
  
  return false;
}

/**
 * Check if a string looks like a real submodel/trim name.
 */
export function isSubmodelLikeText(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  
  // Check if it matches known submodel patterns
  for (const pattern of SUBMODEL_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  
  // If it's a reasonable length word that isn't engine-like, probably OK
  if (trimmed.length >= 3 && /^[A-Za-z][A-Za-z0-9\s-]+$/.test(trimmed) && !isEngineLikeText(trimmed)) {
    return true;
  }
  
  return false;
}

/**
 * Extract the display-appropriate part from a trim label.
 * If the label contains both submodel and engine (e.g., "Z28 / 5.7i"),
 * return just the submodel part.
 */
export function extractDisplayTrim(label: string): string | null {
  if (!label || typeof label !== "string") return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  
  // If it's engine text, return null UNLESS it also matches a strong submodel pattern
  // Engine detection takes priority - we'd rather omit than show "5.7i"
  if (isEngineLikeText(trimmed)) {
    // Only allow through if it ALSO matches a known submodel pattern (e.g., "Z28")
    if (!isSubmodelLikeText(trimmed)) {
      return null;
    }
    // For ambiguous cases like "Z28" (which looks like an engine code but is a trim),
    // isSubmodelLikeText will return true because it matches SUBMODEL_PATTERNS
  }
  
  // If it contains a separator (/ or ,), try to find the submodel part
  if (trimmed.includes("/") || trimmed.includes(",")) {
    const parts = trimmed.split(/[\/,]/).map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (isSubmodelLikeText(part) && !isEngineLikeText(part)) {
        return part;
      }
    }
    // If no good part found but first part isn't engine-like, use it
    if (parts.length > 0 && !isEngineLikeText(parts[0])) {
      return parts[0];
    }
    return null;
  }
  
  // Single value - return if it's submodel-like, null if engine-like
  if (isSubmodelLikeText(trimmed)) return trimmed;
  if (isEngineLikeText(trimmed)) return null;
  
  // Default: if it's not obviously engine text, return it
  return trimmed;
}

export type VehicleDisplayInput = {
  year?: string | number;
  make?: string;
  model?: string;
  trim?: string;           // Raw query param (may contain engine text)
  submodel?: string;       // From fitment profile (preferred)
  displayTrim?: string;    // Explicit display override
};

/**
 * Build a customer-facing vehicle label.
 * 
 * Priority order:
 * 1. Explicit displayTrim if provided
 * 2. Submodel from fitment profile
 * 3. Extracted submodel from trim param (if not engine-like)
 * 4. Omit trim entirely if only engine text available
 */
export function getVehicleDisplayLabel(input: VehicleDisplayInput): string {
  const { year, make, model, trim, submodel, displayTrim } = input;
  
  // Build base: year make model
  const parts: string[] = [];
  if (year) parts.push(String(year));
  if (make) parts.push(String(make));
  if (model) parts.push(String(model));
  
  const base = parts.join(" ");
  if (!base.trim()) return "";
  
  // Determine trim to display
  let trimToShow: string | null = null;
  
  // Priority 1: Explicit display override
  if (displayTrim && !isEngineLikeText(displayTrim)) {
    trimToShow = displayTrim;
  }
  // Priority 2: Submodel from fitment
  else if (submodel && !isEngineLikeText(submodel)) {
    trimToShow = submodel;
  }
  // Priority 3: Extract from trim param
  else if (trim) {
    trimToShow = extractDisplayTrim(trim);
  }
  
  // Build final label
  if (trimToShow) {
    return `${base} ${trimToShow}`;
  }
  return base;
}

/**
 * Get just the trim portion for display, or empty string if none appropriate.
 * 
 * Runs ALL candidate fields through extractDisplayTrim() to ensure mixed
 * values like "Z28 / 5.7i" are cleaned to just "Z28".
 * 
 * @param input Vehicle display input
 * @param options Additional options
 * @param options.skipBase If true, returns empty string for "Base" trim (premium UX mode)
 */
export function getDisplayTrim(
  input: VehicleDisplayInput,
  options?: { skipBase?: boolean }
): string {
  const candidates = [
    input.displayTrim,
    input.submodel,
    input.trim,
  ];
  
  for (const candidate of candidates) {
    const cleaned = extractDisplayTrim(candidate ?? "");
    if (cleaned) {
      // When skipBase is true, don't return "Base" or similar
      if (options?.skipBase) {
        const lower = cleaned.toLowerCase().trim();
        if (lower === "base" || lower === "default" || lower === "standard") {
          continue; // Skip this candidate, try next
        }
      }
      return cleaned;
    }
  }
  
  return "";
}
