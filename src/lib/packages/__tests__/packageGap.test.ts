/**
 * Package generation gap fixes - regression tests
 *
 * Covers the three root causes found in the 2026-06-10 investigation:
 * 1. Per-rim OEM baseline (multi-size vehicles falsely failed -+/-3% validation)
 * 2. Offset pre-filter aligned with validateFitment -+/-5mm tolerance
 *    (degenerate min===max offset ranges rejected all inventory)
 * 3. Diameter fallback handled in generatePackages (integration-level;
 *    findBestWheel itself unchanged for strict targets)
 */
import {
  parseTireSize,
  calculateOverallDiameter,
  resolveOemBaseline,
  validateFitment,
  findBestWheel,
  findMatchingTire,
  type ParsedFitment,
} from "../engine";

function fitmentWith(partial: Partial<ParsedFitment>): ParsedFitment {
  return {
    boltPattern: "5x110",
    centerBore: 65.1,
    offsetRange: { min: 35, max: 52 },
    // oemOffset required as of 2026-06-30 geometry validator integration
    oemOffset: { missing: false, offset_mm: 43, width_in: 7.5, source: "db_range_midpoint" } as import("@/lib/fitment/geometryValidator").OemOffsetResolved,
    oemDiameters: [17, 18, 19],
    oemWidths: [7, 8],
    oemTireSizes: [],
    oemOverallDiameter: 28,
    oemOverallDiameterByRim: {},
    ...partial,
  };
}

describe("parseTireSize", () => {
  it("parses standard metric", () => {
    expect(parseTireSize("205/45R17")).toEqual({ width: 205, aspectRatio: 45, rimDiameter: 17, lt: false });
  });
  it("parses P-metric and ZR", () => {
    expect(parseTireSize("P235/35R19")).toEqual({ width: 235, aspectRatio: 35, rimDiameter: 19, lt: false });
    expect(parseTireSize("245/35ZR20")).toEqual({ width: 245, aspectRatio: 35, rimDiameter: 20, lt: false });
  });
});

describe("resolveOemBaseline (root cause 1: multi-size vehicles)", () => {
  // Alfa Romeo 4C: 205/45R17 - - 24.3", 235/35R19 - - 25.5"
  // Old code used a single 24.3" baseline - - 19" candidates failed at +5%
  const od17 = calculateOverallDiameter(205, 45, 17);
  const od18 = calculateOverallDiameter(205, 40, 18);
  const od19 = calculateOverallDiameter(235, 35, 19);
  const fitment = fitmentWith({
    oemOverallDiameter: od17,
    oemOverallDiameterByRim: { 17: od17, 18: od18, 19: od19 },
  });

  it("uses the per-rim baseline on exact match", () => {
    expect(resolveOemBaseline(fitment, 19)).toBeCloseTo(od19, 5);
    expect(resolveOemBaseline(fitment, 17)).toBeCloseTo(od17, 5);
  });

  it("falls back to closest rim when candidate rim unknown", () => {
    expect(resolveOemBaseline(fitment, 20)).toBeCloseTo(od19, 5);
  });

  it("falls back to single-size baseline when map empty", () => {
    const f = fitmentWith({ oemOverallDiameter: 30, oemOverallDiameterByRim: {} });
    expect(resolveOemBaseline(f, 18)).toBe(30);
  });

  it("19in OEM-equivalent package passes -+/-3% with per-rim baseline", () => {
    const candidate = calculateOverallDiameter(235, 35, 19);
    const baseline = resolveOemBaseline(fitment, 19)!;
    const v = validateFitment(candidate, baseline, 40, fitment.offsetRange);
    expect(v.safe).toBe(true);
  });

  it("same package FAILS with the old single-size baseline (regression guard)", () => {
    const candidate = calculateOverallDiameter(235, 35, 19);
    const v = validateFitment(candidate, od17, 40, fitment.offsetRange);
    expect(v.safe).toBe(false); // documents the old bug
  });
});

describe("findBestWheel offset pre-filter (root cause 2: degenerate ranges)", () => {
  const wheels = [
    {
      sku: "W1", brand_cd: "KM", diameter: "17", width: "8", offset: "45",
      msrp: "300", map_price: "250", images: ["x.jpg"],
    },
  ] as any[];

  it("accepts a wheel within -+/-5mm of a degenerate min===max range", () => {
    // Subaru BRZ record: offset min=max=48; wheel offset 45 is 3mm off - - valid
    const best = findBestWheel(wheels, {
      targetDiameters: [17],
      preferredBrands: ["KM"],
      offsetRange: { min: 48, max: 48 },
      offsetPreference: "oem",
      priceRange: "value",
    });
    expect(best).not.toBeNull();
    expect(best!.sku).toBe("W1");
  });

  // 2026-06-30 engine change: the flat +/-5mm filter became a LOOSE +/-15mm
  // pre-filter; validateFitment (geometry) is the authoritative offset gate.
  // Assert the pre-filter that actually exists (test was stale, 2026-09-19).
  it("pre-filter keeps a wheel 10mm outside the range (geometry decides later)", () => {
    const best = findBestWheel(wheels, {
      targetDiameters: [17],
      preferredBrands: ["KM"],
      offsetRange: { min: 55, max: 60 }, // wheel at 45 = 10mm below min: inside the 15mm pre-filter
      offsetPreference: "oem",
      priceRange: "value",
    });
    expect(best).not.toBeNull();
  });

  it("pre-filter still rejects offsets beyond the +/-15mm loose bound", () => {
    const best = findBestWheel(wheels, {
      targetDiameters: [17],
      preferredBrands: ["KM"],
      offsetRange: { min: 61, max: 70 }, // wheel at 45 = 16mm below min
      offsetPreference: "oem",
      priceRange: "value",
    });
    expect(best).toBeNull();
  });
});

