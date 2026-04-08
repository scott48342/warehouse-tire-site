/**
 * Product name formatting utilities
 * Cleans up supplier data for customer-facing display
 */

// ============================================================================
// TIRE SIZE NORMALIZATION
// ============================================================================

/**
 * Normalize tire size strings for display.
 * 
 * DISPLAY-ONLY: Does not modify underlying data.
 * 
 * Handles:
 * 1. Already formatted sizes (pass through): "225/65R17", "33x12.50R22"
 * 2. K&M encoded flotation: "33125022" → "33x12.50R22"
 * 3. K&M encoded metric: "2256517" → "225/65R17"
 * 
 * Encoding patterns (K&M style):
 * - Flotation (8 digits): DDWWWWRR where DD=diameter, WWWW=width×100, RR=rim
 *   Example: 33125022 → 33 | 1250 | 22 → 33x12.50R22
 * - Metric (7 digits): WWWAARR where WWW=width(mm), AA=aspect, RR=rim
 *   Example: 2256517 → 225 | 65 | 17 → 225/65R17
 * 
 * @param size - Raw tire size string from supplier
 * @returns Human-readable tire size
 */
export function normalizeTireSize(size: string | null | undefined): string {
  if (!size) return "";
  
  const s = String(size).trim().toUpperCase();
  
  // Already formatted? Pass through.
  // Matches: 225/65R17, P225/65R17, LT285/70R17, 33x12.50R22, 35X12.5R20
  if (/^[PLT]*\d{3}\/\d{2}R\d{2}/.test(s) || /^\d{2,3}[Xx]\d{1,2}\.?\d*R\d{2}/.test(s)) {
    return s;
  }
  
  // Pure digits? Try to decode.
  if (/^\d+$/.test(s)) {
    const decoded = decodeEncodedTireSize(s);
    if (decoded) return decoded;
  }
  
  // Fallback: return as-is
  return s;
}

/**
 * Decode K&M-style encoded tire sizes.
 * 
 * Patterns detected:
 * - 8 digits starting with 3x (flotation): 33125022 → 33x12.50R22
 * - 7 digits starting with 1xx-3xx (metric): 2256517 → 225/65R17
 * - 8 digits starting with 1xx-3xx (metric with extra): 22565170 → 225/65R17
 */
function decodeEncodedTireSize(encoded: string): string | null {
  const len = encoded.length;
  
  // 8-digit flotation: DDWWWWRR (e.g., 33125022)
  // First 2 digits are overall diameter (30-40 range typical for flotation)
  if (len === 8) {
    const firstTwo = parseInt(encoded.slice(0, 2), 10);
    
    // Flotation sizes have overall diameter 27-40"
    if (firstTwo >= 27 && firstTwo <= 40) {
      const diameter = encoded.slice(0, 2);        // 33
      const widthRaw = encoded.slice(2, 6);        // 1250
      const rim = encoded.slice(6, 8);             // 22
      
      // Convert width: 1250 → 12.50, 1150 → 11.50
      const widthNum = parseInt(widthRaw, 10) / 100;
      
      // Validate reasonable width (8-15 inches for flotation)
      if (widthNum >= 8 && widthNum <= 16) {
        // Format width: show .50 or .00 only if meaningful
        const widthStr = widthNum % 1 === 0 
          ? widthNum.toFixed(0) 
          : widthNum.toFixed(2).replace(/0$/, '');
        
        return `${diameter}x${widthStr}R${rim}`;
      }
    }
    
    // Could be metric with trailing 0: 22565170 → 225/65R17
    const width3 = encoded.slice(0, 3);
    const aspect2 = encoded.slice(3, 5);
    const rim2 = encoded.slice(5, 7);
    const widthNum = parseInt(width3, 10);
    const aspectNum = parseInt(aspect2, 10);
    const rimNum = parseInt(rim2, 10);
    
    if (widthNum >= 135 && widthNum <= 355 && 
        aspectNum >= 25 && aspectNum <= 85 && 
        rimNum >= 13 && rimNum <= 26) {
      return `${width3}/${aspect2}R${rim2}`;
    }
  }
  
  // 7-digit metric: WWWAARR (e.g., 2256517)
  if (len === 7) {
    const width = encoded.slice(0, 3);     // 225
    const aspect = encoded.slice(3, 5);    // 65
    const rim = encoded.slice(5, 7);       // 17
    
    const widthNum = parseInt(width, 10);
    const aspectNum = parseInt(aspect, 10);
    const rimNum = parseInt(rim, 10);
    
    // Validate reasonable metric ranges
    // Width: 135-355mm, Aspect: 25-85, Rim: 13-26"
    if (widthNum >= 135 && widthNum <= 355 && 
        aspectNum >= 25 && aspectNum <= 85 && 
        rimNum >= 13 && rimNum <= 26) {
      return `${width}/${aspect}R${rim}`;
    }
  }
  
  // 6-digit metric (compact): WWAARR (e.g., 225617 → 225/60R17)?
  // Less common but possible
  if (len === 6) {
    const width = encoded.slice(0, 3);     // 225
    const aspect = encoded.slice(3, 4);    // 6 (meaning 60)
    const rim = encoded.slice(4, 6);       // 17
    
    const widthNum = parseInt(width, 10);
    const aspectNum = parseInt(aspect, 10) * 10; // 6 → 60
    const rimNum = parseInt(rim, 10);
    
    if (widthNum >= 135 && widthNum <= 355 && 
        aspectNum >= 30 && aspectNum <= 80 && 
        rimNum >= 13 && rimNum <= 26) {
      return `${width}/${aspectNum}R${rim}`;
    }
  }
  
  return null;
}

