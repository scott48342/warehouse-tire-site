#!/usr/bin/env node
/**
 * Run admin tables migration
 * Usage: node scripts/run-admin-migration.mjs
 */

import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL or POSTGRES_URL environment variable");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sqlPath = path.join(__dirname, "migrate-admin-tables.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  
  console.log("Running admin tables migration...");
  
  try {
    const result = await pool.query(sql);
    console.log("Migration completed successfully!");
    
    // Verify tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'admin_%'
      ORDER BY table_name
    `);
    
    console.log("\nAdmin tables created:");
    for (const row of tables.rows) {
      console.log(`  - ${row.table_name}`);
    }
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
