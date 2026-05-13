#!/usr/bin/env node
/**
 * USAF Full Fitment Audit Pipeline: 2000-Current
 * 
 * Comprehensive audit of ALL vehicles from 2000 to current year,
 * comparing WTD database against US AutoForce OEM tire data.
 * 
 * DRY-RUN ONLY - No database writes.
 * 
 * Outputs FOUR categories:
 * 1. Safe Auto-Fixes (95%+ confidence, no ambiguity)
 * 2. Legacy Fallback Enrichments (vehicles without config table)
 * 3. Config-Table Candidates (vehicles using config table)
 * 4. Manual Review Required (staggered, HD trucks, EVs, etc.)
 * 
 * Usage:
 *   node scripts/usaf-full-audit-2000-current.mjs                    # Full audit
 *   node scripts/usaf-full-audit-2000-current.mjs --year-start=2020  # Start from 2020
 *   node scripts/usaf-full-audit-2000-current.mjs --sample=100       # Sample mode
 *   node scripts/usaf-full-audit-2000-current.mjs --make=Ford        # Single make
 *   node scripts/usaf-full-audit-2000-current.mjs --resume           # Resume from checkpoint
 * 
 * Output:
 *   scripts/usaf-audit-results/full-audit-2000-current.json
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MIN_YEAR = 2000;
const CURRENT_YEAR = new Date().getFullYear();
const API_DELAY_MS = 150; // Rate limit protection
const BATCH_SIZE = 50;    // Checkpoint every N vehicles
const CHECKPOINT_FILE = 'scripts/usaf-audit-results/audit-checkpoint.json';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

// ============================================================================
// USAF SOAP CLIENT
// ============================================================================

const API_URL = "https://services.usautoforce.com/integrationservice.asmx";
const SOAP_NAMESPACE = "https://services.usautoforce.com";

function getCredentials() {
  // Production credentials for audit
  return {
    username: "warehousetire",
    password: "!-C02X!l7Kpehwx",
  };
}

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSoapEnvelope(method, body) {
  const creds = getCredentials();
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <Authentication xmlns="${SOAP_NAMESPACE}">
      <User>${escapeXml(creds.username)}</User>
      <Password>${escapeXml(creds.password)}</Password>
    </Authentication>
  </soap:Header>
  <soap:Body>
    <${method} xmlns="${SOAP_NAMESPACE}">
      ${body}
    </${method}>
  </soap:Body>
</soap:Envelope>`;
}

async function callSoapApi(soapAction, envelope) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `${SOAP_NAMESPACE}/${soapAction}`,
    },
    body: envelope,
  });
  
  if (!response.ok) {
    throw new Error(`SOAP API error: ${response.status} ${response.statusText}`);
  }
  
  return response.text();
}

async function getVehicleOptions(year, make, model) {
  const body = `<year>${year}</year>
    <make>${escapeXml(make)}</make>
    <model>${escapeXml(model)}</model>`;
  const envelope = buildSoapEnvelope("GetVehicleOptions", body);
  const response = await callSoapApi("GetVehicleOptions", envelope);
  const sizeMatches = response.matchAll(/<TireSize>([^<]+)<\/TireSize>/g);
  return [...new Set(Array.from(sizeMatches, m => m[1]))];
}

// ============================================================================
// TIRE SIZE NORMALIZATION & VALIDATION
// ============================================================================

function normalizeTireSize(size) {
  if (!size) return null;
  let s = size.toUpperCase().trim();
  
  // Standard: "P?LT?(\d{3})/(\d{2,3})R?(\d{2})"
  const stdMatch = s.match(/^(P)?(LT)?(\d{3})\/(\d{2,3})(ZR|RF)?R?(\d{2})/i);
  if (stdMatch) {
    const [, p, lt, width, aspect, , rim] = stdMatch;
    const prefix = lt || "";
    return `${prefix}${width}/${aspect}R${rim}`;
  }
  
  // Flotation: "(\d{2,3})x(\d{1,2}\.?\d*)R?(\d{2})"
  const flotMatch = s.match(/^(\d{2,3})x(\d{1,2}\.?\d*)R?(\d{2})/i);
  if (flotMatch) {
    const [, diameter, width, rim] = flotMatch;
    return `${diameter}x${width}R${rim}`;
  }
  
  // HL prefix (High Load for EVs)
  const hlMatch = s.match(/^HL(\d{3})\/(\d{2,3})R?(\d{2})/i);
  if (hlMatch) {
    const [, width, aspect, rim] = hlMatch;
    return `HL${width}/${aspect}R${rim}`;
  }
  
  return s;
}

function extractWheelDiameter(size) {
  if (!size) return null;
  const match = size.match(/R(\d{2})$/i);
  return match ? parseInt(match[1]) : null;
}

function isLTSize(size) {
  return /^LT\d/i.test(size);
}

function isPMetricSize(size) {
  return /^P\d/i.test(size) || /^\d{3}\/\d{2}R\d{2}$/i.test(size);
}

function isFlotationSize(size) {
  return /^\d{2,3}x\d/.test(size);
}

function isHLSize(size) {
  return /^HL\d/i.test(size);
}

// ============================================================================
// VEHICLE CLASSIFICATION PATTERNS
// ============================================================================

const STAGGERED_PATTERNS = [
  { make: /porsche/i, model: /911|cayenne|panamera|macan|taycan|boxster|cayman/i },
  { make: /bmw/i, model: /m[2-8]|z4|i[48]/i },
  { make: /ford/i, model: /mustang/i, trim: /gt\s*performance|shelby|mach\s*1|dark\s*horse/i },
  { make: /chevrolet|chevy/i, model: /corvette|camaro/i, trim: /ss|zl1|z06|grand\s*sport/i },
  { make: /dodge/i, model: /challenger|charger/i, trim: /hellcat|demon|scat\s*pack|widebody/i },
  { make: /lamborghini|ferrari|mclaren|aston\s*martin|bentley|rolls[\s-]*royce/i, model: /.*/i },
  { make: /mercedes[\s-]*benz/i, model: /amg|gt|sl/i },
  { make: /audi/i, model: /r8|rs/i },
];

