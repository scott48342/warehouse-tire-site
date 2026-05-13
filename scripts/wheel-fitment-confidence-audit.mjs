#!/usr/bin/env node
/**
 * Wheel Fitment Confidence Audit
 * 
 * Assigns confidence scores to vehicle wheel-fitment quality across the entire WTD DB.
 * Uses WheelPros validation as a cross-reference.
 * 
 * Confidence Categories:
 *   HIGH   - Validated bolt/CB, strong WheelPros compat, clean ranges
 *   MEDIUM - Partial validation, incomplete width/offset support
 *   LOW    - Missing ranges, weak coverage, legacy imports
 *   NEEDS_REVIEW - Conflicts, impossible values, inconsistencies
 * 
 * Usage:
 *   node scripts/wheel-fitment-confidence-audit.mjs                          # Full audit
 *   node scripts/wheel-fitment-confidence-audit.mjs --offset=0 --limit=500 --batch=01
 *   node scripts/wheel-fitment-confidence-audit.mjs --priority=high          # EVs, trucks, sports first
 *   node scripts/wheel-fitment-confidence-audit.mjs --year-min=2018
 * 
 * Output:
 *   scripts/wheel-confidence-results/batch-{name}.json
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  // SSL is handled by sslmode in connection string
});

// ============================================================================
// CONFIGURATION
// ============================================================================

const BATCH_SIZE = 500;
const CHECKPOINT_INTERVAL = 100;
const WHEELPROS_RATE_LIMIT_MS = 150;
const OUTPUT_DIR = 'scripts/wheel-confidence-results';
const CHECKPOINT_FILE = `${OUTPUT_DIR}/checkpoint.json`;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse a JSON field that may be a string or already parsed object/array
 * Always returns a true JavaScript array
 */
function parseJsonField(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return [...value]; // Spread to ensure true array
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? [...parsed] : [];
    } catch {
      return [];
    }
  }
  // Handle iterable objects that look like arrays
  if (typeof value === 'object' && value !== null) {
    try {
      return Array.from(value);
    } catch {
      return [];
    }
  }
  return [];
}

// ============================================================================
// WHEELPROS AUTH
// ============================================================================

let wpTokenCache = { token: null, expiresAt: 0 };

