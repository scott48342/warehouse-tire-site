/**
 * Unit tests for the tri-state trim ambiguity gate (audit 2026-09-18, F7 / R3, R5).
 * Pure fixtures - no DB.
 */
import {
  assessTrimAmbiguity,
  failClosedAmbiguity,
  parseTireSizes,
  parseWheelSizesForCompare,
  type TrimCandidateInput,
} from "../trimAmbiguity";

const base = (over: Partial<TrimCandidateInput> & { modificationId: string }): TrimCandidateInput => ({
  displayTrim: over.modificationId,
  boltPattern: "5x120",
  centerBoreMm: "72.6",
  threadSize: "M14x1.25",
  oemWheelSizes: [{ diameter: 19, width: 9, offset: 25, axle: "both" }],
  oemTireSizes: ["255/40R19"],
  requiredLoadIndex: 100,
  ...over,
});

describe("assessTrimAmbiguity - resolutions", () => {
  test("(d) full agreement across trims -> auto, certifiable, no trim required", () => {
    const r = assessTrimAmbiguity([base({ modificationId: "a" }), base({ modificationId: "b" })]);
    expect(r.resolution).toBe("auto");
    expect(r.certifiable).toBe(true);
    expect(r.trimRequired).toBe(false);
    expect(r.ambiguous).toBe(false);
    expect(r.conflictingFields).toEqual([]);
    expect(r.unknownFields).toEqual([]);
    expect(r.sharedSpecs.boltPattern).toBe("5x120");
    expect(r.sharedSpecs.requiredLoadIndex).toBe(100);
    expect(r.sharedSpecs.staggered).toBe(false);
  });

  test("single row -> single, certifiable", () => {
    const r = assessTrimAmbiguity([base({ modificationId: "only", boltPattern: null })]);
    expect(r.resolution).toBe("single");
    expect(r.certifiable).toBe(true);
    expect(r.trimRequired).toBe(false);
    // unknown fields are still reported honestly
    expect(r.fieldStates.boltPattern).toBe("unknown");
  });

  test("(a) same tire sizes, different wheel width/offset -> trim_required", () => {
    const r = assessTrimAmbiguity([
      base({ modificationId: "xle", oemWheelSizes: [{ diameter: 18, width: 8, offset: 35 }], oemTireSizes: ["235/65R18"] }),
      base({ modificationId: "ltd", oemWheelSizes: [{ diameter: 18, width: 8.5, offset: 40 }], oemTireSizes: ["235/65R18"] }),
    ]);
    expect(r.resolution).toBe("trim_required");
    expect(r.trimRequired).toBe(true);
    expect(r.certifiable).toBe(false);
    expect(r.fieldStates.oemTireSizes).toBe("agree");
    expect(r.fieldStates.oemWheelSizes).toBe("disagree");
    expect(r.conflictingFields).toContain("oemWheelSizes");
    // agreed field is exposed for browsing only
    expect(r.sharedSpecs.oemTireSizes).toEqual(["235/65R18"]);
    expect(r.sharedSpecs.oemWheelSizes).toBeNull();
  });

  test("(b) same tires, different requiredLoadIndex -> trim_required", () => {
    const r = assessTrimAmbiguity([
      base({ modificationId: "xlt", requiredLoadIndex: 110 }),
      base({ modificationId: "raptor", requiredLoadIndex: 119 }),
    ]);
    expect(r.trimRequired).toBe(true);
    expect(r.certifiable).toBe(false);
    expect(r.fieldStates.requiredLoadIndex).toBe("disagree");
    expect(r.sharedSpecs.requiredLoadIndex).toBeNull();
  });

  test("(c) known + unknown bolt pattern -> unknown, no auto-resolve, not certifiable", () => {
    const r = assessTrimAmbiguity([
      base({ modificationId: "a", boltPattern: "5x114.3" }),
      base({ modificationId: "b", boltPattern: null }),
    ]);
    expect(r.fieldStates.boltPattern).toBe("unknown");
    expect(r.unknownFields).toContain("boltPattern");
    expect(r.conflictingFields).not.toContain("boltPattern");
    expect(r.ambiguous).toBe(false); // nothing DISAGREES ...
    expect(r.trimRequired).toBe(true); // ... but unknown still blocks auto-resolve
    expect(r.certifiable).toBe(false);
    expect(r.resolution).toBe("trim_required");
    expect(r.sharedSpecs.boltPattern).toBeNull(); // unknown never counts as agreement
  });

  test("bolt pattern disagree (Mustang 5x114.3 vs Mach-E 5x108) -> conflicting, no shared bolt", () => {
    const r = assessTrimAmbiguity([
      base({ modificationId: "gt", boltPattern: "5x114.3", centerBoreMm: 70.5 }),
      base({ modificationId: "mach-e", boltPattern: "5X108", centerBoreMm: 63.4 }),
    ]);
    expect(r.fieldStates.boltPattern).toBe("disagree");
    expect(r.fieldStates.centerBore).toBe("disagree");
    expect(r.ambiguous).toBe(true);
    expect(r.sharedSpecs.boltPattern).toBeNull();
  });

  test("(e) staggered vs square with overlapping front size -> trim_required", () => {
    const r = assessTrimAmbiguity([
      base({ modificationId: "square", oemTireSizes: ["275/35R19"], oemWheelSizes: [{ diameter: 19, width: 9.5, offset: 20 }] }),
      base({
        modificationId: "stag",
        oemTireSizes: { front: ["275/35R19"], rear: ["285/30R20"] },
        oemWheelSizes: [
          { diameter: 19, width: 9.5, offset: 20, axle: "front" },
          { diameter: 20, width: 10.5, offset: 20, axle: "rear" },
        ],
      }),
    ]);
    expect(r.fieldStates.staggered).toBe("disagree");
    expect(r.fieldStates.oemTireSizes).toBe("disagree");
    expect(r.trimRequired).toBe(true);
    expect(r.certifiable).toBe(false);
  });

  test("(f) truncated candidate set (conflicting row past the limit) -> every field unknown, trim_required", () => {
    const rows = Array.from({ length: 5 }, (_, i) => base({ modificationId: `t${i}` }));
    // the 6th (conflicting) row was NOT loaded - caller signals truncation
    const r = assessTrimAmbiguity(rows, { truncated: true });
    expect(r.resolution).toBe("error");
    expect(r.truncated).toBe(true);
    expect(r.trimRequired).toBe(true);
    expect(r.certifiable).toBe(false);
    expect(Object.values(r.fieldStates).every((s) => s === "unknown")).toBe(true);
    expect(r.sharedSpecs.boltPattern).toBeNull();
  });

  test("wheel entries without any offset (entry or row range) -> oemWheelSizes unknown", () => {
    const r = assessTrimAmbiguity([
      base({ modificationId: "a", oemWheelSizes: ["8.5Jx18"] }),
      base({ modificationId: "b", oemWheelSizes: ["8.5Jx18"] }),
    ]);
    expect(r.fieldStates.oemWheelSizes).toBe("unknown");
    expect(r.certifiable).toBe(false);
  });

  test("wheel entries take offset from row offsetMin/Max when entry has none", () => {
    const r = assessTrimAmbiguity([
      base({ modificationId: "a", oemWheelSizes: ["8.5Jx18"], offsetMinMm: 35, offsetMaxMm: 35 }),
      base({ modificationId: "b", oemWheelSizes: ["8.5Jx18"], offsetMinMm: 35, offsetMaxMm: 35 }),
    ]);
    expect(r.fieldStates.oemWheelSizes).toBe("agree");
    expect(r.certifiable).toBe(true);
  });

  test("failClosedAmbiguity -> error, trimRequired, not certifiable", () => {
    const r = failClosedAmbiguity("db exploded");
    expect(r.resolution).toBe("error");
    expect(r.trimRequired).toBe(true);
    expect(r.certifiable).toBe(false);
    expect(r.error).toBe("db exploded");
  });

  test("no rows -> error / fail closed", () => {
    const r = assessTrimAmbiguity([]);
    expect(r.resolution).toBe("error");
    expect(r.certifiable).toBe(false);
  });
});

describe("normalizers", () => {
  test("parseTireSizes: object form distinguishes axles and flags staggered", () => {
    const p = parseTireSizes({ front: ["275/35R19"], rear: ["285/30R20"] })!;
    expect(p.keys).toEqual(["F:275/35R19", "R:285/30R20"]);
    expect(p.staggered).toBe(true);
    expect(parseTireSizes({ front: ["255/40R19"], rear: ["255/40R19"] })!.staggered).toBe(false);
    expect(parseTireSizes(["255/40R19", " 255/40r19 "])!.keys).toEqual(["255/40R19"]);
    expect(parseTireSizes(null)).toBeNull();
  });

  test("parseWheelSizesForCompare: complete flag and staggered detection", () => {
    const ok = parseWheelSizesForCompare([{ diameter: 20, width: 9, offset: 35, axle: "front" }, { diameter: 20, width: 10.5, offset: 20, position: "rear" }])!;
    expect(ok.complete).toBe(true);
    expect(ok.staggered).toBe(true);
    expect(ok.keys).toEqual(["front:20x9@35", "rear:20x10.5@20"]);
    const incomplete = parseWheelSizesForCompare(["9Jx20"])!;
    expect(incomplete.complete).toBe(false);
  });
});
