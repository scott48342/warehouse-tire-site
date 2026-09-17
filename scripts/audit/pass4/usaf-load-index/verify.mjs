// Verify oem_load_index / oem_speed_rating provenance counts after run.mjs --apply.
// Usage: node --env-file=.env.local scripts/audit/pass4/usaf-load-index/verify.mjs
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const q = async (s, a) => (await pool.query(s, a)).rows;
console.table(await q(`select coalesce(load_index_source,'(none)') src, count(*)::int rows, count(oem_load_index)::int li, count(oem_speed_rating)::int sp, max(load_index_verified_at) last
  from vehicle_fitments where quarantined_at is null group by 1 order by 1`));
console.table(await q(`select year, make, model, display_trim, left(oem_tire_sizes::text, 40) sizes, oem_load_index li, oem_speed_rating sp
  from vehicle_fitments where quarantined_at is null and load_index_source='usaf' and year=2024 and make='ford' and model='f-150' order by display_trim limit 6`));
console.table(await q(`select year, make, model, display_trim, left(oem_tire_sizes::text, 40) sizes, oem_load_index li, oem_speed_rating sp, load_index_source src
  from vehicle_fitments where quarantined_at is null and year=2024 and make='ford' and model='mustang-mach-e' order by display_trim`));
await pool.end();
