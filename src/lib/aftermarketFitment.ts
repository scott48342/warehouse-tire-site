/**
 * Aftermarket Fitment Expansion
 * 
 * Uses Wheel-Size OEM data as the base layer, then applies configurable
 * expansion rules for aftermarket wheel fitment.
 * 
 * HARD RULES (never relaxed):
 * - bolt pattern exact match
 * - center bore compatibility (wheel >= vehicle)
 * - stud count / PCD match
 * 
 * SOFT RULES (mode-based expansion):
 * - diameter (allow plus-sizing beyond OEM)
 * - width (allow wider wheels)
 * - offset (allow range expansion, especially lower for trucks)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type FitmentMode = "oem" | "aftermarket_safe" | "aggressive" | "truck";

export type ExpansionRules = {
  // Diameter expansion (inches above OEM max)
  diameterPlusMin: number;  // e.g., 0 for OEM mode
  diameterPlusMax: number;  // e.g., +4 for aggressive

  // Width expansion (inches above OEM max)
  widthPlusMin: number;
  widthPlusMax: number;

  // Offset expansion (mm beyond OEM range)
  offsetExpandLow: number;   // expand lower limit (more negative = more poke)
  offsetExpandHigh: number;  // expand upper limit (more tucked)
};

export type FitmentEnvelope = {
  // Base values from OEM data
  boltPattern: string;
  centerBore: number;
  studHoles: number;
  pcd: number;

  // OEM ranges
  oemMinDiameter: number;
  oemMaxDiameter: number;
  oemMinWidth: number;
  oemMaxWidth: number;
  oemMinOffset: number;
  oemMaxOffset: number;

  // Expanded ranges (after applying mode rules)
  allowedMinDiameter: number;
  allowedMaxDiameter: number;
  allowedMinWidth: number;
  allowedMaxWidth: number;
  allowedMinOffset: number;
  allowedMaxOffset: number;

  // Mode used
  mode: FitmentMode;
};

export type WheelSpec = {
  sku: string;
  boltPattern?: string;
  centerBore?: number;
  diameter?: number;
  width?: number;
  offset?: number;
};

export type FitmentValidation = {
  sku: string;
  
  // Hard rule results (never relaxed)
  boltPatternPass: boolean;
  centerBorePass: boolean;
  
  // Soft rule results (mode-dependent)
  diameterPass: boolean;
  widthPass: boolean;
  offsetPass: boolean;
  
  // Overall classification
  fitmentMode: FitmentMode;
  fitmentClass: "surefit" | "specfit" | "excluded";
  
  // Debug info
  exclusionReasons: string[];
  
  // Values checked (for debugging)
  checked: {
    boltPattern?: string;
    centerBore?: number;
    diameter?: number;
    width?: number;
    offset?: number;
  };
  
  // Bolt pattern debug (for dual-pattern wheels)
  boltPatternDebug?: {
    parsedPatterns: string[];
    matchedPattern?: string;
    vehiclePattern: string;
  };
  
  // Envelope used
  envelope?: {
    allowedDiameterRange: [number, number];
    allowedWidthRange: [number, number];
    allowedOffsetRange: [number, number];
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE TYPE DETECTION (for auto mode selection)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect if a vehicle is likely a truck/SUV based on model name or specs
 * Used to auto-select fitment mode
 */
