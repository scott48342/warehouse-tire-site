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

export type FitmentMode = "oem" | "aftermarket_safe" | "aggressive";

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
  
  // Envelope used
  envelope?: {
    allowedDiameterRange: [number, number];
    allowedWidthRange: [number, number];
    allowedOffsetRange: [number, number];
  };
};

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
    // Truck/enthusiast fitment: +4" diameter, +3" width, wide offset range
    diameterPlusMin: -1,   // allow 1" smaller too
    diameterPlusMax: 4,
    widthPlusMin: 0,
    widthPlusMax: 3,
    offsetExpandLow: 30,   // allow much lower offset (more poke)
    offsetExpandHigh: 15,  // allow some higher offset
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
 * Check if wheel bolt pattern matches vehicle
 */
export function boltPatternMatches(wheelBp: string, vehicleBp: string): boolean {
  return normalizeBoltPattern(wheelBp) === normalizeBoltPattern(vehicleBp);
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
  
  // Bolt pattern - REQUIRED and must match exactly
  let boltPatternPass = false;
  if (wheel.boltPattern) {
    boltPatternPass = boltPatternMatches(wheel.boltPattern, envelope.boltPattern);
    if (!boltPatternPass) {
      exclusionReasons.push(
        `Bolt pattern mismatch: wheel=${wheel.boltPattern}, vehicle=${envelope.boltPattern}`
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
