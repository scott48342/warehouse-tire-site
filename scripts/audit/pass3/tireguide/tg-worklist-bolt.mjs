// Build the Tire Guide worklist for the roadkill tight-range BOLT disagreements: one item per Y/M/M, ordered by
// nameplate weight (most disagreeing rows first). Output: worklist-bolt.json (same shape tg-loop.ps1 expects).
import fs from "node:fs";
const csv = fs.readFileSync("docs/fitment-api/audit/pass3/roadkill-disagree.csv", "utf8").split(/\r?\n/).filter(Boolean);
const h = csv[0].split(",");
const parse = l => { const c = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { c.push(cur); cur = ""; } else cur += ch; } c.push(cur); return Object.fromEntries(h.map((k, i) => [k, c[i]])); };
const rows = csv.slice(1).map(parse).filter(r => r.bolt === "disagree");
const byModel = {}; for (const r of rows) byModel[`${r.make}|${r.model}`] = (byModel[`${r.make}|${r.model}`] || 0) + 1;
const seen = new Map();
for (const r of rows) {
  const k = `${r.year}|${r.make}|${r.model}`;
  if (!seen.has(k)) seen.set(k, { year: +r.year, make: r.make, model: r.model, prio: 0, reason: "bolt-disagree", weight: byModel[`${r.make}|${r.model}`], rows: 0, our_bolt: new Set(), rk_bolt: new Set() });
  const it = seen.get(k); it.rows++; it.our_bolt.add(r.our_bolt); it.rk_bolt.add(r.rk_bolt);
}
const items = [...seen.values()].sort((a, b) => b.weight - a.weight || a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.year - b.year)
  .map(it => ({ ...it, our_bolt: [...it.our_bolt].join("/"), rk_bolt: [...it.rk_bolt].join("/") }));
fs.writeFileSync("scripts/audit/pass3/tireguide/worklist-bolt.json", JSON.stringify(items, null, 1));
console.log(`worklist-bolt.json: ${items.length} Y/M/M from ${rows.length} rows, ${Object.keys(byModel).length} nameplates`);
