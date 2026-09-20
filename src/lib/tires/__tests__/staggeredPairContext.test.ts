/**
 * 2026-09-20 (Codex live check): "Select Staggered Set" -> tire PDP -> Add put FOUR FRONT tires in
 * the cart (LXST201935050 245/35R19 x4, $487.12) for a 19/20 wheel set; the bare-URL redirect to
 * /tires/km/<sku>?size=... dropped rearSku/rearSize/vehicle. Contract: a pair PDP sells exactly
 * 2 front + 2 rear at each axle's own price, or nothing.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  appendForwardedPairParams,
  incompleteStaggeredTireSet,
  loadStaggeredTireSet,
  readStaggeredPairIntent,
  readStaggeredPairParams,
  resolveRearTire,
  staggeredSetTotal,
  tireSellPrice,
  toStaggeredTireSet,
} from "@/lib/tires/staggeredPairContext";
import { buildCheckoutLines } from "@/lib/checkout/buildCheckoutLines";
import { cartLineTotal, type CartTireItem } from "@/lib/cart/CartContext";

jest.mock("pg", () => ({ __esModule: true, default: { Pool: jest.fn() } }));
jest.mock("@/lib/usautoforce/client", () => ({ placeOrder: jest.fn(), getOrderStatus: jest.fn() }));
jest.mock("@/lib/wheelpros/orderClient", () => ({ placeWheelProsOrder: jest.fn(), trackWheelProsOrder: jest.fn() }));
jest.mock("@/lib/usautoforce/brandCodes", () => ({ getUSAFBrandCode: () => undefined }));

// The observed live link
const SP = {
  size: "245/35R19", year: "2020", make: "Ford", model: "Mustang",
  staggeredPair: "LXST201935050:LXST202035050", rearSku: "LXST202035050", rearSize: "275/35R20",
};

describe("readStaggeredPairParams / redirect forwarding", () => {
  test("reads the pair from the results link", () => {
    expect(readStaggeredPairParams(SP)).toEqual({ rearSku: "LXST202035050", rearSize: "275/35R20", pairId: "LXST201935050:LXST202035050" });
  });
  test("no pair without BOTH rearSku and rearSize", () => {
    expect(readStaggeredPairParams({ rearSku: "X" })).toBeNull();
    expect(readStaggeredPairParams({ rearSize: "275/35R20" })).toBeNull();
    expect(readStaggeredPairParams({})).toBeNull();
  });

  describe("pair INTENT fails closed when incomplete (Codex review: a dropped param must not re-enable square Add x4)", () => {
    const feedNever = (async () => { throw new Error("must not be called"); }) as unknown as typeof fetch;
    test("no pair params at all -> no set (square PDP behaves normally)", async () => {
      expect(readStaggeredPairIntent({ size: "245/35R19", year: "2020" })).toEqual({ kind: "none" });
      expect(await loadStaggeredTireSet({ size: "245/35R19" }, "http://x", feedNever)).toBeNull();
    });
    test.each([
      ["rearSku missing", { staggeredPair: "A:B", rearSize: "275/35R20" }, ["rearSku"]],
      ["rearSize missing", { staggeredPair: "A:B", rearSku: "LXST202035050" }, ["rearSize"]],
      ["only staggeredPair", { staggeredPair: "A:B" }, ["rearSku", "rearSize"]],
      ["only rearSku", { rearSku: "LXST202035050" }, ["rearSize"]],
      ["only rearSize", { rearSize: "275/35R20" }, ["rearSku"]],
      ["blank rearSize", { rearSku: "LXST202035050", rearSize: " " }, ["rearSize"]],
    ])("%s -> incomplete set: not sellable, incomplete=true, no feed call", async (_label, sp, missing) => {
      const intent = readStaggeredPairIntent(sp as any);
      expect(intent.kind).toBe("incomplete");
      if (intent.kind !== "incomplete") return;
      expect(intent.missing).toEqual(missing);
      const set = await loadStaggeredTireSet(sp as any, "http://x", feedNever);
      expect(set).not.toBeNull();
      expect(set!.sellable).toBe(false);
      expect(set!.incomplete).toBe(true);
      expect(set!.rearUnitPrice).toBeNull();
      expect(incompleteStaggeredTireSet(intent, sp as any).sellable).toBe(false);
    });
    test("complete pair goes through resolution; unresolved rear -> not sellable, incomplete=false", async () => {
      const empty = (async () => ({ ok: true, json: async () => ({ results: [] }) })) as unknown as typeof fetch;
      const set = await loadStaggeredTireSet(SP, "http://x", empty);
      expect(set).toMatchObject({ rearSku: "LXST202035050", rearSize: "275/35R20", rearResolved: false, sellable: false });
      expect(set!.incomplete).toBeUndefined();
    });
  });
  test("the bare-URL cache redirect keeps vehicle + pair (the live hop that lost them)", () => {
    const out = appendForwardedPairParams("/tires/km/LXST201935050?size=245%2F35R19", SP);
    const p = new URLSearchParams(out.split("?")[1]);
    expect(out.startsWith("/tires/km/LXST201935050?")).toBe(true);
    expect(p.get("size")).toBe("245/35R19");
    expect(p.get("rearSku")).toBe("LXST202035050");
    expect(p.get("rearSize")).toBe("275/35R20");
    expect(p.get("staggeredPair")).toBe("LXST201935050:LXST202035050");
    expect(p.get("year")).toBe("2020");
    expect(p.get("model")).toBe("Mustang");
  });
  test("square PDP redirect unchanged apart from vehicle params", () => {
    expect(appendForwardedPairParams("/tires/ABC?source=tireweb&size=225%2F60R16", { size: "225/60R16" })).toBe("/tires/ABC?source=tireweb&size=225%2F60R16");
  });
});

describe("rear resolution -> StaggeredTireSet (fail closed)", () => {
  const pair = readStaggeredPairParams(SP)!;
  const feed = (rows: any[]) => (async () => ({ ok: true, json: async () => ({ results: rows }) })) as unknown as typeof fetch;

  test("rear found with a price -> sellable, prices from the REAR row", async () => {
    const rear = await resolveRearTire(pair, "http://x", feed([{ partNumber: "LXST202035050", size: "275/35R20", brand: "Lexani", price: 135.5, cost: 90 }]));
    const set = toStaggeredTireSet(pair, rear);
    expect(set).toEqual({ rearSku: "LXST202035050", rearSize: "275/35R20", rearUnitPrice: 135.5, rearResolved: true, sellable: true });
    expect(staggeredSetTotal(121.78, 135.5)).toBe(514.56);
  });
  test("rear row present but unpriced -> resolved, NOT sellable", async () => {
    const rear = await resolveRearTire(pair, "http://x", feed([{ partNumber: "LXST202035050", size: "275/35R20" }]));
    const set = toStaggeredTireSet(pair, rear);
    expect(set.rearResolved).toBe(true);
    expect(set.sellable).toBe(false);
  });
  test("rear not in feed (or feed error) -> not resolved, NOT sellable; never falls back to the front", async () => {
    const set1 = toStaggeredTireSet(pair, await resolveRearTire(pair, "http://x", feed([{ partNumber: "LXST201935050", size: "245/35R19", price: 121.78 }])));
    expect(set1).toMatchObject({ rearResolved: false, sellable: false, rearUnitPrice: null, rearSku: "LXST202035050" });
    const failing = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    const set2 = toStaggeredTireSet(pair, await resolveRearTire(pair, "http://x", failing));
    expect(set2.sellable).toBe(false);
  });
  test("sell-price rule matches the PDPs (price when > cost, else cost + 50)", () => {
    expect(tireSellPrice({ price: 130, cost: 90 })).toBe(130);
    expect(tireSellPrice({ price: 80, cost: 90 })).toBe(140);
    expect(tireSellPrice({ cost: 71.78 })).toBe(121.78);
    expect(tireSellPrice({})).toBeNull();
  });
});

describe("staggered tire cart line -> checkout: 2 front + 2 rear at each axle's server price", () => {
  const line: CartTireItem = {
    type: "tire", sku: "LXST201935050", rearSku: "LXST202035050", brand: "Lexani", model: "LX-TWENTY",
    size: "245/35R19", rearSize: "275/35R20", unitPrice: 128.64, frontUnitPrice: 121.78, rearUnitPrice: 135.5,
    quantity: 4, staggered: true, source: "tireweb:km",
  };
  const resolver = async (sku: string, ctx?: { size?: string }) =>
    sku === "LXST201935050" ? { sku, unitPrice: 121.78, source: "tireweb:km", shipping: { sizeLabel: ctx?.size, supplierSource: "tireweb:km" } }
    : sku === "LXST202035050" ? { sku, unitPrice: 135.5, source: "tireweb:km", shipping: { sizeLabel: ctx?.size, supplierSource: "tireweb:km" } }
    : null;
  const hardware = async () => ({ vehicleThreadSize: "M14x1.5", vehicleSeatType: "conical", vehicleHubMm: 70.5, wheelBoreMm: 73.1, sources: {} });

  test("cart total is exact 2F + 2R, not 4 x front", () => {
    expect(cartLineTotal(line)).toBe(514.56);
    expect(cartLineTotal({ ...line, rearSku: undefined, frontUnitPrice: undefined, rearUnitPrice: undefined, unitPrice: 121.78 })).toBe(487.12);
  });

  test("checkout splits into front x2 (245/35R19) + rear x2 (275/35R20) with server prices", async () => {
    const r = await buildCheckoutLines([line], resolver as any, hardware as any);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const tires = r.lines.filter((l) => l.meta?.cartType === "tire");
    expect(tires).toHaveLength(2);
    const [f, b] = tires;
    expect(f.sku).toBe("LXST201935050"); expect(f.qty).toBe(2); expect(f.unitPriceUsd).toBe(121.78); expect(f.meta?.axle).toBe("front");
    expect(b.sku).toBe("LXST202035050"); expect(b.qty).toBe(2); expect(b.unitPriceUsd).toBe(135.5); expect(b.meta?.axle).toBe("rear");
    expect(b.meta?.spec?.size).toBe("275/35R20");
    expect(tires.reduce((s, l) => s + l.unitPriceUsd * l.qty, 0)).toBe(514.56);
  });
});

describe("PDP wiring (source pins)", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf-8");
  test("main tire PDP: pair context, redirect forwarding, both buy boxes, no sticky square button on a pair PDP", () => {
    const src = read("app/tires/[sku]/page.tsx");
    expect(src).toMatch(/const staggeredSet: StaggeredTireSet \| null = await loadStaggeredTireSet\(sp, getBaseUrl\(\)\);/);
    expect(src).toMatch(/appendForwardedPairParams\(buildResolvableTireWebPath\(safeSku, cache\.source, cache\.size\), sp\)/);
    expect((src.match(/staggeredSet=\{staggeredSet\}/g) || []).length).toBe(2);
    expect((src.match(/\{!staggeredSet \? <MobileStickyAddToCart/g) || []).length).toBe(2);
  });
  test("KM tire PDP: pair context and StaggeredTireSetBuy; square Add only without a pair", () => {
    const src = read("app/tires/km/[partNumber]/page.tsx");
    expect(src).toMatch(/const staggeredSet: StaggeredTireSet \| null = await loadStaggeredTireSet\(sp, getBaseUrl\(\)\);/);
    expect(src).toMatch(/<StaggeredTireSetBuy/);
    expect(src).toMatch(/\{displayPrice != null && !staggeredSet && \(\s*\n\s*<div className="mt-4">\s*\n\s*<AddTiresToCartButton/);
  });
  test("TireBuyBox: staggered mode renders StaggeredTireSetBuy and hides the square qty picker/Add", () => {
    const src = read("components/TireBuyBox.tsx");
    expect(src).toMatch(/\{staggeredSet \? \(\s*\n\s*<StaggeredTireSetBuy/);
    expect(src).toMatch(/\{hasPrice && !staggeredSet && \(\s*\n\s*<div className="mt-4">\s*\n\s*<QuantitySelector/);
    expect(src).toMatch(/\{hasPrice && !staggeredSet && \(\s*\n\s*<div className="mt-4">\s*\n\s*<AddTiresToCartButton/);
  });
  test("StaggeredTireSetBuy: Add only when sellable; passes rearSku/rearSize/front+rear prices, qty 4", () => {
    const src = read("components/StaggeredTireSetBuy.tsx");
    expect(src).toMatch(/const canSell = !set\.incomplete && set\.sellable && frontUnitPrice != null && frontUnitPrice > 0;/);
    expect(src).toMatch(/rearSku=\{set\.rearSku\}/);
    expect(src).toMatch(/rearSize=\{set\.rearSize\}/);
    expect(src).toMatch(/frontUnitPrice=\{frontUnitPrice as number\}/);
    expect(src).toMatch(/rearUnitPrice=\{set\.rearUnitPrice as number\}/);
    expect(src).toMatch(/quantity=\{4\}/);
    expect(src).toMatch(/data-testid="staggered-set-unavailable"/);
    // identity/price resolution is not wheel compatibility: neutral copy only
    expect(src).not.toMatch(/Sized for your wheels/);
    expect(src).toMatch(/fit not yet confirmed/);
  });
  test("AddTiresToCartButton: local OTD for a staggered set is 2 front (front size) + 2 rear (rear size), not front size x4", () => {
    const src = read("components/AddTiresToCartButton.tsx");
    expect(src).toMatch(/getOutTheDoorTotal\(frontUnitPrice as number, 2, size\) \+ getOutTheDoorTotal\(rearUnitPrice as number, 2, rearSize\)/);
  });
});
