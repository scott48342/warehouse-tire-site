/**
 * Source verification gate (2026-09-18, J2/J4).
 * An exact DB match is not verification; provenance columns decide per field.
 */
import {
  assessSourceVerification,
  toPublicSourceVerification,
  unverifiedSourceVerification,
  APPROVED_WHEEL_SPEC_SOURCES,
} from "../sourceVerification";
import { computeCertificationBlock } from "../fitCertification";

// Real rows observed on 2026-09-18 (read-only probe).
const M4_2024_COMP_XDRIVE = {
  source: "google-ai-overview",
  wheelSpecsSource: null,
  wheelSpecsConfidence: null,
  tireSizesSource: "usaf",
  tireSizesConfidence: "HIGH",
  tireSizesNeedsTrimSplit: false,
  loadIndexSource: "usaf",
  boltPattern: "5x120",
};

const F150_2020_RAPTOR = {
  source: "trim-research",
  wheelSpecsSource: "xref:wheelpros",
  wheelSpecsConfidence: "MEDIUM",
  tireSizesSource: "usaf",
  tireSizesConfidence: "HIGH",
  tireSizesNeedsTrimSplit: false,
  loadIndexSource: "usaf-max",
  boltPattern: "6x135",
};

describe("assessSourceVerification - known regressions", () => {
  test("J4: 2024 BMW M4 Competition xDrive (web AI overview, no wheel provenance) -> wheel specs unverified", () => {
    const sv = assessSourceVerification(M4_2024_COMP_XDRIVE, { trimCount: 3 });
    expect(sv.wheelSpecs).toBe("unverified");
    expect(sv.verified).toBe(false);
    expect(sv.unverifiedFields).toContain("wheelSpecs");
    // exact-trim match on this row must NOT certify the wheel claim
    expect(computeCertificationBlock("exact_certified", null, { verified: sv.wheelSpecs === "verified" })).toBe(
      "source_unverified"
    );
  });

  test("J2: 2020 F-150 Raptor - model-level US AutoForce list on a 9-trim vehicle -> tire sizes unverified, scope model", () => {
    const sv = assessSourceVerification(F150_2020_RAPTOR, { trimCount: 9 });
    expect(sv.wheelSpecs).toBe("verified"); // xref:wheelpros IS approved for bolt pattern
    expect(sv.tireSizes).toBe("unverified");
    expect(sv.tireSizesScope).toBe("model");
    expect(sv.loadIndex).toBe("unverified"); // usaf-max is never a verified minimum
    expect(sv.verified).toBe(false);
    expect(computeCertificationBlock("exact_certified", null, { verified: sv.tireSizes === "verified" })).toBe(
      "source_unverified"
    );
  });
});

