/**
 * Release acceptance probe (2026-09-19): run the SAME server-side line builder both Stripe
 * routes use against the live (read-only) catalog and print what the server would charge
 * for tampered vs honest carts. Read-only: buildCheckoutLines only SELECTs.
 *
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/audit/release-price-authority-probe.ts
 */
import { buildCheckoutLines } from "@/lib/checkout/buildCheckoutLines";
import { defaultCatalogPriceResolver } from "@/lib/checkout/repriceCatalog";

type Case = { label: string; items: any[] };

async function pickWheelSku(): Promise<string> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const r = await pool.query(
    `SELECT sku FROM wp_wheels WHERE msrp_usd > 0 AND inv_order_type IS NOT NULL ORDER BY updated_at DESC LIMIT 1`,
  );
  await pool.end();
  return String(r.rows[0]?.sku || "");
}

const acc = (over: Record<string, unknown>) => ({ type: "accessory", name: "Acc", quantity: 1, unitPrice: 0, ...over });

(async () => {
  const WHEEL = await pickWheelSku();
  console.log(`wheel set SKU used for entitlement cases: ${WHEEL || "(none found)"}`);
  const wheelSet = (quantity = 4) => ({ type: "wheel", sku: WHEEL, name: "Wheel", quantity, unitPrice: 1 });

  const cases: Case[] = [
    { label: "TAMPER accessory 44-3985 sent at $1 (catalog sell_price 2973.70)", items: [acc({ sku: "44-3985", unitPrice: 1 })] },
    { label: "TAMPER 44-3985 relabelled category=lug_nut required=true $0 WITH wheel set", items: [wheelSet(), acc({ sku: "44-3985", category: "lug_nut", required: true })] },
    { label: "TAMPER catalog lug nuts PHXNF25 required $0 WITH wheel set (catalog 310.05 > $75 cap -> charged)", items: [wheelSet(), acc({ sku: "PHXNF25", category: "lug_nut", required: true })] },
    { label: "TAMPER unknown SKU as required $0 lug nuts WITH wheel set", items: [wheelSet(), acc({ sku: "NOPE-FAKE-SKU", category: "lug_nut", required: true })] },
    { label: "TAMPER placeholder LUGKIT-M14x1.5 required $0 with NO wheel set", items: [acc({ sku: "LUGKIT-M14x1.5", category: "lug_nut", required: true })] },
    { label: "LEGIT placeholder LUGKIT-M14x1.5 + HR-73-66 $0 WITH wheel set", items: [wheelSet(), acc({ sku: "LUGKIT-M14x1.5" }), acc({ sku: "HR-73-66" })] },
    { label: "TAMPER excess: 3 placeholder lug kits for one wheel set", items: [wheelSet(), acc({ sku: "LUGKIT-M14x1.5", quantity: 3 })] },
    { label: "TAMPER TPMS synthetic sent at $0.01", items: [acc({ sku: "TPMS-SENSOR-UNIVERSAL", quantity: 4, unitPrice: 0.01 })] },
    { label: "TAMPER optional upsell LUG-KIT-CHROME sent as required $0 WITH wheel set (fixed 79.99 > cap)", items: [wheelSet(), acc({ sku: "LUG-KIT-CHROME", category: "lug_nut", required: true })] },
    { label: "TAMPER road hazard with no tires", items: [acc({ sku: "RH-PROTECT-2YR", quantity: 4, unitPrice: 1 })] },
    { label: "HONEST accessory at catalog price", items: [acc({ sku: "44-3985", unitPrice: 2973.7 })] },
  ];

  for (const c of cases) {
    const r = await buildCheckoutLines(c.items as any, defaultCatalogPriceResolver);
    if (!r.ok) {
      console.log(`${c.label}\n   -> REJECT 409 ${JSON.stringify(r.rejected)}`);
      continue;
    }
    const lines = r.lines.filter((l) => (l.meta as any)?.cartType !== "wheel");
    const total = lines.reduce((s, l) => s + Number(l.unitPriceUsd) * l.qty, 0);
    const rep = r.repriced.filter((x) => x.sku !== WHEEL).map((x) => `${x.sku}: client $${x.clientUnitPrice} -> server $${x.serverUnitPrice}`).join("; ");
    console.log(
      `${c.label}\n   -> ACCEPT accessory lines: ${lines.map((l) => `${l.sku ?? l.name} x${l.qty} @ $${Number(l.unitPriceUsd).toFixed(2)} [${(l.meta as any)?.priceSource ?? "?"}]`).join("; ")}  ACC TOTAL $${total.toFixed(2)}${rep ? `  REPRICED{${rep}}` : ""}`,
    );
  }
  process.exit(0);
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
