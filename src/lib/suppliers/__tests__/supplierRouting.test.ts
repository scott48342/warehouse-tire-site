/**
 * @jest-environment node
 *
 * Supplier routing trust (Codex review of b147249c, 2026-09-20).
 *
 * extractItemsBySupplier used to group on the CLIENT's meta.source - a shopper could steer a
 * WheelPros wheel into the US AutoForce auto-order path (or vice versa) by editing the cart
 * payload. Routing now reads the catalog's supplierSource (meta.catalog, written server-side
 * by the price resolver). Legacy snapshots without meta.catalog are grouped on meta.source for
 * visibility but are never auto-ordered.
 *
 * Mocked grouping/placement only - the supplier clients are jest mocks; nothing is ordered.
 */
import type { QuoteSnapshot, QuoteLine } from "@/lib/quotes";

jest.mock("@/lib/usautoforce/client", () => ({
  placeOrder: jest.fn(async () => ({ success: true, orderNumber: "HDS-MOCK" })),
  getOrderStatus: jest.fn(),
}));
jest.mock("@/lib/wheelpros/orderClient", () => ({
  placeWheelProsOrder: jest.fn(async () => ({ success: true, orderNumber: "WP-MOCK" })),
  trackWheelProsOrder: jest.fn(),
}));

import { placeOrder as placeUSAF } from "@/lib/usautoforce/client";
import { placeWheelProsOrder } from "@/lib/wheelpros/orderClient";
import {
  extractItemsBySupplier,
  resolveLineSupplierSource,
  resolveLineIdentity,
  canAutoOrder,
  autoOrderHoldReasons,
  processSupplierOrders,
  type SupplierOrderItem,
} from "@/lib/suppliers/supplierOrderService";

const usaf = placeUSAF as jest.Mock;
const wp = placeWheelProsOrder as jest.Mock;

// NOTE: every line carries a CLIENT brand claim ("General") and a brand-looking name so the tests
// prove neither is ever used for identity.
const line = (sku: string, cartType: "wheel" | "tire", meta: Record<string, unknown>, qty = 4): QuoteLine => ({
  kind: "product", name: `General Altimax ${sku} 245/45R18`, sku, unitPriceUsd: 100, qty, taxable: true,
  meta: { cartType, brand: "General", brandName: "General", ...meta },
});
// catalog tire block with identity, as resolveTirePrice writes it
const tireCat = (supplierSource: string, extra: Record<string, unknown> = {}) => ({ sizeLabel: "245/45R18", supplierSource, brand: "Toyo", brandCode: "TOY", ...extra });
const snap = (lines: QuoteLine[]): QuoteSnapshot => ({ lines, totals: { subtotalUsd: 0, taxUsd: 0, totalUsd: 0 } } as unknown as QuoteSnapshot);
const shipTo: Parameters<typeof processSupplierOrders>[3] = { name: "T", address1: "1", city: "Pontiac", state: "MI", zip: "48340" };

beforeEach(() => { usaf.mockClear(); wp.mockClear(); });

describe("resolveLineSupplierSource", () => {
  it("catalog supplierSource wins; the client's meta.source is ignored", () => {
    expect(resolveLineSupplierSource(line("W1", "wheel", { source: "usautoforce", catalog: { supplierSource: "wheelpros" } })))
      .toEqual({ source: "wheelpros", sourceTrust: "catalog" });
  });
  it("catalog block present but no supplierSource -> unknown (never the client's claim)", () => {
    expect(resolveLineSupplierSource(line("W1", "wheel", { source: "wheelpros", catalog: {} })))
      .toEqual({ source: "unknown", sourceTrust: "unknown" });
    expect(resolveLineSupplierSource(line("W1", "wheel", { source: "wheelpros", catalog: { supplierSource: "  " } })))
      .toEqual({ source: "unknown", sourceTrust: "unknown" });
  });
  it("legacy snapshot (no catalog block) falls back to meta.source but is flagged legacy_client", () => {
    expect(resolveLineSupplierSource(line("T1", "tire", { source: "tireweb:usautoforce" })))
      .toEqual({ source: "tireweb:usautoforce", sourceTrust: "legacy_client" });
    expect(resolveLineSupplierSource(line("T1", "tire", {}))).toEqual({ source: "unknown", sourceTrust: "unknown" });
  });
});

