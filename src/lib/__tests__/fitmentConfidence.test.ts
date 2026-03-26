/**
 * Tests for fitmentConfidence module
 * 
 * Run: npx jest src/lib/__tests__/fitmentConfidence.test.ts
 */

import {
  calculateConfidence,
  parseBoltPattern,
  parseCenterBore,
  getConfidenceUIMetadata,
  shouldShowWheelResults,
  formatConfidenceForLog,
  type FitmentProfileInput,
} from "../fitmentConfidence";

// ============================================================================
// Sample Inputs/Outputs for Documentation
// ============================================================================

/**
 * SAMPLE INPUTS AND EXPECTED OUTPUTS
 * 
 * These demonstrate the confidence calculation rules:
 */

// HIGH CONFIDENCE: Full verified data
const HIGH_EXAMPLE: FitmentProfileInput = {
  boltPattern: "6x135",
  centerBoreMm: 87.1,
  oemWheelSizes: [
    { diameter: 17, width: 7.5, offset: 44 },
    { diameter: 18, width: 8, offset: 44 },
  ],
};
// Expected: confidence="high", canShowWheels=true, canFilterByBoltPattern=true, canFilterByHubBore=true

// MEDIUM CONFIDENCE: Bolt pattern but no hub bore
const MEDIUM_EXAMPLE: FitmentProfileInput = {
  boltPattern: "5x114.3",
  centerBoreMm: null,  // Missing
  oemWheelSizes: [
    { diameter: 17, width: 7 },
  ],
};
// Expected: confidence="medium", canShowWheels=true, canFilterByBoltPattern=true, canFilterByHubBore=false

// LOW CONFIDENCE: Has sizes but no bolt pattern
const LOW_EXAMPLE: FitmentProfileInput = {
  boltPattern: null,  // Missing - UNSAFE
  centerBoreMm: 64.1,
  oemWheelSizes: [
    { diameter: 16, width: 6.5 },
  ],
};
// Expected: confidence="low", canShowWheels=false (BLOCKED)

// NONE: No usable data
const NONE_EXAMPLE: FitmentProfileInput = {
  boltPattern: null,
  centerBoreMm: null,
  oemWheelSizes: [],
};
// Expected: confidence="none", canShowWheels=false (BLOCKED)

// ============================================================================
// Bolt Pattern Validation Tests
// ============================================================================

describe("parseBoltPattern", () => {
  it("parses standard format", () => {
    const result = parseBoltPattern("5x114.3");
    expect(result).not.toBeNull();
    expect(result!.lugCount).toBe(5);
    expect(result!.pcd).toBe(114.3);
    expect(result!.normalized).toBe("5x114.3");
  });

  it("handles uppercase X", () => {
    const result = parseBoltPattern("6X135");
    expect(result).not.toBeNull();
    expect(result!.lugCount).toBe(6);
    expect(result!.pcd).toBe(135);
  });

  it("handles dual-drill patterns", () => {
    const result = parseBoltPattern("6x135/6x139.7");
    expect(result).not.toBeNull();
    expect(result!.isDualDrill).toBe(true);
    expect(result!.patterns).toHaveLength(2);
    expect(result!.patterns[0].normalized).toBe("6x135");
    expect(result!.patterns[1].normalized).toBe("6x139.7");
  });

  it("rejects empty string", () => {
    expect(parseBoltPattern("")).toBeNull();
    expect(parseBoltPattern("   ")).toBeNull();
  });

  it("rejects invalid format", () => {
    expect(parseBoltPattern("invalid")).toBeNull();
    expect(parseBoltPattern("5-114.3")).toBeNull(); // Wrong separator
    expect(parseBoltPattern("5")).toBeNull();
  });

  it("rejects out-of-range values", () => {
    expect(parseBoltPattern("1x100")).toBeNull();  // lug count too low
    expect(parseBoltPattern("15x100")).toBeNull(); // lug count too high
    expect(parseBoltPattern("5x10")).toBeNull();   // PCD too low
    expect(parseBoltPattern("5x500")).toBeNull();  // PCD too high
  });
});

// ============================================================================
// Center Bore Validation Tests
// ============================================================================

describe("parseCenterBore", () => {
  it("parses valid number", () => {
    expect(parseCenterBore(87.1)).toBe(87.1);
    expect(parseCenterBore(64.1)).toBe(64.1);
  });

  it("parses valid string", () => {
    expect(parseCenterBore("87.1")).toBe(87.1);
    expect(parseCenterBore("  64.1  ")).toBe(64.1);
  });

  it("rejects null/undefined", () => {
    expect(parseCenterBore(null)).toBeNull();
    expect(parseCenterBore(undefined)).toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseCenterBore("")).toBeNull();
    expect(parseCenterBore("   ")).toBeNull();
  });

  it("rejects out-of-range values", () => {
    expect(parseCenterBore(10)).toBeNull();  // Too small
    expect(parseCenterBore(200)).toBeNull(); // Too large
  });

  it("rejects non-numeric strings", () => {
    expect(parseCenterBore("abc")).toBeNull();
    expect(parseCenterBore("NaN")).toBeNull();
  });
});

// ============================================================================
// Confidence Calculation Tests
// ============================================================================

