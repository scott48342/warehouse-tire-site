/**
 * Release acceptance probe (2026-09-19): run the SAME server-side line builder both Stripe
 * routes use against the live (read-only) catalog and print what the server would charge
 * for tampered vs honest carts. Read-only: buildCheckoutLines only SELECTs.
 *
 *   npx tsx --env-file=.env.local scripts/audit/release-price-authority-probe.ts
 */
import { buildCheckoutLines } from "@/lib/checkout/buildCheckoutLines";
import { defaultCatalogPriceResolver } from "@/lib/checkout/repriceCatalog";

type Case = { label: string; items: any[] };

const cases: Case[] = [
  { label: "TAMPER accessory 44-3985 sent at $1 (catalog sell_price 2973.70)", items: [{ type: "accessory", sku: "44-3985", name: "Lift kit", quantity: 1, unitPrice: 1 }] },
  { label: "TAMPER 44-3985 relabelled category=lug_nut required=true $0", items: [{ type: "accessory", sku: "44-3985", name: "Lift kit", category: "lug_nut", required: true, quantity: 1, unitPrice: 0 }] },
  { label: "GENUINE included hardware PHXNF25 lug_nut required $0 (catalog 310.05 > $75 cap -> charged)", items: [{ type: "accessory", sku: "PHXNF25", name: "Lug nuts", category: "lug_nut", required: true, quantity: 1, unitPrice: 0 }] },
  { label: "TAMPER unknown SKU", items: [{ type: "accessory", sku: "NOPE-FAKE-SKU", name: "Ghost", quantity: 1, unitPrice: 5 }] },
  { label: "TAMPER TPMS synthetic sent at $0.01", items: [{ type: "accessory", sku: "TPMS-SENSOR-UNIVERSAL", name: "TPMS", quantity: 4, unitPrice: 0.01 }] },
  { label: "TAMPER road hazard with no tires", items: [{ type: "accessory", sku: "RH-PROTECT-2YR", name: "Road hazard", quantity: 4, unitPrice: 1 }] },
  { label: "HONEST accessory at catalog price", items: [{ type: "accessory", sku: "44-3985", name: "Lift kit", quantity: 1, unitPrice: 2973.7 }] },
];

(async () => {
  for (const c of cases) {
    const r = await buildCheckoutLines(c.items as any, defaultCatalogPriceResolver);
    if (!r.ok) {
      console.log(`${c.label}\n   -> REJECT 409 line_unpriceable ${JSON.stringify(r.rejected)}`);
      continue;
    }
    const total = r.lines.reduce((s, l) => s + Number(l.unitPriceUsd) * l.qty, 0);
    const rep = r.repriced.map(x => `${x.sku}: client $${x.clientUnitPrice} -> server $${x.serverUnitPrice}`).join("; ");
    console.log(`${c.label}\n   -> ACCEPT server lines: ${r.lines.map(l => `${l.sku ?? l.name} x${l.qty} @ $${Number(l.unitPriceUsd).toFixed(2)} [${(l.meta as any)?.priceSource ?? "?"}]`).join("; ")}  TOTAL $${total.toFixed(2)}${rep ? `  REPRICED{${rep}}` : ""}`);
  }
  process.exit(0);
})().catch(e => { console.error("ERR", e); process.exit(1); });
