/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BATCH 4: SMART TARGETING WITH NORMALIZATION + YEAR GUARDS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * IMPROVEMENTS:
 * 1. Naming normalization - try multiple URL formats for tricky model names
 * 2. Year guards - skip impossible year/model combinations before research
 * 3. Brand expansion - Toyota + Nissan added to strong performers
 * 
 * NON-NEGOTIABLE: Same thresholds, same validation, same promotion rules
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
  // Toyota - NEW for Batch 4
  "toyota": ["camry", "corolla", "rav4", "highlander", "tacoma", "4runner", "prius", "sienna"],
  // Nissan - NEW for Batch 4
  "nissan": ["altima", "sentra", "rogue", "murano", "pathfinder", "frontier", "maxima"],
  // Continue strong performers
  "honda": ["civic", "accord", "cr-v", "pilot", "odyssey", "hr-v"],
  "hyundai": ["elantra", "sonata", "tucson", "santa-fe", "kona", "palisade"],
  "kia": ["forte", "optima", "sportage", "sorento", "telluride", "seltos", "k5"],
  // Selected Chevy/Ford with NORMALIZED names
  "chevrolet": ["equinox", "malibu", "traverse", "tahoe", "suburban", "silverado", "trax"],
  "ford": ["escape", "explorer", "edge", "mustang", "ranger", "bronco-sport", "f150"],
};

const YEAR_RANGE = { min: 2015, max: 2024 };

// ═══════════════════════════════════════════════════════════════════════════════
// YEAR GUARDS - Skip impossible year/model combinations
// ═══════════════════════════════════════════════════════════════════════════════

const YEAR_GUARDS: Record<string, { minYear?: number; maxYear?: number }> = {
  // Ford
  "ford:ranger": { minYear: 2019 },           // Returned to US in 2019
  "ford:bronco-sport": { minYear: 2021 },     // New model 2021
  // Hyundai
  "hyundai:palisade": { minYear: 2020 },      // New model 2020
  "hyundai:kona": { minYear: 2018 },          // New model 2018
  // Kia
  "kia:telluride": { minYear: 2020 },         // New model 2020
  "kia:seltos": { minYear: 2021 },            // New model 2021
  "kia:k5": { minYear: 2021 },                // Replaced Optima 2021
  "kia:optima": { maxYear: 2020 },            // Replaced by K5 after 2020
  // Toyota
  "toyota:prius": { minYear: 2016 },          // Gen 4 started 2016
  // Nissan
  "nissan:frontier": { minYear: 2022 },       // Redesign 2022 (older gen different)
};

// ═══════════════════════════════════════════════════════════════════════════════
// NAMING NORMALIZATION - Try multiple URL formats
// ═══════════════════════════════════════════════════════════════════════════════

const MODEL_ALIASES: Record<string, string[]> = {
  // Ford
  "f150": ["F150", "F-150"],
  "f-150": ["F150", "F-150"],
  // Chevy
  "silverado": ["Silverado", "Silverado-1500"],
  "silverado-1500": ["Silverado", "Silverado-1500"],
  // Honda
  "cr-v": ["CR-V", "CRV"],
  "hr-v": ["HR-V", "HRV"],
  // Toyota
  "rav4": ["RAV4", "Rav4"],
  "4runner": ["4Runner", "4-Runner"],
  // Hyundai
  "santa-fe": ["Santa-Fe", "Santa Fe", "Santafe"],
  // Nissan
  "pathfinder": ["Pathfinder"],
  // Kia
  "sportage": ["Sportage"],
  "sorento": ["Sorento"],
  "telluride": ["Telluride"],
};

// Performance trims to EXCLUDE
const EXCLUDED_TRIMS = [
  'raptor', 'tremor', 'lightning',  // Ford
  'trd-pro', 'gr', 'trd',           // Toyota
  'type-r', 'type-s', 'si',         // Honda
  'nismo', 'midnight',              // Nissan
  'zl1', 'ss', 'z71', 'trail-boss', // Chevy
  'n-line', 'n',                    // Hyundai
  'gt-line', 'sx-turbo',            // Kia
];

// ═══════════════════════════════════════════════════════════════════════════════
// SAME THRESHOLDS AS BATCH 3 (NON-NEGOTIABLE)
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  BATCH_SIZE: 250,
  CONFLICT_THRESHOLD: 0.15,
  PROMOTION_THRESHOLD: 0.40,
  MIN_RESEARCH_SUCCESS: 0.70,
  RESEARCH_DELAY_MS: 1200,  // Slightly faster since we're smarter
  MAX_RESEARCH_ERRORS: 60,
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
  aliasUsed?: string;
}