describe("calculateConfidence", () => {
  describe("HIGH confidence", () => {
    it("returns HIGH when bolt pattern and hub bore are valid", () => {
      const result = calculateConfidence(HIGH_EXAMPLE);
      
      expect(result.confidence).toBe("high");
      expect(result.canShowWheels).toBe(true);
      expect(result.canFilterByBoltPattern).toBe(true);
      expect(result.canFilterByHubBore).toBe(true);
      expect(result.parsed.boltPattern?.normalized).toBe("6x135");
      expect(result.parsed.centerBoreMm).toBe(87.1);
    });
  });

  describe("MEDIUM confidence", () => {
    it("returns MEDIUM when bolt pattern valid but hub bore missing", () => {
      const result = calculateConfidence(MEDIUM_EXAMPLE);
      
      expect(result.confidence).toBe("medium");
      expect(result.canShowWheels).toBe(true);
      expect(result.canFilterByBoltPattern).toBe(true);
      expect(result.canFilterByHubBore).toBe(false);
      expect(result.reasons).toContain("Hub bore: unknown - hub ring compatibility not guaranteed");
    });

    it("returns MEDIUM with zero hub bore", () => {
      const result = calculateConfidence({
        boltPattern: "5x114.3",
        centerBoreMm: 0,  // Invalid
      });
      
      expect(result.confidence).toBe("medium");
      expect(result.canFilterByHubBore).toBe(false);
    });
  });

  describe("LOW confidence", () => {
    it("returns LOW when no bolt pattern but has other data", () => {
      const result = calculateConfidence(LOW_EXAMPLE);
      
      expect(result.confidence).toBe("low");
      expect(result.canShowWheels).toBe(false);  // BLOCKED
      expect(result.canFilterByBoltPattern).toBe(false);
      expect(result.reasons).toContain("Bolt pattern: unknown - cannot safely filter wheels");
    });
  });

  describe("NONE confidence", () => {
    it("returns NONE when no profile provided", () => {
      const result = calculateConfidence(null);
      
      expect(result.confidence).toBe("none");
      expect(result.canShowWheels).toBe(false);
      expect(result.reasons).toContain("No fitment profile provided");
    });

    it("returns NONE when profile is empty", () => {
      const result = calculateConfidence(NONE_EXAMPLE);
      
      expect(result.confidence).toBe("none");
      expect(result.canShowWheels).toBe(false);
    });
  });
});

// ============================================================================
// UI Metadata Tests
// ============================================================================

describe("getConfidenceUIMetadata", () => {
  it("returns green for HIGH", () => {
    const meta = getConfidenceUIMetadata("high");
    expect(meta.colorToken).toBe("success");
    expect(meta.allowWheelResults).toBe(true);
    expect(meta.warningMessage).toBeNull();
  });

  it("returns warning for MEDIUM", () => {
    const meta = getConfidenceUIMetadata("medium");
    expect(meta.colorToken).toBe("warning");
    expect(meta.allowWheelResults).toBe(true);
    expect(meta.warningMessage).not.toBeNull();
  });

  it("returns caution for LOW", () => {
    const meta = getConfidenceUIMetadata("low");
    expect(meta.colorToken).toBe("caution");
    expect(meta.allowWheelResults).toBe(false);
  });

  it("returns error for NONE", () => {
    const meta = getConfidenceUIMetadata("none");
    expect(meta.colorToken).toBe("error");
    expect(meta.allowWheelResults).toBe(false);
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe("shouldShowWheelResults", () => {
  it("returns true for high and medium", () => {
    expect(shouldShowWheelResults("high")).toBe(true);
    expect(shouldShowWheelResults("medium")).toBe(true);
  });

  it("returns false for low and none", () => {
    expect(shouldShowWheelResults("low")).toBe(false);
    expect(shouldShowWheelResults("none")).toBe(false);
  });
});

describe("formatConfidenceForLog", () => {
  it("formats HIGH confidence", () => {
    const result = calculateConfidence(HIGH_EXAMPLE);
    const log = formatConfidenceForLog(result);
    
    expect(log).toContain("HIGH");
    expect(log).toContain("canShowWheels: true");
    expect(log).toContain("6x135");
  });

  it("formats BLOCKED confidence", () => {
    const result = calculateConfidence(NONE_EXAMPLE);
    const log = formatConfidenceForLog(result);
    
    expect(log).toContain("NONE");
    expect(log).toContain("canShowWheels: false");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge cases", () => {
  it("handles string center bore", () => {
    const result = calculateConfidence({
      boltPattern: "5x114.3",
      centerBoreMm: "64.1",  // String instead of number
    });
    expect(result.confidence).toBe("high");
    expect(result.parsed.centerBoreMm).toBe(64.1);
  });

  it("handles legacy centerbore field name", () => {
    const result = calculateConfidence({
      boltPattern: "5x114.3",
      centerbore: 64.1,  // Legacy field name
    });
    expect(result.confidence).toBe("high");
  });

  it("handles wheelSpecs alias for oemWheelSizes", () => {
    const result = calculateConfidence({
      boltPattern: "5x114.3",
      centerBoreMm: 64.1,
      wheelSpecs: [{ diameter: 17, width: 7 }],
    });
    expect(result.parsed.hasWheelSizes).toBe(true);
  });

  it("handles malformed bolt pattern gracefully", () => {
    const result = calculateConfidence({
      boltPattern: "invalid",
      centerBoreMm: 64.1,
    });
    expect(result.confidence).toBe("low");  // Has hub bore but no valid pattern
  });
});
