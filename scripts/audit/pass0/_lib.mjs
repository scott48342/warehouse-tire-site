// Shared helpers for Pass 0 (structural audit). Pure functions + pg pool. No writes to vehicle_fitments.
import pg from "pg";

export const pool = () => new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
export const ACTIVE = "quarantined_at IS NULL";

// ─────────────────────────────────────────────────────────────────────────────
// JSON unwrapping: 849 rows store oem_wheel_sizes as a JSON *string* whose content is a JSON array
// (double-encoded). Some tire array elements are ALSO double-encoded ("[\"265/70R17\",...]").
// ─────────────────────────────────────────────────────────────────────────────
export function unwrapJson(v, depth = 0) {
  if (typeof v === "string" && depth < 3) {
    const s = v.trim();
    if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
      try { return unwrapJson(JSON.parse(s), depth + 1); } catch { return v; }
    }
  }
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wheel size strings. Seen in DB: "17x7.5" (DxW), "7.5x17" (WxD, 2,938 entries), "8Jx17", "4.5Jx13",
// "17x7.5J", "19" (diameter only), "18x8 ET45" (rare).
// Rule: diameter is the number in 12..26 that is >= the other; width in 3..14.
// ─────────────────────────────────────────────────────────────────────────────
const DIA_MIN = 12, DIA_MAX = 26, W_MIN = 3, W_MAX = 14;
export function parseWheelString(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  let offset = null;
  const et = s.match(/\bET\s?(-?\d+(?:\.\d+)?)/i);
  if (et) { offset = parseFloat(et[1]); s = s.replace(et[0], "").trim(); }
  s = s.replace(/\s+/g, "");
  if (/^\d{2}$/.test(s)) {
    const d = parseInt(s, 10);
    return d >= DIA_MIN && d <= DIA_MAX ? { diameter: d, width: null, offset, widthFirst: false, kind: "diameter_only" } : null;
  }
  // width range "8-9x20" / "9-9.5x20" → caller expands to min & max width entries
  const rg = s.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)J?[xX](\d{2})$/);
  if (rg) {
    const w1 = parseFloat(rg[1]), w2 = parseFloat(rg[2]), d = parseInt(rg[3], 10);
    if (d >= DIA_MIN && d <= DIA_MAX && w1 >= W_MIN && w2 <= W_MAX && w1 <= w2) return { diameter: d, width: w1, widthMax: w2, offset, widthFirst: true, kind: "range" };
    return null;
  }
  const m = s.match(/^(\d+(?:\.\d+)?)J?[xX](\d+(?:\.\d+)?)J?$/);
  if (!m) return null;
  const a = parseFloat(m[1]), b = parseFloat(m[2]);
  const isDia = (n) => n >= DIA_MIN && n <= DIA_MAX && Number.isInteger(n);
  const isW = (n) => n >= W_MIN && n <= W_MAX;
  const jNotation = /J[xX]/.test(s); // "8Jx17" is always width-first
  if (jNotation && isW(a) && isDia(b)) return { diameter: b, width: a, offset, widthFirst: true, kind: "WxD" };
  if (isDia(a) && isW(b) && a >= b) return { diameter: a, width: b, offset, widthFirst: false, kind: "DxW" };
  if (isDia(b) && isW(a) && b >= a) return { diameter: b, width: a, offset, widthFirst: true, kind: "WxD" };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tire size strings → rim diameter. Handles metric (P/LT prefix, ZR/RF/VR/SR letters), flotation
