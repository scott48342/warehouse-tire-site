#!/usr/bin/env node
/**
 * PART 2: USAF Missing Vehicle Discovery
 * 
 * Compares USAF year/make/model list against WTD vehicle_fitments
 * to find missing vehicles and alias mismatches.
 * 
 * NO DB WRITES - Discovery only.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

// =============================================================================
// CONFIGURATION
// =============================================================================

const START_YEAR = 2000;
const END_YEAR = 2026;

// USAF SOAP API
const USAF_API_URL = 'https://services.usautoforce.com/TireInventoryService.asmx';
const USAF_SOAP_ACTION = 'https://services.usautoforce.com/GetVehicleOptions';

// =============================================================================
// ALIAS NORMALIZATION
// =============================================================================

const MAKE_ALIASES = {
  'chevy': 'chevrolet',
  'vw': 'volkswagen',
  'mercedes': 'mercedes-benz',
  'mercedes benz': 'mercedes-benz',
  'dodge ram': 'ram',
  'landrover': 'land rover',
  'land-rover': 'land rover',
  'alfa': 'alfa romeo',
  'aston': 'aston martin',
  'rolls': 'rolls-royce',
  'rolls royce': 'rolls-royce',
};

const MODEL_ALIASES = {
  'f150': 'f-150',
  'f250': 'f-250',
  'f350': 'f-350',
  'f450': 'f-450',
  'f-150': 'f-150',
  '2500hd': '2500 hd',
  '3500hd': '3500 hd',
  'silverado1500': 'silverado 1500',
  'silverado2500': 'silverado 2500',
  'silverado3500': 'silverado 3500',
  'sierra1500': 'sierra 1500',
  'sierra2500': 'sierra 2500',
  'sierra3500': 'sierra 3500',
  'models': 'model s',
  'model3': 'model 3',
  'modely': 'model y',
  'modelx': 'model x',
  'rav-4': 'rav4',
  'cr-v': 'cr-v',
  'crv': 'cr-v',
  'hrv': 'hr-v',
  'h-rv': 'hr-v',
  '3series': '3 series',
  '5series': '5 series',
  'x-3': 'x3',
  'x-5': 'x5',
  'c-class': 'c-class',
  'e-class': 'e-class',
  's-class': 's-class',
  'glc-class': 'glc',
  'gle-class': 'gle',
  'gls-class': 'gls',
  'gt-r': 'gt-r',
  'gtr': 'gt-r',
  'z4': 'z4',
  'rx-8': 'rx-8',
  'rx8': 'rx-8',
  'mx-5': 'mx-5',
  'mx5': 'mx-5',
  'miata': 'mx-5 miata',
  'wrx sti': 'wrx',
};

function normalizeMake(make) {
  if (!make) return '';
  const lower = make.toLowerCase().trim();
  return MAKE_ALIASES[lower] || lower;
}

function normalizeModel(model) {
  if (!model) return '';
  const lower = model.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/-/g, '-');
  return MODEL_ALIASES[lower] || lower;
}

function createVehicleKey(year, make, model) {
  return `${year}|${normalizeMake(make)}|${normalizeModel(model)}`;
}

// =============================================================================
// USAF API QUERIES
// =============================================================================

async function getUSAFYears() {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetVehicleOptions xmlns="https://services.usautoforce.com">
      <credentials>
        <Username>${process.env.USAUTOFORCE_USERNAME}</Username>
        <Password>${process.env.USAUTOFORCE_PASSWORD}</Password>
        <AccountNumber>${process.env.USAUTOFORCE_ACCOUNT}</AccountNumber>
      </credentials>
      <optionType>Year</optionType>
    </GetVehicleOptions>
  </soap:Body>
</soap:Envelope>`;

  const resp = await fetch(USAF_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': USAF_SOAP_ACTION,
    },
    body: soapBody,
  });

  const text = await resp.text();
  const years = [];
  const matches = text.matchAll(/<VehicleOption>(.*?)<\/VehicleOption>/gs);
  for (const match of matches) {
    const yearMatch = match[1].match(/<Year>(\d+)<\/Year>/);
    if (yearMatch) {
      years.push(parseInt(yearMatch[1], 10));
    }
  }
  return years.filter(y => y >= START_YEAR && y <= END_YEAR).sort((a, b) => b - a);
}

async function getUSAFMakes(year) {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetVehicleOptions xmlns="https://services.usautoforce.com">
      <credentials>
        <Username>${process.env.USAUTOFORCE_USERNAME}</Username>
        <Password>${process.env.USAUTOFORCE_PASSWORD}</Password>
        <AccountNumber>${process.env.USAUTOFORCE_ACCOUNT}</AccountNumber>
      </credentials>
      <optionType>Make</optionType>
      <year>${year}</year>
    </GetVehicleOptions>
  </soap:Body>
</soap:Envelope>`;

  const resp = await fetch(USAF_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': USAF_SOAP_ACTION,
    },
    body: soapBody,
  });

  const text = await resp.text();
  const makes = [];
  const matches = text.matchAll(/<VehicleOption>(.*?)<\/VehicleOption>/gs);
  for (const match of matches) {
    const makeMatch = match[1].match(/<Make>([^<]+)<\/Make>/);
    if (makeMatch) {
      makes.push(makeMatch[1]);
    }
  }
  return makes;
}

async function getUSAFModels(year, make) {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetVehicleOptions xmlns="https://services.usautoforce.com">
      <credentials>
        <Username>${process.env.USAUTOFORCE_USERNAME}</Username>
        <Password>${process.env.USAUTOFORCE_PASSWORD}</Password>
        <AccountNumber>${process.env.USAUTOFORCE_ACCOUNT}</AccountNumber>
      </credentials>
      <optionType>Model</optionType>
      <year>${year}</year>
      <make>${make}</make>
    </GetVehicleOptions>
  </soap:Body>
</soap:Envelope>`;

  const resp = await fetch(USAF_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': USAF_SOAP_ACTION,
    },
    body: soapBody,
  });

  const text = await resp.text();
  const models = [];
  const matches = text.matchAll(/<VehicleOption>(.*?)<\/VehicleOption>/gs);
  for (const match of matches) {
    const modelMatch = match[1].match(/<Model>([^<]+)<\/Model>/);
    const tiresMatch = match[1].match(/<TireSizes>([^<]*)<\/TireSizes>/);
    if (modelMatch) {
      models.push({
        model: modelMatch[1],
        tireSizes: tiresMatch ? tiresMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [],
      });
    }
  }
  return models;
}

// =============================================================================
// WTD QUERIES
// =============================================================================

async function getWTDVehicles() {
  const result = await pool.query(`
    SELECT DISTINCT year, make, model
    FROM vehicle_fitments
    WHERE year >= $1 AND year <= $2
    ORDER BY year, make, model
  `, [START_YEAR, END_YEAR]);
  return result.rows;
}

async function getWTDVehicleByYMM(year, make, model) {
  const result = await pool.query(`
    SELECT id, year, make, model, bolt_pattern, center_bore_mm, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE year = $1 
      AND LOWER(make) = LOWER($2)
      AND LOWER(model) = LOWER($3)
    LIMIT 1
  `, [year, make, model]);
  return result.rows[0] || null;
}

// =============================================================================
// COMPARISON LOGIC
// =============================================================================

function findBestMatch(usafVehicle, wtdVehiclesSet) {
  const { year, make, model } = usafVehicle;
  
  // Exact normalized match
  const exactKey = createVehicleKey(year, make, model);
  if (wtdVehiclesSet.has(exactKey)) {
    return { type: 'exact', key: exactKey };
  }
  
  // Try alias variations
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  // Check with normalized values
  const normalizedKey = `${year}|${normalizedMake}|${normalizedModel}`;
  if (wtdVehiclesSet.has(normalizedKey)) {
    return { type: 'alias_match', key: normalizedKey };
  }
  
  // Check if model is a trim (e.g., "Silverado 1500 LT" vs "Silverado 1500")
  const modelParts = normalizedModel.split(' ');
  if (modelParts.length > 1) {
    // Try shorter model names
    for (let i = modelParts.length - 1; i >= 1; i--) {
      const shorterModel = modelParts.slice(0, i).join(' ');
      const trimKey = `${year}|${normalizedMake}|${shorterModel}`;
      if (wtdVehiclesSet.has(trimKey)) {
        return { type: 'trim_mismatch', key: trimKey, usafTrim: modelParts.slice(i).join(' ') };
      }
    }
  }
  
  // Check for platform/sibling matches (same year/make, different model)
  const siblingPrefix = `${year}|${normalizedMake}|`;
  const siblings = [...wtdVehiclesSet]
    .filter(k => k.startsWith(siblingPrefix))
    .map(k => k.split('|')[2]);
  
  if (siblings.length > 0) {
    // Find most similar model
    const similar = siblings.find(s => {
      return s.includes(normalizedModel) || normalizedModel.includes(s) ||
             levenshteinDistance(s, normalizedModel) <= 3;
    });
    if (similar) {
      return { type: 'likely_alias', key: `${year}|${normalizedMake}|${similar}`, similarity: similar };
    }
  }
  
  return { type: 'missing', key: null };
}

function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// =============================================================================
// SIBLING PLATFORM INFERENCE
// =============================================================================

async function findSiblingPlatform(year, make, model) {
  // Look for similar models in same make/year
  const result = await pool.query(`
    SELECT DISTINCT model, bolt_pattern, center_bore_mm, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE year = $1 
      AND LOWER(make) = LOWER($2)
      AND bolt_pattern IS NOT NULL
    LIMIT 10
  `, [year, make]);
  
  if (result.rows.length === 0) {
    // Try adjacent years
    const adjacentResult = await pool.query(`
      SELECT DISTINCT year, model, bolt_pattern, center_bore_mm, oem_wheel_sizes
      FROM vehicle_fitments
      WHERE year BETWEEN $1 - 2 AND $1 + 2
        AND LOWER(make) = LOWER($2)
        AND bolt_pattern IS NOT NULL
      LIMIT 20
    `, [year, make]);
    return adjacentResult.rows;
  }
  
  return result.rows;
}

// =============================================================================
// MAIN DISCOVERY
// =============================================================================

async function runDiscovery() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('PART 2: USAF Missing Vehicle Discovery (2000-Current)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  // Load WTD vehicles
  console.log('Loading WTD vehicles...');
  const wtdVehicles = await getWTDVehicles();
  console.log(`WTD vehicles: ${wtdVehicles.length}\n`);
  
  // Create normalized lookup set
  const wtdVehiclesSet = new Set();
  const wtdByKey = {};
  for (const v of wtdVehicles) {
    const key = createVehicleKey(v.year, v.make, v.model);
    wtdVehiclesSet.add(key);
    wtdByKey[key] = v;
  }
  
  // Results
  const results = {
    wtdTotal: wtdVehicles.length,
    usafTotal: 0,
    existsInBoth: [],
    wtdOnly: [],
    usafOnly: [],
    aliasMismatches: [],
    trimMismatches: [],
    likelyAliases: [],
    candidateMissingVehicles: [],
    needsManualReview: [],
    apiErrors: 0,
  };
  
  // Query USAF by year
  console.log('Fetching USAF vehicles...\n');
  
  const usafVehicles = [];
  const years = await getUSAFYears();
  console.log(`USAF years: ${years.length} (${Math.min(...years)}-${Math.max(...years)})\n`);
  
  for (const year of years) {
    process.stdout.write(`${year}: `);
    try {
      const makes = await getUSAFMakes(year);
      let yearCount = 0;
      
      for (const make of makes) {
        const models = await getUSAFModels(year, make);
        for (const m of models) {
          usafVehicles.push({
            year,
            make,
            model: m.model,
            tireSizes: m.tireSizes,
          });
          yearCount++;
        }
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 50));
      }
      
      console.log(`${yearCount} vehicles (${makes.length} makes)`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.apiErrors++;
    }
  }
  
  results.usafTotal = usafVehicles.length;
  console.log(`\nTotal USAF vehicles: ${usafVehicles.length}\n`);
  
  // Compare
  console.log('Comparing vehicles...\n');
  
  const usafKeysFound = new Set();
  
  for (const usaf of usafVehicles) {
    const match = findBestMatch(usaf, wtdVehiclesSet);
    usafKeysFound.add(createVehicleKey(usaf.year, usaf.make, usaf.model));
    
    const vehicleRecord = {
      year: usaf.year,
      make: usaf.make,
      model: usaf.model,
      usafTireSizes: usaf.tireSizes,
    };
    
    switch (match.type) {
      case 'exact':
        results.existsInBoth.push(vehicleRecord);
        break;
      case 'alias_match':
        results.aliasMismatches.push({
          ...vehicleRecord,
          wtdKey: match.key,
          type: 'normalized_match',
        });
        break;
      case 'trim_mismatch':
        results.trimMismatches.push({
          ...vehicleRecord,
          wtdModel: match.key.split('|')[2],
          usafTrim: match.usafTrim,
        });
        break;
      case 'likely_alias':
        results.likelyAliases.push({
          ...vehicleRecord,
          wtdSimilar: match.similarity,
          matchKey: match.key,
        });
        break;
      case 'missing':
        results.usafOnly.push(vehicleRecord);
        break;
    }
  }
  
  // Find WTD-only vehicles
  for (const [key, v] of Object.entries(wtdByKey)) {
    const normalizedUSAFKey = createVehicleKey(v.year, v.make, v.model);
    if (!usafKeysFound.has(normalizedUSAFKey) && !usafKeysFound.has(key)) {
      results.wtdOnly.push({
        year: v.year,
        make: v.make,
        model: v.model,
      });
    }
  }
  
  // Analyze missing vehicles for potential additions
  console.log('Analyzing missing vehicle candidates...\n');
  
  for (const usafVehicle of results.usafOnly.slice(0, 200)) {
    const siblings = await findSiblingPlatform(usafVehicle.year, usafVehicle.make, usafVehicle.model);
    
    const candidate = {
      ...usafVehicle,
      siblingCount: siblings.length,
      confidence: 'LOW',
      canInferSpecs: false,
    };
    
    if (siblings.length > 0) {
      // Check if all siblings have same bolt pattern
      const boltPatterns = [...new Set(siblings.map(s => s.bolt_pattern).filter(Boolean))];
      if (boltPatterns.length === 1) {
        candidate.inferredBoltPattern = boltPatterns[0];
        candidate.canInferSpecs = true;
        candidate.confidence = 'MEDIUM';
      }
      
      // If has USAF tire sizes, even better
      if (usafVehicle.tireSizes.length > 0 && candidate.canInferSpecs) {
        candidate.confidence = 'HIGH';
      }
      
      candidate.siblingModels = siblings.slice(0, 3).map(s => s.model);
    }
    
    if (candidate.confidence !== 'LOW' || usafVehicle.tireSizes.length > 0) {
      results.candidateMissingVehicles.push(candidate);
    } else {
      results.needsManualReview.push(candidate);
    }
  }
  
  // Sort candidates by confidence
  results.candidateMissingVehicles.sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.confidence] - order[b.confidence];
  });
  
  // Output summary
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('DISCOVERY RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  console.log(`WTD vehicles checked: ${results.wtdTotal}`);
  console.log(`USAF vehicles checked: ${results.usafTotal}`);
  console.log(`API errors: ${results.apiErrors}\n`);
  
  console.log('Comparison Categories:');
  console.log(`  Exists in both: ${results.existsInBoth.length}`);
  console.log(`  WTD-only: ${results.wtdOnly.length}`);
  console.log(`  USAF-only: ${results.usafOnly.length}`);
  console.log(`  Alias mismatches: ${results.aliasMismatches.length}`);
  console.log(`  Trim mismatches: ${results.trimMismatches.length}`);
  console.log(`  Likely aliases: ${results.likelyAliases.length}`);
  console.log(`\nCandidate missing vehicles: ${results.candidateMissingVehicles.length}`);
  console.log(`  HIGH confidence: ${results.candidateMissingVehicles.filter(c => c.confidence === 'HIGH').length}`);
  console.log(`  MEDIUM confidence: ${results.candidateMissingVehicles.filter(c => c.confidence === 'MEDIUM').length}`);
  console.log(`Needs manual review: ${results.needsManualReview.length}`);
  
  // Top likely missing vehicles
  if (results.candidateMissingVehicles.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────────────');
    console.log('TOP 50 LIKELY MISSING VEHICLES (Customer Search Impact)');
    console.log('───────────────────────────────────────────────────────────────────────\n');
    
    for (const v of results.candidateMissingVehicles.slice(0, 50)) {
      console.log(`[${v.confidence}] ${v.year} ${v.make} ${v.model}`);
      if (v.usafTireSizes.length > 0) {
        console.log(`  USAF tire sizes: ${v.usafTireSizes.slice(0, 4).join(', ')}${v.usafTireSizes.length > 4 ? '...' : ''}`);
      }
      if (v.inferredBoltPattern) {
        console.log(`  Inferred bolt pattern: ${v.inferredBoltPattern} (from ${v.siblingCount} siblings)`);
      }
      if (v.siblingModels) {
        console.log(`  Similar models: ${v.siblingModels.join(', ')}`);
      }
      console.log('');
    }
  }
  
  // Top alias fixes
  if (results.likelyAliases.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────────────');
    console.log('TOP 50 LIKELY ALIAS FIXES');
    console.log('───────────────────────────────────────────────────────────────────────\n');
    
    for (const v of results.likelyAliases.slice(0, 50)) {
      console.log(`${v.year} ${v.make} ${v.model}`);
      console.log(`  → WTD similar: ${v.wtdSimilar}`);
      console.log('');
    }
  }
  
  // Save full results
  const outputPath = path.join(__dirname, 'missing-vehicle-discovery-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    summary: {
      wtdTotal: results.wtdTotal,
      usafTotal: results.usafTotal,
      existsInBoth: results.existsInBoth.length,
      wtdOnly: results.wtdOnly.length,
      usafOnly: results.usafOnly.length,
      aliasMismatches: results.aliasMismatches.length,
      trimMismatches: results.trimMismatches.length,
      likelyAliases: results.likelyAliases.length,
      candidateMissingVehicles: results.candidateMissingVehicles.length,
      needsManualReview: results.needsManualReview.length,
      apiErrors: results.apiErrors,
    },
    candidateMissingVehicles: results.candidateMissingVehicles,
    likelyAliases: results.likelyAliases.slice(0, 100),
    trimMismatches: results.trimMismatches.slice(0, 100),
    usafOnlySample: results.usafOnly.slice(0, 200),
    wtdOnlySample: results.wtdOnly.slice(0, 200),
  }, null, 2));
  
  console.log(`\n📄 Full results saved: ${outputPath}`);
  
  await pool.end();
  return results;
}

runDiscovery().catch(err => {
  console.error('Discovery failed:', err);
  process.exit(1);
});
