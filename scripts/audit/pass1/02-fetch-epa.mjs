// Pass 1 / step 2: EPA fueleconomy.gov bulk vehicles.csv (1984–2026) → audit_pass1_epa_vehicles.
// Downloads once to ./cache/epa_vehicles.csv; re-runs are offline. Does NOT touch vehicle_fitments.
import fs from "node:fs";
import path from "node:path";
import { pool, compact, normGovMake, stripNoise, YEAR_MIN, CACHE_DIR } from "./00-lib.mjs";

const URL_CSV = "https://www.fueleconomy.gov/feg/epadata/vehicles.csv";
const file = path.join(CACHE_DIR, "epa_vehicles.csv");
if (!fs.existsSync(file) || fs.statSync(file).size < 1e6) {
  console.log("downloading", URL_CSV);
  const r = await fetch(URL_CSV, { headers: { "User-Agent": "WarehouseTireDirect-fitment-audit/1.0 (contact: scott@warehousetire.net)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(file, buf);
  console.log(`saved ${(buf.length / 1e6).toFixed(1)} MB`);
} else console.log(`using cached ${file} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);

// --- tiny RFC4180 parser (fields may be quoted; no embedded newlines expected) ---
function parseCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const text = fs.readFileSync(file, "utf8");
const lines = text.split(/\r?\n/).filter((l) => l.length);
const header = parseCsvLine(lines[0]);
const col = Object.fromEntries(header.map((h, i) => [h, i]));
for (const need of ["year", "make", "model", "baseModel", "VClass", "id", "trany", "drive", "displ", "cylinders", "atvType"]) if (!(need in col)) throw new Error(`missing column ${need}`);
console.log(`csv lines: ${lines.length - 1}`);

/** trim text = model remainder after removing baseModel words, then noise tokens; "" if nothing left */
function trimText(model, baseModel) {
  let s = String(model).toLowerCase();
  const b = String(baseModel ?? "").toLowerCase().trim();
  // strip baseModel only at a word boundary ("M3" with baseModel "M" must NOT become "3")
  if (b && s.startsWith(b) && (s.length === b.length || /[^a-z0-9]/.test(s[b.length]))) s = s.slice(b.length);
  else if (b && b.length >= 3) s = s.replace(new RegExp(`(^|[^a-z0-9])${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`), "$1 $2");
  const stripped = stripNoise(s); // removes 2wd/4wd/awd/pickup/… and returns spaced words
  return stripped.trim();
}

const rows = [];
const unmappedMakes = new Map();
for (let i = 1; i < lines.length; i++) {
  const f = parseCsvLine(lines[i]);
  const year = Number(f[col.year]);
  if (!Number.isFinite(year) || year < YEAR_MIN) continue;
  const makeRaw = f[col.make];
  const make_norm = normGovMake(makeRaw);
  const modelRaw = f[col.model];
  const baseModel = f[col.baseModel] || null;
  rows.push({
    year,
    make_raw: makeRaw,
    make_norm,
    model_raw: modelRaw,
    model_norm: compact(stripNoise(modelRaw)) || compact(modelRaw),
    base_model: baseModel,
    base_norm: baseModel ? compact(stripNoise(baseModel)) || compact(baseModel) : null,
    trim_text: trimText(modelRaw, baseModel),
    epa_id: Number(f[col.id]),
    vclass: f[col.VClass],
    trany: f[col.trany],
    drive: f[col.drive],
    displ: f[col.displ] === "" ? null : Number(f[col.displ]),
    cylinders: f[col.cylinders] === "" ? null : Number(f[col.cylinders]),
    atv_type: f[col.atvType] || null,
  });
}
console.log(`rows >= ${YEAR_MIN}: ${rows.length}`);
const makeCounts = {};
for (const r of rows) makeCounts[`${r.make_norm} <- ${r.make_raw}`] = (makeCounts[`${r.make_norm} <- ${r.make_raw}`] ?? 0) + 1;
console.log("EPA makes:", Object.entries(makeCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join("; "));

const db = pool();
await db.query(`drop table if exists audit_pass1_epa_vehicles`);
await db.query(`create table audit_pass1_epa_vehicles (
  year int not null, make_norm text not null, make_raw text, model_raw text not null, model_norm text not null,
  base_model text, base_norm text, trim_text text, epa_id int primary key, vclass text, trany text, drive text, displ numeric, cylinders int, atv_type text)`);
const B = 500;
const cols = ["year", "make_norm", "make_raw", "model_raw", "model_norm", "base_model", "base_norm", "trim_text", "epa_id", "vclass", "trany", "drive", "displ", "cylinders", "atv_type"];
for (let i = 0; i < rows.length; i += B) {
  const chunk = rows.slice(i, i + B);
  const vals = [], params = [];
  chunk.forEach((r, k) => {
    const o = k * cols.length;
    vals.push(`(${cols.map((_, j) => `$${o + j + 1}`).join(",")})`);
    for (const c of cols) params.push(r[c]);
  });
  await db.query(`insert into audit_pass1_epa_vehicles (${cols.join(",")}) values ${vals.join(",")} on conflict (epa_id) do nothing`, params);
  if ((i / B) % 20 === 0) process.stdout.write(`  ${i}/${rows.length}\r`);
}
await db.query(`create index on audit_pass1_epa_vehicles (make_norm, year)`);
const n = (await db.query(`select count(*)::int c, count(distinct (make_norm, base_norm))::int mm, min(year) y0, max(year) y1 from audit_pass1_epa_vehicles`)).rows[0];
console.log(`\naudit_pass1_epa_vehicles: ${n.c} rows, ${n.mm} distinct make+baseModel, years ${n.y0}-${n.y1}`);
// sample trim_text distribution for sanity
const s = (await db.query(`select trim_text, count(*)::int c from audit_pass1_epa_vehicles where year>=2000 group by 1 order by 2 desc limit 40`)).rows;
console.log("top trim_text:", s.map((r) => `${r.trim_text || "∅"}(${r.c})`).join(", "));
await db.end();
