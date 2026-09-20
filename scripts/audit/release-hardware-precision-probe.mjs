import fs from "node:fs";
const raw = JSON.parse(fs.readFileSync("docs/fitment-api/audit/acceptance-cart-mustang-rc7-tenths-2026-09-20.json", "utf8"));
// rebuild real cart items (the dump flattened vehicle for readability)
const VEH = { year: "2020", make: "Ford", model: "Mustang", trim: "GT Performance Pack" };
const base = raw.map((i) => i.type === "wheel"
  ? { type: "wheel", sku: i.sku, rearSku: i.rearSku, brand: "ROHANA", model: "RC7", quantity: 4, unitPrice: i.unit, frontUnitPrice: i.front, rearUnitPrice: i.rear, staggered: true, fitmentClass: i.fitmentClass, fitVerified: i.fitVerified, vehicle: VEH }
  : { type: "accessory", category: i.sku.startsWith("HR-") ? "hub_ring" : "lug_nut", sku: i.sku, name: i.name, unitPrice: 0, quantity: 1, required: true, wheelSku: i.wheelSku, spec: i.spec, meta: i.meta });
const post = async (label, items, route = "create-payment-intent") => {
  const r = await fetch(`http://localhost:3002/api/stripe/${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, customer: { firstName: "Accept", lastName: "Probe", email: "accept-probe@example.invalid" } }) });
  const t = await r.text(); console.log(`${label} => ${r.status} ${t.slice(0, 260)}`);
};
const clone = () => JSON.parse(JSON.stringify(base));
let c;
await post("A) genuine cart (tenths SKU HR-73.1-70.5)", clone());
c = clone(); c.find((i) => i.sku.startsWith("HR-")).sku = "HR-73-71"; await post("B) legacy whole-mm HR-73-71", c);
c = clone(); c.find((i) => i.sku.startsWith("HR-")).sku = "HR-72.6-71.4"; await post("C) whole-mm collider HR-72.6-71.4", c);
c = clone(); c.find((i) => i.sku.startsWith("HR-")).sku = "HR-73.2-70.5"; await post("D) tenth off HR-73.2-70.5", c);
c = clone(); c.find((i) => i.sku.startsWith("HR-")).spec = { outerDiameter: 99, innerDiameter: 1 }; c.find((i) => i.sku.startsWith("HR-")).name = "Hub Rings — Included (99mm → 1mm)"; await post("E) tampered client spec/name, SKU intact", c);
c = clone(); await post("F) create-checkout-session genuine", c, "create-checkout-session");
