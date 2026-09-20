/**
 * Cart -> quote/Stripe/supplier lines (safety review Q1-1, Q7-2; 2026-09-19).
 *
 * Contract:
 * - A staggered wheel or tire line (`rearSku` set) becomes TWO product lines:
 *   front SKU x2 and rear SKU x2. The order snapshot and every supplier PO
 *   built from it (`extractItemsBySupplier` reads `line.sku` / `line.qty`)
 *   therefore order the rear wheels. Previously the rear SKU was dropped and
 *   the supplier received FRONT x4.
 * - Wheel and tire prices are re-resolved SERVER-SIDE through the catalog
 *   resolver. The client `unitPrice` is only used for a mismatch log. A wheel
 *   or tire SKU (front OR rear) that cannot be priced REJECTS the checkout
 *   (`unpriceable`), it never falls back to the client price or $0.
 * - Accessories are ALSO server-priced (release review 2026-09-19): fixed
 *   synthetic SKUs, the `accessories` table, or `suspension_fitments`. Road
 *   hazard (RH-PROTECT-2YR) is recomputed from the server-priced tire lines.
 *   Included install hardware ($0) is a SERVER entitlement: the hardware kind
 *   comes from the SKU (fitment-engine placeholder format or the catalog's own
 *   category), the free slots from the wheel sets accepted in this order (one
 *   lug kit + one hub-ring set per wheel set), and the price cap from the
 *   catalog. Client `required`/`category`/`unitPrice` never grant it. An
 *   unknown SKU that is not a recognised placeholder is always rejected.
 *   Placeholder DIMENSIONS are validated too (Codex acceptance 2026-09-19):
 *   the thread must equal the VEHICLE's fitment-record thread and the hub-ring
 *   outer/inner must equal the selected WHEEL's catalog bore / the vehicle hub
 *   bore, both derived server-side through `HardwareSpecResolver`. A
 *   placeholder the server cannot derive (`hardware_unverifiable`) or that
 *   disagrees with the server (`hardware_mismatch`) blocks the checkout.
 * - Staggered lines are forced to 2+2 regardless of the client quantity.
 *
 * Pure: no I/O besides the injected resolvers, so it is unit-testable.
 */
import type { QuoteLine } from "@/lib/quotes";
import type { CartItem, CartWheelItem, CartTireItem } from "@/lib/cart/CartContext";
import type { CatalogPriceResolver } from "./repriceCatalog";
import type { HardwareSpecResolver, HardwareSpecVehicle } from "./hardwareSpec";
import { calculateHubRingSpec, formatHubRingMm, formatHubRingSku, formatThreadSize, parseThreadSize } from "@/lib/fitment/accessories";
import {
  INCLUDED_HARDWARE_MAX_UNIT_USD,
  ROAD_HAZARD_SKU,
  includedHardwareKindFromCatalogCategory,
  includedHardwarePlaceholderKind,
  parseHubRingPlaceholder,
  parseLugKitPlaceholder,
  roadHazardPerTireUsd,
  type IncludedHardwareKind,
} from "./fixedPriceSkus";

export type CheckoutLineRejection = {
  /** `hardware_not_entitled`: a $0 placeholder hardware line with no wheel set in the order,
   *  or more free hardware lines/units than the wheel sets entitle.
   *  `hardware_unverifiable`: the server could not derive the vehicle thread / hub bore or the
   *  wheel bore needed to validate a placeholder (no vehicle on the wheel line, wheel not in the
   *  order, fitment record or catalog silent). `hardware_mismatch`: the placeholder's dimensions
   *  differ from what the server derived (`detail` carries the expected placeholder SKU). */
  reason:
    | "unpriceable"
    | "rear_unresolved"
    | "finish_mismatch"
    | "hardware_not_entitled"
    | "hardware_unverifiable"
    | "hardware_mismatch";
  sku: string;
  axle?: "front" | "rear";
  name: string;
  /** Machine-readable cause for `hardware_*` rejections (server-side diagnostics, safe to log). */
  detail?: string;
};

