/**
 * Fitment Confidence Module
 * 
 * Determines whether wheel results can be safely shown based on
 * the quality and completeness of fitment data.
 * 
 * SAFETY PRINCIPLE: Never guess mechanical fitment data.
 * Wrong wheels falling off = liability.
 * 
 * @module fitmentConfidence
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Confidence levels for fitment data quality.
 * Determines what actions are safe to take.
 */
export type FitmentConfidence = "high" | "medium" | "low" | "none";

/**
 * Result of confidence calculation with reasoning.
 */
export interface ConfidenceResult {
  /** Overall confidence level */
  confidence: FitmentConfidence;
  
  /** Human-readable reasons explaining the confidence level */
  reasons: string[];
  
  /** Whether wheel results can be safely shown */
  canShowWheels: boolean;
  
  /** Whether bolt pattern filtering is available */
  canFilterByBoltPattern: boolean;
  
  /** Whether hub bore filtering is available */
  canFilterByHubBore: boolean;
  
  /** Parsed/validated values (null if invalid or missing) */
  parsed: {
    boltPattern: ParsedBoltPattern | null;
    centerBoreMm: number | null;
    hasWheelSizes: boolean;
    hasTireSizes: boolean;
  };
}

/**
 * UI metadata for displaying confidence to users.
 */
export interface ConfidenceUIMetadata {
  /** Display label */
  label: string;
  
  /** Short description for tooltips */
  description: string;
  
  /** CSS color class or token */
  colorToken: "success" | "warning" | "caution" | "error";
  
  /** Hex color for direct use */
  hexColor: string;
  
  /** Icon suggestion */
  icon: "check" | "alert-triangle" | "help-circle" | "x-circle";
  
  /** Whether to allow showing wheel results */
  allowWheelResults: boolean;
  
  /** Warning message to show users (null if none needed) */
  warningMessage: string | null;
  
  /** Admin-facing detailed message */
  adminMessage: string;
}

/**
 * Parsed bolt pattern with validated components.
 */
export interface ParsedBoltPattern {
  /** Original string */
  raw: string;
  
  /** Normalized format (e.g., "6x135") */
  normalized: string;
  
  /** Number of lugs/studs */
  lugCount: number;
  
  /** Pitch circle diameter in mm */
  pcd: number;
  
  /** Whether this is a dual-drill pattern */
  isDualDrill: boolean;
  
  /** All patterns if dual-drill */
  patterns: Array<{ lugCount: number; pcd: number; normalized: string }>;
}

/**
 * Input profile for confidence calculation.
 * Accepts various shapes to handle different profile sources.
 */
export interface FitmentProfileInput {
  boltPattern?: string | null;
  centerBoreMm?: number | string | null;
  centerbore?: number | string | null;  // Alias
  centerBore?: number | string | null;  // Alias
  oemWheelSizes?: unknown[] | null;
  oemTireSizes?: unknown[] | null;
  wheelSpecs?: unknown[] | null;  // Alias from legacy system
}

// ============================================================================
// Bolt Pattern Validation
// ============================================================================

/**
 * Valid bolt pattern regex.
 * Matches formats like: "5x114.3", "6x135", "5x4.5", "8x165.1"
 * Also handles dual-drill: "6x135/6x139.7"
 */
const BOLT_PATTERN_REGEX = /^(\d+)\s*[xX×]\s*(\d+(?:\.\d+)?)$/;

/**
 * Parse and validate a bolt pattern string.
 * Returns null if invalid or malformed.
 */
export function parseBoltPattern(raw: string | null | undefined): ParsedBoltPattern | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  
  // Handle dual-drill patterns (e.g., "6x135/6x139.7")
  const parts = trimmed.split(/[\/,]/).map(p => p.trim()).filter(Boolean);
  
  if (parts.length === 0) {
    return null;
  }
  
  const patterns: Array<{ lugCount: number; pcd: number; normalized: string }> = [];
  
  for (const part of parts) {
    const match = part.match(BOLT_PATTERN_REGEX);
    if (!match) {
      // If any part is invalid, reject the whole thing
      return null;
    }
    
    const lugCount = parseInt(match[1], 10);
    const pcd = parseFloat(match[2]);
    
    // Validate reasonable ranges
    // Lug count: typically 4-8 for passenger vehicles
    if (lugCount < 3 || lugCount > 10) {
      return null;
    }
    
    // PCD: typically 98mm to 180mm for passenger vehicles
    // Allow some tolerance for unusual patterns
    if (pcd < 50 || pcd > 250) {
      return null;
    }
    
    patterns.push({
      lugCount,
      pcd,
      normalized: `${lugCount}x${pcd}`,
    });
  }
  
  const primary = patterns[0];
  
  return {
    raw: trimmed,
    normalized: primary.normalized,
    lugCount: primary.lugCount,
    pcd: primary.pcd,
    isDualDrill: patterns.length > 1,
    patterns,
  };
}

/**
 * Check if a bolt pattern string is valid.
 */
export function isValidBoltPattern(raw: string | null | undefined): boolean {
  return parseBoltPattern(raw) !== null;
}

