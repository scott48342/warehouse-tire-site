/**
 * Included install hardware: the cart's `LUGKIT-<thread>` / `HR-<outer>-<inner>`
 * placeholders are CLAIMS built in the browser. Checkout must derive the thread from
 * the vehicle's fitment record and the ring dimensions from the vehicle hub bore +
 * the selected wheel's catalog bore, then block anything it cannot validate or that
 * disagrees (release review 2026-09-19, Codex browser acceptance follow-up).
 *
 * Also covers the customer-facing responses: hardware problems get their own error
 * code/wording, rejections are sanitised, and a 500 never leaks the raw exception.
 */
import { buildCheckoutLines } from "@/lib/checkout/buildCheckoutLines";
import type { CatalogPriceResolver } from "@/lib/checkout/repriceCatalog";
import type { HardwareSpecResolver, ResolvedHardwareSpec } from "@/lib/checkout/hardwareSpec";
import { parseHubRingPlaceholder, parseLugKitPlaceholder } from "@/lib/checkout/fixedPriceSkus";
import {
  CHECKOUT_FAILED_MESSAGE,
  checkoutFailureResponse,
  rejectedLinesResponse,
  rejectionDetail,
  rejectionErrorCode,
} from "@/lib/checkout/responses";
import type { CartItem } from "@/lib/cart/CartContext";
import { calculateHubRingSpec, formatHubRingSku } from "@/lib/fitment/accessories";
import { calculateAccessoryFitment } from "@/hooks/useAccessoryFitment";

const FRONT = "RC719855114MS15"; // 19x8.5 +15
const REAR = "RC719955114MS20";  // 19x9.5 +20
const OTHER = "KM70020901240";

const price: CatalogPriceResolver = async (sku, ctx) => {
  if (ctx.type === "wheel") {
    if (sku === FRONT) return { sku, unitPrice: 466.7, finish: "Silver / Machined", source: "wsi" };
    if (sku === REAR) return { sku, unitPrice: 505.7, finish: "Silver / Machined", source: "wsi" };
    if (sku === OTHER) return { sku, unitPrice: 300, finish: "Bronze", source: "wheelpros" };
  }
  return null; // placeholders have no catalog row
};

const MUSTANG = { year: "2020", make: "Ford", model: "Mustang", trim: "GT Performance Pack" };
const server = (over: Partial<ResolvedHardwareSpec> = {}): ResolvedHardwareSpec => ({
  vehicleThreadSize: "M14x1.5",
  vehicleSeatType: "conical",
  vehicleHubMm: 70.5,
  wheelBoreMm: 73.1, // -> HR-73.1-70.5 (tenths; whole-mm SKUs are never accepted)
  sources: { vehicle: "vehicle_fitments:complete", wheel: "wsi" },
  ...over,
});
const derive = (spec: ResolvedHardwareSpec): HardwareSpecResolver => async () => spec;

const staggered = (over: Record<string, unknown> = {}): CartItem =>
  ({ type: "wheel", sku: FRONT, rearSku: REAR, brand: "ROHANA", model: "RC7", unitPrice: 486.2, frontUnitPrice: 466.7, rearUnitPrice: 505.7, quantity: 4, staggered: true, vehicle: MUSTANG, ...over } as any);
const lugs = (sku = "LUGKIT-M14x1.5", over: Record<string, unknown> = {}): CartItem =>
  ({ type: "accessory", category: "lug_nut", sku, name: "Standard Lug Kit", unitPrice: 0, quantity: 1, required: true, wheelSku: FRONT, meta: { placeholder: true }, ...over } as any);
const rings = (sku = "HR-73.1-70.5", over: Record<string, unknown> = {}): CartItem =>
  ({ type: "accessory", category: "hub_ring", sku, name: "Hub Rings", unitPrice: 0, quantity: 1, required: true, wheelSku: FRONT, meta: { included: true }, ...over } as any);

const rejections = async (items: CartItem[], spec: ResolvedHardwareSpec) => {
  const r = await buildCheckoutLines(items, price, derive(spec));
  return r.ok ? [] : r.rejected;
};

describe("placeholder parsing", () => {
  it("reads the claimed thread / ring dimensions", () => {
    expect(parseLugKitPlaceholder("LUGKIT-M14x1.5")).toMatchObject({ threadDiameter: 14, threadPitch: 1.5, isMetric: true });
    expect(parseLugKitPlaceholder('LUGKIT-1/2"-20')).toMatchObject({ threadDiameter: 0.5, threadPitch: 20, isMetric: false });
    expect(parseHubRingPlaceholder("HR-73.1-70.5")).toEqual({ outer: 73.1, inner: 70.5, tenths: true });
    expect(parseHubRingPlaceholder("HR-73-71")).toEqual({ outer: 73, inner: 71, tenths: false }); // legacy whole-mm: parses, never validates
    expect(parseHubRingPlaceholder("HR-73")).toBeNull();
  });
});

