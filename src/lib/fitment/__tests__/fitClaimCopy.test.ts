/**
 * Regression: 2026-09-20 Codex live check. The wheel PDP for TR04198551435BK
 * (+ rear TR04209551435BK) on a 2020 Mustang GT Performance Pack said
 * "Verified fitment guaranteed", "Verified fit for your vehicle" and "Verified
 * fitment for confident installation" although the staggered OE offsets are
 * unverified and the SRP showed the set as Custom Fit. Every one of those lines
 * was keyed on "a vehicle is selected". The tire PDP trust strips had the same
 * mechanism. Wording now comes from lib/fitment/fitClaimCopy and claims only on
 * an explicit fitCertified === true.
 */
import {
  pdpFitLine,
  whyChooseFitBullet,
  quickBenefitFitLine,
  isFitClaim,
  FIT_CLAIM_NEUTRAL,
  FIT_CLAIM_VERIFIED,
} from "../fitClaimCopy";

describe("PDP fit-claim copy", () => {
  it("a selected vehicle alone never yields a verified/guaranteed claim", () => {
    for (const cert of [undefined, null, false] as const) {
      expect(isFitClaim(pdpFitLine(true, cert))).toBe(false);
      expect(isFitClaim(whyChooseFitBullet(cert))).toBe(false);
      expect(isFitClaim(quickBenefitFitLine(true, cert))).toBe(false);
    }
    expect(pdpFitLine(true, false)).toBe(FIT_CLAIM_NEUTRAL);
  });

  it("claims only on explicit certification", () => {
    expect(pdpFitLine(true, true)).toBe(FIT_CLAIM_VERIFIED);
    expect(isFitClaim(whyChooseFitBullet(true))).toBe(true);
    expect(isFitClaim(quickBenefitFitLine(true, true))).toBe(true);
  });

  it("no vehicle -> the vehicle-specific line is omitted entirely, even if certified is passed", () => {
    expect(pdpFitLine(false, true)).toBeNull();
    expect(quickBenefitFitLine(false, true)).toBeNull();
  });

  it("isFitClaim recognises the retired wordings and clears the neutral ones", () => {
    expect(isFitClaim("Verified fitment guaranteed")).toBe(true);
    expect(isFitClaim("Verified fit for your vehicle")).toBe(true);
    expect(isFitClaim("Verified fitment for confident installation")).toBe(true);
    expect(isFitClaim("Fitment Guaranteed")).toBe(true);
    expect(isFitClaim("Fit checked before shipping")).toBe(false);
    expect(isFitClaim("Fit not yet confirmed - checked before shipping")).toBe(false);
    expect(isFitClaim("Vehicle selected - fit checked before sale")).toBe(false);
    expect(isFitClaim(null)).toBe(false);
  });
});
