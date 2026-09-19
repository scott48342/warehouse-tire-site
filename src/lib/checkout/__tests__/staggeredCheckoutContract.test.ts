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
import { buildCheckoutLines } from "@/lib/checkout/buildCheckoutLines";
import type { CatalogPriceResolver } from "@/lib/checkout/repriceCatalog";

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

  it("square wheel line: server-priced, quantity preserved; accessory keeps client $0", async () => {
    const square: CartWheelItem = { type: "wheel", sku: FRONT, brand: "KMC", model: "KM700", unitPrice: 250, quantity: 4, source: "wheelpros" };
    const lugs: CartItem = { type: "accessory", sku: "LUG-1", brand: "Gorilla", model: "Lug Nuts", unitPrice: 0, quantity: 1, required: true, category: "lug-nuts" } as any;
    const r = await buildCheckoutLines([square, lugs], resolver);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines[0]).toMatchObject({ sku: FRONT, qty: 4, unitPriceUsd: 300 });
    expect(r.lines[1]).toMatchObject({ sku: "LUG-1", qty: 1, unitPriceUsd: 0 });
    expect(r.lines[1].meta?.required).toBe(true);
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
