/**
 * Product Visual Description Builders
 * 
 * Creates rich, visually-descriptive prompts for AI image generation.
 * These descriptions help AI generate more accurate product representations.
 * 
 * @created 2026-06-15
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface WheelProduct {
  brand: string;
  model: string;
  finish?: string;
  size?: string;        // "22x9"
  sku?: string;
  imageUrl?: string;
}

export interface TireProduct {
  brand: string;
  model: string;
  size?: string;        // "285/50R22"
  terrain?: string;     // "all-terrain", "mud-terrain", etc.
  sku?: string;
  imageUrl?: string;
}

export interface VisualDescription {
  prompt: string;
  hasProductImage: boolean;
  confidence: "high" | "medium" | "concept";
}

// ═══════════════════════════════════════════════════════════════════════════
// WHEEL BRAND STYLE KNOWLEDGE
// ═══════════════════════════════════════════════════════════════════════════

const WHEEL_BRAND_STYLES: Record<string, string> = {
  // Off-road focused brands
  "fuel": "aggressive off-road styling, bold spoke designs, heavy-duty construction",
  "moto metal": "rugged truck styling, industrial aesthetic, bold geometric patterns",
  "method": "clean beadlock-inspired designs, racing heritage, functional aesthetic",
  "black rhino": "military-inspired, tactical styling, rugged construction",
  "dirty life": "aggressive off-road designs, bold spoke patterns, matte finishes",
  "xd": "extreme duty construction, bold truck styling, aggressive designs",
  "hostile": "aggressive multi-spoke designs, deep lip options, bold styling",
  "rbp": "extreme off-road styling, bold truck aesthetic, aggressive designs",
  
  // Luxury/Performance brands
  "asanti": "luxury styling, intricate spoke designs, premium finishes",
  "lexani": "luxury forged wheels, sleek modern designs, premium aesthetic",
  "giovanna": "luxury European styling, elegant spoke patterns, chrome options",
  "vossen": "luxury forged, clean modern designs, concave profiles",
  "niche": "modern muscle styling, clean lines, performance aesthetic",
  
  // Classic/Muscle brands
  "american racing": "classic American styling, timeless designs, heritage aesthetic",
  "us mags": "vintage hot rod styling, retro designs, classic chrome",
  "cragar": "classic muscle car styling, timeless spoke patterns",
  
  // Modern truck brands
  "vision": "modern truck styling, clean designs, versatile aesthetic",
  "mayhem": "aggressive truck styling, bold patterns, off-road ready",
  "ultra": "versatile truck designs, clean modern styling",
  "gear": "off-road focused, rugged construction, aggressive styling",
};

// ═══════════════════════════════════════════════════════════════════════════
// WHEEL MODEL PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

const WHEEL_DESIGN_PATTERNS: Record<string, string> = {
  // Fuel models
  "rebel": "split 6-spoke design, aggressive angles, deep concave profile",
  "maverick": "twisted spoke design, flowing lines, aggressive stance",
  "assault": "multi-spoke design, intricate patterns, aggressive styling",
  "vapor": "classic 5-spoke design, clean lines, timeless truck styling",
  "beast": "bold 8-spoke design, chunky spokes, aggressive truck aesthetic",
  "triton": "6-spoke design, angular patterns, modern off-road styling",
  "blitz": "split 5-spoke design, angular cuts, aggressive stance",
  "lethal": "multi-spoke mesh design, intricate pattern, aggressive styling",
  "sledge": "chunky spoke design, industrial aesthetic, bold appearance",
  "hardline": "clean multi-spoke design, geometric patterns, modern styling",
  "coupler": "deep dish design, split spokes, aggressive fitment",
  "contra": "twisted spoke design, flowing geometry, aggressive stance",
  
  // Moto Metal models
  "mason": "split-spoke truck design, angular cuts, machined accents, deep lip appearance",
  "mo962": "8-spoke design, aggressive angles, bold truck styling",
  "mo970": "split 6-spoke design, machined face, aggressive truck aesthetic",
  "mo972": "multi-spoke design, intricate patterns, chrome accents",
  "mo985": "split 5-spoke design, aggressive angles, deep lip",
  "mo992": "6-spoke design, angular patterns, modern styling",
  
  // Method models
  "standard": "clean beadlock design, functional aesthetic, race-inspired",
  "grid": "mesh pattern design, tactical styling, functional appearance",
  "race": "competition-inspired, beadlock aesthetic, lightweight design",
  "roost": "multi-spoke beadlock style, aggressive off-road aesthetic",
  "nv": "classic 6-spoke design, clean lines, versatile styling",
  
  // Generic patterns (fallback)
  "6-spoke": "classic 6-spoke design, balanced aesthetic, truck styling",
  "5-spoke": "classic 5-spoke design, timeless appearance, clean lines",
  "8-spoke": "bold 8-spoke design, aggressive presence, truck aesthetic",
  "mesh": "intricate mesh pattern, modern styling, detailed appearance",
  "split-spoke": "split-spoke design, aggressive angles, modern aesthetic",
  "deep-dish": "deep lip design, aggressive stance, bold appearance",
};

// ═══════════════════════════════════════════════════════════════════════════
// FINISH DESCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

const FINISH_DESCRIPTIONS: Record<string, string> = {
  // Black finishes
  "black": "satin black finish, stealth appearance, modern aesthetic",
  "matte black": "matte black finish, stealth appearance, no reflections",
  "gloss black": "glossy black finish, deep reflective surface, premium appearance",
  "satin black": "satin black finish, subtle sheen, modern styling",
  "flat black": "flat black finish, completely matte, military aesthetic",
  
  // Black with accents
  "black milled": "black finish with milled spoke accents, two-tone contrast",
  "black machined": "black finish with machined face, contrasting metallic accents",
  "gloss black milled": "gloss black with milled details, premium two-tone",
  "matte black machined": "matte black with machined accents, modern contrast",
  
  // Chrome/polished
  "chrome": "brilliant chrome finish, mirror-like reflections, classic shine",
  "polished": "polished aluminum finish, bright metallic appearance",
  "pvd chrome": "PVD chrome coating, durable mirror finish, premium shine",
  
  // Machined
  "machined": "machined aluminum finish, raw metallic appearance, industrial look",
  "machined face": "machined face with contrasting lip, two-tone metallic",
  "machined dark": "dark machined finish, gunmetal appearance, subtle contrast",
  
  // Bronze/copper tones
  "bronze": "bronze metallic finish, warm copper tones, unique appearance",
  "dark bronze": "dark bronze finish, rich metallic warmth, premium look",
  "candy bronze": "candy bronze finish, deep warm tones, custom appearance",
  
  // Gray/gunmetal
  "gunmetal": "gunmetal gray finish, dark metallic, aggressive appearance",
  "anthracite": "anthracite gray finish, dark sophisticated tone",
  "gray": "gray metallic finish, neutral modern appearance",
  
  // Custom/special
  "red": "red accent finish, bold color statement, aggressive styling",
  "candy red": "candy red finish, deep glossy red, custom appearance",
  "blue": "blue accent finish, unique color statement",
};

// ═══════════════════════════════════════════════════════════════════════════
// TIRE BRAND/MODEL KNOWLEDGE
// ═══════════════════════════════════════════════════════════════════════════

const TIRE_BRAND_STYLES: Record<string, string> = {
  "nitto": "Japanese engineering, premium performance, bold sidewall designs",
  "toyo": "Japanese quality, aggressive styling, performance-focused",
  "bfgoodrich": "American heritage, rugged construction, iconic white lettering available",
  "cooper": "American-made, durable construction, value-focused",
  "falken": "Japanese performance, modern styling, versatile lineup",
  "yokohama": "Japanese precision, performance heritage, advanced compounds",
  "goodyear": "American heritage, innovative technology, trusted durability",
  "michelin": "French engineering, premium quality, refined performance",
  "continental": "German engineering, premium performance, advanced technology",
  "pirelli": "Italian performance, aggressive styling, sport-focused",
  "hankook": "Korean value, solid performance, modern designs",
  "kumho": "Korean engineering, performance value, diverse lineup",
  "general": "American heritage, rugged construction, off-road capable",
  "firestone": "American heritage, durable construction, versatile lineup",
};

const TIRE_MODEL_STYLES: Record<string, string> = {
  // Nitto models
  "terra grappler g2": "all-terrain tire, moderate sidewall lugs, highway-friendly tread pattern, clean shoulder blocks, premium appearance",
  "ridge grappler": "hybrid terrain tire, aggressive sidewall lugs, variable pitch tread blocks, rugged appearance",
  "trail grappler": "mud-terrain tire, aggressive tread blocks, bold sidewall lugs, extreme off-road appearance",
  "recon grappler": "rugged terrain tire, aggressive tread, bold sidewall design, off-road ready appearance",
  "mud grappler": "extreme mud tire, massive tread voids, aggressive sidewall, maximum traction appearance",
  "nt420v": "performance all-season, smooth tread pattern, low profile appearance, sporty styling",
  "nt555": "ultra-high performance, aggressive tread pattern, sport-oriented design",
  
  // Toyo models
  "open country at3": "all-terrain tire, aggressive tread, rugged sidewall design, versatile appearance",
  "open country mt": "mud-terrain tire, extreme tread blocks, aggressive sidewall lugs, off-road beast",
  "open country rt": "rugged terrain tire, hybrid design, aggressive yet street-friendly appearance",
  "proxes": "performance tire, modern tread design, sport-oriented appearance",
  
  // BFGoodrich models
  "ko2": "all-terrain tire, iconic sidewall design, aggressive tread blocks, rugged appearance",
  "km3": "mud-terrain tire, extreme lug pattern, aggressive sidewall, serious off-road appearance",
  "trail-terrain": "light all-terrain, subtle aggressive tread, refined rugged appearance",
  
  // Cooper models
  "discoverer at3": "all-terrain tire, balanced tread design, rugged appearance",
  "discoverer stt pro": "mud-terrain tire, aggressive tread, bold sidewall, off-road ready",
  
  // Falken models
  "wildpeak at3w": "all-terrain tire, aggressive tread pattern, rugged sidewall design",
  "wildpeak mt": "mud-terrain tire, extreme tread blocks, aggressive appearance",
};

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL DESCRIPTION BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a rich visual description for a wheel product
 */
