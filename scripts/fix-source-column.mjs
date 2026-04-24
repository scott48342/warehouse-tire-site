import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

console.log("Altering source column from varchar(50) to varchar(100)...");

try {
  await pool.query(`ALTER TABLE vehicle_fitments ALTER COLUMN source TYPE varchar(100)`);
  console.log("✓ Column altered successfully");
} catch (e) {
  if (e.message.includes("already")) {
    console.log("Column already correct size");
  } else {
    console.error("Error:", e.message);
  }
}

await pool.end();
