/**
 * Two-cent staggered total (Codex release review 2026-09-20, "totals").
 *
 * The cart stores a BLENDED unitPrice for a staggered set: round((2*front + 2*rear) / 4).
 * Every client sum used unitPrice * quantity, so the cart/checkout showed 1363.08 for the
 * RIDLER 652 pair while the server (buildCheckoutLines: 2 x front + 2 x rear lines) charges
 * the exact 1363.06. cartLineTotal() is now the single client money rule.
 */
import { cartLineTotal, type CartWheelItem } from "@/lib/cart/CartContext";
import { validatePackage } from "@/lib/package/validation";

const money = (n: number) => Math.round(n * 100) / 100;

const ridler: CartWheelItem = {
  type: "wheel",
  sku: "652-2865GBD",
  rearSku: "652-2165GBD",
  brand: "RIDLER",
  model: "652",
  finish: "Gloss Black",
  diameter: "20",
  width: "8.5",
  rearWidth: "10",
  offset: "0",
  rearOffset: "0",
  boltPattern: "5x114.3",
  unitPrice: money((2 * 336.12 + 2 * 345.41) / 4), // 340.77 blended
  frontUnitPrice: 336.12,
  rearUnitPrice: 345.41,
  quantity: 4,
  staggered: true,
} as unknown as CartWheelItem;

describe("cartLineTotal - exact staggered money", () => {
  it("REGRESSION: RIDLER 652 pair totals 1363.06, not blended 340.77 x 4 = 1363.08", () => {
    expect(ridler.unitPrice).toBe(340.77);
    expect(money(ridler.unitPrice * ridler.quantity)).toBe(1363.08); // the old, wrong client number
    expect(cartLineTotal(ridler)).toBe(1363.06);                     // what the server charges
  });

  it("matches the server's 2 x front + 2 x rear line math for arbitrary prices", () => {
    for (const [f, r] of [[466.7, 505.7], [199.99, 219.99], [123.45, 123.46], [1000.01, 999.99]]) {
      const set = money(2 * f + 2 * r);
      const item = { ...ridler, unitPrice: money(set / 4), frontUnitPrice: f, rearUnitPrice: r } as CartWheelItem;
      expect(cartLineTotal(item)).toBe(set);
    }
  });

  it("square lines and accessories keep unitPrice x quantity", () => {
    expect(cartLineTotal({ type: "wheel", unitPrice: 466.7, quantity: 4 })).toBe(1866.8);
    expect(cartLineTotal({ type: "accessory", unitPrice: 0, quantity: 1 })).toBe(0);
    expect(cartLineTotal({ type: "tire", unitPrice: 189.5, quantity: 2 })).toBe(379);
  });

  it("a staggered line missing one axle price falls back to unitPrice x quantity (never NaN)", () => {
    const partial = { ...ridler, rearUnitPrice: undefined } as unknown as CartWheelItem;
    expect(cartLineTotal(partial)).toBe(1363.08);
    expect(Number.isFinite(cartLineTotal({ type: "wheel", unitPrice: NaN, quantity: 4 }))).toBe(true);
  });

  it("REGRESSION (Codex): null / blank / negative / NaN axle prices never take the exact-split branch", () => {
    // Number(null) === 0 and Number("") === 0 - a legacy persisted line must not undercount one axle.
    const fallback = 1363.08;
    for (const bad of [null, "", "   ", -1, NaN, Infinity, "abc"]) {
      const frontBad = { ...ridler, frontUnitPrice: bad } as unknown as CartWheelItem;
      const rearBad = { ...ridler, rearUnitPrice: bad } as unknown as CartWheelItem;
      expect(cartLineTotal(frontBad)).toBe(fallback);
      expect(cartLineTotal(rearBad)).toBe(fallback);
      // and never 2 * 336.12 + 2 * 0 = 672.24 / 2 * 0 + 2 * 345.41 = 690.82
      expect(cartLineTotal(frontBad)).not.toBe(690.82);
      expect(cartLineTotal(rearBad)).not.toBe(672.24);
    }
  });

  it("a legitimate zero axle price (comped rear pair) is preserved, and numeric strings are accepted", () => {
    expect(cartLineTotal({ ...ridler, rearUnitPrice: 0 } as CartWheelItem)).toBe(672.24);
    const strings = { ...ridler, frontUnitPrice: "336.12", rearUnitPrice: "345.41" } as unknown as CartWheelItem;
    expect(cartLineTotal(strings)).toBe(1363.06);
  });

  it("validatePackage subtotal uses the exact set price", () => {
    const v = validatePackage([ridler]);
    expect(v.totals.subtotal).toBe(1363.06);
  });
});
