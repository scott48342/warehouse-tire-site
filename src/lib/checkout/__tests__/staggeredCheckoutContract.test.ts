/**
 * Mocked end-to-end contract for a staggered wheel set (safety review Q1-1..Q1-5,
 * Q7-2; 2026-09-19). No live Stripe, no live supplier, no DB.
 *
 *   /wheels card state -> buildSelectedWheel -> cart line identity/edits
 *   -> buildCheckoutLines (server re-price, 2+2 split, rejections)
 *   -> order snapshot -> extractItemsBySupplier (what the supplier PO would contain)
 */
import { buildSelectedWheel } from "@/components/WheelsGridWithSelection";
import { cartLineKey, isFixedQuantityLine, type CartItem, type CartWheelItem } from "@/lib/cart/CartContext";
import { buildCheckoutLines as buildCheckoutLinesRaw } from "@/lib/checkout/buildCheckoutLines";
import type { CatalogPriceResolver } from "@/lib/checkout/repriceCatalog";
import type { HardwareSpecResolver } from "@/lib/checkout/hardwareSpec";

// supplierOrderService pulls in pg + supplier clients at module load; stub them.
jest.mock("pg", () => ({ __esModule: true, default: { Pool: jest.fn() } }));
jest.mock("@/lib/usautoforce/client", () => ({ placeOrder: jest.fn(), getOrderStatus: jest.fn() }));
jest.mock("@/lib/wheelpros/orderClient", () => ({ placeWheelProsOrder: jest.fn(), trackWheelProsOrder: jest.fn() }));
jest.mock("@/lib/usautoforce/brandCodes", () => ({ getUSAFBrandCode: () => undefined }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { extractItemsBySupplier } = require("@/lib/suppliers/supplierOrderService");

const FRONT = "KM70020901240"; // 20x9  +18 Bronze
const REAR = "KM70021001240";  // 20x10 +18 Bronze
const REAR_SILVER = "KM70021001235";

const catalog: Record<string, { price: number; finish: string }> = {
  [FRONT]: { price: 300, finish: "Bronze" },
  [REAR]: { price: 340, finish: "Bronze" },
  [REAR_SILVER]: { price: 340, finish: "Silver / Machined" },
};

const resolver: CatalogPriceResolver = async (sku) => {
  const hit = catalog[sku];
  return hit ? { sku, unitPrice: hit.price, finish: hit.finish, source: "wheelpros" } : null;
};

/** Vehicle the wheel lines in this suite are sold for; what the server would derive for it. */
const VEHICLE = { year: "2024", make: "Chevrolet", model: "Silverado 1500", trim: "LT" };
const hardware: HardwareSpecResolver = async () => ({
  vehicleThreadSize: "M14x1.5",
  vehicleSeatType: "conical",
  vehicleHubMm: 66.1,
  wheelBoreMm: 73.1, // -> HR-73.1-66.1 (tenths)
  sources: { vehicle: "vehicle_fitments:complete", wheel: "wheelpros" },
});
/** Existing contract tests run with the server agreeing with the cart's placeholders. */
const buildCheckoutLines = (items: CartItem[], r: CatalogPriceResolver) => buildCheckoutLinesRaw(items, r, hardware);

const baseWheel = {
  sku: FRONT,
  finish: "Bronze",
  diameter: "20",
  width: "9",
  offset: "18",
  boltPattern: "6x139.7",
  centerbore: "106.1",
  imageUrl: "https://img/front.png",
  price: 300,
  fitmentClass: "specfit" as const,
  pair: {
    staggered: true,
    front: { sku: FRONT, diameter: "20", width: "9", offset: "18", finish: "Bronze", price: 300 },
    rear: { sku: REAR, diameter: "20", width: "10", offset: "18", finish: "Bronze", price: 340 },
  },
};

const cardState = {
  sku: FRONT,
  finish: "Bronze",
  price: 300,
  imageUrl: "https://img/front.png",
  pair: baseWheel.pair,
  setPrice: 1280,
  staggered: true,
};

function toCartLine(sel: NonNullable<ReturnType<typeof buildSelectedWheel>>): CartWheelItem {
  return {
    type: "wheel",
    sku: sel.sku,
    rearSku: sel.rearSku,
    brand: sel.brand,
    model: sel.model,
    finish: sel.finish,
    rearFinish: sel.rearFinish,
    diameter: sel.diameter,
    width: sel.width,
    rearWidth: sel.rearWidth,
    offset: sel.offset,
    rearOffset: sel.rearOffset,
    unitPrice: Math.round((sel.setPrice / 4) * 100) / 100,
    frontUnitPrice: sel.frontUnitPrice,
    rearUnitPrice: sel.rearUnitPrice,
    quantity: 4,
    staggered: true,
    source: "wheelpros",
    vehicle: VEHICLE,
  };
}

describe("/wheels card -> selection (buildSelectedWheel)", () => {
  it("staggered: 2 front + 2 rear from the card's pair, never 4 x front", () => {
    const sel = buildSelectedWheel(baseWheel, "KMC", "KM700", cardState)!;
    expect(sel).not.toBeNull();
    expect(sel.sku).toBe(FRONT);
    expect(sel.rearSku).toBe(REAR);
    expect(sel.setPrice).toBe(1280); // 2*300 + 2*340, not 4*300 = 1200
    expect(sel.frontUnitPrice).toBe(300);
    expect(sel.rearUnitPrice).toBe(340);
    expect(sel.rearWidth).toBe("10");
    expect(sel.finish).toBe("Bronze");
    expect(sel.rearFinish).toBe("Bronze");
  });

  it("refuses a pair whose front SKU is a different variant than the displayed SKU (Q1-3)", () => {
    const silverFront = { ...baseWheel, sku: "KM70020901235", finish: "Silver / Machined" };
    // card shows Silver front but the grid item still carries the Bronze base pair
    const sel = buildSelectedWheel(silverFront, "KMC", "KM700", {
      ...cardState, sku: "KM70020901235", finish: "Silver / Machined", pair: baseWheel.pair,
    });
    expect(sel).toBeNull();
  });

  it("refuses a rear in another finish and refuses an unpriced rear (Q1-5)", () => {
    const badFinish = { ...baseWheel.pair, rear: { ...baseWheel.pair.rear, sku: REAR_SILVER, finish: "Silver / Machined" } };
    expect(buildSelectedWheel(baseWheel, "KMC", "KM700", { ...cardState, pair: badFinish })).toBeNull();
    const noPrice = { ...baseWheel.pair, rear: { ...baseWheel.pair.rear, price: null } };
    expect(buildSelectedWheel(baseWheel, "KMC", "KM700", { ...cardState, pair: noPrice, setPrice: null })).toBeNull();
  });

  it("square set still prices 4 x unit (non-staggered regression)", () => {
    const sq = { ...baseWheel, pair: undefined };
    const sel = buildSelectedWheel(sq, "KMC", "KM700", { sku: FRONT, price: 300, finish: "Bronze", setPrice: 1200, staggered: false })!;
    expect(sel.staggered).toBe(false);
    expect(sel.rearSku).toBeUndefined();
    expect(sel.setPrice).toBe(1200);
  });

  // 2026-09-20 (Codex): the cart's fitVerified is the SERVER's per-SKU `certified`
  // verdict carried through the card, never derived from fitmentClass or the badge.
  it("carries the server certification verdict; absent/false => not verified, whatever the fit class says", () => {
    const certified = buildSelectedWheel({ ...baseWheel, fitCertified: true }, "KMC", "KM700", cardState)!;
    expect(certified.fitCertified).toBe(true);
    // surefit geometry alone is NOT a verified fit (certification may be blocked server-side)
    const surefitOnly = buildSelectedWheel({ ...baseWheel, fitmentClass: "surefit" }, "KMC", "KM700", cardState)!;
    expect(surefitOnly.fitCertified).toBe(false);
    const blocked = buildSelectedWheel({ ...baseWheel, fitmentClass: "surefit", fitCertified: false }, "KMC", "KM700", cardState)!;
    expect(blocked.fitCertified).toBe(false);
    const sq = buildSelectedWheel({ ...baseWheel, pair: undefined, fitCertified: true }, "KMC", "KM700", { sku: FRONT, price: 300, finish: "Bronze", setPrice: 1200, staggered: false })!;
    expect(sq.fitCertified).toBe(true);
  });
});

describe("cart line identity / edits", () => {
  const sel = buildSelectedWheel(baseWheel, "KMC", "KM700", cardState)!;
  const staggeredLine = toCartLine(sel);
  const squareLine: CartWheelItem = { type: "wheel", sku: FRONT, brand: "KMC", model: "KM700", unitPrice: 300, quantity: 4 };

  it("square and staggered lines with the same front SKU never merge (Q1-4)", () => {
    expect(cartLineKey(squareLine)).not.toBe(cartLineKey(staggeredLine));
  });
  it("staggered line is a fixed 2+2 (quantity locked)", () => {
    expect(isFixedQuantityLine(staggeredLine)).toBe(true);
    expect(isFixedQuantityLine(squareLine)).toBe(false);
  });
  it("cart total for the staggered line equals 2 x front + 2 x rear", () => {
    expect(staggeredLine.unitPrice * staggeredLine.quantity).toBeCloseTo(1280, 2);
  });
});

describe("checkout -> snapshot -> supplier PO", () => {
  const sel = buildSelectedWheel(baseWheel, "KMC", "KM700", cardState)!;
  const line = toCartLine(sel);

  it("splits a staggered line into front x2 + rear x2 with server prices", async () => {
    const r = await buildCheckoutLines([line], resolver);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines).toHaveLength(2);
    const [f, b] = r.lines;
    expect(f.sku).toBe(FRONT); expect(f.qty).toBe(2); expect(f.unitPriceUsd).toBe(300);
    expect(b.sku).toBe(REAR);  expect(b.qty).toBe(2); expect(b.unitPriceUsd).toBe(340);
    expect(f.meta?.axle).toBe("front"); expect(b.meta?.axle).toBe("rear");
    expect(f.meta?.staggeredSetId).toBe(b.meta?.staggeredSetId);
    expect(b.meta?.spec?.width).toBe("10");
    const total = r.lines.reduce((s, l) => s + l.unitPriceUsd * l.qty, 0);
    expect(total).toBe(1280);
  });

  it("charges the SERVER price when the client price was tampered (Q7-2)", async () => {
    const tampered: CartWheelItem = { ...line, unitPrice: 1, frontUnitPrice: 1, rearUnitPrice: 1 };
    const r = await buildCheckoutLines([tampered], resolver);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines.map((l) => l.unitPriceUsd)).toEqual([300, 340]);
    expect(r.repriced.length).toBe(2);
  });

  it("forces 2+2 even if the client sent quantity 6 on a staggered line", async () => {
    const r = await buildCheckoutLines([{ ...line, quantity: 6 }], resolver);
    expect(r.ok && r.lines.map((l) => l.qty)).toEqual([2, 2]);
  });

  it("rejects when the rear SKU cannot be priced (no $0, no front fallback)", async () => {
    const r = await buildCheckoutLines([{ ...line, rearSku: "NOPE" }], resolver);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejected[0]).toMatchObject({ reason: "rear_unresolved", sku: "NOPE", axle: "rear" });
  });

  it("rejects when the front SKU cannot be priced, and when finishes differ", async () => {
    const r1 = await buildCheckoutLines([{ ...line, sku: "NOPE" }], resolver);
    expect(!r1.ok && r1.rejected[0].reason).toBe("unpriceable");
    const r2 = await buildCheckoutLines([{ ...line, rearSku: REAR_SILVER }], resolver);
    expect(!r2.ok && r2.rejected[0].reason).toBe("finish_mismatch");
  });

  it("square wheel line: server-priced, quantity preserved; placeholder lug kit is included at $0", async () => {
    const square: CartWheelItem = { type: "wheel", sku: FRONT, brand: "KMC", model: "KM700", unitPrice: 250, quantity: 4, source: "wheelpros", vehicle: VEHICLE };
    const lugs: CartItem = { type: "accessory", sku: "LUGKIT-M14x1.5", brand: "Gorilla", model: "Lug Nuts", unitPrice: 0, quantity: 1, required: true, category: "lug-nuts" } as any;
    const r = await buildCheckoutLines([square, lugs], resolver);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0]).toMatchObject({ sku: FRONT, qty: 4, unitPriceUsd: 300 });
    expect(r.lines[1]).toMatchObject({ sku: "LUGKIT-M14x1.5", qty: 1, unitPriceUsd: 0 });
    expect((r.lines[1].meta as any).priceSource).toBe("included_hardware");
  });

  it("supplier PO built from the snapshot orders 2 front + 2 rear (was FRONT x4)", async () => {
    const r = await buildCheckoutLines([line], resolver);
    if (!r.ok) throw new Error("unexpected rejection");
    const snapshot = {
      customer: { firstName: "T", lastName: "T" },
      lines: r.lines,
    } as any;
    const bySupplier = extractItemsBySupplier(snapshot) as Map<string, Array<{ partNumber: string; quantity: number }>>;
    const wp = [...bySupplier.values()].flat();
    expect(wp.map((x) => [x.partNumber, x.quantity])).toEqual([[FRONT, 2], [REAR, 2]]);
    expect(wp.some((x) => x.partNumber === FRONT && x.quantity === 4)).toBe(false);
  });
});

