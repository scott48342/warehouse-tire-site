// Live storefront checks for TG-reconciled vehicles (reads reconcile-plan-<date>.json for expected trims/ids/bolts).
//   node scripts/audit/pass3/tireguide/verify-tg-live.mjs [--base=https://shop.warehousetiredirect.com] [--pick=1998/ford/ranger,...]
// Checks: /api/vehicles/trims lists the TG trims; /api/vehicles/tire-sizes for a TG trim returns TG sizes;
//         /api/wheels/fitment-search with the TG modification_id returns the TG bolt, no missing-offset / unknown-axle error.
import fs from "fs";
import path from "path";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const BASE = (process.argv.find(a => a.startsWith("--base=")) || "--base=https://shop.warehousetiredirect.com").slice(7);
const PICK = (process.argv.find(a => a.startsWith("--pick=")) || "--pick=1998/ford/ranger,2021/chevrolet/silverado-1500,2023/dodge/challenger,2024/ford/f-150,2024/chevrolet/camaro,2024/honda/civic,2025/ram/3500,2026/audi/a8").slice(7).split(",");
const plan = JSON.parse(fs.readFileSync(path.join(HERE, "reconcile-plan-2026-09-16.json"), "utf8"));
const get = async u => { const r = await fetch(u, { headers: { "cache-control": "no-cache" } }); const t = await r.text(); try { return { status: r.status, json: JSON.parse(t) }; } catch { return { status: r.status, json: null, text: t.slice(0, 200) }; } };
const normBolt = b => b ? String(b).replace("-", "x") : b;
// mirror /api/vehicles/trims processTrims(): spaced " / " explodes to individual labels (compact "R/T" preserved); Base trims hidden under premium UX
const explode = d => d.split(/\s+\/\s+/).map(s => s.trim()).filter(Boolean);
const isBase = s => /^base$/i.test(s.trim());
const out = [];
for (const key of PICK) {
  const [y, mk, md] = key.split("/");
  const rec = plan.reconciled.find(r => String(r.year) === y && r.make === mk && r.model === md);
  if (!rec) { out.push(`${key}: NOT IN PLAN`); continue; }
  const enc = s => encodeURIComponent(s);
  const trims = await get(`${BASE}/api/vehicles/trims?year=${y}&make=${enc(mk)}&model=${enc(md)}`);
  const labels = (trims.json?.results || []).map(t => t.label);
  const mods = new Set((trims.json?.results || []).map(t => t.modificationId));
  const expected = [...new Set(rec.rows.flatMap(r => explode(r.display)).filter(l => !isBase(l)))];
  const missing = expected.filter(e => !labels.includes(e));
  const stale = labels.filter(l => !expected.includes(l));
  const modsOk = [...mods].every(m => rec.rows.some(r => r.id === m));
  const trimsOk = trims.status === 200 && missing.length === 0 && stale.length === 0 && modsOk;
  // pick the first (non-DRW-merged) row for deeper checks
  const row = rec.rows.find(r => r.display.length < 60) || rec.rows[0];
  const ts = await get(`${BASE}/api/vehicles/tire-sizes?year=${y}&make=${enc(mk)}&model=${enc(md)}&trim=${enc(explode(row.display)[0])}`); // picker label (exploded) - what SteppedVehicleSelector sends
  const gotSizes = ts.json?.tireSizes || [];
  const sizesOk = ts.status === 200 && row.tires.every(s => gotSizes.includes(s)) && gotSizes.every(s => row.tires.includes(s)) && ts.json?.debug?.modificationId === row.id;
  const fs_ = await get(`${BASE}/api/wheels/fitment-search?year=${y}&make=${enc(mk)}&model=${enc(md)}&modification=${enc(row.id)}&limit=1`);
  const f = fs_.json?.fitment || {};
  const bolt = normBolt(f.boltPattern || f.vehicle?.boltPattern || f.profile?.boltPattern || (fs_.json?.results?.[0]?.boltPattern) || JSON.stringify(fs_.json || {}).match(/"boltPattern":"([^"]+)"/)?.[1]);
  const errish = f.missingOemOffset || f.unknownAxleConfiguration || f.missingCenterBore || /missing OEM offset|missing_offset|MISSING/i.test(JSON.stringify(f).slice(0, 4000));
  const diam = JSON.stringify(fs_.json || {}).match(/"diameter":(\d+)/)?.[1];
  const fsOk = fs_.status === 200 && bolt === row.bolt && !errish && (fs_.json?.totalCount ?? 0) > 0 && f.canonicalModificationId === row.id;
  out.push(`${key}: trims ${trimsOk ? "PASS" : "FAIL"} (${labels.length} live labels from ${mods.size} TG rows${missing.length ? `; missing: ${missing.join(" | ")}` : ""}${stale.length ? `; stale: ${stale.join(" | ")}` : ""}${modsOk ? "" : "; non-TG modification ids present"}) | tire-sizes[trim=${explode(row.display)[0]} -> ${row.id}] ${sizesOk ? "PASS" : "FAIL"} (${gotSizes.join(",")} exp=${row.tires.join(",")} src=${ts.json?.source} mod=${ts.json?.debug?.modificationId}) | fitment-search ${fsOk ? "PASS" : "FAIL"} (bolt=${bolt} exp=${row.bolt} diam=${diam} total=${fs_.json?.totalCount} conf=${f.confidence} staggered=${f.staggered?.isStaggered} path=${f.resolutionPath}${errish ? " ERR=" + JSON.stringify(f).slice(0, 300) : ""})`);
}
console.log(out.join("\n"));
