/**
 * 2026-09-20 (Codex): a persisted cart / saved quote must never keep a fit certification that
 * was minted under older rules. Prices, SKUs and quantities are preserved; only the claim drops.
 */
import { FIT_EVIDENCE_VERSION, sanitizePersistedCartItems, type CartWheelItem, type CartTireItem } from "./CartContext";

const legacyRidler = {
  type: "wheel",
  sku: "652-2865GBD",
  rearSku: "652-2165GBD",
  brand: "RIDLER",
  model: "652",
  finish: "Gloss Black",
  diameter: "20",
  width: "8.5",
  offset: 0,
  boltPattern: "5x114.3",
  unitPrice: 340.77,
  frontUnitPrice: 336.12,
  rearUnitPrice: 345.41,
  quantity: 4,
  fitmentClass: "specfit",
  fitVerified: true, // minted before the OE-offset provenance fix - obsolete
  staggered: true,
  vehicle: { year: 2020, make: "Ford", model: "Mustang", trim: "GT Performance Pack" },
} as unknown as CartWheelItem;

type FitLine = CartWheelItem | CartTireItem;

describe("sanitizePersistedCartItems", () => {
  it("REGRESSION: legacy fitVerified:true without the current evidence version is invalidated, not trusted", () => {
    const [out] = sanitizePersistedCartItems([legacyRidler]) as CartWheelItem[];
    expect(out.fitVerified).toBe(false);
    expect(out.fitRevalidate).toBe(true);
    // cart contents untouched
    expect(out.sku).toBe("652-2865GBD");
    expect(out.rearSku).toBe("652-2165GBD");
    expect(out.frontUnitPrice).toBe(336.12);
    expect(out.rearUnitPrice).toBe(345.41);
    expect(out.quantity).toBe(4);
    expect(out.vehicle?.trim).toBe("GT Performance Pack");
  });

  it("a stale version string is treated like a missing one", () => {
    const [out] = sanitizePersistedCartItems([{ ...legacyRidler, fitVerifiedVersion: "2026-09-18.audit" }]) as CartWheelItem[];
    expect(out.fitVerified).toBe(false);
    expect(out.fitRevalidate).toBe(true);
  });

  it("a certification stamped with the current evidence version is kept", () => {
    const [out] = sanitizePersistedCartItems([{ ...legacyRidler, fitVerifiedVersion: FIT_EVIDENCE_VERSION }]) as CartWheelItem[];
    expect(out.fitVerified).toBe(true);
    expect(out.fitRevalidate).toBeUndefined();
  });

  it("unverified lines pass through unchanged; tires with a legacy claim are also invalidated", () => {
    const tire = { type: "tire", sku: "T1", brand: "X", model: "Y", size: "255/40R19", unitPrice: 200, quantity: 4, fitVerified: true } as unknown as CartTireItem;
    const out = sanitizePersistedCartItems([{ ...legacyRidler, fitVerified: false }, tire]) as FitLine[];
    expect(out[0].fitVerified).toBe(false);
    expect(out[0].fitRevalidate).toBeUndefined();
    expect(out[1].fitVerified).toBe(false);
    expect(out[1].fitRevalidate).toBe(true);
  });

  it("never produces a NaN cart: non-array input and non-object entries are dropped", () => {
    expect(sanitizePersistedCartItems({ items: [legacyRidler] })).toEqual([]);
    expect(sanitizePersistedCartItems([[legacyRidler], null, "x", legacyRidler]).length).toBe(1);
  });
});
