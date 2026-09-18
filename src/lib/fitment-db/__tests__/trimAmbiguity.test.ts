/**
 * Regression tests — audit 2026-09-18 finding F7 (ambiguous trim auto-pick).
 * Fixtures mirror the live shapes observed in the audit; no DB required.
 */
import { assessTrimAmbiguity, tireSizeSetKey, normalizeBoltPatternKey } from "../trimAmbiguity";

describe("trimAmbiguity (F7)", () => {
  it("2024 BMW M4 with no trim -> trim_required (not silently 'CS')", () => {
    const rows = [
      { modificationId: "2024-bmw-m4-cs", displayTrim: "CS", boltPattern: "5x112", centerBoreMm: 66.6,
        oemTireSizes: { front: "275/35R19", rear: "285/30R20" } },
      { modificationId: "2024-bmw-m4-competition", displayTrim: "Competition", boltPattern: "5x112", centerBoreMm: 66.6,
        oemTireSizes: { front: "275/35R19", rear: "285/30R20" } },
      { modificationId: "2024-bmw-m4-base", displayTrim: "Base", boltPattern: "5x120", centerBoreMm: 72.6,
        oemTireSizes: ["255/40R18"] },
    ];
    const r = assessTrimAmbiguity(rows);
    expect(r.ambiguous).toBe(true);
    expect(r.trimRequired).toBe(true);
    expect(r.conflictingFields).toEqual(expect.arrayContaining(["boltPattern", "centerBore", "tireSizes"]));
    expect(r.candidates.map((c) => c.displayTrim)).toEqual(["CS", "Competition", "Base"]);
    // nothing shared -> check-fitment must answer fits:null
    expect(r.shared.boltPattern).toBeNull();
  });

  it("2023 Ram 1500 with no trim -> ambiguous on tire sizes (Base row carries TRX 325/65R18)", () => {
    const rows = [
      { modificationId: "ram-1500-base", displayTrim: "Base", boltPattern: "6x139.7", centerBoreMm: 77.8,
        oemTireSizes: ["325/65R18"] },
      { modificationId: "ram-1500-big-horn", displayTrim: "Big Horn", boltPattern: "6x139.7", centerBoreMm: 77.8,
        oemTireSizes: ["275/65R18", "275/55R20"] },
      { modificationId: "ram-1500-laramie", displayTrim: "Laramie", boltPattern: "6X139.7", centerBoreMm: "77.8",
        oemTireSizes: ["275/55R20"] },
    ];
    const r = assessTrimAmbiguity(rows);
    expect(r.trimRequired).toBe(true);
    expect(r.conflictingFields).toEqual(["tireSizes"]);
    // bolt pattern + center bore agree -> shared, so a bolt-only check may proceed
    expect(r.agreedFields).toEqual(expect.arrayContaining(["boltPattern", "centerBore"]));
    expect(r.shared.boltPattern).toBe("6x139.7");
    expect(r.shared.centerBoreMm).toBe(77.8);
  });

  it("2020 Civic with no trim -> not silently the Si Coupe envelope", () => {
    const rows = [
      { modificationId: "manual_fe1e8674bdec", displayTrim: "LX, Sport, EX, EX-L, Touring, Si", boltPattern: "5x114.3",
        centerBoreMm: 64.1, oemTireSizes: ["215/55R16", "235/40R18"] },
      { modificationId: "2020-honda-civic-si-coupe", displayTrim: "Si Coupe", boltPattern: "5x114.3",
        centerBoreMm: 64.1, oemTireSizes: ["235/40R18"] },
    ];
    const r = assessTrimAmbiguity(rows);
    expect(r.trimRequired).toBe(true);
    expect(r.conflictingFields).toEqual(["tireSizes"]);
    expect(r.shared.boltPattern).toBe("5x114.3");
  });

  it("single grouped record -> auto-select as before (not ambiguous)", () => {
    const r = assessTrimAmbiguity([
      { modificationId: "manual_fe1e8674bdec", displayTrim: "LX, Sport, EX, EX-L, Touring, Si", boltPattern: "5x114.3",
        centerBoreMm: 64.1, oemTireSizes: ["215/55R16", "235/40R18"] },
    ]);
    expect(r.ambiguous).toBe(false);
    expect(r.trimRequired).toBe(false);
    expect(r.conflictingFields).toEqual([]);
    expect(r.candidates).toHaveLength(1);
  });

  it("multiple trims that all agree -> proceed (not ambiguous)", () => {
    const r = assessTrimAmbiguity([
      { modificationId: "a", displayTrim: "SE", boltPattern: "5x114.3", centerBoreMm: 60.1, oemTireSizes: ["235/45R18"] },
      { modificationId: "b", displayTrim: "XSE", boltPattern: "5X114.3", centerBoreMm: "60.10", oemTireSizes: ["235/45R18"] },
    ]);
    expect(r.ambiguous).toBe(false);
    expect(r.agreedFields).toEqual(["boltPattern", "centerBore", "tireSizes"]);
  });

  it("null/unknown values do not create a conflict by themselves", () => {
    const r = assessTrimAmbiguity([
      { modificationId: "a", displayTrim: "SE", boltPattern: "5x114.3", centerBoreMm: null, oemTireSizes: ["235/45R18"] },
      { modificationId: "b", displayTrim: "XSE", boltPattern: null, centerBoreMm: 60.1, oemTireSizes: null },
    ]);
    expect(r.ambiguous).toBe(false);
  });

  it("caller can restrict the fields being asked about", () => {
    const rows = [
      { modificationId: "a", displayTrim: "Base", boltPattern: "6x139.7", centerBoreMm: 77.8, oemTireSizes: ["325/65R18"] },
      { modificationId: "b", displayTrim: "Big Horn", boltPattern: "6x139.7", centerBoreMm: 77.8, oemTireSizes: ["275/65R18"] },
    ];
    expect(assessTrimAmbiguity(rows, ["boltPattern", "centerBore"]).ambiguous).toBe(false);
    expect(assessTrimAmbiguity(rows, ["tireSizes"]).ambiguous).toBe(true);
  });

  it("tireSizeSetKey treats staggered object and array shapes distinctly", () => {
    expect(tireSizeSetKey(["235/40R18", "215/55R16"])).toBe("215/55R16|235/40R18");
    expect(tireSizeSetKey({ front: "255/40R19", rear: ["275/40R19"] })).toBe("F:255/40R19|R:275/40R19");
    expect(tireSizeSetKey(null)).toBeNull();
    expect(tireSizeSetKey([])).toBeNull();
  });

  it("normalizeBoltPatternKey", () => {
    expect(normalizeBoltPatternKey("5 x 114.3")).toBe("5X114.3");
    expect(normalizeBoltPatternKey("5×114.3")).toBe("5X114.3");
    expect(normalizeBoltPatternKey(null)).toBeNull();
  });
});