// ============================================================================
// Hub Bore Validation
// ============================================================================

/**
 * Parse and validate a center bore value.
 * Accepts number or string, returns null if invalid.
 */
export function parseCenterBore(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  
  let value: number;
  
  if (typeof raw === "number") {
    value = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    value = parseFloat(trimmed);
  } else {
    return null;
  }
  
  // Validate it's a real number
  if (!Number.isFinite(value)) {
    return null;
  }
  
  // Validate reasonable range for passenger vehicles
  // Typical range: 54mm (Honda) to 131mm (some trucks)
  // Allow some tolerance for edge cases
  if (value < 40 || value > 150) {
    return null;
  }
  
  return value;
}

/**
 * Check if a center bore value is valid.
 */
export function isValidCenterBore(raw: number | string | null | undefined): boolean {
  return parseCenterBore(raw) !== null;
}

// ============================================================================
// Confidence Calculation
// ============================================================================

/**
 * Calculate fitment confidence level based on available data.
 * 
 * Rules:
 * - HIGH: Valid bolt pattern AND valid hub bore → full wheel filtering
 * - MEDIUM: Valid bolt pattern, missing/invalid hub bore → show with warning
 * - LOW: Has wheel sizes but no bolt pattern → cannot safely filter
 * - NONE: No usable fitment data → block wheel results
 * 
 * @param profile - Fitment profile to evaluate
 * @returns Confidence result with reasoning
 */
