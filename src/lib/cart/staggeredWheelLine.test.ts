/**
 * 2026-09-20 (Codex live check on hotfix 2c304b73): a 19x8.5 / 20x9.5 VORS TR4 set added
 * from the PDP was labelled "Rear 19x9.5" in the cart and the cart's Add Tires link carried
 * only wheelDia=19 + the front SKU. The rear axle must come from its OWN record, a missing
 * record must never be filled from the front, and the tires hand-off must not be able to
 * assert a 19" rear.
 */
import {
  axleSizeLabel,
  buildTiresHandoff,
  isMixedDiameterLine,
  rearAxleSpec,
  REAR_SIZE_UNCONFIRMED_COPY,
} from "@/lib/cart/staggeredWheelLine";
import { rearWheelSpecForRecord } from "@/lib/checkout/buildCheckoutLines";

jest.mock("pg", () => ({ __esModule: true, default: { Pool: jest.fn() } }));
jest.mock("@/lib/usautoforce/client", () => ({ placeOrder: jest.fn(), getOrderStatus: jest.fn() }));
jest.mock("@/lib/wheelpros/orderClient", () => ({ placeWheelProsOrder: jest.fn(), trackWheelProsOrder: jest.fn() }));
jest.mock("@/lib/usautoforce/brandCodes", () => ({ getUSAFBrandCode: () => undefined }));

const VEHICLE = { year: "2020", make: "Ford", model: "Mustang", trim: "GT Performance Pack" };

/** Exactly what the PDP "Add Set" stamps after this fix. */
const NEW_19_20 = {
  sku: "TR04198551435BK", rearSku: "TR04209551435BK", staggered: true,
  diameter: "19", width: "8.5", offset: "35",
  rearDiameter: "20", rearWidth: "9.5", rearOffset: "35",
};

/** Same set persisted by a build that had no rearDiameter field (Codex's live reproduction). */
const LEGACY_19_20 = {
  sku: "TR04198551435BK", rearSku: "TR04209551435BK", staggered: true,
  diameter: "19", width: "8.5", offset: "35",
  rearWidth: "9.5", rearOffset: "35",
};

const KNOWN_20_20 = {
  sku: "TR04208551435HB", rearSku: "TR04209551435HB", staggered: true,
  diameter: "20", width: "8.5", offset: "35",
  rearDiameter: "20", rearWidth: "9.5", rearOffset: "35",
};

describe("rearAxleSpec", () => {
  test("new 19/20 line: rear is 20x9.5 from its own record", () => {
    const rear = rearAxleSpec(NEW_19_20);
    expect(rear).toEqual({ sku: "TR04209551435BK", diameter: "20", width: "9.5", offset: "35", rearConfirmed: true });
    expect(axleSizeLabel(rear)).toBe("20x9.5");
    expect(isMixedDiameterLine(NEW_19_20)).toBe(true);
  });

  test("legacy 19/20 line without rearDiameter: rear diameter is UNKNOWN, never the front 19", () => {
    const rear = rearAxleSpec(LEGACY_19_20);
    expect(rear.rearConfirmed).toBe(false);
    expect(rear.diameter).toBeUndefined();
    expect(axleSizeLabel(rear)).toBe("");
    expect(isMixedDiameterLine(LEGACY_19_20)).toBe(false);
    expect(REAR_SIZE_UNCONFIRMED_COPY).toMatch(/not confirmed/i);
  });

  test("rear width/offset are not inherited from the front either", () => {
    const rear = rearAxleSpec({ sku: "F", rearSku: "R", staggered: true, diameter: "20", width: "9", offset: "18", rearDiameter: "20" });
    expect(rear.width).toBeUndefined();
    expect(rear.offset).toBeUndefined();
    expect(rear.rearConfirmed).toBe(false);
  });

  test("known 20/20 line stays coherent", () => {
    expect(axleSizeLabel(rearAxleSpec(KNOWN_20_20))).toBe("20x9.5");
    expect(isMixedDiameterLine(KNOWN_20_20)).toBe(false);
  });
});

describe("buildTiresHandoff", () => {
  test("new 19/20 line hands the tires page BOTH axles with the rear's own diameter", () => {
    const h = buildTiresHandoff(NEW_19_20, VEHICLE);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const p = h.params;
    expect(p.get("wheelSku")).toBe("TR04198551435BK");
    expect(p.get("wheelSkuRear")).toBe("TR04209551435BK");
    expect(p.get("wheelDia")).toBe("19");
    expect(p.get("wheelDiaFront")).toBe("19");
    expect(p.get("wheelWidthFront")).toBe("8.5");
    expect(p.get("wheelDiaRear")).toBe("20");
    expect(p.get("wheelWidthRear")).toBe("9.5");
    expect(p.get("setup")).toBe("staggered");
    expect(p.get("trim")).toBe("GT Performance Pack");
  });

  test("legacy 19/20 line with missing rearDiameter: NO tires URL, and nothing that could assert a 19in rear", () => {
    const h = buildTiresHandoff(LEGACY_19_20, VEHICLE);
    expect(h.ok).toBe(false);
    if (h.ok) return;
    expect(h.reason).toBe("rear_unconfirmed");
    // Re-add path goes back to THIS set's PDP with the rear SKU, so the stamped record comes from the catalog.
    expect(h.reAddHref).toMatch(/^\/wheels\/TR04198551435BK\?/);
    expect(h.reAddHref).toContain("rearSku=TR04209551435BK");
    expect(h.reAddHref).not.toContain("wheelDiaRear");
    expect(h.reAddHref).not.toContain("wheelDia=");
  });

  test("known 20/20 line: both axles 20", () => {
    const h = buildTiresHandoff(KNOWN_20_20, VEHICLE);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.params.get("wheelDiaFront")).toBe("20");
    expect(h.params.get("wheelDiaRear")).toBe("20");
    expect(h.params.get("wheelWidthRear")).toBe("9.5");
  });

  test("square line: plain wheelSku/wheelDia/wheelWidth, no staggered params", () => {
    const h = buildTiresHandoff({ sku: "SQ1", diameter: "20", width: "9" }, VEHICLE);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.params.get("wheelDia")).toBe("20");
    expect(h.params.has("wheelSkuRear")).toBe(false);
    expect(h.params.has("setup")).toBe(false);
  });
});

describe("rearWheelSpecForRecord (order-record spec for the rear line)", () => {
  const frontSpec = { diameter: "19", width: "8.5", offset: "35", boltPattern: "5x114.3" };

  test("new 19/20: rear line records 20x9.5", () => {
    expect(rearWheelSpecForRecord(NEW_19_20, frontSpec)).toEqual({ boltPattern: "5x114.3", diameter: "20", width: "9.5", offset: "35", rearConfirmed: true });
  });

  test("legacy 19/20: rear line does NOT inherit the front 19 - diameter absent, rearConfirmed false", () => {
    const spec = rearWheelSpecForRecord(LEGACY_19_20, frontSpec);
    expect(spec.diameter).toBeUndefined();
    expect(spec.width).toBe("9.5");
    expect(spec.rearConfirmed).toBe(false);
    expect(spec.boltPattern).toBe("5x114.3");
  });
});
