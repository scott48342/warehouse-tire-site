// Prints the shared facts every audit subagent needs. Run: node --env-file=.env.local scripts/audit/_shared-facts.mjs
import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const q = async (s) => (await p.query(s)).rows;
const T = (rows) => rows.map((r) => Object.values(r).join(" | ")).join("\n");

console.log("=== vehicle_fitments totals ===");
console.log(T(await q(`select count(*)::int total, count(*) filter (where quarantined_at is not null)::int quarantined, count(distinct make)::int makes, count(distinct (make,model))::int models, min(year) miny, max(year) maxy from vehicle_fitments`)));
console.log("\n=== rows by decade (active) ===");
console.log(T(await q(`select (year/10*10) as decade, count(*)::int n from vehicle_fitments where quarantined_at is null group by 1 order by 1`)));
console.log("\n=== source families (active) ===");
console.log(T(await q(`select source, count(*)::int n from vehicle_fitments where quarantined_at is null group by 1 order by 2 desc limit 25`)));
console.log("\n=== quality_tier / certification_status / confidence_tag ===");
console.log(T(await q(`select quality_tier, certification_status, confidence_tag, count(*)::int n from vehicle_fitments where quarantined_at is null group by 1,2,3 order by 4 desc limit 15`)));
console.log("\n=== oem_wheel_sizes shape census (active) ===");
console.log(T(await q(`select case
  when jsonb_typeof(oem_wheel_sizes)<>'array' then 'not-array:'||coalesce(jsonb_typeof(oem_wheel_sizes),'null')
  when jsonb_array_length(oem_wheel_sizes)=0 then 'empty'
  when jsonb_typeof(oem_wheel_sizes->0)='string' then 'strings'
  when oem_wheel_sizes->0 ? 'axle' then 'obj:axle'
  when oem_wheel_sizes->0 ? 'position' then 'obj:position'
  when oem_wheel_sizes->0 ? 'front_width' then 'obj:front_width'
  else 'obj:other:'||(select string_agg(k,',') from jsonb_object_keys(oem_wheel_sizes->0) k) end shape, count(*)::int n
  from vehicle_fitments where quarantined_at is null group by 1 order by 2 desc`)));
console.log("\n=== oem_tire_sizes shape census (active) ===");
console.log(T(await q(`select case when jsonb_typeof(oem_tire_sizes)='array' then 'array' when jsonb_typeof(oem_tire_sizes)='object' then 'obj:'||(select string_agg(k,',') from jsonb_object_keys(oem_tire_sizes) k) else coalesce(jsonb_typeof(oem_tire_sizes),'null') end shape, count(*)::int n from vehicle_fitments where quarantined_at is null group by 1 order by 2 desc`)));
console.log("\n=== bolt_pattern distinct values (top 30) ===");
console.log(T(await q(`select bolt_pattern, count(*)::int n from vehicle_fitments where quarantined_at is null group by 1 order by 2 desc limit 30`)));
console.log("\n=== make list (active) ===");
console.log((await q(`select make, count(*)::int n from vehicle_fitments where quarantined_at is null group by 1 order by 1`)).map((r) => `${r.make}(${r.n})`).join(", "));
console.log("\n=== sample rows (one per wheel shape) ===");
for (const r of await q(`select distinct on (shape) * from (select *, case when jsonb_typeof(oem_wheel_sizes->0)='string' then 's' when oem_wheel_sizes->0 ? 'axle' then 'a' when oem_wheel_sizes->0 ? 'position' then 'p' when oem_wheel_sizes->0 ? 'front_width' then 'f' else 'o' end shape from vehicle_fitments where quarantined_at is null and jsonb_typeof(oem_wheel_sizes)='array' and jsonb_array_length(oem_wheel_sizes)>0) x order by shape, year desc`)) {
  console.log(`${r.shape} :: ${r.year} ${r.make} ${r.model} raw=${r.raw_trim} disp=${r.display_trim} sub=${r.submodel} mod=${r.modification_id} bolt=${r.bolt_pattern} cb=${r.center_bore_mm} thr=${r.thread_size} seat=${r.seat_type} off=${r.offset_min_mm}..${r.offset_max_mm} wheels=${JSON.stringify(r.oem_wheel_sizes)} tires=${JSON.stringify(r.oem_tire_sizes)} src=${r.source} q=${r.quality_tier}`);
}
console.log("\n=== related tables ===");
console.log(T(await q(`select table_name from information_schema.tables where table_schema='public' and (table_name ilike '%fitment%' or table_name ilike '%vehicle%' or table_name ilike '%audit%' or table_name ilike '%quarant%') order by 1`)));
await p.end();