/**
 * Cleans product names from supplier feeds for display.
 * - Removes K&M's "/e" (economy tier) prefix
 * - Normalizes whitespace
 */
export function formatProductName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .replace(/\s*\/e\s+/gi, " ") // Remove "/e " prefix (K&M economy tier)
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Formats brand + model into a clean display name
 */
export function formatTireDisplayName(
  brand: string | null | undefined,
  model: string | null | undefined
): string {
  const cleanBrand = (brand || "").trim();
  const cleanModel = formatProductName(model);

  if (cleanBrand && cleanModel) {
    // If model already starts with brand name, don't duplicate
    if (cleanModel.toLowerCase().startsWith(cleanBrand.toLowerCase())) {
      return cleanModel;
    }
    return `${cleanBrand} ${cleanModel}`;
  }
  return cleanModel || cleanBrand || "Unknown Tire";
}

/**
 * Cleans tire card display titles for customer-facing presentation.
 * 
 * This is a DISPLAY-ONLY transformation - does NOT modify raw product data.
 * Used when rendering tire result cards where:
 * - Brand is already shown separately above the title
 * - Load markers like "/sl" are noise in the title (SL = Standard Load, default for most tires)
 * 
 * Rules:
 * 1. Remove leading brand name if it matches the separately-displayed brand
 * 2. Remove "/sl", "/SL", "SL" load markers when used as title clutter
 * 3. Normalize spacing
 * 4. Apply smart capitalization for premium presentation
 * 5. Preserve meaningful model text (don't over-strip)
 * 
 * Examples:
 * - "Lexani /sl Lxht-206" → "LXHT-206" (brand shown separately, /sl removed, model code uppercased)
 * - "Thunderer /sl Rngr Highway Terrain" → "RNGR Highway Terrain"
 * - "Continental ExtremeContact DWS06 Plus" → "ExtremeContact DWS06 Plus"
 * - "Michelin Defender LTX M/S" → "Defender LTX M/S" (M/S is meaningful, kept)
 */
export function cleanTireDisplayTitle(
  title: string | null | undefined,
  brand: string | null | undefined
): string {
  if (!title) return "";
  
  let cleaned = String(title).trim();
  const brandLower = (brand || "").trim().toLowerCase();
  
  // 1. Remove leading brand name (case-insensitive) if it matches the brand
  // This handles: "Lexani /sl Lxht-206" → "/sl Lxht-206"
  if (brandLower && cleaned.toLowerCase().startsWith(brandLower)) {
    cleaned = cleaned.slice(brandLower.length).trim();
  }
  
  // 2. Remove "/sl" and "SL" load markers when they appear as title noise
  // Standard Load is the default - no need to show it
  // Patterns: "/sl", "/SL", leading "SL " (but not "SL" inside words like "Assurance")
  cleaned = cleaned
    .replace(/^\/sl\b/gi, "") // Leading "/sl"
    .replace(/\s+\/sl\b/gi, "") // " /sl" anywhere
    .replace(/^sl\s+/gi, "") // Leading "SL " (standalone)
    .trim();
  
  // 3. Normalize spacing and clean up any resulting artifacts
  cleaned = cleaned
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/^[\/\-\s]+/, "") // Remove leading punctuation artifacts
    .trim();
  
  // 4. If we stripped everything, fall back to original (safety net)
  if (!cleaned) {
    return String(title).trim();
  }
  
  // 5. Apply smart capitalization for premium presentation
  cleaned = smartCapitalizeTireTitle(cleaned);
  
  return cleaned;
}

/**
 * Known tire industry abbreviations that should always be uppercase.
 * These are commonly used in tire model names and descriptions.
 */
const TIRE_ABBREVIATIONS = new Set([
  // Terrain/category abbreviations
  "AT", "MT", "HT", "HP", "UHP", "AS", "AW",
  // Common tire features
  "RFT", "EMT", "ROF", "XL", "LT", "ST", "TT", "TL",
  // Compound patterns (kept as-is)
  "M/S", "A/T", "M/T", "H/T", "A/S",
  // Model code patterns commonly seen
  "LTX", "DWS", "STX", "GTX", "RTX", "CTX", "STT", "KO2",
  "SUV", "CUV", "OE", "OEM", "SS", "RS", "GT", "GTS",
  "EV", "EVO", "II", "III", "IV", "T/A",
]);