// ("33x12.50R20", "31x10.50-15"), vintage alphanumeric ("F70-14", "8.00-15", "735-14", "145SR13"),
// " front"/" rear" suffixes, and double-encoded array elements.
// ─────────────────────────────────────────────────────────────────────────────
export function parseTireSize(raw) {
  if (typeof raw !== "string") return { rim: null, cls: "not_string", norm: null };
  let s = raw.trim();
  let axle = null;
  const ax = s.match(/\s*\(?(front|rear)\)?$/i);
  if (ax) { axle = ax[1].toLowerCase(); s = s.slice(0, ax.index).trim(); }
  s = s.replace(/\s+/g, "");
  let m;
  if ((m = s.match(/^(?:P|LT|T|C)?(\d{3})\/(\d{2,3})([A-Z]{0,3})R?F?(\d{2}(?:\.5)?)(?:[A-Z]{1,2}|\/[A-Z])?(?:\d{2,3}\/?\d{0,3}[A-Z]?)?$/i))) {
    const cls = /^LT/i.test(s) ? "LT" : "metric";
    return { rim: parseFloat(m[4]), cls, norm: s, axle, width: parseInt(m[1], 10), aspect: parseInt(m[2], 10) };
  }
  // "185R14" / "215R15" (no aspect ratio, 80-series implied)
  if ((m = s.match(/^(?:P|LT)?\d{3}R(\d{2})(?:[A-Z]{1,2})?$/i))) return { rim: parseInt(m[1], 10), cls: "metric", norm: s, axle };
  if ((m = s.match(/^(\d{2}(?:\.\d+)?)[xX](\d{1,2}(?:\.\d+)?)([A-Z]{0,2})[R-]?F?(\d{2}(?:\.5)?)(?:[A-Z]{1,2})?$/i))) {
    return { rim: parseFloat(m[4]), cls: "flotation", norm: s, axle };
  }
  // "31/10.50R15" (flotation written with a slash)
  if ((m = s.match(/^(\d{2})\/(\d{1,2}(?:\.\d+)?)R(\d{2})$/i))) return { rim: parseInt(m[3], 10), cls: "flotation", norm: s, axle };
  if ((m = s.match(/^[A-Z]?\d{1,3}(?:\.\d{1,2})?(?:\/\d{2})?[A-Z]{0,2}-(\d{2})(?:LT|C)?$/i))) {
    return { rim: parseInt(m[1], 10), cls: "vintage", norm: s, axle };
  }
  if ((m = s.match(/^\d{3}\/?\d{0,2}[A-Z]{1,2}R(\d{2})$/i))) {
    return { rim: parseInt(m[1], 10), cls: "vintage", norm: s, axle };
  }
  return { rim: null, cls: "unparseable", norm: s, axle };
}

// Flatten oem_tire_sizes (array | {front,rear} | bare string | double-encoded) → { tires: string[], shape, staggeredObj:{front,rear}|null, doubleEncoded:number }
export function normalizeTires(raw) {
  let v = unwrapJson(raw);
  let shape;
  let staggeredObj = null;
  let doubleEncoded = typeof raw === "string" && v !== raw ? 1 : 0;
  let list = [];
  const push = (x) => {
    const u = unwrapJson(x);
    if (Array.isArray(u)) { doubleEncoded++; u.forEach(push); }
    else if (typeof u === "string" && u.trim()) list.push(u.trim());
    else if (u && typeof u === "object" && typeof u.size === "string") list.push(u.size.trim());
  };
  if (v == null) shape = "null";
  else if (Array.isArray(v)) { shape = typeof raw === "string" ? "not-array:string" : "array"; v.forEach(push); }
  else if (typeof v === "object") {
    shape = "obj:" + Object.keys(v).sort().join(",");
    const f = [], r = [];
    const toArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
    toArr(v.front).forEach((x) => { const u = unwrapJson(x); if (typeof u === "string") f.push(u.trim()); });
    toArr(v.rear).forEach((x) => { const u = unwrapJson(x); if (typeof u === "string") r.push(u.trim()); });
    staggeredObj = { front: f, rear: r };
    list = [...f, ...r];
  } else if (typeof v === "string") { shape = "not-array:string"; list = [v.trim()]; }
  else shape = "other:" + typeof v;
  const uniq = [...new Set(list)];
  return { tires: uniq, shape, staggeredObj, doubleEncoded };
}

// ─────────────────────────────────────────────────────────────────────────────
// Wheel normalization → canonical entries
//   { axle:'square'|'front'|'rear', diameter:number, width:number|null, offset:number|null, tireSize:string|null, isStock:boolean }
// isStock is KEPT (deviation from brief) because /api/wheels/fitment-search picks the stock spec via isStock
// and 640 double-encoded rows carry plus-size options flagged isStock:false.
// Returns { entries, shape, issues:[], unparsed:[], mixed:boolean, widthFirst:number, hasFrontRear:boolean }
// ─────────────────────────────────────────────────────────────────────────────
const AXLE = (a) => (a === "front" || a === "rear" ? a : "square");
const num = (x) => { if (x == null || x === "") return null; const n = Number(x); return Number.isFinite(n) ? n : null; };

