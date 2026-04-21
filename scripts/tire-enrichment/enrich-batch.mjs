/**
 * Batch Tire Enrichment - Focus on Popular Makes/Models
 */

import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const PRIORITY_MAKES = [
  "ford", "chevrolet", "toyota", "honda", "nissan", "ram", "gmc", 
  "jeep", "dodge", "hyundai", "kia", "subaru", "mazda", "volkswagen"
];

async function fetchTireSizes(year, make, model) {
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-");
  const modelSlug = model.toLowerCase().replace(/\s+/g, "-");
  const url = "https://tiresize.com/tires/" + makeSlug + "/" + modelSlug + "/" + year + "/";
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
      },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const sizePattern = /\b(\d{3}\/\d{2}R\d{2})\b/gi;
    const matches = html.match(sizePattern) || [];
    const sizes = [...new Set(matches.map(s => s.toUpperCase()))];
    
    // Count occurrences
    const sizeCounts = {};
    matches.forEach(s => {
      const upper = s.toUpperCase();
      sizeCounts[upper] = (sizeCounts[upper] || 0) + 1;
    });
    
    // Filter to reasonable sizes
    const validSizes = sizes.filter(s => {
      const width = parseInt(s.match(/\d{3}/)?.[0] || "0", 10);
      const isReasonable = width >= 185 && width <= 295;
      return isReasonable && (sizeCounts[s] >= 2 || sizes.length <= 3);
    });
    
    return validSizes.length > 0 ? validSizes : null;
  } catch (err) {
    return null;
  }
}

async function getMissingByMake(make, limit = 20) {
  const result = await pool.query(
    "SELECT DISTINCT year, make, model FROM vehicle_fitments " +
    "WHERE LOWER(make) = LOWER($1) " +
    "AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]') " +
    "AND year >= 1990 AND year <= 2026 " +
    "ORDER BY year DESC LIMIT $2",
    [make, limit]
  );
  return result.rows;
}

async function updateTireSizes(make, model, year, tireSizes) {
  const result = await pool.query(
    "UPDATE vehicle_fitments SET oem_tire_sizes = $4::jsonb " +
    "WHERE LOWER(make) = LOWER($1) AND LOWER(model) = LOWER($2) AND year = $3 " +
    "AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]')",
    [make, model, year, JSON.stringify(tireSizes)]
  );
  return result.rowCount;
}

async function main() {
  console.log("Batch Tire Enrichment\n");
  
  let totalEnriched = 0;
  let totalFailed = 0;
  
  for (const make of PRIORITY_MAKES) {
    console.log("\n=== Processing " + make.toUpperCase() + " ===");
    const vehicles = await getMissingByMake(make, 15);
    
    if (vehicles.length === 0) {
      console.log("  No missing vehicles");
      continue;
    }
    
    for (const v of vehicles) {
      process.stdout.write("  " + v.year + " " + v.model + "... ");
      
      const sizes = await fetchTireSizes(v.year, v.make, v.model);
      
      if (!sizes) {
        console.log("not found");
        totalFailed++;
        continue;
      }
      
      const updated = await updateTireSizes(v.make, v.model, v.year, sizes);
      console.log(sizes.join(", ") + " (" + updated + " records)");
      totalEnriched += updated;
      
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("Total enriched: " + totalEnriched + " records");
  console.log("Total failed: " + totalFailed);
  
  const remaining = await pool.query(
    "SELECT COUNT(*) as cnt FROM vehicle_fitments " +
    "WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]'"
  );
  console.log("Still missing: " + remaining.rows[0].cnt);
  
  await pool.end();
}

main().catch(console.error);
