/**
 * Unit tests for load-index gating (audit 2026-09-18, finding C2 / F3)
 */
import {
  parseLoadIndex,
  resolveRequiredLoadIndex,
  assessLoadIndex,
  annotateLoadIndex,
  filterPackageEligible,
  countLoadIndexFailures,
  type RequiredLoadIndexSpec,
  type LoadIndexAssessment,
} from "../loadIndexGate";

describe("parseLoadIndex", () => {
  it("parses simple numeric badge", () => {
    expect(parseLoadIndex("119")).toBe(119);
    expect(parseLoadIndex("110")).toBe(110);
    expect(parseLoadIndex("94")).toBe(94);
  });

  it("parses LT dual rating (uses first/single value)", () => {
    expect(parseLoadIndex("126/123")).toBe(126);
    expect(parseLoadIndex("121/118")).toBe(121);
  });

  it("parses badge with speed rating suffix", () => {
    expect(parseLoadIndex("119/116Q")).toBe(119);
    expect(parseLoadIndex("110T")).toBe(110);
    expect(parseLoadIndex("94V")).toBe(94);
  });

  it("parses numeric input", () => {
    expect(parseLoadIndex(119)).toBe(119);
    expect(parseLoadIndex(110)).toBe(110);
  });

  it("returns null for invalid inputs", () => {
    expect(parseLoadIndex(null)).toBe(null);
    expect(parseLoadIndex(undefined)).toBe(null);
    expect(parseLoadIndex("")).toBe(null);
    expect(parseLoadIndex("XL")).toBe(null);
    expect(parseLoadIndex("N/A")).toBe(null);
  });

  it("rejects out-of-range values", () => {
    expect(parseLoadIndex("10")).toBe(null); // Too low
    expect(parseLoadIndex("200")).toBe(null); // Too high
    expect(parseLoadIndex(0)).toBe(null);
    expect(parseLoadIndex(-1)).toBe(null);
  });
});

describe("resolveRequiredLoadIndex", () => {
  it("returns null for empty spec", () => {
    expect(resolveRequiredLoadIndex(null)).toBe(null);
    expect(resolveRequiredLoadIndex(undefined)).toBe(null);
    expect(resolveRequiredLoadIndex({})).toBe(null);
  });

  it("returns single value when no per-axle values", () => {
    const spec: RequiredLoadIndexSpec = { requiredLoadIndex: 119 };
    expect(resolveRequiredLoadIndex(spec)).toBe(119);
    expect(resolveRequiredLoadIndex(spec, "front")).toBe(119);
    expect(resolveRequiredLoadIndex(spec, "rear")).toBe(119);
    expect(resolveRequiredLoadIndex(spec, "both")).toBe(119);
  });

  it("uses per-axle values when present", () => {
    const spec: RequiredLoadIndexSpec = { requiredLoadIndex: 100, front: 110, rear: 115 };
    expect(resolveRequiredLoadIndex(spec, "front")).toBe(110);
    expect(resolveRequiredLoadIndex(spec, "rear")).toBe(115);
  });

  it("uses max of per-axle for 'both'", () => {
    const spec: RequiredLoadIndexSpec = { front: 110, rear: 115 };
    expect(resolveRequiredLoadIndex(spec, "both")).toBe(115);
  });

  it("falls back to single when per-axle is null", () => {
    const spec: RequiredLoadIndexSpec = { requiredLoadIndex: 100, front: null, rear: null };
    expect(resolveRequiredLoadIndex(spec, "front")).toBe(100);
  });
});

describe("assessLoadIndex", () => {
  describe("when required minimum is missing (no verification possible)", () => {
    it("returns loadIndexChecked:false, fitBadgeAllowed:false, packageEligible:true", () => {
      const result = assessLoadIndex("110", null);
      expect(result.loadIndex).toBe(110);
      expect(result.requiredLoadIndex).toBe(null);
      expect(result.requiredLoadIndexSource).toBe(null);
      expect(result.loadIndexOk).toBe(null);
      expect(result.loadIndexChecked).toBe(false);
      expect(result.fitBadgeAllowed).toBe(false); // NO badge when unverified
      expect(result.packageEligible).toBe(true); // Can still appear in packages
      expect(result.packageExclusionReason).toBe(null);
    });
  });

  describe("when tire load index is unknown", () => {
    it("returns loadIndexChecked:false, fitBadgeAllowed:false, packageEligible:true", () => {
      const result = assessLoadIndex(null, 119);
      expect(result.loadIndex).toBe(null);
      expect(result.requiredLoadIndex).toBe(119);
      expect(result.requiredLoadIndexSource).toBe("vehicle_record_unverified");
      expect(result.loadIndexOk).toBe(null);
      expect(result.loadIndexChecked).toBe(false);
      expect(result.loadIndexNote).toBe("Tire load rating unknown");
      expect(result.fitBadgeAllowed).toBe(false); // NO badge when unknown
      expect(result.packageEligible).toBe(true); // Unknown, not known-bad
    });
  });

  describe("when tire meets required minimum", () => {
    it("returns loadIndexOk:true, fitBadgeAllowed:true, packageEligible:true", () => {
      const result = assessLoadIndex("119", 119);
      expect(result.loadIndex).toBe(119);
      expect(result.requiredLoadIndex).toBe(119);
      expect(result.requiredLoadIndexSource).toBe("vehicle_record_unverified");
      expect(result.loadIndexOk).toBe(true);
      expect(result.loadIndexChecked).toBe(true);
      expect(result.loadIndexNote).toBe(null);
      expect(result.fitBadgeAllowed).toBe(true);
      expect(result.packageEligible).toBe(true);
      expect(result.packageExclusionReason).toBe(null);
    });

    it("passes when tire exceeds required", () => {
      const result = assessLoadIndex("126", 119);
      expect(result.loadIndexOk).toBe(true);
      expect(result.fitBadgeAllowed).toBe(true);
      expect(result.packageEligible).toBe(true);
    });
  });

  describe("when tire is below required minimum", () => {
    it("returns loadIndexOk:false, fitBadgeAllowed:false, packageEligible:false", () => {
      const result = assessLoadIndex("110", 119);
      expect(result.loadIndex).toBe(110);
      expect(result.requiredLoadIndex).toBe(119);
      expect(result.requiredLoadIndexSource).toBe("vehicle_record_unverified");
      expect(result.loadIndexOk).toBe(false);
      expect(result.loadIndexChecked).toBe(true);
      expect(result.loadIndexNote).toBe("Load rating 110 is below the 119 this vehicle requires");
      expect(result.fitBadgeAllowed).toBe(false);
      expect(result.packageEligible).toBe(false);
      expect(result.packageExclusionReason).toBe("load_index_below_required");
    });
  });

  // Real-world test case from audit: 2020 F-150 Raptor requires 119, 110T tires should fail
  describe("audit case: 2020 F-150 Raptor 17\" with 110T tires", () => {
    it("110T tire fails against 119 requirement", () => {
      const result = assessLoadIndex("110T", 119);
      expect(result.loadIndex).toBe(110);
      expect(result.loadIndexOk).toBe(false);
      expect(result.fitBadgeAllowed).toBe(false);
      expect(result.packageEligible).toBe(false);
      expect(result.packageExclusionReason).toBe("load_index_below_required");
    });

    it("121/118Q LT tire passes against 119 requirement", () => {
      const result = assessLoadIndex("121/118Q", 119);
      expect(result.loadIndex).toBe(121);
      expect(result.loadIndexOk).toBe(true);
      expect(result.fitBadgeAllowed).toBe(true);
      expect(result.packageEligible).toBe(true);
    });
  });
});

