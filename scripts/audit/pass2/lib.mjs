// Pass 2 shared library: DB pool, tire-size normalization, USAF fetch (cached + throttled), candidate name generation.
// Read-only against vehicle_fitments. Writes only under scripts/audit/pass2/cache and audit_pass2_* tables.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool as pass1Pool, ALIASES, compact } from "../pass1/00-lib.mjs";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.join(HERE, "cache");
export const OUT_DIR = path.resolve(HERE, "../../../docs/fitment-api/audit/pass2");
export const YEAR_MIN = 1990;
export const YEAR_MAX = 2026;
export const USAF_URL = "https://shop.warehousetiredirect.com/api/admin/usaf-vehicle";

export const pool = pass1Pool;
export { compact };

// ---------------------------------------------------------------------------
// Tire size normalization
// ---------------------------------------------------------------------------
/**
 * Normalize a tire size string for comparison. Returns null when unparseable
 * (vintage alpha-numeric "F70-14", bias "8.00-15", junk).
 *  P225/60R16 -> 225/60R16 ; LT315/70R17/C -> 315/70R17 ; 255/40ZR19 -> 255/40R19
 *  225/50RF18 -> 225/50R18 ; 185/60R15C -> 185/60R15 ; 33x12.50R20LT/C -> 33X12.50R20
 *  P225/50VR16 -> 225/50R16 ; 225/50R17 94V -> 225/50R17
 */
export function normTire(raw) {
  if (raw == null) return null;
  let s = String(raw).toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  // flotation: 31x10.50R15LT/C, 33X12.5R20, 35x12.50R17
  let m = s.match(/^(\d{2}(?:\.\d)?)X(\d{1,2}(?:\.\d{1,2})?)(?:Z?R|-)?(\d{2}(?:\.5)?)(?:LT)?(?:\/[A-H])?$/);
  if (m) {
    const w = Number(m[2]).toFixed(2);
    return `${m[1]}X${w}R${m[3]}`;
  }
  // metric: [P|LT|T]WWW/AA[speed]?[Z]?R[F]?RR[LT|C]?[/load]?[ load-index speed]?
  m = s.match(/^(?:P|LT|T|ST)?(\d{3})\/(\d{2,3})(?:[A-Z]{1,2})?R(?:F)?(\d{2}(?:\.5)?)(?:LT|C)?(?:\/[A-H])?(?:\d{2,3}(?:\/\d{2,3})?[A-Z]?)?(?:XL|RF|SL)?$/);
  if (m) return `${m[1]}/${m[2]}R${m[3]}`;
  // metric without aspect: 235R15, LT235/85R16 handled above; 31/10.50R15 style
  m = s.match(/^(?:P|LT)?(\d{3})R(\d{2})(?:C)?$/);
  if (m) return `${m[1]}/82R${m[2]}`; // treat as standard 82 series? keep distinct but comparable
  return null;
}

