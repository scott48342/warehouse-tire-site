// H5 Option A: apply migration 0051 (additive columns for per-size OE load index).
//   node --env-file=.env.local scripts/apply-fitment-load-index-by-size-migration.mjs
// Run ONLY on Scott's go. Safe with the current deploy (columns are additive, unread until the
// h5-option-a-runtime branch ships). Rollback: drizzle/migrations/0051_rollback.sql.
import pg from "pg";
import fs from "node:fs";
if (!process.argv.includes("--yes")) { console.error("Refusing without --yes (Scott's explicit go)."); process.exit(2); }
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const sql = fs.readFileSync(new URL("../drizzle/migrations/0051_fitment_load_index_by_size.sql", import.meta.url), "utf8");
console.log("Applying 0051_fitment_load_index_by_size.sql ...");
await pool.query(sql);
const want = ["oem_load_index_by_size", "oem_speed_rating_by_size", "load_index_by_size_source", "load_index_by_size_verified_at"];
const cols = (await pool.query(`select column_name, data_type from information_schema.columns where table_name='vehicle_fitments' and column_name = any($1) order by 1`, [want])).rows;
console.table(cols);
if (cols.length !== want.length) { console.error("Expected 4 columns, got", cols.length); process.exitCode = 1; }
await pool.end();
