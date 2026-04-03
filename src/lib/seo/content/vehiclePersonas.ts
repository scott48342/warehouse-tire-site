/**
 * Vehicle Personas & Classification
 * 
 * Classifies vehicles into personas for targeted content generation.
 * Uses make/model data to determine vehicle type and associated messaging.
 * 
 * @created 2026-04-03
 */

// ============================================================================
// Types
// ============================================================================

export type VehicleCategory = 
  | "truck"
  | "full-size-suv"
  | "mid-size-suv"
  | "compact-suv"
  | "performance"
  | "muscle"
  | "luxury"
  | "sedan"
  | "sports-car"
  | "off-road"
  | "van"
  | "electric"
  | "classic";

export interface VehiclePersona {
  category: VehicleCategory;
  displayCategory: string;
  wheelStyle: string;
  tireStyle: string;
  commonMods: string[];
  keywords: string[];
  tonality: "rugged" | "performance" | "luxury" | "practical" | "adventurous";
  supportsLifted: boolean;
  supportsStaggered: boolean;
}

// ============================================================================
// Vehicle Classification Rules
// ============================================================================

const TRUCK_MODELS = new Set([
  "f-150", "f-250", "f-350", "silverado", "silverado 1500", "silverado 2500", "silverado 3500",
  "sierra", "sierra 1500", "sierra 2500", "sierra 3500", "ram 1500", "ram 2500", "ram 3500",
  "tacoma", "tundra", "colorado", "canyon", "ranger", "frontier", "titan", "gladiator",
  "ridgeline", "maverick", "santa cruz",
]);

const FULL_SIZE_SUV_MODELS = new Set([
  "tahoe", "suburban", "yukon", "yukon xl", "escalade", "escalade esv",
  "expedition", "expedition max", "navigator", "navigator l", "sequoia",
  "armada", "qx80", "land cruiser", "lx",
]);

const MID_SIZE_SUV_MODELS = new Set([
  "4runner", "grand cherokee", "grand cherokee l", "durango", "explorer",
  "pilot", "passport", "highlander", "palisade", "telluride", "atlas",
  "traverse", "blazer", "pathfinder", "murano", "cx-9", "ascent",
]);

const COMPACT_SUV_MODELS = new Set([
  "rav4", "cr-v", "cx-5", "tucson", "sportage", "rogue", "forester",
  "outback", "crosstrek", "equinox", "trailblazer", "escape", "bronco sport",
  "compass", "cherokee", "cx-30", "hr-v", "kona", "seltos",
]);

const OFF_ROAD_MODELS = new Set([
  "wrangler", "bronco", "4runner", "defender", "g-class", "g-wagon",
  "land cruiser", "lx", "gx", "fj cruiser",
]);

const PERFORMANCE_MODELS = new Set([
  "mustang", "camaro", "challenger", "charger", "corvette", "supra",
  "wrx", "sti", "golf r", "civic type r", "civic si", "focus rs", "focus st",
  "veloster n", "elantra n", "86", "brz", "gr86", "miata", "mx-5",
  "370z", "400z", "z", "gt-r", "m2", "m3", "m4", "m5", "rs3", "rs5", "s4", "s5",
  "amg gt", "c63", "e63", "cls63",
]);

const MUSCLE_MODELS = new Set([
  "mustang", "camaro", "challenger", "charger", "corvette",
]);

const LUXURY_MAKES = new Set([
  "bmw", "mercedes", "mercedes-benz", "audi", "porsche", "lexus", "infiniti",
  "acura", "genesis", "maserati", "bentley", "rolls-royce", "aston martin",
  "jaguar", "land rover", "range rover", "cadillac", "lincoln",
]);

const ELECTRIC_MODELS = new Set([
  "model 3", "model y", "model s", "model x", "rivian r1t", "rivian r1s",
  "mach-e", "mustang mach-e", "lightning", "f-150 lightning", "hummer ev",
  "ioniq 5", "ioniq 6", "ev6", "id.4", "id.buzz", "taycan", "e-tron",
  "bolt", "bolt euv", "leaf", "ariya",
]);

const VAN_MODELS = new Set([
  "sienna", "odyssey", "pacifica", "carnival", "sedona", "transit",
  "sprinter", "metris", "promaster",
]);

