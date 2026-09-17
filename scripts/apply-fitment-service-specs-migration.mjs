import pg from "pg";
import fs from "node:fs";
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const sql = fs.readFileSync(new URL("../drizzle/migrations/0049_fitment_service_specs.sql", import.meta.url), "utf8");
console.log("Applying 0049_fitment_service_specs.sql ...");
await pool.query(sql);
const want = ["lug_torque_ftlb", "tire_pressure_front_psi", "tire_pressure_rear_psi", "oem_load_index"];
const cols = (await pool.query(
  `select column_name, data_type from information_schema.columns where table_name='vehicle_fitments' and column_name = any($1) order by 1`,
  [want],
)).rows;
console.table(cols);
await pool.end();
if (cols.length !== want.length || cols.some((c) => c.data_type !== "integer")) { console.error("verification failed"); process.exit(1); }
console.log("✓ migration 0049 applied");
