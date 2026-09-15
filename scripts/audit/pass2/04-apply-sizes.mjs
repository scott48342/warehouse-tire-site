// Pass 2 apply: bring vehicle_fitments.oem_tire_sizes in line with US AutoForce OE sizes and stamp per-field verification.
//   node --env-file=.env.local scripts/audit/pass2/04-apply-sizes.mjs            (dry run: counts + samples, no writes)
//   node --env-file=.env.local scripts/audit/pass2/04-apply-sizes.mjs --apply    (writes, in a transaction per make)
//   --make ford   limit to one make
//
// Rules (per row of audit_pass2_results joined to vehicle_fitments):
//   match          → certify: tire_sizes_verified_at=now, source='usaf', confidence=HIGH (sizes untouched)
//   partial        → NOTE: 'partial' means SOME of our sizes are not OE per USAF (ours_not_in_usaf non-empty), sometimes USAF also has extras.
//                    single-trim Y/M/M: oem_tire_sizes = USAF set (drops non-OE, adds missing), HIGH; ours kept in tire_sizes_prev
//                    multi-trim + trim-level USAF model: oem_tire_sizes = that trim's USAF set, HIGH
//                    multi-trim otherwise: oem_tire_sizes = ours ∩ USAF (drop non-OE only; don't add Y/M/M-wide extras to every trim),
//                                          MEDIUM + needs_trim_split; if intersection empty → USAF set + needs_trim_split
//   mismatch       → single-trim: oem_tire_sizes = USAF set, HIGH (ours in tire_sizes_prev)
//                    multi-trim: per-trim set if usaf_trim_model (HIGH) else USAF set + needs_trim_split (MEDIUM)
//   our_empty      → fill from USAF set, MEDIUM (+needs_trim_split if multi-trim)
//   usaf_missing   → untouched (Tire Guide / OEM pass later)
// Never touches wheel/bolt/offset. Sizes are stored normalized (no 'P' prefix) as strings.
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const ONLY_MAKE = (() => { const i = process.argv.indexOf("--make"); return i > -1 ? process.argv[i + 1] : null; })();
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const now = new Date();

const rows = (await p.query(`
  select r.fitment_id, r.year, r.make, r.model, r.display_trim, r.status, r.trim_status, r.usaf_trim_model,
         r.ours_norm, r.usaf_norm, r.usaf_not_in_ours, r.ours_not_in_usaf,
         f.oem_tire_sizes, f.tire_sizes_verified_at,
         y.n_trims
  from audit_pass2_results r
  join vehicle_fitments f on f.id = r.fitment_id::uuid and f.quarantined_at is null
  join audit_pass2_ymm y on y.year = r.year and y.make = r.make and y.model = r.model
  ${ONLY_MAKE ? "where r.make = $1" : ""}
  order by r.make, r.model, r.year, r.display_trim`, ONLY_MAKE ? [ONLY_MAKE] : [])).rows;

// per-trim USAF sizes for rows that have a trim-level USAF model
const trimSizes = new Map();
{
  const ts = (await p.query(`select year, make_slug, model_slug, model_usaf, array_agg(distinct tire_size_norm) sizes from audit_pass2_usaf_sizes group by 1,2,3,4`)).rows;
  for (const t of ts) trimSizes.set(`${t.year}|${t.make_slug}|${t.model_slug}|${t.model_usaf}`, t.sizes);
}

const uniq = a => [...new Set(a)];
const sortSizes = a => uniq(a).sort();
const plan = [];
const counts = {};
const bump = k => (counts[k] = (counts[k] || 0) + 1);

