import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

// Check wp_tires structure
console.log("═══════════════════════════════════════════════════════════");
console.log("                    wp_tires TABLE                         ");
console.log("═══════════════════════════════════════════════════════════");

const wpTiresCols = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'wp_tires' 
  ORDER BY ordinal_position
`);
console.log("Columns:", wpTiresCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(", "));

const wpTiresCount = await pool.query("SELECT COUNT(*) FROM wp_tires");
console.log("Row count:", wpTiresCount.rows[0].count);

// Sample a row
const wpSample = await pool.query("SELECT * FROM wp_tires LIMIT 1");
if (wpSample.rows[0]) {
  console.log("\nSample row keys:", Object.keys(wpSample.rows[0]));
}

// Check tire_pattern_specs
console.log("\n═══════════════════════════════════════════════════════════");
console.log("                 tire_pattern_specs TABLE                   ");
console.log("═══════════════════════════════════════════════════════════");

const specsCols = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'tire_pattern_specs' 
  ORDER BY ordinal_position
`);
console.log("Columns:", specsCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(", "));

const specsCount = await pool.query("SELECT COUNT(*) FROM tire_pattern_specs");
console.log("Row count:", specsCount.rows[0].count);

// Check UTQG coverage in tire_pattern_specs
const utqgCoverage = await pool.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN utqg IS NOT NULL AND utqg != '' THEN 1 END) as has_utqg
  FROM tire_pattern_specs
`);
console.log("UTQG coverage:", utqgCoverage.rows[0]);

// Sample with UTQG
const specSample = await pool.query("SELECT * FROM tire_pattern_specs WHERE utqg IS NOT NULL LIMIT 3");
console.log("\nSample rows with UTQG:");
for (const r of specSample.rows) {
  console.log(`  ${r.brand} ${r.pattern} - UTQG: ${r.utqg}, Warranty: ${r.warranty_miles}`);
}

// Check tireweb_sku_cache
console.log("\n═══════════════════════════════════════════════════════════");
console.log("                 tireweb_sku_cache TABLE                    ");
console.log("═══════════════════════════════════════════════════════════");

const cacheCols = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'tireweb_sku_cache' 
  ORDER BY ordinal_position
`);
console.log("Columns:", cacheCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(", "));

const cacheCount = await pool.query("SELECT COUNT(*) FROM tireweb_sku_cache");
console.log("Row count:", cacheCount.rows[0].count);

// Sample
const cacheSample = await pool.query("SELECT * FROM tireweb_sku_cache LIMIT 1");
if (cacheSample.rows[0]) {
  console.log("\nSample row:");
  const r = cacheSample.rows[0];
  console.log(`  SKU: ${r.sku}, Brand: ${r.brand}, Model: ${r.model}`);
  if (r.specs) {
    console.log("  Specs:", typeof r.specs === 'object' ? JSON.stringify(r.specs).slice(0, 200) : r.specs);
  }
}

await pool.end();
