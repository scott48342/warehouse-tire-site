/**
 * OE offset provenance (2026-09-20, Codex review of fba009bb).
 *
 * vehicle_fitments row bb27a4b8 (2020 Ford Mustang GT Performance Pack) has
 * offset_min_mm=30 / offset_max_mm=52 but every oem_wheel_sizes[].offset is null.
 * buildFitmentEnvelope only read the inline offsets, so the "OEM" offset became 0/0 -
 * a missing-value default - and a 20x10 ET0 rear was classified specfit/certified while
 * factory-offset wheels were "extended". 18,511 of 32,569 certified rows share this shape.
 */
import { buildFitmentEnvelope, validateWheel, type OEMSpecs } from "@/lib/aftermarketFitment";
import { computeWheelGeometry, resolveOemOffset } from "@/lib/fitment/geometryValidator";

const mustangGtPp: OEMSpecs = {
  boltPattern: "5x114.3",
  centerBore: 70.5,
  wheelSpecs: [
    { rimDiameter: 19, rimWidth: 9, offset: null },
    { rimDiameter: 19, rimWidth: 9.5, offset: null },
  ],
  offsetMinMm: 30,
  offsetMaxMm: 52,
};

const wheel = (sku: string, width: number, offset: number, diameter = 19) => ({
  sku, boltPattern: "5x114.3", centerBore: 73.1, diameter, width, offset,
});

describe("OE offset range provenance in the fitment envelope", () => {
  it("uses the sourced DB range when oem_wheel_sizes has no inline offsets (Mustang GT PP row)", () => {
    const env = buildFitmentEnvelope(mustangGtPp, "aftermarket_safe");
    expect(env.oemOffsetVerified).toBe(true);
    expect(env.oemOffsetSource).toBe("db_offset_range");
    expect([env.oemMinOffset, env.oemMaxOffset]).toEqual([30, 52]);
    // aftermarket_safe expands 25 low / 15 high
    expect([env.allowedMinOffset, env.allowedMaxOffset]).toEqual([5, 67]);
  });

  it("REGRESSION: RIDLER 652 20x10 ET0 is no longer certified on a +30..+52 car; a factory-offset wheel is", () => {
    const env = buildFitmentEnvelope(mustangGtPp, "aftermarket_safe");
    const ridlerRear = validateWheel(wheel("652-2165GBD", 10, 0, 20), env);
    expect(ridlerRear.fitmentClass).toBe("extended");
    expect(ridlerRear.offsetInRange).toBe(false);

    // RC7 front 19x8.5 ET15: 15 mm below the factory floor but inside the preset's 25 mm
    // mild-poke allowance -> "minor" deviation (specfit), and no longer "within OEM range".
    const rc7Front = validateWheel(wheel("RC719855114MG15", 8.5, 15), env);
    expect(rc7Front.offsetInRange).toBe(false);
    expect(rc7Front.fitmentClass).toBe("specfit");
    expect(rc7Front.classificationReasons.join(" ")).toMatch(/Offset 15mm outside OEM range \(30-52mm\)/);

    const factoryLike = validateWheel(wheel("OE-LIKE", 9, 40), env);
    expect(factoryLike.offsetInRange).toBe(true);
    expect(["surefit", "specfit"]).toContain(factoryLike.fitmentClass);
  });

  it("inline per-wheel offsets still win over the DB range", () => {
    const env = buildFitmentEnvelope(
      { ...mustangGtPp, wheelSpecs: [{ rimDiameter: 19, rimWidth: 9, offset: 35 }, { rimDiameter: 19, rimWidth: 9.5, offset: 52 }] },
      "aftermarket_safe",
    );
    expect(env.oemOffsetSource).toBe("oem_wheel_sizes");
    expect([env.oemMinOffset, env.oemMaxOffset]).toEqual([35, 52]);
  });

  it("a GENUINE 0 mm factory offset is verified and can still be surefit", () => {
    const classicLike: OEMSpecs = {
      boltPattern: "5x120.65", centerBore: 70.3,
      wheelSpecs: [{ rimDiameter: 15, rimWidth: 7, offset: 0 }],
    };
    const env = buildFitmentEnvelope(classicLike, "oem");
    expect(env.oemOffsetVerified).toBe(true);
    expect(env.oemOffsetSource).toBe("oem_wheel_sizes");
    const v = validateWheel({ sku: "Z", boltPattern: "5x120.65", centerBore: 70.3, diameter: 15, width: 7, offset: 0 }, env);
    expect(v.fitmentClass).toBe("surefit");

    const envRange = buildFitmentEnvelope({ ...classicLike, wheelSpecs: [{ rimDiameter: 15, rimWidth: 7, offset: null }], offsetMinMm: 0, offsetMaxMm: 0 }, "oem");
    expect(envRange.oemOffsetVerified).toBe(true);
    expect(envRange.oemOffsetSource).toBe("db_offset_range");
    expect(validateWheel({ sku: "Z2", boltPattern: "5x120.65", centerBore: 70.3, diameter: 15, width: 7, offset: 0 }, envRange).fitmentClass).toBe("surefit");
  });

  it("NO offset data at all -> unverified -> never surefit/specfit, but not excluded either", () => {
    const env = buildFitmentEnvelope({ boltPattern: "5x114.3", centerBore: 70.5, wheelSpecs: [{ rimDiameter: 19, rimWidth: 9, offset: null }] }, "aftermarket_safe");
    expect(env.oemOffsetVerified).toBe(false);
    expect(env.oemOffsetSource).toBe("unverified");
    for (const et of [-25, 0, 15, 40]) {
      const v = validateWheel(wheel(`U${et}`, 9, et), env);
      expect(v.fitmentClass).toBe("extended");
      expect(v.classificationReasons.join(" ")).toMatch(/OEM offset unverified/);
    }
  });

  it("inline offsets must be FINITE numbers - NaN/Infinity/undefined are not data", () => {
    const env = buildFitmentEnvelope(
      { ...mustangGtPp, wheelSpecs: [{ rimDiameter: 19, rimWidth: 9, offset: NaN }, { rimDiameter: 19, rimWidth: 9.5, offset: Infinity }, { rimDiameter: 19, rimWidth: 9.5, offset: undefined as unknown as null }] },
      "aftermarket_safe",
    );
    // none of the junk becomes a range end; the sourced DB range is used instead
    expect(env.oemOffsetSource).toBe("db_offset_range");
    expect([env.oemMinOffset, env.oemMaxOffset]).toEqual([30, 52]);

    const junkOnly = buildFitmentEnvelope({ boltPattern: "5x114.3", centerBore: 70.5, wheelSpecs: [{ rimDiameter: 19, rimWidth: 9, offset: NaN }] }, "aftermarket_safe");
    expect(junkOnly.oemOffsetVerified).toBe(false);
    expect(validateWheel(wheel("J", 9, 40), junkOnly).fitmentClass).toBe("extended");
  });

  it("an INVERTED DB range (min > max) is conflicting data: not normalised, nothing certifies against it", () => {
    const env = buildFitmentEnvelope({ ...mustangGtPp, offsetMinMm: 52, offsetMaxMm: 30 }, "aftermarket_safe");
    expect(env.oemOffsetVerified).toBe(false);
    expect(env.oemOffsetSource).toBe("conflicting");
    for (const et of [30, 41, 52]) {
      expect(validateWheel(wheel(`I${et}`, 9, et), env).fitmentClass).toBe("extended");
    }
    // non-finite range ends are "no data", not zero
    const nan = buildFitmentEnvelope({ ...mustangGtPp, offsetMinMm: NaN, offsetMaxMm: 52 }, "aftermarket_safe");
    expect(nan.oemOffsetVerified).toBe(false);
  });

  it("a wheel whose own offset is unknown is no longer certified specfit", () => {
    const env = buildFitmentEnvelope(mustangGtPp, "aftermarket_safe");
    const v = validateWheel({ sku: "NOET", boltPattern: "5x114.3", centerBore: 73.1, diameter: 19, width: 9 }, env);
    expect(v.fitmentClass).toBe("extended");
  });
});

