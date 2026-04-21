/**
 * Full Fitment Enrichment - Tires AND Wheels
 * 
 * Fetches BOTH tire sizes AND wheel specs (diameter, width, offset) from tiresize.com.
 * Updates oemTireSizes AND oemWheelSizes in one pass.
 * 
 * Respects rate limits: 15 queries/hour, 75 queries/day.
 * 
 * Usage:
 *   node scripts/tire-enrichment/enrich-full-fitment.mjs [--limit N] [--dry-run] [--force]
 *   
 * Options:
 *   --limit=N     Max vehicles to process (default: 50)
 *   --dry-run     Don't write to DB, just show what would be updated
 *   --force       Process even if already has tire sizes (to fill wheel specs)
 *   --make=Ford   Only process specific make
 */

import pg from "pg";
import fs from "fs";
import path from "path";

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const limitArg = args.find(a => a.startsWith("--limit="));
const makeArg = args.find(a => a.startsWith("--make="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 50;
const filterMake = makeArg ? makeArg.split("=")[1] : null;

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

function getRemainingQueries() {
  const state = loadThrottleState();
  const now = Date.now();
  const hourAgo = now - 3600000;
  const dayAgo = now - 86400000;
  
  // Clean old entries
  state.tiresize.hourly = state.tiresize.hourly.filter(t => t > hourAgo);
  state.tiresize.daily = state.tiresize.daily.filter(t => t > dayAgo);
  saveThrottleState(state);
  
  const hourlyRemaining = MAX_PER_HOUR - state.tiresize.hourly.length;
  const dailyRemaining = MAX_PER_DAY - state.tiresize.daily.length;
  
  return Math.min(hourlyRemaining, dailyRemaining);
}

function recordQuery() {
  const state = loadThrottleState();
  const now = Date.now();
  state.tiresize.hourly.push(now);
  state.tiresize.daily.push(now);
  saveThrottleState(state);
}

/**
 * Parse wheel size from tiresize.com format
 * Example inputs: "17x7.5", "20x9.0", "18×8" (note the × unicode)
 */
function parseWheelSize(text) {
  // Handle both "x" and "×" (unicode multiplication sign)
  const match = text.match(/(\d{2})[\s×x]+([\d.]+)/i);
  if (!match) return null;
  
  return {
    diameter: parseInt(match[1], 10),
    width: parseFloat(match[2]),
  };
}

/**
 * Parse offset from tiresize.com format
 * Example inputs: "ET45", "ET+40", "45mm", "+40"
 */
function parseOffset(text) {
  // Try "ET" format first (common European notation)
  let match = text.match(/ET\+?(-?\d+)/i);
  if (match) return parseInt(match[1], 10);
  
  // Try "mm" format
  match = text.match(/([+-]?\d+)\s*mm/i);
  if (match) return parseInt(match[1], 10);
  
  // Try bare number (if context suggests it's an offset)
  match = text.match(/^([+-]?\d{1,2})$/);
  if (match) return parseInt(match[1], 10);
  
  return null;
}

/**
 * Estimate wheel width from tire width using industry standards
 * These are typical wheel width ranges for given tire widths
 */
function estimateWheelWidth(tireWidth) {
  // Tire width to wheel width mapping (approximate OEM ranges)
  const widthMap = [
    [155, 4.5], [165, 5.0], [175, 5.5], [185, 6.0], [195, 6.5],
    [205, 7.0], [215, 7.0], [225, 7.5], [235, 8.0], [245, 8.0],
    [255, 8.5], [265, 9.0], [275, 9.5], [285, 10.0], [295, 10.5],
    [305, 11.0], [315, 11.5], [325, 12.0], [335, 12.5], [345, 13.0]
  ];
  
  for (let i = widthMap.length - 1; i >= 0; i--) {
    if (tireWidth >= widthMap[i][0]) {
      return widthMap[i][1];
    }
  }
  return 7.0; // Default
}

/**
 * Check if tire size is reasonable for passenger/light truck vehicles
 * Filters out obvious noise (e.g., heavy truck tires, AG tires, etc.)
 */
function isReasonableTireSize(size, make, model) {
  // Parse tire size
  const match = size.match(/^(P|LT)?(\d{3})\/(\d{2})R(\d{2})$/i);
  if (!match) return false;
  
  const prefix = match[1]?.toUpperCase() || '';
  const width = parseInt(match[2], 10);
  const aspect = parseInt(match[3], 10);
  const diameter = parseInt(match[4], 10);
  
  // Calculate approx tire diameter in inches
  const tireHeightMm = width * (aspect / 100) * 2;
  const totalDiameterInch = diameter + (tireHeightMm / 25.4);
  
  // Known truck/SUV models that use larger tires
  const truckModels = ['f-150', 'f-250', 'f-350', 'silverado', 'sierra', 'ram', 'tundra', 'titan', 
    'wrangler', 'gladiator', 'bronco', 'tacoma', 'colorado', 'ranger', 'frontier', 'ridgeline',
    '4runner', 'sequoia', 'armada', 'expedition', 'tahoe', 'suburban', 'yukon', 'escalade',
    'land cruiser', 'gx', 'lx', 'qx80', 'navigator', 'durango', 'grand cherokee'];
  
  const modelLower = model.toLowerCase();
  const isTruck = truckModels.some(t => modelLower.includes(t)) || prefix === 'LT';
  
  if (isTruck) {
    // Trucks can have larger tires
    if (width < 225 || width > 325) return false;
    if (diameter < 16 || diameter > 24) return false;
    if (totalDiameterInch < 28 || totalDiameterInch > 38) return false;
  } else {
    // Passenger cars have more limited ranges
    if (width < 155 || width > 285) return false;
    if (diameter < 14 || diameter > 21) return false;
    if (totalDiameterInch < 23 || totalDiameterInch > 32) return false;
    
    // Filter out obvious truck tires on passenger cars
    // (High width with low aspect ratio is sports car, but high width with high aspect is truck)
    if (width >= 265 && aspect >= 65) return false;
    if (width >= 275 && aspect >= 60) return false;
    if (width >= 285 && aspect >= 55) return false;
  }
  
  return true;
}

/**
 * Fetch complete fitment data from tiresize.com
 * Returns both tire sizes and wheel specs
 */
async function fetchFitmentFromTireSize(year, make, model) {
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
    
    // ===== TIRE SIZES =====
    // Pattern: 225/45R17, P225/45R17, LT265/70R17
    const tireSizePattern = /\b(P|LT)?(\d{3}\/\d{2}R\d{2})\b/gi;
    const tireMatches = html.match(tireSizePattern) || [];
    
    // Normalize and filter
    const allSizes = [...new Set(tireMatches.map(s => s.toUpperCase()))];
    const tireSizes = allSizes.filter(s => isReasonableTireSize(s, make, model));
    
    if (tireSizes.length === 0) {
      console.log(`  ⚠️ No valid tire sizes found (${allSizes.length} raw matches filtered out)`);
      return null;
    }
    
    // ===== DERIVE WHEEL SPECS FROM TIRE SIZES =====
    const wheelSpecs = [];
    const seenDiameters = new Set();
    
    for (const size of tireSizes) {
      const match = size.match(/(P|LT)?(\d{3})\/(\d{2})R(\d{2})/i);
      if (!match) continue;
      
      const tireWidth = parseInt(match[2], 10);
      const diameter = parseInt(match[4], 10);
      
      if (seenDiameters.has(diameter)) continue;
      seenDiameters.add(diameter);
      
      const estimatedWidth = estimateWheelWidth(tireWidth);
      
      wheelSpecs.push({
        diameter,
        width: estimatedWidth,
        tireSize: size, // Reference which tire size this was derived from
        derived: true,
      });
    }
    
    const result = {
      tireSizes,
      wheelSpecs,
      rawUrl: url,
    };
    
    console.log(`  ✅ Found ${tireSizes.length} tire sizes → ${wheelSpecs.length} wheel specs`);
    console.log(`     Tires: ${tireSizes.join(", ")}`);
    console.log(`     Wheels: ${wheelSpecs.map(w => `${w.diameter}x${w.width}`).join(", ")}`);
    
    return result;
    
  } catch (err) {
    console.log(`  ❌ Fetch error: ${err.message}`);
    return null;
  }
}

/**
 * Convert wheel specs to oemWheelSizes JSON format
 */
function formatWheelSizes(specs) {
  return specs
    .filter(s => s.width !== null) // Only include specs with width data
    .map(s => ({
      diameter: s.diameter,
      width: s.width,
      offset: s.offset ?? null,
      axle: "square", // Assume square unless staggered data found
      isStock: true,
    }));
}

/**
 * Get vehicles needing enrichment
 */
async function getVehiclesNeedingEnrichment(maxCount) {
  let query;
  let params = [];
  
  if (force) {
    // Force mode: get vehicles missing wheel specs (even if they have tire sizes)
    query = `
      SELECT DISTINCT ON (make, model, year)
        id, year, make, model, modification_id, oem_tire_sizes, oem_wheel_sizes
      FROM vehicle_fitments
      WHERE (oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]')
        AND year >= 1990
        ${filterMake ? "AND LOWER(make) = LOWER($1)" : ""}
      ORDER BY make, model, year DESC
      LIMIT ${filterMake ? "$2" : "$1"}
    `;
    params = filterMake ? [filterMake, maxCount] : [maxCount];
  } else {
    // Normal mode: get vehicles missing tire sizes (will also fill wheel specs)
    query = `
      SELECT DISTINCT ON (make, model, year)
        id, year, make, model, modification_id, oem_tire_sizes, oem_wheel_sizes
      FROM vehicle_fitments
      WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]')
        AND year >= 1990
        ${filterMake ? "AND LOWER(make) = LOWER($1)" : ""}
      ORDER BY make, model, year DESC
      LIMIT ${filterMake ? "$2" : "$1"}
    `;
    params = filterMake ? [filterMake, maxCount] : [maxCount];
  }
  
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Update all matching trims for a YMM
 */
async function updateAllTrimsForYMM(year, make, model, tireSizes, wheelSizes) {
  const result = await pool.query(`
    UPDATE vehicle_fitments
    SET 
      oem_tire_sizes = $4::jsonb,
      oem_wheel_sizes = CASE 
        WHEN $5::jsonb = '[]'::jsonb THEN oem_wheel_sizes 
        ELSE $5::jsonb 
      END,
      updated_at = NOW()
    WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]'
           OR oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]')
    RETURNING id
  `, [year, make, model, JSON.stringify(tireSizes), JSON.stringify(wheelSizes)]);
  
  return result.rowCount;
}

// ===== MAIN =====
async function main() {
  console.log("=== Full Fitment Enrichment ===");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Force (fill wheel specs): ${force}`);
  console.log(`Make filter: ${filterMake || "ALL"}`);
  console.log("");
  
  // Check rate limits
  const remaining = getRemainingQueries();
  console.log(`🔄 Rate limit: ${remaining} queries remaining`);
  
  if (remaining <= 0) {
    console.log("❌ Rate limit reached. Try again later.");
    process.exit(1);
  }
  
  const effectiveLimit = Math.min(limit, remaining);
  console.log(`📋 Processing up to ${effectiveLimit} vehicles\n`);
  
  // Get vehicles needing enrichment
  const vehicles = await getVehiclesNeedingEnrichment(effectiveLimit);
  console.log(`Found ${vehicles.length} vehicles needing enrichment\n`);
  
  if (vehicles.length === 0) {
    console.log("✅ No vehicles need enrichment!");
    pool.end();
    return;
  }
  
  let processed = 0;
  let enriched = 0;
  let failed = 0;
  let trimsUpdated = 0;
  
  for (const vehicle of vehicles) {
    const { year, make, model } = vehicle;
    console.log(`[${processed + 1}/${vehicles.length}] ${year} ${make} ${model}`);
    
    // Fetch fitment data
    const fitment = await fetchFitmentFromTireSize(year, make, model);
    recordQuery();
    processed++;
    
    if (!fitment || (fitment.tireSizes.length === 0 && fitment.wheelSpecs.length === 0)) {
      console.log(`  ⚠️ No data found\n`);
      failed++;
      continue;
    }
    
    // Format wheel specs for DB
    const wheelSizes = formatWheelSizes(fitment.wheelSpecs);
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would update with:`);
      console.log(`    Tires: ${JSON.stringify(fitment.tireSizes)}`);
      console.log(`    Wheels: ${JSON.stringify(wheelSizes)}`);
      enriched++;
    } else {
      // Update all trims for this YMM
      const count = await updateAllTrimsForYMM(year, make, model, fitment.tireSizes, wheelSizes);
      console.log(`  ✅ Updated ${count} trim records\n`);
      enriched++;
      trimsUpdated += count;
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log("\n=== Summary ===");
  console.log(`Processed: ${processed}`);
  console.log(`Enriched: ${enriched}`);
  console.log(`Failed: ${failed}`);
  if (!dryRun) {
    console.log(`Total trim records updated: ${trimsUpdated}`);
  }
  console.log(`Remaining queries: ${getRemainingQueries()}`);
  
  pool.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  pool.end();
  process.exit(1);
});
