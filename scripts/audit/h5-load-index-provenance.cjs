// H5 (audit 2026-09-18): read-only survey of load-index provenance in vehicle_fitments.
// Run: node --env-file=.env.local scripts/audit/h5-load-index-provenance.cjs
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log("== load_index_source values ==");
  const a = await c.query(
    `select coalesce(load_index_source,'NULL') lis, count(*)::int n,
            min(load_index_verified_at)::date first_at, max(load_index_verified_at)::date last_at,
            count(oem_load_index)::int with_li
     from vehicle_fitments group by 1 order by 2 desc`
  );
  console.table(a.rows);
  console.log("== totals ==");
  const b = await c.query(
    `select count(*)::int total, count(oem_load_index)::int with_li,
            count(*) filter (where oem_load_index is not null and load_index_source is null)::int li_no_src,
            count(*) filter (where oem_load_index is not null and load_index_source = 'tireguide-pro')::int li_tg,
            count(*) filter (where oem_load_index is not null and load_index_source is not null and load_index_source <> 'tireguide-pro')::int li_other_src
     from vehicle_fitments`
  );
  console.table(b.rows);
  console.log("== how many rows have a load index but tire sizes NOT sourced from tireguide-pro ==");
  const d = await c.query(
    `select coalesce(tire_sizes_source,'NULL') tss, count(*)::int n, count(oem_load_index)::int with_li
     from vehicle_fitments group by 1 order by 2 desc limit 10`
  );
  console.table(d.rows);
  console.log("== random samples with a load index ==");
  const s = await c.query(
    `select year, make, model, display_trim, oem_load_index li, oem_speed_rating sr, load_index_source lis, source, oem_tire_sizes
     from vehicle_fitments where oem_load_index is not null order by random() limit 6`
  );
  console.table(s.rows.map((r) => ({ ...r, oem_tire_sizes: JSON.stringify(r.oem_tire_sizes).slice(0, 40) })));
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
