/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BATCH 6: GAP TARGETING MODE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * GOAL: Fill high-impact remaining gaps using:
 *   - Strategic brand expansion
 *   - Known clean data sources
 *   - High-confidence vehicles only
 * 
 * TARGET SIZE: 75-100 vehicles MAX
 * 
 * PRIORITY GROUPS:
 *   1. RAM (2500, 3500 - basic trims)
 *   2. GMC (Sierra 1500, Terrain)
 *   3. Subaru (high success rate expected)
 *   4. Mazda (clean data)
 * 
 * NON-NEGOTIABLE:
 *   - NO regression
 *   - NO lowering validation thresholds
 *   - NO auto-promote uncertain data
 *   - NO overwriting existing config rows
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
// BATCH 6 TARGETING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// Make names with proper capitalization for URLs
const TARGET_VEHICLES: Record<string, { displayMake: string; models: string[] }> = {
  "ram": { 
    displayMake: "Ram", 
    models: ["2500", "3500"] 
  },
  "gmc": { 
    displayMake: "GMC", 
    models: ["Sierra-1500", "Terrain"] 
  },
  "subaru": { 
    displayMake: "Subaru", 
    models: ["Outback", "Forester", "Crosstrek", "Legacy"] 
  },
  "mazda": { 
    displayMake: "Mazda", 
    models: ["CX-5", "CX-9", "Mazda3", "Mazda6"] 
  },
};

// Year range to research
const YEAR_RANGE = { min: 2015, max: 2024 };

// Max vehicles to process
const MAX_VEHICLES = 100;

// ═══════════════════════════════════════════════════════════════════════════════
// YEAR GUARDS - Vehicles that didn't exist in certain years
// ═══════════════════════════════════════════════════════════════════════════════