export function buildWheelVisualDescription(wheel: WheelProduct): VisualDescription {
  const brandLower = wheel.brand.toLowerCase();
  const modelLower = wheel.model.toLowerCase();
  const finishLower = (wheel.finish || "").toLowerCase();
  
  // Get brand style
  const brandStyle = WHEEL_BRAND_STYLES[brandLower] || "aftermarket wheel styling";
  
  // Get model pattern
  let modelPattern = "";
  for (const [key, desc] of Object.entries(WHEEL_DESIGN_PATTERNS)) {
    if (modelLower.includes(key)) {
      modelPattern = desc;
      break;
    }
  }
  if (!modelPattern) {
    // Infer from common patterns in name
    if (modelLower.includes("6") && modelLower.includes("spoke")) {
      modelPattern = WHEEL_DESIGN_PATTERNS["6-spoke"];
    } else if (modelLower.includes("5") && modelLower.includes("spoke")) {
      modelPattern = WHEEL_DESIGN_PATTERNS["5-spoke"];
    } else if (modelLower.includes("mesh")) {
      modelPattern = WHEEL_DESIGN_PATTERNS["mesh"];
    } else {
      modelPattern = "modern spoke design, aggressive styling, truck-ready appearance";
    }
  }
  
  // Get finish description
  let finishDesc = "";
  for (const [key, desc] of Object.entries(FINISH_DESCRIPTIONS)) {
    if (finishLower.includes(key.split(" ")[0])) {
      finishDesc = desc;
      break;
    }
  }
  if (!finishDesc && finishLower) {
    finishDesc = `${wheel.finish} finish`;
  } else if (!finishDesc) {
    finishDesc = "matte black finish, modern appearance";
  }
  
  // Build the full description
  const parts = [
    `${wheel.brand} ${wheel.model} aftermarket wheel`,
    `featuring ${modelPattern}`,
    finishDesc,
    brandStyle,
    wheel.size ? `${wheel.size.split("x")[0]}-inch diameter` : null,
    "modern off-road truck styling",
  ].filter(Boolean);
  
  return {
    prompt: parts.join(", "),
    hasProductImage: !!wheel.imageUrl,
    confidence: wheel.imageUrl ? "high" : wheel.sku ? "medium" : "concept",
  };
}

