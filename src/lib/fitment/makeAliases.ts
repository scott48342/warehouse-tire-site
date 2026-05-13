/**
 * CANONICAL MAKE ALIAS SYSTEM
 * 
 * Bidirectional make name normalization for consistent fitment resolution.
 * 
 * PROBLEM:
 * - DB stores "Mercedes" (from various sources)
 * - Customers search "Mercedes-Benz"
 * - URLs may have "mercedes" or "mercedes-benz"
 * - Makes selector should show "Mercedes-Benz" (official name)
 * 
 * SOLUTION:
 * - `canonicalMake()` - Normalize ANY input to DB storage format
 * - `displayMake()` - Convert DB format to customer-facing display
 * - `makeMatches()` - Check if two make inputs resolve to same canonical
 * 
 * USAGE:
 * - All DB queries use `canonicalMake(userInput)`
 * - All display/response uses `displayMake(dbValue)`
 * - All URL matching uses `makeMatches(urlMake, dbMake)`
 */

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL MAKE MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps all known variations to canonical DB storage name (lowercase, slugified)
 * 
 * Key: lowercase input variation
 * Value: canonical DB storage name (lowercase slug)
 */
const MAKE_TO_CANONICAL: Record<string, string> = {
  // Mercedes-Benz → mercedes
  "mercedes-benz": "mercedes",
  "mercedes benz": "mercedes",
  "mercedesbenz": "mercedes",
  "mercedes": "mercedes",
  "mb": "mercedes",
  
  // Chevrolet → chevrolet
  "chevrolet": "chevrolet",
  "chevy": "chevrolet",
  "chev": "chevrolet",
  
  // Volkswagen → volkswagen
  "volkswagen": "volkswagen",
  "vw": "volkswagen",
  
  // Ram → ram (Dodge split)
  "ram": "ram",
  "dodge ram": "ram",
  "ram trucks": "ram",
  
  // Land Rover → land-rover
  "land rover": "land-rover",
  "land-rover": "land-rover",
  "landrover": "land-rover",
  "rover": "land-rover",
  
  // Alfa Romeo → alfa-romeo
  "alfa romeo": "alfa-romeo",
  "alfa-romeo": "alfa-romeo",
  "alfaromeo": "alfa-romeo",
  "alfa": "alfa-romeo",
  
  // Aston Martin → aston-martin
  "aston martin": "aston-martin",
  "aston-martin": "aston-martin",
  "astonmartin": "aston-martin",
  "aston": "aston-martin",
  
  // Rolls-Royce → rolls-royce
  "rolls-royce": "rolls-royce",
  "rolls royce": "rolls-royce",
  "rollsroyce": "rolls-royce",
  "rolls": "rolls-royce",
  
  // GMC (ensure uppercase display)
  "gmc": "gmc",
  
  // BMW (ensure uppercase display)
  "bmw": "bmw",
  
  // AMC (defunct but in data)
  "amc": "amc",
  
  // Common abbreviations
  "caddy": "cadillac",
  "cadi": "cadillac",
};

/**
 * Maps canonical DB name to official display name
 * 
 * Key: canonical DB storage name (lowercase slug)
 * Value: official customer-facing display name
 */
