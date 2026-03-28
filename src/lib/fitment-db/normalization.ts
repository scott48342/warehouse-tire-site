/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FITMENT NORMALIZATION LAYER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Consistent normalization for make, model, and trim names.
 * Handles common variations and aliases.
 * 
 * @created 2026-03-27
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MAKE NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Canonical make names and their aliases
 */
export const MAKE_ALIASES: Record<string, string[]> = {
  "ford": ["ford", "ford motor"],
  "chevrolet": ["chevrolet", "chevy", "chev"],
  "gmc": ["gmc", "general motors"],
  "ram": ["ram", "ram trucks", "dodge ram"],
  "dodge": ["dodge"],
  "jeep": ["jeep"],
  "chrysler": ["chrysler"],
  "toyota": ["toyota"],
  "honda": ["honda"],
  "nissan": ["nissan", "datsun"],
  "mazda": ["mazda"],
  "subaru": ["subaru"],
  "hyundai": ["hyundai"],
  "kia": ["kia"],
  "genesis": ["genesis"],
  "volkswagen": ["volkswagen", "vw"],
  "bmw": ["bmw", "bayerische motoren werke"],
  "mercedes-benz": ["mercedes-benz", "mercedes", "mb", "benz"],
  "audi": ["audi"],
  "porsche": ["porsche"],
  "lexus": ["lexus"],
  "acura": ["acura"],
  "infiniti": ["infiniti"],
  "lincoln": ["lincoln"],
  "cadillac": ["cadillac", "caddy"],
  "buick": ["buick"],
  "volvo": ["volvo"],
  "land-rover": ["land rover", "land-rover", "landrover", "range rover"],
  "jaguar": ["jaguar", "jag"],
  "tesla": ["tesla"],
  "rivian": ["rivian"],
  "lucid": ["lucid"],
  "polestar": ["polestar"],
  "mini": ["mini", "mini cooper"],
  "alfa-romeo": ["alfa romeo", "alfa-romeo", "alfa"],
  "fiat": ["fiat"],
  "maserati": ["maserati"],
  "mitsubishi": ["mitsubishi"],
};

// Build reverse lookup
const MAKE_LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(MAKE_ALIASES)) {
  for (const alias of aliases) {
    MAKE_LOOKUP.set(alias.toLowerCase().replace(/[^a-z0-9]/g, ""), canonical);
  }
}

/**
 * Normalize make name to canonical form
 */
