// Shared helpers for Pass 1 (existence & coverage audit vs NHTSA vPIC + EPA).
// Nothing here mutates vehicle_fitments. Only audit_pass1_* tables are written.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.join(HERE, "cache");
export const OUT_DIR = path.resolve(HERE, "../../../docs/fitment-api/audit/pass1");
fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

export const YEAR_MIN = 1990;
export const YEAR_MAX = 2026;

export function pool() {
  return new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false }, max: 4 });
}

// ---------- aliases (single source of truth: aliases.json) ----------
export const ALIASES = JSON.parse(fs.readFileSync(path.join(HERE, "aliases.json"), "utf8"));

// ---------- normalization ----------
/** compact key: lowercase, alnum only. "Silverado 1500" -> "silverado1500", "f-150" -> "f150" */
export function compact(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // NHTSA "Giulia (952)"
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

/** Our DB make slug -> canonical make key (also fixes mercedes / "* vans" / "* minivans"). */
export function normMake(makeSlug) {
  const m = String(makeSlug ?? "").toLowerCase().trim();
  if (ALIASES.make[m]) return ALIASES.make[m];
  const stripped = m.replace(/\s+(vans|minivans)$/, "");
  if (ALIASES.make[stripped]) return ALIASES.make[stripped];
  return compact(stripped);
}

/** Gov't make name (NHTSA "MERCEDES-BENZ", EPA "McLaren Automotive") -> canonical make key */
export function normGovMake(name) {
  const c = compact(name);
  return ALIASES.govMake[c] ?? c;
}

const NOISE = ALIASES.modelNoiseTokens; // e.g. 2wd, 4wd, awd, pickup, cab chassis ...
/** Remove drivetrain/body noise tokens from a gov't model name; returns compact key. */
export function stripNoise(modelRaw) {
  let s = String(modelRaw ?? "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/&/g, " and ");
  s = s.replace(/[^a-z0-9]+/g, " ").trim();
  // multi-word noise first
  for (const n of NOISE.filter((x) => x.includes(" ")).sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(`\\b${n}\\b`, "g"), " ");
  }
  const single = new Set(NOISE.filter((x) => !x.includes(" ")));
  s = s.split(/\s+/).filter((t) => t && !single.has(t)).join(" ");
  return s;
}

/** Family key: strip trailing series numbers / hd / class words so silverado2500hd -> silverado, f150 -> f (rejected: <4). */
export function familyKey(key) {
  let k = key;
  for (const suf of ALIASES.familySuffixes) if (k.endsWith(suf) && k.length > suf.length + 2) k = k.slice(0, -suf.length);
  k = k.replace(/[0-9]+$/, "");
  for (const suf of ALIASES.familySuffixes) if (k.endsWith(suf) && k.length > suf.length + 2) k = k.slice(0, -suf.length);
  return k.length >= 4 ? k : null;
}

// ---------- pattern families (aliases.json modelPatterns) ----------
const PATTERNS = ALIASES.modelPatterns.map((p) => ({ ...p, rx: new RegExp(p.re) }));
/** Apply make-specific regex families to a compact key: "c300" (mercedes) -> "cclass", "328i" (bmw) -> "3series". */
export function patternFamilies(makeKey, key) {
  const out = new Set();
  for (const p of PATTERNS) {
    if (p.make !== makeKey) continue;
    const m = key.match(p.rx);
    if (!m) continue;
    let v = p.to.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? "");
    if (p.map && p.map[v]) v = p.map[v];
    if (v) out.add(v);
  }
  return [...out];
}

/** Every key (exact + alias) and every family key for one of OUR model slugs. */
export function ourKeySets(makeKey, modelSlug) {
  const exact = new Set(ourModelKeys(makeKey, modelSlug));
  const family = new Set();
  for (const k of exact) {
    for (const f of patternFamilies(makeKey, k)) family.add(f);
    const fk = familyKey(k);
    if (fk) family.add(fk);
  }
  return { exact, family };
}

/** Every key (exact + alias) and every family key for a gov't model. */
export function govKeySets(makeKey, modelRaw, baseModel) {
  const exact = new Set(govModelKeys(makeKey, modelRaw, baseModel));
  const family = new Set();
  for (const k of exact) {
    for (const f of patternFamilies(makeKey, k)) family.add(f);
    const fk = familyKey(k);
    if (fk) family.add(fk);
  }
  return { exact, family };
}

/** true if the make sold vehicles in the US in that year (per aliases.json makeWindows; unknown make = true). */
export function makeActiveInYear(makeKey, year) {
  const w = ALIASES.makeWindows[makeKey];
  if (!w) return true;
  for (let i = 0; i < w.length; i += 2) {
    const lo = w[i] ?? -Infinity, hi = w[i + 1] ?? Infinity;
    if (year >= lo && year <= hi) return true;
  }
  return false;
}

