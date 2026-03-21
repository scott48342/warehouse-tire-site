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
  /^\d+\.\d+[a-z]?$/i,           // 5.7i, 3.5, 2.0T
  /^\d+\.\d+L?$/i,               // 5.7L, 3.5L
  /^V\d+$/i,                     // V6, V8
  /^\d+[a-z]?$/i,                // 350, 454
  /^[A-Z]?\d{3,4}[a-z]?$/i,      // LS1, LT1, K24
  /^Turbo$/i,                    // Turbo
  /^\d+\.\d+\s*Turbo$/i,         // 2.0 Turbo
  /^Supercharged$/i,             // Supercharged
  /^Hybrid$/i,                   // Hybrid (sometimes OK, but ambiguous)
  /^Diesel$/i,                   // Diesel
  /^EcoBoost$/i,                 // EcoBoost
  /^HEMI$/i,                     // HEMI
  /^Coyote$/i,                   // Coyote (engine name)
  /^LS\d?$/i,                    // LS, LS1, LS3
  /^LT\d?$/i,                    // LT, LT1, LT4
  /^\d+\.\d+[a-z]*\s*\/\s*\d+\.\d+[a-z]*$/i, // 5.7i / 3.8L (combined engine options)
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
  /SEL/i,
  /SE$/i,
  /LE$/i,
  /XLE/i,
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
 * Check if a string looks like engine/technical text rather than a submodel name.
 */
export function isEngineLikeText(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  
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
  
  // If it's purely engine text, return null (don't display)
  if (isEngineLikeText(trimmed) && !isSubmodelLikeText(trimmed)) {
    return null;
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
 */
export function getDisplayTrim(input: VehicleDisplayInput): string {
  const { trim, submodel, displayTrim } = input;
  
  // Priority 1: Explicit display override
  if (displayTrim && !isEngineLikeText(displayTrim)) {
    return displayTrim;
  }
  // Priority 2: Submodel from fitment
  if (submodel && !isEngineLikeText(submodel)) {
    return submodel;
  }
  // Priority 3: Extract from trim param
  if (trim) {
    return extractDisplayTrim(trim) || "";
  }
  
  return "";
}
