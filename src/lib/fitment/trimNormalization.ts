/**
 * Trim Normalization for Fitment Config Lookup
 * 
 * Normalizes cosmetic package trims to their fitment-equivalent base trims
 * for config lookup ONLY. Does NOT modify stored data or API responses.
 * 
 * SAFETY RULES:
 * - Only normalize when package does NOT change OEM wheel/tire fitment
 * - Preserve performance/special trims that affect fitment
 * - Log all normalizations for debugging
 * - If uncertain, DO NOT normalize
 */

export type NormalizationResult = {
  originalTrim: string;
  normalizedTrim: string;
  wasNormalized: boolean;
  reason: string | null;
  confidence: "high" | "medium" | "low";
};

// ═══════════════════════════════════════════════════════════════════════════════
// COSMETIC PACKAGE SUFFIXES - Safe to remove (don't affect fitment)
// ═══════════════════════════════════════════════════════════════════════════════

const COSMETIC_SUFFIXES = [
  // Toyota/Lexus
  "Nightshade",
  "Nightshade Edition",
  // Generic appearance packages
  "Black Edition",
  "Blacked Out",
  "Blackout",
  "Blackout Edition",
  "Dark Edition",
  "Midnight Edition",
  "Shadow Edition",
  "Stealth Edition",
  // Appearance packages
  "Appearance Package",
  "Sport Appearance",
  "Sport Appearance Package",
  "Premium Appearance",
  "Premium Appearance Package",
  "Luxury Appearance",
  // Value/convenience packages (don't affect wheels)
  "Convenience Package",
  "Technology Package",
  "Tech Package",
  "Value Package",
  "Popular Package",
  // Weather packages
  "Cold Weather Package",
  "All Weather Package",
  // Audio packages
  "Audio Package",
  "Premium Audio",
  "JBL Audio",
  "Bose Audio",
  "Harman Kardon",
  // Navigation
  "Navigation Package",
  "Nav Package",
  // Sunroof packages
  "Sunroof Package",
  "Moonroof Package",
];

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE/SPECIAL TRIMS - NEVER normalize (affect fitment)
// ═══════════════════════════════════════════════════════════════════════════════

