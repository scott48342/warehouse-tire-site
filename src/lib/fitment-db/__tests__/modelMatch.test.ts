/**
 * Regression tests — audit 2026-09-18 finding C4 / F5.
 * "Mustang" must never resolve to "Mustang Mach-E"; legit aliases still work.
 */
import {
  compactModelKey,
  getModelKeyCandidates,
  modelMatchesExactly,
  modelExactMatchSql,
} from "../modelMatch";
import { vehicleFitments } from "../schema";

describe("modelMatch — exact compact-key semantics (F5)", () => {
  it("compactModelKey strips spaces/hyphens/case", () => {
    expect(compactModelKey("Mustang Mach-E")).toBe("mustangmache");
    expect(compactModelKey("Silverado 2500 HD")).toBe("silverado2500hd");
    expect(compactModelKey("F-250")).toBe("f250");
    expect(compactModelKey("  ENCORE_GX ")).toBe("encoregx");
  });

  it("2024 Ford Mustang does NOT match Mustang Mach-E", () => {
    expect(modelMatchesExactly("Mustang", "Mustang")).toBe(true);
    expect(modelMatchesExactly("mustang", "Mustang")).toBe(true);
    expect(modelMatchesExactly("Mustang Mach-E", "Mustang")).toBe(false);
    expect(modelMatchesExactly("Mustang Mach E", "Mustang")).toBe(false);
    expect(modelMatchesExactly("mustang-mach-e", "Mustang")).toBe(false);
  });

  it("Mustang Mach-E still resolves to itself (any separator / case)", () => {
    expect(modelMatchesExactly("Mustang Mach-E", "Mustang Mach-E")).toBe(true);
    expect(modelMatchesExactly("Mustang Mach E", "mustang-mach-e")).toBe(true);
    expect(modelMatchesExactly("Mustang", "Mustang Mach-E")).toBe(false);
  });

  it("no bare substring/prefix cross-model matches", () => {
    expect(modelMatchesExactly("M440i", "M4")).toBe(false);
    expect(modelMatchesExactly("Civic Type R", "Civic")).toBe(false);
    expect(modelMatchesExactly("F-150 Lightning", "F-150")).toBe(false);
    expect(modelMatchesExactly("Silverado 1500", "Silverado 1500 LD")).toBe(false);
  });

  it("explicit aliases keep working: Silverado 2500 HD -> Silverado 2500HD", () => {
    expect(modelMatchesExactly("Silverado 2500HD", "Silverado 2500 HD")).toBe(true);
    expect(modelMatchesExactly("Silverado 2500HD", "silverado-2500-hd")).toBe(true);
    expect(modelMatchesExactly("Silverado 2500HD", "Silverado 2500")).toBe(true);
    // but 2500 never matches 3500
    expect(modelMatchesExactly("Silverado 3500HD", "Silverado 2500 HD")).toBe(false);
  });

  it("explicit aliases keep working: F-250 <-> F-250 Super Duty", () => {
    expect(modelMatchesExactly("f-250-super-duty", "F-250")).toBe(true);
    expect(modelMatchesExactly("F-250", "F-250 Super Duty")).toBe(true);
    expect(modelMatchesExactly("F-350", "F-250")).toBe(false);
  });

  it("separator-insensitive: Encore GX vs encore-gx", () => {
    expect(modelMatchesExactly("Encore GX", "encore-gx")).toBe(true);
    expect(modelMatchesExactly("Encore", "encore-gx")).toBe(false);
  });

  it("candidate list has no empties and is deduped", () => {
    const c = getModelKeyCandidates("Mustang");
    expect(c).toEqual(["mustang"]);
    expect(getModelKeyCandidates("   ")).toEqual([]);
  });

  it("SQL predicate uses equality / IN, never LIKE wildcards", () => {
    const single = modelExactMatchSql(vehicleFitments.model, ["mustang"]);
    const multi = modelExactMatchSql(vehicleFitments.model, ["f250", "f250superduty"]);
    const none = modelExactMatchSql(vehicleFitments.model, []);
    // drizzle SQL objects expose queryChunks; collect only the literal string chunks
    const dump = (s: unknown): string => {
      const out: string[] = [];
      const walk = (x: any) => {
        if (!x) return;
        if (Array.isArray(x)) { x.forEach(walk); return; }
        if (typeof x === "object") {
          if (Array.isArray(x.value) && x.value.every((v: unknown) => typeof v === "string")) out.push(x.value.join(""));
          if (Array.isArray(x.queryChunks)) walk(x.queryChunks);
        }
      };
      walk(s);
      return out.join("");
    };
    expect(dump(single)).toContain("REGEXP_REPLACE");
    expect(dump(single)).not.toContain("%");
    expect(dump(multi)).toContain(" IN (");
    expect(dump(multi)).not.toContain("%");
    expect(dump(none)).toContain("FALSE");
  });
});