describe("validateFitment -+/-3% rule unchanged (safety)", () => {
  it("rejects >3% diameter change", () => {
    const v = validateFitment(28.9, 28, 40, { min: 20, max: 50 });
    expect(v.safe).toBe(false);
  });
  it("accepts within 3%", () => {
    const v = validateFitment(28.5, 28, 40, { min: 20, max: 50 });
    expect(v.safe).toBe(true);
  });
});

describe("Batch 5 (2026-09-19): finite-input guards, LT prefix, no fabricated sizes", () => {
  // Minimal ScoredWheel shape; the guard under test only reads diameter/width.
  const wheel = (diameter: unknown, width: unknown) =>
    ({ sku: "W-TEST", price: 250, score: 90, diameter, width } as unknown as Parameters<typeof findMatchingTire>[0]);
  it("parseTireSize keeps the LT prefix as a flag and flags flotation as LT", () => {
    expect(parseTireSize("LT275/70R18")).toEqual({ width: 275, aspectRatio: 70, rimDiameter: 18, lt: true });
    expect(parseTireSize("LT315/70R17")).toEqual({ width: 315, aspectRatio: 70, rimDiameter: 17, lt: true });
    expect(parseTireSize("35x12.50R17")?.lt).toBe(true);
    expect(parseTireSize("")).toBeNull();
    expect(parseTireSize(undefined as unknown as string)).toBeNull();
    expect(parseTireSize("NaN/NaNRNaN")).toBeNull();
  });

  const od17 = calculateOverallDiameter(265, 70, 17);
  const ltFitment = fitmentWith({
    oemTireSizes: ["LT265/70R17"],
    oemOverallDiameter: od17,
    oemOverallDiameterByRim: { 17: od17 },
  });

  it("returns null for NaN / out-of-range wheel dimensions instead of a NaN size", () => {
    expect(findMatchingTire(wheel(undefined, "9"), ltFitment, "any")).toBeNull();
    expect(findMatchingTire(wheel("abc", "9"), ltFitment, "any")).toBeNull();
    expect(findMatchingTire(wheel("18", null), ltFitment, "any")).toBeNull();
    expect(findMatchingTire(wheel("99", "9"), ltFitment, "any")).toBeNull();
  });

  it("OE match on an LT vehicle keeps the LT size and marks the tire as placeholder/estimated", () => {
    const t = findMatchingTire(wheel("17", "8.5"), ltFitment, "all_terrain");
    expect(t).not.toBeNull();
    expect(t!.size).toBe("LT265/70R17");
    expect(t!.lt).toBe(true);
    expect(t!.sizeSource).toBe("oem");
    expect(t!.placeholder).toBe(true);
    expect(t!.priceEstimated).toBe(true);
    expect(t!.brand).toBe("TBD");
  });

  it("computed plus-size on an LT-only vehicle is emitted as an LT size", () => {
    const t = findMatchingTire(wheel("20", "9"), ltFitment, "all_terrain");
    expect(t).not.toBeNull();
    expect(t!.size.startsWith("LT")).toBe(true);
    expect(t!.lt).toBe(true);
    expect(t!.sizeSource).toBe("computed");
    expect(t!.size).toMatch(/^LT\d{3}\/\d{2}R20$/);
  });

  it("never fabricates a size when no OE baseline parsed (no 28-inch fallback)", () => {
    const noBaseline = fitmentWith({ oemTireSizes: [], oemOverallDiameter: null, oemOverallDiameterByRim: {} });
    expect(resolveOemBaseline(noBaseline, 20)).toBeNull();
    expect(findMatchingTire(wheel("20", "9"), noBaseline, "any")).toBeNull();
  });

  it("refuses to compute a tire when the wheel is not smaller than the OE overall diameter", () => {
    const tiny = fitmentWith({ oemTireSizes: ["165/65R14"], oemOverallDiameter: 22.4, oemOverallDiameterByRim: { 14: 22.4 } });
    expect(findMatchingTire(wheel("24", "9"), tiny, "any")).toBeNull();
  });
});
