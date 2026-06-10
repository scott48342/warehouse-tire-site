/**
 * Package generation gap fixes — regression tests
 *
 * Covers the three root causes found in the 2026-06-10 investigation:
 * 1. Per-rim OEM baseline (multi-size vehicles falsely failed ±3% validation)
 * 2. Offset pre-filter aligned with validateFitment ±5mm tolerance
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
  type ParsedFitment,
} from "../engine";

function fitmentWith(partial: Partial<ParsedFitment>): ParsedFitment {
  return {
    boltPattern: "5x110",
    centerBore: 65.1,
    offsetRange: { min: 35, max: 52 },
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
    expect(parseTireSize("205/45R17")).toEqual({ width: 205, aspectRatio: 45, rimDiameter: 17 });
  });
  it("parses P-metric and ZR", () => {
    expect(parseTireSize("P235/35R19")).toEqual({ width: 235, aspectRatio: 35, rimDiameter: 19 });
    expect(parseTireSize("245/35ZR20")).toEqual({ width: 245, aspectRatio: 35, rimDiameter: 20 });
  });
});

describe("resolveOemBaseline (root cause 1: multi-size vehicles)", () => {
  // Alfa Romeo 4C: 205/45R17 → 24.3", 235/35R19 → 25.5"
  // Old code used a single 24.3" baseline → 19" candidates failed at +5%
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

  it("19in OEM-equivalent package passes ±3% with per-rim baseline", () => {
    const candidate = calculateOverallDiameter(235, 35, 19);
    const baseline = resolveOemBaseline(fitment, 19);
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

  it("accepts a wheel within ±5mm of a degenerate min===max range", () => {
    // Subaru BRZ record: offset min=max=48; wheel offset 45 is 3mm off → valid
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

  it("still rejects offsets beyond the ±5mm hard bound", () => {
    const best = findBestWheel(wheels, {
      targetDiameters: [17],
      preferredBrands: ["KM"],
      offsetRange: { min: 55, max: 60 }, // wheel at 45 → 10mm below min - 5
      offsetPreference: "oem",
      priceRange: "value",
    });
    expect(best).toBeNull();
  });
});

describe("validateFitment ±3% rule unchanged (safety)", () => {
  it("rejects >3% diameter change", () => {
    const v = validateFitment(28.9, 28, 40, { min: 20, max: 50 });
    expect(v.safe).toBe(false);
  });
  it("accepts within 3%", () => {
    const v = validateFitment(28.5, 28, 40, { min: 20, max: 50 });
    expect(v.safe).toBe(true);
  });
});