export type BuildCheckoutLinesResult =
  | { ok: true; lines: QuoteLine[]; repriced: Array<{ sku: string; clientUnitPrice: number; serverUnitPrice: number }> }
  | { ok: false; rejected: CheckoutLineRejection[] };

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Order-record metadata for a line. `spec`, `meta`, `source`, `brand` and the tire display
 * fields are copied from the CLIENT for the order snapshot / emails only - they are claims.
 * Nothing that prices, taxes or ships the order may read them: pricing uses `priceSource`
 * and shipping uses `catalog` (CatalogShippingAttrs from the resolver). Re-pricing a line
 * does not make its client metadata authoritative.
 */
function baseMeta(i: any, extra: Record<string, unknown> = {}) {
  return {
    cartType: i.type,
    category: i.category,
    required: !!i.required,
    wheelSku: i.wheelSku,
    spec: i.spec,
    meta: i.meta,
    source: i.source,
    brand: i.brand,
    // Tire-specific fields (email/display; parity with the legacy payment-intent mapper)
    ...(i.type === "tire" ? { tireSize: i.size, loadIndex: i.loadIndex, speedRating: i.speedRating } : {}),
    ...extra,
  };
}

/** "245/65R17 Brand Model" for tires (legacy payment-intent naming), else the plain name. */
function lineName(i: any, name: string) {
  if (i.type === "tire" && i.size) return `${i.size} ${i.brand || ""} ${name}`.trim().replace(/\s+/g, " ");
  return name;
}