const HD_TRUCK_PATTERNS = [
  { make: /ford/i, model: /f[\s-]?250|f[\s-]?350|f[\s-]?450|super\s*duty/i },
  { make: /chevrolet|chevy|gmc/i, model: /silverado[\s-]*(2500|3500)|sierra[\s-]*(2500|3500)/i },
  { make: /ram/i, model: /2500|3500/i },
];

const EV_PATTERNS = [
  { make: /tesla/i, model: /.*/i },
  { make: /rivian/i, model: /.*/i },
  { make: /lucid/i, model: /.*/i },
  { make: /polestar/i, model: /.*/i },
  { make: /ford/i, model: /mustang\s*mach[\s-]?e|f[\s-]?150\s*lightning/i },
  { make: /chevrolet|chevy/i, model: /bolt|blazer\s*ev|equinox\s*ev|silverado\s*ev/i },
  { make: /hyundai/i, model: /ioniq/i },
  { make: /kia/i, model: /ev6|ev9|niro\s*ev/i },
  { make: /volkswagen|vw/i, model: /id\./i },
  { make: /bmw/i, model: /i[x4-8]|ix/i },
  { make: /mercedes[\s-]*benz/i, model: /eq[a-z]/i },
  { make: /audi/i, model: /e[\s-]?tron/i },
  { make: /porsche/i, model: /taycan/i },
  { make: /genesis/i, model: /gv60|electrified/i },
  { make: /cadillac/i, model: /lyriq/i },
  { make: /gmc/i, model: /hummer\s*ev/i },
];

const PERFORMANCE_VARIANT_PATTERNS = [
  { make: /ford/i, model: /mustang/i },
  { make: /chevrolet|chevy/i, model: /camaro|corvette/i },
  { make: /dodge/i, model: /challenger|charger/i },
  { make: /bmw/i, model: /m[2-8]/i },
  { make: /mercedes[\s-]*benz/i, model: /amg/i },
  { make: /audi/i, model: /rs|s[1-8]/i },
];

function matchesPattern(patterns, year, make, model, trims = []) {
  const trimStr = trims.join(' ');
  return patterns.some(p => {
    const makeMatch = p.make.test(make);
    const modelMatch = p.model.test(model);
    const trimMatch = !p.trim || (p.trim && p.trim.test(trimStr));
    return makeMatch && modelMatch && trimMatch;
  });
}

