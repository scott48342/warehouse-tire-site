// Did the 02 --apply transaction commit? Count rows still in non-canonical shape vs stamped by pass0 normalizer.
import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const q = async (s) => (await p.query(s)).rows[0];
console.log("active rows:", (await q(`select count(*)::int n from vehicle_fitments where quarantined_at is null`)).n);
console.log("stamped by normalizer:", (await q(`select count(*)::int n from vehicle_fitments where last_modified_reason ilike '%pass0%normaliz%' or last_modified_reason ilike '%canonical%'`)).n);
console.log("non-array wheels (should be 0):", (await q(`select count(*)::int n from vehicle_fitments where quarantined_at is null and jsonb_typeof(oem_wheel_sizes) <> 'array'`)).n);
console.log("string-entry wheels (should be 0):", (await q(`select count(*)::int n from vehicle_fitments where quarantined_at is null and jsonb_typeof(oem_wheel_sizes)='array' and jsonb_array_length(oem_wheel_sizes)>0 and jsonb_typeof(oem_wheel_sizes->0)='string'`)).n);
console.log("axle='square' entries (should be 0):", (await q(`select count(*)::int n from vehicle_fitments where quarantined_at is null and oem_wheel_sizes::text like '%"square"%'`)).n);
console.log("axle='both' rows:", (await q(`select count(*)::int n from vehicle_fitments where quarantined_at is null and oem_wheel_sizes::text like '%"both"%'`)).n);
console.log("last_modified_reason sample:", (await q(`select last_modified_reason r from vehicle_fitments where last_modified_by='clawd' order by updated_at desc limit 1`)).r);
await p.end();