interface BatchStats {
  yearGuardSkips: number;
  aliasAttempts: number;
  aliasSuccesses: Record<string, number>;
  falseAliasMatches: number;
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
// YEAR GUARD CHECK
// ═══════════════════════════════════════════════════════════════════════════════

function checkYearGuard(make: string, model: string, year: number): { allowed: boolean; reason?: string } {
  const key = `${make.toLowerCase()}:${model.toLowerCase()}`;
  const guard = YEAR_GUARDS[key];
  
  if (!guard) return { allowed: true };
  
  if (guard.minYear && year < guard.minYear) {
    return { allowed: false, reason: `${model} not available before ${guard.minYear}` };
  }
  
  if (guard.maxYear && year > guard.maxYear) {
    return { allowed: false, reason: `${model} discontinued after ${guard.maxYear}` };
  }
  
  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TARGET SELECTION (FILTERED)
// ═══════════════════════════════════════════════════════════════════════════════

async function selectTargetedVehicles(batchSize: number): Promise<VehicleTarget[]> {
  const db = getPool();
  const targets: VehicleTarget[] = [];
  
  const makeModelPairs: string[] = [];
  for (const [make, models] of Object.entries(TARGET_VEHICLES)) {
    for (const model of models) {
      makeModelPairs.push(`('${make}', '${model}')`);
    }
  }
  
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
// RESEARCH WITH ALIAS NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function getModelAliases(model: string): string[] {
  const modelLower = model.toLowerCase().replace(/\s+/g, '-');
  const aliases = MODEL_ALIASES[modelLower];
  
  if (aliases) {
    return aliases;
  }
  
  // Default: try Title Case
  const titleCase = model.split(/[\s-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('-');
  
  return [titleCase];
}

async function tryFetchWithAlias(make: string, model: string, year: number, alias: string): Promise<{ html: string | null; url: string }> {
  const makeSlug = make.split(/[\s-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('-');
  
  const url = `https://tiresize.com/tires/${makeSlug}/${alias}/${year}/`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (response.ok) {
      return { html: await response.text(), url };
    }
  } catch (err) {
    // Ignore fetch errors
  }
  
  return { html: null, url };
}

async function researchVehicle(vehicle: VehicleTarget, stats: BatchStats): Promise<ResearchResult> {
  const aliases = getModelAliases(vehicle.model);
  stats.aliasAttempts++;
  
  let html: string | null = null;
  let successAlias: string | null = null;
  let lastUrl = "";
  
  // Try each alias
  for (const alias of aliases) {
    const result = await tryFetchWithAlias(vehicle.make, vehicle.model, vehicle.year, alias);
    lastUrl = result.url;
    
    if (result.html) {
      html = result.html;
      successAlias = alias;
      
      // Track successful alias
      const aliasKey = `${vehicle.model.toLowerCase()} → ${alias}`;
      stats.aliasSuccesses[aliasKey] = (stats.aliasSuccesses[aliasKey] || 0) + 1;
      break;
    }
    
    // Small delay between alias attempts
    await new Promise(r => setTimeout(r, 500));
  }
  
  if (!html) {
    return {
      vehicle,
      success: false,
      trims: [],
      confidence: "low",
      error: `HTTP 404 (tried: ${aliases.join(', ')})`,
    };
  }
  
  // Verify the page is actually for this vehicle (prevent false alias matches)
  const pageTitle = html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
  const expectedMake = vehicle.make.toLowerCase();
  
  if (!pageTitle.toLowerCase().includes(expectedMake)) {
    stats.falseAliasMatches++;
    return {
      vehicle,
      success: false,
      trims: [],
      confidence: "low",
      error: `False alias match (page: ${pageTitle})`,
    };
  }
  
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
    aliasUsed: successAlias || undefined,
  };
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
  
  // Fallback
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
      
      if (existing.length > 0) continue;
      
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
        'tiresize.com [batch4-smart]',
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

async function runBatch4() {
  const batchId = generateId(8);
  const startedAt = new Date();
  
  const stats: BatchStats = {
    yearGuardSkips: 0,
    aliasAttempts: 0,
    aliasSuccesses: {},
    falseAliasMatches: 0,
  };
  
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║       BATCH 4: SMART TARGETING + NORMALIZATION + YEAR GUARDS                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  IMPROVEMENTS:                                                               ║
║  • Naming normalization (F150, CR-V, RAV4, etc.)                            ║
║  • Year guards (skip impossible year/model combos)                          ║
║  • Brand expansion (Toyota, Nissan + strong performers)                     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  THRESHOLDS (UNCHANGED)                                                      ║
║  Conflict Rate:    ≤ ${(CONFIG.CONFLICT_THRESHOLD * 100).toFixed(0)}%                                               ║
║  Promotion Rate:   ≥ ${(CONFIG.PROMOTION_THRESHOLD * 100).toFixed(0)}%                                               ║
║  Research Success: ≥ ${(CONFIG.MIN_RESEARCH_SUCCESS * 100).toFixed(0)}%                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
  
  console.log("🎯 Selecting targeted vehicles...");
  const targets = await selectTargetedVehicles(CONFIG.BATCH_SIZE);
  console.log(`   Found ${targets.length} eligible vehicles\n`);
  
  if (targets.length === 0) {
    console.log("✅ All targeted vehicles already have configs!");
    await pool?.end();
    return;
  }
  
  const result = {
    batchId,
    batchNumber: 4,
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
    yearGuardSkips: 0,
    researchSuccessRate: 0,
    conflictRate: 0,
    promotionRate: 0,
    passedQualityGates: true,
    gateFailureReason: undefined as string | undefined,
    promotedRecords: [] as any[],
    conflictRecords: [] as any[],
    errorRecords: [] as any[],
  };
  
  console.log(`══════════════════════════════════════════════════════════════════════`);
  console.log(`BATCH 4 | ID: ${batchId} | Targets: ${targets.length}`);
  console.log(`══════════════════════════════════════════════════════════════════════\n`);
  
  for (let i = 0; i < targets.length; i++) {
    const vehicle = targets[i];
    const progress = `[${i + 1}/${targets.length}]`;
    
    if (result.totalErrors >= CONFIG.MAX_RESEARCH_ERRORS) {
      console.log(`\n🛑 Stopping: too many errors (${result.totalErrors})`);
      result.passedQualityGates = false;
      result.gateFailureReason = `Too many errors: ${result.totalErrors}`;
      break;
    }
    
    // Year guard check
    const yearCheck = checkYearGuard(vehicle.make, vehicle.model, vehicle.year);
    if (!yearCheck.allowed) {
      result.yearGuardSkips++;
      stats.yearGuardSkips++;
      console.log(`${progress} ⏭️ ${vehicle.year} ${vehicle.make} ${vehicle.model}: YEAR GUARD - ${yearCheck.reason}`);
      continue;
    }
    
    const researchResult = await researchVehicle(vehicle, stats);
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
      aliasUsed: researchResult.aliasUsed,
    });
    
    const aliasNote = researchResult.aliasUsed ? ` [${researchResult.aliasUsed}]` : "";
    console.log(`${progress} ✅ ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${promotedCount} configs${aliasNote}`);
  }
  
  // Calculate rates
  const completedAt = new Date();
  result.completedAt = completedAt.toISOString();
  result.durationMs = completedAt.getTime() - startedAt.getTime();
  
  const effectiveResearched = result.totalResearched;
  result.researchSuccessRate = effectiveResearched > 0 
    ? (result.totalValidated / effectiveResearched) 
    : 0;
  
  result.conflictRate = result.totalValidated > 0 
    ? (result.totalConflicts / result.totalValidated) 
    : 0;
  
  result.promotionRate = result.totalValidated > 0 
    ? ((result.totalValidated - result.totalConflicts) / result.totalValidated) 
    : 0;
  
  // Quality gates
  if (result.researchSuccessRate < CONFIG.MIN_RESEARCH_SUCCESS) {
    result.passedQualityGates = false;
    result.gateFailureReason = `Research success rate ${(result.researchSuccessRate * 100).toFixed(1)}% below threshold ${CONFIG.MIN_RESEARCH_SUCCESS * 100}%`;
  }
  
  if (result.conflictRate > CONFIG.CONFLICT_THRESHOLD) {
    result.passedQualityGates = false;
    result.gateFailureReason = `Conflict rate ${(result.conflictRate * 100).toFixed(1)}% exceeds threshold ${CONFIG.CONFLICT_THRESHOLD * 100}%`;
  }
  
  // Batch 3 stats for comparison
  const batch3Stats = {
    researchSuccessRate: 0.895,
    totalPromoted: 677,
    totalValidated: 179,
    totalErrors: 13,
    totalConflicts: 1,
  };
  
  // Top alias patterns
  const topAliases = Object.entries(stats.aliasSuccesses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         BATCH 4 RESULTS                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  CORE METRICS                     BATCH 4         BATCH 3         CHANGE     ║
║  ─────────────────────────────────────────────────────────────────────────── ║
║  Vehicles processed:              ${result.totalTargeted.toString().padEnd(12)}  200             -              ║
║  Year-guard skips:                ${result.yearGuardSkips.toString().padEnd(12)}  -               (NEW)          ║
║  Research success rate:           ${(result.researchSuccessRate * 100).toFixed(1).padEnd(4)}%        89.5%           ${result.researchSuccessRate > batch3Stats.researchSuccessRate ? '↑ BETTER' : result.researchSuccessRate < batch3Stats.researchSuccessRate ? '↓ WORSE' : '= SAME'}      ║
║  Validated:                       ${result.totalValidated.toString().padEnd(12)}  179             ${result.totalValidated > batch3Stats.totalValidated ? '↑' : '↓'}              ║
║  High-confidence:                 ${result.totalHighConfidence.toString().padEnd(12)}  121             -              ║
║  Configs inserted:                ${result.totalPromoted.toString().padEnd(12)}  677             ${result.totalPromoted > batch3Stats.totalPromoted ? '↑' : '↓'}              ║
║  Conflicts:                       ${result.totalConflicts.toString().padEnd(12)}  1               -              ║
║  Errors:                          ${result.totalErrors.toString().padEnd(12)}  13              ${result.totalErrors < batch3Stats.totalErrors ? '↑ BETTER' : '↓ WORSE'}      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  ALIAS NORMALIZATION STATS                                                   ║
║  ─────────────────────────────────────────────────────────────────────────── ║
║  Alias attempts:                  ${stats.aliasAttempts.toString().padEnd(50)}║
║  False alias matches prevented:   ${stats.falseAliasMatches.toString().padEnd(50)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║  TOP SUCCESSFUL ALIAS PATTERNS                                               ║
║  ─────────────────────────────────────────────────────────────────────────── ║`);
  
  topAliases.forEach(([pattern, count]) => {
    console.log(`║  ${pattern.padEnd(40)} ${count.toString().padEnd(24)}║`);
  });
  
  console.log(`╠══════════════════════════════════════════════════════════════════════════════╣
║  Quality Gates:                   ${result.passedQualityGates ? '✅ PASSED' : '🛑 FAILED'}                                     ║
${result.gateFailureReason ? `║  Failure Reason:                  ${result.gateFailureReason.substring(0, 45).padEnd(45)}║\n` : ''}║  Duration:                        ${(result.durationMs / 1000 / 60).toFixed(1)} min                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
  
  // Save results
  await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
  const resultFile = path.join(CONFIG.OUTPUT_DIR, `batch4-${batchId}.json`);
  await fs.writeFile(resultFile, JSON.stringify({ ...result, stats }, null, 2));
  console.log(`📄 Results saved: ${resultFile}`);
  
  // Recommendation
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
RECOMMENDATION FOR BATCH 5
═══════════════════════════════════════════════════════════════════════════════`);
  
  if (result.researchSuccessRate >= 0.90) {
    console.log(`✅ EXCELLENT: Research rate ${(result.researchSuccessRate * 100).toFixed(1)}%`);
    console.log(`   • Continue with current targeting strategy`);
    console.log(`   • Consider adding more mainstream models from covered makes`);
  } else if (result.researchSuccessRate >= CONFIG.MIN_RESEARCH_SUCCESS) {
    console.log(`✅ GOOD: Research rate ${(result.researchSuccessRate * 100).toFixed(1)}%`);
    console.log(`   • Review failing models for additional aliases`);
    console.log(`   • Consider tightening year guards`);
  } else {
    console.log(`⚠️ NEEDS REFINEMENT: Research rate ${(result.researchSuccessRate * 100).toFixed(1)}%`);
    console.log(`   • Analyze error patterns`);
    console.log(`   • Add more model aliases`);
  }
  
  await pool?.end();
}

runBatch4().catch(err => {
  console.error("Batch 4 error:", err);
  pool?.end();
  process.exit(1);
});
