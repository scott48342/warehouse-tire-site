import fs from "node:fs";
const cart = JSON.parse(fs.readFileSync("docs/fitment-api/audit/acceptance-cart-mustang-rc7-2026-09-19.json", "utf8"));
const customer = { firstName: "Accept", lastName: "Probe", email: "accept-probe@example.invalid", phone: "2480000000" };
const clone = (x) => JSON.parse(JSON.stringify(x));
async function probe(label, items) {
  const t0 = Date.now();
  const r = await fetch("http://localhost:3002/api/stripe/create-payment-intent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, customer }) });
  console.log(`${label}\n  => ${r.status} (${Date.now()-t0}ms) ${(await r.text()).slice(0, 420)}\n`);
}
await probe("H) genuine cart, tampered $1 (server reprices; then read-only DB => generic 500 expected)", clone(cart).map(i => i.type==="wheel" ? {...i, unitPrice:1, frontUnitPrice:1, rearUnitPrice:1} : i));
const b = clone(cart); b[2].sku = "HR-99-99";
await probe("B) hub ring HR-99-99 (server should derive HR-73-71 => hardware_mismatch)", b);
const l = clone(cart); l[1].sku = "LUGKIT-M12x1.5"; 
await probe("I) lug kit LUGKIT-M12x1.5 (vehicle is M14x1.5 => hardware_mismatch)", l);
const w = clone(cart); w[2].wheelSku = "GHOST";
await probe("J) hub ring pointing at a wheel not in the order => hardware_unverifiable", w);
const nv = clone(cart); delete nv[0].vehicle;
await probe("K) wheel line without vehicle + placeholders => hardware_unverifiable", nv);
