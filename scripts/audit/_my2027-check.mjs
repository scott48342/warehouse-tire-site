// What do we have for MY2026/2027, and what do NHTSA / EPA / USAF know about 2027?
import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const q = async (s) => (await p.query(s)).rows;

const ours = await q(`select year, count(*)::int rows, count(distinct (make,model))::int models from vehicle_fitments where quarantined_at is null and year >= 2025 group by 1 order by 1`);
console.log("OURS:", ours.map(r => `${r.year}: ${r.rows} rows / ${r.models} models`).join(" | "));
const ours27 = await q(`select make, model, count(*)::int n from vehicle_fitments where quarantined_at is null and year = 2027 group by 1,2 order by 1,2`);
console.log("OUR 2027 models:", ours27.length ? ours27.map(r => `${r.make}/${r.model}(${r.n})`).join(", ") : "NONE");

// EPA bulk (cached by pass1)
import fs from "node:fs";
const csvPath = "scripts/audit/pass1/cache/epa_vehicles.csv";
if (fs.existsSync(csvPath)) {
  const lines = fs.readFileSync(csvPath, "utf8").split("\n");
  const hdr = lines[0].split(",");
  const yi = hdr.indexOf("year"), mi = hdr.indexOf("make"), bi = hdr.indexOf("baseModel");
  const m27 = new Map();
  for (const l of lines.slice(1)) { const c = l.split(","); if (c[yi] === "2027") { const k = `${c[mi]}|${c[bi]}`; m27.set(k, (m27.get(k) || 0) + 1); } }
  console.log(`EPA 2027: ${m27.size} make/baseModel combos`);
  console.log([...m27.keys()].sort().slice(0, 80).join(", "));
}

// NHTSA: count 2027 models for a few big makes
const makes = ["ford", "chevrolet", "toyota", "honda", "ram", "gmc", "nissan", "hyundai", "kia", "jeep", "subaru", "tesla"];
let total = 0; const per = [];
for (const mk of makes) {
  try {
    const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${mk}/modelyear/2027?format=json`).then(r => r.json());
    const ms = (r.Results || []).filter(x => (x.Make_Name || "").toLowerCase() === mk).map(x => x.Model_Name);
    per.push(`${mk}:${ms.length}`); total += ms.length;
  } catch (e) { per.push(`${mk}:ERR`); }
  await new Promise(r => setTimeout(r, 250));
}
console.log(`NHTSA 2027 (12 big makes): ${total} models — ${per.join(" ")}`);

// USAF: does the prod admin route know 2027?
try {
  const r = await fetch("https://shop.warehousetiredirect.com/api/admin/usaf-vehicle?action=makes&year=2027").then(r => r.json());
  const mk = (r.makes || r.data || []).length;
  console.log(`USAF 2027 makes: ${mk}`, mk ? (r.makes || r.data).slice(0, 15).map(x => x.name || x.make || x).join(", ") : JSON.stringify(r).slice(0, 200));
  if (mk) {
    const f = await fetch("https://shop.warehousetiredirect.com/api/admin/usaf-vehicle?action=models&year=2027&make=Ford").then(r => r.json());
    console.log("USAF 2027 Ford models:", (f.models || f.data || []).map(x => x.name || x.model || x).join(", "));
  }
} catch (e) { console.log("USAF 2027: ERR", e.message); }
await p.end();