export function normalizeMake(input: string): string {
  const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return MAKE_LOOKUP.get(cleaned) || input.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Get display name for a make
 */
export function getMakeDisplayName(canonical: string): string {
  const displayNames: Record<string, string> = {
    "ford": "Ford",
    "chevrolet": "Chevrolet",
    "gmc": "GMC",
    "ram": "RAM",
    "dodge": "Dodge",
    "jeep": "Jeep",
    "chrysler": "Chrysler",
    "toyota": "Toyota",
    "honda": "Honda",
    "nissan": "Nissan",
    "mazda": "Mazda",
    "subaru": "Subaru",
    "hyundai": "Hyundai",
    "kia": "Kia",
    "genesis": "Genesis",
    "volkswagen": "Volkswagen",
    "bmw": "BMW",
    "mercedes-benz": "Mercedes-Benz",
    "audi": "Audi",
    "porsche": "Porsche",
    "lexus": "Lexus",
    "acura": "Acura",
    "infiniti": "Infiniti",
    "lincoln": "Lincoln",
    "cadillac": "Cadillac",
    "buick": "Buick",
    "volvo": "Volvo",
    "land-rover": "Land Rover",
    "jaguar": "Jaguar",
    "tesla": "Tesla",
    "rivian": "Rivian",
    "lucid": "Lucid",
    "polestar": "Polestar",
    "mini": "MINI",
    "alfa-romeo": "Alfa Romeo",
    "fiat": "FIAT",
    "maserati": "Maserati",
    "mitsubishi": "Mitsubishi",
  };
  return displayNames[canonical] || canonical.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Model name aliases by make
 */
export const MODEL_ALIASES: Record<string, Record<string, string[]>> = {
  "ford": {
    "f-150": ["f-150", "f150", "f 150"],
    "f-250": ["f-250", "f250", "f 250", "f-250 super duty"],
    "f-350": ["f-350", "f350", "f 350", "f-350 super duty"],
    "ranger": ["ranger"],
    "maverick": ["maverick"],
    "explorer": ["explorer"],
    "expedition": ["expedition"],
    "bronco": ["bronco"],
    "bronco-sport": ["bronco sport", "bronco-sport"],
    "escape": ["escape"],
    "edge": ["edge"],
    "mustang": ["mustang"],
    "mustang-mach-e": ["mustang mach-e", "mustang mach e", "mach-e", "mach e"],
  },
  "chevrolet": {
    "silverado-1500": ["silverado 1500", "silverado-1500", "silverado"],
    "silverado-2500hd": ["silverado 2500hd", "silverado-2500hd", "silverado 2500", "silverado hd"],
    "silverado-3500hd": ["silverado 3500hd", "silverado-3500hd", "silverado 3500"],
    "colorado": ["colorado"],
    "tahoe": ["tahoe"],
    "suburban": ["suburban"],
    "equinox": ["equinox"],
    "traverse": ["traverse"],
    "blazer": ["blazer"],
    "trailblazer": ["trailblazer"],
    "malibu": ["malibu"],
    "camaro": ["camaro"],
    "corvette": ["corvette", "vette"],
  },
  "ram": {
    "1500": ["1500", "ram 1500"],
    "1500-classic": ["1500 classic", "ram 1500 classic", "1500classic"],
    "2500": ["2500", "ram 2500"],
    "3500": ["3500", "ram 3500"],
  },
  "toyota": {
    "tacoma": ["tacoma"],
    "tundra": ["tundra"],
    "4runner": ["4runner", "4-runner", "4 runner"],
    "rav4": ["rav4", "rav-4", "rav 4"],
    "highlander": ["highlander"],
    "camry": ["camry"],
    "corolla": ["corolla"],
    "prius": ["prius"],
    "sienna": ["sienna"],
    "sequoia": ["sequoia"],
    "land-cruiser": ["land cruiser", "land-cruiser", "landcruiser"],
    "gr86": ["gr86", "gr 86", "86"],
    "supra": ["supra", "gr supra"],
  },
  "honda": {
    "civic": ["civic"],
    "accord": ["accord"],
    "cr-v": ["cr-v", "crv", "cr v"],
    "pilot": ["pilot"],
    "hr-v": ["hr-v", "hrv", "hr v"],
    "passport": ["passport"],
    "odyssey": ["odyssey"],
    "ridgeline": ["ridgeline"],
  },
  "jeep": {
    "wrangler": ["wrangler", "wrangler jl", "wrangler jk"],
    "grand-cherokee": ["grand cherokee", "grand-cherokee"],
    "cherokee": ["cherokee"],
    "compass": ["compass"],
    "renegade": ["renegade"],
    "gladiator": ["gladiator"],
    "wagoneer": ["wagoneer"],
    "grand-wagoneer": ["grand wagoneer", "grand-wagoneer"],
  },
  "gmc": {
    "sierra-1500": ["sierra 1500", "sierra-1500", "sierra"],
    "sierra-2500hd": ["sierra 2500hd", "sierra-2500hd", "sierra 2500", "sierra hd"],
    "sierra-3500hd": ["sierra 3500hd", "sierra-3500hd", "sierra 3500"],
    "canyon": ["canyon"],
    "yukon": ["yukon"],
    "yukon-xl": ["yukon xl", "yukon-xl"],
    "acadia": ["acadia"],
    "terrain": ["terrain"],
  },
  "tesla": {
    "model-3": ["model 3", "model-3"],
    "model-y": ["model y", "model-y"],
    "model-s": ["model s", "model-s"],
    "model-x": ["model x", "model-x"],
    "cybertruck": ["cybertruck", "cyber truck"],
  },
};

// Build reverse lookup for models
const MODEL_LOOKUP = new Map<string, Map<string, string>>();
for (const [make, models] of Object.entries(MODEL_ALIASES)) {
  const makeMap = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(models)) {
    for (const alias of aliases) {
      makeMap.set(alias.toLowerCase().replace(/[^a-z0-9]/g, ""), canonical);
    }
  }
  MODEL_LOOKUP.set(make, makeMap);
}

/**
 * Normalize model name to canonical form
 */
export function normalizeModel(make: string, model: string): string {
  const normalizedMake = normalizeMake(make);
  const makeMap = MODEL_LOOKUP.get(normalizedMake);
  
  if (makeMap) {
    const cleaned = model.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const canonical = makeMap.get(cleaned);
    if (canonical) return canonical;
  }
  
  return model.trim().toLowerCase().replace(/\s+/g, "-");
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIM NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Common trim patterns to clean
 */
const TRIM_NOISE_PATTERNS = [
  /^\d+(\.\d+)?[LV]?\s*/i,           // Engine displacement: "2.7L", "5.0 V8"
  /\s*\d+(\.\d+)?[LV]?\s*$/i,        // Trailing engine
  /\bFWD\b/gi,                        // Drivetrain
  /\bAWD\b/gi,
  /\b4WD\b/gi,
  /\bRWD\b/gi,
  /\b2WD\b/gi,
  /\b4x4\b/gi,
  /\b4x2\b/gi,
  /\bAutomatic\b/gi,                  // Transmission
  /\bManual\b/gi,
  /\bCVT\b/gi,
  /\bDCT\b/gi,
  /\s*\(\d{4}-\d{4}\)\s*/g,          // Year ranges
  /\s*\(\d{4}\)\s*/g,                // Single year
];

/**
 * Canonical trim names by make/model
 */
export const TRIM_ALIASES: Record<string, Record<string, Record<string, string[]>>> = {
  "ford": {
    "f-150": {
      "XL": ["xl", "xl stx"],
      "XLT": ["xlt"],
      "Lariat": ["lariat"],
      "King Ranch": ["king ranch", "kingranch"],
      "Platinum": ["platinum"],
      "Limited": ["limited"],
      "Tremor": ["tremor"],
      "Raptor": ["raptor"],
      "Lightning": ["lightning"],
    },
  },
  "chevrolet": {
    "silverado-1500": {
      "WT": ["wt", "work truck"],
      "Custom": ["custom"],
      "LT": ["lt"],
      "RST": ["rst"],
      "LT Trail Boss": ["lt trail boss", "trail boss"],
      "LTZ": ["ltz"],
      "High Country": ["high country", "highcountry"],
      "ZR2": ["zr2"],
    },
  },
  "ram": {
    "1500": {
      "Tradesman": ["tradesman"],
      "Big Horn": ["big horn", "bighorn", "lone star"],
      "Laramie": ["laramie"],
      "Rebel": ["rebel"],
      "Longhorn": ["longhorn", "laramie longhorn"],
      "Limited": ["limited"],
      "TRX": ["trx"],
      "REV": ["rev"],
      "Express": ["express"],
      "Sport": ["sport"],
      "SXT": ["sxt"],
      "Outdoorsman": ["outdoorsman"],
    },
    "1500-classic": {
      "Tradesman": ["tradesman", "tradesman classic"],
      "Express": ["express", "express classic"],
      "Big Horn": ["big horn", "bighorn", "lone star", "big horn classic"],
      "SLT": ["slt", "slt classic"],
      "Warlock": ["warlock"],
    },
  },
};

/**
 * Normalize trim name
 */
export function normalizeTrim(make: string, model: string, trim: string): string {
  if (!trim) return "Base";
  
  let cleaned = trim.trim();
  
  // Remove noise patterns
  for (const pattern of TRIM_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  
  cleaned = cleaned.trim().replace(/\s+/g, " ");
  if (!cleaned || /^\d+$/.test(cleaned)) return "Base";
  
  // Try to find canonical name
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(make, model);
  
  const makeTrims = TRIM_ALIASES[normalizedMake];
  if (makeTrims) {
    const modelTrims = makeTrims[normalizedModel];
    if (modelTrims) {
      const cleanedLower = cleaned.toLowerCase();
      for (const [canonical, aliases] of Object.entries(modelTrims)) {
        for (const alias of aliases) {
          if (alias === cleanedLower || cleanedLower.includes(alias)) {
            return canonical;
          }
        }
      }
    }
  }
  
  // Title case if no mapping found
  return cleaned.split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface NormalizedVehicle {
  year: number;
  make: string;
  makeDisplay: string;
  model: string;
  modelDisplay: string;
  trim: string;
}

/**
 * Fully normalize a vehicle's year/make/model/trim
 */
export function normalizeVehicle(
  year: number | string,
  make: string,
  model: string,
  trim?: string
): NormalizedVehicle {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(make, model);
  const normalizedTrim = trim ? normalizeTrim(make, model, trim) : "Base";
  
  // Create display versions
  const modelDisplay = normalizedModel
    .split("-")
    .map(w => {
      // Keep abbreviations uppercase
      if (/^[a-z]{2,4}$/i.test(w) && w === w.toUpperCase()) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
  
  return {
    year: typeof year === "number" ? year : parseInt(String(year), 10),
    make: normalizedMake,
    makeDisplay: getMakeDisplayName(normalizedMake),
    model: normalizedModel,
    modelDisplay,
    trim: normalizedTrim,
  };
}
