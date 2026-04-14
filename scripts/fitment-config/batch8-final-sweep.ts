/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BATCH 8: FINAL COVERAGE SWEEP
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * GOAL: Add final high-confidence coverage for remaining clean, mainstream vehicles.
 * This is NOT broad expansion. This is a FINAL, HIGH-QUALITY PASS.
 * 
 * TARGET SIZE: 75-125 vehicles MAX
 * 
 * PRIORITY GROUPS:
 *   1. Buick (high GM compatibility)
 *   2. Chrysler (Pacifica, 300)
 *   3. Mitsubishi (clean but limited)
 *   4. Lexus (selective - RX, NX, ES)
 * 
 * STOP CONDITIONS:
 *   - Success rate < 90%
 *   - Configs per vehicle < 3
 *   - Conflicts increase
 * 
 * NON-NEGOTIABLE:
 *   - NO regression
 *   - NO lowering validation thresholds
 *   - NO promote conflicting data
 *   - NO overwriting existing configs
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
// BATCH 8 TARGETING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const TARGET_VEHICLES: Record<string, { displayMake: string; models: string[] }> = {
  // Priority 1: Buick (high GM compatibility)
  "buick": { 
    displayMake: "Buick", 
    models: ["Encore", "Envision", "Enclave"] 
  },
  // Priority 2: Chrysler
  "chrysler": { 
    displayMake: "Chrysler", 
    models: ["Pacifica", "300"] 
  },
  // Priority 3: Mitsubishi (clean but limited)
  "mitsubishi": { 
    displayMake: "Mitsubishi", 
    models: ["Outlander", "Eclipse-Cross"] 
  },
  // Priority 4: Lexus (selective)
  "lexus": { 
    displayMake: "Lexus", 
    models: ["RX", "NX", "ES"] 
  },
};

// Year range
const YEAR_RANGE = { min: 2015, max: 2024 };

// Max vehicles to process
const MAX_VEHICLES = 125;

// ═══════════════════════════════════════════════════════════════════════════════
// YEAR GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

