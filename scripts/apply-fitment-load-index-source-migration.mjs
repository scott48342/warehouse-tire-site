import pg from "pg";
import fs from "node:fs";
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const sql = fs.readFileSync(new URL("../drizzle/migrations/0050_fitment_load_index_source.sql", import.meta.url), "utf8");
console.log("Applying 0050_fitment_load_index_source.sql ...");
await pool.query(sql);
const want = ["load_index_source", "load_index_verified_at", "oem_speed_rating"];
const cols = (await pool.query(`select column_name, data_type from information_schema.columns where table_name='vehicle_fitments' and column_name = any($1) order by 1`, [want])).rows;
console.table(cols);
const stamped = (await pool.query(`select count(*)::int n from vehicle_fitments where load_index_source = 'tireguide-pro'`)).rows[0].n;
console.log("tireguide-pro LI rows stamped:", stamped);
await pool.end();
if (cols.length !== want.length) { console.error("verification failed"); process.exit(1); }
console.log("migration 0050 applied");