/** Parse our oem_tire_sizes jsonb (array | {front,rear} | bare string | null) into raw string list. */
export function ourTireList(v) {
  if (v == null) return [];
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return [];
    if (t.startsWith("[") || t.startsWith("{")) { try { return ourTireList(JSON.parse(t)); } catch { /* fallthrough */ } }
    return t.split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
  }
  if (Array.isArray(v)) return v.flatMap((x) => (typeof x === "string" ? [x] : x && typeof x === "object" ? ourTireList(x) : [])).map((x) => x.trim()).filter(Boolean);
  if (typeof v === "object") {
    const out = [];
    for (const k of ["front", "rear", "size", "tireSize", "sizes"]) if (v[k] != null) out.push(...ourTireList(v[k]));
    return out;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Name generation (our slugs -> USAF model names)
// ---------------------------------------------------------------------------
const MAKE_OVERRIDES = {
  bmw: "BMW", gmc: "GMC", mini: "MINI", amc: "AMC", mercedes: "Mercedes-Benz", "mercedes-benz": "Mercedes-Benz",
  "land rover": "Land Rover", "alfa romeo": "Alfa Romeo", "aston martin": "Aston Martin", "rolls-royce": "Rolls-Royce",
  mclaren: "McLaren", smart: "smart", hummer: "Hummer",
};
/** our make slug -> USAF make name (case-insensitive on their side; spacing/hyphens matter). */
export function usafMake(makeSlug) {
  let m = String(makeSlug).toLowerCase().trim().replace(/\s+(vans|minivans)$/, "");
  if (MAKE_OVERRIDES[m]) return MAKE_OVERRIDES[m];
  return m.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
/** canonical make key used for aliases.json lookups */
export function makeKey(makeSlug) {
  const m = String(makeSlug).toLowerCase().trim().replace(/\s+(vans|minivans)$/, "");
  return ALIASES.make[m] ?? compact(m);
}

const FAMILY_SLUG = /(-|^)(series|class)(-amg|-coupe|-cabriolet|-convertible|-wagon|-sedan)?$/;
export function isFamilySlug(makeSlug, modelSlug) {
  return FAMILY_SLUG.test(modelSlug) || (["lexus", "infiniti"].includes(makeSlug) && /^[a-z]{1,3}$/.test(modelSlug) && !["q", "z"].includes(modelSlug));
}

const TOKEN_MAP = { and: "&", "amp": "&" };
const NO_JOIN_HYPHEN = new Set(["type", "pace", "hr", "v", "r", "e", "s", "x", "f", "z", "p"]); // second tokens that usually keep hyphen with 1-2 letter prefix

/** Title-case words but keep alnum tokens like "2500hd" -> "2500HD" via caller. Case doesn't matter to USAF. */
function tc(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

/** Generate ordered, de-duplicated USAF model-name candidates from our slug. */
export function slugCandidates(makeSlug, modelSlug, { maxPrimary = 4, maxAlias = 2 } = {}) {
  const out = [];
  const push = (name, kind) => { const n = String(name).replace(/\s+/g, " ").trim(); if (n && !out.some((o) => o.name.toLowerCase() === n.toLowerCase())) out.push({ name: n, kind }); };
  const toks = modelSlug.toLowerCase().split("-").filter(Boolean).map((t) => TOKEN_MAP[t] ?? t);
  const mk0 = makeKey(makeSlug);

  // explicit overrides (learned from probes)
  const ov = MODEL_OVERRIDES[`${mk0}:${modelSlug}`];
  if (ov) for (const n of ov) push(n, "override");
  // family slugs (bmw 3-series, mercedes c-class, lexus es): USAF has no such model; caller uses trim variants
  if (isFamilySlug(makeSlug, modelSlug)) return out;
  // makes whose USAF names join letters+digits (ES350, GLE350, Q50): try joined first
  if (["lexus", "infiniti", "mercedesbenz", "genesis", "acura"].includes(mk0) && toks.length >= 2 && /^[a-z]{1,3}$/.test(toks[0]) && /^\d/.test(toks[1])) push([`${toks[0]}${toks[1]}`.toUpperCase(), ...toks.slice(2).map(tc)].join(" "), "joined");

  // smart join: 1-2 letter prefix + digit/short token => hyphen (F-150, CX-5, HR-V, C-HR, X-Type); rest space-joined
  const smart = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], n = toks[i + 1];
    if (t === "e" && n === "tron") { smart.push("e-tron"); i++; }
    else if (/^[a-z]{1,2}$/.test(t) && n && (/^\d/.test(n) || NO_JOIN_HYPHEN.has(n) || /^[a-z]{1,2}$/.test(n)) && i === 0) { smart.push(`${t}-${n}`.toUpperCase()); i++; }
    else smart.push(/^\d/.test(t) || t.length <= 3 ? t.toUpperCase() : tc(t));
  }
  push(smart.join(" "), "smart");
  // plain space join
  push(toks.map((t) => (/^\d/.test(t) || t.length <= 3 ? t.toUpperCase() : tc(t))).join(" "), "space");
  // split digit+suffix (2500hd -> 2500 HD; 1500hd)
  const split = toks.flatMap((t) => { const m = t.match(/^(\d+)(hd|xl|l|ev|d)$/); return m ? [m[1], m[2].toUpperCase()] : [t]; });
  if (split.length !== toks.length) { push(split.map((t) => (/^\d/.test(t) || t.length <= 3 ? t.toUpperCase() : tc(t))).join(" "), "split"); }
  // joined letters+digits (es-350 -> ES350, gle-350 -> GLE350, q-50 -> Q50, xl-7 -> XL7)
  if (toks.length === 2 && /^[a-z]{1,3}$/.test(toks[0]) && /^\d/.test(toks[1])) push(`${toks[0]}${toks[1]}`.toUpperCase(), "joined");
  if (toks.length >= 2 && /^[a-z]{1,3}$/.test(toks[0]) && /^\d/.test(toks[1])) push([`${toks[0]}${toks[1]}`.toUpperCase(), ...toks.slice(2).map(tc)].join(" "), "joined");
  // no-hyphen-no-space (S10, F150) only for 2-token slugs with a short first token
  if (toks.length === 2 && toks[0].length <= 3) push(toks.join("").toUpperCase(), "concat");
  const primary = out.slice(0, Math.max(maxPrimary, out.filter((o) => o.kind === "override").length));
  out.length = 0; out.push(...primary);
  // aliases.json equivalents (compact keys) -> de-compacted names (skip platform codes / junk)
  const mk = mk0;
  const base = compact(modelSlug);
  const al = ALIASES.model[`${mk}:${base}`] ?? ALIASES.model[base];
  let nAlias = 0;
  if (al) for (const a of [].concat(al)) {
    const k = compact(a);
    if (!k || k === base || k.length < 3 || /^(gmt\d+|ck|ck\d+|superduty|van|gseries|.*wk|.*jk|.*jl)$/.test(k)) continue;
    for (const n of decompact(k).slice(0, 1)) { if (nAlias < maxAlias) { push(n, "alias"); nAlias++; } }
  }
  // GM/Ram series toggles: add/strip " 1500" (Suburban <-> Suburban 1500, Avalanche <-> Avalanche 1500)
  if (["chevrolet", "gmc", "ram", "dodge"].includes(mk)) {
    const sm = smart.join(" ");
    if (/^(suburban|avalanche|yukon xl|express|savana|sierra|silverado|sprinter|tahoe)$/i.test(sm)) push(`${sm} 1500`, "series-add");
    else { const stripped = sm.replace(/\s+(1500|2500|3500)(\s*HD)?$/i, ""); if (stripped !== sm && /^(suburban|avalanche|yukon xl)$/i.test(stripped)) push(stripped, "series-strip"); }
  }
  return out;
}

/** de-compact "silverado2500hd" -> ["Silverado 2500 HD", "Silverado 2500HD"], "f150" -> ["F-150","F150"], "k1500" -> ["K1500","K-1500"] */
function decompact(k) {
  const parts = k.match(/[a-z]+|\d+/g) ?? [k];
  const names = new Set();
  if (parts.length === 1) { names.add(tc(parts[0])); return [...names]; }
  const spaced = parts.map((p) => (/^\d/.test(p) || p.length <= 3 ? p.toUpperCase() : tc(p))).join(" ");
  names.add(spaced);
  if (/^[a-z]{1}$/.test(parts[0]) && /^\d/.test(parts[1])) { names.add(`${parts[0].toUpperCase()}-${parts.slice(1).join(" ").toUpperCase()}`); names.add(`${parts[0].toUpperCase()}${parts[1]}${parts.slice(2).length ? " " + parts.slice(2).join(" ").toUpperCase() : ""}`); }
  else if (/^[a-z]{2,3}$/.test(parts[0]) && /^\d/.test(parts[1])) names.add(parts.map((p) => p.toUpperCase()).join(""));
  return [...names];
}

/** Explicit make:slug -> USAF names (ordered). Learned from _probe-out.txt. */
export const MODEL_OVERRIDES = {
  "astonmartin:vantage": ["Vantage", "V8 Vantage", "V12 Vantage"], "astonmartin:v8-vantage": ["V8 Vantage", "Vantage"], "astonmartin:v12-vantage": ["V12 Vantage", "Vantage"],
  "astonmartin:db11": ["DB11"], "astonmartin:dbs": ["DBS", "DBS Superleggera"], "astonmartin:db9": ["DB9"], "astonmartin:rapide": ["Rapide", "Rapide S"],
  "audi:e-tron": ["e-tron", "e-tron Quattro", "e-tron Sportback"], "audi:e-tron-s": ["e-tron S", "e-tron S Sportback"], "audi:e-tron-gt": ["e-tron GT", "RS e-tron GT"],
  "audi:q4-e-tron": ["Q4 e-tron", "Q4 e-tron Sportback"], "audi:q8-e-tron": ["Q8 e-tron", "Q8 e-tron Quattro"], "audi:q8-sportback-e-tron": ["Q8 e-tron Sportback", "Q8 Sportback e-tron"],
  "audi:q6-e-tron": ["Q6 e-tron", "Q6 e-tron Quattro"], "audi:a6-e-tron": ["A6 e-tron", "A6 Sportback e-tron"], "audi:a3-sportback-e-tron": ["A3 e-tron", "A3 Sportback e-tron"],
  "audi:rs6": ["RS6 Avant", "RS6"], "audi:rs-6": ["RS6 Avant", "RS6"], "audi:rs7": ["RS7 Sportback", "RS7"], "audi:rs-7": ["RS7 Sportback", "RS7"], "audi:rs3": ["RS3", "RS 3"], "audi:rs4": ["RS4", "RS 4", "RS4 Avant"],
  "audi:a8": ["A8 Quattro", "A8", "A8 L Quattro", "A8 L"], "audi:a8-l": ["A8 L Quattro", "A8 L", "A8 Quattro"], "audi:s8": ["S8", "S8 Quattro"],
  "audi:a7": ["A7 Sportback", "A7 Quattro", "A7", "A7 Premium Plus"], "audi:s7": ["S7 Sportback", "S7"], "audi:a5": ["A5 Quattro", "A5 Sportback", "A5", "A5 Cabriolet", "A5 Coupe"], "audi:s5": ["S5", "S5 Sportback", "S5 Cabriolet", "S5 Coupe"],
  "audi:a4": ["A4", "A4 Quattro", "A4 allroad", "A4 Avant"], "audi:a6": ["A6", "A6 Quattro", "A6 allroad", "A6 Avant"], "audi:a3": ["A3", "A3 Quattro", "A3 Sportback"], "audi:s3": ["S3", "S3 Quattro"], "audi:s4": ["S4", "S4 Quattro", "S4 Avant"], "audi:s6": ["S6", "S6 Quattro"],
  "audi:tt": ["TT", "TT Quattro", "TT Roadster"], "audi:tts": ["TTS", "TTS Quattro", "TT"], "audi:tt-rs": ["TT RS", "TT RS Quattro"], "audi:q5": ["Q5", "Q5 Sportback", "Q5 Quattro"], "audi:sq5": ["SQ5", "SQ5 Sportback"], "audi:q3": ["Q3", "Q3 Quattro"], "audi:q7": ["Q7", "Q7 Quattro"], "audi:q8": ["Q8", "Q8 Quattro"], "audi:sq7": ["SQ7"], "audi:sq8": ["SQ8"], "audi:rs-q8": ["RS Q8", "RSQ8"], "audi:rsq8": ["RS Q8", "RSQ8"],
  "audi:80": ["80", "80 Quattro"], "audi:90": ["90", "90 Quattro"], "audi:100": ["100", "100 Quattro"], "audi:200": ["200", "200 Quattro"], "audi:v8": ["V8", "V8 Quattro"], "audi:cabriolet": ["Cabriolet"], "audi:coupe": ["Coupe Quattro", "Coupe"], "audi:allroad": ["allroad quattro", "allroad", "A4 allroad", "A6 allroad"],
  "chrysler:town-country": ["Town & Country"], "chrysler:town-and-country": ["Town & Country"],
  "volkswagen:id-4": ["ID.4"], "volkswagen:id4": ["ID.4"],
  "mazda:mx-5-miata": ["MX-5 Miata"], "mazda:mx-5": ["MX-5 Miata", "MX-5", "Miata"], "mazda:miata": ["MX-5 Miata", "Miata"],
  "mazda:mazda3": ["3"], "mazda:mazda6": ["6"], "mazda:mazda2": ["2"], "mazda:mazda5": ["5"], "mazda:3": ["3"], "mazda:6": ["6"],
  "mazda:b-series": ["B2300", "B3000", "B4000", "B2500"],
  "toyota:86": ["86", "GR86"], "toyota:gr-86": ["GR86"], "toyota:supra": ["GR Supra", "Supra"],
  "toyota:camry-solara": ["Solara", "Camry Solara"], "toyota:mr2-spyder": ["MR2 Spyder"], "toyota:mr2": ["MR2 Spyder", "MR2"],
  "toyota:rav4-hybrid": ["RAV4"], "toyota:rav4-prime": ["RAV4 Prime", "RAV4"],
  "chevrolet:c/k-1500": ["C1500", "K1500"], "chevrolet:c/k-2500": ["C2500", "K2500"], "chevrolet:c/k-3500": ["C3500", "K3500"], "chevrolet:ck-1500": ["C1500", "K1500"], "chevrolet:ck-2500": ["C2500", "K2500"], "chevrolet:ck-3500": ["C3500", "K3500"],
  "gmc:c/k-1500": ["C1500", "K1500"], "gmc:c/k-2500": ["C2500", "K2500"], "gmc:c/k-3500": ["C3500", "K3500"], "gmc:ck-1500": ["C1500", "K1500"], "gmc:ck-2500": ["C2500", "K2500"], "gmc:ck-3500": ["C3500", "K3500"], "gmc:sierra-1500": ["Sierra 1500", "C1500", "K1500"], "gmc:sierra-2500": ["Sierra 2500", "Sierra 2500 HD", "C2500", "K2500"], "gmc:sierra-3500": ["Sierra 3500", "Sierra 3500 HD", "C3500", "K3500"],
  "chevrolet:suburban": ["Suburban", "Suburban 1500", "K1500 Suburban", "C1500 Suburban", "K2500 Suburban", "C2500 Suburban", "R1500 Suburban", "V1500 Suburban"], "chevrolet:suburban-1500": ["Suburban 1500", "Suburban", "K1500 Suburban", "C1500 Suburban"], "chevrolet:suburban-2500": ["Suburban 2500", "K2500 Suburban", "C2500 Suburban"],
  "gmc:suburban": ["Suburban", "Suburban 1500", "K1500 Suburban", "C1500 Suburban", "K2500 Suburban", "C2500 Suburban"], "gmc:yukon-xl": ["Yukon XL", "Yukon XL 1500", "Yukon XL 2500"], "gmc:yukon-xl-1500": ["Yukon XL 1500", "Yukon XL"], "gmc:yukon-xl-2500": ["Yukon XL 2500"],
  "chevrolet:silverado-1500": ["Silverado 1500", "Silverado 1500 LD", "C1500", "K1500"], "chevrolet:silverado-2500": ["Silverado 2500", "Silverado 2500 HD", "C2500", "K2500"], "chevrolet:silverado-3500": ["Silverado 3500", "Silverado 3500 HD", "C3500", "K3500"], "chevrolet:silverado-3500hd": ["Silverado 3500 HD", "Silverado 3500", "Silverado 3500 HD Classic", "C3500", "K3500"], "chevrolet:silverado-2500hd": ["Silverado 2500 HD", "Silverado 2500", "Silverado 2500 HD Classic", "C2500", "K2500"],
  "gmc:sierra-2500hd": ["Sierra 2500 HD", "Sierra 2500", "Sierra 2500 HD Classic", "C2500", "K2500"], "gmc:sierra-3500hd": ["Sierra 3500 HD", "Sierra 3500", "Sierra 3500 HD Classic", "C3500", "K3500"], "gmc:sierra": ["Sierra 1500", "C1500", "K1500", "Sierra 2500", "C2500", "K2500"], "chevrolet:silverado": ["Silverado 1500", "C1500", "K1500", "Silverado 2500"],
  "honda:del-sol": ["Civic del Sol", "del Sol"], "honda:civic-del-sol": ["Civic del Sol", "del Sol"], "hummer:h1": ["H1", "AM General|Hummer", "AM General|H1"],
  "cadillac:ct6-v": ["CT6", "CT6-V"], "cadillac:ct5-v-blackwing": ["CT5", "CT5-V"], "cadillac:ct4-v-blackwing": ["CT4", "CT4-V"],
  "ford:mustang-mach-e": ["Mustang Mach-E"], "ford:mach-e": ["Mustang Mach-E"], "ford:c-max": ["C-Max"], "ford:c-max-hybrid": ["C-Max"], "ford:c-max-energi": ["C-Max"], "ford:crown-victoria": ["Crown Victoria", "LTD Crown Victoria"], "ford:ltd-crown-victoria": ["LTD Crown Victoria", "Crown Victoria"],
  "ford:e-150-econoline": ["E-150", "E-150 Econoline", "E-150 Econoline Club Wagon"], "ford:e-250-econoline": ["E-250", "E-250 Econoline"], "ford:e-350-econoline": ["E-350 Super Duty", "E-350", "E-350 Econoline"], "ford:e-350-super-duty": ["E-350 Super Duty", "E-350"], "ford:e-250-super-duty": ["E-250", "E-250 Super Duty"],
  "ford:club-wagon-e-150": ["E-150 Econoline Club Wagon", "E-150 Club Wagon"], "ford:club-wagon-e-350": ["E-350 Econoline Club Wagon", "E-350 Club Wagon"], "ford:e-150-club-wagon": ["E-150 Econoline Club Wagon"], "ford:e-350-club-wagon": ["E-350 Econoline Club Wagon"], "ford:econoline": ["E-150", "E-250", "E-350 Super Duty"],
  "dodge:ram-van-b150": ["B150"], "dodge:ram-van-b250": ["B250"], "dodge:ram-van-b350": ["B350"], "dodge:ram-van-b1500": ["B1500", "Ram 1500 Van"], "dodge:ram-van-b2500": ["B2500", "Ram 2500 Van"], "dodge:ram-van-b3500": ["B3500", "Ram 3500 Van"], "dodge:b150": ["B150"], "dodge:b250": ["B250"], "dodge:b350": ["B350"], "dodge:b1500": ["B1500", "Ram 1500 Van"], "dodge:b2500": ["B2500", "Ram 2500 Van"], "dodge:b3500": ["B3500", "Ram 3500 Van"],
  "dodge:viper": ["Viper", "SRT|Viper"], "dodge:srt-viper": ["SRT|Viper", "Viper"], "dodge:ram-srt-10": ["Ram 1500 SRT-10"], "dodge:ram-1500-srt-10": ["Ram 1500 SRT-10"],
  "ferrari:sf90": ["SF90 Stradale", "SF90 Spider"], "ferrari:sf90-stradale": ["SF90 Stradale"], "ferrari:portofino": ["Portofino", "Portofino M"], "ferrari:296-gtb": ["296 GTB", "296 GTS"], "ferrari:812": ["812 Superfast", "812 GTS"], "ferrari:f12": ["F12 Berlinetta", "F12berlinetta"], "ferrari:california": ["California", "California T"],
  "fiat:500": ["500", "500e", "500c"], "fiat:500e": ["500e"], "fiat:500-abarth": ["500", "500 Abarth"],
  "ram:1500": ["1500", "Dodge|Ram 1500", "Dodge|Ram 1500 Laramie", "Dodge|Ram 1500 SLT", "Dodge|Ram 1500 ST", "Dodge|Ram 1500 Sport", "Dodge|Ram 1500 TRX4", "Dodge|Ram 1500 SRT-10"], "ram:2500": ["2500", "Dodge|Ram 2500", "Dodge|Ram 2500 Laramie", "Dodge|Ram 2500 SLT", "Dodge|Ram 2500 ST", "Dodge|Ram 2500 Power Wagon", "Dodge|Ram 2500 Sport"], "ram:3500": ["3500", "Dodge|Ram 3500", "Dodge|Ram 3500 Laramie", "Dodge|Ram 3500 SLT", "Dodge|Ram 3500 ST"], "nissan:pickup": ["Pickup", "Truck", "Hardbody", "D21"],
  "chevrolet:s-10": ["S10"], "chevrolet:s10-blazer": ["S10 Blazer", "Blazer"], "chevrolet:c-k-1500": ["K1500", "C1500"],
  "chevrolet:express-2500": ["Express 2500"], "chevrolet:express-cargo-2500": ["Express 2500"], "chevrolet:express-cargo": ["Express 1500", "Express 2500"],
  "gmc:savana-cargo": ["Savana 1500", "Savana 2500"], "gmc:savana": ["Savana 1500", "Savana 2500", "Savana 3500"],
  "gmc:hummer-ev": ["Hummer EV Pickup", "Hummer EV SUV"], "gmc:hummer-ev-pickup": ["Hummer EV Pickup"], "gmc:hummer-ev-suv": ["Hummer EV SUV"],
  "ford:f-250": ["F-250 Super Duty", "F-250"], "ford:f-350": ["F-350 Super Duty", "F-350"], "ford:f-450": ["F-450 Super Duty", "F-450"],
  "ford:e-150": ["E-150", "E-150 Econoline", "E-150 Econoline Club Wagon"], "ford:e-250": ["E-250", "E-250 Econoline"], "ford:e-350": ["E-350", "E-350 Super Duty", "E-350 Econoline"],
  "ford:transit": ["Transit-150", "Transit-250", "Transit-350"], "ford:transit-150": ["Transit-150"], "ford:transit-250": ["Transit-250"], "ford:transit-350": ["Transit-350"],
  "ford:shelby-gt500": ["Mustang"], "ford:mustang-shelby-gt500": ["Mustang"], "ford:escort-zx2": ["Escort", "ZX2"],
  "dodge:sprinter": ["Sprinter 2500", "Sprinter 3500"], "mercedesbenz:sprinter": ["Sprinter 2500", "Sprinter 3500", "Sprinter 1500"],
  "dodge:ram-van": ["Ram 1500 Van", "Ram 2500 Van", "Ram 3500 Van", "B1500", "B2500", "B3500"], "dodge:ram-van-1500": ["Ram 1500 Van", "B1500"],
  "dodge:ram-1500-van": ["Ram 1500 Van", "B1500"], "dodge:ram-2500-van": ["Ram 2500 Van", "B2500"], "dodge:ram-3500-van": ["Ram 3500 Van", "B3500"],
  "dodge:ram-wagon": ["Ram 1500 Van", "Ram 2500 Van", "B1500", "B2500"],
  "ram:promaster": ["ProMaster 1500", "ProMaster 2500", "ProMaster 3500"], "ram:promaster-1500": ["ProMaster 1500"], "ram:promaster-2500": ["ProMaster 2500"], "ram:promaster-3500": ["ProMaster 3500"],
  "ram:1500-trx": ["1500 TRX", "TRX", "1500"], "ram:trx": ["1500 TRX", "TRX", "1500"], "ram:c-v": ["C/V"], "ram:cargo-van": ["C/V"],
  "jeep:wrangler-unlimited": ["Wrangler", "Wrangler Unlimited"], "jeep:wrangler-jk": ["Wrangler"], "jeep:wrangler-jl": ["Wrangler"],
  "honda:civic-type-r": ["Civic"], "honda:civic-si": ["Civic"], "acura:cl-type-s": ["CL"], "acura:integra-type-r": ["Integra"],
  "hyundai:ioniq-5": ["Ioniq 5"], "hyundai:ioniq-6": ["Ioniq 6"], "kia:ev6": ["EV6"], "kia:forte5": ["Forte5", "Forte"],
  "lamborghini:huracan": ["Huracan"], "porsche:911-carrera": ["911"], "porsche:918": ["918 Spyder"],
  "porsche:boxster": ["718 Boxster", "Boxster"], "porsche:cayman": ["718 Cayman", "Cayman"], "porsche:718-boxster": ["718 Boxster"], "porsche:718-cayman": ["718 Cayman"],
  "landrover:discovery": ["Discovery", "LR3", "LR4"], "landrover:lr3": ["LR3"], "landrover:lr4": ["LR4"], "landrover:discovery-series-ii": ["Discovery Series II", "Discovery"], "landrover:defender": ["Defender 110", "Defender 90", "Defender 130", "Defender"], "landrover:range-rover-sport": ["Range Rover Sport"],
  "lotus:evora": ["Evora GT", "Evora", "Evora 400"], "karma:revero-gt": ["Revero"], "polestar:polestar-2": ["2"], "polestar:2": ["2"],
  "volvo:c40": ["C40 Recharge"], "volvo:c40-recharge": ["C40 Recharge"], "nissan:gtr": ["GT-R"], "nissan:nv-1500": ["NV1500"], "nissan:nv1500": ["NV1500"], "nissan:nv2500": ["NV2500"], "nissan:nv3500": ["NV3500"],
  "nissan:hardbody": ["Pickup"], "nissan:truck": ["Pickup"], "toyota:pickup": ["Pickup"], "isuzu:pickup": ["Pickup"],
  "oldsmobile:eighty-eight": ["88"], "oldsmobile:88": ["88"], "oldsmobile:ninety-eight": ["98"], "saab:9-3": ["9-3"], "saab:9-5": ["9-5"], "saab:9-7x": ["9-7X"],
  "saturn:s-series": ["SL", "SL1", "SL2", "SC1", "SC2", "SW1", "SW2"], "saturn:l-series": ["L300", "L200", "L100", "LW300", "LW200", "L-Series"],
  "mitsubishi:lancer-evolution": ["Lancer Evolution", "Lancer"], "mitsubishi:eclipse-spyder": ["Eclipse Spyder", "Eclipse"], "mitsubishi:3000gt": ["3000GT", "3000 GT"],
  "mini:cooper": ["Cooper"], "mini:cooper-hardtop": ["Cooper"], "mini:hardtop": ["Cooper"], "mini:cooper-s": ["Cooper"], "mini:countryman": ["Cooper Countryman"], "mini:cooper-countryman": ["Cooper Countryman"],
  "mini:clubman": ["Cooper Clubman"], "mini:cooper-clubman": ["Cooper Clubman"], "mini:paceman": ["Cooper Paceman"], "mini:roadster": ["Cooper Roadster"], "mini:coupe": ["Cooper Coupe"], "mini:convertible": ["Cooper Convertible", "Cooper"],
  "subaru:impreza-wrx": ["Impreza WRX", "Impreza", "WRX"], "subaru:impreza-wrx-sti": ["Impreza WRX STI", "Impreza", "WRX STI"], "subaru:wrx-sti": ["WRX STI"], "subaru:xv-crosstrek": ["XV Crosstrek", "Crosstrek"],
  "suzuki:xl7": ["XL-7", "XL7"], "suzuki:xl-7": ["XL-7", "XL7"],
  "volkswagen:golf-gti": ["GTI", "Golf GTI"], "volkswagen:jetta-gli": ["Jetta", "GLI"], "volkswagen:golf-r": ["Golf R", "Golf"], "volkswagen:new-beetle": ["New Beetle", "Beetle"],
  "volkswagen:golf-sportwagen": ["Golf SportWagen"], "volkswagen:golf-alltrack": ["Golf Alltrack"], "volkswagen:e-golf": ["e-Golf"],
  "cadillac:ct4-v": ["CT4"], "cadillac:ct5-v": ["CT5"], "cadillac:ats-v": ["ATS"], "cadillac:cts-v": ["CTS"], "cadillac:xlr-v": ["XLR"], "cadillac:sts-v": ["STS"], "cadillac:escalade-esv": ["Escalade ESV"], "cadillac:escalade-ext": ["Escalade EXT"],
  "audi:rs5": ["RS5", "RS5 Sportback", "RS 5"], "audi:rs-5": ["RS5", "RS5 Sportback", "RS 5"],
  "bmw:m-coupe": ["Z3", "Z4"], "bmw:m-roadster": ["Z3", "Z4"], "bmw:z3-m": ["Z3"], "bmw:z4-m": ["Z4"], "bmw:alpina-b7": ["Alpina B7"], "bmw:x5-m": ["X5 M", "X5"], "bmw:x6-m": ["X6 M", "X6"], "bmw:x3-m": ["X3 M", "X3"], "bmw:x4-m": ["X4 M", "X4"],
  "chrysler:300c": ["300"], "chrysler:300-c": ["300"], "lexus:rc-f": ["RC F"], "lexus:gs-f": ["GS F"], "lexus:is-f": ["IS F"], "lexus:lc": ["LC500", "LC500h"],
  "mercedesbenz:amg-gt": ["AMG GT", "AMG GT S", "AMG GT C", "AMG GT R", "AMG GT 43", "AMG GT 53", "AMG GT 63", "AMG GT 63 S", "AMG GT 55"], "mercedesbenz:metris": ["Metris"], "mercedesbenz:eqs": ["EQS 450+", "EQS 580", "EQS 450", "EQS 450+ SUV", "EQS 580 SUV", "EQS450+"], "mercedesbenz:eqs-suv": ["EQS 450+ SUV", "EQS 580 SUV", "EQS 450 SUV"], "mercedesbenz:eqe": ["EQE 350+", "EQE 350", "EQE 500", "EQE 350+ SUV", "EQE 500 SUV"], "mercedesbenz:eqe-suv": ["EQE 350+ SUV", "EQE 350 SUV", "EQE 500 SUV"], "mercedesbenz:g-wagon": ["G550", "G63 AMG", "G500"],
  "hummer:h3t": ["H3T", "H3"], "jaguar:xj": ["XJ", "XJ8", "XJR", "XJ6"], "jaguar:xk": ["XK", "XK8", "XKR"],
  "infiniti:g37-sedan": ["G37"], "infiniti:g37-coupe": ["G37"], "infiniti:g35-sedan": ["G35"], "infiniti:g35-coupe": ["G35"],
  "smart:fortwo": ["Fortwo"], "smart:fortwo-electric-drive": ["Fortwo"],
  "pontiac:firebird-trans-am": ["Firebird"], "pontiac:trans-am": ["Firebird"],
  "ford:taurus-sho": ["Taurus"], "ford:club-wagon": ["E-150 Econoline Club Wagon", "E-350 Econoline Club Wagon"],
  "chevrolet:astro-van": ["Astro"], "gmc:safari-van": ["Safari"], "chevrolet:lumina-van": ["Lumina APV"], "chevrolet:lumina-apv": ["Lumina APV"],
  "chevrolet:g20-van": ["G20"], "chevrolet:g10-van": ["G10"], "chevrolet:g30-van": ["G30"], "chevrolet:trailblazer-ext": ["Trailblazer EXT", "TrailBlazer"],
  "kia:soul-ev": ["Soul EV", "Soul"], "tesla:model-3": ["Model 3"], "tesla:model-s": ["Model S"], "tesla:model-x": ["Model X"], "tesla:model-y": ["Model Y"],
  "fiat:500x": ["500X"], "fiat:500l": ["500L"], "fiat:124-spider": ["124 Spider"],
  "ferrari:488-gtb": ["488 GTB", "488"], "ferrari:f8": ["F8 Tributo", "F8 Spider"], "ferrari:f8-tributo": ["F8 Tributo"],
  "bentley:continental-gt": ["Continental GT", "Continental"], "astonmartin:dbx": ["DBX", "DBX707"],
  "buick:regal": ["Regal", "Regal Sportback", "Regal TourX"], "buick:regal-tourx": ["Regal TourX"], "buick:regal-sportback": ["Regal Sportback"],
  "chevrolet:metro": ["Metro"], "geo:metro": ["Metro"],
};

/** Extra trim suffixes USAF uses as model names (beyond what our rows have). */
export const EXTRA_TRIMS = {
  "dodge:ram-1500": ["Laramie", "SLT", "ST", "Sport", "TRX", "TRX4", "SRT-10", "Big Horn", "Lone Star", "Rumble Bee", "Daytona", "Night Runner", "Power Wagon"],
  "dodge:ram-2500": ["Laramie", "SLT", "ST", "Sport", "TRX", "TRX4", "Power Wagon", "Big Horn", "Lone Star"],
  "dodge:ram-3500": ["Laramie", "SLT", "ST", "Sport", "TRX", "Big Horn", "Lone Star"],
};

/** Year-gated variant names for family slugs whose rows often carry only "Base" trims (USAF lists BMW sedans per variant). */
const BMW_VARIANTS = {
  "1-series": [["128i", 2008, 2013], ["135i", 2008, 2013], ["135is", 2013, 2013]],
  "2-series": [["228i", 2014, 2016], ["228i xDrive", 2015, 2016], ["M235i", 2014, 2016], ["M235i xDrive", 2015, 2016], ["230i", 2017, 2026], ["230i xDrive", 2017, 2026], ["M240i", 2017, 2026], ["M240i xDrive", 2017, 2026], ["228i Gran Coupe", 2020, 2024], ["228i xDrive Gran Coupe", 2020, 2024], ["M235i xDrive Gran Coupe", 2020, 2024], ["228 Gran Coupe", 2025, 2026], ["228 xDrive Gran Coupe", 2025, 2026], ["M235 xDrive Gran Coupe", 2025, 2026]],
  "3-series": [["318i", 1991, 1999], ["318is", 1991, 1997], ["318ti", 1995, 1999], ["323i", 1998, 2000], ["323is", 1998, 1999], ["323Ci", 2000, 2000], ["325i", 1992, 1995], ["325is", 1992, 1995], ["325i", 2001, 2006], ["325xi", 2001, 2006], ["325Ci", 2001, 2006], ["328i", 1996, 2000], ["328is", 1996, 1999], ["328Ci", 2000, 2000], ["328i", 2007, 2016], ["328xi", 2007, 2008], ["328i xDrive", 2009, 2016], ["328d", 2014, 2018], ["328d xDrive", 2014, 2018], ["330i", 2001, 2006], ["330xi", 2001, 2006], ["330Ci", 2001, 2006], ["330i", 2017, 2026], ["330i xDrive", 2017, 2026], ["330e", 2016, 2026], ["330e xDrive", 2021, 2026], ["335i", 2007, 2015], ["335xi", 2007, 2008], ["335i xDrive", 2009, 2015], ["335d", 2009, 2011], ["335is", 2011, 2013], ["340i", 2016, 2018], ["340i xDrive", 2016, 2018], ["M340i", 2020, 2026], ["M340i xDrive", 2020, 2026], ["320i", 2013, 2018], ["320i xDrive", 2013, 2018], ["ActiveHybrid 3", 2013, 2015], ["328i GT xDrive", 2014, 2016], ["330i GT xDrive", 2017, 2019], ["340i GT xDrive", 2017, 2019]],
  "4-series": [["428i", 2014, 2016], ["428i xDrive", 2014, 2016], ["435i", 2014, 2016], ["435i xDrive", 2014, 2016], ["430i", 2017, 2026], ["430i xDrive", 2017, 2026], ["440i", 2017, 2020], ["440i xDrive", 2017, 2020], ["M440i", 2021, 2026], ["M440i xDrive", 2021, 2026], ["428i Gran Coupe", 2015, 2016], ["428i xDrive Gran Coupe", 2015, 2016], ["435i Gran Coupe", 2015, 2016], ["435i xDrive Gran Coupe", 2015, 2016], ["430i Gran Coupe", 2017, 2026], ["430i xDrive Gran Coupe", 2017, 2026], ["440i Gran Coupe", 2017, 2020], ["440i xDrive Gran Coupe", 2017, 2020], ["M440i Gran Coupe", 2022, 2026], ["M440i xDrive Gran Coupe", 2022, 2026]],
  "4-series-gran-coupe": [["428i Gran Coupe", 2015, 2016], ["428i xDrive Gran Coupe", 2015, 2016], ["435i Gran Coupe", 2015, 2016], ["435i xDrive Gran Coupe", 2015, 2016], ["430i Gran Coupe", 2017, 2026], ["430i xDrive Gran Coupe", 2017, 2026], ["440i Gran Coupe", 2017, 2020], ["440i xDrive Gran Coupe", 2017, 2020], ["M440i Gran Coupe", 2022, 2026], ["M440i xDrive Gran Coupe", 2022, 2026]],
  "5-series": [["525i", 1990, 1995], ["525i", 2001, 2007], ["525xi", 2006, 2007], ["528i", 1997, 2000], ["528i", 2008, 2016], ["528xi", 2008, 2008], ["528i xDrive", 2009, 2016], ["530i", 1994, 1995], ["530i", 2001, 2007], ["530xi", 2006, 2007], ["530i", 2017, 2026], ["530i xDrive", 2017, 2026], ["530e", 2018, 2026], ["530e xDrive", 2018, 2026], ["535i", 1990, 1993], ["535i", 2008, 2016], ["535xi", 2008, 2008], ["535i xDrive", 2009, 2016], ["535d", 2014, 2016], ["535d xDrive", 2014, 2016], ["535i GT", 2010, 2017], ["535i GT xDrive", 2010, 2017], ["540i", 1994, 2003], ["540i", 2017, 2023], ["540i xDrive", 2017, 2026], ["540d xDrive", 2018, 2018], ["545i", 2004, 2005], ["550i", 2006, 2017], ["550i xDrive", 2011, 2017], ["550i GT", 2010, 2017], ["550i GT xDrive", 2010, 2017], ["M550i xDrive", 2018, 2023], ["ActiveHybrid 5", 2012, 2015], ["i5 eDrive40", 2024, 2026], ["i5 M60 xDrive", 2024, 2026]],
  "6-series": [["645Ci", 2004, 2005], ["650i", 2006, 2019], ["650i xDrive", 2012, 2019], ["640i", 2012, 2019], ["640i xDrive", 2014, 2019], ["640i Gran Coupe", 2013, 2019], ["640i xDrive Gran Coupe", 2014, 2019], ["650i Gran Coupe", 2013, 2019], ["650i xDrive Gran Coupe", 2013, 2019], ["640i xDrive Gran Turismo", 2018, 2019]],
  "7-series": [["735i", 1990, 1992], ["735iL", 1990, 1992], ["740i", 1993, 2001], ["740iL", 1993, 2001], ["750iL", 1990, 2001], ["745i", 2002, 2005], ["745Li", 2002, 2005], ["760i", 2004, 2006], ["760Li", 2003, 2015], ["750i", 2006, 2022], ["750Li", 2006, 2015], ["750i xDrive", 2010, 2022], ["750Li xDrive", 2010, 2015], ["740i", 2011, 2026], ["740Li", 2011, 2015], ["740Li xDrive", 2013, 2015], ["740i xDrive", 2017, 2026], ["740e xDrive", 2017, 2019], ["745e xDrive", 2020, 2022], ["M760i xDrive", 2017, 2022], ["ActiveHybrid 7", 2011, 2015], ["750e xDrive", 2023, 2026], ["760i xDrive", 2023, 2026], ["i7 xDrive60", 2023, 2026], ["i7 eDrive50", 2024, 2026], ["i7 M70 xDrive", 2024, 2026]],
  "8-series": [["840i", 2020, 2026], ["840i xDrive", 2020, 2026], ["M850i xDrive", 2019, 2026], ["840i Gran Coupe", 2020, 2026], ["840i xDrive Gran Coupe", 2020, 2026], ["M850i xDrive Gran Coupe", 2020, 2026], ["840Ci", 1994, 1997], ["850i", 1991, 1994], ["850Ci", 1994, 1997], ["850CSi", 1994, 1995]],
};
const LEXUS_VARIANTS = {
  es: [["ES250", 1990, 1991], ["ES300", 1992, 2003], ["ES330", 2004, 2006], ["ES350", 2007, 2026], ["ES300h", 2013, 2026], ["ES250", 2021, 2026]],
  gs: [["GS300", 1993, 2005], ["GS400", 1998, 2000], ["GS430", 2001, 2007], ["GS350", 2007, 2020], ["GS450h", 2007, 2020], ["GS460", 2008, 2011], ["GS200t", 2016, 2017], ["GS300", 2018, 2020], ["GS F", 2016, 2020]],
  is: [["IS300", 2001, 2005], ["IS250", 2006, 2015], ["IS350", 2006, 2026], ["IS F", 2008, 2014], ["IS200t", 2016, 2017], ["IS300", 2016, 2026], ["IS500", 2022, 2026], ["IS250C", 2010, 2015], ["IS350C", 2010, 2015]],
  ls: [["LS400", 1990, 2000], ["LS430", 2001, 2006], ["LS460", 2007, 2017], ["LS600h", 2008, 2016], ["LS500", 2018, 2026], ["LS500h", 2018, 2026]],
  lc: [["LC500", 2018, 2026], ["LC500h", 2018, 2026]],
  rc: [["RC350", 2015, 2025], ["RC300", 2016, 2025], ["RC200t", 2016, 2017], ["RC F", 2015, 2025]],
  sc: [["SC300", 1992, 2000], ["SC400", 1992, 2000], ["SC430", 2002, 2010]],
  ct: [["CT200h", 2011, 2017]], hs: [["HS250h", 2010, 2012]],
  rx: [["RX300", 1999, 2003], ["RX330", 2004, 2006], ["RX350", 2007, 2026], ["RX400h", 2006, 2008], ["RX450h", 2010, 2022], ["RX350L", 2018, 2022], ["RX450hL", 2018, 2022], ["RX350h", 2023, 2026], ["RX500h", 2023, 2026], ["RX450h+", 2024, 2026]],
  nx: [["NX200t", 2015, 2017], ["NX300", 2018, 2021], ["NX300h", 2015, 2021], ["NX250", 2022, 2026], ["NX350", 2022, 2026], ["NX350h", 2022, 2026], ["NX450h+", 2022, 2026]],
  ux: [["UX200", 2019, 2022], ["UX250h", 2019, 2024], ["UX300h", 2025, 2026]],
  gx: [["GX470", 2003, 2009], ["GX460", 2010, 2023], ["GX550", 2024, 2026]],
  lx: [["LX450", 1996, 1997], ["LX470", 1998, 2007], ["LX570", 2008, 2021], ["LX600", 2022, 2026], ["LX700h", 2025, 2026]],
  tx: [["TX350", 2024, 2026], ["TX500h", 2024, 2026], ["TX550h+", 2024, 2026]],
  rz: [["RZ450e", 2023, 2026], ["RZ300e", 2024, 2026]],
};
const MB_VARIANTS = {
  "c-class": [["C220", 1994, 1996], ["C230", 1997, 2007], ["C240", 2001, 2005], ["C250", 2012, 2015], ["C280", 1994, 2000], ["C280", 2006, 2007], ["C300", 2008, 2026], ["C320", 2001, 2005], ["C350", 2006, 2015], ["C350e", 2016, 2018], ["C400", 2015, 2015], ["C450 AMG", 2016, 2016], ["C36 AMG", 1995, 1997], ["C43 AMG", 1998, 2000], ["C43 AMG", 2017, 2026], ["C32 AMG", 2002, 2004], ["C55 AMG", 2005, 2006], ["C63 AMG", 2008, 2026], ["C63 AMG S", 2015, 2026]],
  "e-class": [["E300", 1996, 1999], ["E300", 2017, 2026], ["E320", 1994, 2009], ["E350", 2006, 2026], ["E400", 2015, 2018], ["E420", 1994, 1997], ["E430", 1998, 2002], ["E450", 2019, 2026], ["E500", 2003, 2006], ["E550", 2007, 2016], ["E250", 2014, 2016], ["E55 AMG", 1999, 2006], ["E63 AMG", 2007, 2026], ["E63 AMG S", 2014, 2026], ["E53 AMG", 2019, 2026], ["E400 Hybrid", 2013, 2014]],
  "s-class": [["S320", 1994, 1999], ["S350", 1994, 1995], ["S350", 2006, 2013], ["S400", 2010, 2013], ["S420", 1994, 1999], ["S430", 2000, 2006], ["S450", 2008, 2011], ["S450", 2018, 2026], ["S500", 1994, 2006], ["S500", 2021, 2026], ["S550", 2007, 2017], ["S560", 2018, 2020], ["S580", 2021, 2026], ["S600", 1994, 2017], ["S55 AMG", 2001, 2006], ["S63 AMG", 2008, 2026], ["S65 AMG", 2006, 2020], ["Maybach S560", 2018, 2020], ["Maybach S580", 2021, 2026], ["Maybach S600", 2016, 2017], ["Maybach S650", 2018, 2020]],
  "cl-class": [["CL500", 1998, 2006], ["CL550", 2007, 2014], ["CL600", 1998, 2014], ["CL55 AMG", 2001, 2006], ["CL63 AMG", 2008, 2014], ["CL65 AMG", 2005, 2014]],
  "sl-class": [["300SL", 1990, 1993], ["500SL", 1990, 1993], ["600SL", 1993, 1993], ["SL320", 1994, 1997], ["SL500", 1994, 2008], ["SL550", 2007, 2020], ["SL600", 1994, 2011], ["SL400", 2015, 2016], ["SL450", 2017, 2020], ["SL55 AMG", 2003, 2008], ["SL63 AMG", 2009, 2020], ["SL65 AMG", 2005, 2020], ["SL43 AMG", 2023, 2026], ["SL55 AMG", 2022, 2026], ["SL63 AMG", 2022, 2026]],
  "slk-class": [["SLK230", 1998, 2004], ["SLK320", 2001, 2004], ["SLK350", 2005, 2016], ["SLK280", 2006, 2008], ["SLK300", 2009, 2011], ["SLK250", 2012, 2015], ["SLK32 AMG", 2002, 2004], ["SLK55 AMG", 2005, 2016]],
  "slc-class": [["SLC300", 2017, 2020], ["SLC43 AMG", 2017, 2020]],
  "m-class": [["ML320", 1998, 2003], ["ML320", 2007, 2009], ["ML350", 2003, 2015], ["ML430", 1999, 2001], ["ML500", 2002, 2007], ["ML550", 2008, 2015], ["ML55 AMG", 2000, 2003], ["ML63 AMG", 2007, 2015], ["ML250", 2015, 2015], ["ML400", 2015, 2015]],
  "gle-class": [["GLE350", 2016, 2026], ["GLE400", 2016, 2019], ["GLE450", 2020, 2026], ["GLE550e", 2016, 2018], ["GLE580", 2020, 2026], ["GLE43 AMG", 2017, 2019], ["GLE53 AMG", 2021, 2026], ["GLE63 AMG", 2016, 2026], ["GLE63 AMG S", 2016, 2026]],
  "g-class": [["G500", 2002, 2008], ["G550", 2009, 2026], ["G55 AMG", 2003, 2011], ["G63 AMG", 2013, 2026], ["G65 AMG", 2016, 2018]],
  "cls-class": [["CLS500", 2006, 2006], ["CLS550", 2007, 2018], ["CLS400", 2015, 2017], ["CLS450", 2019, 2023], ["CLS55 AMG", 2006, 2006], ["CLS63 AMG", 2007, 2018], ["CLS63 AMG S", 2014, 2018], ["CLS53 AMG", 2019, 2023]],
  "cla-class": [["CLA250", 2014, 2026], ["CLA45 AMG", 2014, 2026], ["CLA35 AMG", 2020, 2026]],
  "gla-class": [["GLA250", 2015, 2026], ["GLA45 AMG", 2015, 2026], ["GLA35 AMG", 2021, 2026]],
  "glb-class": [["GLB250", 2020, 2026], ["GLB35 AMG", 2021, 2026]],
  "glc-class": [["GLC300", 2016, 2026], ["GLC350e", 2018, 2020], ["GLC43 AMG", 2017, 2026], ["GLC63 AMG", 2018, 2026], ["GLC63 AMG S", 2018, 2026]],
  "glk-class": [["GLK350", 2010, 2015], ["GLK250", 2013, 2015]],
  "gls-class": [["GLS450", 2017, 2026], ["GLS550", 2017, 2019], ["GLS580", 2020, 2026], ["GLS63 AMG", 2017, 2026], ["Maybach GLS600", 2021, 2026]],
  "gl-class": [["GL320", 2007, 2009], ["GL350", 2010, 2016], ["GL450", 2007, 2016], ["GL550", 2008, 2016], ["GL63 AMG", 2013, 2016]],
  "a-class": [["A220", 2019, 2022], ["A35 AMG", 2020, 2022]],
  "b-class": [["B250e", 2014, 2017]],
  "r-class": [["R350", 2006, 2012], ["R500", 2006, 2007], ["R320", 2007, 2009], ["R63 AMG", 2007, 2007]],
  "eqs-class": [["EQS 450+", 2022, 2026], ["EQS 580", 2022, 2026], ["EQS 450", 2022, 2026]], "eqe-class": [["EQE 350+", 2023, 2026], ["EQE 350", 2023, 2026], ["EQE 500", 2023, 2026]],
};
export function familyVariants(makeSlug, modelSlug, year) {
  const mk = makeKey(makeSlug);
  let tbl = mk === "bmw" ? BMW_VARIANTS[modelSlug] : mk === "lexus" ? LEXUS_VARIANTS[modelSlug] : null;
  if (mk === "mercedesbenz") {
    const amg = /-amg$/.test(modelSlug);
    const body = modelSlug.match(/-(coupe|cabriolet|convertible|wagon|sedan)$/)?.[1];
    const base = modelSlug.replace(/-(amg|coupe|cabriolet|convertible|wagon|sedan)$/, "");
    tbl = MB_VARIANTS[base] ?? MB_VARIANTS[`${base}-class`] ?? null;
    if (tbl && amg) tbl = tbl.filter(([n]) => /AMG/.test(n));
    if (tbl && body && body !== "sedan") { const Body = body.charAt(0).toUpperCase() + body.slice(1); tbl = tbl.flatMap((r) => [r, [`${r[0]} ${Body}`, r[1], r[2]]]); }
  }
  if (!tbl) return [];
  return tbl.filter(([, y0, y1]) => year >= y0 && year <= y1).map(([name]) => ({ name, kind: "family-variant" }));
}

const BODY_WORDS = /\b(sedan|coupe|convertible|cabriolet|roadster|wagon|sportwagen|hatchback|4matic\+?|4motion|quattro|xdrive|sdrive|awd|4wd|2wd|rwd|fwd|4x4|4x2|hybrid|plug-in|phev|e-hybrid|touring|base|standard)\b/gi;
const TRIM_SKIP = /^(base|standard|std|all|n\/a|none|unknown|-)$/i;

/** Make-specific USAF variant names derived from one of OUR trim strings (for family slugs like bmw 3-series / mercedes c-class). */
export function trimVariantCandidates(makeSlug, modelSlug, trim) {
  const mk = makeKey(makeSlug);
  const t = String(trim ?? "").trim();
  if (!t || TRIM_SKIP.test(t) || t.includes(",")) return [];
  const out = [];
  const push = (n, kind) => { n = String(n).replace(/\s+/g, " ").trim(); if (n && !out.some((o) => o.name.toLowerCase() === n.toLowerCase())) out.push({ name: n, kind }); };
  if (mk === "mercedesbenz") {
    let s = t.replace(/\bmercedes-?(benz|amg)?\b/gi, " ").replace(/\b(4matic\+?|coupe|cabriolet|sedan|wagon|convertible|roadster|4-door|2-door|plug-in hybrid|hybrid|bluetec|cdi|kompressor|sport|luxury)\b/gi, " ").replace(/\s+/g, " ").trim();
    // "AMG C 43" / "AMG C43" / "C 43 AMG" / "C43 AMG" -> "C43 AMG";  "C 300" -> "C300";  "GLE 350" -> "GLE350"; "S560 Maybach" -> "Maybach S560"
    let m = s.match(/^(?:amg\s*)?([a-z]{1,3})\s*(\d{2,3})\s*(?:amg)?\s*(s)?$/i);
    if (m) { const core = `${m[1].toUpperCase()}${m[2]}`; const isAmg = /amg/i.test(s); if (isAmg) { push(`${core} AMG${m[3] ? " S" : ""}`, "trim-mb"); push(`AMG ${core}${m[3] ? " S" : ""}`, "trim-mb"); } else { push(core, "trim-mb"); push(`${m[1].toUpperCase()} ${m[2]}`, "trim-mb"); } }
    m = s.match(/^(?:mercedes-)?maybach\s*([a-z]{1,3})\s*(\d{3})$/i) || s.match(/^([a-z]{1,3})\s*(\d{3})\s*maybach$/i);
    if (m) push(`Maybach ${m[1].toUpperCase()}${m[2]}`, "trim-mb");
    m = s.match(/^(?:amg\s*)?(eq[a-z])\s*(\d{3})\+?(?:\s*(4matic|suv|sedan))?$/i);
    if (m) { push(`${m[1].toUpperCase()} ${m[2]}+`, "trim-mb"); push(`${m[1].toUpperCase()}${m[2]}`, "trim-mb"); push(`${m[1].toUpperCase()} ${m[2]}`, "trim-mb"); }
    m = s.match(/^(\d{3})\s*([a-z]{1,3})$/i); // 300E, 190E, 500SL, 560SEL
    if (m) push(`${m[1]}${m[2].toUpperCase()}`, "trim-mb");
    if (/amg\s*gt/i.test(s)) { push("AMG GT", "trim-mb"); push(s.replace(/\s+/g, " "), "trim-mb"); }
    if (/^g\s*\d{2,3}/i.test(s) || /^g-?wagen/i.test(s)) push(s.replace(/\s+/g, ""), "trim-mb");
    if (!out.length) push(s, "trim-raw");
    return out;
  }
  if (mk === "bmw") {
    let s = t.replace(/\b(sedan|coupe|convertible|gran turismo|sports wagon|wagon|touring|4-door|2-door|competition)\b/gi, " ").replace(/\s+/g, " ").trim();
    push(s, "trim-bmw");
    const noDrive = s.replace(/\b[sx]drive\b/gi, " ").replace(/\s+/g, " ").trim();
    if (noDrive !== s) push(noDrive, "trim-bmw");
    if (/\bgran coupe\b/i.test(t) && !/gran coupe/i.test(s)) push(`${s} Gran Coupe`, "trim-bmw");
    return out;
  }
  if (mk === "lexus" || mk === "infiniti" || mk === "acura" || mk === "genesis") {
    let s = t.replace(/\b(f sport|awd|rwd|hybrid|sedan|coupe|convertible|luxury|premium|executive|ultra luxury|base)\b/gi, " ").replace(/\s+/g, " ").trim();
    const m = s.match(/^([a-z]{1,3})\s*(\d{3})\s*([a-z]{1,2})?$/i);
    if (m) { push(`${m[1].toUpperCase()}${m[2]}${m[3] ? m[3] : ""}`, "trim-lex"); push(`${m[1].toUpperCase()} ${m[2]}${m[3] ? m[3] : ""}`, "trim-lex"); }
    else if (s) push(s, "trim-raw");
    return out;
  }
  // generic: "<Model> <Trim>" handled by caller (modelTrimCandidates); here return trim-only variant for family-ish slugs
  const s = t.replace(BODY_WORDS, " ").replace(/\s+/g, " ").trim();
  if (s && s.length >= 2) push(s, "trim-raw");
  return out;
}

/** "<ModelName> <Trim>" candidates (how USAF splits 2005-2010 Dodge Ram: "Ram 1500 Laramie"). */
export function modelTrimCandidates(modelName, trim) {
  const t = String(trim ?? "").trim();
  if (!t || TRIM_SKIP.test(t) || t.includes(",")) return [];
  const out = [];
  const push = (n) => { n = String(n).replace(/\s+/g, " ").trim(); if (n && !out.some((o) => o.name.toLowerCase() === n.toLowerCase())) out.push({ name: n, kind: "model-trim" }); };
  push(`${modelName} ${t}`);
  const stripped = t.replace(BODY_WORDS, " ").replace(/\s+/g, " ").trim();
  if (stripped && stripped !== t) push(`${modelName} ${stripped}`);
  const first = stripped.split(" ")[0];
  if (first && first !== stripped && first.length >= 2) push(`${modelName} ${first}`);
  return out;
}

// ---------------------------------------------------------------------------
// USAF fetch: cached call log (JSONL) + throttled HTTP
// ---------------------------------------------------------------------------
const CALLS_FILE = path.join(CACHE_DIR, "_calls.jsonl");
const callCache = new Map(); // key -> {ok, sizes, at}
let callsLoaded = false;
export function callKey(year, make, model) { return `${year}|${make.toLowerCase()}|${model.toLowerCase().replace(/\s+/g, " ").trim()}`; }
export function loadCalls() {
  if (callsLoaded) return callCache;
  callsLoaded = true;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(CALLS_FILE)) {
    for (const line of fs.readFileSync(CALLS_FILE, "utf8").split(/\r?\n/)) {
      if (!line) continue;
      try { const r = JSON.parse(line); callCache.set(callKey(r.year, r.make, r.model), r); } catch { /* skip */ }
    }
  }
  return callCache;
}
export function callStats() { let ok = 0; for (const v of callCache.values()) if (v.ok) ok++; return { total: callCache.size, ok }; }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export let HTTP_CALLS = 0;
export let HTTP_ERRORS = 0;
/** GET options; returns {ok, sizes[], err?}. Cached forever in _calls.jsonl (negative results too). */
export async function usafOptions(year, make, model, { gapMs = 300 } = {}) {
  loadCalls();
  const k = callKey(year, make, model);
  const hit = callCache.get(k);
  if (hit && !hit.err) return hit;
  const url = `${USAF_URL}?action=options&year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
  let rec;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      HTTP_CALLS++;
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "wtd-audit-pass2/1.0" } });
      clearTimeout(to);
      if (res.status === 429 || res.status >= 500) { HTTP_ERRORS++; await sleep(2000 * (attempt + 1)); continue; }
      const j = await res.json();
      if (j && j.errorMessage && /SOAP API error|timeout|ECONNRESET|fetch failed/i.test(j.errorMessage) && attempt < 2) { HTTP_ERRORS++; await sleep(2000 * (attempt + 1)); continue; }
      const sizes = Array.isArray(j?.options) ? [...new Set(j.options.map((o) => o.tireSize).filter(Boolean))] : [];
      rec = { year, make, model, ok: !!j?.success && sizes.length > 0, sizes, at: Date.now(), err: j?.errorMessage && !j.success && !/no options|not found/i.test(j.errorMessage) ? String(j.errorMessage).slice(0, 120) : undefined };
      if (rec.err && /SOAP API error/i.test(rec.err) && attempt < 2) { HTTP_ERRORS++; await sleep(2000); continue; }
      break;
    } catch (e) {
      HTTP_ERRORS++;
      rec = { year, make, model, ok: false, sizes: [], at: Date.now(), err: String(e).slice(0, 120) };
      await sleep(2000 * (attempt + 1));
    }
  }
  // only persist definitive results (ok, or a clean negative without transport error)
  if (rec && !rec.err) { callCache.set(k, rec); fs.appendFileSync(CALLS_FILE, JSON.stringify(rec) + "\n"); }
  await sleep(gapMs);
  return rec ?? { year, make, model, ok: false, sizes: [], err: "no-response" };
}

// ---------------------------------------------------------------------------
// misc
// ---------------------------------------------------------------------------
export function writeJson(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 1)); }
export function readJson(file, dflt = null) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return dflt; } }
export function toCsv(rows, columns) {
  const esc = (v) => { if (v == null) return ""; const s = typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}
export function writeCsv(name, rows, columns) { fs.mkdirSync(OUT_DIR, { recursive: true }); fs.writeFileSync(path.join(OUT_DIR, name), toCsv(rows, columns)); return rows.length; }
export const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "n/a");