const YEAR_GUARDS: Record<string, { minYear?: number; maxYear?: number }> = {
  "buick:envision": { minYear: 2016 },         // New model 2016
  "chrysler:pacifica": { minYear: 2017 },      // Replaced Town & Country in 2017
  "mitsubishi:eclipse-cross": { minYear: 2018 }, // New model 2018
  "lexus:nx": { minYear: 2015 },               // New model 2015
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL ALIASES
// ═══════════════════════════════════════════════════════════════════════════════

const MODEL_ALIASES: Record<string, string[]> = {
  // Buick
  "encore": ["Encore"],
  "envision": ["Envision"],
  "enclave": ["Enclave"],
  // Chrysler
  "pacifica": ["Pacifica"],
  "300": ["300"],
  // Mitsubishi
  "outlander": ["Outlander"],
  "eclipse-cross": ["Eclipse-Cross", "Eclipse Cross"],
  // Lexus
  "rx": ["RX"],
  "nx": ["NX"],
  "es": ["ES"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXCLUDED TRIMS
// ═══════════════════════════════════════════════════════════════════════════════

const EXCLUDED_TRIMS = [
  // Chrysler 300 exclusions
  "srt",
  "srt8",
  "300c srt",
  // Lexus exclusions
  "f sport",
  "f-sport",
  "fsport",
  "luxury",
  "ultra luxury",
  "premium",
  // General exclusions
  "performance package",
  "sport package",
  "black label",
];

// ═══════════════════════════════════════════════════════════════════════════════
// QUALITY GATES - STRICTEST FOR FINAL BATCH
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  MIN_RESEARCH_SUCCESS: 0.90,   // 90% - strictest threshold
  MAX_CONFLICT_RATE: 0.10,      // 10% max conflicts
  MIN_CONFIGS_PER_VEHICLE: 3.0, // Stop if below this
  RATE_LIMIT_DELAY_MS: 2000,
  OUTPUT_DIR: path.join(__dirname, "batch-runs"),
  EARLY_STOP_CHECK_INTERVAL: 20,
  EARLY_STOP_MIN_SUCCESS: 0.85,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Vehicle {
  year: number;
  make: string;
  model: string;
  displayMake: string;
  displayModel: string;
}

interface TrimInfo {
  trim: string;
  tireSize: string;
  wheelDiameter: number;
  wheelWidth?: number;
}

interface ResearchResult {
  vehicle: Vehicle;
  success: boolean;
  trims: TrimInfo[];
  confidence: "high" | "medium" | "low";
  aliasUsed?: string;
  error?: string;
  conflict?: string;
}

interface BatchResult {
  batchId: string;
  batchNumber: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  totalTargeted: number;
  totalResearched: number;
  totalValidated: number;
  totalHighConfidence: number;
  totalPromoted: number;
  totalConflicts: number;
  totalSkipped: number;
  totalErrors: number;
  totalAlreadyCovered: number;
  yearGuardSkips: number;
  researchSuccessRate: number;
  conflictRate: number;
  promotionRate: number;
  configsPerVehicle: number;
  passedQualityGates: boolean;
  gateFailureReason?: string;
  earlyStopped: boolean;
  earlyStopReason?: string;
  promotedRecords: any[];
  conflictRecords: any[];
  errorRecords: any[];
  brandPerformance: Record<string, { attempted: number; success: number; configs: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE CONNECTION
// ═══════════════════════════════════════════════════════════════════════════════

let pool: pg.Pool | null = null;

function getDb(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
    });
  }
  return pool;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TARGETING: GENERATE VEHICLE LIST
// ═══════════════════════════════════════════════════════════════════════════════

async function generateTargets(): Promise<Vehicle[]> {
  const vehicles: Vehicle[] = [];
  
  console.log('Generating target vehicle list...');
  console.log(`Max vehicles: ${MAX_VEHICLES}`);
  
  for (const [make, config] of Object.entries(TARGET_VEHICLES)) {
    for (const model of config.models) {
      for (let year = YEAR_RANGE.min; year <= YEAR_RANGE.max; year++) {
        // Check year guard
        const modelKey = model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const guardKey = `${make}:${modelKey}`;
        const guard = YEAR_GUARDS[guardKey];
        if (guard) {
          if (guard.minYear && year < guard.minYear) continue;
          if (guard.maxYear && year > guard.maxYear) continue;
        }
        
        vehicles.push({ 
          year, 
          make, 
          model: modelKey,
          displayMake: config.displayMake,
          displayModel: model,
        });
        
        if (vehicles.length >= MAX_VEHICLES) break;
      }
      if (vehicles.length >= MAX_VEHICLES) break;
    }
    if (vehicles.length >= MAX_VEHICLES) break;
  }
  
  console.log(`Generated ${vehicles.length} target vehicles`);
  return vehicles;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK IF VEHICLE ALREADY HAS COVERAGE
// ═══════════════════════════════════════════════════════════════════════════════

async function isAlreadyCovered(vehicle: Vehicle): Promise<boolean> {
  const db = getDb();
  const makeKey = vehicle.make.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const modelKey = vehicle.model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  const { rows } = await db.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitment_configurations
    WHERE year = $1 AND make_key = $2 AND model_key = $3
  `, [vehicle.year, makeKey, modelKey]);
  
  return parseInt(rows[0].cnt) > 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIRESIZE.COM RESEARCH
// ═══════════════════════════════════════════════════════════════════════════════

async function tryFetchWithAlias(make: string, alias: string, year: number): Promise<{ html: string | null; url: string }> {
  const url = `https://tiresize.com/tires/${make}/${alias}/${year}/`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

function getModelAliases(model: string): string[] {
  const modelLower = model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const aliases = MODEL_ALIASES[modelLower];
  
  if (aliases) {
    return aliases;
  }
  
  return [model];
}

async function researchVehicle(vehicle: Vehicle): Promise<ResearchResult> {
  const aliases = getModelAliases(vehicle.model);
  
  let html: string | null = null;
  let successAlias: string | null = null;
  
  for (const alias of aliases) {
    const result = await tryFetchWithAlias(vehicle.displayMake, alias, vehicle.year);
    
    if (result.html) {
      html = result.html;
      successAlias = alias;
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
  
  // Verify page is for correct make
  const pageTitle = html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
  const expectedMake = vehicle.displayMake.toLowerCase();
  
  if (!pageTitle.toLowerCase().includes(expectedMake)) {
    return {
      vehicle,
      success: false,
      trims: [],
      confidence: "low",
      error: `False alias match (page: ${pageTitle})`,
    };
  }
  
  let trims = parseTrimsFromHtml(html, vehicle);
  
  if (trims.length === 0) {
    return {
      vehicle,
      success: false,
      trims: [],
      confidence: "low",
      error: "No trim data found",
    };
  }
  
  // Filter excluded trims (STRICT for Batch 8)
  const filteredTrims = trims.filter(t => {
    const trimLower = t.trim.toLowerCase();
    return !EXCLUDED_TRIMS.some(ex => trimLower.includes(ex));
  });
  
  if (filteredTrims.length === 0 && trims.length > 0) {
    return {
      vehicle,
      success: true,
      trims: [],
      confidence: "low",
      error: "All trims excluded (luxury/performance variants)",
    };
  }
  
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

// ═══════════════════════════════════════════════════════════════════════════════
// HTML PARSING
// ═══════════════════════════════════════════════════════════════════════════════

function parseTrimsFromHtml(html: string, vehicle: Vehicle): TrimInfo[] {
  const trims: TrimInfo[] = [];
  
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
  
  // Fallback pattern
  if (trims.length === 0) {
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

function detectConflicts(trims: TrimInfo[]): string | undefined {
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
// VALIDATION
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
    return { valid: false, promotable: false, reason: result.error || "No trim data" };
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
// PROMOTION
// ═══════════════════════════════════════════════════════════════════════════════

async function promoteResult(result: ResearchResult): Promise<number> {
  const db = getDb();
  let promoted = 0;
  
  const makeKey = result.vehicle.make.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const modelKey = result.vehicle.model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
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
        `${result.vehicle.year} ${result.vehicle.displayMake} ${result.vehicle.displayModel} ${trim.trim} - ${trim.tireSize}`,
        trim.tireSize,
        trim.wheelDiameter,
        trim.wheelWidth || null,
        'all',
        true,
        false,
        'tiresize.com [batch8-final-sweep]',
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
// GET TOTAL CONFIG COUNT
// ═══════════════════════════════════════════════════════════════════════════════

async function getTotalConfigCount(): Promise<number> {
  const db = getDb();
  const { rows } = await db.query(`SELECT COUNT(*) as cnt FROM vehicle_fitment_configurations`);
  return parseInt(rows[0].cnt);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BATCH RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

async function runBatch8() {
  const batchId = generateId();
  const startedAt = new Date();
  
  const initialConfigCount = await getTotalConfigCount();
  
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                        BATCH 8: FINAL COVERAGE SWEEP                         ║
║                                                                              ║
║  Batch ID: ${batchId}                                                        ║
║  Started:  ${startedAt.toISOString()}                                        ║
║  Initial configs: ${initialConfigCount}                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  const result: BatchResult = {
    batchId,
    batchNumber: 8,
    startedAt: startedAt.toISOString(),
    totalTargeted: 0,
    totalResearched: 0,
    totalValidated: 0,
    totalHighConfidence: 0,
    totalPromoted: 0,
    totalConflicts: 0,
    totalSkipped: 0,
    totalErrors: 0,
    totalAlreadyCovered: 0,
    yearGuardSkips: 0,
    researchSuccessRate: 0,
    conflictRate: 0,
    promotionRate: 0,
    configsPerVehicle: 0,
    passedQualityGates: true,
    earlyStopped: false,
    promotedRecords: [],
    conflictRecords: [],
    errorRecords: [],
    brandPerformance: {},
  };

  // Initialize brand performance tracking
  for (const make of Object.keys(TARGET_VEHICLES)) {
    result.brandPerformance[make] = { attempted: 0, success: 0, configs: 0 };
  }

  // Generate targets
  const targets = await generateTargets();
  result.totalTargeted = targets.length;
  
  console.log(`\n🎯 Processing ${targets.length} vehicles...\n`);
  
  for (let i = 0; i < targets.length; i++) {
    const vehicle = targets[i];
    const progress = `[${(i + 1).toString().padStart(3)}/${targets.length}]`;
    
    // Track brand attempts
    result.brandPerformance[vehicle.make].attempted++;
    
    // Check if already covered
    const covered = await isAlreadyCovered(vehicle);
    if (covered) {
      result.totalAlreadyCovered++;
      console.log(`${progress} ⏭️ ${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}: Already covered`);
      continue;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_DELAY_MS));
    
    // Research
    let researchResult: ResearchResult;
    try {
      researchResult = await researchVehicle(vehicle);
    } catch (err: any) {
      result.totalErrors++;
      result.errorRecords.push({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        error: err.message,
      });
      console.log(`${progress} ❌ ${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}: ERROR - ${err.message}`);
      continue;
    }
    
    if (!researchResult.success) {
      result.totalErrors++;
      result.errorRecords.push({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        error: researchResult.error || "No data found",
      });
      console.log(`${progress} ❌ ${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}: ${researchResult.error}`);
      continue;
    }
    
    result.totalResearched++;
    result.brandPerformance[vehicle.make].success++;
    
    // Validate
    const validation = validateResult(researchResult);
    
    if (!validation.valid) {
      result.totalSkipped++;
      console.log(`${progress} ⏭️ ${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}: ${validation.reason}`);
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
      console.log(`${progress} ⚠️ ${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}: CONFLICT - ${validation.reason}`);
      continue;
    }
    
    // Promote
    const promotedCount = await promoteResult(researchResult);
    result.totalPromoted += promotedCount;
    result.brandPerformance[vehicle.make].configs += promotedCount;
    
    result.promotedRecords.push({
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trims: researchResult.trims.map(t => t.trim),
      tireSize: researchResult.trims[0]?.tireSize || "",
      wheelDiameter: researchResult.trims[0]?.wheelDiameter,
      aliasUsed: researchResult.aliasUsed,
    });
    
    const aliasNote = researchResult.aliasUsed ? ` [${researchResult.aliasUsed}]` : "";
    console.log(`${progress} ✅ ${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}: ${promotedCount} configs${aliasNote}`);
    
    // Early stop checks (STRICT for final batch)
    if (i > 0 && i % CONFIG.EARLY_STOP_CHECK_INTERVAL === 0) {
      const actualAttempts = i + 1 - result.totalAlreadyCovered;
      if (actualAttempts > 10) {
        const currentSuccessRate = result.totalResearched / actualAttempts;
        const currentConfigsPerVehicle = result.promotedRecords.length > 0 
          ? result.totalPromoted / result.promotedRecords.length 
          : 0;
        
        if (currentSuccessRate < CONFIG.EARLY_STOP_MIN_SUCCESS) {
          result.earlyStopped = true;
          result.earlyStopReason = `Research success rate dropped to ${(currentSuccessRate * 100).toFixed(1)}%`;
          console.log(`\n🛑 EARLY STOP: ${result.earlyStopReason}`);
          break;
        }
        
        if (result.promotedRecords.length >= 5 && currentConfigsPerVehicle < CONFIG.MIN_CONFIGS_PER_VEHICLE) {
          result.earlyStopped = true;
          result.earlyStopReason = `Configs per vehicle dropped to ${currentConfigsPerVehicle.toFixed(2)}`;
          console.log(`\n🛑 EARLY STOP: ${result.earlyStopReason}`);
          break;
        }
      }
    }
  }
  
  // Calculate final metrics
  const completedAt = new Date();
  result.completedAt = completedAt.toISOString();
  result.durationMs = completedAt.getTime() - startedAt.getTime();
  
  const actualAttempts = result.totalTargeted - result.totalAlreadyCovered;
  result.researchSuccessRate = actualAttempts > 0 
    ? result.totalResearched / actualAttempts 
    : 0;
  
  result.conflictRate = result.totalValidated > 0 
    ? result.totalConflicts / result.totalValidated 
    : 0;
  
  result.promotionRate = result.totalValidated > 0 
    ? (result.totalValidated - result.totalConflicts) / result.totalValidated 
    : 0;
  
  result.configsPerVehicle = result.promotedRecords.length > 0
    ? result.totalPromoted / result.promotedRecords.length
    : 0;
  
  // Quality gate checks
  if (result.researchSuccessRate < CONFIG.MIN_RESEARCH_SUCCESS) {
    result.passedQualityGates = false;
    result.gateFailureReason = `Research success rate ${(result.researchSuccessRate * 100).toFixed(1)}% below ${CONFIG.MIN_RESEARCH_SUCCESS * 100}% threshold`;
  }
  if (result.conflictRate > CONFIG.MAX_CONFLICT_RATE) {
    result.passedQualityGates = false;
    result.gateFailureReason = `Conflict rate ${(result.conflictRate * 100).toFixed(1)}% exceeds ${CONFIG.MAX_CONFLICT_RATE * 100}% threshold`;
  }
  
  const finalConfigCount = await getTotalConfigCount();
  
  // Print results
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         BATCH 8 RESULTS                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  CORE METRICS                                                                ║
║  ─────────────────────────────────────────────────────────────────────────── ║
║  Vehicles targeted:               ${result.totalTargeted.toString().padEnd(40)}║
║  Already covered (skipped):       ${result.totalAlreadyCovered.toString().padEnd(40)}║
║  Research attempts:               ${actualAttempts.toString().padEnd(40)}║
║  Research success rate:           ${(result.researchSuccessRate * 100).toFixed(1).padEnd(4)}%${' '.repeat(35)}║
║  Configs inserted:                ${result.totalPromoted.toString().padEnd(40)}║
║  Configs per vehicle:             ${result.configsPerVehicle.toFixed(2).padEnd(40)}║
║  High confidence:                 ${result.totalHighConfidence.toString().padEnd(40)}║
║  Errors:                          ${result.totalErrors.toString().padEnd(40)}║
║  Conflicts:                       ${result.totalConflicts.toString().padEnd(40)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║  BRAND PERFORMANCE                                                           ║
║  ─────────────────────────────────────────────────────────────────────────── ║`);

  for (const [brand, perf] of Object.entries(result.brandPerformance)) {
    const successRate = perf.attempted > 0 ? (perf.success / perf.attempted * 100).toFixed(1) : '0.0';
    console.log(`║  ${brand.padEnd(15)} ${perf.success.toString().padStart(3)}/${perf.attempted.toString().padEnd(3)} (${successRate.padStart(5)}%)  ${perf.configs.toString().padStart(4)} configs${' '.repeat(20)}║`);
  }

  console.log(`╠══════════════════════════════════════════════════════════════════════════════╣
║  FINAL COVERAGE                                                              ║
║  ─────────────────────────────────────────────────────────────────────────── ║
║  Initial configs:                 ${initialConfigCount.toString().padEnd(40)}║
║  Final configs:                   ${finalConfigCount.toString().padEnd(40)}║
║  Added this batch:                ${result.totalPromoted.toString().padEnd(40)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Quality Gates:                   ${result.passedQualityGates ? '✅ PASSED' : '🛑 FAILED'}                                     ║
║  Early Stopped:                   ${result.earlyStopped ? '⚠️ YES' : 'No'}                                         ║
║  Duration:                        ${(result.durationMs / 1000 / 60).toFixed(1)} min                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
  
  // Save results
  await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
  const resultFile = path.join(CONFIG.OUTPUT_DIR, `batch8-${batchId}.json`);
  await fs.writeFile(resultFile, JSON.stringify(result, null, 2));
  console.log(`📄 Results saved: ${resultFile}`);
  
  // Diminishing returns analysis
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
DIMINISHING RETURNS ANALYSIS
═══════════════════════════════════════════════════════════════════════════════`);
  
  const batch7Stats = { researchSuccessRate: 0.991, configsPerVehicle: 4.27, totalPromoted: 465 };
  
  const successDelta = result.researchSuccessRate - batch7Stats.researchSuccessRate;
  const configsDelta = result.configsPerVehicle - batch7Stats.configsPerVehicle;
  
  console.log(`  Batch 7 → Batch 8 comparison:`);
  console.log(`    Research success: ${(batch7Stats.researchSuccessRate * 100).toFixed(1)}% → ${(result.researchSuccessRate * 100).toFixed(1)}% (${successDelta >= 0 ? '+' : ''}${(successDelta * 100).toFixed(1)}%)`);
  console.log(`    Configs/vehicle:  ${batch7Stats.configsPerVehicle.toFixed(2)} → ${result.configsPerVehicle.toFixed(2)} (${configsDelta >= 0 ? '+' : ''}${configsDelta.toFixed(2)})`);
  console.log(`    Total configs:    ${batch7Stats.totalPromoted} → ${result.totalPromoted}`);
  
  // Final recommendation
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
FINAL RECOMMENDATION
═══════════════════════════════════════════════════════════════════════════════`);
  
  if (result.researchSuccessRate >= 0.90 && result.configsPerVehicle >= 3.5 && !result.earlyStopped) {
    console.log(`✅ STRONG FINISH: Expansion completed successfully`);
    console.log(`   • Final coverage: ${finalConfigCount} configs`);
    console.log(`   • Consider: Limited future expansion if needed`);
  } else if (result.researchSuccessRate >= 0.75 && result.configsPerVehicle >= 2.5) {
    console.log(`⚠️ MODERATE FINISH: Coverage adequate but diminishing returns`);
    console.log(`   • Final coverage: ${finalConfigCount} configs`);
    console.log(`   • Recommend: STOP expansion, focus on UX`);
  } else {
    console.log(`🛑 DIMINISHING RETURNS CONFIRMED: STOP expansion`);
    console.log(`   • Research success: ${(result.researchSuccessRate * 100).toFixed(1)}%`);
    console.log(`   • Configs/vehicle: ${result.configsPerVehicle.toFixed(2)}`);
    console.log(`   • Focus on conversion optimization`);
  }
  
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
COVERAGE SUMMARY (All Batches)
═══════════════════════════════════════════════════════════════════════════════
  Pre-expansion:    ~2,894 configs
  Post-expansion:   ${finalConfigCount} configs
  Total added:      ${finalConfigCount - 2894} configs
  Growth:           +${(((finalConfigCount - 2894) / 2894) * 100).toFixed(1)}%
`);
  
  await pool?.end();
}

runBatch8().catch(err => {
  console.error("Batch 8 error:", err);
  pool?.end();
  process.exit(1);
});