const CANONICAL_TO_DISPLAY: Record<string, string> = {
  "mercedes": "Mercedes-Benz",
  "chevrolet": "Chevrolet",
  "volkswagen": "Volkswagen",
  "ram": "Ram",
  "land-rover": "Land Rover",
  "alfa-romeo": "Alfa Romeo",
  "aston-martin": "Aston Martin",
  "rolls-royce": "Rolls-Royce",
  "gmc": "GMC",
  "bmw": "BMW",
  "amc": "AMC",
  "cadillac": "Cadillac",
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize ANY make input to canonical DB storage format.
 * 
 * Use this for:
 * - Database queries (WHERE make = canonicalMake(input))
 * - Cache keys
 * - Deduplication
 * 
 * @param make - Any make input (user search, URL param, API response)
 * @returns Canonical lowercase slug (e.g., "mercedes", "land-rover")
 * 
 * @example
 * canonicalMake("Mercedes-Benz") // → "mercedes"
 * canonicalMake("Chevy")         // → "chevrolet"
 * canonicalMake("VW")            // → "volkswagen"
 * canonicalMake("Land Rover")    // → "land-rover"
 * canonicalMake("RAM")           // → "ram"
 */
export function canonicalMake(make: string): string {
  if (!make) return "";
  
  const normalized = make.trim().toLowerCase();
  
  // Check explicit alias mapping
  if (MAKE_TO_CANONICAL[normalized]) {
    return MAKE_TO_CANONICAL[normalized];
  }
  
  // Fallback: slugify unknown makes
  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Convert canonical DB make to official display name.
 * 
 * Use this for:
 * - API responses (makes list, vehicle display)
 * - UI display
 * - SEO titles
 * 
 * @param make - Canonical DB make or raw make from DB
 * @returns Official display name (e.g., "Mercedes-Benz", "Land Rover")
 * 
 * @example
 * displayMake("mercedes")   // → "Mercedes-Benz"
 * displayMake("land-rover") // → "Land Rover"
 * displayMake("ford")       // → "Ford" (title-cased)
 */
export function displayMake(make: string): string {
  if (!make) return "";
  
  const canonical = canonicalMake(make);
  
  // Check explicit display mapping
  if (CANONICAL_TO_DISPLAY[canonical]) {
    return CANONICAL_TO_DISPLAY[canonical];
  }
  
  // Fallback: title-case unknown makes
  return canonical
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Check if two make inputs resolve to the same canonical make.
 * 
 * Use this for:
 * - URL matching (does this URL match this DB record?)
 * - Search matching
 * - Deduplication checks
 * 
 * @param make1 - First make input
 * @param make2 - Second make input
 * @returns True if both resolve to same canonical make
 * 
 * @example
 * makeMatches("Mercedes-Benz", "mercedes") // → true
 * makeMatches("Chevy", "Chevrolet")        // → true
 * makeMatches("Ford", "Chevrolet")         // → false
 */
export function makeMatches(make1: string, make2: string): boolean {
  return canonicalMake(make1) === canonicalMake(make2);
}

/**
 * Get all known aliases for a make (for search expansion).
 * 
 * @param make - Any make input
 * @returns Array of all known variations including canonical
 * 
 * @example
 * getMakeAliases("Mercedes-Benz") // → ["mercedes", "mercedes-benz", "mb", ...]
 */
export function getMakeAliases(make: string): string[] {
  const canonical = canonicalMake(make);
  const aliases: string[] = [canonical];
  
  // Find all inputs that map to this canonical
  for (const [input, target] of Object.entries(MAKE_TO_CANONICAL)) {
    if (target === canonical && !aliases.includes(input)) {
      aliases.push(input);
    }
  }
  
  return aliases;
}

/**
 * Check if a make requires special handling (luxury/european brands).
 * 
 * Useful for:
 * - Deciding whether to show premium UX
 * - Adjusting search behavior
 */
export function isLuxuryMake(make: string): boolean {
  const canonical = canonicalMake(make);
  const luxuryMakes = [
    "mercedes", "bmw", "audi", "porsche", "lexus",
    "infiniti", "acura", "genesis", "maserati", "ferrari",
    "lamborghini", "bentley", "rolls-royce", "aston-martin",
    "alfa-romeo", "jaguar", "land-rover", "lincoln", "cadillac",
  ];
  return luxuryMakes.includes(canonical);
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate that all aliases are bidirectionally consistent.
 * Returns any inconsistencies found.
 */
export function validateAliasConsistency(): string[] {
  const errors: string[] = [];
  
  // Check that every canonical in MAKE_TO_CANONICAL has a display name
  const canonicals = new Set(Object.values(MAKE_TO_CANONICAL));
  for (const canonical of canonicals) {
    if (!CANONICAL_TO_DISPLAY[canonical]) {
      // Not an error - will title-case fallback
      // But log it for awareness
      console.log(`[makeAliases] No explicit display for canonical: ${canonical}`);
    }
  }
  
  // Check that displayMake(canonicalMake(x)) is idempotent
  for (const input of Object.keys(MAKE_TO_CANONICAL)) {
    const canonical = canonicalMake(input);
    const display = displayMake(canonical);
    const reCanonical = canonicalMake(display);
    if (canonical !== reCanonical) {
      errors.push(`Round-trip failed: "${input}" → "${canonical}" → "${display}" → "${reCanonical}"`);
    }
  }
  
  return errors;
}