export async function buildCheckoutLines(
  items: CartItem[],
  resolvePrice: CatalogPriceResolver,
  resolveHardwareSpec: HardwareSpecResolver,
): Promise<BuildCheckoutLinesResult> {
  const lines: QuoteLine[] = [];
  const rejected: CheckoutLineRejection[] = [];
  const repriced: Array<{ sku: string; clientUnitPrice: number; serverUnitPrice: number }> = [];

  const roadHazard: Array<{ i: any; name: string }> = [];
  // Accessories are priced AFTER the wheel/tire lines so included-hardware entitlement
  // can be derived from the wheel sets the server actually accepted.
  const accessories: Array<{ i: any; name: string; sku: string; clientUnit: number; qtyClient: number }> = [];
  // Wheel sets accepted so far: a staggered pair is one set, a square line is ceil(qty/4).
  let wheelSets = 0;
  // Accepted wheel lines (front SKU, all SKUs in the set, vehicle) for placeholder validation.
  const acceptedWheels: Array<{ frontSku: string; skus: string[]; vehicle: HardwareSpecVehicle | null }> = [];

  for (const raw of items) {
    const i = raw as any;
    const name = lineName(i, String(i.model || i.name || i.sku || "Item").trim());
    const sku = String(i.sku || "").trim() || undefined;
    const clientUnit = Number(i.unitPrice || 0);
    const qtyClient = Math.max(1, Math.trunc(Number(i.quantity || 1)));

    if (i.type !== "wheel" && i.type !== "tire") {
      if (!sku) {
        rejected.push({ reason: "unpriceable", sku: "", name });
        continue;
      }
      if (sku.toUpperCase() === ROAD_HAZARD_SKU) {
        roadHazard.push({ i, name }); // priced after the tire lines are known
        continue;
      }
      accessories.push({ i, name, sku, clientUnit, qtyClient });
      continue;
    }

    if (!sku) {
      rejected.push({ reason: "unpriceable", sku: "", name });
      continue;
    }

    const type = i.type as "wheel" | "tire";
    const size = type === "tire" ? (i as CartTireItem).size : undefined;
    const rearSku = String(i.rearSku || "").trim() || undefined;

    const front = await resolvePrice(sku, { type, size });
    if (!front) {
      rejected.push({ reason: "unpriceable", sku, axle: rearSku ? "front" : undefined, name });
      continue;
    }
    if (Math.abs(front.unitPrice - clientUnit) > 0.005 && !rearSku) {
      repriced.push({ sku, clientUnitPrice: clientUnit, serverUnitPrice: front.unitPrice });
    }

    if (!rearSku) {
      if (type === "wheel") {
        wheelSets += Math.max(1, Math.ceil(qtyClient / 4));
        acceptedWheels.push({ frontSku: sku, skus: [sku], vehicle: (i as CartWheelItem).vehicle ?? null });
      }
      lines.push({
        kind: "product",
        name,
        sku,
        unitPriceUsd: money(front.unitPrice),
        qty: qtyClient,
        taxable: true,
        meta: baseMeta(i, { priceSource: front.source, catalog: front.shipping ?? {}, clientUnitPrice: clientUnit }),
      });
      continue;
    }

    // Staggered: rear must resolve, and for wheels the finish must match the front.
    const rearSize = type === "tire" ? (i as CartTireItem).rearSize : undefined;
    const rear = await resolvePrice(rearSku, { type, size: rearSize || size });
    if (!rear) {
      rejected.push({ reason: "rear_unresolved", sku: rearSku, axle: "rear", name });
      continue;
    }
    if (type === "wheel") {
      const ff = (front.finish || (i as CartWheelItem).finish || "").trim().toLowerCase();
      const rf = (rear.finish || (i as CartWheelItem).rearFinish || "").trim().toLowerCase();
      if (ff && rf && ff !== rf) {
        rejected.push({ reason: "finish_mismatch", sku: rearSku, axle: "rear", name });
        continue;
      }
    }
    const clientFront = Number(i.frontUnitPrice);
    const clientRear = Number(i.rearUnitPrice);
    if (Number.isFinite(clientFront) && Math.abs(front.unitPrice - clientFront) > 0.005) {
      repriced.push({ sku, clientUnitPrice: clientFront, serverUnitPrice: front.unitPrice });
    }
    if (Number.isFinite(clientRear) && Math.abs(rear.unitPrice - clientRear) > 0.005) {
      repriced.push({ sku: rearSku, clientUnitPrice: clientRear, serverUnitPrice: rear.unitPrice });
    }
    const setId = `${sku}+${rearSku}`;
    if (type === "wheel") {
      wheelSets += 1;
      acceptedWheels.push({ frontSku: sku, skus: [sku, rearSku], vehicle: (i as CartWheelItem).vehicle ?? null });
    }
    lines.push({
      kind: "product",
      name: `${name} (front)`,
      sku,
      unitPriceUsd: money(front.unitPrice),
      qty: 2,
      taxable: true,
      meta: baseMeta(i, { axle: "front", staggeredSetId: setId, pairedSku: rearSku, priceSource: front.source, catalog: front.shipping ?? {}, clientUnitPrice: clientUnit }),
    });
    lines.push({
      kind: "product",
      name: `${name} (rear)`,
      sku: rearSku,
      unitPriceUsd: money(rear.unitPrice),
      qty: 2,
      taxable: true,
      meta: baseMeta(i, {
        axle: "rear",
        staggeredSetId: setId,
        pairedSku: sku,
        priceSource: rear.source,
        catalog: rear.shipping ?? {},
        clientUnitPrice: clientUnit,
        // Rear axle specs travel with the rear line for the order record.
        spec: type === "wheel"
          ? { ...(i.spec || {}), width: (i as CartWheelItem).rearWidth ?? i.spec?.width, offset: (i as CartWheelItem).rearOffset ?? i.spec?.offset }
          : { ...(i.spec || {}), size: rearSize ?? i.spec?.size },
        finish: type === "wheel" ? ((i as CartWheelItem).rearFinish ?? (i as CartWheelItem).finish) : undefined,
      }),
    });
  }

  // Accessories. Included-hardware entitlement is SERVER-derived: kind from the SKU
  // (placeholder format or catalog category), slots from the accepted wheel sets,
  // price cap from the catalog. Client `required`/`category`/`unitPrice` never grant
  // it; a client $0 only says which eligible line should take a free slot first.
  const freeSlots: Record<IncludedHardwareKind, number> = { lug_kit: wheelSets, hub_ring: wheelSets, valve_stem: wheelSets };
  const accOrder = accessories
    .map((a, idx) => ({ a, idx }))
    .sort((x, y) => (x.a.clientUnit === 0 ? 0 : 1) - (y.a.clientUnit === 0 ? 0 : 1) || x.idx - y.idx);
  for (const { a } of accOrder) {
    const { i, name, sku, clientUnit, qtyClient } = a;
    const server = await resolvePrice(sku, { type: "accessory" });
    const placeholderKind = includedHardwarePlaceholderKind(sku);
    const kind: IncludedHardwareKind | null =
      placeholderKind ?? (server ? includedHardwareKindFromCatalogCategory(server.category) : null);
    const cheapEnough = server == null || server.unitPrice <= INCLUDED_HARDWARE_MAX_UNIT_USD;
    const entitled = kind != null && cheapEnough && wheelSets > 0 && freeSlots[kind] >= qtyClient;

    if (entitled) {
      // A placeholder (no catalog row) must ALSO match what the server derives for the
      // selected wheel + vehicle; the client-formatted digits are only a claim.
      let hardwareSpec: Record<string, unknown> | undefined;
      // The line name fulfilment sees is SERVER-derived for placeholders; the client's
      // "Hub Rings — Included (73.1mm → 70.5mm)" text is just a display string.
      let lineLabel = name;
      if (placeholderKind && !server) {
        const check = await validatePlaceholderHardware(sku, placeholderKind, i, acceptedWheels, resolveHardwareSpec);
        if (!check.ok) {
          rejected.push({ reason: check.reason, sku, name, detail: check.detail });
          continue;
        }
        hardwareSpec = check.spec;
        if (check.name) lineLabel = check.name;
      }
      freeSlots[kind!] -= qtyClient;
      lines.push({ kind: "product", name: lineLabel, sku, unitPriceUsd: 0, qty: qtyClient, taxable: false, meta: baseMeta(i, { priceSource: "included_hardware", hardwareKind: kind, catalogUnitPrice: server?.unitPrice, wheelSets, ...(hardwareSpec ? { hardwareSpec } : {}) }) });
      continue;
    }
    if (!server) {
      // Recognised placeholder without entitlement (no wheel set / over quota) vs. an unknown SKU.
      rejected.push({ reason: placeholderKind ? "hardware_not_entitled" : "unpriceable", sku, name });
      continue;
    }
    if (Math.abs(server.unitPrice - clientUnit) > 0.005) {
      repriced.push({ sku, clientUnitPrice: clientUnit, serverUnitPrice: server.unitPrice });
    }
    lines.push({ kind: "product", name, sku, unitPriceUsd: money(server.unitPrice), qty: qtyClient, taxable: false, meta: baseMeta(i, { priceSource: server.source, catalog: server.shipping ?? {}, clientUnitPrice: clientUnit }) });
  }

  // Road hazard: 20% of the SERVER tire price per tire ($15 min), one unit per tire
  // actually in the order. Client unit price and quantity are ignored.
  if (roadHazard.length > 0) {
    const tireLines = lines.filter((l) => (l.meta as any)?.cartType === "tire");
    const tireCount = tireLines.reduce((n, l) => n + l.qty, 0);
    const tireSubtotal = tireLines.reduce((n, l) => n + l.unitPriceUsd * l.qty, 0);
    const { i, name } = roadHazard[0];
    if (tireCount === 0) {
      rejected.push({ reason: "unpriceable", sku: ROAD_HAZARD_SKU, name });
    } else {
      const unit = roadHazardPerTireUsd(tireSubtotal, tireCount);
      const clientUnit = Number(i.unitPrice || 0);
      if (Math.abs(unit - clientUnit) > 0.005 || Number(i.quantity) !== tireCount) {
        repriced.push({ sku: ROAD_HAZARD_SKU, clientUnitPrice: clientUnit, serverUnitPrice: unit });
      }
      lines.push({ kind: "product", name, sku: ROAD_HAZARD_SKU, unitPriceUsd: unit, qty: tireCount, taxable: false, meta: baseMeta(i, { priceSource: "computed_road_hazard", clientUnitPrice: clientUnit, tireCount, tireSubtotal: money(tireSubtotal) }) });
    }
  }

  if (rejected.length > 0) return { ok: false, rejected };
  return { ok: true, lines, repriced };
}

