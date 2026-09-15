import pg from "pg";
import fs from "node:fs";
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const sql = fs.readFileSync(new URL("../drizzle/migrations/0048_fitment_field_verification.sql", import.meta.url), "utf8");
console.log("Applying 0048_fitment_field_verification.sql ...");
await pool.query(sql);
const cols = (await pool.query(`select column_name from information_schema.columns where table_name='vehicle_fitments' and column_name in ('tire_sizes_verified_at','tire_sizes_source','tire_sizes_confidence','tire_sizes_prev','tire_sizes_needs_trim_split','wheel_specs_verified_at','wheel_specs_source','wheel_specs_confidence') order by 1`)).rows.map(r => r.column_name);
const idx = (await pool.query(`select indexname from pg_indexes where tablename='vehicle_fitments' and indexname in ('vehicle_fitments_tire_verified_idx','vehicle_fitments_wheel_verified_idx')`)).rows.map(r => r.indexname);
console.table([{ columns: cols.length, indexes: idx.length }]);
console.log(cols.join(", "));
await pool.end();
if (cols.length !== 8 || idx.length !== 2) { console.error("verification failed"); process.exit(1); }
console.log("✓ migration 0048 applied");
