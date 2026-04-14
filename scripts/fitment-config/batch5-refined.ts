/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BATCH 5: REFINED HIGH-TRAFFIC VEHICLE COVERAGE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * IMPROVEMENTS:
 * 1. Mustang trim parsing fix
 * 2. F-150 / truck aliases (F150, F-150, Silverado variants)
 * 3. Chevy model normalization
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
  // Toyota - fill gaps
  "toyota": ["camry", "corolla", "rav4", "highlander", "tundra", "tacoma", "4runner", "prius", "sienna"],
  // Ford - with F-150 fix
  "ford": ["f-150", "escape", "explorer", "edge", "mustang", "ranger", "bronco-sport"],
  // Chevy - with normalization
  "chevrolet": ["equinox", "malibu", "silverado-1500", "traverse", "tahoe", "suburban", "trax", "blazer"],
  // Honda - fill gaps
  "honda": ["civic", "accord", "cr-v", "pilot", "odyssey", "hr-v"],
  // Nissan
  "nissan": ["altima", "rogue", "sentra", "murano", "pathfinder", "maxima", "frontier"],
  // Hyundai/Kia
  "hyundai": ["elantra", "sonata", "tucson", "santa-fe", "kona", "palisade"],
  "kia": ["forte", "k5", "sportage", "sorento", "telluride", "seltos"],
};

const YEAR_RANGE = { min: 2015, max: 2024 };

// ═══════════════════════════════════════════════════════════════════════════════
// YEAR GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

