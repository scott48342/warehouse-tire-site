import fs from "node:fs";

const BASE = process.env.AUDIT_BASE || "http://localhost:3000";
const sizes = JSON.parse(fs.readFileSync("scripts/_gate-unique-sizes.json", "utf8"));

const OUT = "scripts/_gate-size-products.json";
// resume support
let done = {};
if (fs.existsSync(OUT)) {
  try { done = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let i = 0;
for (const size of sizes) {
  i++;
  if (done[size] && done[size].ok) continue;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const r = await fetch(`${BASE}/api/tires/search?size=${encodeURIComponent(size)}&pageSize=1`, {
        headers: { "x-audit": "gate-product-audit" },
      });
      const j = await r.json();
      const srcs = j.sources || {};
      const total = Object.values(srcs).reduce((a, b) => a + (Number(b) || 0), 0);
      const resultsLen = Array.isArray(j.results) ? j.results.length : 0;
      done[size] = { ok: true, total, resultsLen, sources: srcs };
      break;
    } catch (e) {
      if (attempt >= 3) {
        done[size] = { ok: false, error: String(e.message || e) };
        break;
      }
      await sleep(1500 * attempt);
    }
  }
  if (i % 10 === 0) {
    fs.writeFileSync(OUT, JSON.stringify(done, null, 2));
    console.log(`progress ${i}/${sizes.length} | last="${size}" total=${done[size]?.total ?? "err"}`);
  }
  await sleep(350); // gentle throttle
}
fs.writeFileSync(OUT, JSON.stringify(done, null, 2));

const zero = Object.entries(done).filter(([, v]) => v.ok && (v.total === 0));
const errored = Object.entries(done).filter(([, v]) => !v.ok);
console.log(`\nDONE. sizes=${sizes.length} zeroProduct=${zero.length} errored=${errored.length}`);
console.log("Zero-product sizes:", JSON.stringify(zero.map(([s]) => s), null, 2));
if (errored.length) console.log("Errored sizes:", errored.map(([s]) => s).join(", "));
