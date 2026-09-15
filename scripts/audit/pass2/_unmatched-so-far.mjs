// List unmatched Y/M/M results in cache grouped by make:model with years + first tried names.
import fs from "node:fs";
import path from "node:path";
import { CACHE_DIR, readJson } from "./lib.mjs";
const filt = process.argv[2] ?? null;
const g = {};
for (const y of fs.readdirSync(CACHE_DIR)) {
  if (!/^\d{4}$/.test(y)) continue;
  for (const mk of fs.readdirSync(path.join(CACHE_DIR, y))) {
    if (filt && mk !== filt) continue;
    for (const f of fs.readdirSync(path.join(CACHE_DIR, y, mk))) {
      const r = readJson(path.join(CACHE_DIR, y, mk, f));
      if (!r || r.status === "matched") continue;
      const k = `${r.make} | ${r.model}`;
      (g[k] ??= { years: [], tried: r.tried.map((t) => t.name).slice(0, 4), rows: 0 }).years.push(r.year);
      g[k].rows += r.n_rows;
    }
  }
}
for (const [k, v] of Object.entries(g).sort((a, b) => b[1].rows - a[1].rows)) console.log(`${k} | ${v.rows} rows | ${Math.min(...v.years)}-${Math.max(...v.years)} (${v.years.length}y) | ${v.tried.join(" ; ")}`);