function classifyVehicle(year, make, model, trims = []) {
  const flags = {
    isStaggered: matchesPattern(STAGGERED_PATTERNS, year, make, model, trims),
    isHDTruck: matchesPattern(HD_TRUCK_PATTERNS, year, make, model, trims),
    isEV: matchesPattern(EV_PATTERNS, year, make, model, trims),
    isPerformanceVariant: matchesPattern(PERFORMANCE_VARIANT_PATTERNS, year, make, model, trims),
  };
  
  flags.needsManualReview = flags.isStaggered || flags.isHDTruck || flags.isEV || flags.isPerformanceVariant;
  
  return flags;
}

// ============================================================================
// DATABASE QUERIES
// ============================================================================

async function getVehicleCount(yearStart, yearEnd, makeFilter) {
  let query = `SELECT COUNT(DISTINCT (year, make, model)) FROM vehicle_fitments WHERE year >= $1 AND year <= $2`;
  const params = [yearStart, yearEnd];
  
  if (makeFilter) {
    query += ` AND LOWER(make) = LOWER($3)`;
    params.push(makeFilter);
  }
  
  const result = await pool.query(query, params);
  return parseInt(result.rows[0].count);
}

async function getDistinctVehicles(yearStart, yearEnd, makeFilter, offset = 0, limit = 10000) {
  let query = `
    SELECT DISTINCT year, make, model
    FROM vehicle_fitments
    WHERE year >= $1 AND year <= $2
  `;
  const params = [yearStart, yearEnd];
  
  if (makeFilter) {
    query += ` AND LOWER(make) = LOWER($${params.length + 1})`;
    params.push(makeFilter);
  }
  
  query += ` ORDER BY year DESC, make ASC, model ASC OFFSET $${params.length + 1} LIMIT $${params.length + 2}`;
  params.push(offset, limit);
  
  const result = await pool.query(query, params);
  return result.rows;
}

async function getVehicleFitments(year, make, model) {
  const query = `
    SELECT id, year, make, model, display_trim, oem_tire_sizes, oem_wheel_sizes,
           bolt_pattern, center_bore_mm, quality_tier, certification_status
    FROM vehicle_fitments
    WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
  `;
  const result = await pool.query(query, [year, make, model]);
  return result.rows;
}

async function hasConfigTableEntries(year, make, model) {
  const makeKey = make.toLowerCase().replace(/[\s-]+/g, '_');
  const modelKey = model.toLowerCase().replace(/[\s-]+/g, '_');
  
  const query = `
    SELECT COUNT(*) FROM vehicle_fitment_configurations
    WHERE year = $1 AND make_key = $2 AND model_key = $3
  `;
  const result = await pool.query(query, [year, makeKey, modelKey]);
  return parseInt(result.rows[0].count) > 0;
}