for (const r of rows) {
  const ours = sortSizes((r.ours_norm || []).filter(Boolean));
  const usaf = sortSizes((r.usaf_norm || []).filter(Boolean));
  const multi = (r.n_trims || 1) > 1;
  const trimSet = r.usaf_trim_model ? trimSizes.get(`${r.year}|${r.make}|${r.model}|${r.usaf_trim_model}`) : null;
  let action = null, newSizes = null, conf = null, split = false;
  switch (r.status) {
    case "match":
      action = "certify"; newSizes = ours; conf = "HIGH"; break;
    case "partial":
      if (!multi) { action = "fix-single"; newSizes = usaf; conf = "HIGH"; }
      else if (trimSet) { action = "fix-trim"; newSizes = sortSizes(trimSet); conf = "HIGH"; }
      else {
        const inter = ours.filter(s => usaf.includes(s));
        if (inter.length) { action = "prune-nonoe"; newSizes = inter; conf = "MEDIUM"; split = true; }
        else { action = "replace-ymm"; newSizes = usaf; conf = "MEDIUM"; split = true; }
      }
      break;
    case "mismatch":
      if (!multi) { action = "replace"; newSizes = usaf; conf = "HIGH"; }
      else if (trimSet) { action = "replace-trim"; newSizes = sortSizes(trimSet); conf = "HIGH"; }
      else { action = "replace-ymm"; newSizes = usaf; conf = "MEDIUM"; split = true; }
      break;
    case "our_empty":
      action = "fill"; newSizes = trimSet ? sortSizes(trimSet) : usaf; conf = "MEDIUM"; split = multi && !trimSet; break;
    default:
      bump("skip:" + r.status); continue;
  }
  if (!newSizes || newSizes.length === 0) { bump("skip:no-sizes"); continue; }
  bump(action);
  plan.push({ id: r.fitment_id, year: r.year, make: r.make, model: r.model, trim: r.display_trim, action, ours, newSizes, conf, split, changed: JSON.stringify(ours) !== JSON.stringify(newSizes) });
}

console.log(`rows considered: ${rows.length}; planned: ${plan.length}`);
console.table(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([action, n]) => ({ action, n })));
console.log(`rows whose sizes change: ${plan.filter(x => x.changed).length}; needs_trim_split flagged: ${plan.filter(x => x.split).length}`);
for (const a of ["fix-single", "fix-trim", "prune-nonoe", "replace", "replace-trim", "replace-ymm", "fill"]) {
  const ex = plan.filter(x => x.action === a).slice(0, 4);
  if (ex.length) { console.log(`\n-- ${a} examples --`); for (const e of ex) console.log(`  ${e.year} ${e.make} ${e.model} [${e.trim}]  ${e.ours.join(",")}  →  ${e.newSizes.join(",")}`); }
}

if (!APPLY) { console.log("\nDRY RUN — nothing written. Re-run with --apply."); await p.end(); process.exit(0); }

// apply per make in transactions
const byMake = new Map();
for (const x of plan) { if (!byMake.has(x.make)) byMake.set(x.make, []); byMake.get(x.make).push(x); }
let done = 0;
for (const [mk, arr] of byMake) {
  const c = await p.connect();
  try {
    await c.query("begin");
    for (const x of arr) {
      await c.query(`
        update vehicle_fitments set
          oem_tire_sizes = $2::jsonb,
          tire_sizes_prev = case when $6::boolean then $3::jsonb else tire_sizes_prev end,
          tire_sizes_verified_at = $4,
          tire_sizes_source = 'usaf',
          tire_sizes_confidence = $5,
          tire_sizes_needs_trim_split = $7,
          updated_at = now(),
          last_modified_by = 'audit-pass2-apply',
          last_modified_reason = $8
        where id = $1::uuid`,
        [x.id, JSON.stringify(x.newSizes), JSON.stringify(x.ours), now, x.conf, x.changed, x.split, `pass2:${x.action}`]);
    }
    await c.query("commit");
    done += arr.length;
    console.log(`applied ${mk}: ${arr.length} rows (total ${done})`);
  } catch (e) { await c.query("rollback"); console.error(`ROLLBACK ${mk}:`, e.message); }
  finally { c.release(); }
}
await p.end();
console.log(`✓ applied ${done} rows`);