type PlaceholderCheck =
  | { ok: true; spec: Record<string, unknown>; name: string }
  | { ok: false; reason: "hardware_unverifiable" | "hardware_mismatch"; detail: string };

/** Hub-ring dimensions agree when they round to the same tenth of a mm. */
const HUB_RING_MATCH_TOLERANCE_MM = 0.05;

/**
 * Compare a placeholder hardware SKU against the SERVER-derived dimensions for the wheel set
 * it belongs to (the accessory's `wheelSku`, else the only accepted set) and that set's vehicle.
 */
async function validatePlaceholderHardware(
  sku: string,
  kind: IncludedHardwareKind,
  i: any,
  acceptedWheels: Array<{ frontSku: string; skus: string[]; vehicle: HardwareSpecVehicle | null }>,
  resolveHardwareSpec: HardwareSpecResolver,
): Promise<PlaceholderCheck> {
  const wantSku = String(i.wheelSku || "").trim().toUpperCase();
  const set = wantSku
    ? acceptedWheels.find((w) => w.skus.some((s) => s.toUpperCase() === wantSku))
    : acceptedWheels.length === 1
      ? acceptedWheels[0]
      : undefined;
  if (!set) return { ok: false, reason: "hardware_unverifiable", detail: wantSku ? "wheel_not_in_order" : "wheel_ambiguous" };
  if (!set.vehicle) return { ok: false, reason: "hardware_unverifiable", detail: "vehicle_missing" };

  const derived = await resolveHardwareSpec({ wheelSku: set.frontSku, vehicle: set.vehicle });

  if (kind === "lug_kit") {
    const claimed = parseLugKitPlaceholder(sku);
    const actual = parseThreadSize(derived.vehicleThreadSize);
    if (!claimed) return { ok: false, reason: "hardware_mismatch", detail: "thread_unparseable" };
    if (!actual) return { ok: false, reason: "hardware_unverifiable", detail: "vehicle_thread_unknown" };
    const same =
      claimed.isMetric === actual.isMetric &&
      Math.abs(claimed.threadDiameter - actual.threadDiameter) < 0.01 &&
      Math.abs(claimed.threadPitch - actual.threadPitch) < 0.01;
    if (!same) return { ok: false, reason: "hardware_mismatch", detail: `expected LUGKIT-${formatThreadSize(actual)}` };
    const threadLabel = formatThreadSize(actual);
    return {
      ok: true,
      spec: { threadSize: threadLabel, seatType: derived.vehicleSeatType ?? undefined, wheelSku: set.frontSku, sources: derived.sources },
      name: `Lug Kit ${threadLabel}${derived.vehicleSeatType ? ` (${derived.vehicleSeatType} seat)` : ""} - Included`,
    };
  }

  if (kind === "hub_ring") {
    const claimed = parseHubRingPlaceholder(sku);
    if (!claimed) return { ok: false, reason: "hardware_mismatch", detail: "hub_ring_unparseable" };
    if (derived.vehicleHubMm == null) return { ok: false, reason: "hardware_unverifiable", detail: "vehicle_hub_unknown" };
    if (derived.wheelBoreMm == null) return { ok: false, reason: "hardware_unverifiable", detail: "wheel_bore_unknown" };
    const ring = calculateHubRingSpec(derived.vehicleHubMm, derived.wheelBoreMm);
    if (!ring) {
      return {
        ok: false,
        reason: "hardware_mismatch",
        detail: derived.wheelBoreMm < derived.vehicleHubMm ? "wheel_bore_smaller_than_hub" : "no_ring_needed",
      };
    }
    // Compare in tenths of a mm: a whole-mm placeholder (`HR-73-71`) cannot name one
    // physical ring (73.1→70.5 and 72.6→71.4 both round to it) and is rejected even
    // when the rounded digits happen to agree.
    const expected = formatHubRingSku(ring);
    const outerOk = Math.abs(claimed.outer - ring.outerDiameter) <= HUB_RING_MATCH_TOLERANCE_MM;
    const innerOk = Math.abs(claimed.inner - ring.innerDiameter) <= HUB_RING_MATCH_TOLERANCE_MM;
    if (!claimed.tenths || !outerOk || !innerOk) {
      return { ok: false, reason: "hardware_mismatch", detail: `expected ${expected}` };
    }
    const outerMm = Number(formatHubRingMm(ring.outerDiameter));
    const innerMm = Number(formatHubRingMm(ring.innerDiameter));
    return {
      ok: true,
      spec: {
        outerDiameterMm: outerMm,
        innerDiameterMm: innerMm,
        // Unrounded inputs the ring was derived from, for fulfilment traceability.
        wheelBoreMm: derived.wheelBoreMm,
        vehicleHubMm: derived.vehicleHubMm,
        wheelSku: set.frontSku,
        sources: derived.sources,
      },
      name: `Hub Centric Rings ${formatHubRingMm(ring.outerDiameter)}mm -> ${formatHubRingMm(ring.innerDiameter)}mm (set of 4) - Included`,
    };
  }

  // valve_stem has no placeholder format today; nothing to compare.
  return { ok: true, spec: { wheelSku: set.frontSku }, name: "" };
}
