/**
 * Brand name to code mapping for WheelPros brands.
 * Used to resolve user-friendly brand names to internal codes.
 */

// Map of brand descriptions to their codes
const BRAND_NAME_TO_CODE: Record<string, string[]> = {
  "american force": ["AW", "AC", "AP"],
  "american racing": ["AR", "VF", "VN"],
  "asanti": ["AB", "AF", "OR"],
  "atx": ["AO", "AX"],
  "beyern": ["BE"],
  "black rhino": ["BR", "BS"],
  "coventry": ["CO"],
  "cray": ["CR"],
  "dub": ["DC"],
  "fairway": ["FA"],
  "foose": ["OC", "OT"],
  "fuel": ["FC", "FT", "FF", "FM", "FV"],
  "genius": ["GE"],
  "helo": ["HE"],
  "kinesis": ["KI"],
  "kmc": ["KM", "KS"],
  "level 8": ["LE"],
  "mandrus": ["MN"],
  "motegi": ["MR"],
  "moto metal": ["MO"],
  "msa": ["MA"],
  "niche": ["NC", "NM"],
  "ohm": ["OM"],
  "performance replicas": ["PR"],
  "petrol": ["PE"],
  "pro comp": ["PA"],
  "redbourne": ["RE"],
  "rotiform": ["RC", "RF"],
  "status": ["ST"],
  "teraflex": ["TF"],
  "tsw": ["TW"],
  "tuff": ["TU"],
  "us mag": ["UC", "UT"],
  "victor": ["VI"],
  "xd": ["XD", "XS"],
  "xo": ["XO"],
};

// Map of codes to their primary brand name
const CODE_TO_BRAND_NAME: Record<string, string> = {
  "AW": "American Force",
  "AC": "American Force",
  "AP": "American Force",
  "AR": "American Racing",
  "VF": "American Racing",
  "VN": "American Racing",
  "AB": "Asanti",
  "AF": "Asanti",
  "OR": "Asanti",
  "AO": "ATX",
  "AX": "ATX",
  "BE": "Beyern",
  "BR": "Black Rhino",
  "BS": "Black Rhino",
  "CO": "Coventry",
  "CR": "Cray",
  "DC": "DUB",
  "FA": "Fairway",
  "OC": "Foose",
  "OT": "Foose",
  "FC": "Fuel",
  "FT": "Fuel",
  "FF": "Fuel",
  "FM": "Fuel",
  "FV": "Fuel",
  "GE": "Genius",
  "HE": "Helo",
  "KI": "Kinesis",
  "KM": "KMC",
  "KS": "KMC",
  "LE": "Level 8",
  "MN": "Mandrus",
  "MR": "Motegi",
  "MO": "Moto Metal",
  "MA": "MSA",
  "NC": "Niche",
  "NM": "Niche",
  "OM": "OHM",
  "PR": "Performance Replicas",
  "PE": "Petrol",
  "PA": "Pro Comp",
  "RE": "RedBourne",
  "RC": "Rotiform",
  "RF": "Rotiform",
  "ST": "Status",
  "TF": "Teraflex",
  "TW": "TSW",
  "TU": "Tuff",
  "UC": "US Mag",
  "UT": "US Mag",
  "VI": "Victor",
  "XD": "XD",
  "XS": "XD",
  "XO": "XO",
};

/**
 * Resolve a brand filter value (name or code) to matching brand codes.
 * Returns the input as-is if it's already a valid code.
 */
export function resolveBrandCodes(brandFilter: string): string[] {
  if (!brandFilter) return [];
  
  const upper = brandFilter.toUpperCase().trim();
  const lower = brandFilter.toLowerCase().trim();
  
  // Check if it's already a valid code
  if (CODE_TO_BRAND_NAME[upper]) {
    return [upper];
  }
  
  // Check if it matches a brand name
  if (BRAND_NAME_TO_CODE[lower]) {
    return BRAND_NAME_TO_CODE[lower];
  }
  
  // Try partial matching (e.g., "Fuel 1PC" -> "fuel")
  for (const [name, codes] of Object.entries(BRAND_NAME_TO_CODE)) {
    if (lower.includes(name) || name.includes(lower)) {
      return codes;
    }
  }
  
  // Return the original as fallback (might be a code we don't know)
  return [upper];
}

/**
 * Check if a wheel's brand code matches the filter (name or code).
 */
export function matchesBrandFilter(wheelBrandCode: string, brandFilter: string): boolean {
  if (!brandFilter) return true;
  if (!wheelBrandCode) return false;
  
  const codes = resolveBrandCodes(brandFilter);
  return codes.includes(wheelBrandCode.toUpperCase());
}

/**
 * Get the display name for a brand code.
 */
export function getBrandName(code: string): string {
  return CODE_TO_BRAND_NAME[code.toUpperCase()] || code;
}
