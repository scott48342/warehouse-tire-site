/**
 * PDP fit-claim copy (2026-09-20, Codex live check hotfix).
 *
 * The wheel and tire PDP trust strips, the wheel "Why choose" bullets, the POS
 * wheel PDP chip and the tire sticky bar all said "Verified fit" / "Fitment
 * guaranteed" the moment a vehicle was selected. A selected vehicle is not
 * evidence. The only input that may unlock a claim is `fitCertified === true`,
 * meaning the server certified THIS SKU (both axles for a staggered set) for
 * the exact selected trim. No PDP caller has that evidence today, so every
 * caller passes false/undefined and renders the neutral line.
 *
 * Pure strings; shared so the wording is decided in one place and unit-tested.
 */

export const FIT_CLAIM_VERIFIED = "Verified fit for your vehicle";
export const FIT_CLAIM_NEUTRAL = "Fit checked for your vehicle before shipping";

/** Trust-strip fit line. null when no vehicle is selected (line is omitted). */
export function pdpFitLine(hasVehicle: boolean, fitCertified?: boolean | null): string | null {
  if (!hasVehicle) return null;
  return fitCertified === true ? FIT_CLAIM_VERIFIED : FIT_CLAIM_NEUTRAL;
}

/** "Why choose this wheel" fitment bullet. Always present; claims only on certification. */
export function whyChooseFitBullet(fitCertified?: boolean | null): string {
  return fitCertified === true
    ? "Verified fitment for confident installation"
    : "Fit checked by our team before shipping";
}

/** Above-the-fold quick benefit on the wheel PDP. */
export function quickBenefitFitLine(hasVehicle: boolean, fitCertified?: boolean | null): string | null {
  if (!hasVehicle) return null;
  return fitCertified === true ? "Verified fitment for your vehicle" : "Fit checked before shipping";
}

/** True when a string makes a fit claim a PDP must not make without evidence. Exported for tests. */
export function isFitClaim(text: string | null | undefined): boolean {
  if (!text) return false;
  return /\b(verified|guaranteed?)\b/i.test(text);
}