export function detectVehicleType(
  model: string,
  options?: {
    boltPattern?: string;
    tireType?: string;
    body?: string;
    minDiameter?: number;
    maxWidth?: number;
  }
): "truck" | "suv" | "car" {
  const modelLower = model.toLowerCase();
  
  // Explicit truck model names
  const truckPatterns = [
    /f[-\s]?150/i, /f[-\s]?250/i, /f[-\s]?350/i, // Ford F-series
    /silverado/i, /sierra/i, /colorado/i, /canyon/i, // GM trucks
    /ram\s*\d+/i, // Ram
    /tacoma/i, /tundra/i, // Toyota trucks
    /frontier/i, /titan/i, // Nissan trucks
    /ranger/i, /maverick/i, // Ford smaller trucks
    /ridgeline/i, // Honda
    /gladiator/i, // Jeep
    /raptor/i, /tremor/i, // Performance truck trims
  ];
  
  // SUV model names
  const suvPatterns = [
    /wrangler/i, /cherokee/i, /grand cherokee/i, /4runner/i, /sequoia/i,
    /tahoe/i, /suburban/i, /yukon/i, /expedition/i, /navigator/i,
    /explorer/i, /bronco/i, /defender/i, /range rover/i, /discovery/i,
    /land cruiser/i, /gx/i, /lx/i, /pilot/i, /passport/i,
    /highlander/i, /pathfinder/i, /armada/i, /telluride/i, /palisade/i,
    /escalade/i, /blazer/i, /trailblazer/i, /traverse/i,
    /durango/i, /4x4/i, /off[-\s]?road/i,
  ];
  
  // Check explicit truck patterns
  for (const pattern of truckPatterns) {
    if (pattern.test(modelLower)) return "truck";
  }
  
  // Check SUV patterns
  for (const pattern of suvPatterns) {
    if (pattern.test(modelLower)) return "suv";
  }
  
  // Heuristics from specs
  if (options) {
    // 6-lug bolt patterns are almost always trucks/SUVs
    if (options.boltPattern?.startsWith("6x")) return "truck";
    if (options.boltPattern?.startsWith("8x")) return "truck";
    
    // Tire type hints
    if (options.tireType?.toLowerCase() === "suv") return "suv";
    if (options.tireType?.toLowerCase() === "light truck") return "truck";
    
    // Body type hints
    const body = options.body?.toLowerCase() || "";
    if (body.includes("pickup") || body.includes("truck")) return "truck";
    if (body.includes("suv") || body.includes("crossover")) return "suv";
    
    // Large wheel specs hint at truck/SUV
    if (options.minDiameter && options.minDiameter >= 17 && options.maxWidth && options.maxWidth >= 8.5) {
      return "suv";
    }
  }
  
  return "car";
}

/**
 * Get the recommended default fitment mode for a vehicle
 */
export function getDefaultFitmentMode(
  vehicleType: "truck" | "suv" | "car"
): FitmentMode {
  switch (vehicleType) {
    case "truck":
      return "truck";
    case "suv":
      return "aggressive"; // SUVs often get aftermarket but not as extreme as trucks
    case "car":
    default:
      return "aftermarket_safe";
  }
}

/**
 * Auto-detect fitment mode from vehicle info
 */