export function shapeOfWheels(raw) {
  if (raw == null) return "null";
  if (typeof raw === "string") return "not-array:string";
  if (!Array.isArray(raw)) return "not-array:" + typeof raw;
  if (raw.length === 0) return "empty";
  const types = new Set(raw.map((e) => (typeof e === "string" ? "s" : e && typeof e === "object" ? "o" : "x")));
  if (types.size > 1) return "mixed";
  const e0 = raw[0];
  if (typeof e0 === "string") return "strings";
  if (e0 && typeof e0 === "object") {
    if ("axle" in e0) return "obj:axle";
    if ("position" in e0) return "obj:position";
    if ("front_width" in e0) return "obj:front_width";
    if ("size" in e0) return "obj:size";
    if ("front" in e0 && "rear" in e0) return "obj:front/rear";
    if ("d" in e0 && "w" in e0) return "obj:d,o,w";
    if ("notes" in e0) return "obj:notes";
    if ("trim" in e0) return "obj:trim";
    if ("isStaggered" in e0) return "obj:isStaggered";
    if ("staggered" in e0) return "obj:staggered";
    if ("boltPattern" in e0) return "obj:boltPattern";
    if ("offset" in e0) return "obj:width,offset,diameter";
    if ("width" in e0 && "diameter" in e0) return "obj:width,diameter";
    return "obj:other:" + Object.keys(e0).sort().join(",");
  }
  return "other";
}

export function normalizeWheels(raw) {
  const originalShape = shapeOfWheels(raw);
  const v = unwrapJson(raw);
  const out = { entries: [], shape: originalShape, innerShape: originalShape === "not-array:string" ? shapeOfWheels(v) : null, issues: [], unparsed: [], mixed: false, widthFirst: 0, hasFrontRear: false, dropped: [] };
  if (v == null) { out.issues.push("null"); return out; }
  if (!Array.isArray(v)) { out.issues.push("not_array_after_unwrap"); out.unparsed.push(v); return out; }
  if (v.length === 0) { out.issues.push("empty"); return out; }
  const types = new Set(v.map((e) => typeof e));
  out.mixed = types.size > 1;

  const add = (axle, diameter, width, offset, tireSize, isStock, extra) => {
    const d = num(diameter), w = num(width);
    if (d == null || d < DIA_MIN || d > DIA_MAX) { out.unparsed.push(extra ?? { diameter, width }); out.issues.push("bad_diameter"); return; }
    if (w != null && (w < W_MIN || w > W_MAX)) { out.issues.push("bad_width"); }
    out.entries.push({ axle: AXLE(axle), diameter: d, width: w, offset: num(offset), tireSize: tireSize ?? null, isStock: isStock !== false });
  };

  for (const e of v) {
    const el = unwrapJson(e);
    if (typeof el === "string") {
      const p = parseWheelString(el);
      if (!p) { out.unparsed.push(el); out.issues.push("string_unparseable"); continue; }
      if (p.widthFirst) out.widthFirst++;
      if (p.width == null) out.issues.push("diameter_only");
      add("square", p.diameter, p.width, p.offset, null, true, el);
      if (p.kind === "range") { out.issues.push("width_range"); if (p.widthMax !== p.width) add("square", p.diameter, p.widthMax, p.offset, null, true, el); }
      continue;
    }
    if (!el || typeof el !== "object") { out.unparsed.push(el); out.issues.push("bad_element"); continue; }
    // {front:{...}, rear:{...}}
    if (el.front && typeof el.front === "object" && el.rear && typeof el.rear === "object") {
      add("front", el.front.diameter, el.front.width, el.front.offset, null, true, el);
      add("rear", el.rear.diameter, el.rear.width, el.rear.offset, null, true, el);
      continue;
    }
    // {diameter, front_width, rear_width}
    if ("front_width" in el || "rear_width" in el) {
      add("front", el.diameter, el.front_width, el.offset, null, true, el);
      add("rear", el.diameter, el.rear_width, el.offset, null, true, el);
      continue;
    }
    // {size:"8Jx17", tires:[...], offset}
    if (typeof el.size === "string") {
      const p = parseWheelString(el.size);
      if (!p) { out.unparsed.push(el); out.issues.push("size_unparseable"); continue; }
      if (p.widthFirst) out.widthFirst++;
      const tires = Array.isArray(el.tires) ? el.tires.filter((t) => typeof t === "string") : [];
      add("square", p.diameter, p.width, el.offset ?? p.offset, tires.length === 1 ? tires[0] : null, el.isStock, el);
      if (tires.length > 1) out.issues.push("size_multi_tire");
      continue;
    }
    // {d,o,w}
    if ("d" in el && "w" in el) { add(el.axle ?? el.position, el.d, el.w, el.o, null, el.isStock, el); continue; }
    // generic {diameter,width,offset?,axle?,position?,isStock?,tireSize?,notes?,trim?,...}
    if ("diameter" in el || "width" in el) {
      let axle = el.axle;
      // axle:'both' + position:'front'|'rear' → position wins (Mercedes E450 pattern)
      if ((axle == null || axle === "both" || axle === "square") && (el.position === "front" || el.position === "rear")) axle = el.position;
      if (axle == null && el.rear === true) axle = "rear";
      if (axle == null && el.front === true) axle = "front";
      const keep = new Set(["axle", "position", "diameter", "width", "offset", "isStock", "tireSize", "tire", "rear", "front", "boltPattern", "isStaggered", "staggered"]);
      for (const k of Object.keys(el)) if (!keep.has(k)) out.dropped.push({ [k]: el[k] });
      if (num(el.width) == null) out.issues.push("width_null");
      add(axle, el.diameter, el.width, el.offset, typeof el.tireSize === "string" ? el.tireSize : typeof el.tire === "string" ? el.tire : null, el.isStock, el);
      continue;
    }
    out.unparsed.push(el); out.issues.push("unknown_object_shape");
  }
  // 5,452 rows label EVERY entry axle:'front' with no rear/both entries (cache-import/api_import "[expanded]" families).
  // A front-only fitment cannot exist → these are square fitments; relabel and record.
  if (out.entries.length > 0 && out.entries.every((x) => x.axle === "front")) {
    out.entries = out.entries.map((x) => ({ ...x, axle: "square" }));
    out.issues.push("front_only_relabeled_square");
  }
  // de-dupe identical entries
  const seen = new Set();
  out.entries = out.entries.filter((x) => { const k = JSON.stringify([x.axle, x.diameter, x.width, x.offset, x.tireSize, x.isStock]); if (seen.has(k)) return false; seen.add(k); return true; });
  out.hasFrontRear = out.entries.some((x) => x.axle !== "square");
  out.issues = [...new Set(out.issues)];
  return out;
}