async function getConfigTableSizes(year, make, model) {
  const makeKey = make.toLowerCase().replace(/[\s-]+/g, '_');
  const modelKey = model.toLowerCase().replace(/[\s-]+/g, '_');
  
  const query = `
    SELECT DISTINCT tire_size, wheel_diameter, axle_position
    FROM vehicle_fitment_configurations
    WHERE year = $1 AND make_key = $2 AND model_key = $3
  `;
  const result = await pool.query(query, [year, makeKey, modelKey]);
  return result.rows;
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function analyzeNotationIssues(sizes) {
  const issues = [];
  const normalized = new Map();
  
  for (const size of sizes) {
    const norm = normalizeTireSize(size);
    if (!norm) {
      issues.push({ type: 'invalid_format', size, fix: null });
      continue;
    }
    
    if (norm !== size) {
      issues.push({ type: 'notation_cleanup', size, fix: norm });
    }
    
    // Check for duplicates after normalization
    if (normalized.has(norm)) {
      issues.push({ type: 'duplicate', size, fix: `remove (duplicate of ${normalized.get(norm)})` });
    } else {
      normalized.set(norm, size);
    }
  }
  
  return issues;
}

function compareSizes(wtdSizes, usafSizes) {
  const wtdNorm = new Set(wtdSizes.map(normalizeTireSize).filter(Boolean));
  const usafNorm = new Set(usafSizes.map(normalizeTireSize).filter(Boolean));
  
  const common = [...wtdNorm].filter(s => usafNorm.has(s));
  const wtdOnly = [...wtdNorm].filter(s => !usafNorm.has(s));
  const usafOnly = [...usafNorm].filter(s => !wtdNorm.has(s));
  
  return { common, wtdOnly, usafOnly };
}

function calculateConfidence(candidate, existingDiameters, comparison) {
  let confidence = 50;
  const reasons = [];
  
  // +25: Existing diameter match
  const candidateDia = extractWheelDiameter(candidate);
  if (candidateDia && existingDiameters.includes(candidateDia)) {
    confidence += 25;
    reasons.push(`Uses existing ${candidateDia}" wheel diameter`);
  } else if (candidateDia) {
    confidence -= 20;
    reasons.push(`New wheel diameter: ${candidateDia}"`);
  }
  
  // +15: Multiple common sizes (indicates good WTD/USAF alignment)
  if (comparison.common.length >= 3) {
    confidence += 15;
    reasons.push(`${comparison.common.length} common sizes (good alignment)`);
  } else if (comparison.common.length === 0) {
    confidence -= 15;
    reasons.push("No common sizes (poor alignment)");
  }
  
  // +10: Standard size format
  if (candidate.match(/^\d{3}\/\d{2}R\d{2}$/)) {
    confidence += 10;
    reasons.push("Standard P-metric format");
  } else if (candidate.match(/^LT\d{3}\/\d{2}R\d{2}$/)) {
    confidence += 5;
    reasons.push("LT format (light truck)");
  }
  
  // -20: Mixed load class concerns
  const candidateIsLT = isLTSize(candidate);
  const hasOppositeType = comparison.common.some(s => isLTSize(s) !== candidateIsLT);
  if (hasOppositeType && candidateDia) {
    // Check if same diameter has opposite type
    const sameDiaSizes = [...comparison.common, ...comparison.wtdOnly].filter(s => 
      extractWheelDiameter(s) === candidateDia
    );
    const hasMixedAtDia = sameDiaSizes.some(s => isLTSize(s) !== candidateIsLT);
    if (hasMixedAtDia) {
      confidence -= 20;
      reasons.push("Mixed LT/P-metric at same diameter");
    }
  }
  
  return { confidence: Math.max(0, Math.min(100, confidence)), reasons };
}

function categorizeCandidate(candidate, vehicleFlags, existingDiameters, comparison, hasConfig) {
  const { confidence, reasons } = calculateConfidence(candidate, existingDiameters, comparison);
  const candidateDia = extractWheelDiameter(candidate);
  
  // Auto-reject rules
  const autoReject = [];
  
  // Flotation sizes
  if (isFlotationSize(candidate)) {
    autoReject.push("Flotation tire format requires manual review");
  }
  
  // HL sizes (EV high load)
  if (isHLSize(candidate)) {
    autoReject.push("HL (High Load) tire format requires manual review");
  }
  
  // New wheel diameter
  if (candidateDia && !existingDiameters.includes(candidateDia)) {
    autoReject.push(`New wheel diameter ${candidateDia}" not in existing config`);
  }
  
  // Vehicle flags
  if (vehicleFlags.isStaggered) {
    autoReject.push("Staggered vehicle - unclear axle assignment");
  }
  if (vehicleFlags.isHDTruck) {
    autoReject.push("HD truck - SRW/DRW ambiguity");
  }
  if (vehicleFlags.isEV && isHLSize(candidate)) {
    autoReject.push("EV with HL tire - verify load requirements");
  }
  
  // Mixed load class at same diameter
  const candidateIsLT = isLTSize(candidate);
  const sameDiaSizes = [...comparison.common, ...comparison.wtdOnly].filter(s => 
    extractWheelDiameter(s) === candidateDia
  );
  const hasMixedAtDia = sameDiaSizes.some(s => isLTSize(s) !== candidateIsLT);
  if (hasMixedAtDia) {
    autoReject.push("Mixed LT/P-metric at same diameter");
  }
  
  // Determine category
  let category;
  if (autoReject.length > 0 || vehicleFlags.needsManualReview) {
    category = "manual_review";
  } else if (hasConfig) {
    category = "config_candidate";
  } else if (confidence >= 95) {
    category = "safe_auto_fix";
  } else if (confidence >= 80) {
    category = "legacy_fallback";
  } else {
    category = "manual_review";
  }
  
  return {
    tireSize: candidate,
    wheelDiameter: candidateDia,
    confidence,
    reasons,
    autoReject,
    category,
  };
}

// ============================================================================
// AUDIT ENGINE
// ============================================================================

async function auditVehicle(year, make, model) {
  const result = {
    year,
    make,
    model,
    wtd: { sizes: [], trims: [], diameters: [] },
    usaf: { sizes: [] },
    hasConfigTable: false,
    configSizes: [],
    vehicleFlags: {},
    comparison: { common: [], wtdOnly: [], usafOnly: [] },
    notationIssues: [],
    candidates: [],
    category: null,
    error: null,
  };
  
  try {
    // Get WTD fitment data
    const fitments = await getVehicleFitments(year, make, model);
    const trims = fitments.map(f => f.display_trim).filter(Boolean);
    
    // Classify vehicle
    result.vehicleFlags = classifyVehicle(year, make, model, trims);
    
    // Extract tire sizes and wheel diameters from WTD
    const allSizes = new Set();
    const allDiameters = new Set();
    
    for (const f of fitments) {
      const tireSizes = f.oem_tire_sizes || [];
      for (const ts of tireSizes) {
        if (typeof ts === 'string') {
          const norm = normalizeTireSize(ts);
          if (norm) {
            allSizes.add(norm);
            const dia = extractWheelDiameter(norm);
            if (dia) allDiameters.add(dia);
          }
        }
      }
      
      // Also extract diameters from wheel sizes
      const wheelSizes = f.oem_wheel_sizes || [];
      for (const ws of wheelSizes) {
        if (typeof ws === 'object' && ws.diameter) {
          allDiameters.add(ws.diameter);
        }
      }
    }
    
    result.wtd.sizes = [...allSizes];
    result.wtd.trims = trims;
    result.wtd.diameters = [...allDiameters].sort((a, b) => a - b);
    
    // Check config table
    result.hasConfigTable = await hasConfigTableEntries(year, make, model);
    if (result.hasConfigTable) {
      result.configSizes = await getConfigTableSizes(year, make, model);
      // Add config diameters to the set
      for (const cs of result.configSizes) {
        if (cs.wheel_diameter) allDiameters.add(cs.wheel_diameter);
      }
      result.wtd.diameters = [...allDiameters].sort((a, b) => a - b);
    }
    
    // Check notation issues in WTD data
    result.notationIssues = analyzeNotationIssues(result.wtd.sizes);
    
    // Get USAF data
    const usafSizes = await getVehicleOptions(year, make, model);
    result.usaf.sizes = usafSizes.map(normalizeTireSize).filter(Boolean);
    
    // Compare
    result.comparison = compareSizes(result.wtd.sizes, result.usaf.sizes);
    
    // Categorize each USAF-only size as a candidate
    for (const candidate of result.comparison.usafOnly) {
      const categorized = categorizeCandidate(
        candidate,
        result.vehicleFlags,
        result.wtd.diameters,
        result.comparison,
        result.hasConfigTable
      );
      result.candidates.push(categorized);
    }
    
    // Also flag notation issues as auto-fix candidates
    for (const issue of result.notationIssues) {
      if (issue.type === 'notation_cleanup' && issue.fix) {
        result.candidates.push({
          tireSize: issue.size,
          wheelDiameter: extractWheelDiameter(issue.size),
          confidence: 99,
          reasons: [`Notation cleanup: ${issue.size} → ${issue.fix}`],
          autoReject: [],
          category: "safe_auto_fix",
          fixType: "notation",
          fixValue: issue.fix,
        });
      } else if (issue.type === 'duplicate') {
        result.candidates.push({
          tireSize: issue.size,
          wheelDiameter: extractWheelDiameter(issue.size),
          confidence: 99,
          reasons: [`Duplicate removal: ${issue.fix}`],
          autoReject: [],
          category: "safe_auto_fix",
          fixType: "duplicate",
        });
      }
    }
    
    // Determine overall vehicle category
    const safeCount = result.candidates.filter(c => c.category === "safe_auto_fix").length;
    const legacyCount = result.candidates.filter(c => c.category === "legacy_fallback").length;
    const configCount = result.candidates.filter(c => c.category === "config_candidate").length;
    const manualCount = result.candidates.filter(c => c.category === "manual_review").length;
    
    if (result.comparison.usafOnly.length === 0 && result.notationIssues.length === 0) {
      result.category = "exact_match";
    } else if (manualCount > 0 || result.vehicleFlags.needsManualReview) {
      result.category = "manual_review";
    } else if (configCount > 0) {
      result.category = "config_candidate";
    } else if (safeCount > 0) {
      result.category = "safe_auto_fix";
    } else if (legacyCount > 0) {
      result.category = "legacy_fallback";
    } else {
      result.category = "no_action";
    }
    
  } catch (error) {
    result.error = error.message;
    result.category = "error";
  }
  
  return result;
}

// ============================================================================
// CHECKPOINT / RESUME
// ============================================================================

function saveCheckpoint(processedCount, lastVehicle, vehicleStats, candidateStats) {
  const checkpoint = {
    timestamp: new Date().toISOString(),
    processedCount,
    lastProcessed: lastVehicle,
    vehicleStats: { ...vehicleStats },
    candidateStats: { ...candidateStats },
  };
  
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return null;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  
  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    flags[key] = value || true;
  }
  
  const yearStart = parseInt(flags['year-start']) || MIN_YEAR;
  const yearEnd = parseInt(flags['year-end']) || CURRENT_YEAR;
  const makeFilter = flags.make || null;
  const sampleSize = parseInt(flags.sample) || null;
  const resumeMode = flags.resume;
  const verboseMode = flags.verbose;
  const batchOffset = parseInt(flags.offset) || 0;
  const batchLimit = parseInt(flags.limit) || null;
  const batchName = flags.batch || null;
  
  console.log("🔍 USAF Full Fitment Audit: 2000-Current");
  console.log("=".repeat(70));
  if (batchName) console.log(`Batch: ${batchName}`);
  console.log(`Year range: ${yearStart} - ${yearEnd}`);
  if (makeFilter) console.log(`Make filter: ${makeFilter}`);
  if (sampleSize) console.log(`Sample size: ${sampleSize}`);
  if (batchOffset || batchLimit) console.log(`Batch range: offset=${batchOffset}, limit=${batchLimit || 'all'}`);
  if (verboseMode) console.log(`Verbose mode: ON`);
  console.log(`Mode: DRY-RUN (no database writes)`);
  console.log("");
  
  // Get total vehicle count
  const totalCount = await getVehicleCount(yearStart, yearEnd, makeFilter);
  console.log(`📊 Total vehicles to audit: ${totalCount.toLocaleString()}`);
  
  // Resume from checkpoint if requested
  let resumeOffset = 0;
  if (resumeMode) {
    const checkpoint = loadCheckpoint();
    if (checkpoint) {
      resumeOffset = checkpoint.processedCount;
      console.log(`📍 Resuming from checkpoint: ${resumeOffset} vehicles already processed`);
    }
  }
  
  // Get vehicles to audit
  const fetchOffset = batchOffset || resumeOffset;
  const fetchLimit = batchLimit || sampleSize || 100000;
  let vehicles = await getDistinctVehicles(yearStart, yearEnd, makeFilter, fetchOffset, fetchLimit);
  
  if (sampleSize && !batchLimit && vehicles.length > sampleSize) {
    vehicles = vehicles.sort(() => Math.random() - 0.5).slice(0, sampleSize);
    console.log(`📊 Sampling ${sampleSize} vehicles`);
  }
  
  console.log(`📊 Auditing ${vehicles.length} vehicles (offset ${fetchOffset})...`);
  console.log("");
  
  // Results storage
  const results = {
    timestamp: new Date().toISOString(),
    type: "usaf_full_audit_2000_current",
    parameters: { yearStart, yearEnd, makeFilter, sampleSize },
    
    summary: {
      totalVehicles: vehicles.length,
      exactMatch: 0,
      partialMatch: 0,
      wtdOnly: 0,
      usafOnly: 0,
      safeAutoFixCount: 0,
      legacyFallbackCount: 0,
      configCandidateCount: 0,
      manualReviewCount: 0,
      errorCount: 0,
    },
    
    safeAutoFixes: [],
    legacyFallbackEnrichments: [],
    configTableCandidates: [],
    manualReviewRequired: [],
    errors: [],
    
    // Raw data for top 100 fixes
    topProposedFixes: [],
  };
  
  // Process vehicles
  let processed = 0;
  let successCount = 0;
  let noUsafResultCount = 0;
  const recentVehicles = [];  // Last 10 processed
  const startTime = Date.now();
  
  // Real-time stats for checkpoint
  const vehicleStats = {
    exactMatch: 0,
    partialMatch: 0,
    wtdOnly: 0,
    usafOnly: 0,
    errors: 0,
  };
  const candidateStats = {
    safe_auto_fix: 0,
    legacy_fallback: 0,
    config_candidate: 0,
    manual_review: 0,
  };
  
  for (const v of vehicles) {
    const result = await auditVehicle(v.year, v.make, v.model);
    
    // Track recent vehicles
    recentVehicles.push({ year: v.year, make: v.make, model: v.model, category: result.category });
    if (recentVehicles.length > 10) recentVehicles.shift();
    
    // Update summary based on comparison
    if (result.error) {
      vehicleStats.errors++;
      results.summary.errorCount++;
      results.errors.push({
        year: v.year,
        make: v.make,
        model: v.model,
        error: result.error,
      });
    } else {
      successCount++;
      
      if (result.usaf.sizes.length === 0) {
        noUsafResultCount++;
        vehicleStats.wtdOnly++;
        results.summary.wtdOnly++;
      } else if (result.comparison.common.length > 0 && 
                 result.comparison.wtdOnly.length === 0 && 
                 result.comparison.usafOnly.length === 0) {
        vehicleStats.exactMatch++;
        results.summary.exactMatch++;
      } else if (result.comparison.common.length > 0) {
        vehicleStats.partialMatch++;
        results.summary.partialMatch++;
      } else {
        vehicleStats.usafOnly++;
        results.summary.usafOnly++;
      }
    }
    
    // Categorize candidates
    for (const candidate of result.candidates) {
      const entry = {
        year: v.year,
        make: v.make,
        model: v.model,
        tireSize: candidate.tireSize,
        wheelDiameter: candidate.wheelDiameter,
        confidence: candidate.confidence,
        reasons: candidate.reasons,
        autoReject: candidate.autoReject,
        hasConfigTable: result.hasConfigTable,
        vehicleFlags: result.vehicleFlags,
        existingDiameters: result.wtd.diameters,
        existingWtdSizes: result.wtd.sizes,
        existingUsafSizes: result.usaf.sizes,
        fixType: candidate.fixType,
        fixValue: candidate.fixValue,
        category: candidate.category,
      };
      
      switch (candidate.category) {
        case "safe_auto_fix":
          candidateStats.safe_auto_fix++;
          results.safeAutoFixes.push(entry);
          break;
        case "legacy_fallback":
          candidateStats.legacy_fallback++;
          results.legacyFallbackEnrichments.push(entry);
          break;
        case "config_candidate":
          candidateStats.config_candidate++;
          results.configTableCandidates.push(entry);
          break;
        case "manual_review":
          candidateStats.manual_review++;
          results.manualReviewRequired.push(entry);
          break;
      }
    }
    
    // Verbose mode: log every vehicle
    if (verboseMode) {
      const vName = `${v.year} ${v.make} ${v.model}`;
      const usafCount = result.usaf.sizes.length;
      const wtdCount = result.wtd.sizes.length;
      const commonCount = result.comparison.common.length;
      const candCount = result.candidates.length;
      console.log(`  [${processed + 1}] ${vName.padEnd(35)} WTD:${wtdCount} USAF:${usafCount} Common:${commonCount} Cand:${candCount} -> ${result.category}`);
    }
    
    // Progress tracking (every 50 vehicles in non-verbose mode)
    processed++;
    const shouldLog = verboseMode ? (processed % 100 === 0) : (processed % 50 === 0);
    
    if (shouldLog) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (vehicles.length - processed) / rate;
      
      if (!verboseMode) {
        process.stdout.write(`\r  Progress: ${processed}/${vehicles.length} (${(processed/vehicles.length*100).toFixed(1)}%) | ${rate.toFixed(1)}/s | ETA: ${Math.ceil(remaining/60)}m`);
      } else {
        // In verbose mode, print a summary line every 100
        console.log(`\n  📊 Checkpoint @ ${processed}/${vehicles.length}`);
        console.log(`     Success: ${successCount} | NoUSAF: ${noUsafResultCount} | Errors: ${vehicleStats.errors}`);
        console.log(`     Exact: ${vehicleStats.exactMatch} | Partial: ${vehicleStats.partialMatch} | WTDOnly: ${vehicleStats.wtdOnly} | USAFOnly: ${vehicleStats.usafOnly}`);
        console.log(`     Candidates -> Safe: ${candidateStats.safe_auto_fix} | Legacy: ${candidateStats.legacy_fallback} | Config: ${candidateStats.config_candidate} | Manual: ${candidateStats.manual_review}`);
        console.log(`     Recent: ${recentVehicles.slice(-5).map(r => `${r.year} ${r.make} ${r.model}`).join(', ')}`);
        console.log('');
      }
      
      // Save checkpoint with proper stats
      saveCheckpoint(processed, v, vehicleStats, candidateStats);
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, API_DELAY_MS));
  }
  
  console.log(`\r  Progress: ${processed}/${vehicles.length} ✅` + " ".repeat(50));
  
  // Update summary counts
  results.summary.safeAutoFixCount = results.safeAutoFixes.length;
  results.summary.legacyFallbackCount = results.legacyFallbackEnrichments.length;
  results.summary.configCandidateCount = results.configTableCandidates.length;
  results.summary.manualReviewCount = results.manualReviewRequired.length;
  
  // Build top 100 proposed fixes (sorted by confidence)
  const allFixes = [
    ...results.safeAutoFixes,
    ...results.legacyFallbackEnrichments,
    ...results.configTableCandidates,
  ].sort((a, b) => b.confidence - a.confidence);
  
  results.topProposedFixes = allFixes.slice(0, 100);
  
  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 AUDIT SUMMARY");
  console.log("=".repeat(70));
  console.log(`  Total vehicles checked:     ${results.summary.totalVehicles.toLocaleString()}`);
  console.log(`  ✅ Exact match:             ${results.summary.exactMatch.toLocaleString()}`);
  console.log(`  ⚠️  Partial match:           ${results.summary.partialMatch.toLocaleString()}`);
  console.log(`  📥 WTD only:                ${results.summary.wtdOnly.toLocaleString()} (not in USAF)`);
  console.log(`  📤 USAF only:               ${results.summary.usafOnly.toLocaleString()} (we're missing sizes)`);
  console.log(`  ❌ Errors:                  ${results.summary.errorCount.toLocaleString()}`);
  console.log("");
  console.log("📋 CANDIDATE BREAKDOWN:");
  console.log(`  🟢 Safe Auto-Fixes:         ${results.summary.safeAutoFixCount.toLocaleString()}`);
  console.log(`  🔵 Legacy Fallback:         ${results.summary.legacyFallbackCount.toLocaleString()}`);
  console.log(`  🟡 Config-Table Candidates: ${results.summary.configCandidateCount.toLocaleString()}`);
  console.log(`  🔴 Manual Review Required:  ${results.summary.manualReviewCount.toLocaleString()}`);
  
  // Show top 10 safe auto-fixes
  if (results.safeAutoFixes.length > 0) {
    console.log("\n🔝 TOP 10 SAFE AUTO-FIXES:");
    for (const fix of results.safeAutoFixes.slice(0, 10)) {
      console.log(`  ${fix.year} ${fix.make} ${fix.model}`);
      console.log(`    Add: ${fix.tireSize} (${fix.wheelDiameter}") | Confidence: ${fix.confidence}%`);
      if (fix.fixType) console.log(`    Fix type: ${fix.fixType} → ${fix.fixValue || 'remove'}`);
    }
  }
  
  // Show top manual review items
  if (results.manualReviewRequired.length > 0) {
    console.log("\n⚠️  TOP MANUAL REVIEW ITEMS:");
    const manualByVehicle = new Map();
    for (const item of results.manualReviewRequired) {
      const key = `${item.year} ${item.make} ${item.model}`;
      if (!manualByVehicle.has(key)) {
        manualByVehicle.set(key, { ...item, sizes: [] });
      }
      manualByVehicle.get(key).sizes.push(item.tireSize);
    }
    
    let count = 0;
    for (const [key, item] of manualByVehicle) {
      if (count++ >= 10) break;
      console.log(`  ${key}`);
      console.log(`    Sizes: ${item.sizes.join(", ")}`);
      console.log(`    Flags: ${Object.entries(item.vehicleFlags).filter(([,v]) => v).map(([k]) => k).join(", ") || "none"}`);
      console.log(`    Reasons: ${item.autoReject.join("; ")}`);
    }
  }
  
  // Save results
  const outDir = path.join(process.cwd(), 'scripts/usaf-audit-results');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const outFileName = batchName ? `batch-${batchName}.json` : 'full-audit-2000-current.json';
  const outFile = path.join(outDir, outFileName);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outFile}`);
  
  // Cleanup checkpoint
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
  
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n⏱️  Total time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  
  await pool.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
