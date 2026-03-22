/**
 * Unseen 10-Vehicle Confidence Test
 *
 * Hits prod endpoints:
 * - /api/vehicles/trims
 * - /api/wheels/fitment-search
 * - /api/vehicles/tire-sizes
 *
 * Picks 10 vehicles NOT in regression-50-vehicles.ts
 */

type Vehicle = { year: number; make: string; model: string; group: string };

const BASE_URL = process.env.BASE_URL || "https://shop.warehousetiredirect.com";

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return json;
}

const UNSEEN: Vehicle[] = [
  { year: 2015, make: "Subaru", model: "Outback", group: "common" },
  { year: 2021, make: "Subaru", model: "Forester", group: "common" },
  { year: 2020, make: "Nissan", model: "Altima", group: "sedan" },
  { year: 2019, make: "Mazda", model: "CX-5", group: "crossover" },
  { year: 2022, make: "Volkswagen", model: "Tiguan", group: "crossover" },
  { year: 2023, make: "Audi", model: "Q5", group: "luxury" },
  { year: 2021, make: "Toyota", model: "RAV4", group: "common" },
  { year: 2020, make: "Kia", model: "Telluride", group: "suv" },
  { year: 2018, make: "Chevrolet", model: "Equinox", group: "suv" },
  { year: 2022, make: "Genesis", model: "GV70", group: "luxury" },
];

async function testVehicle(v: Vehicle) {
  const { year, make, model } = v;
  const vehicleStr = `${year} ${make} ${model}`;

  const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&_=${Date.now()}`;
  const trimsData = await fetchJson(trimsUrl);
  const trimsCount = trimsData?.results?.length || 0;
  if (!trimsCount) {
    return { vehicle: vehicleStr, group: v.group, ok: false, error: "No trims" };
  }

  const selected = trimsData.results[0];
  const modId = selected.modificationId || selected.value;

  const wheelsUrl = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modification=${encodeURIComponent(modId)}&pageSize=5&_=${Date.now()}`;
  const wheelsData = await fetchJson(wheelsUrl);
  const wheelsCount = wheelsData?.totalCount ?? 0;

  const tiresUrl = `${BASE_URL}/api/vehicles/tire-sizes?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modification=${encodeURIComponent(modId)}&_=${Date.now()}`;
  const tiresData = await fetchJson(tiresUrl);
  const tiresCount = tiresData?.tireSizesStrict?.length || 0;

  const warnings: string[] = [];
  if (!wheelsCount) warnings.push("0 wheels");
  if (!tiresCount) warnings.push("0 tires");

  return {
    vehicle: vehicleStr,
    group: v.group,
    ok: wheelsCount > 0 && tiresCount > 0,
    trims: trimsCount,
    selectedTrim: selected.label,
    modificationId: modId,
    wheels: wheelsCount,
    tires: tiresCount,
    wheelSource: wheelsData?.fitment?.fitmentSource,
    warnings,
  };
}

(async () => {
  console.log("🔎 Unseen 10-Vehicle Confidence Test");
  console.log("Target:", BASE_URL);
  console.log("Vehicles:", UNSEEN.length);
  console.log("─".repeat(90));

  const results: any[] = [];
  for (let i = 0; i < UNSEEN.length; i++) {
    const v = UNSEEN[i];
    const desc = `${v.year} ${v.make} ${v.model}`;
    process.stdout.write(`[${String(i + 1).padStart(2, "0")}/10] ${desc.padEnd(40)} `);
    const t0 = Date.now();
    try {
      const r = await testVehicle(v);
      const ms = Date.now() - t0;
      results.push(r);
      const status = r.ok ? "✅" : "❌";
      const warn = r.warnings?.length ? ` warnings=${r.warnings.join(",")}` : "";
      console.log(`${status} (trims=${r.trims} wheels=${r.wheels} tires=${r.tires}) ${ms}ms${warn}`);
    } catch (e: any) {
      const ms = Date.now() - t0;
      results.push({ vehicle: desc, group: v.group, ok: false, error: e?.message || String(e) });
      console.log(`❌ (${ms}ms) ${e?.message || e}`);
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log("\nSUMMARY");
  console.log(`✅ Passed: ${passed}/10`);
  console.log(`❌ Failed: ${failed}/10`);

  if (failed) {
    console.log("\nFailures:");
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  • ${r.vehicle}: ${r.error || r.warnings?.join(",") || "unknown"}`);
    });
  }

  // Group summary
  const byGroup = new Map<string, { total: number; passed: number }>();
  for (const r of results) {
    const g = r.group || "unknown";
    const cur = byGroup.get(g) || { total: 0, passed: 0 };
    cur.total++;
    if (r.ok) cur.passed++;
    byGroup.set(g, cur);
  }
  console.log("\nBy group:");
  for (const [g, s] of byGroup.entries()) {
    console.log(`  - ${g}: ${s.passed}/${s.total}`);
  }
})();