// Attach front/rear tire sizes to wheels[].tireSize when a staggered {front,rear} tire object exists and rim matches.
export function attachStaggeredTires(entries, staggeredObj) {
  if (!staggeredObj) return entries;
  return entries.map((w) => {
    if (w.tireSize) return w;
    const pool = w.axle === "front" ? staggeredObj.front : w.axle === "rear" ? staggeredObj.rear : [];
    const t = pool.find((s) => parseTireSize(s).rim === w.diameter);
    return t ? { ...w, tireSize: t } : w;
  });
}

// Plausible center-bore ranges per bolt pattern (mm). Built from well-known OE hubs; outliers → warn.
export const CB_RANGES = {
  "4x100": [54, 67.1], "4x108": [57, 65.1], "4x114.3": [56.5, 67.1], "4x98": [58, 58.1],
  "5x100": [54, 60.1], "5x105": [56.5, 56.6], "5x108": [63.3, 67.1], "5x110": [65, 65.1], "5x112": [57, 66.6],
  "5x114.3": [54, 75], "5x115": [56.5, 71.6], "5x120": [60, 74.1], "5x120.65": [70, 83.1], "5x127": [71.4, 78.3],
  "5x130": [71.5, 84.1], "5x135": [87, 87.1], "5x139.7": [77.8, 108.1], "5x150": [106, 110.1], "5x101.6": [71, 71.1],
  "6x114.3": [66, 71.6], "6x120": [66.9, 70.3], "6x127": [78, 78.1], "6x132": [66.9, 74.5], "6x135": [87, 87.1], "6x139.7": [77.8, 110],
  "8x165.1": [116, 125], "8x170": [124.9, 125], "8x180": [124.1, 124.2], "8x200": [142, 142.1], "8x210": [154, 154.2],
};

export const fmtTable = (rows, cols) => {
  const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
  const line = (r) => cols.map((c, i) => String(r[c] ?? "").padEnd(w[i])).join(" | ");
  return [line(Object.fromEntries(cols.map((c) => [c, c]))), w.map((x) => "-".repeat(x)).join("-+-"), ...rows.map(line)].join("\n");
};
