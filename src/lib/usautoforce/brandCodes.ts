/**
 * US AutoForce Brand Code Mappings
 * 
 * The USAF Order API requires a lineCode (brand code) for each item.
 * These are 2-4 character codes like "GEN", "BFG", "TOY", etc.
 * 
 * This file maps common brand names to USAF brand codes.
 * Codes were extracted from USAF StockCheck API responses.
 * 
 * If a brand is not found, the order will fail with "No part found!"
 */

// Map of brand name (normalized lowercase) -> USAF brand code
const BRAND_TO_CODE: Record<string, string> = {
  // Major brands
  "general": "GEN",
  "general tire": "GEN",
  "bf goodrich": "BFG",
  "bfgoodrich": "BFG",
  "toyo": "TOY",
  "toyo tires": "TOY",
  "nokian": "NOK",
  "nokian tyres": "NOK",
  "starfire": "STR",
  "firestone": "FIR",
  "continental": "CON",
  "cooper": "COP",
  "cooper tires": "COP",
  "falken": "FAL",
  "advanta": "ADV",
  "uniroyal": "UNI",
  "kenda": "KEN",
  "michelin": "MIC",
  "goodyear": "GDY",
  "bridgestone": "BRI",
  "pirelli": "PIR",
  "yokohama": "YOK",
  "dunlop": "DUN",
  "hankook": "HAN",
  "kumho": "KUM",
  "nexen": "NEX",
  "nitto": "NIT",
  "sumitomo": "SUM",
  "kelly": "KEL",
  "fuzion": "FUZ",
  "hercules": "HER",
  "mastercraft": "MAS",
  "multi-mile": "MUL",
  "multi mile": "MUL",
  "milestar": "MLS",
  "westlake": "WES",
  "achilles": "ACH",
  "atturo": "ATT",
  "barum": "BAR",
  "bfg": "BFG", // Abbreviation
  "continental contitire": "CON",
  "delta": "DEL",
  "dick cepek": "DCK",
  "doral": "DOR",
  "douglas": "DUG",
  "eldorado": "ELD",
  "federal": "FED",
  "fierce": "FRC",
  "gt radial": "GTR",
  "gt": "GTR",
  "ironman": "IRM",
  "jetzon": "JET",
  "landmark": "LMK",
  "laufenn": "LAU",
  "lemans": "LEM",
  "le mans": "LEM",
  "lexani": "LEX",
  "lion sport": "LIO",
  "maxxis": "MAX",
  "mickey thompson": "MKT",
  "minerva": "MIN",
  "mohawk": "MOH",
  "national": "NAT",
  "ohtsu": "OHT",
  "pathfinder": "PTH",
  "pride": "PRD",
  "prinx": "PRN",
  "remington": "REM",
  "road one": "RDO",
  "riken": "RIK",
  "runway": "RWY",
  "sailun": "SAI",
  "sentury": "SNT",
  "sigma": "SIG",
  "sumic": "SMC",
  "telstar": "TEL",
  "thunderer": "THU",
  "tbc": "TBC",
  "titan": "TTN",
  "tornel": "TOR",
  "toyo open country": "TOY",
  "toyo proxes": "TOY",
  "trail guide": "TRG",
  "travelstar": "TRV",
  "vanderbilt": "VAN",
  "vercelli": "VRC",
  "vogue": "VOG",
  "wanli": "WNL",
  "wild country": "WLD",
  "winrun": "WIN",
  "zeetex": "ZEE",
  "zenna": "ZEN",
};

/**
 * Get USAF brand code from brand name.
 * Returns null if brand is not mapped.
 * 
 * @param brandName - Full brand name (e.g., "General", "BF Goodrich")
 * @returns USAF brand code (e.g., "GEN", "BFG") or null
 */
export function getUSAFBrandCode(brandName: string | null | undefined): string | null {
  if (!brandName) return null;
  
  // Normalize: lowercase, trim whitespace
  const normalized = brandName.toLowerCase().trim();
  
  // Direct lookup
  if (BRAND_TO_CODE[normalized]) {
    return BRAND_TO_CODE[normalized];
  }
  
  // Try partial match (brand name might include model info)
  // e.g., "General Altimax" should match "general"
  for (const [key, code] of Object.entries(BRAND_TO_CODE)) {
    if (normalized.startsWith(key) || key.startsWith(normalized)) {
      return code;
    }
  }
  
  // Not found
  console.warn(`[usautoforce] Unknown brand, no lineCode mapping: "${brandName}"`);
  return null;
}

/**
 * Check if a brand is supported for USAF ordering.
 */
export function isSupportedUSAFBrand(brandName: string | null | undefined): boolean {
  return getUSAFBrandCode(brandName) !== null;
}

/**
 * Get all known USAF brand codes (for debugging/admin)
 */
export function getAllUSAFBrandCodes(): Record<string, string> {
  return { ...BRAND_TO_CODE };
}
