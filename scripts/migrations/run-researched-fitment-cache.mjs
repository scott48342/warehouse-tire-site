#!/usr/bin/env node
/**
 * Run migration: Create researched_fitment_cache table
 * 
 * Usage: node scripts/migrations/run-researched-fitment-cache.mjs
 */

import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("Error: POSTGRES_URL or DATABASE_URL environment variable required");
    process.exit(1);
  }
  
  console.log("Connecting to database...");
  const client = new pg.Client({ connectionString });
  await client.connect();
  
  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, "create-researched-fitment-cache.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    
    console.log("Running migration: create-researched-fitment-cache.sql");
    await client.query(sql);
    
    console.log("✅ Migration completed successfully!");
    
    // Verify table exists
    const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'researched_fitment_cache'
    `);
    
    if (result.rows[0].count === "1") {
      console.log("✅ Table researched_fitment_cache exists");
    } else {
      console.error("❌ Table was not created");
      process.exit(1);
    }
    
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