describe("annotateLoadIndex", () => {
  it("annotates items in place with load index fields", () => {
    const items = [
      { badges: { loadIndex: "110" } },
      { badges: { loadIndex: "119" } },
      { badges: { loadIndex: "126/123" } },
    ];
    const spec: RequiredLoadIndexSpec = { requiredLoadIndex: 119 };
    
    const result = annotateLoadIndex(items, spec);
    
    // Same array reference
    expect(result).toBe(items);
    
    // First item: below required
    expect(result[0].loadIndex).toBe(110);
    expect(result[0].requiredLoadIndex).toBe(119);
    expect(result[0].loadIndexOk).toBe(false);
    expect(result[0].fitBadgeAllowed).toBe(false);
    expect(result[0].packageEligible).toBe(false);
    
    // Second item: meets required
    expect(result[1].loadIndex).toBe(119);
    expect(result[1].loadIndexOk).toBe(true);
    expect(result[1].fitBadgeAllowed).toBe(true);
    expect(result[1].packageEligible).toBe(true);
    
    // Third item: exceeds required
    expect(result[2].loadIndex).toBe(126);
    expect(result[2].loadIndexOk).toBe(true);
    expect(result[2].fitBadgeAllowed).toBe(true);
    expect(result[2].packageEligible).toBe(true);
  });

  it("handles missing spec (no verification)", () => {
    const items = [{ badges: { loadIndex: "110" } }];
    const result = annotateLoadIndex(items, null);
    
    expect(result[0].loadIndex).toBe(110);
    expect(result[0].requiredLoadIndex).toBe(null);
    expect(result[0].loadIndexOk).toBe(null);
    expect(result[0].fitBadgeAllowed).toBe(false); // NO badge when unverified
    expect(result[0].packageEligible).toBe(true);
  });

  it("respects axle field for per-axle requirements", () => {
    const items = [
      { badges: { loadIndex: "110" }, axle: "front" as const },
      { badges: { loadIndex: "110" }, axle: "rear" as const },
    ];
    const spec: RequiredLoadIndexSpec = { front: 105, rear: 115 };
    
    const result = annotateLoadIndex(items, spec);
    
    // Front: 110 >= 105, passes
    expect(result[0].loadIndexOk).toBe(true);
    expect(result[0].requiredLoadIndex).toBe(105);
    
    // Rear: 110 < 115, fails
    expect(result[1].loadIndexOk).toBe(false);
    expect(result[1].requiredLoadIndex).toBe(115);
  });
});

describe("filterPackageEligible", () => {
  it("removes items with packageEligible:false", () => {
    const items = [
      { sku: "A", packageEligible: true },
      { sku: "B", packageEligible: false },
      { sku: "C", packageEligible: true },
      { sku: "D", packageEligible: false },
    ];
    
    const result = filterPackageEligible(items);
    
    expect(result).toHaveLength(2);
    expect(result.map(i => i.sku)).toEqual(["A", "C"]);
  });

  it("keeps items with packageEligible:undefined (not checked)", () => {
    const items = [
      { sku: "A", packageEligible: undefined },
      { sku: "B", packageEligible: true },
    ];
    
    const result = filterPackageEligible(items);
    
    expect(result).toHaveLength(2);
  });
});

describe("countLoadIndexFailures", () => {
  it("counts passed, failed, and unchecked items", () => {
    const items = [
      { loadIndexOk: true },
      { loadIndexOk: true },
      { loadIndexOk: false },
      { loadIndexOk: null },
      { loadIndexOk: undefined },
    ];
    
    const result = countLoadIndexFailures(items);
    
    expect(result.total).toBe(5);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.unchecked).toBe(2);
  });
});
