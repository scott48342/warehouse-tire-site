/**
 * Read-only coverage impact of the source-verification gate (2026-09-18).
 * Mirrors src/lib/fitment-db/sourceVerification.ts rules in SQL. Writes nothing.
 * Run: node --env-file=.env.local scripts/audit/source-gate-impact.cjs
 */
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("SET default_transaction_read_only = on");
  const approvedWheel = ["xref:wheelpros", "wheelpros-xref", "scott+wheelpros-xref", "tireguide-pro", "scott", "fwr-spotcheck+platform"];
  const approvedRow = ["tireguide-pro", "manual-research", "tgp_solutions"];
  const q = `
    WITH live AS (
      SELECT v.*, (SELECT count(*) FROM vehicle_fitments t
                    WHERE t.year=v.year AND lower(t.make)=lower(v.make) AND lower(t.model)=lower(v.model)
                      AND t.quarantined_at IS NULL) AS trim_count
      FROM vehicle_fitments v WHERE v.quarantined_at IS NULL
    ), g AS (
      SELECT *,
        CASE
          WHEN wheel_specs_source IS NOT NULL THEN (wheel_specs_source = ANY($1) AND coalesce(upper(wheel_specs_confidence),'') <> 'LOW')
          ELSE (source = ANY($2))
        END AS wheel_ok,
        CASE
          WHEN tire_sizes_source IS NULL THEN false
          WHEN upper(coalesce(tire_sizes_confidence,'')) = 'LOW' THEN false
          WHEN tire_sizes_source = 'tireguide-pro' THEN true
          WHEN tire_sizes_source IN ('usaf','usaf+reddit') THEN (coalesce(tire_sizes_needs_trim_split,false) = false AND trim_count = 1)
          ELSE false
        END AS tire_ok
      FROM live
    )
    SELECT
      count(*)::int AS live_rows,
      count(*) FILTER (WHERE wheel_ok)::int AS wheel_verified,
      count(*) FILTER (WHERE NOT wheel_ok)::int AS wheel_unverified,
      count(*) FILTER (WHERE tire_ok)::int AS tire_verified,
      count(*) FILTER (WHERE NOT tire_ok)::int AS tire_unverified,
      count(*) FILTER (WHERE wheel_ok AND tire_ok)::int AS both_verified,
      count(*) FILTER (WHERE year >= 2015 AND wheel_ok)::int AS wheel_verified_2015plus,
      count(*) FILTER (WHERE year >= 2015)::int AS rows_2015plus
    FROM g`;
  const r = await c.query(q, [approvedWheel, approvedRow]);
  console.log("IMPACT:", JSON.stringify(r.rows[0]));
  const byWheelSrc = await c.query(`
    SELECT coalesce(wheel_specs_source, '(null) row:' || coalesce(source,'?')) AS src, count(*)::int n
    FROM vehicle_fitments WHERE quarantined_at IS NULL
      AND NOT (CASE WHEN wheel_specs_source IS NOT NULL THEN (wheel_specs_source = ANY($1) AND coalesce(upper(wheel_specs_confidence),'') <> 'LOW') ELSE (source = ANY($2)) END)
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15`, [approvedWheel, approvedRow]);
  console.log("WHEEL_UNVERIFIED_BY_SOURCE:", byWheelSrc.rows.map((x) => `${x.src}=${x.n}`).join(" | "));
  await c.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