const YEAR_GUARDS: Record<string, { minYear?: number; maxYear?: number }> = {
  "subaru:crosstrek": { minYear: 2016 },
  "mazda:cx-9": { minYear: 2016 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL ALIASES - URL naming variations to try
// ═══════════════════════════════════════════════════════════════════════════════

const MODEL_ALIASES: Record<string, string[]> = {
  // RAM
  "2500": ["2500", "Ram-2500"],
  "3500": ["3500", "Ram-3500"],
  // GMC
  "sierra-1500": ["Sierra-1500", "Sierra", "Sierra%201500"],
  "terrain": ["Terrain"],
  // Subaru
  "outback": ["Outback"],
  "forester": ["Forester"],
  "crosstrek": ["Crosstrek", "XV-Crosstrek"],
  "legacy": ["Legacy"],
  // Mazda
  "cx-5": ["CX-5", "CX5"],
  "cx-9": ["CX-9", "CX9"],
  "mazda3": ["Mazda3", "3"],
  "mazda6": ["Mazda6", "6"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXCLUDED TRIMS - Performance/specialty packages to skip
// ═══════════════════════════════════════════════════════════════════════════════

const EXCLUDED_TRIMS = [
  "power wagon",
  "trx",
  "rebel",
  "sport package",
  "performance package",
  "off-road package",
  "wilderness",
];

// ═══════════════════════════════════════════════════════════════════════════════
// QUALITY GATES - UNCHANGED FROM BATCH 5
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  MIN_RESEARCH_SUCCESS: 0.75,
  MAX_CONFLICT_RATE: 0.15,
  MIN_PROMOTION_RATE: 0.40,
  RATE_LIMIT_DELAY_MS: 2000,
  OUTPUT_DIR: path.join(__dirname, "batch-runs"),
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
  
  // Default: return the model as-is
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
  
  // Filter excluded trims
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

// ═══════════════════════════════════════════════════════════════════════════════
// HTML PARSING - Extract trim data from tiresize.com (from batch5)
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
  
  // Fallback - simpler pattern for pages with different structure
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
// PROMOTION - Insert to database
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
      
      // Check if already exists
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
        'tiresize.com [batch6-gap-targeting]',
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
// MAIN BATCH RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

async function runBatch6() {
  const batchId = generateId();
  const startedAt = new Date();
  
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         BATCH 6: GAP TARGETING MODE                          ║
║                                                                              ║
║  Batch ID: ${batchId}                                                        ║
║  Started:  ${startedAt.toISOString()}                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  const result: BatchResult = {
    batchId,
    batchNumber: 6,
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
    
    // Early stop check: diminishing returns
    if (i > 20 && i % 10 === 0) {
      const currentSuccessRate = result.totalResearched / (i + 1 - result.totalAlreadyCovered);
      if (currentSuccessRate < 0.5) {
        console.log(`\n⚠️ EARLY STOP: Research success rate dropped to ${(currentSuccessRate * 100).toFixed(1)}%`);
        break;
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
  
  // Print results
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         BATCH 6 RESULTS                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  CORE METRICS                                                                ║
║  ─────────────────────────────────────────────────────────────────────────── ║
║  Vehicles targeted:               ${result.totalTargeted.toString().padEnd(40)}║
║  Already covered (skipped):       ${result.totalAlreadyCovered.toString().padEnd(40)}║
║  Research attempts:               ${actualAttempts.toString().padEnd(40)}║
║  Research success rate:           ${(result.researchSuccessRate * 100).toFixed(1).padEnd(4)}%${' '.repeat(35)}║
║  Configs inserted:                ${result.totalPromoted.toString().padEnd(40)}║
║  Configs per vehicle:             ${result.configsPerVehicle.toFixed(2).padEnd(40)}║
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
║  Quality Gates:                   ${result.passedQualityGates ? '✅ PASSED' : '🛑 FAILED'}                                     ║
║  Duration:                        ${(result.durationMs / 1000 / 60).toFixed(1)} min                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
  
  // Save results
  await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
  const resultFile = path.join(CONFIG.OUTPUT_DIR, `batch6-${batchId}.json`);
  await fs.writeFile(resultFile, JSON.stringify(result, null, 2));
  console.log(`📄 Results saved: ${resultFile}`);
  
  // Recommendation
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
RECOMMENDATION
═══════════════════════════════════════════════════════════════════════════════`);
  
  // Analyze diminishing returns
  const bestBrand = Object.entries(result.brandPerformance)
    .filter(b => b[1].attempted > 0)
    .sort((a, b) => (b[1].success / b[1].attempted) - (a[1].success / a[1].attempted))[0];
  const worstBrand = Object.entries(result.brandPerformance)
    .filter(b => b[1].attempted > 0)
    .sort((a, b) => (a[1].success / a[1].attempted) - (b[1].success / b[1].attempted))[0];
  
  if (result.researchSuccessRate >= 0.75 && result.configsPerVehicle >= 1.5) {
    console.log(`✅ SOLID RESULTS: Continue with Batch 7`);
    console.log(`   • Best performing: ${bestBrand?.[0]} (${((bestBrand?.[1].success || 0) / Math.max(bestBrand?.[1].attempted || 1, 1) * 100).toFixed(0)}% success)`);
    console.log(`   • Consider: More years for successful brands`);
  } else if (result.researchSuccessRate >= 0.50) {
    console.log(`⚠️ MODERATE RESULTS: Review before continuing`);
    console.log(`   • Best performing: ${bestBrand?.[0]}`);
    console.log(`   • Struggling: ${worstBrand?.[0]} (${((worstBrand?.[1].success || 0) / Math.max(worstBrand?.[1].attempted || 1, 1) * 100).toFixed(0)}% success)`);
    console.log(`   • Consider: Focus on successful brands only`);
  } else {
    console.log(`🛑 DIMINISHING RETURNS: Consider stopping expansion`);
    console.log(`   • Research success rate: ${(result.researchSuccessRate * 100).toFixed(1)}%`);
    console.log(`   • Focus on data quality over coverage`);
  }
  
  await pool?.end();
}

runBatch6().catch(err => {
  console.error("Batch 6 error:", err);
  pool?.end();
  process.exit(1);
});