const YEAR_GUARDS: Record<string, { minYear?: number; maxYear?: number }> = {
  "ford:ranger": { minYear: 2019 },
  "ford:bronco-sport": { minYear: 2021 },
  "hyundai:palisade": { minYear: 2020 },
  "hyundai:kona": { minYear: 2018 },
  "kia:telluride": { minYear: 2020 },
  "kia:seltos": { minYear: 2021 },
  "kia:k5": { minYear: 2021 },
  "toyota:prius": { minYear: 2016 },
  "nissan:frontier": { minYear: 2022 },
  "chevrolet:blazer": { minYear: 2019 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// IMPROVED NAMING NORMALIZATION - F-150 / TRUCK ALIASES
// ═══════════════════════════════════════════════════════════════════════════════

const MODEL_ALIASES: Record<string, string[]> = {
  // Ford F-150 - MULTIPLE FORMATS
  "f-150": ["F-150", "F150", "F 150"],
  "f150": ["F-150", "F150", "F 150"],
  // Chevy Silverado
  "silverado-1500": ["Silverado-1500", "Silverado", "Silverado 1500"],
  "silverado": ["Silverado", "Silverado-1500"],
  // Toyota
  "rav4": ["RAV4", "Rav4"],
  "4runner": ["4Runner", "4-Runner"],
  // Honda
  "cr-v": ["CR-V", "CRV"],
  "hr-v": ["HR-V", "HRV"],
  // Hyundai
  "santa-fe": ["Santa-Fe", "Santa Fe", "Santafe"],
  // Ford Mustang - standard
  "mustang": ["Mustang"],
  // Standard aliases
  "equinox": ["Equinox"],
  "malibu": ["Malibu"],
  "traverse": ["Traverse"],
  "tahoe": ["Tahoe"],
  "suburban": ["Suburban"],
  "escape": ["Escape"],
  "explorer": ["Explorer"],
  "edge": ["Edge"],
};

// Performance trims to EXCLUDE
const EXCLUDED_TRIMS = [
  'raptor', 'tremor', 'lightning',
  'trd-pro', 'gr',
  'type-r', 'type-s', 'si',
  'nismo',
  'zl1', 'z71', 'trail-boss',
  'n-line', 'n',
  'gt-line', 'sx-turbo',
  'shelby', 'gt350', 'gt500', 'mach-1', 'mach 1', 'dark horse',
];

// ═══════════════════════════════════════════════════════════════════════════════
// MUSTANG TRIM NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeMustangTrim(trim: string): { normalized: string; original: string } {
  const original = trim;
  let normalized = trim;
  
  // Remove "Premium" suffix for grouping but keep base trim
  if (normalized.toLowerCase().includes('premium')) {
    normalized = normalized.replace(/\s*premium\s*/gi, ' ').trim();
  }
  
  // Normalize common Mustang trims
  const lowerTrim = normalized.toLowerCase();
  
  if (lowerTrim.includes('ecoboost')) {
    normalized = 'EcoBoost';
  } else if (lowerTrim.includes('gt') && !lowerTrim.includes('gt350') && !lowerTrim.includes('gt500')) {
    normalized = 'GT';
  } else if (lowerTrim === 'v6' || lowerTrim.includes('v6')) {
    normalized = 'V6';
  } else if (lowerTrim === 'base' || lowerTrim === 'standard') {
    normalized = 'Base';
  }
  
  return { normalized, original };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAME THRESHOLDS (NON-NEGOTIABLE)
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  BATCH_SIZE: 250,
  CONFLICT_THRESHOLD: 0.15,
  PROMOTION_THRESHOLD: 0.40,
  MIN_RESEARCH_SUCCESS: 0.70,
  RESEARCH_DELAY_MS: 1200,
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
    originalTrim?: string;
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
  mustangAttempts: number;
  mustangSuccesses: number;
  f150Attempts: number;
  f150Successes: number;
  chevyAttempts: number;
  chevySuccesses: number;
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
// TARGET SELECTION
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
// RESEARCH WITH IMPROVED ALIASES
// ═══════════════════════════════════════════════════════════════════════════════

function getModelAliases(model: string): string[] {
  const modelLower = model.toLowerCase().replace(/\s+/g, '-');
  const aliases = MODEL_ALIASES[modelLower];
  
  if (aliases) {
    return aliases;
  }
  
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
    // Ignore
  }
  
  return { html: null, url };
}

async function researchVehicle(vehicle: VehicleTarget, stats: BatchStats): Promise<ResearchResult> {
  const aliases = getModelAliases(vehicle.model);
  stats.aliasAttempts++;
  
  // Track specific model attempts
  const modelLower = vehicle.model.toLowerCase();
  if (modelLower === 'mustang') stats.mustangAttempts++;
  if (modelLower === 'f-150' || modelLower === 'f150') stats.f150Attempts++;
  if (['equinox', 'malibu', 'silverado-1500', 'silverado'].includes(modelLower)) stats.chevyAttempts++;
  
  let html: string | null = null;
  let successAlias: string | null = null;
  
  for (const alias of aliases) {
    const result = await tryFetchWithAlias(vehicle.make, vehicle.model, vehicle.year, alias);
    
    if (result.html) {
      html = result.html;
      successAlias = alias;
      
      const aliasKey = `${vehicle.model.toLowerCase()} → ${alias}`;
      stats.aliasSuccesses[aliasKey] = (stats.aliasSuccesses[aliasKey] || 0) + 1;
      
      // Track specific model successes
      if (modelLower === 'mustang') stats.mustangSuccesses++;
      if (modelLower === 'f-150' || modelLower === 'f150') stats.f150Successes++;
      if (['equinox', 'malibu', 'silverado-1500', 'silverado'].includes(modelLower)) stats.chevySuccesses++;
      
      break;
    }
    
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
  
  // Verify page
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
  
  let trims = parseTrimsFromHtml(html, vehicle);
  
  // Apply Mustang trim normalization
  if (vehicle.model.toLowerCase() === 'mustang') {
    trims = trims.map(t => {
      const { normalized, original } = normalizeMustangTrim(t.trim);
      return { ...t, trim: normalized, originalTrim: original };
    });
  }
  
  if (trims.length === 0) {
    return {
      vehicle,
      success: false,
      trims: [],
      confidence: "low",
      error: "No trim data found",
    };
  }
  
  // Filter performance trims
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
  
  // Primary pattern - with carsizes div
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
  
  // Fallback - simpler pattern for pages with different structure
  if (trims.length === 0) {
    // Try to find tire size links preceded by year text
    const fallbackPattern = new RegExp(
      `>${vehicle.year}\\s+[^<]{3,60}</a>[^<]*(?:<[^>]+>[^<]*){0,5}<a[^>]+href="/tiresizes/(\\d{3})-(\\d{2})R(\\d{2})`,
      'gi'
    );
    
    while ((match = fallbackPattern.exec(html)) !== null) {
      const width = match[1];
      const aspect = match[2];
      const diameter = parseInt(match[3]);
      const tireSize = `${width}/${aspect}R${diameter}`;
      
      const existing = trims.find(t => t.tireSize === tireSize);
      if (!existing && diameter > 0) {
        trims.push({
          trim: "Base",
          tireSize,
          wheelDiameter: diameter,
        });
      }
    }
  }
  
  // Filter invalid entries
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
// VALIDATION (SAME AS BEFORE)
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
        SELECT id FROM vehicle_fitment_configurations WHERE configuration_key = $1
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
        'tiresize.com [batch5-refined]',
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
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function runBatch5() {
  const batchId = generateId(8);
  const startedAt = new Date();
  
  const stats: BatchStats = {
    yearGuardSkips: 0,
    aliasAttempts: 0,
    aliasSuccesses: {},
    falseAliasMatches: 0,
    mustangAttempts: 0,
    mustangSuccesses: 0,
    f150Attempts: 0,
    f150Successes: 0,
    chevyAttempts: 0,
    chevySuccesses: 0,
  };
  
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║       BATCH 5: REFINED HIGH-TRAFFIC VEHICLE COVERAGE                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  IMPROVEMENTS:                                                               ║
║  • Mustang trim normalization                                               ║
║  • F-150 multi-alias support (F-150, F150, F 150)                          ║
║  • Chevy model normalization                                                ║
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
    batchNumber: 5,
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
  console.log(`BATCH 5 | ID: ${batchId} | Targets: ${targets.length}`);
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
        conflict: validation.reason,
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
      aliasUsed: researchResult.aliasUsed,
    });
    
    const aliasNote = researchResult.aliasUsed ? ` [${researchResult.aliasUsed}]` : "";
    console.log(`${progress} ✅ ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${promotedCount} configs${aliasNote}`);
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
  
  // Quality gates
  if (result.researchSuccessRate < CONFIG.MIN_RESEARCH_SUCCESS) {
    result.passedQualityGates = false;
    result.gateFailureReason = `Research success rate ${(result.researchSuccessRate * 100).toFixed(1)}% below threshold`;
  }
  
  // Batch 4 stats
  const batch4Stats = {
    researchSuccessRate: 0.921,
    totalPromoted: 632,
    totalErrors: 3,
  };
  
  const topAliases = Object.entries(stats.aliasSuccesses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         BATCH 5 RESULTS                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  CORE METRICS                     BATCH 5         BATCH 4         CHANGE     ║
║  ─────────────────────────────────────────────────────────────────────────── ║
║  Vehicles processed:              ${result.totalTargeted.toString().padEnd(12)}  172             -              ║
║  Year-guard skips:                ${result.yearGuardSkips.toString().padEnd(12)}  20              -              ║
║  Research success rate:           ${(result.researchSuccessRate * 100).toFixed(1).padEnd(4)}%        92.1%           ${result.researchSuccessRate >= batch4Stats.researchSuccessRate ? '✓ MAINTAINED' : '↓ DROP'}  ║
║  Configs inserted:                ${result.totalPromoted.toString().padEnd(12)}  632             -              ║
║  Errors:                          ${result.totalErrors.toString().padEnd(12)}  3               ${result.totalErrors <= 5 ? '✓ LOW' : '↑ HIGH'}          ║
║  Conflicts:                       ${result.totalConflicts.toString().padEnd(12)}  1               -              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  MODEL-SPECIFIC SUCCESS RATES                                                ║
║  ─────────────────────────────────────────────────────────────────────────── ║
║  Mustang:    ${stats.mustangSuccesses}/${stats.mustangAttempts} (${stats.mustangAttempts > 0 ? ((stats.mustangSuccesses/stats.mustangAttempts)*100).toFixed(0) : 0}%)                                                    ║
║  F-150:      ${stats.f150Successes}/${stats.f150Attempts} (${stats.f150Attempts > 0 ? ((stats.f150Successes/stats.f150Attempts)*100).toFixed(0) : 0}%)                                                    ║
║  Chevy:      ${stats.chevySuccesses}/${stats.chevyAttempts} (${stats.chevyAttempts > 0 ? ((stats.chevySuccesses/stats.chevyAttempts)*100).toFixed(0) : 0}%)                                                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  TOP ALIAS PATTERNS                                                          ║
║  ─────────────────────────────────────────────────────────────────────────── ║`);
  
  topAliases.forEach(([pattern, count]) => {
    console.log(`║  ${pattern.padEnd(40)} ${count.toString().padEnd(24)}║`);
  });
  
  console.log(`╠══════════════════════════════════════════════════════════════════════════════╣
║  Quality Gates:                   ${result.passedQualityGates ? '✅ PASSED' : '🛑 FAILED'}                                     ║
║  Duration:                        ${(result.durationMs / 1000 / 60).toFixed(1)} min                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
  
  // Save
  await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
  const resultFile = path.join(CONFIG.OUTPUT_DIR, `batch5-${batchId}.json`);
  await fs.writeFile(resultFile, JSON.stringify({ ...result, stats }, null, 2));
  console.log(`📄 Results saved: ${resultFile}`);
  
  // Recommendation
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
RECOMMENDATION FOR BATCH 6
═══════════════════════════════════════════════════════════════════════════════`);
  
  if (result.researchSuccessRate >= 0.90 && result.totalErrors <= 5) {
    console.log(`✅ EXCELLENT: Research rate ${(result.researchSuccessRate * 100).toFixed(1)}%, errors ${result.totalErrors}`);
    console.log(`   • Continue expanding coverage`);
    console.log(`   • Consider adding Ram, GMC, Subaru for Batch 6`);
  } else {
    console.log(`⚠️ Review needed before Batch 6`);
  }
  
  await pool?.end();
}

runBatch5().catch(err => {
  console.error("Batch 5 error:", err);
  pool?.end();
  process.exit(1);
});