/**
 * Build a rich visual description for a tire product
 */
export function buildTireVisualDescription(tire: TireProduct): VisualDescription {
  const brandLower = tire.brand.toLowerCase();
  const modelLower = tire.model.toLowerCase();
  
  // Get brand style
  const brandStyle = TIRE_BRAND_STYLES[brandLower] || "quality tire construction";
  
  // Get model style
  let modelStyle = "";
  for (const [key, desc] of Object.entries(TIRE_MODEL_STYLES)) {
    if (modelLower.includes(key.split(" ")[0]) || modelLower.includes(key)) {
      modelStyle = desc;
      break;
    }
  }
  
  // Fallback based on terrain type
  if (!modelStyle && tire.terrain) {
    switch (tire.terrain.toLowerCase()) {
      case "all-terrain":
      case "at":
        modelStyle = "all-terrain tire, moderate sidewall lugs, balanced tread pattern, rugged appearance";
        break;
      case "mud-terrain":
      case "mt":
        modelStyle = "mud-terrain tire, aggressive tread blocks, bold sidewall lugs, extreme off-road appearance";
        break;
      case "highway":
      case "ht":
        modelStyle = "highway tire, smooth tread pattern, refined sidewall, quiet road manners";
        break;
      case "performance":
        modelStyle = "performance tire, aggressive tread pattern, low profile design, sport-oriented";
        break;
      default:
        modelStyle = "quality truck tire, balanced tread design, versatile appearance";
    }
  }
  
  if (!modelStyle) {
    modelStyle = "quality truck tire, modern tread design, rugged construction";
  }
  
  // Build the full description
  const parts = [
    `${tire.brand} ${tire.model}`,
    modelStyle,
    brandStyle,
    tire.size ? `size ${tire.size}` : null,
  ].filter(Boolean);
  
  return {
    prompt: parts.join(", "),
    hasProductImage: !!tire.imageUrl,
    confidence: tire.imageUrl ? "high" : tire.sku ? "medium" : "concept",
  };
}