/** Medium/heavy-duty or commercial-chassis model names we exclude from the light-vehicle universe. */
const HD_RE = /\b(4500|5500|6500|7500|4500hd|5500hd|6500hd|f-?550|f-?600|f-?650|f-?750|c-?4500|c-?5500|c-?6500|c-?7500|t-?6500|t-?7500|kodiak|topkick|w[3-5]500|w-?series|t-?series|lcf|low cab|cab forward|cab over|cab behind|f7 cab|tilt|stripped|chassis|cutaway|motorhome|motor home|rv|bus|tractor|incomplete|p ?- ?series|p30|p3500|forward|f-?53|f-?59|e-?450|3500hd cab|urban|commercial|step ?van|workhorse|glider|van camper|npr|nqr|nrr|frr|ftr|fvr|h-?series|t[678]f|reach|vn[lmr]|vhd|vah|wg|wia|wx|acl|fe\d{3}|fg\d{3}|fk\d{3}|fm\d{3}|canter|fuso)\b/i;
export function isHeavyOrCommercial(modelRaw) {
  return HD_RE.test(String(modelRaw ?? ""));
}

/** Junk NHTSA model names (VIN-pattern artifacts) */
export function isJunkGovModel(modelRaw) {
  const s = String(modelRaw ?? "").trim();
  if (!s || s.length < 2) return true;
  if (/^'\d{2}$/.test(s)) return true; // "'34"
  if (/^(gmt|gmt-)\d+/i.test(s)) return false; // keep GMT-400 (we alias it)
  if (/^(unknown|other|n\/a|not applicable|body|model|test|prototype)/i.test(s)) return true;
  return false;
}

/** Canonical make key -> exact NHTSA Make_Name to query */
export function nhtsaMakeName(makeKey) {
  return ALIASES.nhtsaName[makeKey] ?? makeKey.toUpperCase();
}

export const EXTRA_MAKES = ["eagle", "merkur", "daihatsu", "fisker", "vinfast", "ineos", "maybach", "peugeot", "yugo", "sterling"];

/** All candidate keys for one of OUR model slugs (make-aware aliases). */
export function ourModelKeys(makeKey, modelSlug) {
  const base = compact(modelSlug);
  const keys = new Set([base]);
  const a = ALIASES.model[`${makeKey}:${base}`] ?? ALIASES.model[base];
  if (a) for (const x of [].concat(a)) keys.add(compact(x));
  return [...keys];
}

/** All candidate keys for a gov't model name (raw + noise-stripped + baseModel). */
export function govModelKeys(makeKey, modelRaw, baseModel) {
  const keys = new Set();
  // "Caravan/Grand Caravan", "Caprice/Impala", "NPR/NPR-HD" -> each part is a candidate too
  const parts = [String(modelRaw ?? "")];
  if (/\//.test(modelRaw) && !/\d\/\d/.test(modelRaw)) for (const p of String(modelRaw).split("/")) if (p.trim()) parts.push(p.trim());
  for (const part of parts) {
    const raw = compact(part);
    if (raw) keys.add(raw);
    const stripped = compact(stripNoise(part));
    if (stripped) keys.add(stripped);
    // "Scion xB" (under TOYOTA), "Mazda3", "Geo Metro" -> drop the sub-brand prefix
    const m = String(part).toLowerCase().match(/^(scion|mazda|geo)\s*[- ]?\s*(.+)$/);
    if (m && m[2]) { const k = compact(stripNoise(m[2])) || compact(m[2]); if (k) keys.add(k); }
  }
  if (baseModel) {
    keys.add(compact(baseModel));
    const bs = compact(stripNoise(baseModel));
    if (bs) keys.add(bs);
    if (/\//.test(baseModel)) for (const p of String(baseModel).split("/")) { const k = compact(stripNoise(p)) || compact(p); if (k) keys.add(k); }
  }
  for (const k of [...keys]) {
    const a = ALIASES.model[`${makeKey}:${k}`] ?? ALIASES.model[k];
    if (a) for (const x of [].concat(a)) keys.add(compact(x));
  }
  return [...keys].filter(Boolean);
}

// ---------- polite cached fetch ----------
let inflight = 0;
const MAX_CONCURRENT = 4;
const DELAY_MS = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function cachedJson(cacheKey, url, { headers = {}, ttlDays = 365 } = {}) {
  const file = path.join(CACHE_DIR, cacheKey.replace(/[^a-z0-9._-]+/gi, "_") + ".json");
  if (fs.existsSync(file)) {
    const st = fs.statSync(file);
    if (Date.now() - st.mtimeMs < ttlDays * 86400e3) return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  while (inflight >= MAX_CONCURRENT) await sleep(25);
  inflight++;
  try {
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "WarehouseTireDirect-fitment-audit/1.0 (contact: scott@warehousetire.net)", ...headers } });
        if (r.status === 429 || r.status >= 500) {
          const ra = Number(r.headers.get("retry-after")) || (attempt + 1) * 3;
          await sleep(ra * 1000);
          lastErr = new Error(`HTTP ${r.status}`);
          continue;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        const text = await r.text();
        const json = text ? JSON.parse(text) : null;
        fs.writeFileSync(file, JSON.stringify(json));
        await sleep(DELAY_MS);
        return json;
      } catch (e) {
        lastErr = e;
        await sleep((attempt + 1) * 1500);
      }
    }
    throw lastErr;
  } finally {
    inflight--;
  }
}

// ---------- csv ----------
export function toCsv(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cols = columns ?? Object.keys(rows[0] ?? {});
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

export function writeCsv(name, rows, columns) {
  const f = path.join(OUT_DIR, name);
  fs.writeFileSync(f, toCsv(rows, columns));
  console.log(`  wrote ${path.relative(process.cwd(), f)} (${rows.length} rows)`);
  return f;
}

export function pct(n, d) {
  return d ? `${((100 * n) / d).toFixed(1)}%` : "n/a";
}