/**
 * Apply smart capitalization to tire model titles for premium display.
 * 
 * DISPLAY-ONLY: Does not modify raw product data.
 * 
 * Logic:
 * 1. Model codes (consonant-heavy, alphanumeric patterns like "Lxht", "Rngr") → UPPERCASE
 * 2. Known tire abbreviations → UPPERCASE  
 * 3. Regular English words → Title Case
 * 4. Preserve camelCase/PascalCase brand-specific names (ExtremeContact, CrossClimate)
 * 5. Preserve numbers and special characters
 */
function smartCapitalizeTireTitle(title: string): string {
  if (!title) return "";
  
  // Split on spaces but preserve hyphenated compounds
  const words = title.split(" ");
  
  const capitalized = words.map((word) => {
    // Handle hyphenated compounds (e.g., "Lxht-206")
    if (word.includes("-")) {
      return word.split("-").map(part => capitalizeToken(part)).join("-");
    }
    return capitalizeToken(word);
  });
  
  return capitalized.join(" ");
}

/**
 * Capitalize a single token (word or model code) appropriately.
 */
function capitalizeToken(token: string): string {
  if (!token) return "";
  
  const upper = token.toUpperCase();
  const lower = token.toLowerCase();
  
  // 1. Preserve known abbreviations with slashes (M/S, A/T, etc.)
  if (TIRE_ABBREVIATIONS.has(upper)) {
    return upper;
  }
  
  // 2. Check for slash patterns and handle them
  if (token.includes("/")) {
    const parts = token.split("/");
    return parts.map(p => capitalizeToken(p)).join("/");
  }
  
  // 3. Pure numbers → keep as-is
  if (/^\d+$/.test(token)) {
    return token;
  }
  
  // 4. Alphanumeric model codes (letters + numbers like "DWS06", "206") → UPPERCASE
  if (/^[A-Za-z]+\d+[A-Za-z]*$/.test(token) || /^\d+[A-Za-z]+$/.test(token)) {
    return upper;
  }
  
  // 5. Looks like a model code abbreviation: short consonant-heavy token
  //    Pattern: 2-5 chars, mostly consonants, no common English word patterns
  //    Examples: "Lxht" → "LXHT", "Rngr" → "RNGR", "Lxtr" → "LXTR"
  if (isLikelyModelCode(lower)) {
    return upper;
  }
  
  // 6. Preserve intentional camelCase/PascalCase (ExtremeContact, CrossClimate)
  //    If token has internal capitals, it's likely a branded compound name
  if (/[a-z][A-Z]/.test(token)) {
    return token; // Preserve original casing
  }
  
  // 7. Already all uppercase and short (2-4 chars) → keep uppercase (likely abbreviation)
  if (token === upper && token.length <= 4 && /^[A-Z]+$/.test(token)) {
    return token;
  }
  
  // 8. Standard English word → Title Case
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Detect if a token looks like a tire model code (vs a regular word).
 * 
 * Model codes are typically:
 * - Short (2-5 characters)
 * - Consonant-heavy or all-consonant (LXHT, RNGR, XHT)
 * - Not common English words
 * 
 * We check vowel ratio: real English words typically have 30-50% vowels,
 * while model codes have fewer (often 0-25%).
 */
function isLikelyModelCode(lower: string): boolean {
  // Too short or too long → not a model code pattern
  if (lower.length < 2 || lower.length > 6) return false;
  
  // FIRST: Check common words - these should never be treated as model codes
  // This must come before vowel ratio checks to avoid false positives like "plus"
  const commonWords = new Set([
    "the", "and", "for", "with", "plus", "all", "new", "pro", "max",
    "ultra", "super", "sport", "tour", "road", "street", "trail", "open",
    "mud", "snow", "ice", "rain", "wet", "dry", "cold", "hot", "country",
    "highway", "terrain", "season", "weather", "winter", "summer", "ridge",
    "performance", "touring", "comfort", "quiet", "grip", "traction", "grappler",
    "defender", "pilot", "energy", "latitude", "primacy", "crossclimate", "wildpeak",
    "eagle", "wrangler", "dueler", "destination", "assurance", "verde",
    "cinturato", "scorpion", "potenza", "turanza", "ecopia",
    "discoverer", "evolution", "dynapro", "ventus",
  ]);
  
  if (commonWords.has(lower)) {
    return false;
  }
  
  // Contains numbers → already handled elsewhere, but if mixed, could be model code
  if (/\d/.test(lower)) return true;
  
  // Count vowels
  const vowels = (lower.match(/[aeiou]/g) || []).length;
  const vowelRatio = vowels / lower.length;
  
  // Very low vowel ratio (< 25%) suggests abbreviation/model code
  // Example: "lxht" = 0% vowels, "rngr" = 0%, "defender" = 33%
  if (vowelRatio < 0.25 && lower.length >= 3) {
    return true;
  }
  
  // Single vowel in 4+ char word with consonant clusters → likely abbreviation
  // Example: "rngr" (would fail above), "strx"
  if (vowels <= 1 && lower.length >= 4) {
    return true;
  }
  
  return false;
}