describe("extractItemsBySupplier - groups on the catalog, not the client", () => {
  it("TAMPER: client says usautoforce on a WheelPros wheel and wheelpros on an ATD tire -> catalog grouping", () => {
    const m = extractItemsBySupplier(snap([
      line("W1", "wheel", { source: "usautoforce", catalog: { supplierSource: "wheelpros" } }),
      line("T1", "tire", { source: "wheelpros", catalog: { sizeLabel: "245/45R18", supplierSource: "tireweb:atd" } }),
      line("T2", "tire", { source: "tireweb:atd", catalog: { sizeLabel: "245/45R18", supplierSource: "usautoforce" } }),
    ]));
    expect([...m.keys()].sort()).toEqual(["atd", "usautoforce", "wheelpros"]);
    expect(m.get("wheelpros")!.map((i) => i.partNumber)).toEqual(["W1"]);
    expect(m.get("atd")!.map((i) => i.partNumber)).toEqual(["T1"]);
    expect(m.get("usautoforce")!.map((i) => i.partNumber)).toEqual(["T2"]);
    for (const items of m.values()) for (const i of items) expect(i.sourceTrust).toBe("catalog");
  });
  it("legacy lines group on meta.source with legacy_client trust; catalog-less new lines are unknown", () => {
    const m = extractItemsBySupplier(snap([
      line("L1", "tire", { source: "tireweb:usautoforce" }),
      line("N1", "wheel", { source: "wheelpros", catalog: {} }),
    ]));
    expect(m.get("usautoforce")![0]).toMatchObject({ partNumber: "L1", sourceTrust: "legacy_client" });
    expect(m.get("unknown")![0]).toMatchObject({ partNumber: "N1", sourceTrust: "unknown" });
  });
  it("only wheel/tire lines are routed; accessories/hardware are not", () => {
    const m = extractItemsBySupplier(snap([
      { kind: "product", name: "Lug kit", sku: "LUG", unitPriceUsd: 0, qty: 1, taxable: false, meta: { cartType: "accessory", catalog: { supplierSource: "wheelpros" } } },
    ]));
    expect(m.size).toBe(0);
  });
});

describe("resolveLineIdentity - brand / USAF lineCode from the catalog only", () => {
  it("catalog brandCode wins; client meta.brand / brandName / name are ignored", () => {
    expect(resolveLineIdentity(line("T1", "tire", { brand: "General", catalog: tireCat("usautoforce") })))
      .toEqual({ brand: "Toyo", lineCode: "TOY", identityTrust: "catalog" });
  });
  it("catalog brand without a code maps through the USAF brand table (catalog name, not the client's)", () => {
    expect(resolveLineIdentity(line("T1", "tire", { brand: "General", catalog: tireCat("usautoforce", { brandCode: undefined, brand: "BFGoodrich" }) })))
      .toEqual({ brand: "BFGoodrich", lineCode: "BFG", identityTrust: "catalog" });
  });
  it("catalog block with no brand info -> none, even though the client claims 'General' and the name says General", () => {
    expect(resolveLineIdentity(line("T1", "tire", { catalog: { sizeLabel: "245/45R18", supplierSource: "usautoforce" } })))
      .toEqual({ identityTrust: "none" });
  });
  it("legacy snapshot (no catalog block) -> none; the client brand is never a fallback", () => {
    expect(resolveLineIdentity(line("T1", "tire", { source: "tireweb:usautoforce", brand: "General" }))).toEqual({ identityTrust: "none" });
  });
  it("extractItemsBySupplier carries only the catalog identity", () => {
    const m = extractItemsBySupplier(snap([
      line("T1", "tire", { catalog: tireCat("usautoforce") }),
      line("L1", "tire", { source: "tireweb:usautoforce", brand: "General" }),
    ]));
    const items = m.get("usautoforce")!;
    expect(items.find((i) => i.partNumber === "T1")).toMatchObject({ brand: "Toyo", lineCode: "TOY", identityTrust: "catalog" });
    expect(items.find((i) => i.partNumber === "L1")).toMatchObject({ brand: undefined, lineCode: undefined, identityTrust: "none", sourceTrust: "legacy_client" });
  });
});

describe("canAutoOrder", () => {
  const item = (sourceTrust: SupplierOrderItem["sourceTrust"], identityTrust: SupplierOrderItem["identityTrust"] = "catalog", lineCode: string | null = "TOY"): SupplierOrderItem =>
    ({ partNumber: "X", quantity: 4, source: "wheelpros", sourceTrust, lineName: "x", identityTrust, lineCode: lineCode ?? undefined });
  it("true only for an auto-order supplier whose EVERY item is catalog-routed", () => {
    expect(canAutoOrder("wheelpros", [item("catalog")])).toBe(true);
    expect(canAutoOrder("usautoforce", [item("catalog")])).toBe(true);
    expect(canAutoOrder("wheelpros", [item("catalog"), item("legacy_client")])).toBe(false);
    expect(canAutoOrder("usautoforce", [item("legacy_client")])).toBe(false);
    expect(canAutoOrder("usautoforce", [item("unknown")])).toBe(false);
    expect(canAutoOrder("atd", [item("catalog")])).toBe(false);
    expect(canAutoOrder("wheelpros", [])).toBe(false);
  });
  it("US AutoForce additionally requires a catalog-derived lineCode on every item; WheelPros (partNumber-keyed) does not", () => {
    expect(canAutoOrder("usautoforce", [item("catalog", "none", null)])).toBe(false);
    expect(canAutoOrder("usautoforce", [item("catalog", "catalog", null)])).toBe(false);
    expect(canAutoOrder("usautoforce", [item("catalog"), item("catalog", "none", null)])).toBe(false);
    expect(canAutoOrder("wheelpros", [item("catalog", "none", null)])).toBe(true);
    expect(autoOrderHoldReasons("usautoforce", [item("catalog", "none", null), item("legacy_client")]))
      .toEqual(["X lineCode=missing", "X routing=legacy_client"]);
    expect(autoOrderHoldReasons("usautoforce", [item("catalog")])).toEqual([]);
  });
});