// ============================================================================
// Classification Functions
// ============================================================================

function normalizeModel(model: string): string {
  return String(model || "")
    .toLowerCase()
    .trim()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeMake(make: string): string {
  return String(make || "")
    .toLowerCase()
    .trim()
    .replace(/[-_]/g, " ");
}

/**
 * Classify a vehicle into a category
 */
export function classifyVehicle(make: string, model: string): VehicleCategory {
  const normMake = normalizeMake(make);
  const normModel = normalizeModel(model);
  
  // Check specific model lists first
  if (ELECTRIC_MODELS.has(normModel)) return "electric";
  if (TRUCK_MODELS.has(normModel)) return "truck";
  if (OFF_ROAD_MODELS.has(normModel)) return "off-road";
  if (FULL_SIZE_SUV_MODELS.has(normModel)) return "full-size-suv";
  if (MID_SIZE_SUV_MODELS.has(normModel)) return "mid-size-suv";
  if (COMPACT_SUV_MODELS.has(normModel)) return "compact-suv";
  if (MUSCLE_MODELS.has(normModel)) return "muscle";
  if (PERFORMANCE_MODELS.has(normModel)) return "performance";
  if (VAN_MODELS.has(normModel)) return "van";
  
  // Check make-based classification
  if (LUXURY_MAKES.has(normMake)) return "luxury";
  
  // Check for partial matches
  for (const m of TRUCK_MODELS) {
    if (normModel.includes(m) || m.includes(normModel)) return "truck";
  }
  
  for (const m of PERFORMANCE_MODELS) {
    if (normModel.includes(m)) return "performance";
  }
  
  // Default to sedan
  return "sedan";
}

/**
 * Get full persona for a vehicle
 */
export function getVehiclePersona(make: string, model: string): VehiclePersona {
  const category = classifyVehicle(make, model);
  
  const personas: Record<VehicleCategory, VehiclePersona> = {
    "truck": {
      category: "truck",
      displayCategory: "Truck",
      wheelStyle: "aggressive off-road wheels, rugged all-terrain designs, lifted truck wheels",
      tireStyle: "all-terrain tires, mud-terrain tires, highway tires",
      commonMods: ["lift kits", "leveling kits", "bigger wheels", "off-road tires"],
      keywords: ["truck wheels", "truck tires", "off-road", "towing", "payload"],
      tonality: "rugged",
      supportsLifted: true,
      supportsStaggered: false,
    },
    "full-size-suv": {
      category: "full-size-suv",
      displayCategory: "Full-Size SUV",
      wheelStyle: "bold SUV wheels, chrome wheels, black wheels",
      tireStyle: "highway tires, all-season tires, performance SUV tires",
      commonMods: ["bigger wheels", "leveling", "upgraded tires"],
      keywords: ["SUV wheels", "SUV tires", "family hauler", "towing capable"],
      tonality: "practical",
      supportsLifted: true,
      supportsStaggered: false,
    },
    "mid-size-suv": {
      category: "mid-size-suv",
      displayCategory: "Mid-Size SUV",
      wheelStyle: "stylish SUV wheels, sport wheels, all-terrain wheels",
      tireStyle: "all-season tires, crossover tires, light off-road tires",
      commonMods: ["wheel upgrades", "tire upgrades", "mild lift"],
      keywords: ["crossover wheels", "SUV tires", "versatile", "family"],
      tonality: "practical",
      supportsLifted: true,
      supportsStaggered: false,
    },
    "compact-suv": {
      category: "compact-suv",
      displayCategory: "Compact SUV",
      wheelStyle: "sport wheels, stylish wheels, efficient designs",
      tireStyle: "all-season tires, fuel-efficient tires",
      commonMods: ["wheel upgrades", "performance tires"],
      keywords: ["compact SUV wheels", "crossover tires", "efficient"],
      tonality: "practical",
      supportsLifted: false,
      supportsStaggered: false,
    },
    "off-road": {
      category: "off-road",
      displayCategory: "Off-Road Vehicle",
      wheelStyle: "beadlock wheels, off-road wheels, rock crawler wheels",
      tireStyle: "mud-terrain tires, rock crawling tires, all-terrain tires",
      commonMods: ["lift kits", "bumpers", "winches", "skid plates"],
      keywords: ["off-road wheels", "trail tires", "4x4", "crawling"],
      tonality: "adventurous",
      supportsLifted: true,
      supportsStaggered: false,
    },
    "performance": {
      category: "performance",
      displayCategory: "Performance Car",
      wheelStyle: "lightweight wheels, forged wheels, track wheels",
      tireStyle: "summer tires, performance tires, track tires",
      commonMods: ["coilovers", "big brake kits", "sticky tires"],
      keywords: ["performance wheels", "track tires", "grip", "handling"],
      tonality: "performance",
      supportsLifted: false,
      supportsStaggered: true,
    },
    "muscle": {
      category: "muscle",
      displayCategory: "Muscle Car",
      wheelStyle: "classic muscle wheels, modern muscle wheels, drag wheels",
      tireStyle: "performance tires, drag radials, summer tires",
      commonMods: ["lowering", "wide tires", "drag setup"],
      keywords: ["muscle car wheels", "drag tires", "power", "classic style"],
      tonality: "performance",
      supportsLifted: false,
      supportsStaggered: true,
    },
    "luxury": {
      category: "luxury",
      displayCategory: "Luxury Vehicle",
      wheelStyle: "premium wheels, elegant designs, OEM-plus styles",
      tireStyle: "touring tires, premium all-season, run-flat tires",
      commonMods: ["wheel upgrades", "premium tires", "lowering springs"],
      keywords: ["luxury wheels", "premium tires", "comfort", "style"],
      tonality: "luxury",
      supportsLifted: false,
      supportsStaggered: true,
    },
    "sedan": {
      category: "sedan",
      displayCategory: "Sedan",
      wheelStyle: "sport wheels, OEM-plus wheels, classic designs",
      tireStyle: "all-season tires, touring tires, performance tires",
      commonMods: ["wheel upgrades", "suspension", "performance tires"],
      keywords: ["sedan wheels", "car tires", "comfortable", "efficient"],
      tonality: "practical",
      supportsLifted: false,
      supportsStaggered: false,
    },
    "sports-car": {
      category: "sports-car",
      displayCategory: "Sports Car",
      wheelStyle: "lightweight wheels, racing wheels, forged wheels",
      tireStyle: "summer tires, track tires, ultra-high performance",
      commonMods: ["coilovers", "aero", "track prep"],
      keywords: ["sports car wheels", "performance tires", "track", "handling"],
      tonality: "performance",
      supportsLifted: false,
      supportsStaggered: true,
    },
    "electric": {
      category: "electric",
      displayCategory: "Electric Vehicle",
      wheelStyle: "aerodynamic wheels, lightweight wheels, EV-specific designs",
      tireStyle: "EV-specific tires, low rolling resistance, all-season",
      commonMods: ["aero wheels", "EV tires", "range optimization"],
      keywords: ["EV wheels", "electric car tires", "range", "efficiency"],
      tonality: "practical",
      supportsLifted: false,
      supportsStaggered: false,
    },
    "van": {
      category: "van",
      displayCategory: "Van",
      wheelStyle: "durable wheels, load-rated wheels, stylish van wheels",
      tireStyle: "all-season tires, load-rated tires, highway tires",
      commonMods: ["wheel upgrades", "better tires", "load capacity"],
      keywords: ["van wheels", "minivan tires", "family", "hauling"],
      tonality: "practical",
      supportsLifted: false,
      supportsStaggered: false,
    },
    "classic": {
      category: "classic",
      displayCategory: "Classic Vehicle",
      wheelStyle: "vintage-style wheels, classic designs, period-correct wheels",
      tireStyle: "classic car tires, wide whitewalls, period-correct",
      commonMods: ["pro-touring", "restomod", "classic restoration"],
      keywords: ["classic wheels", "vintage tires", "restoration", "timeless"],
      tonality: "luxury",
      supportsLifted: false,
      supportsStaggered: false,
    },
  };
  
  return personas[category];
}

// ============================================================================
// Exports
// ============================================================================

export const vehiclePersonas = {
  classifyVehicle,
  getVehiclePersona,
};

export default vehiclePersonas;
