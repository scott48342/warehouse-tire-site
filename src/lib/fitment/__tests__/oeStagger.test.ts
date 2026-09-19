/**
 * OE stagger + load-index scope (audit L1 / H5 interim, 2026-09-19).
 * Rule under test: explicit axle/size provenance drives the verdict, never a
 * diameter count.
 */
import { assessOeStagger, rimDiameterOf } from "../oeStagger";

describe("rimDiameterOf", () => {
  it("reads P-metric, LT and flotation tire sizes", () => {
    expect(rimDiameterOf("245/35R19")).toBe(19);
    expect(rimDiameterOf("LT275/65R18")).toBe(18);
    expect(rimDiameterOf("35x12.50R17")).toBe(17);
    expect(rimDiameterOf("275/35ZR19")).toBe(19);
    expect(rimDiameterOf("garbage")).toBeNull();
  });
});

describe("assessOeStagger - oemStaggered", () => {
  it("single OE size, one diameter -> false, load scope single", () => {
    const a = assessOeStagger({ tireSizes: ["235/45R18"] });
    expect(a.oemStaggered).toBe(false);
    expect(a.loadScopeSingle).toBe(true);
    expect(a.oeSizeCount).toBe(1);
  });

  it("flat list across two diameters (trim OPTIONS, 2016 Fusion) -> null (unknown), NOT true", () => {
    const a = assessOeStagger({ tireSizes: ["215/60R16", "225/50R17"] });
    expect(a.oemStaggered).toBeNull();
    expect(a.frontDiameters).toEqual([]);
    expect(a.loadScopeSingle).toBe(false);
  });

  it("flat list that is really a stagger (2022 M4 275/35R19 + 285/30R20) is still unknown without axle info", () => {
    const a = assessOeStagger({ tireSizes: ["275/35R19", "285/30R20"] });
    expect(a.oemStaggered).toBeNull();
    expect(a.loadScopeSingle).toBe(false);
  });

  it("explicit front/rear object with differing sides -> true, with per-axle diameters", () => {
    const a = assessOeStagger({
      tireSizes: ["245/35R19", "305/30R20"],
      oemTireSizesStaggered: { front: ["245/35R19"], rear: ["305/30R20"] },
    });
    expect(a.oemStaggered).toBe(true);
    expect(a.frontDiameters).toEqual([19]);
    expect(a.rearDiameters).toEqual([20]);
    expect(a.loadScopeSingle).toBe(false);
  });

  it("explicit SAME-diameter stagger (245/40R20 F / 275/35R20 R) -> true; one rim diameter does not make it square", () => {
    const a = assessOeStagger({
      tireSizes: ["245/40R20", "275/35R20"],
      oemTireSizesStaggered: { front: ["245/40R20"], rear: ["275/35R20"] },
    });
    expect(a.oemStaggered).toBe(true);
    expect(a.rimDiameters).toEqual([20]);
    expect(a.frontDiameters).toEqual([20]);
    expect(a.rearDiameters).toEqual([20]);
    expect(a.loadScopeSingle).toBe(false);
  });

  it("front/rear object with identical sides is not a stagger", () => {
    const a = assessOeStagger({
      tireSizes: ["235/45R18"],
      oemTireSizesStaggered: { front: ["235/45R18"], rear: ["235/45R18"] },
    });
    expect(a.oemStaggered).toBe(false);
    expect(a.loadScopeSingle).toBe(true);
  });

  it("axle-tagged OE wheel sizes with differing diameters -> true even with a flat tire list", () => {
    const a = assessOeStagger({
      tireSizes: ["275/35R19", "285/30R20"],
      oemWheelSizes: [
        { diameter: 19, axle: "front" },
        { diameter: 20, axle: "rear" },
      ],
    });
    expect(a.oemStaggered).toBe(true);
    expect(a.frontDiameters).toEqual([19]);
    expect(a.rearDiameters).toEqual([20]);
  });

  it("wheel sizes tagged 'both' across several diameters are options, not a stagger", () => {
    const a = assessOeStagger({
      tireSizes: ["235/45R18", "245/40R19"],
      oemWheelSizes: [
        { diameter: 18, axle: "both" },
        { diameter: 19, axle: "both" },
      ],
    });
    expect(a.oemStaggered).toBeNull();
  });
});

describe("assessOeStagger - loadScopeSingle (H5 interim)", () => {
  it("is false for alternative OE sizes on the SAME diameter (different loads possible)", () => {
    const a = assessOeStagger({ tireSizes: ["245/70R17", "265/70R17"] });
    expect(a.rimDiameters).toEqual([17]);
    expect(a.oemStaggered).toBe(false);
    expect(a.loadScopeSingle).toBe(false);
  });

  it("is false for an explicit stagger even when both axles share a diameter", () => {
    const a = assessOeStagger({
      tireSizes: ["245/40R20", "275/35R20"],
      oemTireSizesStaggered: { front: ["245/40R20"], rear: ["275/35R20"] },
    });
    expect(a.loadScopeSingle).toBe(false);
  });

  it("is true only for exactly one OE size and no axle split", () => {
    expect(assessOeStagger({ tireSizes: ["225/60R18"] }).loadScopeSingle).toBe(true);
    expect(assessOeStagger({ tireSizes: ["225/60R18", "225/60r18 "] }).loadScopeSingle).toBe(true); // dupes normalize
    expect(assessOeStagger({ tireSizes: [] }).loadScopeSingle).toBe(false);
  });
});
