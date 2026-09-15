// Pass 0 — structural integrity checks on ACTIVE vehicle_fitments rows. READ-ONLY on vehicle_fitments.
//   node --env-file=.env.local scripts/audit/pass0/01-run-checks.mjs                # full run: rebuild audit_pass0_rows, all checks
//   node --env-file=.env.local scripts/audit/pass0/01-run-checks.mjs --skip-load    # reuse audit_pass0_rows, re-run all checks
//   node --env-file=.env.local scripts/audit/pass0/01-run-checks.mjs --only=tire_rim_mismatch [--skip-load]
// Writes: audit_pass0_rows (derived, normalized copy of active rows), audit_pass0_flags, scripts/audit/pass0/out/summary.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, ACTIVE, normalizeWheels, normalizeTires, parseTireSize, attachStaggeredTires, CB_RANGES, fmtTable } from "./_lib.mjs";

const args = process.argv.slice(2);
const SKIP_LOAD = args.includes("--skip-load");
const ONLY = (args.find((a) => a.startsWith("--only=")) || "").split("=")[1] || null;
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
fs.mkdirSync(OUT_DIR, { recursive: true });

const p = pool();
const q = async (s, a = []) => (await p.query(s, a)).rows;

// ═════════════════════════════════════════════════════════════════════════════
// 1. Derive audit_pass0_rows from active rows (JS normalization of the 15 jsonb shapes)
// ═════════════════════════════════════════════════════════════════════════════
async function loadRows() {
  const rows = await q(`SELECT id, year, make, model, display_trim, raw_trim, source, certification_status, bolt_pattern, center_bore_mm,
      thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes FROM vehicle_fitments WHERE ${ACTIVE}`);
  console.log(`active rows loaded: ${rows.length}`);
  await q(`TRUNCATE audit_pass0_rows`);
  const cols = ["fitment_id","year","make","model","display_trim","raw_trim","source","certification_status","bolt_pattern","center_bore_mm","thread_size","seat_type","offset_min_mm","offset_max_mm",
    "wheel_shape","wheel_inner_shape","tire_shape","wheels_norm","wheel_diams","wheel_has_front_rear","wheel_width_first","wheel_mixed","wheel_issues","wheel_unparsed","wheel_dropped",
    "tires_flat","tire_rims","tire_unparsed","tire_axle_suffix","tire_double_encoded","tire_staggered_obj","spec_sig"];
  const casts = { wheels_norm: "::jsonb", wheel_unparsed: "::jsonb", wheel_dropped: "::jsonb", wheel_diams: "::numeric[]", tire_rims: "::numeric[]", wheel_issues: "::text[]", tires_flat: "::text[]", tire_unparsed: "::text[]" };
  const BATCH = 250;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const vals = [], ph = [];
    chunk.forEach((r, ri) => {
      const w = normalizeWheels(r.oem_wheel_sizes);
      const t = normalizeTires(r.oem_tire_sizes);
      const parsed = t.tires.map(parseTireSize);
      const entries = attachStaggeredTires(w.entries, t.staggeredObj);
      const rims = [...new Set(parsed.filter((x) => x.rim != null).map((x) => x.rim))];
      const diams = [...new Set(entries.map((e) => e.diameter))];
      const sig = [r.bolt_pattern, r.center_bore_mm, r.thread_size, JSON.stringify([...entries].sort((a, b) => a.diameter - b.diameter || (a.width ?? 0) - (b.width ?? 0) || a.axle.localeCompare(b.axle))), [...t.tires].sort().join(",")].join("|");
      const rec = {
        fitment_id: r.id, year: r.year, make: r.make, model: r.model, display_trim: r.display_trim, raw_trim: r.raw_trim, source: r.source, certification_status: r.certification_status,
        bolt_pattern: r.bolt_pattern, center_bore_mm: r.center_bore_mm, thread_size: r.thread_size, seat_type: r.seat_type, offset_min_mm: r.offset_min_mm, offset_max_mm: r.offset_max_mm,
        wheel_shape: w.shape, wheel_inner_shape: w.innerShape, tire_shape: t.shape, wheels_norm: JSON.stringify(entries), wheel_diams: diams, wheel_has_front_rear: w.hasFrontRear,
        wheel_width_first: w.widthFirst, wheel_mixed: w.mixed, wheel_issues: w.issues, wheel_unparsed: JSON.stringify(w.unparsed), wheel_dropped: JSON.stringify(w.dropped),
        tires_flat: t.tires, tire_rims: rims, tire_unparsed: parsed.filter((x) => x.rim == null).map((x) => x.norm ?? "?"), tire_axle_suffix: parsed.filter((x) => x.axle).length,
        tire_double_encoded: t.doubleEncoded, tire_staggered_obj: !!t.staggeredObj, spec_sig: sig,
      };
      const base = ri * cols.length;
      ph.push("(" + cols.map((c, ci) => `$${base + ci + 1}${casts[c] || ""}`).join(",") + ")");
      cols.forEach((c) => vals.push(rec[c]));
    });
    await q(`INSERT INTO audit_pass0_rows (${cols.join(",")}) VALUES ${ph.join(",")}`, vals);
  }
  console.log(`audit_pass0_rows filled: ${(await q(`select count(*)::int n from audit_pass0_rows`))[0].n}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Named checks. Each SQL returns: fitment_id, year, make, model, display_trim, severity, detail
// ═════════════════════════════════════════════════════════════════════════════
const R = "audit_pass0_rows";
const SEL = "r.fitment_id, r.year, r.make, r.model, r.display_trim";
const cbValues = Object.entries(CB_RANGES).map(([bp, [lo, hi]]) => `('${bp}',${lo},${hi})`).join(",");

const CHECKS = [
  { name: "dup_trim_per_ymm", desc: "same year/make/model/display_trim appears >1 (error if specs conflict, warn if identical)", sql: `
    WITH g AS (
      SELECT lower(make) mk, lower(model) md, year, coalesce(display_trim,'') dt,
             array_agg(fitment_id ORDER BY fitment_id) ids, count(*) n, count(DISTINCT spec_sig) nsig, array_agg(DISTINCT source) sources
      FROM ${R} GROUP BY 1,2,3,4 HAVING count(*) > 1)
    SELECT ${SEL}, CASE WHEN g.nsig > 1 THEN 'error' ELSE 'warn' END severity,
           jsonb_build_object('kind', CASE WHEN g.nsig > 1 THEN 'conflicting_specs' ELSE 'identical_specs' END, 'dupes', g.n, 'ids', to_jsonb(g.ids), 'sources', to_jsonb(g.sources)) detail
    FROM ${R} r JOIN g ON lower(r.make)=g.mk AND lower(r.model)=g.md AND r.year=g.year AND coalesce(r.display_trim,'')=g.dt` },

  { name: "junk_trim_name", desc: "Front/Rear in trim (error); comma catch-all, trim==model (warn); Base/empty beside real trims (info)", sql: `
    SELECT ${SEL}, 'error' severity, jsonb_build_object('kind','front_rear_in_trim','display_trim',r.display_trim,'raw_trim',r.raw_trim,'source',r.source) detail
      FROM ${R} r WHERE (r.display_trim ~* '\\m(front|rear)\\M' OR r.raw_trim ~* '\\m(front|rear)\\M')
        AND coalesce(r.display_trim,'') !~* 'dual rear wheel' AND coalesce(r.raw_trim,'') !~* 'dual rear wheel'
    UNION ALL
    SELECT ${SEL}, 'warn', jsonb_build_object('kind','comma_catch_all','display_trim',r.display_trim,'source',r.source)
      FROM ${R} r WHERE r.display_trim LIKE '%, %'
    UNION ALL
    SELECT ${SEL}, 'info', jsonb_build_object('kind','equals_model','display_trim',r.display_trim)
      FROM ${R} r WHERE r.display_trim IS NOT NULL AND lower(regexp_replace(r.display_trim,'[^A-Za-z0-9]+','-','g')) = lower(r.model)
    UNION ALL
    SELECT ${SEL}, 'info', jsonb_build_object('kind','base_with_siblings','display_trim',r.display_trim,
             'siblings',(SELECT array_agg(DISTINCT s.display_trim) FROM ${R} s WHERE lower(s.make)=lower(r.make) AND lower(s.model)=lower(r.model) AND s.year=r.year AND coalesce(s.display_trim,'') NOT IN ('','Base')))
      FROM ${R} r WHERE coalesce(r.display_trim,'') IN ('','Base')
        AND EXISTS (SELECT 1 FROM ${R} s WHERE lower(s.make)=lower(r.make) AND lower(s.model)=lower(r.model) AND s.year=r.year AND coalesce(s.display_trim,'') NOT IN ('','Base'))` },

  { name: "wheel_string_width_first", desc: "string wheel entries stored width-first (8x18 / 8Jx17)", sql: `
    SELECT ${SEL}, 'warn', jsonb_build_object('count', r.wheel_width_first, 'shape', r.wheel_shape, 'source', r.source) FROM ${R} r WHERE r.wheel_width_first > 0` },

  { name: "wheel_not_array", desc: "oem_wheel_sizes is a bare jsonb scalar (double-encoded JSON string)", sql: `
    SELECT ${SEL}, 'error', jsonb_build_object('shape', r.wheel_shape, 'inner_shape', r.wheel_inner_shape, 'source', r.source) FROM ${R} r WHERE r.wheel_shape LIKE 'not-array:%'` },

  { name: "tire_not_array", desc: "oem_tire_sizes is a bare jsonb scalar (double-encoded JSON string)", sql: `
    SELECT ${SEL}, 'error', jsonb_build_object('shape', r.tire_shape, 'source', r.source) FROM ${R} r WHERE r.tire_shape LIKE 'not-array:%'` },

  { name: "wheel_shape_nonstandard", desc: "oem_wheel_sizes shape other than obj:axle", sql: `
    SELECT ${SEL}, 'info', jsonb_build_object('shape', r.wheel_shape, 'source', r.source) FROM ${R} r WHERE r.wheel_shape <> 'obj:axle'` },

  { name: "wheel_axle_front_only", desc: "every wheel entry is axle:'front' with no rear/both — square fitment mislabelled; fitment-search filters axle=='both' so these resolve as staggered-with-no-rear", sql: `
    SELECT ${SEL}, 'error', jsonb_build_object('source', r.source, 'entries', jsonb_array_length(r.wheels_norm)) FROM ${R} r WHERE 'front_only_relabeled_square' = ANY(r.wheel_issues)` },

  { name: "wheel_object_stringified", desc: "wheel entries are the literal string '[object Object]' — data destroyed at import, unrecoverable", sql: `
    SELECT ${SEL}, 'error', jsonb_build_object('source', r.source, 'unparsed', r.wheel_unparsed) FROM ${R} r WHERE r.wheel_unparsed::text LIKE '%[object Object]%'` },

  { name: "wheel_unparseable", desc: "wheel entries the canonical converter cannot convert (or all entries dropped)", sql: `
    SELECT ${SEL}, 'error', jsonb_build_object('issues', to_jsonb(r.wheel_issues), 'unparsed', r.wheel_unparsed, 'shape', r.wheel_shape, 'source', r.source)
    FROM ${R} r WHERE (r.wheel_issues && ARRAY['string_unparseable','size_unparseable','unknown_object_shape','bad_diameter','bad_element','not_array_after_unwrap','empty','null']
       OR (jsonb_array_length(r.wheels_norm) = 0 AND r.wheel_shape NOT IN ('empty','null')))
       AND r.wheel_unparsed::text NOT LIKE '%[object Object]%'` },

  { name: "wheel_dims_implausible", desc: "wheel width outside 3..14 in, width null/missing, diameter-only entry, or width range string", sql: `
    SELECT ${SEL}, 'warn', jsonb_build_object('issues', to_jsonb(r.wheel_issues), 'wheels', r.wheels_norm, 'source', r.source) FROM ${R} r WHERE r.wheel_issues && ARRAY['bad_width','diameter_only','width_null','width_range']` },

  { name: "wheel_mixed_types", desc: "oem_wheel_sizes array mixes strings and objects", sql: `
    SELECT ${SEL}, 'warn', jsonb_build_object('source', r.source, 'wheels', r.wheels_norm) FROM ${R} r WHERE r.wheel_mixed` },

  { name: "wheel_dropped_keys", desc: "wheel entries carry per-entry notes/trim that the canonical shape cannot hold (needs trim split)", sql: `
    SELECT ${SEL}, 'warn', jsonb_build_object('dropped', r.wheel_dropped, 'shape', r.wheel_shape) FROM ${R} r WHERE jsonb_array_length(r.wheel_dropped) > 0` },

  { name: "tire_unparseable", desc: "tire size strings with no recognizable rim diameter", sql: `
    SELECT ${SEL}, 'warn', jsonb_build_object('unparsed', to_jsonb(r.tire_unparsed), 'source', r.source) FROM ${R} r WHERE cardinality(r.tire_unparsed) > 0` },

  { name: "tire_double_encoded", desc: "tire array elements that are themselves JSON-encoded arrays", sql: `
    SELECT ${SEL}, 'error', jsonb_build_object('count', r.tire_double_encoded, 'shape', r.tire_shape, 'source', r.source) FROM ${R} r WHERE r.tire_double_encoded > 0 AND r.tire_shape NOT LIKE 'not-array:%'` },

  { name: "tire_axle_suffix", desc: "staggered tires encoded as '245/40R19 front' strings inside a flat array", sql: `
    SELECT ${SEL}, 'warn', jsonb_build_object('count', r.tire_axle_suffix, 'tires', to_jsonb(r.tires_flat), 'source', r.source) FROM ${R} r WHERE r.tire_axle_suffix > 0` },

  { name: "tire_rim_mismatch", desc: "tire rim diameter with no matching OEM wheel diameter (error if none match, warn if partial)", sql: `
    WITH m AS (
      SELECT r.fitment_id, (SELECT array_agg(t) FROM unnest(r.tire_rims) t WHERE NOT (t = ANY(r.wheel_diams))) missing
      FROM ${R} r WHERE cardinality(r.tire_rims) > 0 AND cardinality(r.wheel_diams) > 0)
    SELECT ${SEL}, CASE WHEN cardinality(m.missing) = cardinality(r.tire_rims) THEN 'error' ELSE 'warn' END,
           jsonb_build_object('tire_rims', to_jsonb(r.tire_rims), 'wheel_diams', to_jsonb(r.wheel_diams), 'missing', to_jsonb(m.missing), 'source', r.source)
    FROM ${R} r JOIN m ON m.fitment_id = r.fitment_id WHERE m.missing IS NOT NULL` },

  { name: "empty_bolt_pattern", desc: "bolt_pattern null/empty", sql: `
    SELECT ${SEL}, 'error', jsonb_build_object('source', r.source, 'cb', r.center_bore_mm) FROM ${R} r WHERE coalesce(r.bolt_pattern,'') = ''` },

  { name: "bolt_pattern_malformed", desc: "bolt_pattern not ^\\d+x\\d+(\\.\\d+)?$", sql: `
    SELECT ${SEL}, 'error', jsonb_build_object('bolt_pattern', r.bolt_pattern, 'source', r.source) FROM ${R} r WHERE r.bolt_pattern IS NOT NULL AND r.bolt_pattern <> '' AND r.bolt_pattern !~ '^\\d+x\\d+(\\.\\d+)?$'` },

  { name: "bolt_or_cb_changes_within_run", desc: "consecutive model-years where the set of bolt/CB values changes (info: Pass 3 reviews)", sql: `
    WITH y AS (
      SELECT lower(make) mk, lower(model) md, year, max(make) make, max(model) model, min(fitment_id::text)::uuid rep,
             string_agg(DISTINCT coalesce(bolt_pattern,'?')||'/'||coalesce(center_bore_mm::text,'?'), ';' ORDER BY coalesce(bolt_pattern,'?')||'/'||coalesce(center_bore_mm::text,'?')) sig
      FROM ${R} GROUP BY 1,2,3),
    w AS (SELECT *, lag(sig) OVER (PARTITION BY mk, md ORDER BY year) prev_sig, lag(year) OVER (PARTITION BY mk, md ORDER BY year) prev_year FROM y)
    SELECT w.rep, w.year, w.make, w.model, NULL::text, 'info',
           jsonb_build_object('from_year', w.prev_year, 'to_year', w.year, 'before', w.prev_sig, 'after', w.sig, 'gap_years', w.year - w.prev_year)
    FROM w WHERE w.prev_sig IS NOT NULL AND w.prev_sig <> w.sig` },

  { name: "offset_out_of_range", desc: "offset_min < -80 or offset_max > 75 or min > max (info for HD 8-lug / DRW where +130 is real)", sql: `
    SELECT ${SEL}, CASE WHEN r.bolt_pattern IN ('6x180','6x205') OR r.bolt_pattern LIKE '8x%' OR r.bolt_pattern LIKE '10x%' OR r.model ~* '(350-hd|450|550|3500|4500|5500|drw|dually)' OR r.display_trim ~* 'drw|dual rear' THEN 'info' ELSE 'warn' END,
           jsonb_build_object('offset_min', r.offset_min_mm, 'offset_max', r.offset_max_mm, 'bolt', r.bolt_pattern, 'source', r.source)
    FROM ${R} r WHERE r.offset_min_mm < -80 OR r.offset_max_mm > 75 OR r.offset_min_mm > r.offset_max_mm` },

  { name: "cb_implausible", desc: "center bore outside the plausible range for the bolt pattern family", sql: `
    WITH cb(bp, lo, hi) AS (VALUES ${cbValues})
    SELECT ${SEL}, 'warn', jsonb_build_object('bolt', r.bolt_pattern, 'cb', r.center_bore_mm, 'expected', cb.lo||'-'||cb.hi, 'source', r.source)
    FROM ${R} r JOIN cb ON cb.bp = r.bolt_pattern WHERE r.center_bore_mm IS NOT NULL AND (r.center_bore_mm < cb.lo OR r.center_bore_mm > cb.hi)` },

  { name: "deprecated_source_active", desc: "source LIKE 'deprecated%' but not quarantined", sql: `
    SELECT ${SEL}, 'error', jsonb_build_object('source', r.source, 'certification_status', r.certification_status) FROM ${R} r WHERE r.source LIKE 'deprecated%'` },

  { name: "cert_status_non_certified_active", desc: "active rows the site will never serve (certification_status <> certified) — quarantine or fix", sql: `
    SELECT ${SEL}, 'info', jsonb_build_object('certification_status', r.certification_status, 'source', r.source) FROM ${R} r WHERE coalesce(r.certification_status,'') <> 'certified'` },

  { name: "make_slug_variant", desc: "make slug variants: 'mercedes' vs 'mercedes-benz', '<make> vans/minivans'", sql: `
    SELECT ${SEL}, 'warn', jsonb_build_object('make', r.make, 'proposed', CASE WHEN r.make = 'mercedes' THEN 'mercedes-benz' ELSE regexp_replace(r.make, ' (vans|minivans)$', '') END)
    FROM ${R} r WHERE r.make = 'mercedes' OR r.make ~ ' (vans|minivans)$'` },

  { name: "phantom_year_hint", desc: "year out of 1940..2026 (error); model-year with no sibling year within ±3 (info)", sql: `
    SELECT ${SEL}, 'error', jsonb_build_object('kind','year_out_of_range') FROM ${R} r WHERE r.year > 2026 OR r.year < 1940
    UNION ALL
    SELECT ym.rep, ym.year, ym.make, ym.model, NULL::text, 'info',
           jsonb_build_object('kind', CASE WHEN ym.nyears = 1 THEN 'single_year_model' ELSE 'isolated_year' END, 'rows', ym.n, 'model_years', ym.nyears)
    FROM (SELECT lower(make) mk, lower(model) md, year, max(make) make, max(model) model, min(fitment_id::text)::uuid rep, count(*) n,
                 count(*) OVER (PARTITION BY lower(make), lower(model)) nyears
          FROM ${R} GROUP BY 1,2,3) ym
    WHERE NOT EXISTS (SELECT 1 FROM ${R} b WHERE lower(b.make)=ym.mk AND lower(b.model)=ym.md AND b.year <> ym.year AND abs(b.year - ym.year) <= 3)` },

  { name: "missing_core_fields", desc: "null/empty thread_size, seat_type, center_bore, tires or wheels", sql: `
    SELECT ${SEL}, 'warn', jsonb_build_object('missing', to_jsonb(m.missing), 'source', r.source)
    FROM ${R} r CROSS JOIN LATERAL (SELECT array_remove(ARRAY[
        CASE WHEN coalesce(r.thread_size,'') = '' THEN 'thread_size' END,
        CASE WHEN coalesce(r.seat_type,'') = '' THEN 'seat_type' END,
        CASE WHEN r.center_bore_mm IS NULL THEN 'center_bore_mm' END,
        CASE WHEN cardinality(r.tires_flat) = 0 THEN 'oem_tire_sizes' END,
        CASE WHEN jsonb_array_length(r.wheels_norm) = 0 THEN 'oem_wheel_sizes' END], NULL) missing) m
    WHERE cardinality(m.missing) > 0` },

  { name: "staggered_inconsistent", desc: "tires {front,rear} but wheels all square (warn); wheels front/rear but tires flat (info)", sql: `
    SELECT ${SEL}, 'warn', jsonb_build_object('kind','tires_staggered_wheels_square','wheels', r.wheels_norm, 'tires', to_jsonb(r.tires_flat), 'source', r.source)
      FROM ${R} r WHERE r.tire_staggered_obj AND NOT r.wheel_has_front_rear AND jsonb_array_length(r.wheels_norm) > 0
    UNION ALL
    SELECT ${SEL}, 'info', jsonb_build_object('kind','wheels_staggered_tires_flat','wheels', r.wheels_norm, 'tires', to_jsonb(r.tires_flat), 'source', r.source)
      FROM ${R} r WHERE r.wheel_has_front_rear AND NOT r.tire_staggered_obj AND r.tire_axle_suffix = 0 AND cardinality(r.tires_flat) > 0` },

  { name: "thread_size_nonstandard", desc: "thread_size not in canonical form (M12x1.5 | M14x1.5 | 1/2-20 …): spaces, trailing B, .50", sql: `
    SELECT ${SEL}, 'warn', jsonb_build_object('thread_size', r.thread_size,
           'proposed', regexp_replace(regexp_replace(regexp_replace(r.thread_size, '\\s', '', 'g'), 'B$', ''), '(\\.\\d)0$', '\\1'), 'source', r.source)
    FROM ${R} r WHERE r.thread_size IS NOT NULL AND r.thread_size <> '' AND r.thread_size !~ '^(M1[24]x(1\\.25|1\\.5|1\\.75|2\\.0)|(7/16|1/2|9/16|5/8)-\\d{2})$'` },

  { name: "seat_type_nonstandard", desc: "seat_type not in (conical, ball, flat)", sql: `
    SELECT ${SEL}, 'warn', jsonb_build_object('seat_type', r.seat_type, 'proposed', CASE WHEN lower(r.seat_type) IN ('conical','ball','flat') THEN lower(r.seat_type) ELSE NULL END, 'source', r.source)
    FROM ${R} r WHERE r.seat_type IS NOT NULL AND r.seat_type <> '' AND r.seat_type NOT IN ('conical','ball','flat')` },
];

async function runChecks() {
  const names = ONLY ? CHECKS.filter((c) => c.name === ONLY) : CHECKS;
  if (ONLY && names.length === 0) throw new Error(`unknown check ${ONLY}. Known: ${CHECKS.map((c) => c.name).join(", ")}`);
  if (ONLY) await q(`DELETE FROM audit_pass0_flags WHERE check_name = $1`, [ONLY]);
  else await q(`TRUNCATE audit_pass0_flags RESTART IDENTITY`);
  for (const c of names) {
    const t0 = Date.now();
    const r = await q(`INSERT INTO audit_pass0_flags (fitment_id, year, make, model, display_trim, severity, detail, check_name)
                       SELECT x.*, $1 FROM (${c.sql}) AS x(fitment_id, year, make, model, display_trim, severity, detail)`, [c.name]);
    console.log(`  ${c.name.padEnd(34)} ${String(r.length === 0 ? (await q(`select count(*)::int n from audit_pass0_flags where check_name=$1`, [c.name]))[0].n : r.length).padStart(6)}  (${Date.now() - t0} ms)`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Summary
// ═════════════════════════════════════════════════════════════════════════════
async function summarize() {
  const summary = await q(`SELECT check_name, severity, count(*)::int count, count(DISTINCT fitment_id)::int rows FROM audit_pass0_flags GROUP BY 1,2 ORDER BY 1, CASE severity WHEN 'error' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END`);
  const bySev = await q(`SELECT severity, count(*)::int flags, count(DISTINCT fitment_id)::int rows FROM audit_pass0_flags GROUP BY 1 ORDER BY 1`);
  const rowsWithError = (await q(`SELECT count(DISTINCT fitment_id)::int n FROM audit_pass0_flags WHERE severity = 'error'`))[0].n;
  const rowsAny = (await q(`SELECT count(DISTINCT fitment_id)::int n FROM audit_pass0_flags`))[0].n;
  const active = (await q(`SELECT count(*)::int n FROM audit_pass0_rows`))[0].n;
  const topMakes = await q(`SELECT make, count(*) FILTER (WHERE severity='error')::int errors, count(*) FILTER (WHERE severity='warn')::int warns, count(DISTINCT fitment_id)::int rows FROM audit_pass0_flags WHERE severity IN ('error','warn') GROUP BY 1 ORDER BY 2 DESC, 3 DESC LIMIT 15`);
  const topModels = await q(`SELECT make, model, count(*) FILTER (WHERE severity='error')::int errors, count(*) FILTER (WHERE severity='warn')::int warns, count(DISTINCT fitment_id)::int rows FROM audit_pass0_flags WHERE severity IN ('error','warn') GROUP BY 1,2 ORDER BY 3 DESC, 4 DESC LIMIT 20`);
  const frontOnlyBySource = await q(`SELECT detail->>'source' source, count(*)::int n FROM audit_pass0_flags WHERE check_name='wheel_axle_front_only' GROUP BY 1 ORDER BY 2 DESC LIMIT 15`);
  const errorsByCheckSource = await q(`SELECT check_name, coalesce(detail->>'source', r.source) source, count(*)::int n FROM audit_pass0_flags f JOIN audit_pass0_rows r ON r.fitment_id = f.fitment_id WHERE f.severity='error' GROUP BY 1,2 ORDER BY 1, 3 DESC`);
  const worstRows = await q(`SELECT f.fitment_id, f.year, f.make, f.model, f.display_trim, count(*) FILTER (WHERE severity='error')::int errors, count(*) FILTER (WHERE severity='warn')::int warns, string_agg(DISTINCT check_name, ', ' ORDER BY check_name) checks
      FROM audit_pass0_flags f GROUP BY 1,2,3,4,5 ORDER BY 6 DESC, 7 DESC LIMIT 30`);
  const bySource = await q(`SELECT r.source, count(DISTINCT r.fitment_id)::int rows, count(DISTINCT f.fitment_id) FILTER (WHERE f.severity='error')::int rows_with_error,
      round(100.0 * count(DISTINCT f.fitment_id) FILTER (WHERE f.severity='error') / count(DISTINCT r.fitment_id), 1) pct
      FROM audit_pass0_rows r LEFT JOIN audit_pass0_flags f ON f.fitment_id = r.fitment_id GROUP BY 1 ORDER BY 3 DESC LIMIT 25`);
  const shapes = await q(`SELECT wheel_shape, coalesce(wheel_inner_shape,'') inner_shape, count(*)::int n FROM audit_pass0_rows GROUP BY 1,2 ORDER BY 3 DESC`);
  const axleStats = await q(`SELECT e->>'axle' axle, count(*)::int n FROM audit_pass0_rows, jsonb_array_elements(wheels_norm) e GROUP BY 1 ORDER BY 2 DESC`);
  const junkKinds = await q(`SELECT detail->>'kind' kind, severity, count(*)::int n FROM audit_pass0_flags WHERE check_name IN ('junk_trim_name','dup_trim_per_ymm','staggered_inconsistent','phantom_year_hint') GROUP BY check_name,1,2 ORDER BY 3 DESC`);
  const makeVariants = await q(`SELECT detail->>'make' make, detail->>'proposed' proposed, count(*)::int n FROM audit_pass0_flags WHERE check_name='make_slug_variant' GROUP BY 1,2 ORDER BY 3 DESC`);
  const cbOutliers = await q(`SELECT detail->>'bolt' bolt, detail->>'cb' cb, count(*)::int n, min(make) ex_make, min(model) ex_model FROM audit_pass0_flags WHERE check_name='cb_implausible' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20`);
  const threadVariants = await q(`SELECT detail->>'thread_size' v, detail->>'proposed' proposed, count(*)::int n FROM audit_pass0_flags WHERE check_name='thread_size_nonstandard' GROUP BY 1,2 ORDER BY 3 DESC`);
  const seatVariants = await q(`SELECT detail->>'seat_type' v, detail->>'proposed' proposed, count(*)::int n FROM audit_pass0_flags WHERE check_name='seat_type_nonstandard' GROUP BY 1,2 ORDER BY 3 DESC`);
  const rimMismatchBySource = await q(`SELECT detail->>'source' source, severity, count(*)::int n FROM audit_pass0_flags WHERE check_name='tire_rim_mismatch' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 12`);
  const unparsedTires = await q(`SELECT t, count(*)::int n FROM audit_pass0_flags, jsonb_array_elements_text(detail->'unparsed') t WHERE check_name='tire_unparseable' GROUP BY 1 ORDER BY 2 DESC LIMIT 25`);
  const unparsedWheels = await q(`SELECT detail->'unparsed' u, detail->>'shape' shape, count(*)::int n FROM audit_pass0_flags WHERE check_name='wheel_unparseable' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20`);
  const dupExamples = await q(`SELECT year, make, model, display_trim, detail->>'dupes' dupes, detail->'sources' sources, detail->'ids' ids FROM audit_pass0_flags WHERE check_name='dup_trim_per_ymm' AND severity='error' ORDER BY random() LIMIT 8`);
  const boltChanges = await q(`SELECT make, model, detail->>'from_year' from_year, detail->>'to_year' to_year, detail->>'before' before, detail->>'after' after FROM audit_pass0_flags WHERE check_name='bolt_or_cb_changes_within_run' ORDER BY make, model, year`);

  console.log("\n=== SUMMARY: flags by check + severity ===");
  console.log(fmtTable(summary, ["check_name", "severity", "count", "rows"]));
  console.log("\n=== totals ===");
  console.log(fmtTable(bySev, ["severity", "flags", "rows"]));
  console.log(`active rows: ${active} | rows with >=1 error: ${rowsWithError} (${(100 * rowsWithError / active).toFixed(1)}%) | rows with any flag: ${rowsAny}`);
  console.log("\n=== top makes (error/warn) ===");
  console.log(fmtTable(topMakes, ["make", "errors", "warns", "rows"]));
  console.log("\n=== top models (error/warn) ===");
  console.log(fmtTable(topModels, ["make", "model", "errors", "warns", "rows"]));
  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), active, rowsWithError, rowsAny, bySev, summary, topMakes, topModels, worstRows, bySource, shapes, axleStats, junkKinds, makeVariants, cbOutliers, threadVariants, seatVariants, rimMismatchBySource, unparsedTires, unparsedWheels, dupExamples, boltChanges, frontOnlyBySource, errorsByCheckSource, checks: CHECKS.map((c) => ({ name: c.name, desc: c.desc })) }, null, 2));
  console.log(`\nwrote ${path.join(OUT_DIR, "summary.json")}`);
}

try {
  if (!SKIP_LOAD) await loadRows();
  console.log("running checks…");
  await runChecks();
  await summarize();
} finally {
  await p.end();
}
