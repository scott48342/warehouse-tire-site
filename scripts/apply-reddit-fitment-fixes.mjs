// Apply fitment-data corrections surfaced by the r/tires launch thread (2026-09-14/15).
//   node --env-file=.env.local scripts/apply-reddit-fitment-fixes.mjs            # dry run (default)
//   node --env-file=.env.local scripts/apply-reddit-fitment-fixes.mjs --apply    # commit
// Every touched row gets last_modified_by/reason + audit_original_data snapshot. Quarantine = quarantined_at set (never DELETE).
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const WHO = "clawd";
const WHY = "r/tires thread 2026-09-14 corrections (reddit.com/r/tires/comments/1wgf0mq)";
const SRC = "reddit-correction-2026-09-15";

const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
const q = async (s, a = []) => (await c.query(s, a)).rows;
const n = (r) => r.length;

// Snapshot originals into audit_original_data (only first time), stamp who/why.
const STAMP = `last_modified_by = $1, last_modified_reason = $2, updated_at = now(),
  audit_original_data = COALESCE(audit_original_data, to_jsonb(vehicle_fitments) - 'audit_original_data')`;

try {
  await c.query("BEGIN");
  const log = [];

  // ───────────────────────── 1. LEXUS GS ─────────────────────────
  // 1a. Phantom "GS F" 2006–2015 (GS F debuted MY2016) → quarantine
  let r = await q(`UPDATE vehicle_fitments SET quarantined_at = now(), ${STAMP}
    WHERE make ILIKE 'lexus' AND model ILIKE 'gs' AND year BETWEEN 2006 AND 2015
      AND raw_trim = 'GS F' AND quarantined_at IS NULL RETURNING id, year`, [WHO, WHY + " — GS F did not exist before MY2016"]);
  log.push(`Lexus GS: quarantined phantom 'GS F' rows 2006-2015: ${n(r)}`);

  // 1b. Phantom US "GS 300" 2007–2011 (US GS 300 was MY2006 only; 2007+ = GS 350) → quarantine
  r = await q(`UPDATE vehicle_fitments SET quarantined_at = now(), ${STAMP}
    WHERE make ILIKE 'lexus' AND model ILIKE 'gs' AND year BETWEEN 2007 AND 2011
      AND raw_trim = 'GS 300' AND quarantined_at IS NULL RETURNING id, year`, [WHO, WHY + " — US GS 300 was MY2006 only"]);
  log.push(`Lexus GS: quarantined phantom US 'GS 300' rows 2007-2011: ${n(r)}`);

  // 1c. Width fix on expanded rows: 17x7→17x7.5, 18x7.5→18x8 (3rd+4th gen). Wheel entries here are objects {diameter,width,...}.
  r = await q(`
    UPDATE vehicle_fitments SET
      oem_wheel_sizes = (
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(w) = 'object' AND (w->>'diameter')::numeric = 17 AND (w->>'width')::numeric = 7   THEN jsonb_set(w, '{width}', '7.5')
            WHEN jsonb_typeof(w) = 'object' AND (w->>'diameter')::numeric = 18 AND (w->>'width')::numeric = 7.5 THEN jsonb_set(w, '{width}', '8')
            WHEN jsonb_typeof(w) = 'string' AND w #>> '{}' = '17x7'   THEN '"17x7.5"'::jsonb
            WHEN jsonb_typeof(w) = 'string' AND w #>> '{}' = '18x7.5' THEN '"18x8"'::jsonb
            ELSE w END)
        FROM jsonb_array_elements(oem_wheel_sizes) w),
      ${STAMP}
    WHERE make ILIKE 'lexus' AND model ILIKE 'gs' AND year BETWEEN 2006 AND 2015
      AND quarantined_at IS NULL
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(oem_wheel_sizes) w WHERE
            (jsonb_typeof(w) = 'object' AND ((w->>'diameter')::numeric = 17 AND (w->>'width')::numeric = 7 OR (w->>'diameter')::numeric = 18 AND (w->>'width')::numeric = 7.5))
         OR (jsonb_typeof(w) = 'string' AND (w #>> '{}') IN ('17x7','18x7.5')))
    RETURNING id, year, raw_trim`, [WHO, WHY + " — OE widths are 17x7.5 / 18x8 (owner-confirmed, matches manual row)"]);
  log.push(`Lexus GS: corrected 17x7/18x7.5 → 17x7.5/18x8 on ${n(r)} rows (${r.map((x) => x.year + ":" + x.raw_trim).join(", ")})`);

  // 1d. Relabel f-sport-mod rows shown as plain "GS 350" (18x8+45 only) → "GS 350 Sport Package" for 2006–2012 (F Sport name began MY2013)
  r = await q(`UPDATE vehicle_fitments SET display_trim = 'GS 350 Sport Package', submodel = 'Sport Package', ${STAMP}
    WHERE make ILIKE 'lexus' AND model ILIKE 'gs' AND year BETWEEN 2006 AND 2012
      AND modification_id LIKE 'lexus-gs-f-sport-%' AND display_trim = 'GS 350' RETURNING id, year`, [WHO, WHY + " — disambiguate Sport Package row from base GS 350"]);
  log.push(`Lexus GS: relabeled Sport Package rows: ${n(r)}`);

  // 1e. Catch-all manual rows "GS 300, GS 350, GS F, F Sport" → clearer label (keep data; it was correct)
  r = await q(`UPDATE vehicle_fitments SET display_trim = CASE WHEN year <= 2011 THEN 'GS 350 (all trims)' ELSE 'GS 350 / F Sport (all trims)' END, ${STAMP}
    WHERE make ILIKE 'lexus' AND model ILIKE 'gs' AND year BETWEEN 2006 AND 2015
      AND display_trim = 'GS 300, GS 350, GS F, F Sport' RETURNING id`, [WHO, WHY + " — remove non-existent GS F from catch-all label"]);
  log.push(`Lexus GS: relabeled catch-all rows: ${n(r)}`);

  // ───────────────────────── 2. ASTRO / SAFARI ─────────────────────────
  // 2a. 2003–2005 Astro: six-lug (6x139.7) 16" only
  r = await q(`UPDATE vehicle_fitments SET bolt_pattern = '6x139.7', center_bore_mm = 78.1,
      oem_wheel_sizes = '["16x6.5"]'::jsonb, oem_tire_sizes = '["215/70R16"]'::jsonb, ${STAMP}
    WHERE make ILIKE 'chevrolet' AND model ILIKE 'astro' AND year BETWEEN 2003 AND 2005 AND quarantined_at IS NULL
    RETURNING id, year`, [WHO, WHY + " — 2003-05 Astro/Safari moved to 6x139.7 16in (GMT half-ton hubs/brakes)"]);
  log.push(`Astro 2003-2005: set 6x139.7 / 16x6.5 / 215-70R16 on ${n(r)} rows`);

  // 2b. AWD rows 1990–2002 for Astro (6x139.7); clone from the 2WD/Base row of same year
  r = await q(`
    INSERT INTO vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm,
      thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source, quality_tier, is_locked, last_modified_by, last_modified_reason)
    SELECT v.year, v.make, v.model, v.year || '-chevrolet-astro-awd', 'AWD', 'AWD', 'AWD', '6x139.7', 78.1,
      v.thread_size, v.seat_type, v.offset_min_mm, v.offset_max_mm, v.oem_wheel_sizes, v.oem_tire_sizes, $3, 'complete', true, $1, $2
    FROM vehicle_fitments v
    WHERE v.make ILIKE 'chevrolet' AND v.model ILIKE 'astro' AND v.year BETWEEN 1990 AND 2002 AND v.quarantined_at IS NULL
      AND (v.display_trim IN ('2WD','Base'))
      AND NOT EXISTS (SELECT 1 FROM vehicle_fitments a WHERE a.make ILIKE 'chevrolet' AND a.model ILIKE 'astro' AND a.year = v.year AND a.display_trim = 'AWD')
    RETURNING id, year`, [WHO, WHY + " — AWD Astro/Safari used 6x139.7 (1990-2002)", SRC]);
  log.push(`Astro AWD 1990-2002: inserted ${n(r)} rows`);
  // and relabel the existing 2000–2002 "Base" as 2WD for clarity
  r = await q(`UPDATE vehicle_fitments SET display_trim = '2WD', submodel = '2WD', ${STAMP}
    WHERE make ILIKE 'chevrolet' AND model ILIKE 'astro' AND year BETWEEN 2000 AND 2002 AND display_trim = 'Base' RETURNING id`, [WHO, WHY]);
  log.push(`Astro 2000-2002: relabeled Base→2WD: ${n(r)}`);

  // 2c. GMC Safari 2000–2005 missing entirely → clone from Astro same year (SL/SLE/SLT collapsed to drivetrain rows like Astro)
  r = await q(`
    INSERT INTO vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm,
      thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source, quality_tier, is_locked, last_modified_by, last_modified_reason)
    SELECT v.year, 'gmc', 'safari', v.year || '-gmc-safari-' || lower(v.display_trim), v.raw_trim, v.display_trim, v.submodel, v.bolt_pattern, v.center_bore_mm,
      v.thread_size, v.seat_type, v.offset_min_mm, v.offset_max_mm, v.oem_wheel_sizes, v.oem_tire_sizes, $3, 'complete', true, $1, $2
    FROM vehicle_fitments v
    WHERE v.make ILIKE 'chevrolet' AND v.model ILIKE 'astro' AND v.year BETWEEN 2000 AND 2005 AND v.quarantined_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM vehicle_fitments s WHERE s.make ILIKE 'gmc' AND s.model ILIKE 'safari' AND s.year = v.year)
    RETURNING id, year, display_trim`, [WHO, WHY + " — Safari is the Astro twin; 2000-05 rows were missing", SRC]);
  log.push(`Safari 2000-2005: inserted ${n(r)} rows (from Astro twins)`);
  // 2d. Safari AWD 1990–1999 (clone SL row per year)
  r = await q(`
    INSERT INTO vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm,
      thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source, quality_tier, is_locked, last_modified_by, last_modified_reason)
    SELECT DISTINCT ON (v.year) v.year, v.make, v.model, v.year || '-gmc-safari-awd', 'AWD', 'AWD', 'AWD', '6x139.7', 78.1,
      v.thread_size, v.seat_type, v.offset_min_mm, v.offset_max_mm, v.oem_wheel_sizes, v.oem_tire_sizes, $3, 'complete', true, $1, $2
    FROM vehicle_fitments v
    WHERE v.make ILIKE 'gmc' AND v.model ILIKE 'safari' AND v.year BETWEEN 1990 AND 1999 AND v.quarantined_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM vehicle_fitments a WHERE a.make ILIKE 'gmc' AND a.model ILIKE 'safari' AND a.year = v.year AND a.display_trim = 'AWD')
    ORDER BY v.year, v.display_trim
    RETURNING id, year`, [WHO, WHY + " — AWD Safari used 6x139.7 (1990-2002)", SRC]);
  log.push(`Safari AWD 1990-1999: inserted ${n(r)} rows`);

  // ───────────────────────── 3. FORD MUSTANG ─────────────────────────
  // 3a. Quarantine junk "X Front X" / "X Rear X" split rows (2018)
  r = await q(`UPDATE vehicle_fitments SET quarantined_at = now(), ${STAMP}
    WHERE make ILIKE 'ford' AND model ILIKE 'mustang' AND source = 'deprecated-staggered-split' AND quarantined_at IS NULL
    RETURNING id, year, raw_trim`, [WHO, WHY + " — staggered front/rear halves imported as trim names"]);
  log.push(`Mustang: quarantined deprecated-staggered-split junk trims: ${n(r)}`);

  // 3b. Normalize reversed "WxD" wheel strings on tgp_solutions rows (8x18 → 18x8), fix cb 70.4→70.5
  r = await q(`
    UPDATE vehicle_fitments SET
      oem_wheel_sizes = (SELECT jsonb_agg(
          CASE WHEN jsonb_typeof(w)='string' AND (w #>> '{}') ~ '^\\d+(\\.\\d+)?x\\d+(\\.\\d+)?$'
                    AND split_part(w #>> '{}','x',1)::numeric < split_part(w #>> '{}','x',2)::numeric
               THEN to_jsonb(split_part(w #>> '{}','x',2) || 'x' || split_part(w #>> '{}','x',1))
               ELSE w END) FROM jsonb_array_elements(oem_wheel_sizes) w),
      center_bore_mm = 70.5, ${STAMP}
    WHERE make ILIKE 'ford' AND model ILIKE 'mustang' AND source = 'tgp_solutions' AND year BETWEEN 2015 AND 2023 AND quarantined_at IS NULL
    RETURNING id, year, raw_trim, oem_wheel_sizes`, [WHO, WHY + " — wheel sizes were stored width-first; hub bore is 70.5"]);
  log.push(`Mustang: normalized reversed wheel strings + cb on tgp_solutions rows: ${n(r)} → ${r.map((x) => x.raw_trim + "=" + JSON.stringify(x.oem_wheel_sizes)).join("; ")}`);

  // 3c. Add missing "EcoBoost Performance Pack" 2015–2023 (19x9 square, 255/40R19)
  r = await q(`
    INSERT INTO vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm,
      thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source, quality_tier, is_locked, last_modified_by, last_modified_reason)
    SELECT g.year, g.make, g.model, 'ford-mustang-ecoboost-performance-pack-' || g.year, 'ecoboost-performance-pack', 'EcoBoost Performance Pack', 'EcoBoost Performance Pack',
      '5x114.3', 70.5, g.thread_size, g.seat_type, g.offset_min_mm, g.offset_max_mm,
      '[{"axle":"square","width":9,"offset":null,"isStock":true,"diameter":19}]'::jsonb, '["255/40R19"]'::jsonb, $3, 'complete', true, $1, $2
    FROM vehicle_fitments g
    WHERE g.make ILIKE 'ford' AND g.model ILIKE 'mustang' AND g.raw_trim = 'gt-performance-pack' AND g.year BETWEEN 2015 AND 2023 AND g.quarantined_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM vehicle_fitments e WHERE e.make ILIKE 'ford' AND e.model ILIKE 'mustang' AND e.year = g.year AND e.raw_trim = 'ecoboost-performance-pack')
    RETURNING id, year`, [WHO, WHY + " — EcoBoost PP: 19x9 square, 255/40R19 (owner-confirmed)", SRC]);
  log.push(`Mustang: inserted EcoBoost Performance Pack rows: ${n(r)} (${r.map((x) => x.year).join(",")})`);

  console.log(`\n${APPLY ? "APPLYING" : "DRY RUN"} —\n  ` + log.join("\n  "));
  if (APPLY) { await c.query("COMMIT"); console.log("\nCOMMITTED."); }
  else { await c.query("ROLLBACK"); console.log("\nRolled back (dry run). Re-run with --apply to commit."); }
} catch (e) {
  await c.query("ROLLBACK");
  console.error("FAILED, rolled back:", e.message);
  process.exitCode = 1;
} finally {
  c.release();
  await p.end();
}