describe("assessSourceVerification - rules", () => {
  test("no row -> everything unverified", () => {
    const sv = assessSourceVerification(null);
    expect(sv.wheelSpecs).toBe("unverified");
    expect(sv.tireSizes).toBe("unverified");
    expect(sv.loadIndex).toBe("unverified");
    expect(sv.verified).toBe(false);
  });

  test("approved wheel source verifies wheel specs; LOW confidence does not", () => {
    for (const src of APPROVED_WHEEL_SPEC_SOURCES) {
      expect(assessSourceVerification({ wheelSpecsSource: src, wheelSpecsConfidence: "MEDIUM" }).wheelSpecs).toBe("verified");
    }
    expect(assessSourceVerification({ wheelSpecsSource: "xref:wheelpros", wheelSpecsConfidence: "LOW" }).wheelSpecs).toBe(
      "unverified"
    );
  });

  test("unapproved wheel sources stay unverified (roadkill-xref, audit-pass3-bolt-fix, reddit-correction)", () => {
    for (const src of ["roadkill-xref", "audit-pass3-bolt-fix", "reddit-correction-2026-09-16", "made-up"]) {
      expect(assessSourceVerification({ wheelSpecsSource: src, wheelSpecsConfidence: "HIGH" }).wheelSpecs).toBe("unverified");
    }
  });

  test("NULL wheel provenance falls back to approved ROW sources only", () => {
    expect(assessSourceVerification({ source: "tireguide-pro", wheelSpecsSource: null }).wheelSpecs).toBe("verified");
    expect(assessSourceVerification({ source: "manual-research", wheelSpecsSource: null }).wheelSpecs).toBe("verified");
    expect(assessSourceVerification({ source: "tgp_solutions", wheelSpecsSource: null }).wheelSpecs).toBe("verified");
    for (const src of ["google-ai-overview", "trim-research", "generation_inherit", "cache-import [expanded]", "verified-research"]) {
      expect(assessSourceVerification({ source: src, wheelSpecsSource: null }).wheelSpecs).toBe("unverified");
    }
  });

  test("tire sizes: trim-explicit source verifies regardless of trim count", () => {
    const sv = assessSourceVerification({ tireSizesSource: "tireguide-pro", tireSizesConfidence: "HIGH" }, { trimCount: 7 });
    expect(sv.tireSizes).toBe("verified");
    expect(sv.tireSizesScope).toBe("trim");
  });

  test("tire sizes: model-level source verifies ONLY a single-trim vehicle without a split flag", () => {
    const base = { tireSizesSource: "usaf", tireSizesConfidence: "HIGH", tireSizesNeedsTrimSplit: false };
    expect(assessSourceVerification(base, { trimCount: 1 }).tireSizes).toBe("verified");
    expect(assessSourceVerification(base, { trimCount: 2 }).tireSizes).toBe("unverified");
    expect(assessSourceVerification(base, {}).tireSizes).toBe("unverified"); // unknown count fails closed
    expect(assessSourceVerification({ ...base, tireSizesNeedsTrimSplit: true }, { trimCount: 1 }).tireSizes).toBe("unverified");
    expect(assessSourceVerification(base, { trimCount: 2 }).tireSizesScope).toBe("model");
  });

  test("tire sizes: no provenance or LOW confidence -> unverified", () => {
    expect(assessSourceVerification({ tireSizesSource: null }, { trimCount: 1 }).tireSizes).toBe("unverified");
    expect(assessSourceVerification({ tireSizesSource: "usaf", tireSizesConfidence: "LOW" }, { trimCount: 1 }).tireSizes).toBe(
      "unverified"
    );
  });

  test("load index: print verifies; usaf inherits tire-size state; usaf-max never", () => {
    expect(assessSourceVerification({ loadIndexSource: "tireguide-pro" }).loadIndex).toBe("verified");
    expect(
      assessSourceVerification({ loadIndexSource: "usaf", tireSizesSource: "usaf", tireSizesConfidence: "HIGH" }, { trimCount: 1 })
        .loadIndex
    ).toBe("verified");
    expect(
      assessSourceVerification({ loadIndexSource: "usaf", tireSizesSource: "usaf", tireSizesConfidence: "HIGH" }, { trimCount: 4 })
        .loadIndex
    ).toBe("unverified");
    expect(assessSourceVerification({ loadIndexSource: "usaf-max" }, { trimCount: 1 }).loadIndex).toBe("unverified");
  });

  test("certification_status / quality_tier / confidence_tag are NOT inputs", () => {
    const sv = assessSourceVerification({
      ...({ certificationStatus: "certified", qualityTier: "complete", confidenceTag: "HIGH" } as any),
      source: "google-ai-overview",
      wheelSpecsSource: null,
    });
    expect(sv.wheelSpecs).toBe("unverified");
  });

  test("public projection carries states only - no source names", () => {
    const pub = toPublicSourceVerification(assessSourceVerification(F150_2020_RAPTOR, { trimCount: 9 }));
    expect(pub).toEqual({
      wheelSpecs: "verified",
      tireSizes: "unverified",
      tireSizesScope: "model",
      loadIndex: "unverified",
      verified: false,
      unverifiedFields: ["tireSizes", "loadIndex"],
    });
    expect(JSON.stringify(pub)).not.toMatch(/wheelpros|usaf|source/i);
  });

  test("unverifiedSourceVerification is fully closed", () => {
    const sv = unverifiedSourceVerification("test");
    expect(sv.verified).toBe(false);
    expect(sv.unverifiedFields).toEqual(["wheelSpecs", "tireSizes", "loadIndex"]);
  });
});

describe("computeCertificationBlock with source gate", () => {
  test("trim gate outranks source gate", () => {
    expect(computeCertificationBlock("exact_certified", { certifiable: false }, { verified: false })).toBe("trim_required");
  });
  test("source gate outranks fallback gate", () => {
    expect(computeCertificationBlock("needs_manual_verification", { certifiable: true }, { verified: false })).toBe(
      "source_unverified"
    );
  });
  test("null source gate (no provenance) fails closed", () => {
    expect(computeCertificationBlock("exact_certified", { certifiable: true }, null)).toBe("source_unverified");
  });
  test("all gates pass -> no block", () => {
    expect(computeCertificationBlock("exact_certified", { certifiable: true }, { verified: true })).toBeNull();
  });
  test("legacy 2-arg call keeps previous behaviour", () => {
    expect(computeCertificationBlock("exact_certified", { certifiable: true })).toBeNull();
  });
});
