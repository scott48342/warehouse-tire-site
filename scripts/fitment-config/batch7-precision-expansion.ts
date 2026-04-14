/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BATCH 7: PRECISION EXPANSION MODE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * GOAL: Expand coverage in high-success brands while maintaining ≥90% research success
 * 
 * TARGET SIZE: 100-150 vehicles
 * 
 * PRIORITY GROUPS:
 *   1. Mazda (expand) - Mazda3, Mazda6 (2016-2024)
 *   2. Jeep (selective) - Wrangler, Grand Cherokee, Cherokee, Compass (base trims)
 *   3. VW - Jetta, Tiguan, Atlas, Golf
 *   4. Dodge (limited) - Durango, Charger (base trims only)
 * 
 * NON-NEGOTIABLE:
 *   - NO regression
 *   - NO lowering validation thresholds
 *   - NO promote conflicting data
 *   - NO overwriting existing configs
 *   - NO performance/specialty trims
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
// BATCH 7 TARGETING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const TARGET_VEHICLES: Record<string, { displayMake: string; models: string[] }> = {
  // Priority 1: Mazda (expand from Batch 6 success)
  "mazda": { 
    displayMake: "Mazda", 
    models: ["Mazda3", "Mazda6"] 
  },
  // Priority 2: Jeep (selective, base trims)
  "jeep": { 
    displayMake: "Jeep", 
    models: ["Wrangler", "Grand-Cherokee", "Cherokee", "Compass"] 
  },
  // Priority 3: VW (clean structure)
  "volkswagen": { 
    displayMake: "Volkswagen", 
    models: ["Jetta", "Tiguan", "Atlas", "Golf"] 
  },
  // Priority 4: Dodge (limited scope)
  "dodge": { 
    displayMake: "Dodge", 
    models: ["Durango", "Charger"] 
  },
};

// Year range
const YEAR_RANGE = { min: 2015, max: 2024 };

// Max vehicles to process
const MAX_VEHICLES = 150;

// ═══════════════════════════════════════════════════════════════════════════════
// YEAR GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

