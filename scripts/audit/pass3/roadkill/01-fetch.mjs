// Fetch roadkillcustoms bolt-pattern cross-reference (all bolt patterns) → out/roadkill.json
//   node scripts/audit/pass3/roadkill/01-fetch.mjs [--only "5 X 120"] [--force]
// Server-rendered HTML; ~60 pages; 2s throttle; cached in cache/<bp>.html. Internal cross-check source only (tag 'roadkill-xref').
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const CACHE = path.join(here, "cache"), OUT = path.join(here, "out");
fs.mkdirSync(CACHE, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const FORCE = process.argv.includes("--force");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > -1 ? process.argv[i + 1] : null; })();
const BASE = "https://m.roadkillcustoms.com/wheel-bolt-pattern-cross-reference/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WarehouseTireAudit/1.0";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = url => execFileSync("curl.exe", ["-s", "-L", "-A", UA, url], { encoding: "utf8", maxBuffer: 20e6 });

// 1) bolt pattern list from the dropdown
const first = get(BASE + "?bp=5%20X%20120");
const bps = [...new Set([...first.matchAll(/<option[^>]*value=["']([^"']+)["']/g)].map(m => m[1]).filter(v => /^\d+-[\d.]+-\d+ X [\d.]+$/.test(v)).map(v => v.split("-").slice(2).join("-")))];
console.log(`bolt patterns in dropdown: ${bps.length}`);

const decode = s => s.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
function parse(html, bp) {
  const rows = [];
  // header rows: <h4 ...>YEARS <a class="BPlink" href="...Makes=MAKE&Models=MODEL">MAKE MODEL</a></h4>
  const re = /<h4[^>]*>\s*([^<]*?)\s*<a href="[^"]*Makes=([^&"]+)&(?:amp;)?Models=([^"]+)"[^>]*class="BPlink"[^>]*>([^<]*)<\/a>\s*<\/h4>([\s\S]*?)(?=<h4[^>]*>|<h2|$)/g;
  let m;
  while ((m = re.exec(html))) {
    const years = m[1].trim(), make = decode(m[2]), model = decode(m[3]), detail = m[5];
    const bolt = (detail.match(/Bolt Pattern:\s*<strong>\s*(?:<a[^>]*>)?\s*([^<]+?)\s*(?:<\/a>)?\s*<\/strong>/i) || [])[1];
    const stud = (detail.match(/Stud Size:\s*<strong>\s*([^<]+?)\s*<\/strong>/i) || [])[1];
    const bore = (detail.match(/Hub Center Bore:\s*<strong>\s*([^<]+?)\s*<\/strong>/i) || [])[1];
    const tq = (detail.match(/(\d{2,3})\s*to\s*(\d{2,3})\s*lb-ft/i) || []);
    const os = (detail.match(/[?&]os=([^&"]*)/) || [])[1];
    let yFrom = null, yTo = null;
    const open = years.match(/^(\d{4})\s*>\s*$/); if (open) { yFrom = +open[1]; yTo = 2027; }
    const ym = years.match(/^(\d{4})(?:\s*-\s*(\d{2,4}))?$/);
    if (ym) { yFrom = +ym[1]; yTo = ym[2] ? (ym[2].length === 2 ? Math.floor(yFrom / 100) * 100 + +ym[2] : +ym[2]) : yFrom; if (yTo < yFrom) yTo += 100; }
    rows.push({ bp, make: make.trim(), model: model.trim(), years, yearFrom: yFrom, yearTo: yTo, bolt: bolt ? decode(bolt) : bp, stud: stud ? decode(stud) : null, bore: bore ? decode(bore) : null, torqueMin: tq[1] ? +tq[1] : null, torqueMax: tq[2] ? +tq[2] : null, offset: os ? decode(os) : null });
  }
  return rows;
}

const all = [];
for (const bp of bps) {
  if (ONLY && bp !== ONLY) continue;
  const f = path.join(CACHE, bp.replace(/[^\w.]+/g, "_") + ".html");
  let html;
  if (fs.existsSync(f) && !FORCE) html = fs.readFileSync(f, "utf8");
  else { html = get(BASE + "?bp=" + encodeURIComponent(bp)); fs.writeFileSync(f, html); await sleep(2000); }
  const rows = parse(html, bp);
  console.log(`${bp}: ${rows.length} vehicles`);
  all.push(...rows);
}
fs.writeFileSync(path.join(OUT, "roadkill.json"), JSON.stringify(all, null, 0));
const makes = new Set(all.map(r => r.make.toLowerCase()));
console.log(`total: ${all.length} vehicle/year-range rows, ${makes.size} makes → ${path.join(OUT, "roadkill.json")}`);
console.log("sample:", JSON.stringify(all.slice(0, 3)));
