/**
 * Run a specific SQL migration file
 * 
 * Usage: node scripts/run-migration.js <migration-file>
 * 
 * Example: node scripts/run-migration.js 0013_abandoned_carts.sql
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

async function runMigration() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error("Usage: node scripts/run-migration.js <migration-file>");
    console.error("Example: node scripts/run-migration.js 0013_abandoned_carts.sql");
    process.exit(1);
  }

  const migrationPath = path.join(__dirname, "../drizzle/migrations", migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, "utf8");
  
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Error: POSTGRES_URL or DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log(`Running migration: ${migrationFile}`);
    await pool.query(sql);
    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
