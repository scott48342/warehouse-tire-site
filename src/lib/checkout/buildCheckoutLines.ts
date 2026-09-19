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
 * - Accessories (lug nuts, hub rings, TPMS) have no catalog resolver here and
 *   keep the client price ($0 required hardware stays in the snapshot).
 * - Staggered lines are forced to 2+2 regardless of the client quantity.
 *
 * Pure: no I/O besides the injected resolver, so it is unit-testable.
 */
import type { QuoteLine } from "@/lib/quotes";
import type { CartItem, CartWheelItem, CartTireItem } from "@/lib/cart/CartContext";
import type { CatalogPriceResolver } from "./repriceCatalog";

export type CheckoutLineRejection = {
  reason: "unpriceable" | "rear_unresolved" | "finish_mismatch";
  sku: string;
  axle?: "front" | "rear";
  name: string;
};

export type BuildCheckoutLinesResult =
  | { ok: true; lines: QuoteLine[]; repriced: Array<{ sku: string; clientUnitPrice: number; serverUnitPrice: number }> }
  | { ok: false; rejected: CheckoutLineRejection[] };

const money = (n: number) => Math.round(n * 100) / 100;

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
    ...extra,
  };
}

export async function buildCheckoutLines(
  items: CartItem[],
  resolvePrice: CatalogPriceResolver,
): Promise<BuildCheckoutLinesResult> {
  const lines: QuoteLine[] = [];
  const rejected: CheckoutLineRejection[] = [];
  const repriced: Array<{ sku: string; clientUnitPrice: number; serverUnitPrice: number }> = [];

  for (const raw of items) {
    const i = raw as any;
    const name = String(i.model || i.name || i.sku || "Item").trim();
    const sku = String(i.sku || "").trim() || undefined;
    const clientUnit = Number(i.unitPrice || 0);
    const qtyClient = Math.max(1, Math.trunc(Number(i.quantity || 1)));

    if (i.type !== "wheel" && i.type !== "tire") {
      // Accessories: no catalog resolver; keep client price, keep $0 required hardware.
      lines.push({ kind: "product", name, sku, unitPriceUsd: clientUnit, qty: qtyClient, taxable: false, meta: baseMeta(i) });
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
      lines.push({
        kind: "product",
        name,
        sku,
        unitPriceUsd: money(front.unitPrice),
        qty: qtyClient,
        taxable: true,
        meta: baseMeta(i, { priceSource: front.source, clientUnitPrice: clientUnit }),
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
    lines.push({
      kind: "product",
      name: `${name} (front)`,
      sku,
      unitPriceUsd: money(front.unitPrice),
      qty: 2,
      taxable: true,
      meta: baseMeta(i, { axle: "front", staggeredSetId: setId, pairedSku: rearSku, priceSource: front.source, clientUnitPrice: clientUnit }),
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
        clientUnitPrice: clientUnit,
        // Rear axle specs travel with the rear line for the order record.
        spec: type === "wheel"
          ? { ...(i.spec || {}), width: (i as CartWheelItem).rearWidth ?? i.spec?.width, offset: (i as CartWheelItem).rearOffset ?? i.spec?.offset }
          : { ...(i.spec || {}), size: rearSize ?? i.spec?.size },
        finish: type === "wheel" ? ((i as CartWheelItem).rearFinish ?? (i as CartWheelItem).finish) : undefined,
      }),
    });
  }

  if (rejected.length > 0) return { ok: false, rejected };
  return { ok: true, lines, repriced };
}