describe("processSupplierOrders - mocked clients + db; nothing is ordered for non-catalog routing", () => {
  const dbCalls: unknown[][] = [];
  const db = { query: jest.fn(async (_sql: string, params?: unknown[]) => { if (params) dbCalls.push(params); return { rows: [] }; }) } as unknown as Parameters<typeof processSupplierOrders>[0] & { query: jest.Mock };
  beforeEach(() => { dbCalls.length = 0; db.query.mockClear(); });

  it("catalog-routed WheelPros wheels -> API order placed (mock), status placed", async () => {
    const res = await processSupplierOrders(db, "WTD-1", snap([line("W1", "wheel", { source: "usautoforce", catalog: { supplierSource: "wheelpros" } })]), shipTo);
    expect(wp).toHaveBeenCalledTimes(1);
    expect(usaf).not.toHaveBeenCalled();
    expect(res[0]).toMatchObject({ supplier: "wheelpros", success: true });
    const insert = dbCalls.find((p) => p[0] === "WTD-1")!;
    expect(insert[1]).toBe("wheelpros");
    expect(insert[4]).toBe("placed");
  });

  it("LEGACY snapshot routed to usautoforce by the client's meta.source -> held for review, USAF client NEVER called", async () => {
    const res = await processSupplierOrders(db, "WTD-2", snap([line("T1", "tire", { source: "tireweb:usautoforce" })]), shipTo);
    expect(usaf).not.toHaveBeenCalled();
    expect(wp).not.toHaveBeenCalled();
    expect(res[0]).toMatchObject({ supplier: "usautoforce", success: true, supplierPO: "MANUAL-REVIEW-WTD-2" });
    expect(res[0].errorMessage).toContain("legacy_client");
    const insert = dbCalls.find((p) => p[0] === "WTD-2")!;
    expect(insert[4]).toBe("manual");
    expect(insert[3]).toBe("MANUAL-REVIEW-WTD-2");
  });

  it("mixed group: one catalog + one legacy item for the same auto-order supplier -> whole group held", async () => {
    await processSupplierOrders(db, "WTD-3", snap([
      line("T1", "tire", { catalog: tireCat("usautoforce") }),
      line("T2", "tire", { source: "usautoforce" }),
    ]), shipTo);
    expect(usaf).not.toHaveBeenCalled();
    const insert = dbCalls.find((p) => p[0] === "WTD-3")!;
    expect(insert[4]).toBe("manual");
  });

  it("catalog-routed USAF tires WITH catalog lineCode -> API order (mock) carries the CATALOG code, not the client's brand", async () => {
    const res = await processSupplierOrders(db, "WTD-5", snap([line("T1", "tire", { brand: "General", catalog: tireCat("usautoforce") })]), shipTo, { usafBranch: "4101" });
    expect(usaf).toHaveBeenCalledTimes(1);
    const req = usaf.mock.calls[0][0] as { items: Array<{ partNumber: string; lineCode: string }> };
    expect(req.items).toEqual([{ partNumber: "T1", quantity: 4, lineCode: "TOY" }]);
    expect(res[0]).toMatchObject({ supplier: "usautoforce", success: true });
  });

  it("TAMPER: catalog-routed USAF tire whose catalog has NO brand code -> held for review even though the client supplied brand 'General' (GEN) and a General-looking name", async () => {
    const res = await processSupplierOrders(db, "WTD-6", snap([
      line("T1", "tire", { brand: "General", brandName: "General", catalog: { sizeLabel: "245/45R18", supplierSource: "usautoforce" } }),
    ]), shipTo);
    expect(usaf).not.toHaveBeenCalled();
    expect(res[0]).toMatchObject({ supplier: "usautoforce", supplierPO: "MANUAL-REVIEW-WTD-6" });
    expect(res[0].errorMessage).toContain("T1 lineCode=missing");
    const insert = dbCalls.find((p) => p[0] === "WTD-6")!;
    expect(insert[4]).toBe("manual");
    const persisted = JSON.parse(insert[5] as string) as SupplierOrderItem[];
    expect(persisted[0]).toMatchObject({ identityTrust: "none" });
    expect(persisted[0].lineCode).toBeUndefined();
  });

  it("non-auto supplier (ATD) stays manual with the plain MANUAL PO, regardless of trust", async () => {
    const res = await processSupplierOrders(db, "WTD-4", snap([line("T1", "tire", { catalog: { sizeLabel: "245/45R18", supplierSource: "tireweb:atd" } })]), shipTo);
    expect(res[0]).toMatchObject({ supplier: "atd", supplierPO: "MANUAL-WTD-4" });
    expect(usaf).not.toHaveBeenCalled(); expect(wp).not.toHaveBeenCalled();
  });
});