async function getWheelProsToken() {
  const now = Date.now();
  if (wpTokenCache.token && wpTokenCache.expiresAt > now + 30000) {
    return wpTokenCache.token;
  }

  const res = await fetch("https://api.wheelpros.com/auth/v1/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      userName: process.env.WHEELPROS_USERNAME,
      password: process.env.WHEELPROS_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error(`WheelPros auth failed: ${res.status}`);
  const data = await res.json();
  const token = data?.accessToken || data?.token;
  if (!token) throw new Error("WheelPros auth: no token");

  wpTokenCache = { token, expiresAt: now + 3600000 };
  return token;
}

// ============================================================================
// WHEELPROS WHEEL SEARCH
// ============================================================================

async function searchWheelProsByBoltPattern(boltPattern, maxResults = 100) {
  if (!boltPattern) return { wheels: [], totalCount: 0, error: "No bolt pattern" };
  
  try {
    const token = await getWheelProsToken();
    const url = new URL("https://api.wheelpros.com/products/v1/search/wheel");
    url.searchParams.set("boltPattern", boltPattern);
    url.searchParams.set("pageSize", String(maxResults));
    url.searchParams.set("fields", "price");

    const res = await fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" },
    });

    if (!res.ok) {
      return { wheels: [], totalCount: 0, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    const wheels = (data.results || []).map(w => ({
      sku: w.sku,
      boltPattern: w.properties?.boltPattern || "",
      centerboreMm: w.properties?.centerbore ? parseFloat(w.properties.centerbore) : null,
      diameterIn: w.properties?.diameter ? parseFloat(w.properties.diameter) : null,
      widthIn: w.properties?.width ? parseFloat(w.properties.width) : null,
      offsetMm: w.properties?.offset ? parseFloat(w.properties.offset) : null,
    }));

    return { wheels, totalCount: data.totalCount || wheels.length, error: null };
  } catch (err) {
    return { wheels: [], totalCount: 0, error: err.message };
  }
}

// ============================================================================
// VEHICLE CLASSIFICATION PATTERNS
// ============================================================================

const PRIORITY_PATTERNS = {
  ev: [
    { make: /tesla/i },
    { make: /rivian/i },
    { make: /lucid/i },
    { make: /polestar/i },
    { make: /ford/i, model: /mach-?e|lightning/i },
    { make: /chevrolet|chevy/i, model: /bolt|blazer\s*ev|equinox\s*ev|silverado\s*ev/i },
    { make: /hyundai/i, model: /ioniq/i },
    { make: /kia/i, model: /ev[69]|niro\s*ev/i },
    { make: /bmw/i, model: /i[x4-8]|ix/i },
    { make: /mercedes/i, model: /eq[a-z]/i },
    { make: /audi/i, model: /e-?tron/i },
    { make: /porsche/i, model: /taycan/i },
    { make: /volkswagen|vw/i, model: /id\./i },
  ],
  truck: [
    { make: /ford/i, model: /f-?1[05]0|f-?250|f-?350|ranger|maverick/i },
    { make: /chevrolet|chevy|gmc/i, model: /silverado|sierra|colorado|canyon/i },
    { make: /ram/i, model: /1500|2500|3500/i },
    { make: /toyota/i, model: /tacoma|tundra/i },
    { make: /nissan/i, model: /titan|frontier/i },
  ],
  staggered: [
    { make: /ford/i, model: /mustang/i },
    { make: /chevrolet|chevy/i, model: /corvette|camaro/i },
    { make: /dodge/i, model: /challenger|charger/i },
    { make: /bmw/i, model: /m[2-8]|z4/i },
    { make: /porsche/i },
    { make: /mercedes/i, model: /amg|gt|sl/i },
    { make: /audi/i, model: /r8|rs/i },
    { make: /lamborghini|ferrari|mclaren/i },
  ],
  offroad: [
    { make: /jeep/i, model: /wrangler|gladiator/i },
    { make: /ford/i, model: /bronco/i },
    { make: /toyota/i, model: /4runner|land\s*cruiser/i },
    { make: /land\s*rover/i },
    { make: /lexus/i, model: /gx|lx/i },
  ],
};

function classifyVehiclePriority(make, model) {
  const flags = { isEV: false, isTruck: false, isStaggered: false, isOffroad: false };
  
  for (const [category, patterns] of Object.entries(PRIORITY_PATTERNS)) {
    for (const p of patterns) {
      const makeMatch = p.make ? p.make.test(make) : true;
      const modelMatch = p.model ? p.model.test(model) : true;
      if (makeMatch && modelMatch) {
        if (category === 'ev') flags.isEV = true;
        if (category === 'truck') flags.isTruck = true;
        if (category === 'staggered') flags.isStaggered = true;
        if (category === 'offroad') flags.isOffroad = true;
      }
    }
  }
  
  flags.isPriority = flags.isEV || flags.isTruck || flags.isStaggered || flags.isOffroad;
  return flags;
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

function calculateConfidenceScore(vehicle, wpResult) {
  const scores = {
    boltPattern: 0,      // 0-25 points
    centerBore: 0,       // 0-20 points
    offsetRange: 0,      // 0-20 points
    wheelSizes: 0,       // 0-15 points
    wpCompatibility: 0,  // 0-20 points
  };
  const issues = [];
  const strengths = [];
  
  // 1. Bolt Pattern (25 points)
  if (vehicle.boltPattern) {
    const normalized = vehicle.boltPattern.toLowerCase().replace(/\s/g, '');
    if (/^\d+x\d+(\.\d+)?$/.test(normalized)) {
      scores.boltPattern = 25;
      strengths.push("Valid bolt pattern format");
    } else {
      scores.boltPattern = 10;
      issues.push(`Unusual bolt pattern format: ${vehicle.boltPattern}`);
    }
  } else {
    scores.boltPattern = 0;
    issues.push("Missing bolt pattern");
  }
  
  // 2. Center Bore (20 points)
  if (vehicle.centerBoreMm) {
    const cb = parseFloat(vehicle.centerBoreMm);
    if (cb >= 50 && cb <= 150) {
      scores.centerBore = 20;
      strengths.push(`Valid center bore: ${cb}mm`);
    } else {
      scores.centerBore = 5;
      issues.push(`Suspicious center bore: ${cb}mm`);
    }
  } else {
    scores.centerBore = 0;
    issues.push("Missing center bore");
  }
  
  // 3. Offset Range (20 points)
  const hasOffsetMin = vehicle.offsetMinMm != null;
  const hasOffsetMax = vehicle.offsetMaxMm != null;
  
  if (hasOffsetMin && hasOffsetMax) {
    const min = parseFloat(vehicle.offsetMinMm);
    const max = parseFloat(vehicle.offsetMaxMm);
    const range = max - min;
    
    if (min >= -100 && max <= 100 && range >= 0 && range <= 50) {
      scores.offsetRange = 20;
      strengths.push(`Clean offset range: ${min} to ${max}mm`);
    } else if (range < 0) {
      scores.offsetRange = 0;
      issues.push(`Invalid offset range: min=${min} > max=${max}`);
    } else if (range > 50) {
      scores.offsetRange = 10;
      issues.push(`Unusually wide offset range: ${range}mm`);
    } else {
      scores.offsetRange = 15;
      issues.push(`Extreme offsets: ${min} to ${max}mm`);
    }
  } else if (hasOffsetMin || hasOffsetMax) {
    scores.offsetRange = 5;
    issues.push("Incomplete offset range");
  } else {
    scores.offsetRange = 0;
    issues.push("Missing offset range");
  }
  
  // 4. Wheel Sizes (15 points)
  // Force to real array - some Postgres JSON fields may not be true arrays
  const rawWheelSizes = vehicle.oemWheelSizes;
  const wheelSizes = Array.isArray(rawWheelSizes) ? [...rawWheelSizes] : [];
  const diameters = [...new Set(wheelSizes.map(w => w?.diameter).filter(Boolean))];
  const widths = [...new Set(wheelSizes.map(w => w?.width).filter(Boolean))];
  
  if (diameters.length > 0 && widths.length > 0) {
    scores.wheelSizes = 15;
    strengths.push(`${diameters.length} diameter(s), ${widths.length} width(s)`);
  } else if (diameters.length > 0 || widths.length > 0) {
    scores.wheelSizes = 8;
    issues.push("Incomplete wheel size data");
  } else {
    scores.wheelSizes = 0;
    issues.push("Missing wheel sizes");
  }
  
  // 5. WheelPros Compatibility (20 points)
  if (wpResult.error) {
    scores.wpCompatibility = 5;
    issues.push(`WheelPros lookup failed: ${wpResult.error}`);
  } else if (wpResult.totalCount === 0) {
    scores.wpCompatibility = 0;
    issues.push("No WheelPros wheels found for bolt pattern");
  } else {
    // Calculate hub-centric compatibility
    const vehicleCB = vehicle.centerBoreMm ? parseFloat(vehicle.centerBoreMm) : null;
    let hubSafeCount = 0;
    let hubRiskCount = 0;
    
    for (const w of wpResult.wheels) {
      if (vehicleCB && w.centerboreMm) {
        if (w.centerboreMm >= vehicleCB - 0.5) {
          hubSafeCount++;
        } else {
          hubRiskCount++;
        }
      }
    }
    
    const total = hubSafeCount + hubRiskCount;
    if (total === 0) {
      scores.wpCompatibility = 10;
      issues.push("WheelPros wheels found but no CB data for validation");
    } else {
      const hubSafeRate = hubSafeCount / total;
      if (hubSafeRate >= 0.7) {
        scores.wpCompatibility = 20;
        strengths.push(`${Math.round(hubSafeRate * 100)}% WheelPros hub-safe (${wpResult.totalCount} wheels)`);
      } else if (hubSafeRate >= 0.3) {
        scores.wpCompatibility = 12;
        issues.push(`Only ${Math.round(hubSafeRate * 100)}% WheelPros hub-safe`);
      } else {
        scores.wpCompatibility = 5;
        issues.push(`Low WheelPros compatibility: ${Math.round(hubSafeRate * 100)}% hub-safe`);
      }
    }
  }
  
  // Calculate total and category
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  let category;
  
  // Check for NEEDS_REVIEW conditions
  const needsReview = 
    issues.some(i => i.includes("Invalid offset")) ||
    issues.some(i => i.includes("Suspicious center bore")) ||
    (wpResult.wheels.length > 0 && scores.wpCompatibility <= 5);
  
  if (needsReview) {
    category = "NEEDS_REVIEW";
  } else if (total >= 80) {
    category = "HIGH";
  } else if (total >= 50) {
    category = "MEDIUM";
  } else {
    category = "LOW";
  }
  
  return {
    total,
    scores,
    category,
    issues,
    strengths,
  };
}

// ============================================================================
// DATABASE QUERIES
// ============================================================================

async function getVehicleCount(yearMin, yearMax) {
  const query = `
    SELECT COUNT(DISTINCT (year, make, model)) 
    FROM vehicle_fitments 
    WHERE year >= $1 AND year <= $2
  `;
  const result = await pool.query(query, [yearMin, yearMax]);
  return parseInt(result.rows[0].count);
}

async function getVehicles(yearMin, yearMax, offset, limit, priorityFirst = false) {
  let orderBy = 'year DESC, make ASC, model ASC';
  
  if (priorityFirst) {
    // Prioritize EVs, trucks, sports cars by known patterns
    orderBy = `
      CASE 
        WHEN LOWER(make) IN ('tesla', 'rivian', 'lucid', 'polestar') THEN 0
        WHEN LOWER(model) LIKE '%mustang%' OR LOWER(model) LIKE '%corvette%' OR LOWER(model) LIKE '%camaro%' THEN 1
        WHEN LOWER(model) LIKE '%f-150%' OR LOWER(model) LIKE '%silverado%' OR LOWER(model) LIKE '%ram%' THEN 2
        WHEN LOWER(model) LIKE '%wrangler%' OR LOWER(model) LIKE '%bronco%' OR LOWER(model) LIKE '%4runner%' THEN 3
        ELSE 4
      END,
      year DESC, make ASC, model ASC
    `;
  }
  
  const query = `
    SELECT DISTINCT ON (year, make, model)
      year, make, model, display_trim,
      bolt_pattern, center_bore_mm, 
      offset_min_mm, offset_max_mm,
      oem_wheel_sizes, oem_tire_sizes,
      quality_tier, certification_status
    FROM vehicle_fitments
    WHERE year >= $1 AND year <= $2
    ORDER BY year, make, model, display_trim
    OFFSET $3 LIMIT $4
  `;
  
  const result = await pool.query(query, [yearMin, yearMax, offset, limit]);
  return result.rows.map(r => ({
    year: r.year,
    make: r.make,
    model: r.model,
    displayTrim: r.display_trim,
    boltPattern: r.bolt_pattern,
    centerBoreMm: r.center_bore_mm,
    offsetMinMm: r.offset_min_mm,
    offsetMaxMm: r.offset_max_mm,
    oemWheelSizes: parseJsonField(r.oem_wheel_sizes),
    oemTireSizes: parseJsonField(r.oem_tire_sizes),
    qualityTier: r.quality_tier,
    certificationStatus: r.certification_status,
  }));
}

// ============================================================================
// CHECKPOINT
// ============================================================================

function saveCheckpoint(batchName, processed, stats) {
  const checkpoint = {
    timestamp: new Date().toISOString(),
    batchName,
    processed,
    stats,
  };
  
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

// ============================================================================
// MAIN AUDIT
// ============================================================================

async function auditVehicle(vehicle) {
  const priority = classifyVehiclePriority(vehicle.make, vehicle.model);
  
  // Search WheelPros by bolt pattern
  const wpResult = await searchWheelProsByBoltPattern(vehicle.boltPattern, 50);
  
  // Calculate confidence
  let confidence;
  try {
    confidence = calculateConfidenceScore(vehicle, wpResult);
  } catch (err) {
    console.error(`\n❌ Error auditing ${vehicle.year} ${vehicle.make} ${vehicle.model}:`);
    console.error(`   oemWheelSizes type: ${typeof vehicle.oemWheelSizes}, value:`, JSON.stringify(vehicle.oemWheelSizes));
    throw err;
  }
  
  return {
    vehicle: {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      displayTrim: vehicle.displayTrim,
    },
    priority,
    specs: {
      boltPattern: vehicle.boltPattern,
      centerBoreMm: vehicle.centerBoreMm ? parseFloat(vehicle.centerBoreMm) : null,
      offsetMinMm: vehicle.offsetMinMm ? parseFloat(vehicle.offsetMinMm) : null,
      offsetMaxMm: vehicle.offsetMaxMm ? parseFloat(vehicle.offsetMaxMm) : null,
      wheelDiameters: [...new Set((Array.isArray(vehicle.oemWheelSizes) ? vehicle.oemWheelSizes : []).map(w => w?.diameter).filter(Boolean))],
      wheelWidths: [...new Set((Array.isArray(vehicle.oemWheelSizes) ? vehicle.oemWheelSizes : []).map(w => w?.width).filter(Boolean))],
    },
    wpCoverage: {
      totalWheels: wpResult.totalCount,
      sampleSize: wpResult.wheels.length,
      error: wpResult.error,
    },
    confidence,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    flags[key] = value || true;
  }

  const yearMin = parseInt(flags['year-min']) || 2018;
  const yearMax = parseInt(flags['year-max']) || new Date().getFullYear();
  const offset = parseInt(flags.offset) || 0;
  const limit = parseInt(flags.limit) || BATCH_SIZE;
  const batchName = flags.batch || 'default';
  const priorityFirst = flags.priority === 'high';
  const verbose = flags.verbose;

  console.log("🔧 Wheel Fitment Confidence Audit");
  console.log("=".repeat(70));
  console.log(`Batch: ${batchName}`);
  console.log(`Year range: ${yearMin} - ${yearMax}`);
  console.log(`Offset: ${offset}, Limit: ${limit}`);
  if (priorityFirst) console.log("Priority: HIGH (EVs, trucks, sports first)");
  console.log("");

  // Get vehicles
  const vehicles = await getVehicles(yearMin, yearMax, offset, limit, priorityFirst);
  console.log(`📊 Auditing ${vehicles.length} vehicles...`);
  console.log("");

  // Results
  const results = {
    timestamp: new Date().toISOString(),
    batch: batchName,
    parameters: { yearMin, yearMax, offset, limit, priorityFirst },
    summary: {
      total: vehicles.length,
      byCategory: { HIGH: 0, MEDIUM: 0, LOW: 0, NEEDS_REVIEW: 0 },
      byPriority: { ev: 0, truck: 0, staggered: 0, offroad: 0, other: 0 },
      avgScore: 0,
    },
    vehicles: [],
    weakAreas: [],
    incompleteRanges: [],
    importArtifacts: [],
    expansionCandidates: [],
  };

  let processed = 0;
  let totalScore = 0;
  const startTime = Date.now();

  for (const vehicle of vehicles) {
    const audit = await auditVehicle(vehicle);
    results.vehicles.push(audit);

    // Update summary
    results.summary.byCategory[audit.confidence.category]++;
    totalScore += audit.confidence.total;

    if (audit.priority.isEV) results.summary.byPriority.ev++;
    else if (audit.priority.isTruck) results.summary.byPriority.truck++;
    else if (audit.priority.isStaggered) results.summary.byPriority.staggered++;
    else if (audit.priority.isOffroad) results.summary.byPriority.offroad++;
    else results.summary.byPriority.other++;

    // Track weak areas
    if (audit.confidence.category === 'LOW' || audit.confidence.category === 'NEEDS_REVIEW') {
      results.weakAreas.push({
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        score: audit.confidence.total,
        issues: audit.confidence.issues,
      });
    }

    // Track incomplete ranges
    if (audit.confidence.issues.some(i => i.includes("Missing offset") || i.includes("Incomplete offset"))) {
      results.incompleteRanges.push({
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        offsetMin: audit.specs.offsetMinMm,
        offsetMax: audit.specs.offsetMaxMm,
      });
    }

    // Track potential import artifacts
    if (audit.confidence.issues.some(i => i.includes("Invalid") || i.includes("Suspicious"))) {
      results.importArtifacts.push({
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        issues: audit.confidence.issues.filter(i => i.includes("Invalid") || i.includes("Suspicious")),
      });
    }

    // Track expansion candidates (HIGH confidence with good WP coverage)
    if (audit.confidence.category === 'HIGH' && audit.wpCoverage.totalWheels > 100) {
      results.expansionCandidates.push({
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        score: audit.confidence.total,
        wpWheels: audit.wpCoverage.totalWheels,
      });
    }

    // Progress
    processed++;
    if (verbose) {
      const vName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      console.log(`  [${processed}] ${vName.padEnd(40)} Score: ${audit.confidence.total}/100 -> ${audit.confidence.category}`);
    }

    if (processed % CHECKPOINT_INTERVAL === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const eta = (vehicles.length - processed) / rate;

      if (!verbose) {
        process.stdout.write(`\r  Progress: ${processed}/${vehicles.length} | ${rate.toFixed(1)}/s | ETA: ${Math.ceil(eta)}s`);
      } else {
        console.log(`\n  📊 Checkpoint: ${processed}/${vehicles.length} | HIGH:${results.summary.byCategory.HIGH} MED:${results.summary.byCategory.MEDIUM} LOW:${results.summary.byCategory.LOW} REVIEW:${results.summary.byCategory.NEEDS_REVIEW}\n`);
      }

      saveCheckpoint(batchName, processed, results.summary);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, WHEELPROS_RATE_LIMIT_MS));
  }

  console.log(`\r  Progress: ${processed}/${vehicles.length} ✅` + " ".repeat(30));

  // Final summary
  results.summary.avgScore = Math.round(totalScore / vehicles.length);

  // Sort weak areas by score
  results.weakAreas.sort((a, b) => a.score - b.score);
  results.weakAreas = results.weakAreas.slice(0, 50); // Top 50

  // Sort expansion candidates by WP coverage
  results.expansionCandidates.sort((a, b) => b.wpWheels - a.wpWheels);
  results.expansionCandidates = results.expansionCandidates.slice(0, 50);

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 CONFIDENCE AUDIT SUMMARY");
  console.log("=".repeat(70));
  console.log(`  Total vehicles:     ${results.summary.total}`);
  console.log(`  Average score:      ${results.summary.avgScore}/100`);
  console.log("");
  console.log("  By Confidence:");
  console.log(`    🟢 HIGH:          ${results.summary.byCategory.HIGH} (${Math.round(results.summary.byCategory.HIGH / results.summary.total * 100)}%)`);
  console.log(`    🟡 MEDIUM:        ${results.summary.byCategory.MEDIUM} (${Math.round(results.summary.byCategory.MEDIUM / results.summary.total * 100)}%)`);
  console.log(`    🔴 LOW:           ${results.summary.byCategory.LOW} (${Math.round(results.summary.byCategory.LOW / results.summary.total * 100)}%)`);
  console.log(`    ⚠️  NEEDS_REVIEW:  ${results.summary.byCategory.NEEDS_REVIEW} (${Math.round(results.summary.byCategory.NEEDS_REVIEW / results.summary.total * 100)}%)`);
  console.log("");
  console.log("  By Priority Type:");
  console.log(`    EV:        ${results.summary.byPriority.ev}`);
  console.log(`    Truck:     ${results.summary.byPriority.truck}`);
  console.log(`    Staggered: ${results.summary.byPriority.staggered}`);
  console.log(`    Off-road:  ${results.summary.byPriority.offroad}`);
  console.log(`    Other:     ${results.summary.byPriority.other}`);
  console.log("");
  console.log(`  Weak areas:           ${results.weakAreas.length}`);
  console.log(`  Incomplete ranges:    ${results.incompleteRanges.length}`);
  console.log(`  Import artifacts:     ${results.importArtifacts.length}`);
  console.log(`  Expansion candidates: ${results.expansionCandidates.length}`);

  // Save results
  const outDir = path.join(process.cwd(), OUTPUT_DIR);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, `batch-${batchName}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results: ${outFile}`);

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`⏱️  Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);

  await pool.end();
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
