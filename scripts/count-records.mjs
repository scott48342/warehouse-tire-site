import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments').then(r => {
  console.log('Current records:', r.rows[0].cnt);
  pool.end();
});
