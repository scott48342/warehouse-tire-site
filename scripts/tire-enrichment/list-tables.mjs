import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
console.log("Tables:", r.rows.map(x => x.table_name).join(", "));

// Check for tire-related tables
const tireTablesQ = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%tire%' ORDER BY table_name");
console.log("\nTire-related tables:", tireTablesQ.rows.map(x => x.table_name));

await pool.end();