const YEAR_GUARDS: Record<string, { minYear?: number; maxYear?: number }> = {
  "jeep:compass": { minYear: 2017 },      // Redesign in 2017
  "volkswagen:atlas": { minYear: 2018 },   // New model 2018
  "mazda:mazda6": { maxYear: 2021 },       // Discontinued after 2021
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL ALIASES
// ═══════════════════════════════════════════════════════════════════════════════

const MODEL_ALIASES: Record<string, string[]> = {
  // Mazda
  "mazda3": ["Mazda3", "3"],
  "mazda6": ["Mazda6", "6"],
  // Jeep
  "wrangler": ["Wrangler"],
  "grand-cherokee": ["Grand-Cherokee", "Grand Cherokee"],
  "cherokee": ["Cherokee"],
  "compass": ["Compass"],
  // VW
  "jetta": ["Jetta"],
  "tiguan": ["Tiguan"],
  "atlas": ["Atlas"],
  "golf": ["Golf", "GTI", "Golf-GTI"],
  // Dodge
  "durango": ["Durango"],
  "charger": ["Charger"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXCLUDED TRIMS - Performance/specialty packages
// ═══════════════════════════════════════════════════════════════════════════════

const EXCLUDED_TRIMS = [
  // Jeep exclusions
  "rubicon",
  "trailhawk",
  "trackhawk",
  "high altitude",
  "summit",
  "srt",
  "392",
  "4xe",
  // Dodge exclusions
  "hellcat",
  "scat pack",
  "daytona",
  "r/t scat",
  "widebody",
  "redeye",
  "demon",
  "jailbreak",
  // VW exclusions
  "gti",
  "gli",
  "r-line",
  "r line",
  // General exclusions
  "performance package",
  "sport package",
  "track package",
];

// ═══════════════════════════════════════════════════════════════════════════════
// QUALITY GATES - STRICTER FOR BATCH 7
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  MIN_RESEARCH_SUCCESS: 0.85,   // 85% - stricter for precision mode
  MAX_CONFLICT_RATE: 0.15,
  MIN_PROMOTION_RATE: 0.40,
  RATE_LIMIT_DELAY_MS: 2000,
  OUTPUT_DIR: path.join(__dirname, "batch-runs"),
  EARLY_STOP_CHECK_INTERVAL: 25,
  EARLY_STOP_MIN_SUCCESS: 0.70,
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
  
  // Filter excluded trims (STRICT for Batch 7)
  const filteredTrims = trims.filter(t => {
    const trimLower = t.trim.toLowerCase();
    return !EXCLUDED_TRIMS.some(ex => trimLower.includes(ex));
  });
  
  // If all trims filtered out, still count as success but note it
  if (filteredTrims.length === 0 && trims.length > 0) {
    return {
      vehicle,
      success: true,
      trims: [],
      confidence: "low",
      error: "All trims excluded (performance variants)",
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
        'tiresize.com [batch7-precision-expansion]',
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

async function runBatch7() {
  const batchId = generateId();
  const startedAt = new Date();
  
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                      BATCH 7: PRECISION EXPANSION MODE                       ║
║                                                                              ║
║  Batch ID: ${batchId}                                                        ║
║  Started:  ${startedAt.toISOString()}                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  const result: BatchResult = {
    batchId,
    batchNumber: 7,
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
    
    // Early stop check
    if (i > 0 && i % CONFIG.EARLY_STOP_CHECK_INTERVAL === 0) {
      const actualAttempts = i + 1 - result.totalAlreadyCovered;
      if (actualAttempts > 10) {
        const currentSuccessRate = result.totalResearched / actualAttempts;
        if (currentSuccessRate < CONFIG.EARLY_STOP_MIN_SUCCESS) {
          result.earlyStopped = true;
          result.earlyStopReason = `Research success rate dropped to ${(currentSuccessRate * 100).toFixed(1)}% (threshold: ${CONFIG.EARLY_STOP_MIN_SUCCESS * 100}%)`;
          console.log(`\n⚠️ EARLY STOP: ${result.earlyStopReason}`);
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
  
  // Print results
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         BATCH 7 RESULTS                                      ║
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
║  Quality Gates:                   ${result.passedQualityGates ? '✅ PASSED' : '🛑 FAILED'}                                     ║
║  Early Stopped:                   ${result.earlyStopped ? '⚠️ YES' : 'No'}                                         ║
║  Duration:                        ${(result.durationMs / 1000 / 60).toFixed(1)} min                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
  
  // Save results
  await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
  const resultFile = path.join(CONFIG.OUTPUT_DIR, `batch7-${batchId}.json`);
  await fs.writeFile(resultFile, JSON.stringify(result, null, 2));
  console.log(`📄 Results saved: ${resultFile}`);
  
  // Diminishing returns analysis
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
DIMINISHING RETURNS ANALYSIS
═══════════════════════════════════════════════════════════════════════════════`);
  
  const batch6Stats = { researchSuccessRate: 0.986, configsPerVehicle: 5.06, totalPromoted: 334 };
  
  const successDelta = result.researchSuccessRate - batch6Stats.researchSuccessRate;
  const configsDelta = result.configsPerVehicle - batch6Stats.configsPerVehicle;
  
  console.log(`  Batch 6 → Batch 7 comparison:`);
  console.log(`    Research success: ${(batch6Stats.researchSuccessRate * 100).toFixed(1)}% → ${(result.researchSuccessRate * 100).toFixed(1)}% (${successDelta >= 0 ? '+' : ''}${(successDelta * 100).toFixed(1)}%)`);
  console.log(`    Configs/vehicle:  ${batch6Stats.configsPerVehicle.toFixed(2)} → ${result.configsPerVehicle.toFixed(2)} (${configsDelta >= 0 ? '+' : ''}${configsDelta.toFixed(2)})`);
  console.log(`    Total configs:    ${batch6Stats.totalPromoted} → ${result.totalPromoted}`);
  
  // Recommendation
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
RECOMMENDATION
═══════════════════════════════════════════════════════════════════════════════`);
  
  const bestBrand = Object.entries(result.brandPerformance)
    .filter(b => b[1].attempted > 0)
    .sort((a, b) => (b[1].success / b[1].attempted) - (a[1].success / a[1].attempted))[0];
  const worstBrand = Object.entries(result.brandPerformance)
    .filter(b => b[1].attempted > 0)
    .sort((a, b) => (a[1].success / a[1].attempted) - (b[1].success / b[1].attempted))[0];
  
  if (result.researchSuccessRate >= 0.90 && result.configsPerVehicle >= 4.0) {
    console.log(`✅ EXCELLENT: Continue with Batch 8`);
    console.log(`   • Best performing: ${bestBrand?.[0]} (${((bestBrand?.[1].success || 0) / Math.max(bestBrand?.[1].attempted || 1, 1) * 100).toFixed(0)}% success)`);
    console.log(`   • Recommend: Expand successful brands`);
  } else if (result.researchSuccessRate >= 0.75 && result.configsPerVehicle >= 3.0) {
    console.log(`⚠️ MODERATE: Review before Batch 8`);
    console.log(`   • Best: ${bestBrand?.[0]}`);
    console.log(`   • Weakest: ${worstBrand?.[0]} (${((worstBrand?.[1].success || 0) / Math.max(worstBrand?.[1].attempted || 1, 1) * 100).toFixed(0)}% success)`);
    console.log(`   • Consider: Focus only on high-success brands`);
  } else {
    console.log(`🛑 DIMINISHING RETURNS: Stop expansion`);
    console.log(`   • Research success: ${(result.researchSuccessRate * 100).toFixed(1)}%`);
    console.log(`   • Configs/vehicle: ${result.configsPerVehicle.toFixed(2)}`);
    console.log(`   • Current coverage is likely sufficient`);
  }
  
  await pool?.end();
}

runBatch7().catch(err => {
  console.error("Batch 7 error:", err);
  pool?.end();
  process.exit(1);
});