describe("placeholder hardware is validated against SERVER-derived wheel + vehicle dimensions", () => {
  it("accepts placeholders that match, and records the server-derived spec on the line", async () => {
    const r = await buildCheckoutLines([staggered(), lugs(), rings()], price, derive(server()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const acc = r.lines.filter((l) => (l.meta as any).cartType === "accessory");
    expect(acc.map((l) => [l.sku, l.unitPriceUsd, (l.meta as any).priceSource])).toEqual([
      ["LUGKIT-M14x1.5", 0, "included_hardware"],
      ["HR-73.1-70.5", 0, "included_hardware"],
    ]);
    expect((acc[0].meta as any).hardwareSpec).toMatchObject({ threadSize: "M14x1.5", seatType: "conical", wheelSku: FRONT });
    expect((acc[1].meta as any).hardwareSpec).toMatchObject({ outerDiameterMm: 73.1, innerDiameterMm: 70.5, wheelBoreMm: 73.1, vehicleHubMm: 70.5, wheelSku: FRONT });
    // fulfilment sees the SERVER-derived label, not the client string
    expect(acc[0].name).toBe("Lug Kit M14x1.5 (conical seat) - Included");
    expect(acc[1].name).toBe("Hub Centric Rings 73.1mm -> 70.5mm (set of 4) - Included");
  });

  it("imperial thread: vehicle 1/2\"-20 UNF matches a LUGKIT-1/2\"-20 placeholder", async () => {
    expect(await rejections([staggered(), lugs('LUGKIT-1/2"-20')], server({ vehicleThreadSize: '1/2" - 20 UNF' }))).toEqual([]);
  });

  it("BLOCKS a lug kit whose thread differs from the vehicle's fitment record (client-formatted SKU is not trusted)", async () => {
    const rej = await rejections([staggered(), lugs("LUGKIT-M12x1.5")], server());
    expect(rej).toEqual([{ reason: "hardware_mismatch", sku: "LUGKIT-M12x1.5", name: "Standard Lug Kit", detail: "expected LUGKIT-M14x1.5" }]);
  });

  it("BLOCKS hub rings whose dimensions differ from vehicle hub / catalog wheel bore", async () => {
    // wheel bore per catalog is 78.1, not the 73.1 the cart claims
    expect(await rejections([staggered(), rings("HR-73.1-70.5")], server({ wheelBoreMm: 78.1 }))).toEqual([
      { reason: "hardware_mismatch", sku: "HR-73.1-70.5", name: "Hub Rings", detail: "expected HR-78.1-70.5" },
    ]);
    // vehicle hub per fitment record is 66.1, not 70.5
    expect(await rejections([staggered(), rings("HR-73.1-70.5")], server({ vehicleHubMm: 66.1 }))).toEqual([
      { reason: "hardware_mismatch", sku: "HR-73.1-70.5", name: "Hub Rings", detail: "expected HR-73.1-66.1" },
    ]);
  });

  it("BLOCKS hub rings the geometry does not call for (hub-centric wheel, or wheel bore smaller than hub)", async () => {
    expect((await rejections([staggered(), rings()], server({ wheelBoreMm: 70.5 })))[0]).toMatchObject({ reason: "hardware_mismatch", detail: "no_ring_needed" });
    expect((await rejections([staggered(), rings()], server({ wheelBoreMm: 66.1 })))[0]).toMatchObject({ reason: "hardware_mismatch", detail: "wheel_bore_smaller_than_hub" });
  });

  it("BLOCKS as unverifiable when the server cannot derive the dimensions", async () => {
    expect((await rejections([staggered(), lugs()], server({ vehicleThreadSize: null })))[0]).toMatchObject({ reason: "hardware_unverifiable", detail: "vehicle_thread_unknown" });
    expect((await rejections([staggered(), rings()], server({ vehicleHubMm: null })))[0]).toMatchObject({ reason: "hardware_unverifiable", detail: "vehicle_hub_unknown" });
    expect((await rejections([staggered(), rings()], server({ wheelBoreMm: null })))[0]).toMatchObject({ reason: "hardware_unverifiable", detail: "wheel_bore_unknown" });
    // wheel line sold without a vehicle: nothing to validate the thread against
    expect((await rejections([staggered({ vehicle: undefined }), lugs()], server()))[0]).toMatchObject({ reason: "hardware_unverifiable", detail: "vehicle_missing" });
  });

  it("BLOCKS hardware that does not belong to a wheel set in the order", async () => {
    expect((await rejections([staggered(), lugs("LUGKIT-M14x1.5", { wheelSku: "GHOST" })], server()))[0]).toMatchObject({ reason: "hardware_unverifiable", detail: "wheel_not_in_order" });
    // two wheel sets and the hardware names neither: ambiguous
    const two = [staggered(), { type: "wheel", sku: OTHER, brand: "KMC", model: "KM700", unitPrice: 300, quantity: 4, vehicle: MUSTANG } as any, lugs("LUGKIT-M14x1.5", { wheelSku: undefined })];
    expect((await rejections(two, server()))[0]).toMatchObject({ reason: "hardware_unverifiable", detail: "wheel_ambiguous" });
    // hardware may reference the REAR sku of a staggered set
    expect(await rejections([staggered(), lugs("LUGKIT-M14x1.5", { wheelSku: REAR })], server())).toEqual([]);
  });

  it("passes the wheel set's FRONT sku and vehicle to the resolver", async () => {
    const calls: unknown[] = [];
    const spy: HardwareSpecResolver = async (input) => { calls.push(input); return server(); };
    await buildCheckoutLines([staggered(), rings()], price, spy);
    expect(calls).toEqual([{ wheelSku: FRONT, vehicle: MUSTANG }]);
  });

  it("wheel/tire price authority is unchanged: staggered set still splits 2+2 at server prices", async () => {
    const r = await buildCheckoutLines([staggered({ unitPrice: 1, frontUnitPrice: 1, rearUnitPrice: 1 })], price, derive(server()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines.map((l) => [l.sku, l.qty, l.unitPriceUsd])).toEqual([[FRONT, 2, 466.7], [REAR, 2, 505.7]]);
  });
});

describe("hub-ring precision: the SKU identifies ONE physical ring (Codex review of 80bf3a69)", () => {
  it("formats tenths of a mm and never rounds to whole mm", () => {
    expect(formatHubRingSku({ outerDiameter: 73.1, innerDiameter: 70.5 })).toBe("HR-73.1-70.5");
    expect(formatHubRingSku({ outerDiameter: 74, innerDiameter: 70.5 })).toBe("HR-74.0-70.5");
    // catalog bores may carry 2 decimals; canonical form rounds to the tenth
    expect(formatHubRingSku({ outerDiameter: 73.12, innerDiameter: 70.48 })).toBe("HR-73.1-70.5");
  });

  it("collision regression: physically different rings that round to the same whole mm get DIFFERENT SKUs", () => {
    const a = calculateHubRingSpec(70.5, 73.1)!; // 73.1 -> 70.5
    const b = calculateHubRingSpec(71.4, 72.6)!; // 72.6 -> 71.4 : both used to become HR-73-71
    expect(`HR-${a.outerDiameter.toFixed(0)}-${a.innerDiameter.toFixed(0)}`).toBe("HR-73-71");
    expect(`HR-${b.outerDiameter.toFixed(0)}-${b.innerDiameter.toFixed(0)}`).toBe("HR-73-71");
    expect(formatHubRingSku(a)).toBe("HR-73.1-70.5");
    expect(formatHubRingSku(b)).toBe("HR-72.6-71.4");
    expect(formatHubRingSku(a)).not.toBe(formatHubRingSku(b));
  });

  it("BLOCKS a whole-mm placeholder even when its rounded digits agree with the derived ring", async () => {
    // 73.1 -> 70.5 rounds to 73-71, but HR-73-71 could equally be the 72.6 -> 71.4 ring
    expect(await rejections([staggered(), rings("HR-73-71")], server())).toEqual([
      { reason: "hardware_mismatch", sku: "HR-73-71", name: "Hub Rings", detail: "expected HR-73.1-70.5" },
    ]);
    // and the other ring that collides on whole mm is rejected against this vehicle/wheel too
    expect(await rejections([staggered(), rings("HR-72.6-71.4")], server())).toEqual([
      { reason: "hardware_mismatch", sku: "HR-72.6-71.4", name: "Hub Rings", detail: "expected HR-73.1-70.5" },
    ]);
  });

  it("BLOCKS a tenth-of-a-mm disagreement on either dimension", async () => {
    expect(await rejections([staggered(), rings("HR-73.2-70.5")], server())).toEqual([
      { reason: "hardware_mismatch", sku: "HR-73.2-70.5", name: "Hub Rings", detail: "expected HR-73.1-70.5" },
    ]);
    expect(await rejections([staggered(), rings("HR-73.1-70.6")], server())).toEqual([
      { reason: "hardware_mismatch", sku: "HR-73.1-70.6", name: "Hub Rings", detail: "expected HR-73.1-70.5" },
    ]);
  });

  it("accepts when the derived dimensions round to the claimed tenth, and stamps the unrounded inputs for fulfilment", async () => {
    const r = await buildCheckoutLines([staggered(), rings("HR-73.1-70.5")], price, derive(server({ wheelBoreMm: 73.12, vehicleHubMm: 70.48 })));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ring = r.lines.find((l) => l.sku === "HR-73.1-70.5")!;
    expect((ring.meta as any).hardwareSpec).toEqual({
      outerDiameterMm: 73.1,
      innerDiameterMm: 70.5,
      wheelBoreMm: 73.12,
      vehicleHubMm: 70.48,
      wheelSku: FRONT,
      sources: { vehicle: "vehicle_fitments:complete", wheel: "wsi" },
    });
    expect(ring.name).toBe("Hub Centric Rings 73.1mm -> 70.5mm (set of 4) - Included");
  });

  it("end-to-end parity: the cart generator emits exactly the SKU the server expects for the same wheel + vehicle", async () => {
    // client side (wheels page / cart): fitment DB profile + selected wheel's bore
    const client = calculateAccessoryFitment(
      { threadSize: "M14x1.5", seatType: "conical", centerBoreMm: 70.5, boltPattern: "5x114.3" },
      { sku: FRONT, centerBore: 73.1, seatType: "conical", boltPattern: "5x114.3" },
    );
    const ringItem = client.requiredItems.find((i) => i.category === "hub_ring")!;
    const lugItem = client.requiredItems.find((i) => i.category === "lug_nut")!;
    expect(ringItem.sku).toBe("HR-73.1-70.5");
    expect(lugItem.sku).toBe("LUGKIT-M14x1.5");
    // server side: same vehicle hub + catalog bore -> accepts those exact SKUs
    const r = await buildCheckoutLines([staggered(), { ...lugItem, wheelSku: FRONT } as any, { ...ringItem, wheelSku: FRONT } as any], price, derive(server()));
    expect(r.ok).toBe(true);
  });
});

describe("customer-facing checkout responses", () => {
  it("hardware problems get their own code + wording; other rejections stay line_unpriceable", () => {
    const hw = [{ reason: "hardware_mismatch" as const, sku: "HR-73.1-70.5", name: "Hub Rings", detail: "expected HR-78.1-70.5" }];
    expect(rejectionErrorCode(hw)).toBe("hardware_unverified");
    expect(rejectionDetail(hw)).toMatch(/doesn't match your selected wheels and vehicle/);
    const unv = [{ reason: "hardware_unverifiable" as const, sku: "LUGKIT-M14x1.5", name: "Lugs", detail: "vehicle_thread_unknown" }];
    expect(rejectionDetail(unv)).toMatch(/couldn't confirm the included install hardware/);
    const rear = [{ reason: "rear_unresolved" as const, sku: "NOPE", axle: "rear" as const, name: "RC7" }];
    expect(rejectionErrorCode(rear)).toBe("line_unpriceable");
    expect(rejectionDetail(rear)).toMatch(/rear wheels of a staggered set/);
  });

  it("409 body is sanitised (no server `detail` per line) and carries the hardware code", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const res = rejectedLinesResponse("test", [
      { reason: "hardware_mismatch", sku: "HR-73.1-70.5", name: "Hub Rings", detail: "expected HR-78.1-70.5" },
      { reason: "rear_unresolved", sku: "NOPE", axle: "rear", name: "RC7" },
    ]);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("hardware_unverified");
    expect(body.rejected).toEqual([
      { reason: "hardware_mismatch", sku: "HR-73.1-70.5", name: "Hub Rings" },
      { reason: "rear_unresolved", sku: "NOPE", axle: "rear", name: "RC7" },
    ]);
    expect(JSON.stringify(body)).not.toContain("expected HR-78.1-70.5");
    warn.mockRestore();
  });

  it("500 body is generic with a reference id; the raw error only reaches the server log", async () => {
    const logged: unknown[][] = [];
    const err = jest.spyOn(console, "error").mockImplementation((...a) => { logged.push(a); });
    const res = checkoutFailureResponse("test", new Error("cannot execute CREATE TABLE in a read-only transaction"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: "checkout_failed", detail: CHECKOUT_FAILED_MESSAGE });
    expect(body.ref).toMatch(/^chk_/);
    expect(JSON.stringify(body)).not.toMatch(/CREATE TABLE|read-only/);
    expect(logged.length).toBe(1);
    expect(String(logged[0][0])).toContain(body.ref);
    expect(String((logged[0][1] as Error).message)).toContain("CREATE TABLE");
    err.mockRestore();
  });
});
