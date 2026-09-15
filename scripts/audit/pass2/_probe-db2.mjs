// Read-only DB probe for Pass 2 design: trims for family slugs, Y/M/M counts, tire-size shapes.
import { pool } from "../pass1/00-lib.mjs";
const p = pool();
const q = async (s, a) => (await p.query(s, a)).rows;
const T = (rows) => rows.map((r) => Object.values(r).join(" | ")).join("\n");

console.log("=== distinct active Y/M/M 1990-2026 & rows ===");
console.log(T(await q(`select count(distinct (year,make,model))::int ymm, count(*)::int rows_ from vehicle_fitments where quarantined_at is null and year between 1990 and 2026`)));

console.log("\n=== columns of vehicle_fitments ===");
console.log((await q(`select column_name from information_schema.columns where table_name='vehicle_fitments' order by ordinal_position`)).map(r => r.column_name).join(", "));

for (const [mk, md] of [["bmw","3-series"],["mercedes","c-class"],["mercedes-benz","c-class"],["lexus","es"],["infiniti","q50"],["audi","a4"],["chevrolet","silverado-2500hd"],["ford","f-250-super-duty"],["dodge","ram-1500"],["ram","1500"],["mercedes-benz","gle"],["bmw","x5"]]) {
  const r = await q(`select year, raw_trim, display_trim, submodel, oem_tire_sizes::text t from vehicle_fitments where quarantined_at is null and make=$1 and model=$2 and year in (2005,2012,2020) order by year, display_trim limit 14`, [mk, md]);
  console.log(`\n=== ${mk} | ${md} (${r.length}) ===`);
  console.log(T(r));
}

console.log("\n=== family-ish slugs (series|class|-e) ===");
console.log(T(await q(`select make, model, count(*)::int n from vehicle_fitments where quarantined_at is null and year>=1990 and (model ~ '(series|class)$') group by 1,2 order by 3 desc limit 40`)));
await p.end();