describe("staggered geometry gate must not be skipped when per-axle offsets are missing", () => {
  const oemWheelSizes = [
    { diameter: 19, width: 9, offset: null, axle: "front" as const },
    { diameter: 19, width: 9.5, offset: null, axle: "rear" as const },
  ];

  it("per-axle resolution is missing but the DB-range midpoint reference exists (the fallback the route now uses)", () => {
    const rear = resolveOemOffset({ offsetMinMm: 30, offsetMaxMm: 52, oemWheelSizes, axle: "rear", requireAxleSpecific: true });
    expect(rear.missing).toBe(true);
    const primary = resolveOemOffset({ offsetMinMm: 30, offsetMaxMm: 52, oemWheelSizes });
    expect(primary.missing).toBe(false);
    if (primary.missing) return;
    expect(primary.source).toBe("db_range_midpoint");
    expect(primary.offset_mm).toBe(41);
  });

  it("against that reference the RIDLER 20x10 ET0 rear exceeds the aggressive car limit (was certified before)", () => {
    const geo = computeWheelGeometry({ width_in: 10, offset_mm: 0 }, { width_in: 9.25, offset_mm: 41 }, "car");
    expect(geo.delta_outboard_mm).toBeGreaterThan(35); // aggressive car max_outboard
    expect(geo.passesAggressive).toBe(false);
  });

  it("a factory-like 19x9.5 ET45 rear passes the same gate", () => {
    const geo = computeWheelGeometry({ width_in: 9.5, offset_mm: 45 }, { width_in: 9.25, offset_mm: 41 }, "car");
    expect(geo.passesDailyDriver).toBe(true);
  });
});
