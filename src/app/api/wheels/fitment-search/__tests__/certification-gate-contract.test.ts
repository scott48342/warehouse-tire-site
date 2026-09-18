/**
 * Contract test: fitment-search route MUST run every wheel result through the
 * fit certification gate and MUST assess trim ambiguity on the no-trim path.
 * (2026-09-18, audit F7/C4.) Same source-level pattern as tire-sizes
 * canonical-source.test.ts - the route needs a live DB, so we pin the wiring.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

describe("fitment-search certification gate wiring", () => {
  let src: string;
  beforeAll(() => {
    src = readFileSync(resolve(__dirname, "../route.ts"), "utf-8");
  });

  test("imports the shared gate helpers", () => {
    expect(src).toMatch(/from "@\/lib\/fitment-db\/fitCertification"/);
    expect(src).toMatch(/computeCertificationBlock\(/);
  });

  test("per-item fitmentClass goes through gatedFitmentClass (no raw v.fitmentClass in the response)", () => {
    expect(src).toMatch(/fitmentClass:\s*gatedFitmentClass\(v\.fitmentClass,\s*certificationBlock\)/);
    // the old ungated assignment must be gone
    expect(src).not.toMatch(/fitmentClass:\s*v\.fitmentClass,/);
  });

  test("per-item certified flag uses isCertifiedFit", () => {
    expect(src).toMatch(/certified:\s*isCertifiedFit\(v\.fitmentClass,\s*certificationBlock\)/);
  });

  test("response exposes certificationBlock and showGuaranteedFit derived from the gate", () => {
    expect(src).toMatch(/showGuaranteedFit,\s*\n\s*certificationBlock,/);
    expect(src).toMatch(/const showGuaranteedFit = certificationBlock === null;/);
  });

  test("no-trim local DB path assesses trim ambiguity and fails closed", () => {
    expect(src).toMatch(/assessTrimAmbiguityForYmm\(Number\(year\),\s*make,\s*model\)/);
    expect(src).toMatch(/failClosedAmbiguity\(/);
    // the auto-picked row is exact_certified ONLY when the trims agree
    expect(src).toMatch(/noTrimCertifiable \? "exact_certified" : "needs_manual_verification"/);
    // exactly one unconditional exact_certified remains: the classic platform path
    // (platform-based, no trims) - anything more means a new ungated caller
    const unconditional = src.match(/confidenceResult,\s*"exact_certified"\);/g) ?? [];
    expect(unconditional).toHaveLength(1);
    const idx = src.indexOf(unconditional[0] ?? "");
    expect(src.slice(Math.max(0, idx - 4000), idx)).toMatch(/CLASSIC FALLBACK HIT/);
  });

  test("handleDbFirstWheelResults accepts the trim gate", () => {
    expect(src).toMatch(/trimGate\?:\s*TrimAmbiguityResult \| null;/);
  });
});
