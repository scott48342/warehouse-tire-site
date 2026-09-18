/**
 * Fit certification gate (2026-09-18, audit F7/C4).
 * A wheel may only carry surefit/specfit when the profile is certified for THIS vehicle.
 */
import {
  computeCertificationBlock,
  gatedFitmentClass,
  isCertifiedFit,
  isFallbackCertified,
} from "../fitCertification";

describe("computeCertificationBlock", () => {
  test("exact trim, exact_certified -> no block", () => {
    expect(computeCertificationBlock("exact_certified", null)).toBeNull();
  });
  test("undefined fallback confidence (legacy callers) -> treated as certified", () => {
    expect(computeCertificationBlock(undefined, null)).toBeNull();
  });
  test("equivalent_certified -> no block", () => {
    expect(computeCertificationBlock("equivalent_certified", null)).toBeNull();
  });
  test.each(["wheel_safe_only", "needs_manual_verification", "blocked"] as const)(
    "fallback %s -> fallback_unverified",
    (fc) => {
      expect(computeCertificationBlock(fc, null)).toBe("fallback_unverified");
    }
  );
  test("no-trim gate not certifiable -> trim_required even when fallback says exact", () => {
    expect(computeCertificationBlock("exact_certified", { certifiable: false })).toBe("trim_required");
  });
  test("no-trim gate certifiable (trims agree) -> no block", () => {
    expect(computeCertificationBlock("exact_certified", { certifiable: true })).toBeNull();
  });
  test("trim gate wins over fallback reason", () => {
    expect(computeCertificationBlock("blocked", { certifiable: false })).toBe("trim_required");
  });
  test("gate present but certifiable undefined -> fail closed", () => {
    expect(computeCertificationBlock("exact_certified", { certifiable: undefined as unknown as boolean })).toBe(
      "trim_required"
    );
  });
});

describe("gatedFitmentClass", () => {
  test("no block preserves geometry class", () => {
    expect(gatedFitmentClass("surefit", null)).toBe("surefit");
    expect(gatedFitmentClass("specfit", null)).toBe("specfit");
    expect(gatedFitmentClass("extended", null)).toBe("extended");
  });
  test("blocked downgrades surefit/specfit to extended (never a Guaranteed/Good Fit label)", () => {
    expect(gatedFitmentClass("surefit", "trim_required")).toBe("extended");
    expect(gatedFitmentClass("specfit", "trim_required")).toBe("extended");
    expect(gatedFitmentClass("surefit", "fallback_unverified")).toBe("extended");
  });
  test("excluded stays excluded under a block", () => {
    expect(gatedFitmentClass("excluded", "trim_required")).toBe("excluded");
  });
});

describe("isCertifiedFit", () => {
  test("certified only when unblocked AND geometry is surefit/specfit", () => {
    expect(isCertifiedFit("surefit", null)).toBe(true);
    expect(isCertifiedFit("specfit", null)).toBe(true);
    expect(isCertifiedFit("extended", null)).toBe(false);
    expect(isCertifiedFit("surefit", "trim_required")).toBe(false);
    expect(isCertifiedFit("specfit", "fallback_unverified")).toBe(false);
  });
});

describe("isFallbackCertified", () => {
  test("only exact/equivalent (or absent) count as certified", () => {
    expect(isFallbackCertified("exact_certified")).toBe(true);
    expect(isFallbackCertified("equivalent_certified")).toBe(true);
    expect(isFallbackCertified(undefined)).toBe(true);
    expect(isFallbackCertified("needs_manual_verification")).toBe(false);
    expect(isFallbackCertified("blocked")).toBe(false);
  });
});
