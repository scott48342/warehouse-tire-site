// Grade US AutoForce GetVehicleOptions LoadIndex against the Tire Guide truth set (rows with oem_load_index set).
// Also reports how often FrontInf/RearInf/WBC/TRQ1 are populated. Read-only; no DB writes.
// Usage: node --env-file=.env.local scripts/audit/pass4/out/_grade-usaf-loadindex.mjs   (USAUTOFORCE_* must be in env)
import fs from "node:fs";
import pg from "pg";

const user = process.env.USAUTOFORCE_USERNAME, pass = process.env.USAUTOFORCE_PASSWORD;
if (!user || !pass) throw new Error("USAUTOFORCE_USERNAME/PASSWORD missing");
const url = user.toLowerCase().includes("test") ? "https://servicesstage.usautoforce.com/integrationservice.asmx" : "https://services.usautoforce.com/integrationservice.asmx";
const NS = "https://services.usautoforce.com";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function vehicleOptions(year, make, model) {
  const env = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header><Authentication xmlns="${NS}"><User>${esc(user)}</User><Password>${esc(pass)}</Password></Authentication></soap:Header><soap:Body><GetVehicleOptions xmlns="${NS}"><year>${year}</year><make>${esc(make)}</make><model>${esc(model)}</model></GetVehicleOptions></soap:Body></soap:Envelope>`;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `${NS}/GetVehicleOptions` }, body: env });
  const text = await r.text();
  const opts = [];
  for (const m of text.matchAll(/<VehicleOption>([\s\S]*?)<\/VehicleOption>/g)) {
    const g = (t) => { const x = m[1].match(new RegExp(`<${t}>([^<]*)</${t}>`)); return x ? x[1].trim() : ""; };
    opts.push({ tireSize: g("TireSize"), li: g("LoadIndex"), speed: g("SpeedRate"), frontInf: g("FrontInf"), rearInf: g("RearInf"), rim: g("RimSize"), wbc: g("WBC"), trq: g("TRQ1") });
  }
  return { status: r.status, opts };
}

// normalise "P225/55R19", "225/55ZR19 103H", "LT315/70R17/C" → "225/55R19"
const norm = (s) => String(s || "").toUpperCase().replace(/^P|^LT/, "").replace(/ZR/, "R").replace(/\s.*$/, "").replace(/\/[A-F]$/, "");

// USAF model names: our slugs are lowercase-hyphenated; try a few spellings
function modelCandidates(model) {
  const words = model.replace(/-/g, " ");
  const set = new Set([words, model, words.replace(/\b(\w)/g, (c) => c.toUpperCase())]);
  // Mach E ↔ Mach-E, F 150 ↔ F-150 style
  set.add(words.replace(/\b([A-Za-z]+) (\d+)\b/g, "$1-$2"));
  set.add(words.replace(/\bmach e\b/i, "Mach-E"));
  return [...set];
}

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const { rows } = await pool.query(`select id, year, make, model, display_trim, oem_tire_sizes, oem_load_index, lug_torque_ftlb, tire_pressure_front_psi
  from vehicle_fitments where oem_load_index is not null and quarantined_at is null order by year, make, model`);
await pool.end();
console.log(`truth rows: ${rows.length}`);

const cache = new Map();
const results = [];
let popInf = 0, popWbc = 0, popTrq = 0, optCount = 0;
for (const row of rows) {
  const key = `${row.year}|${row.make}|${row.model}`;
  if (!cache.has(key)) {
    let got = null;
    for (const cand of modelCandidates(row.model)) {
      const r = await vehicleOptions(row.year, row.make, cand);
      if (r.opts.length) { got = { cand, opts: r.opts }; break; }
    }
    cache.set(key, got);
    if (got) for (const o of got.opts) { optCount++; if (o.frontInf || o.rearInf) popInf++; if (o.wbc) popWbc++; if (o.trq) popTrq++; }
  }
  const got = cache.get(key);
  const sizes = Array.isArray(row.oem_tire_sizes) ? row.oem_tire_sizes.map(norm) : [];
  let status, usafLi = null;
  if (!got) status = "usaf_no_vehicle";
  else {
    const match = got.opts.filter((o) => sizes.includes(norm(o.tireSize)));
    if (!match.length) status = "no_size_match";
    else {
      const lis = [...new Set(match.map((o) => Number(o.li)).filter(Boolean))];
      usafLi = lis;
      if (lis.length === 1 && lis[0] === row.oem_load_index) status = "match";
      else if (lis.includes(row.oem_load_index)) status = "match_among_multiple";
      else status = "mismatch";
    }
  }
  results.push({ id: row.id, year: row.year, make: row.make, model: row.model, trim: row.display_trim, ours: row.oem_load_index, usaf: usafLi, sizes: sizes.join(","), status });
}

const tally = {};
for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1;
console.log("Y/M/M queried:", cache.size, "| found at USAF:", [...cache.values()].filter(Boolean).length);
console.log("status tally:", JSON.stringify(tally));
console.log(`USAF option rows: ${optCount} | FrontInf/RearInf populated: ${popInf} | WBC: ${popWbc} | TRQ1: ${popTrq}`);
console.log("--- mismatches ---");
for (const r of results.filter((r) => r.status === "mismatch")) console.log(`${r.year} ${r.make} ${r.model} [${r.trim}] ours=${r.ours} usaf=${JSON.stringify(r.usaf)} sizes=${r.sizes}`);
console.log("--- usaf_no_vehicle (distinct Y/M/M) ---");
console.log([...new Set(results.filter((r) => r.status === "usaf_no_vehicle").map((r) => `${r.year} ${r.make} ${r.model}`))].join("; "));
fs.writeFileSync("scripts/audit/pass4/out/_grade-usaf-loadindex.json", JSON.stringify({ tally, results }, null, 2));
