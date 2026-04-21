/**
 * Full Fitment Enrichment via Web Search
 * 
 * Captures BOTH tire sizes AND wheel specs (diameter, width, offset) in one pass.
 * Uses web search to find OEM fitment data.
 * 
 * Usage:
 *   node scripts/tire-enrichment/enrich-full-web-search.mjs [--limit=N] [--dry-run]
 */

import pg from 'pg';
import fs from 'fs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

// Load DB
const env = fs.readFileSync('.env.local', 'utf-8');
const dbUrl = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

// Progress file to track what we've done
const PROGRESS_FILE = 'scripts/tire-enrichment/enrichment-progress.json';

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {}
  return { completed: [], failed: [], lastRun: null };
}

function saveProgress(progress) {
  progress.lastRun = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Estimate wheel width from tire width
 */
function estimateWheelWidth(tireWidth) {
  const widthMap = [
    [155, 4.5], [165, 5.0], [175, 5.5], [185, 6.0], [195, 6.5],
    [205, 7.0], [215, 7.0], [225, 7.5], [235, 8.0], [245, 8.0],
    [255, 8.5], [265, 9.0], [275, 9.5], [285, 10.0], [295, 10.5],
    [305, 11.0], [315, 11.5], [325, 12.0]
  ];
  for (let i = widthMap.length - 1; i >= 0; i--) {
    if (tireWidth >= widthMap[i][0]) return widthMap[i][1];
  }
  return 7.0;
}

/**
 * Parse tire sizes from text
 */
function parseTireSizes(text) {
  const pattern = /\b(P|LT)?(\d{3}\/\d{2}R\d{2})\b/gi;
  const matches = text.match(pattern) || [];
  return [...new Set(matches.map(s => s.toUpperCase()))];
}

/**
 * Parse wheel specs from text (looking for "18x8" or "19 x 8.5" patterns)
 */
function parseWheelSpecs(text) {
  const specs = [];
  const seen = new Set();
  
  // Pattern: 18x8, 19x8.5, 20 x 9, etc.
  const wheelPattern = /(\d{2})\s*[x×]\s*([\d.]+)/gi;
  let match;
  while ((match = wheelPattern.exec(text)) !== null) {
    const diameter = parseInt(match[1], 10);
    const width = parseFloat(match[2]);
    if (diameter >= 14 && diameter <= 24 && width >= 5 && width <= 13) {
      const key = `${diameter}x${width}`;
      if (!seen.has(key)) {
        seen.add(key);
        specs.push({ diameter, width });
      }
    }
  }
  
  // Also look for offset patterns: ET35, +35mm, offset 35
  const offsetPattern = /(?:ET|offset\s*[:\s]?\s*|[+])\s*(\d{1,2})\s*(?:mm)?/gi;
  const offsets = [];
  while ((match = offsetPattern.exec(text)) !== null) {
    const offset = parseInt(match[1], 10);
    if (offset >= 15 && offset <= 60) {
      offsets.push(offset);
    }
  }
  
  // If we found offsets and specs, try to associate them
  if (offsets.length > 0 && specs.length > 0) {
    // Simple case: same count
    if (offsets.length === specs.length) {
      specs.forEach((s, i) => s.offset = offsets[i]);
    } else if (offsets.length === 1) {
      // One offset for all wheels
      specs.forEach(s => s.offset = offsets[0]);
    }
  }
  
  return specs;
}

/**
 * Build wheel sizes from tire sizes (when explicit wheel specs not found)
 */
function deriveWheelSizesFromTires(tireSizes) {
  const specs = [];
  const seenDiameters = new Set();
  
  for (const size of tireSizes) {
    const match = size.match(/(P|LT)?(\d{3})\/(\d{2})R(\d{2})/i);
    if (!match) continue;
    
    const tireWidth = parseInt(match[2], 10);
    const diameter = parseInt(match[4], 10);
    
    if (seenDiameters.has(diameter)) continue;
    seenDiameters.add(diameter);
    
    specs.push({
      diameter,
      width: estimateWheelWidth(tireWidth),
      axle: 'square',
      isStock: true,
      derived: true
    });
  }
  
  return specs;
}

/**
 * Get vehicles needing enrichment
 */
async function getVehiclesToEnrich(maxCount) {
  const progress = loadProgress();
  const completedKeys = new Set(progress.completed);
  const failedKeys = new Set(progress.failed);
  
  const result = await pool.query(`
    SELECT DISTINCT ON (year, make, model)
      year, make, model
    FROM vehicle_fitments
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
      AND year >= 1995
    ORDER BY year DESC, make, model
  `);
  
  // Filter out already processed
  const vehicles = result.rows.filter(v => {
    const key = `${v.year}|${v.make}|${v.model}`;
    return !completedKeys.has(key) && !failedKeys.has(key);
  });
  
  return vehicles.slice(0, maxCount);
}

/**
 * Update all trims for a YMM
 */
async function updateYMM(year, make, model, tireSizes, wheelSizes) {
  const result = await pool.query(`
    UPDATE vehicle_fitments
    SET 
      oem_tire_sizes = $4::jsonb,
      oem_wheel_sizes = CASE 
        WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' THEN $5::jsonb
        ELSE oem_wheel_sizes
      END,
      updated_at = NOW()
    WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
    RETURNING id
  `, [year, make, model, JSON.stringify(tireSizes), JSON.stringify(wheelSizes)]);
  
  return result.rowCount;
}

// ===== MAIN =====
async function main() {
  console.log('=== Full Fitment Enrichment (Web Search) ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit} vehicles\n`);
  
  const vehicles = await getVehiclesToEnrich(limit);
  console.log(`Found ${vehicles.length} vehicles to enrich\n`);
  
  if (vehicles.length === 0) {
    console.log('✅ All vehicles processed!');
    pool.end();
    return;
  }
  
  const progress = loadProgress();
  let enriched = 0;
  let failed = 0;
  
  // Output format for the calling agent to process
  console.log('=== VEHICLES TO SEARCH ===');
  console.log('For each vehicle below, search: "[year] [make] [model] OEM tire size wheel size"');
  console.log('Then update with the tire sizes (e.g., 225/45R17) and wheel specs (e.g., 17x7.5 ET40)\n');
  
  for (const v of vehicles) {
    const searchQuery = `${v.year} ${v.make} ${v.model} OEM tire size wheel size`;
    console.log(`SEARCH: ${searchQuery}`);
    console.log(`  YMM: ${v.year}|${v.make}|${v.model}`);
  }
  
  console.log('\n=== BATCH SEARCH QUERIES ===');
  // Group by make for efficiency
  const byMake = {};
  for (const v of vehicles) {
    if (!byMake[v.make]) byMake[v.make] = [];
    byMake[v.make].push(v);
  }
  
  for (const [make, vList] of Object.entries(byMake)) {
    const years = [...new Set(vList.map(v => v.year))].sort();
    const models = [...new Set(vList.map(v => v.model))];
    console.log(`\n${make}:`);
    models.forEach(m => {
      const yrs = vList.filter(v => v.model === m).map(v => v.year).sort();
      console.log(`  ${m}: ${yrs.join(', ')}`);
    });
  }
  
  pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