describe("accessory price authority (release review 2026-09-19)", () => {
  // Accessory catalog the server would see: a $38 lug kit, a $1,895 lift kit.
  const LIFT = "RC-LIFTKIT-6IN";
  const LUGS = "GOR-LUG-14x1.5";
  // Catalog category travels with the server price; the client's `category` is never consulted.
  const accResolver: CatalogPriceResolver = async (sku, ctx) => {
    if (ctx.type === "accessory") {
      if (sku === LIFT) return { sku, unitPrice: 1895, category: "suspension", source: "suspension_db" };
      if (sku === LUGS) return { sku, unitPrice: 38, category: "lug_nut", source: "accessories_db" };
      if (sku === "TPMS-SENSOR-UNIVERSAL") return { sku, unitPrice: 49.99, source: "fixed" };
      return null;
    }
    return resolver(sku, ctx);
  };
  const acc = (over: Record<string, unknown>): CartItem =>
    ({ type: "accessory", brand: "X", model: "Acc", quantity: 1, required: false, category: "other", ...over } as any);
  /** A square wheel set the server can price (1 wheel set => 1 free lug kit + 1 free hub-ring set). */
  const wheelSet = (quantity = 4): CartItem =>
    ({ type: "wheel", sku: FRONT, brand: "KMC", model: "KM700", unitPrice: 300, quantity, source: "wheelpros", vehicle: VEHICLE } as any);
  const accLines = (r: Awaited<ReturnType<typeof buildCheckoutLines>>) =>
    r.ok ? r.lines.filter((l) => (l.meta as any).cartType === "accessory").map((l) => [l.sku, l.unitPriceUsd, (l.meta as any).priceSource]) : r;

  it("charges the catalog price when a lift kit's client price is tampered to $1", async () => {
    const r = await buildCheckoutLines([acc({ sku: LIFT, unitPrice: 1, category: "suspension" })], accResolver);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0]).toMatchObject({ sku: LIFT, unitPriceUsd: 1895, qty: 1 });
    expect(r.repriced).toEqual([{ sku: LIFT, clientUnitPrice: 1, serverUnitPrice: 1895 }]);
  });

  it("a lift kit relabelled as required $0 lug nuts is still charged catalog price", async () => {
    const r = await buildCheckoutLines([acc({ sku: LIFT, unitPrice: 0, required: true, category: "lug_nut" })], accResolver);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0]).toMatchObject({ sku: LIFT, unitPriceUsd: 1895 });
  });

  it("genuine included hardware WITH a wheel set: catalog lug kit (<= $75, catalog category) and placeholder hub rings stay $0", async () => {
    const r = await buildCheckoutLines(
      [wheelSet(), acc({ sku: LUGS, unitPrice: 0, required: true, category: "lug_nut" }), acc({ sku: "HR-73.1-66.1", unitPrice: 0, required: true, category: "hub-rings" })],
      accResolver,
    );
    expect(accLines(r)).toEqual([
      [LUGS, 0, "included_hardware"],
      ["HR-73.1-66.1", 0, "included_hardware"],
    ]);
  });

  it("entitlement ignores client flags: a plain $0 catalog lug kit with a wheel set is included even without required=true", async () => {
    const r = await buildCheckoutLines([wheelSet(), acc({ sku: LUGS, unitPrice: 0, required: false, category: "other" })], accResolver);
    expect(accLines(r)).toEqual([[LUGS, 0, "included_hardware"]]);
  });

  it("NO qualifying wheel set: a cheap catalog lug kit sent as required $0 is charged catalog price", async () => {
    const r = await buildCheckoutLines([acc({ sku: LUGS, unitPrice: 0, required: true, category: "lug_nut" })], accResolver);
    expect(accLines(r)).toEqual([[LUGS, 38, "accessories_db"]]);
    if (r.ok) expect(r.repriced).toEqual([{ sku: LUGS, clientUnitPrice: 0, serverUnitPrice: 38 }]);
  });

  it("NO qualifying wheel set: placeholder hardware ($0, no catalog price) is rejected as hardware_not_entitled, not sold for $0", async () => {
    const r = await buildCheckoutLines([acc({ sku: "LUGKIT-M14x1.5", unitPrice: 0, required: true, category: "lug_nut" })], accResolver);
    expect(r).toEqual({ ok: false, rejected: [{ reason: "hardware_not_entitled", sku: "LUGKIT-M14x1.5", name: "Acc" }] });
    const tires = await buildCheckoutLines(
      [{ type: "tire", sku: "T1", brand: "B", model: "M", size: "275/55R20", unitPrice: 200, quantity: 4 } as any, acc({ sku: "HR-73.1-66.1", unitPrice: 0, required: true, category: "hub_ring" })],
      async (sku, ctx) => (ctx.type === "tire" ? { sku, unitPrice: 200, source: "tireweb" } : accResolver(sku, ctx)),
    );
    expect(tires.ok).toBe(false); // tires alone are not a wheel set
  });

  it("unknown hardware SKU is ALWAYS rejected, even sent as required $0 lug nuts with a wheel set", async () => {
    for (const sku of ["GHOST-LUGS", "LUGKIT-", "LUGKIT-NOTATHREAD", "HR-ABC", "HR-73"]) {
      const r = await buildCheckoutLines([wheelSet(), acc({ sku, unitPrice: 0, required: true, category: "lug_nut" })], accResolver);
      expect(r).toEqual({ ok: false, rejected: [{ reason: "unpriceable", sku, name: "Acc" }] });
    }
  });

  it("a known catalog SKU relabelled as required $0 hardware is charged when its CATALOG category is not hardware", async () => {
    // client says lug_nut/required/$0; catalog says it is a $1,895 suspension kit
    const r = await buildCheckoutLines([wheelSet(), acc({ sku: LIFT, unitPrice: 0, required: true, category: "lug_nut" })], accResolver);
    expect(accLines(r)).toEqual([[LIFT, 1895, "suspension_db"]]);
  });

  it("excess quantity / extra lines beyond the wheel-set entitlement are not free", async () => {
    // quantity 3 lug kits for one wheel set: over quota -> whole line charged catalog price
    const q = await buildCheckoutLines([wheelSet(), acc({ sku: LUGS, unitPrice: 0, required: true, category: "lug_nut", quantity: 3 })], accResolver);
    expect(accLines(q)).toEqual([[LUGS, 38, "accessories_db"]]);
    // a second lug-kit line for the same single wheel set: first free, second charged
    const two = await buildCheckoutLines(
      [wheelSet(), acc({ sku: LUGS, unitPrice: 0, required: true, category: "lug_nut" }), acc({ sku: LUGS, unitPrice: 0, required: true, category: "lug_nut" })],
      accResolver,
    );
    expect(accLines(two)).toEqual([[LUGS, 0, "included_hardware"], [LUGS, 38, "accessories_db"]]);
    // placeholder over quota (2 hub-ring sets, 1 wheel set): the excess is rejected, never $0
    const ph = await buildCheckoutLines(
      [wheelSet(), acc({ sku: "HR-73.1-66.1", unitPrice: 0, category: "hub_ring" }), acc({ sku: "HR-73.1-66.1", unitPrice: 0, category: "hub_ring" })],
      accResolver,
    );
    expect(ph).toEqual({ ok: false, rejected: [{ reason: "hardware_not_entitled", sku: "HR-73.1-66.1", name: "Acc" }] });
    // two wheel sets (8 wheels) entitle two lug kits
    const eight = await buildCheckoutLines([wheelSet(8), acc({ sku: LUGS, unitPrice: 0, quantity: 2 })], accResolver);
    expect(accLines(eight)).toEqual([[LUGS, 0, "included_hardware"]]);
  });

  it("a $0 client price only picks WHICH eligible line takes the free slot; a paid line never displaces it", async () => {
    const r = await buildCheckoutLines(
      [wheelSet(), acc({ sku: LUGS, unitPrice: 38, category: "lug_nut" }), acc({ sku: "LUGKIT-M14x1.5", unitPrice: 0, category: "lug_nut" })],
      accResolver,
    );
    expect(accLines(r)).toEqual([["LUGKIT-M14x1.5", 0, "included_hardware"], [LUGS, 38, "accessories_db"]]);
  });

  it("rejects an accessory the catalog cannot price (no client-price fallback) and one without a SKU", async () => {
    const r1 = await buildCheckoutLines([acc({ sku: "UNKNOWN-1", unitPrice: 12.5 })], accResolver);
    expect(r1).toEqual({ ok: false, rejected: [{ reason: "unpriceable", sku: "UNKNOWN-1", name: "Acc" }] });
    const r2 = await buildCheckoutLines([acc({ sku: "", unitPrice: 12.5 })], accResolver);
    expect(r2.ok).toBe(false);
  });

  it("TPMS synthetic SKU is charged the fixed server price, not the client price", async () => {
    const r = await buildCheckoutLines([acc({ sku: "TPMS-SENSOR-UNIVERSAL", unitPrice: 0.99, quantity: 4, category: "tpms" })], accResolver);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0]).toMatchObject({ unitPriceUsd: 49.99, qty: 4 });
  });

  it("road hazard is recomputed from SERVER tire prices: 20%/tire, $15 floor, qty = tires in order", async () => {
    // Tire resolver: TIRE-A prices at $200 server-side regardless of the $50 the client sends.
    const tireResolver: CatalogPriceResolver = async (sku, ctx) =>
      ctx.type === "tire" && sku === "TIRE-A" ? { sku, unitPrice: 200, source: "tireweb" } : accResolver(sku, ctx);
    const tire: CartItem = { type: "tire", sku: "TIRE-A", brand: "Toyo", model: "AT3", size: "275/65R18", unitPrice: 50, quantity: 4 } as any;
    const rh = acc({ sku: "RH-PROTECT-2YR", unitPrice: 10, quantity: 1, category: "other" });
    const r = await buildCheckoutLines([tire, rh], tireResolver);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const line = r.lines.find((l) => l.sku === "RH-PROTECT-2YR")!;
    expect(line).toMatchObject({ unitPriceUsd: 40, qty: 4 }); // 20% of $200, x4 tires
    expect(r.repriced).toEqual(expect.arrayContaining([{ sku: "RH-PROTECT-2YR", clientUnitPrice: 10, serverUnitPrice: 40 }]));

    // $15 floor on cheap tires
    const cheap: CatalogPriceResolver = async (sku, ctx) => (ctx.type === "tire" ? { sku, unitPrice: 60, source: "tireweb" } : accResolver(sku, ctx));
    const r2 = await buildCheckoutLines([tire, rh], cheap);
    if (!r2.ok) throw new Error("unexpected rejection");
    expect(r2.lines.find((l) => l.sku === "RH-PROTECT-2YR")).toMatchObject({ unitPriceUsd: 15, qty: 4 });

    // no tires -> nothing to protect -> rejected, not silently charged
    const r3 = await buildCheckoutLines([rh], accResolver);
    expect(r3.ok).toBe(false);
  });

  it("tire line keeps the legacy size-prefixed name and tire meta (payment-intent parity)", async () => {
    const tireResolver: CatalogPriceResolver = async (sku, ctx) => (ctx.type === "tire" ? { sku, unitPrice: 200, source: "tireweb" } : null);
    const tire: CartItem = { type: "tire", sku: "TIRE-A", brand: "Toyo", model: "AT3", size: "275/65R18", unitPrice: 200, quantity: 4, loadIndex: 116, speedRating: "T" } as any;
    const r = await buildCheckoutLines([tire], tireResolver);
    if (!r.ok) throw new Error("unexpected rejection");
    expect(r.lines[0].name).toBe("275/65R18 Toyo AT3");
    expect(r.lines[0].meta).toMatchObject({ tireSize: "275/65R18", loadIndex: 116, speedRating: "T", brand: "Toyo" });
  });
});

describe("both Stripe routes go through the server price authority (wiring guard)", () => {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  for (const route of ["create-checkout-session", "create-payment-intent"]) {
    it(`${route} builds lines via buildCheckoutLines (+ hardware validation), never reads the client unitPrice, never leaks raw errors`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), "src/app/api/stripe", route, "route.ts"), "utf8");
      expect(src).toMatch(/buildCheckoutLines\(items, defaultCatalogPriceResolver, defaultHardwareSpecResolver\)/);
      expect(src).not.toMatch(/Number\(i\.unitPrice/);
      // rejections and failures go through the shared, sanitised responses
      expect(src).toMatch(/rejectedLinesResponse\(/);
      expect(src).toMatch(/checkoutFailureResponse\(/);
      expect(src).not.toMatch(/error: e\?\.message/);
    });
  }
});
