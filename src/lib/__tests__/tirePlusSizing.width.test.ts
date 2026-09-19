import { generatePlusSizeCandidates, generatePlusSizeCandidatesMulti } from "../tirePlusSizing";

// Audit website-fitment-audit-2026-09-18 M3: plus-size candidates must stay
// within a realistic section-width window of the OEM tire.
describe("plus-size width window (M3)", () => {
  it("does not offer 325/25R20 as a candidate for 235/45R18 -> 20\"", () => {
    const r = generatePlusSizeCandidates("235/45R18", 20);
    const sizes = r.acceptableCandidates.map((c) => c.size);
    expect(sizes).not.toContain("325/25R20");
    expect(r.primaryCandidates.every((c) => c.widthMm <= 275 && c.widthMm >= 215)).toBe(true);
    expect(r.debug?.sizesExcludedByWidth ?? 0).toBeGreaterThan(0);
  });

  it("still offers the normal plus-two widths", () => {
    const r = generatePlusSizeCandidates("235/45R18", 20);
    const sizes = r.acceptableCandidates.map((c) => c.size);
    expect(sizes.some((s) => /^2[4-6]5\/(30|35)R20$/.test(s))).toBe(true);
  });

  it("can be disabled explicitly", () => {
    const r = generatePlusSizeCandidates("235/45R18", 20, {
      maxWidthIncreaseMm: Infinity,
      maxWidthDecreaseMm: Infinity,
    });
    expect(r.debug?.sizesExcludedByWidth).toBe(0);
  });

  it("applies to the staggered/multi path", () => {
    const c = generatePlusSizeCandidatesMulti(["235/45R18", "255/40R18"], 20);
    expect(c.map((x) => x.size)).not.toContain("325/25R20");
  });
});