// Enrich Crossfire tire sizes specifically

import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Crossfire is staggered: 225/40R18 front, 255/35R19 rear
const crossfireSizes = ["225/40R18", "255/35R19"];

async function main() {
  console.log("Updating Chrysler Crossfire tire sizes...");
  console.log("Sizes:", crossfireSizes.join(", "));
  
  const result = await pool.query(`
    UPDATE vehicle_fitments
    SET oem_tire_sizes = $1::jsonb
    WHERE LOWER(make) = 'chrysler'
      AND LOWER(model) = 'crossfire'
    RETURNING year, display_trim
  `, [JSON.stringify(crossfireSizes)]);
  
  console.log(`\nUpdated ${result.rowCount} records:`);
  result.rows.forEach(r => {
    console.log(`  - ${r.year} ${r.display_trim || "(base)"}`);
  });
  
  await pool.end();
}

main().catch(console.error);
