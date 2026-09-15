// Inspect the fitment rows flagged by the r/tires thread (2026-09-14/15) before fixing. Compact one-line-per-row output.
import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const q = async (s, a = []) => (await p.query(s, a)).rows;
const W = (w) => (Array.isArray(w) ? w.map((x) => (typeof x === "string" ? x : `${x.diameter ?? x.d ?? "?"}x${x.width ?? x.w ?? "?"}${x.offset != null ? "+" + x.offset : ""}${x.position ? "/" + x.position[0] : ""}`)).join(",") : JSON.stringify(w));
const line = (r) => `${r.id.slice(0, 8)} ${r.year} ${r.make ? r.make + " " : ""}${r.model} | trim=${JSON.stringify(r.raw_trim)} disp=${JSON.stringify(r.display_trim)} sub=${JSON.stringify(r.submodel)} | ${r.bolt_pattern} cb=${r.center_bore_mm} | wheels=[${W(r.oem_wheel_sizes)}] tires=[${(r.oem_tire_sizes || []).join(",")}] | off ${r.offset_min_mm}..${r.offset_max_mm} | src=${r.source} q=${r.quality_tier}${r.quarantined_at ? " QUAR" : ""}${r.is_locked ? " LOCKED" : ""} mod=${r.modification_id}`;
const pick = "id, year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes, offset_min_mm, offset_max_mm, source, quality_tier, quarantined_at, is_locked";

console.log("=== 1. Lexus GS 2006-2015 ===");
(await q(`select ${pick} from vehicle_fitments where make ilike 'lexus' and model ilike 'gs%' and year between 2006 and 2015 order by year, raw_trim nulls last`)).forEach((r) => console.log(line(r)));

console.log("\n=== 2. Chevrolet Astro / GMC Safari ===");
(await q(`select ${pick} from vehicle_fitments where (make ilike 'chevrolet' and model ilike 'astro%') or (make ilike 'gmc' and model ilike 'safari%') order by make, year, raw_trim nulls last`)).forEach((r) => console.log(line(r)));

console.log("\n=== 3. Ford Mustang 2015-2023: rows with Front/Rear in trim, or GT/EcoBoost ===");
(await q(`select ${pick} from vehicle_fitments where make ilike 'ford' and model ilike 'mustang' and year between 2015 and 2023 and (coalesce(raw_trim,'') ~* 'front|rear' or coalesce(display_trim,'') ~* 'front|rear' or coalesce(raw_trim,'') ~* 'gt|ecoboost') order by year, raw_trim nulls last`)).forEach((r) => console.log(line(r)));
console.log("\nMustang trims per year:");
(await q(`select year, count(*)::int n, string_agg(coalesce(display_trim,raw_trim,'<null>'), ' | ' order by raw_trim) trims from vehicle_fitments where make ilike 'ford' and model ilike 'mustang' and year between 2015 and 2023 group by year order by year`)).forEach((r) => console.log(`${r.year} (${r.n}): ${r.trims}`));

await p.end();
