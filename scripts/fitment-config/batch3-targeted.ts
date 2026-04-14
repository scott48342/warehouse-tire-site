/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BATCH 3: TARGETED HIGH-CONFIDENCE FITMENT CONFIG PIPELINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * STRATEGY: Precision > Volume
 * - Only mainstream high-volume vehicles
 * - Clean trim structures
 * - Years 2015-2024
 * - NO performance trims
 * - NO vehicles that failed in Batch 2
 * 
 * SAME PIPELINE, SAME THRESHOLDS - just smarter targeting
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import pg from "pg";
import * as fs from "fs/promises";
import crypto from "crypto";

const { Pool } = pg;

function generateId(length: number = 8): string {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TARGETING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const TARGET_VEHICLES: Record<string, string[]> = {
  // Toyota - highest volume
  "toyota": ["camry", "corolla", "rav4", "highlander", "tacoma", "tundra", "4runner", "sienna"],
  // Honda
  "honda": ["civic", "accord", "cr-v", "pilot", "odyssey", "hr-v"],
  // Nissan
  "nissan": ["altima", "sentra", "rogue", "murano", "pathfinder", "frontier"],
  // Ford
  "ford": ["f-150", "escape", "explorer", "edge", "mustang", "ranger"],
  // Chevrolet
  "chevrolet": ["silverado-1500", "equinox", "malibu", "traverse", "tahoe", "suburban"],
  // Hyundai
  "hyundai": ["elantra", "sonata", "tucson", "santa-fe", "kona", "palisade"],
  // Kia
  "kia": ["forte", "optima", "sportage", "sorento", "telluride", "seltos"],
};

const YEAR_RANGE = { min: 2015, max: 2024 };

// Performance trims to EXCLUDE
const EXCLUDED_TRIMS = [
  'raptor', 'tremor', 'lightning',  // Ford
  'trd-pro', 'gr',                   // Toyota
  'type-r', 'type-s',               // Honda
  'nismo',                          // Nissan
  'zl1', 'ss', 'z71', 'trail-boss', // Chevy
  'n-line', 'n',                    // Hyundai
  'gt-line',                        // Kia
];

// ═══════════════════════════════════════════════════════════════════════════════
// SAME THRESHOLDS AS BATCH 1-2 (NON-NEGOTIABLE)
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  BATCH_SIZE: 200,
  CONFLICT_THRESHOLD: 0.15,
  PROMOTION_THRESHOLD: 0.40,
  MIN_RESEARCH_SUCCESS: 0.70,
  RESEARCH_DELAY_MS: 1500,
  MAX_RESEARCH_ERRORS: 50,
  OUTPUT_DIR: path.resolve(__dirname, "batch-runs"),
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface VehicleTarget {
  year: number;
  make: string;
  model: string;
}

interface ResearchResult {
  vehicle: VehicleTarget;
  success: boolean;
  trims: Array<{
    trim: string;
    tireSize: string;
    wheelDiameter: number;
    wheelWidth?: number;
  }>;
  confidence: "high" | "medium" | "low";
  conflict?: string;
  error?: string;
}

interface BatchResult {
  batchId: string;
  batchNumber: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalTargeted: number;
  totalResearched: number;
  totalValidated: number;
  totalHighConfidence: number;
  totalPromoted: number;
  totalConflicts: number;
  totalSkipped: number;
  totalErrors: number;
  researchSuccessRate: number;
  conflictRate: number;
  promotionRate: number;
  passedQualityGates: boolean;
  gateFailureReason?: string;
  promotedRecords: any[];
  conflictRecords: any[];
  errorRecords: any[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

let pool: pg.Pool;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  }
  return pool;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TARGET SELECTION (FILTERED)
// ═══════════════════════════════════════════════════════════════════════════════

async function selectTargetedVehicles(batchSize: number): Promise<VehicleTarget[]> {
  const db = getPool();
  const targets: VehicleTarget[] = [];
  
  // Build list of make/model combinations we want
  const makeModelPairs: string[] = [];
  for (const [make, models] of Object.entries(TARGET_VEHICLES)) {
    for (const model of models) {
      makeModelPairs.push(`('${make}', '${model}')`);
    }
  }
  
  // Query for vehicles matching our targets that don't have configs yet
  const { rows } = await db.query(`
    SELECT DISTINCT vf.year, vf.make, vf.model
    FROM vehicle_fitments vf
    WHERE vf.year >= $1 AND vf.year <= $2
      AND (LOWER(vf.make), LOWER(REPLACE(REPLACE(vf.model, ' ', '-'), '/', '-'))) IN (${makeModelPairs.join(',')})
      AND NOT EXISTS (
        SELECT 1 FROM vehicle_fitment_configurations vfc
        WHERE vfc.year = vf.year
          AND vfc.make_key = LOWER(REPLACE(vf.make, ' ', '-'))
          AND vfc.model_key = LOWER(REPLACE(REPLACE(vf.model, ' ', '-'), '/', '-'))
      )
    ORDER BY vf.make, vf.model, vf.year
    LIMIT $3
  `, [YEAR_RANGE.min, YEAR_RANGE.max, batchSize]);
  
  for (const row of rows) {
    targets.push({
      year: row.year,
      make: row.make,
      model: row.model,
    });
  }
  
  return targets;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH (same as before)
// ═══════════════════════════════════════════════════════════════════════════════

async function researchVehicle(vehicle: VehicleTarget): Promise<ResearchResult> {
  try {
    const makeSlug = vehicle.make.split(/[\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-');
    const modelSlug = vehicle.model.split(/[\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-').replace(/\//g, '-');
    const url = `https://tiresize.com/tires/${makeSlug}/${modelSlug}/${vehicle.year}/`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      return {
        vehicle,
        success: false,
        trims: [],
        confidence: "low",
        error: `HTTP ${response.status}`,
      };
    }
    
    const html = await response.text();
    const trims = parseTrimsFromHtml(html, vehicle);
    
    if (trims.length === 0) {
      return {
        vehicle,
        success: false,
        trims: [],
        confidence: "low",
        error: "No trim data found",
      };
    }
    
    // Filter out performance trims
    const filteredTrims = trims.filter(t => {
      const trimLower = t.trim.toLowerCase();
      return !EXCLUDED_TRIMS.some(ex => trimLower.includes(ex));
    });
    
    const conflict = detectConflicts(filteredTrims);
    const confidence = filteredTrims.length >= 3 ? "high" : filteredTrims.length >= 1 ? "medium" : "low";
    
    return {
      vehicle,
      success: true,
      trims: filteredTrims,
      confidence,
      conflict,
    };
    
  } catch (err: any) {
    return {
      vehicle,
      success: false,
      trims: [],
      confidence: "low",
      error: err.message,
    };
  }
}

function parseTrimsFromHtml(html: string, vehicle: VehicleTarget): ResearchResult["trims"] {
  const trims: ResearchResult["trims"] = [];
  
  const trimPattern = new RegExp(
    `href="/tires/[^"]+/${vehicle.year}/([^/"]+)/"[^>]*>([^<]+)</a>.*?<div[^>]*class="[^"]*carsizes[^"]*"[^>]*>\\s*<a[^>]+href="/tiresizes/(\\d{3})-(\\d{2})R(\\d{2})`,
    'gis'
  );
  
  let match;
  while ((match = trimPattern.exec(html)) !== null) {
    const trimSlug = match[1];
    const trimText = match[2].trim();
    const width = match[3];
    const aspect = match[4];
    const diameter = parseInt(match[5]);
    const tireSize = `${width}/${aspect}R${diameter}`;
    
    let trimName = trimText;
    const prefixPattern = new RegExp(`^${vehicle.year}\\s+[\\w-]+\\s+[\\w-]+\\s+`, 'i');
    trimName = trimName.replace(prefixPattern, '').trim();
    
    if (!trimName) {
      trimName = trimSlug.replace(/-/g, ' ');
    }
    
    const existing = trims.find(t => t.trim === trimName && t.tireSize === tireSize);
    if (!existing && diameter > 0 && trimName) {
      trims.push({
        trim: trimName,
        tireSize,
        wheelDiameter: diameter,
      });
    }
  }
  
  // Fallback pattern
  if (trims.length === 0) {
    const simplePattern = new RegExp(
      `>${vehicle.year}\\s+[^<]{5,50}</a>[^<]*(?:<[^>]+>[^<]*)*<a[^>]+href="/tiresizes/(\\d{3})-(\\d{2})R(\\d{2})`,
      'gi'
    );
    
    while ((match = simplePattern.exec(html)) !== null) {
      const width = match[1];
      const aspect = match[2];
      const diameter = parseInt(match[3]);
      const tireSize = `${width}/${aspect}R${diameter}`;
      
      const existing = trims.find(t => t.trim === "Base" && t.tireSize === tireSize);
      if (!existing && diameter > 0) {
        trims.push({
          trim: "Base",
          tireSize,
          wheelDiameter: diameter,
        });
      }
    }
  }
  
  // Sanity filter
  return trims.filter(t => {
    if (t.wheelDiameter < 14 || t.wheelDiameter > 26) return false;
    if (t.trim.toLowerCase().includes('inch')) return false;
    if (/^\d{3}\/\d{2}R\d{2}$/.test(t.trim)) return false;
    return true;
  });
}

function detectConflicts(trims: ResearchResult["trims"]): string | undefined {
  const byTrim = new Map<string, Set<number>>();
  
  trims.forEach(t => {
    if (!byTrim.has(t.trim)) {
      byTrim.set(t.trim, new Set());
    }
    byTrim.get(t.trim)!.add(t.wheelDiameter);
  });
  
  for (const [trim, diameters] of byTrim) {
    if (diameters.size > 1) {
      const sizes = Array.from(diameters).sort().join(", ");
      return `${trim}: multiple wheel sizes (${sizes})`;
    }
  }
  
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION (SAME AS BEFORE - NON-NEGOTIABLE)
// ═══════════════════════════════════════════════════════════════════════════════

function validateResult(result: ResearchResult): {
  valid: boolean;
  promotable: boolean;
  reason?: string;
} {
  if (!result.success) {
    return { valid: false, promotable: false, reason: result.error };
  }
  
  if (result.trims.length === 0) {
    return { valid: false, promotable: false, reason: "No trim data" };
  }
  
  if (result.conflict) {
    return { valid: true, promotable: false, reason: result.conflict };
  }
  
  if (result.confidence === "low") {
    return { valid: true, promotable: false, reason: "Low confidence" };
  }
  
  return { valid: true, promotable: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMOTION (SAME AS BEFORE)
// ═══════════════════════════════════════════════════════════════════════════════

async function promoteResult(result: ResearchResult): Promise<number> {
  const db = getPool();
  let promoted = 0;
  
  const makeKey = result.vehicle.make.toLowerCase().replace(/\s+/g, '-');
  const modelKey = result.vehicle.model.toLowerCase().replace(/[\s\/]+/g, '-');
  
  for (const trim of result.trims) {
    try {
      const trimKey = trim.trim.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const configKey = `${result.vehicle.year}_${makeKey}_${modelKey}_${trimKey}_${trim.wheelDiameter}`;
      
      const { rows: existing } = await db.query(`
        SELECT id FROM vehicle_fitment_configurations
        WHERE configuration_key = $1
      `, [configKey]);
      
      if (existing.length > 0) {
        continue;
      }
      
      const id = generateId(32);
      
      await db.query(`
        INSERT INTO vehicle_fitment_configurations (
          id, year, make_key, model_key, display_trim,
          configuration_key, configuration_label,
          tire_size, wheel_diameter, wheel_width,
          axle_position, is_default, is_optional,
          source, source_confidence,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      `, [
        id,
        result.vehicle.year,
        makeKey,
        modelKey,
        trim.trim,
        configKey,
        `${result.vehicle.year} ${result.vehicle.make} ${result.vehicle.model} ${trim.trim} - ${trim.tireSize}`,
        trim.tireSize,
        trim.wheelDiameter,
        trim.wheelWidth || null,
        'all',
        true,
        false,
        'tiresize.com [batch3-targeted]',
        result.confidence,
      ]);
      
      promoted++;
    } catch (err: any) {
      console.error(`  ⚠️ Insert error: ${err.message}`);
    }
  }
  
  return promoted;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BATCH EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function runBatch3() {
  const batchId = generateId(8);
  const startedAt = new Date();
  
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║       BATCH 3: TARGETED HIGH-CONFIDENCE FITMENT CONFIG PIPELINE              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Strategy:       PRECISION > VOLUME                                          ║
║  Targets:        Mainstream high-volume vehicles only                        ║
║  Years:          ${YEAR_RANGE.min}-${YEAR_RANGE.max}                                                       ║
║  Makes:          Toyota, Honda, Nissan, Ford, Chevrolet, Hyundai, Kia        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  THRESHOLDS (UNCHANGED)                                                      ║
║  Conflict Rate:    ≤ ${(CONFIG.CONFLICT_THRESHOLD * 100).toFixed(0)}%                                               ║
║  Promotion Rate:   ≥ ${(CONFIG.PROMOTION_THRESHOLD * 100).toFixed(0)}%                                               ║
║  Research Success: ≥ ${(CONFIG.MIN_RESEARCH_SUCCESS * 100).toFixed(0)}%                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
  
  // Select targeted vehicles
  console.log("🎯 Selecting targeted vehicles...");
  const targets = await selectTargetedVehicles(CONFIG.BATCH_SIZE);
  console.log(`   Found ${targets.length} eligible vehicles\n`);
  
  if (targets.length === 0) {
    console.log("✅ All targeted vehicles already have configs!");
    await pool?.end();
    return;
  }
  
  const result: BatchResult = {
    batchId,
    batchNumber: 3,
    startedAt: startedAt.toISOString(),
    completedAt: "",
    durationMs: 0,
    totalTargeted: targets.length,
    totalResearched: 0,
    totalValidated: 0,
    totalHighConfidence: 0,
    totalPromoted: 0,
    totalConflicts: 0,
    totalSkipped: 0,
    totalErrors: 0,
    researchSuccessRate: 0,
    conflictRate: 0,
    promotionRate: 0,
    passedQualityGates: true,
    promotedRecords: [],
    conflictRecords: [],
    errorRecords: [],
  };
  
  console.log(`══════════════════════════════════════════════════════════════════════`);
  console.log(`BATCH 3 | ID: ${batchId} | Targets: ${targets.length}`);
  console.log(`══════════════════════════════════════════════════════════════════════\n`);
  
  // Process each vehicle
  for (let i = 0; i < targets.length; i++) {
    const vehicle = targets[i];
    const progress = `[${i + 1}/${targets.length}]`;
    
    if (result.totalErrors >= CONFIG.MAX_RESEARCH_ERRORS) {
      console.log(`\n🛑 Stopping: too many errors (${result.totalErrors})`);
      result.passedQualityGates = false;
      result.gateFailureReason = `Too many errors: ${result.totalErrors}`;
      break;
    }
    
    const researchResult = await researchVehicle(vehicle);
    result.totalResearched++;
    
    await new Promise(r => setTimeout(r, CONFIG.RESEARCH_DELAY_MS));
    
    if (!researchResult.success) {
      result.totalErrors++;
      result.errorRecords.push({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        error: researchResult.error || "Unknown error",
      });
      console.log(`${progress} ❌ ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${researchResult.error}`);
      continue;
    }
    
    const validation = validateResult(researchResult);
    
    if (!validation.valid) {
      result.totalSkipped++;
      console.log(`${progress} ⏭️ ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${validation.reason}`);
      continue;
    }
    
    result.totalValidated++;
    
    if (researchResult.confidence === "high") {
      result.totalHighConfidence++;
    }
    
    if (!validation.promotable) {
      result.totalConflicts++;
      result.conflictRecords.push({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        conflict: validation.reason || "Unknown conflict",
      });
      console.log(`${progress} ⚠️ ${vehicle.year} ${vehicle.make} ${vehicle.model}: CONFLICT - ${validation.reason}`);
      continue;
    }
    
    const promotedCount = await promoteResult(researchResult);
    result.totalPromoted += promotedCount;
    
    result.promotedRecords.push({
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trims: researchResult.trims.map(t => t.trim),
      tireSize: researchResult.trims[0]?.tireSize || "",
      wheelDiameter: researchResult.trims[0]?.wheelDiameter || 0,
    });
    
    console.log(`${progress} ✅ ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${promotedCount} configs`);
  }
  
  // Calculate rates
  const completedAt = new Date();
  result.completedAt = completedAt.toISOString();
  result.durationMs = completedAt.getTime() - startedAt.getTime();
  
  result.researchSuccessRate = result.totalResearched > 0 
    ? (result.totalValidated / result.totalResearched) 
    : 0;
  
  result.conflictRate = result.totalValidated > 0 
    ? (result.totalConflicts / result.totalValidated) 
    : 0;
  
  result.promotionRate = result.totalValidated > 0 
    ? ((result.totalValidated - result.totalConflicts) / result.totalValidated) 
    : 0;
  
  // Check quality gates
  if (result.researchSuccessRate < CONFIG.MIN_RESEARCH_SUCCESS) {
    result.passedQualityGates = false;
    result.gateFailureReason = `Research success rate ${(result.researchSuccessRate * 100).toFixed(1)}% below threshold ${CONFIG.MIN_RESEARCH_SUCCESS * 100}%`;
  }
  
  if (result.conflictRate > CONFIG.CONFLICT_THRESHOLD) {
    result.passedQualityGates = false;
    result.gateFailureReason = `Conflict rate ${(result.conflictRate * 100).toFixed(1)}% exceeds threshold ${CONFIG.CONFLICT_THRESHOLD * 100}%`;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // BATCH 3 REPORT
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // Batch 2 stats for comparison
  const batch2Stats = {
    researchSuccessRate: 0.697,  // 69.7% (failed threshold)
    promotionRate: 1.0,
    totalPromoted: 236,
    totalValidated: 115,
    totalErrors: 50,
  };
  
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         BATCH 3 RESULTS                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  METRICS                          BATCH 3         BATCH 2         CHANGE     ║
║  ─────────────────────────────────────────────────────────────────────────── ║
║  Vehicles processed:              ${result.totalTargeted.toString().padEnd(12)}  200             -              ║
║  Research success rate:           ${(result.researchSuccessRate * 100).toFixed(1).padEnd(4)}%        69.7%           ${result.researchSuccessRate > batch2Stats.researchSuccessRate ? '↑ BETTER' : '↓ WORSE'}      ║
║  Validation success rate:         ${result.totalValidated.toString().padEnd(12)}  115             ${result.totalValidated > batch2Stats.totalValidated ? '↑' : '↓'}              ║
║  High-confidence promotions:      ${result.totalHighConfidence.toString().padEnd(12)}  -               -              ║
║  Configs inserted:                ${result.totalPromoted.toString().padEnd(12)}  236             ${result.totalPromoted > batch2Stats.totalPromoted ? '↑' : '↓'}              ║
║  Conflicts:                       ${result.totalConflicts.toString().padEnd(12)}  0               -              ║
║  Errors (404s):                   ${result.totalErrors.toString().padEnd(12)}  50              ${result.totalErrors < batch2Stats.totalErrors ? '↑ BETTER' : '↓ WORSE'}      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Quality Gates:                   ${result.passedQualityGates ? '✅ PASSED' : '🛑 FAILED'}                                     ║
${result.gateFailureReason ? `║  Failure Reason:                  ${result.gateFailureReason.substring(0, 45).padEnd(45)}║\n` : ''}║  Duration:                        ${(result.durationMs / 1000 / 60).toFixed(1)} min                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
  
  // Save results
  await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
  const resultFile = path.join(CONFIG.OUTPUT_DIR, `batch3-${batchId}.json`);
  await fs.writeFile(resultFile, JSON.stringify(result, null, 2));
  console.log(`📄 Results saved: ${resultFile}`);
  
  // Recommendation
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
RECOMMENDATION
═══════════════════════════════════════════════════════════════════════════════`);
  
  if (result.researchSuccessRate >= 0.80) {
    console.log(`✅ EXCELLENT: Research rate ${(result.researchSuccessRate * 100).toFixed(1)}% - Continue with this targeting strategy`);
  } else if (result.researchSuccessRate >= CONFIG.MIN_RESEARCH_SUCCESS) {
    console.log(`✅ GOOD: Research rate ${(result.researchSuccessRate * 100).toFixed(1)}% - Strategy working, consider expanding makes`);
  } else {
    console.log(`⚠️ NEEDS REFINEMENT: Research rate ${(result.researchSuccessRate * 100).toFixed(1)}% - Further filtering needed`);
  }
  
  await pool?.end();
}

runBatch3().catch(err => {
  console.error("Batch 3 error:", err);
  pool?.end();
  process.exit(1);
});