export function autoDetectFitmentMode(
  model: string,
  options?: {
    boltPattern?: string;
    tireType?: string;
    body?: string;
    minDiameter?: number;
    maxWidth?: number;
  }
): { vehicleType: "truck" | "suv" | "car"; recommendedMode: FitmentMode } {
  const vehicleType = detectVehicleType(model, options);
  const recommendedMode = getDefaultFitmentMode(vehicleType);
  return { vehicleType, recommendedMode };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPANSION RULE PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export const EXPANSION_PRESETS: Record<FitmentMode, ExpansionRules> = {
  oem: {
    diameterPlusMin: 0,
    diameterPlusMax: 0,
    widthPlusMin: 0,
    widthPlusMax: 0,
    offsetExpandLow: 0,
    offsetExpandHigh: 0,
  },
  
  aftermarket_safe: {
    // Common aftermarket sizing: +2" diameter, +1" width, ±10mm offset
    diameterPlusMin: 0,
    diameterPlusMax: 2,
    widthPlusMin: 0,
    widthPlusMax: 1,
    offsetExpandLow: 10,   // allow 10mm lower offset
    offsetExpandHigh: 10,  // allow 10mm higher offset
  },
  
  aggressive: {
    // Truck/enthusiast fitment: +4" diameter, +3" width, very wide offset range
    // Allows aggressive poke/stance for lifted trucks
    diameterPlusMin: -1,   // allow 1" smaller too
    diameterPlusMax: 4,
    widthPlusMin: -0.5,    // allow slightly narrower too
    widthPlusMax: 3,
    offsetExpandLow: 60,   // allow VERY low offset (aggressive poke, -26mm etc)
    offsetExpandHigh: 20,  // allow higher offset (tucked)
  },
  
  truck: {
    // Maximum flexibility for truck/SUV builds - matches Wheel Pros YMM behavior
    // Essentially allows any wheel with correct bolt pattern and center bore
    diameterPlusMin: -2,   // allow 2" smaller
    diameterPlusMax: 6,    // allow up to +6" (26" on 20" OEM)
    widthPlusMin: -1,      // allow narrower
    widthPlusMax: 5,       // allow up to 14" wide wheels
    offsetExpandLow: 100,  // allow extreme negative offset (-56mm etc)
    offsetExpandHigh: 30,  // allow higher offset
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ENVELOPE BUILDING
// ─────────────────────────────────────────────────────────────────────────────

export type OEMSpecs = {
  boltPattern: string;
  centerBore: number;
  studHoles?: number;
  pcd?: number;
  wheelSpecs: Array<{
    rimDiameter: number;
    rimWidth: number;
    offset: number | null;
  }>;
};

/**
 * Build a fitment envelope from OEM specs + expansion mode
 */
export function buildFitmentEnvelope(
  oem: OEMSpecs,
  mode: FitmentMode = "aftermarket_safe",
  customRules?: Partial<ExpansionRules>
): FitmentEnvelope {
  const rules = customRules 
    ? { ...EXPANSION_PRESETS[mode], ...customRules }
    : EXPANSION_PRESETS[mode];

  // Extract OEM ranges from wheel specs
  const diameters = oem.wheelSpecs.map(s => s.rimDiameter).filter(d => d > 0);
  const widths = oem.wheelSpecs.map(s => s.rimWidth).filter(w => w > 0);
  const offsets = oem.wheelSpecs.map(s => s.offset).filter((o): o is number => o !== null);

  const oemMinDiameter = diameters.length > 0 ? Math.min(...diameters) : 15;
  const oemMaxDiameter = diameters.length > 0 ? Math.max(...diameters) : 22;
  const oemMinWidth = widths.length > 0 ? Math.min(...widths) : 6;
  const oemMaxWidth = widths.length > 0 ? Math.max(...widths) : 10;
  const oemMinOffset = offsets.length > 0 ? Math.min(...offsets) : 20;
  const oemMaxOffset = offsets.length > 0 ? Math.max(...offsets) : 50;

  // Parse bolt pattern for studHoles and pcd if not provided
  let studHoles = oem.studHoles;
  let pcd = oem.pcd;
  if (!studHoles || !pcd) {
    const match = oem.boltPattern.match(/^(\d+)x([\d.]+)$/);
    if (match) {
      studHoles = studHoles || parseInt(match[1], 10);
      pcd = pcd || parseFloat(match[2]);
    }
  }

  // Apply expansion rules
  const allowedMinDiameter = oemMinDiameter + rules.diameterPlusMin;
  const allowedMaxDiameter = oemMaxDiameter + rules.diameterPlusMax;
  const allowedMinWidth = oemMinWidth + rules.widthPlusMin;
  const allowedMaxWidth = oemMaxWidth + rules.widthPlusMax;
  const allowedMinOffset = oemMinOffset - rules.offsetExpandLow;
  const allowedMaxOffset = oemMaxOffset + rules.offsetExpandHigh;

  return {
    boltPattern: oem.boltPattern,
    centerBore: oem.centerBore,
    studHoles: studHoles || 5,
    pcd: pcd || 114.3,

    oemMinDiameter,
    oemMaxDiameter,
    oemMinWidth,
    oemMaxWidth,
    oemMinOffset,
    oemMaxOffset,

    allowedMinDiameter,
    allowedMaxDiameter,
    allowedMinWidth,
    allowedMaxWidth,
    allowedMinOffset,
    allowedMaxOffset,

    mode,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize bolt pattern for comparison
 * Handles formats like "6x135", "6X135", "6-135"
 */
export function normalizeBoltPattern(bp: string): string {
  return bp.toLowerCase().replace(/[x×-]/g, "x").trim();
}

/**
 * Parse dual/multi bolt patterns (e.g., "6x135/6x139.7" or "5x114.3/5x120")
 * Returns an array of normalized patterns
 */
export function parseBoltPatterns(bp: string): string[] {
  if (!bp) return [];
  // Split on "/" or "," which are common dual-pattern separators
  const parts = bp.split(/[\/,]/).map(p => normalizeBoltPattern(p.trim())).filter(p => p.length > 0);
  return parts.length > 0 ? parts : [normalizeBoltPattern(bp)];
}

/**
 * Check if wheel bolt pattern matches vehicle
 * Supports dual-pattern wheels (e.g., "6x135/6x139.7")
 * Returns { matches: boolean, matchedPattern?: string, parsedPatterns: string[] }
 */
export function boltPatternMatches(
  wheelBp: string, 
  vehicleBp: string
): { matches: boolean; matchedPattern?: string; parsedPatterns: string[] } {
  const vehicleNorm = normalizeBoltPattern(vehicleBp);
  const wheelPatterns = parseBoltPatterns(wheelBp);
  
  for (const pattern of wheelPatterns) {
    if (pattern === vehicleNorm) {
      return { matches: true, matchedPattern: pattern, parsedPatterns: wheelPatterns };
    }
  }
  
  return { matches: false, parsedPatterns: wheelPatterns };
}

/**
 * Check if wheel center bore is compatible with vehicle hub
 * Wheel bore must be >= vehicle hub (wheels can use hub-centric rings if larger)
 */
export function centerBoreCompatible(wheelBore: number, vehicleHub: number): boolean {
  // Wheel bore must be >= vehicle hub
  // Allow small tolerance for measurement variance
  return wheelBore >= vehicleHub - 0.1;
}

/**
 * Validate a wheel against the fitment envelope
 */
export function validateWheel(
  wheel: WheelSpec,
  envelope: FitmentEnvelope
): FitmentValidation {
  const exclusionReasons: string[] = [];
  
  // ─────────────────────────────────────────────────────────────────────────
  // HARD RULES (never relaxed)
  // ─────────────────────────────────────────────────────────────────────────
  
  // Bolt pattern - REQUIRED; supports dual-pattern wheels (e.g., "6x135/6x139.7")
  let boltPatternPass = false;
  let boltPatternDebug: FitmentValidation["boltPatternDebug"] | undefined;
  
  if (wheel.boltPattern) {
    const bpResult = boltPatternMatches(wheel.boltPattern, envelope.boltPattern);
    boltPatternPass = bpResult.matches;
    boltPatternDebug = {
      parsedPatterns: bpResult.parsedPatterns,
      matchedPattern: bpResult.matchedPattern,
      vehiclePattern: normalizeBoltPattern(envelope.boltPattern),
    };
    
    if (!boltPatternPass) {
      const patternsStr = bpResult.parsedPatterns.length > 1 
        ? `[${bpResult.parsedPatterns.join(", ")}]` 
        : wheel.boltPattern;
      exclusionReasons.push(
        `Bolt pattern mismatch: wheel=${patternsStr}, vehicle=${envelope.boltPattern}`
      );
    }
  } else {
    // If wheel has no bolt pattern data, we can't validate - fail hard
    boltPatternPass = false;
    exclusionReasons.push("Missing bolt pattern data");
  }
  
  // Center bore - wheel must be >= vehicle hub
  let centerBorePass = true; // Default to pass if no data (specfit)
  if (wheel.centerBore !== undefined && wheel.centerBore > 0) {
    centerBorePass = centerBoreCompatible(wheel.centerBore, envelope.centerBore);
    if (!centerBorePass) {
      exclusionReasons.push(
        `Center bore too small: wheel=${wheel.centerBore}mm, vehicle hub=${envelope.centerBore}mm`
      );
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // SOFT RULES (mode-dependent)
  // ─────────────────────────────────────────────────────────────────────────
  
  // Diameter
  let diameterPass = true; // Default to pass if no data (specfit)
  if (wheel.diameter !== undefined && wheel.diameter > 0) {
    diameterPass = 
      wheel.diameter >= envelope.allowedMinDiameter &&
      wheel.diameter <= envelope.allowedMaxDiameter;
    if (!diameterPass) {
      exclusionReasons.push(
        `Diameter out of range: wheel=${wheel.diameter}", allowed=${envelope.allowedMinDiameter}-${envelope.allowedMaxDiameter}" (OEM: ${envelope.oemMinDiameter}-${envelope.oemMaxDiameter}")`
      );
    }
  }
  
  // Width
  let widthPass = true; // Default to pass if no data (specfit)
  if (wheel.width !== undefined && wheel.width > 0) {
    widthPass = 
      wheel.width >= envelope.allowedMinWidth &&
      wheel.width <= envelope.allowedMaxWidth;
    if (!widthPass) {
      exclusionReasons.push(
        `Width out of range: wheel=${wheel.width}", allowed=${envelope.allowedMinWidth}-${envelope.allowedMaxWidth}" (OEM: ${envelope.oemMinWidth}-${envelope.oemMaxWidth}")`
      );
    }
  }
  
  // Offset
  let offsetPass = true; // Default to pass if no data (specfit)
  if (wheel.offset !== undefined) {
    offsetPass = 
      wheel.offset >= envelope.allowedMinOffset &&
      wheel.offset <= envelope.allowedMaxOffset;
    if (!offsetPass) {
      exclusionReasons.push(
        `Offset out of range: wheel=${wheel.offset}mm, allowed=${envelope.allowedMinOffset}-${envelope.allowedMaxOffset}mm (OEM: ${envelope.oemMinOffset}-${envelope.oemMaxOffset}mm)`
      );
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // CLASSIFICATION
  // ─────────────────────────────────────────────────────────────────────────
  
  // Hard rule failure = excluded
  const hardRulesPass = boltPatternPass && centerBorePass;
  
  // Soft rule check
  const softRulesPass = diameterPass && widthPass && offsetPass;
  
  // Check for missing data (specfit case)
  const hasMissingData = 
    wheel.centerBore === undefined ||
    wheel.diameter === undefined ||
    wheel.width === undefined ||
    wheel.offset === undefined;
  
  let fitmentClass: "surefit" | "specfit" | "excluded";
  
  if (!hardRulesPass) {
    fitmentClass = "excluded";
  } else if (!softRulesPass) {
    fitmentClass = "excluded";
  } else if (hasMissingData) {
    fitmentClass = "specfit";
  } else {
    fitmentClass = "surefit";
  }
  
  return {
    sku: wheel.sku,
    boltPatternPass,
    centerBorePass,
    diameterPass,
    widthPass,
    offsetPass,
    fitmentMode: envelope.mode,
    fitmentClass,
    exclusionReasons,
    checked: {
      boltPattern: wheel.boltPattern,
      centerBore: wheel.centerBore,
      diameter: wheel.diameter,
      width: wheel.width,
      offset: wheel.offset,
    },
    boltPatternDebug,
    envelope: {
      allowedDiameterRange: [envelope.allowedMinDiameter, envelope.allowedMaxDiameter],
      allowedWidthRange: [envelope.allowedMinWidth, envelope.allowedMaxWidth],
      allowedOffsetRange: [envelope.allowedMinOffset, envelope.allowedMaxOffset],
    },
  };
}

/**
 * Validate multiple wheels against an envelope
 */
export function validateWheels(
  wheels: WheelSpec[],
  envelope: FitmentEnvelope
): FitmentValidation[] {
  return wheels.map(wheel => validateWheel(wheel, envelope));
}

/**
 * Filter wheels to only those that pass fitment
 */
export function filterFittingWheels<T extends WheelSpec>(
  wheels: T[],
  envelope: FitmentEnvelope,
  options?: {
    includeSpecfit?: boolean;  // Include wheels with missing data (default: true)
  }
): { wheel: T; validation: FitmentValidation }[] {
  const includeSpecfit = options?.includeSpecfit ?? true;
  
  return wheels
    .map(wheel => ({
      wheel,
      validation: validateWheel(wheel, envelope),
    }))
    .filter(({ validation }) => {
      if (validation.fitmentClass === "excluded") return false;
      if (validation.fitmentClass === "specfit" && !includeSpecfit) return false;
      return true;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG / LOGGING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format validation result for logging
 */
export function formatValidation(v: FitmentValidation): string {
  const checks = [
    `BP:${v.boltPatternPass ? "✓" : "✗"}`,
    `CB:${v.centerBorePass ? "✓" : "✗"}`,
    `DIA:${v.diameterPass ? "✓" : "✗"}`,
    `W:${v.widthPass ? "✓" : "✗"}`,
    `OFF:${v.offsetPass ? "✓" : "✗"}`,
  ].join(" ");
  
  return `[${v.fitmentClass.toUpperCase()}] ${v.sku} | ${checks} | mode=${v.fitmentMode}` +
    (v.exclusionReasons.length > 0 ? ` | reasons: ${v.exclusionReasons.join("; ")}` : "");
}

/**
 * Generate summary stats for a batch of validations
 */
export function summarizeValidations(validations: FitmentValidation[]): {
  total: number;
  surefit: number;
  specfit: number;
  excluded: number;
  exclusionBreakdown: Record<string, number>;
} {
  const summary = {
    total: validations.length,
    surefit: 0,
    specfit: 0,
    excluded: 0,
    exclusionBreakdown: {} as Record<string, number>,
  };
  
  for (const v of validations) {
    summary[v.fitmentClass]++;
    
    if (v.fitmentClass === "excluded") {
      for (const reason of v.exclusionReasons) {
        // Extract the reason type (before the colon)
        const reasonType = reason.split(":")[0].trim();
        summary.exclusionBreakdown[reasonType] = 
          (summary.exclusionBreakdown[reasonType] || 0) + 1;
      }
    }
  }
  
  return summary;
}
