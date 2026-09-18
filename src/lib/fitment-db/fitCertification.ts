/**
 * Fit certification gate for wheel results (2026-09-18, audit F7/C4).
 *
 * A wheel result may carry a certified fit claim (fitmentClass surefit/specfit,
 * "Guaranteed Fit"/"Good Fit" labels) ONLY when the vehicle profile the
 * geometry was validated against is itself certified for THIS vehicle:
 *
 *   - trim_required       no trim selected and the certified trims for the
 *                         Y/M/M disagree or are unknown on a compared field
 *                         (or the assessment failed -> fail closed)
 *   - source_unverified   the matched row's values for the field group being
 *                         claimed (wheel specs for wheels, tire sizes for tires)
 *                         have no approved-source provenance. An exact trim
 *                         match is NOT verification (2024 M4 5x120, 2020 Raptor
 *                         model-level tire list). See sourceVerification.ts.
 *   - fallback_unverified profile came from a trim-to-trim fallback that is
 *                         not exact/equivalent certified
 *
 * Geometry compatibility (bolt pattern, bore, diameter/width/offset envelope)
 * is a separate question from certification and is preserved in
 * `geometryClass`. Browsing stays allowed; only the CLAIM is suppressed.
 */
import type { FallbackConfidence } from "./fallbackEquivalence";
import type { TrimAmbiguityResult } from "./trimAmbiguity";

export type FitCertificationBlock = "trim_required" | "source_unverified" | "fallback_unverified" | null;

export type GeometryFitmentClass = "surefit" | "specfit" | "extended" | "excluded";

export function isFallbackCertified(fallbackConfidence: FallbackConfidence | undefined | null): boolean {
  return (
    !fallbackConfidence ||
    fallbackConfidence === "exact_certified" ||
    fallbackConfidence === "equivalent_certified"
  );
}

/** Minimal shape needed from the trim gate (lets tests avoid building a full result). */
export type TrimGateLike = Pick<TrimAmbiguityResult, "certifiable"> | null | undefined;

/**
 * Minimal source gate: `verified` answers "are the values being claimed from an
 * approved source?" for the relevant field group. `null` means the caller had
 * no provenance at all -> fail closed (treated as unverified).
 */
export type SourceGateLike = { verified: boolean } | null | undefined;

/**
 * @param sourceGate omit ONLY for legacy callers that have not been wired to
 *   provenance yet (they keep their previous behaviour). Pass `null` to mean
 *   "no provenance available" -> source_unverified.
 */
export function computeCertificationBlock(
  fallbackConfidence: FallbackConfidence | undefined | null,
  trimGate: TrimGateLike,
  ...sourceGate: [] | [SourceGateLike]
): FitCertificationBlock {
  // trim gate wins: it is the stronger (vehicle-identity) blocker
  if (trimGate && trimGate.certifiable !== true) return "trim_required";
  // source gate next: the row is THIS vehicle, but are its values verified?
  if (sourceGate.length === 1) {
    const sg = sourceGate[0];
    if (!sg || sg.verified !== true) return "source_unverified";
  }
  if (!isFallbackCertified(fallbackConfidence)) return "fallback_unverified";
  return null;
}

/**
 * Downgrade the customer-facing class when certification is blocked.
 * "excluded" stays excluded (it is a rejection, not a claim).
 */
export function gatedFitmentClass<T extends string>(
  geometryClass: T,
  block: FitCertificationBlock
): T | "extended" {
  if (!block) return geometryClass;
  if (geometryClass === "excluded") return geometryClass;
  return "extended";
}

/** true only when nothing blocks certification AND geometry passed at spec level. */
export function isCertifiedFit(geometryClass: string, block: FitCertificationBlock): boolean {
  return !block && (geometryClass === "surefit" || geometryClass === "specfit");
}