export function calculateConfidence(profile: FitmentProfileInput | null | undefined): ConfidenceResult {
  // Handle null/undefined profile
  if (!profile) {
    return {
      confidence: "none",
      reasons: ["No fitment profile provided"],
      canShowWheels: false,
      canFilterByBoltPattern: false,
      canFilterByHubBore: false,
      parsed: {
        boltPattern: null,
        centerBoreMm: null,
        hasWheelSizes: false,
        hasTireSizes: false,
      },
    };
  }
  
  // Parse and validate bolt pattern
  const boltPattern = parseBoltPattern(profile.boltPattern);
  
  // Parse and validate center bore (try multiple field names)
  const centerBoreMm = parseCenterBore(
    profile.centerBoreMm ?? profile.centerbore ?? profile.centerBore
  );
  
  // Check for wheel/tire size data
  const wheelSizes = profile.oemWheelSizes ?? profile.wheelSpecs ?? [];
  const tireSizes = profile.oemTireSizes ?? [];
  const hasWheelSizes = Array.isArray(wheelSizes) && wheelSizes.length > 0;
  const hasTireSizes = Array.isArray(tireSizes) && tireSizes.length > 0;
  
  const parsed = {
    boltPattern,
    centerBoreMm,
    hasWheelSizes,
    hasTireSizes,
  };
  
  // Build reasons array
  const reasons: string[] = [];
  
  // ─────────────────────────────────────────────────────────────────────────
  // HIGH: Valid bolt pattern AND valid hub bore
  // ─────────────────────────────────────────────────────────────────────────
  if (boltPattern && centerBoreMm) {
    reasons.push(`Bolt pattern: ${boltPattern.normalized} (verified)`);
    reasons.push(`Hub bore: ${centerBoreMm}mm (verified)`);
    
    if (hasWheelSizes) {
      reasons.push(`OEM wheel sizes: ${wheelSizes.length} option(s)`);
    }
    
    return {
      confidence: "high",
      reasons,
      canShowWheels: true,
      canFilterByBoltPattern: true,
      canFilterByHubBore: true,
      parsed,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // MEDIUM: Valid bolt pattern, missing hub bore
  // ─────────────────────────────────────────────────────────────────────────
  if (boltPattern && !centerBoreMm) {
    reasons.push(`Bolt pattern: ${boltPattern.normalized} (verified)`);
    reasons.push("Hub bore: unknown - hub ring compatibility not guaranteed");
    
    if (hasWheelSizes) {
      reasons.push(`OEM wheel sizes: ${wheelSizes.length} option(s)`);
    }
    
    return {
      confidence: "medium",
      reasons,
      canShowWheels: true,  // Can show, but with warning
      canFilterByBoltPattern: true,
      canFilterByHubBore: false,
      parsed,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // LOW: Has some data but no bolt pattern
  // ─────────────────────────────────────────────────────────────────────────
  if (!boltPattern && (hasWheelSizes || hasTireSizes || centerBoreMm)) {
    reasons.push("Bolt pattern: unknown - cannot safely filter wheels");
    
    if (centerBoreMm) {
      reasons.push(`Hub bore: ${centerBoreMm}mm (available but unusable without bolt pattern)`);
    }
    if (hasWheelSizes) {
      reasons.push(`OEM wheel sizes: ${wheelSizes.length} option(s) (available but unusable)`);
    }
    if (hasTireSizes) {
      reasons.push(`OEM tire sizes: ${tireSizes.length} option(s)`);
    }
    
    return {
      confidence: "low",
      reasons,
      canShowWheels: false,  // UNSAFE - don't show without bolt pattern
      canFilterByBoltPattern: false,
      canFilterByHubBore: false,
      parsed,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // NONE: No usable fitment data
  // ─────────────────────────────────────────────────────────────────────────
  reasons.push("No verified fitment data available");
  reasons.push("Bolt pattern: unknown");
  reasons.push("Hub bore: unknown");
  
  return {
    confidence: "none",
    reasons,
    canShowWheels: false,
    canFilterByBoltPattern: false,
    canFilterByHubBore: false,
    parsed,
  };
}

// ============================================================================
// UI Metadata
// ============================================================================

/**
 * Get UI display metadata for a confidence level.
 * Use this to render consistent confidence indicators across the app.
 */
export function getConfidenceUIMetadata(confidence: FitmentConfidence): ConfidenceUIMetadata {
  switch (confidence) {
    case "high":
      return {
        label: "Verified Fitment",
        description: "Bolt pattern and hub bore verified - full compatibility filtering",
        colorToken: "success",
        hexColor: "#22c55e",  // green-500
        icon: "check",
        allowWheelResults: true,
        warningMessage: null,
        adminMessage: "Full fitment data available. All filters active.",
      };
      
    case "medium":
      return {
        label: "Partial Fitment",
        description: "Bolt pattern verified, hub bore unknown",
        colorToken: "warning",
        hexColor: "#eab308",  // yellow-500
        icon: "alert-triangle",
        allowWheelResults: true,
        warningMessage: "Hub ring compatibility cannot be verified. Please confirm center bore compatibility before installation.",
        adminMessage: "Bolt pattern available, hub bore missing. Hub ring matching disabled.",
      };
      
    case "low":
      return {
        label: "Insufficient Data",
        description: "Cannot verify bolt pattern - wheel results blocked",
        colorToken: "caution",
        hexColor: "#f97316",  // orange-500
        icon: "help-circle",
        allowWheelResults: false,
        warningMessage: "We don't have verified bolt pattern data for this vehicle. Wheel results cannot be shown safely.",
        adminMessage: "Bolt pattern missing. Wheel results blocked for safety.",
      };
      
    case "none":
      return {
        label: "Fitment Unavailable",
        description: "No fitment data available for this vehicle",
        colorToken: "error",
        hexColor: "#ef4444",  // red-500
        icon: "x-circle",
        allowWheelResults: false,
        warningMessage: "Fitment data is not available for this vehicle. Please contact us for manual fitment lookup.",
        adminMessage: "No fitment data. Vehicle may need to be added to database.",
      };
  }
}

/**
 * Get a simple boolean for whether wheel results should be shown.
 * Convenience function for quick checks.
 */
export function shouldShowWheelResults(confidence: FitmentConfidence): boolean {
  return confidence === "high" || confidence === "medium";
}

/**
 * Get a simple boolean for whether a warning should be displayed.
 */
export function shouldShowWarning(confidence: FitmentConfidence): boolean {
  return confidence === "medium";
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a confidence result for a blocked state with custom message.
 */
export function createBlockedResult(reason: string): ConfidenceResult {
  return {
    confidence: "none",
    reasons: [reason],
    canShowWheels: false,
    canFilterByBoltPattern: false,
    canFilterByHubBore: false,
    parsed: {
      boltPattern: null,
      centerBoreMm: null,
      hasWheelSizes: false,
      hasTireSizes: false,
    },
  };
}

/**
 * Merge confidence result with additional context for API responses.
 */
export function buildConfidenceResponse(
  result: ConfidenceResult,
  additionalContext?: Record<string, unknown>
): Record<string, unknown> {
  const uiMeta = getConfidenceUIMetadata(result.confidence);
  
  return {
    confidence: result.confidence,
    confidenceReasons: result.reasons,
    canShowWheels: result.canShowWheels,
    canFilterByBoltPattern: result.canFilterByBoltPattern,
    canFilterByHubBore: result.canFilterByHubBore,
    ui: {
      label: uiMeta.label,
      description: uiMeta.description,
      colorToken: uiMeta.colorToken,
      icon: uiMeta.icon,
      warningMessage: uiMeta.warningMessage,
    },
    ...additionalContext,
  };
}

// ============================================================================
// Test/Debug Helpers
// ============================================================================

/**
 * Format confidence result for logging/debugging.
 */
export function formatConfidenceForLog(result: ConfidenceResult): string {
  const lines = [
    `[FitmentConfidence] Level: ${result.confidence.toUpperCase()}`,
    `  canShowWheels: ${result.canShowWheels}`,
    `  canFilterByBoltPattern: ${result.canFilterByBoltPattern}`,
    `  canFilterByHubBore: ${result.canFilterByHubBore}`,
    `  Reasons:`,
    ...result.reasons.map(r => `    - ${r}`),
  ];
  
  if (result.parsed.boltPattern) {
    lines.push(`  Parsed bolt pattern: ${result.parsed.boltPattern.normalized}`);
  }
  if (result.parsed.centerBoreMm) {
    lines.push(`  Parsed center bore: ${result.parsed.centerBoreMm}mm`);
  }
  
  return lines.join("\n");
}