/**
 * Get overall confidence level for a mockup
 */
export function getMockupConfidence(
  wheelDesc: VisualDescription,
  tireDesc: VisualDescription
): "high" | "medium" | "concept" {
  // High = both have product images
  if (wheelDesc.hasProductImage && tireDesc.hasProductImage) {
    return "high";
  }
  // Medium = at least one has product image or both have SKUs
  if (wheelDesc.hasProductImage || tireDesc.hasProductImage) {
    return "medium";
  }
  if (wheelDesc.confidence === "medium" || tireDesc.confidence === "medium") {
    return "medium";
  }
  // Concept = generating from description only
  return "concept";
}

/**
 * Parse wheel style string into structured data
 * Input: "Fuel Rebel D679 Matte Black"
 * Output: { brand: "Fuel", model: "Rebel D679", finish: "Matte Black" }
 */
export function parseWheelStyle(wheelStyle: string): WheelProduct {
  const parts = wheelStyle.trim().split(/\s+/);
  
  if (parts.length === 0) {
    return { brand: "Custom", model: "Wheel" };
  }
  
  // Known brand names (multi-word)
  const multiBrands = ["black rhino", "dirty life", "american racing", "us mags", "moto metal"];
  const lowerStyle = wheelStyle.toLowerCase();
  
  let brandEnd = 1;
  for (const mb of multiBrands) {
    if (lowerStyle.startsWith(mb)) {
      brandEnd = mb.split(" ").length;
      break;
    }
  }
  
  const brand = parts.slice(0, brandEnd).join(" ");
  const remaining = parts.slice(brandEnd);
  
  // Common finish keywords
  const finishKeywords = ["black", "chrome", "machined", "milled", "bronze", "gunmetal", "polished", "matte", "gloss", "satin", "red", "blue", "gray", "anthracite"];
  
  // Find where finish starts
  let finishStart = remaining.length;
  for (let i = 0; i < remaining.length; i++) {
    const word = remaining[i].toLowerCase();
    if (finishKeywords.some(f => word.includes(f))) {
      finishStart = i;
      break;
    }
  }
  
  const model = remaining.slice(0, finishStart).join(" ") || "Wheel";
  const finish = remaining.slice(finishStart).join(" ") || undefined;
  
  return { brand, model, finish };
}

export default {
  buildWheelVisualDescription,
  buildTireVisualDescription,
  getMockupConfidence,
  parseWheelStyle,
};
