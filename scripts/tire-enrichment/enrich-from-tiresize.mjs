/**
 * Tire Size Enrichment from TireSize.com
 * 
 * Fetches missing tire sizes from tiresize.com and updates the database.
 * Respects rate limits: 15 queries/hour, 75 queries/day.
 * 
 * Usage:
 *   node scripts/tire-enrichment/enrich-from-tiresize.mjs [--limit N] [--dry-run]
 */

import pg from "pg";
import fs from "fs";
import path from "path";

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find(a => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 50;

// Load DB connection
const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Rate limiting state
const THROTTLE_FILE = "scripts/tire-enrichment/throttle-state.json";
const MAX_PER_HOUR = 15;
const MAX_PER_DAY = 75;

function loadThrottleState() {
  try {
    if (fs.existsSync(THROTTLE_FILE)) {
      return JSON.parse(fs.readFileSync(THROTTLE_FILE, "utf-8"));
    }
  } catch {}
  return { tiresize: { hourly: [], daily: [] } };
}

function saveThrottleState(state) {
  fs.mkdirSync(path.dirname(THROTTLE_FILE), { recursive: true });
  fs.writeFileSync(THROTTLE_FILE, JSON.stringify(state, null, 2));
}

function checkThrottle() {
  const state = loadThrottleState();
  const now = Date.now();
  const hourAgo = now - 3600000;
  const dayAgo = now - 86400000;
  
  // Clean old entries
  state.tiresize.hourly = state.tiresize.hourly.filter(t => t > hourAgo);
  state.tiresize.daily = state.tiresize.daily.filter(t => t > dayAgo);
  
  if (state.tiresize.hourly.length >= MAX_PER_HOUR) {
    const waitMs = state.tiresize.hourly[0] - hourAgo;
    console.log(`⏱️ Hourly rate limit reached. Wait ${Math.ceil(waitMs/60000)} minutes.`);
    return false;
  }
  
  if (state.tiresize.daily.length >= MAX_PER_DAY) {
    const waitMs = state.tiresize.daily[0] - dayAgo;
    console.log(`⏱️ Daily rate limit reached. Wait ${Math.ceil(waitMs/3600000)} hours.`);
    return false;
  }
  
  saveThrottleState(state);
  return true;
}

function recordQuery() {
  const state = loadThrottleState();
  const now = Date.now();
  state.tiresize.hourly.push(now);
  state.tiresize.daily.push(now);
  saveThrottleState(state);
}

/**
 * Fetch tire sizes from tiresize.com
 */
async function fetchTireSizesFromTireSize(year, make, model) {
  // Normalize for tiresize.com URL format
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-");
  const modelSlug = model.toLowerCase().replace(/\s+/g, "-");
  
  const url = `https://tiresize.com/tires/${makeSlug}/${modelSlug}/${year}/`;
  
  console.log(`  Fetching: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
      },
    });
    
    if (!response.ok) {
      console.log(`  ❌ HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract tire sizes from the page
    // TireSize.com typically shows sizes like "225/45R17" in the content
    const sizePattern = /\b(\d{3}\/\d{2}R\d{2}|\d{2}x[\d.]+R\d{2}|P\d{3}\/\d{2}R\d{2}|LT\d{3}\/\d{2}R\d{2})\b/gi;
    const matches = html.match(sizePattern) || [];
    
    // Dedupe and normalize
    const sizes = [...new Set(matches.map(s => s.toUpperCase()))];
    
    // Filter out unrealistic sizes (sanity check)
    const validSizes = sizes.filter(s => {
      const width = parseInt(s.match(/\d{3}/)?.[0] || s.match(/\d{2}x/)?.[0] || "0", 10);
      return width >= 155 && width <= 355;
    });
    
    if (validSizes.length === 0) {
      console.log(`  ⚠️ No valid tire sizes found in page`);
      return null;
    }
    
    console.log(`  ✅ Found ${validSizes.length} sizes: ${validSizes.join(", ")}`);
    return validSizes;
    
  } catch (err) {
    console.log(`  ❌ Fetch error: ${err.message}`);
    return null;
  }
}

/**
 * Get vehicles missing tire sizes, prioritized by popularity
 */
async function getMissingVehicles(limit) {
  // Get vehicles without tire sizes, prioritized by common makes/models
  const result = await pool.query(`
    SELECT DISTINCT ON (make, model, year)
      year, make, model, modification_id
    FROM vehicle_fitments
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]')
      AND year >= 1990  -- Focus on vehicles where tiresize.com likely has data
    ORDER BY make, model, year DESC
    LIMIT $1
  `, [limit]);
  
  return result.rows;
}

/**
 * Update tire sizes for a vehicle in the database
 */
async function updateTireSizes(make, model, year, tireSizes) {
  const sizesJson = JSON.stringify(tireSizes);
  
  const result = await pool.query(`
    UPDATE vehicle_fitments
    SET oem_tire_sizes = $4::jsonb
    WHERE LOWER(make) = LOWER($1)
      AND LOWER(model) = LOWER($2)
      AND year = $3
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]')
  `, [make, model, year, sizesJson]);
  
  return result.rowCount;
}

/**
 * Main enrichment loop
 */
async function main() {
  console.log("🔍 Tire Size Enrichment from TireSize.com");
  console.log(`   Limit: ${limit} vehicles, Dry run: ${dryRun}`);
  console.log("");
  
  // Check rate limit first
  if (!checkThrottle()) {
    process.exit(1);
  }
  
  // Get vehicles missing tire sizes
  const vehicles = await getMissingVehicles(limit);
  console.log(`Found ${vehicles.length} vehicles missing tire sizes\n`);
  
  let enriched = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const v of vehicles) {
    // Check throttle before each query
    if (!checkThrottle()) {
      console.log(`\nStopping due to rate limit. Enriched: ${enriched}, Failed: ${failed}`);
      break;
    }
    
    console.log(`\n${v.year} ${v.make} ${v.model}:`);
    
    const tireSizes = await fetchTireSizesFromTireSize(v.year, v.make, v.model);
    recordQuery();
    
    if (!tireSizes || tireSizes.length === 0) {
      failed++;
      continue;
    }
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would update with: ${tireSizes.join(", ")}`);
      enriched++;
    } else {
      const updated = await updateTireSizes(v.make, v.model, v.year, tireSizes);
      if (updated > 0) {
        console.log(`  📝 Updated ${updated} records`);
        enriched++;
      } else {
        console.log(`  ⚠️ No records updated`);
        skipped++;
      }
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log("\n" + "=".repeat(50));
  console.log(`✅ Enriched: ${enriched}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  
  await pool.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
