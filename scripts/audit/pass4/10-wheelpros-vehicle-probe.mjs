// Spike: does WheelPros /products/v1/search/wheel accept vehicle (Y/M/M) filters and return fitment facets we can diff against?
// Read-only, 6 vehicles with KNOWN bolt patterns. Prints the bolt_pattern_metric / centerbore / offset facets returned.
//   node --env-file=.env.local scripts/audit/pass4/10-wheelpros-vehicle-probe.mjs
const auth = await fetch("https://api.wheelpros.com/auth/v1/authorize", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ userName: process.env.WHEELPROS_USERNAME, password: process.env.WHEELPROS_PASSWORD }) });
if (!auth.ok) { console.log("auth failed", auth.status, (await auth.text()).slice(0, 200)); process.exit(1); }
const token = (await auth.json()).accessToken;
const known = [
  { year: 2003, make: "Nissan", model: "Xterra", bolt: "6x139.7" }, { year: 2006, make: "Acura", model: "TL", bolt: "5x114.3" }, { year: 2005, make: "Cadillac", model: "CTS", bolt: "5x115" },
  { year: 2024, make: "Ford", model: "Maverick", bolt: "5x108" }, { year: 2015, make: "Chevrolet", model: "Silverado 2500HD", bolt: "8x180" }, { year: 2010, make: "Toyota", model: "Prius", bolt: "5x100" },
];
const paramSets = [
  (v) => ({ vehicle_year: v.year, vehicle_make: v.make, vehicle_model: v.model }),
  (v) => ({ year: v.year, make: v.make, model: v.model }),
  (v) => ({ vehicleYear: v.year, vehicleMake: v.make, vehicleModel: v.model }),
];
for (const [i, ps] of paramSets.entries()) {
  console.log(`\n== param style ${i}: ${Object.keys(ps(known[0])).join(",")}`);
  for (const v of known) {
    const u = new URL("https://api.wheelpros.com/products/v1/search/wheel");
    for (const [k, val] of Object.entries(ps(v))) u.searchParams.set(k, String(val));
    u.searchParams.set("pageSize", "1");
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch {}
    const f = j?.facets || {};
    const pick = (name) => (f[name]?.buckets || []).slice(0, 4).map(b => `${b.value}(${b.count})`).join(" ");
    console.log(`  ${v.year} ${v.make} ${v.model} [ours ${v.bolt}] -> HTTP ${r.status} total=${j?.totalCount ?? "?"} bolt=[${pick("bolt_pattern_metric")}] cb=[${pick("centerbore")}] diam=[${pick("wheel_diameter")}] ${r.status !== 200 ? txt.slice(0, 120).replace(/\s+/g, " ") : ""}`);
    await new Promise(r => setTimeout(r, 400));
  }
  if (paramSets.length && i === 0) { /* continue to try others regardless */ }
}