const PROTECTED_TRIMS = [
  // Toyota/Lexus performance
  "TRD",
  "TRD Pro",
  "TRD Off-Road",
  "TRD Sport",
  "F Sport",
  "GR",
  "GR Corolla",
  "GR86",
  // Ford performance
  "Raptor",
  "Tremor",
  "ST",
  "RS",
  "GT",
  "Shelby",
  "Mach 1",
  "Dark Horse",
  "Lightning",
  // GM performance
  "SS",
  "ZL1",
  "Z28",
  "1LE",
  "Z06",
  "ZR1",
  "Z07",
  "Denali",
  "AT4",
  "AT4X",
  "High Country",
  "Trail Boss",
  // Chrysler/Dodge/Jeep performance
  "SRT",
  "Hellcat",
  "Demon",
  "Scat Pack",
  "Widebody",
  "TRX",
  "Rubicon",
  "Trailhawk",
  "Mojave",
  "Trackhawk",
  "392",
  // Nissan/Infiniti performance
  "Nismo",
  "Red Sport",
  "Midnight Edition", // Nissan version CAN affect wheels - keep protected
  // Honda/Acura performance
  "Type R",
  "Type S",
  "Si",
  "A-Spec",
  // Hyundai/Kia/Genesis performance
  "N",
  "N Line",
  "GT-Line",
  "GT1",
  "GT2",
  // European performance
  "AMG",
  "M Sport",
  "M",
  "S Line",
  "RS",
  "R Line",
  "GTI",
  "R",
  // Subaru performance
  "STI",
  "WRX",
  "Wilderness",
  // Luxury tiers that may have different wheels
  "Premium Luxury",
  "Platinum",
  "King Ranch",
  "Limited Longhorn",
  "Laramie Longhorn",
  // HD truck variants
  "Dually",
  "DRW",
  "SRW",
  "3500",
  "2500",
  "HD",
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAKE-SPECIFIC NORMALIZATION RULES
// ═══════════════════════════════════════════════════════════════════════════════

type MakeSpecificRule = {
  pattern: RegExp;
  replacement: string;
  confidence: "high" | "medium";
  description: string;
};

const MAKE_SPECIFIC_RULES: Record<string, MakeSpecificRule[]> = {
  toyota: [
    {
      pattern: /^(LE|SE|XLE|XSE|Limited)\s+Nightshade$/i,
      replacement: "$1",
      confidence: "high",
      description: "Toyota Nightshade is cosmetic only",
    },
    {
      pattern: /^(SR|SR5)\s+Nightshade$/i,
      replacement: "$1",
      confidence: "high",
      description: "Toyota truck Nightshade is cosmetic only",
    },
  ],
  lexus: [
    {
      pattern: /^(.*)\s+Black\s*Line$/i,
      replacement: "$1",
      confidence: "high",
      description: "Lexus Black Line is cosmetic only",
    },
  ],
  honda: [
    {
      pattern: /^(LX|EX|EX-L|Sport|Touring)\s+SE$/i,
      replacement: "$1",
      confidence: "medium",
      description: "Honda SE often cosmetic only",
    },
  ],
  nissan: [
    {
      pattern: /^(S|SV|SL)\s+Special\s+Edition$/i,
      replacement: "$1",
      confidence: "medium",
      description: "Nissan Special Edition often cosmetic",
    },
  ],
  hyundai: [
    {
      pattern: /^(SE|SEL|Limited)\s+Convenience$/i,
      replacement: "$1",
      confidence: "high",
      description: "Hyundai Convenience package doesn't affect wheels",
    },
  ],
  kia: [
    {
      pattern: /^(LX|LXS|S|EX)\s+Technology$/i,
      replacement: "$1",
      confidence: "high",
      description: "Kia Technology package doesn't affect wheels",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN NORMALIZATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize a trim for fitment config lookup.
 * 
 * This is a LOOKUP-LAYER enhancement only. It does NOT:
 * - Modify stored database trims
 * - Change API responses
 * - Affect user-facing display
 * 
 * @param trim - The original trim name
 * @param year - Vehicle year
 * @param make - Vehicle make
 * @param model - Vehicle model (for context, may be used in future rules)
 * @returns Normalization result with original, normalized, and metadata
 */
export function normalizeTrimForFitmentConfig(
  trim: string | null | undefined,
  year: number,
  make: string,
  model?: string
): NormalizationResult {
  // Handle empty/null trims
  if (!trim || typeof trim !== "string") {
    return {
      originalTrim: trim || "",
      normalizedTrim: trim || "",
      wasNormalized: false,
      reason: null,
      confidence: "high",
    };
  }

  const originalTrim = trim.trim();
  const makeLower = make.toLowerCase();
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Check if trim contains protected keywords - DO NOT normalize
  // ═══════════════════════════════════════════════════════════════════════════
  
  for (const protectedTrim of PROTECTED_TRIMS) {
    // Check if the protected term is a significant part of the trim
    const regex = new RegExp(`\\b${escapeRegex(protectedTrim)}\\b`, "i");
    if (regex.test(originalTrim)) {
      return {
        originalTrim,
        normalizedTrim: originalTrim,
        wasNormalized: false,
        reason: `Protected trim keyword: ${protectedTrim}`,
        confidence: "high",
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Try make-specific rules first (highest confidence)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const makeRules = MAKE_SPECIFIC_RULES[makeLower];
  if (makeRules) {
    for (const rule of makeRules) {
      if (rule.pattern.test(originalTrim)) {
        const normalized = originalTrim.replace(rule.pattern, rule.replacement).trim();
        if (normalized !== originalTrim) {
          console.log(`[TrimNormalize] ${year} ${make} ${model || ""}: "${originalTrim}" → "${normalized}" (${rule.description})`);
          return {
            originalTrim,
            normalizedTrim: normalized,
            wasNormalized: true,
            reason: rule.description,
            confidence: rule.confidence,
          };
        }
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Try generic cosmetic suffix removal (medium confidence)
  // ═══════════════════════════════════════════════════════════════════════════
  
  for (const suffix of COSMETIC_SUFFIXES) {
    // Match suffix at end of trim, with optional space/hyphen before it
    const regex = new RegExp(`[\\s-]+${escapeRegex(suffix)}$`, "i");
    if (regex.test(originalTrim)) {
      const normalized = originalTrim.replace(regex, "").trim();
      
      // Don't normalize if it would result in empty string
      if (normalized && normalized !== originalTrim) {
        console.log(`[TrimNormalize] ${year} ${make} ${model || ""}: "${originalTrim}" → "${normalized}" (removed cosmetic suffix: ${suffix})`);
        return {
          originalTrim,
          normalizedTrim: normalized,
          wasNormalized: true,
          reason: `Removed cosmetic suffix: ${suffix}`,
          confidence: "medium",
        };
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: No normalization needed
  // ═══════════════════════════════════════════════════════════════════════════
  
  return {
    originalTrim,
    normalizedTrim: originalTrim,
    wasNormalized: false,
    reason: null,
    confidence: "high",
  };
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if a trim is a protected performance/special trim.
 * Useful for UI decisions about whether to show trim in certain contexts.
 */
export function isProtectedTrim(trim: string): boolean {
  if (!trim) return false;
  
  for (const protectedTrim of PROTECTED_TRIMS) {
    const regex = new RegExp(`\\b${escapeRegex(protectedTrim)}\\b`, "i");
    if (regex.test(trim)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get list of all protected trim keywords (for documentation/debugging).
 */
export function getProtectedTrims(): string[] {
  return [...PROTECTED_TRIMS];
}

/**
 * Get list of cosmetic suffixes that can be safely removed.
 */
export function getCosmeticSuffixes(): string[] {
  return [...COSMETIC_SUFFIXES];
}
