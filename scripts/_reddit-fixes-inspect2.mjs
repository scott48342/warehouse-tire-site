// Part 2: Mustang 2018-2023 rows + is_locked trigger check. Compact output.
import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const q = async (s, a = []) => (await p.query(s, a)).rows;
const J = (v) => (typeof v === "string" ? v : JSON.stringify(v));
const line = (r) => `${r.id.slice(0, 8)} ${r.year} | trim=${J(r.raw_trim)} disp=${J(r.display_trim)} sub=${J(r.submodel)} | ${r.bolt_pattern} cb=${r.center_bore_mm} | wheels=${J(r.oem_wheel_sizes)} tires=${J(r.oem_tire_sizes)} | off ${r.offset_min_mm}..${r.offset_max_mm} | src=${r.source} q=${r.quality_tier}${r.quarantined_at ? " QUAR" : ""} mod=${r.modification_id}`;
const pick = "id, year, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes, offset_min_mm, offset_max_mm, source, quality_tier, quarantined_at";

console.log("=== Mustang 2018-2023 ALL rows ===");
(await q(`select ${pick} from vehicle_fitments where make ilike 'ford' and model ilike 'mustang' and year between 2018 and 2023 order by year, raw_trim nulls last`)).forEach((r) => console.log(line(r)));

console.log("\n=== triggers on vehicle_fitments (is_locked enforcement?) ===");
(await q(`select tgname, pg_get_triggerdef(t.oid) def from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname='vehicle_fitments' and not t.tgisinternal`)).forEach((r) => console.log(r.tgname, "::", r.def.slice(0, 200)));
console.log("locked counts:", await q(`select is_locked, count(*)::int n from vehicle_fitments group by 1`));
console.log("quarantined sample reasons:", await q(`select last_modified_reason, count(*)::int n from vehicle_fitments where quarantined_at is not null group by 1 order by 2 desc limit 5`));
await p.end();
