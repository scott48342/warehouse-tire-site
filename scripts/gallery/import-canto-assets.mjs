/**
 * WheelPros Canto Gallery Asset Importer
 * 
 * Phase 1: Pilot import of 20-30 albums for validation
 * 
 * Usage:
 *   node scripts/gallery/import-canto-assets.mjs --pilot    # Import pilot batch (20-30 albums)
 *   node scripts/gallery/import-canto-assets.mjs --dry-run  # Parse only, no DB writes
 *   node scripts/gallery/import-canto-assets.mjs --validate # Show parsing report
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const { Pool } = pg;

// ============================================================================
// ALBUM NAME PARSER
// ============================================================================

/**
 * Known wheel models for parsing
 */
const FUEL_WHEEL_MODELS = [
  'ARC', 'ASCEND', 'ASSAULT', 'BLADE', 'BLITZ', 'BRAWL', 'BURN', 
  'CATALYST', 'CELSIUS', 'CHARGER', 'CHISEL', 'CIRCUIT', 'CLASH', 
  'CONTRA', 'CORE', 'COVERT', 'CRUSH', 'CYCLE', 'DARKSTAR', 'DYNAMO',
  'FFC122', 'FLAME', 'FLOW', 'FLUX', 'FORTRESS', 'GAMBIT', 'GRIP',
  'HAMMER', 'HAMMERHEAD', 'HARDLINE', 'HAVOC', 'HEATER', 'HEATHEN',
  'HOSTAGE', 'HURRICANE', 'HYPE', 'IMS', 'INJECTOR', 'KRANK', 'LETHAL',
  'LOCKDOWN', 'LYNX', 'MAVERICK', 'MILITIA', 'MUTINY', 'OXIDE', 'PISTON',
  'QUAKE', 'RAIL', 'REACTION', 'REBAR', 'REBEL', 'REVOLT', 'RINCON',
  'ROGUE', 'RUNNER', 'RUNNER OR', 'SLEDGE', 'STROKE', 'TACTIC', 'TITAN',
  'TORQUE', 'TRACKER', 'TRITON', 'TROPHY', 'VAPOR', 'VANDAL', 'VECTOR',
  'VENGEANCE', 'WILDCAT', 'ZEPHYR'
];

/**
 * Vehicle make normalization map
 */
const MAKE_NORMALIZATIONS = {
  'CHEVY': 'Chevrolet',
  'CHEVROLET': 'Chevrolet',
  'DODGE': 'Dodge',
  'FORD': 'Ford',
  'GMC': 'GMC',
  'JEEP': 'Jeep',
  'LEXUS': 'Lexus',
  'RAM': 'RAM',
  'TOYOTA': 'Toyota',
  'VW': 'Volkswagen',
  'VOLKSWAGEN': 'Volkswagen',
  'CADILLAC': 'Cadillac',
};

/**
 * Vehicle model normalization map
 */
const MODEL_NORMALIZATIONS = {
  // Ford
  'F150': 'F-150',
  'F250': 'F-250',
  'F350': 'F-350',
  'F450': 'F-450',
  'BRONCO': 'Bronco',
  'RANGER': 'Ranger',
  'RAPTOR': 'F-150 Raptor',  // When standalone
  'SUPER DUTY': 'Super Duty',
  'SUPERDUTY': 'Super Duty',
  
  // Chevrolet
  'SILVERADO': 'Silverado',
  'TAHOE': 'Tahoe',
  'SUBURBAN': 'Suburban',
  'COLORADO': 'Colorado',
  '2500HD': '2500 HD',
  '3500HD': '3500 HD',
  '3500': '3500 HD',  // Chevy 3500 dually
  
  // GMC
  'SIERRA': 'Sierra',
  'YUKON': 'Yukon',
  
  // RAM/Dodge
  'RAM': 'RAM',
  '1500': '1500',
  '2500': '2500',
  'TRX': 'TRX',
  
  // Toyota
  'TACOMA': 'Tacoma',
  'TUNDRA': 'Tundra',
  '4RUNNER': '4Runner',
  'SEQUOIA': 'Sequoia',
  'LAND CRUISER': 'Land Cruiser',
  'FJ': 'FJ Cruiser',
  
  // Jeep
  'WRANGLER': 'Wrangler',
  'GLADIATOR': 'Gladiator',
  'JK': 'Wrangler JK',
  
  // Cadillac
  'ESCALADE': 'Escalade',
  
  // Lexus
  'GX550': 'GX 550',
  'GX': 'GX',
};

/**
 * Known trims to extract
 */
const TRIM_KEYWORDS = [
  'RAPTOR', 'RAPTOR R', 'TRX', 'DENALI', 'TREMOR', 'AT4', 'TRAIL BOSS',
  'LARIAT', 'PLATINUM', 'LIMITED', 'ROUSH', 'LIGHTNING', 'BIGHORN',
  'RUBICON', 'MOJAVE', 'WILDTRAK', 'TRD'
];

/**
 * Keywords indicating dually
 */
const DUALLY_KEYWORDS = ['DUALLY', 'DRW', '3500', 'F350', 'F450'];

/**
 * Parse album name into structured metadata
 */
function parseAlbumName(albumName, wheelBrand = 'Fuel') {
  const result = {
    raw: albumName,
    wheelBrand,
    wheelModel: null,
    vehicleYear: null,
    vehicleMake: null,
    vehicleModel: null,
    vehicleTrim: null,
    vehicleType: null,
    isDually: false,
    parseNotes: [],
    confidence: 'auto'
  };
  
  // Normalize to uppercase for matching
  const upper = albumName.toUpperCase();
  const parts = upper.split(/\s+/);
  
  // 1. Extract wheel model (should be first word(s))
  let wheelModelEndIdx = 0;
  
  // Check for two-word wheel models first (e.g., "RUNNER OR")
  for (const model of FUEL_WHEEL_MODELS) {
    if (model.includes(' ') && upper.startsWith(model + ' ')) {
      result.wheelModel = titleCase(model);
      wheelModelEndIdx = model.split(' ').length;
      break;
    }
  }
  
  // Check single-word wheel models
  if (!result.wheelModel) {
    for (const model of FUEL_WHEEL_MODELS) {
      if (!model.includes(' ') && parts[0] === model) {
        result.wheelModel = titleCase(model);
        wheelModelEndIdx = 1;
        break;
      }
    }
  }
  
  // Handle special cases like "FLAME 6", "FLAME 8", "FLUX 8"
  if (result.wheelModel && parts[wheelModelEndIdx]?.match(/^\d$/)) {
    result.wheelModel += ' ' + parts[wheelModelEndIdx];
    wheelModelEndIdx++;
  }
  
  if (!result.wheelModel) {
    result.parseNotes.push(`Unknown wheel model: ${parts[0]}`);
    result.wheelModel = titleCase(parts[0]);
    wheelModelEndIdx = 1;
  }
  
  // Remaining parts after wheel model
  const remaining = parts.slice(wheelModelEndIdx);
  
  // 2. Check for dually
  result.isDually = DUALLY_KEYWORDS.some(kw => upper.includes(kw));
  if (result.isDually && upper.includes('DUALLY')) {
    // Remove DUALLY from remaining for cleaner parsing
    const duallyIdx = remaining.indexOf('DUALLY');
    if (duallyIdx !== -1) remaining.splice(duallyIdx, 1);
  }
  
  // 3. Extract year (4-digit number starting with 19 or 20)
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].match(/^(19|20)\d{2}$/)) {
      result.vehicleYear = parseInt(remaining[i]);
      remaining.splice(i, 1);
      break;
    }
  }
  
  // 4. Extract make
  for (let i = 0; i < remaining.length; i++) {
    const normalized = MAKE_NORMALIZATIONS[remaining[i]];
    if (normalized) {
      result.vehicleMake = normalized;
      remaining.splice(i, 1);
      break;
    }
  }
  
  // 5. Extract trim (check before model to avoid confusion)
  for (const trim of TRIM_KEYWORDS) {
    const trimParts = trim.split(' ');
    for (let i = 0; i <= remaining.length - trimParts.length; i++) {
      const slice = remaining.slice(i, i + trimParts.length).join(' ');
      if (slice === trim) {
        result.vehicleTrim = titleCase(trim);
        remaining.splice(i, trimParts.length);
        break;
      }
    }
    if (result.vehicleTrim) break;
  }
  
  // 6. Extract model (whatever's left)
  if (remaining.length > 0) {
    // Join remaining parts and normalize
    let modelStr = remaining.join(' ');
    
    // Try to match known model patterns
    let matched = false;
    for (const [pattern, normalized] of Object.entries(MODEL_NORMALIZATIONS)) {
      if (modelStr.includes(pattern)) {
        result.vehicleModel = normalized;
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      result.vehicleModel = titleCase(modelStr);
      result.parseNotes.push(`Model not in normalization map: ${modelStr}`);
    }
  }
  
  // 7. Determine vehicle type
  result.vehicleType = inferVehicleType(result);
  
  // 8. Handle edge cases
  
  // RAM TRX special handling
  if (result.vehicleMake === 'Dodge' && result.vehicleTrim === 'Trx') {
    result.vehicleMake = 'RAM';
    result.vehicleModel = '1500';
    result.vehicleTrim = 'TRX';
  }
  if (upper.includes('RAM TRX') || upper.includes('RAM 1500 TRX')) {
    result.vehicleMake = 'RAM';
    result.vehicleModel = '1500';
    result.vehicleTrim = 'TRX';
  }
  
  // Raptor handling - when Raptor is the model, it's an F-150 Raptor
  if (result.vehicleModel === 'Raptor' || result.vehicleModel === 'F-150 Raptor') {
    result.vehicleModel = 'F-150';
    result.vehicleTrim = 'Raptor';
  }
  if (upper.includes('RAPTOR R')) {
    result.vehicleTrim = 'Raptor R';
  }
  
  // Ford F-150 Raptor in model field
  if (result.vehicleModel?.includes('Raptor')) {
    result.vehicleModel = result.vehicleModel.replace(' Raptor', '').replace('Raptor', 'F-150').trim() || 'F-150';
    result.vehicleTrim = result.vehicleTrim || 'Raptor';
  }
  
  // Super Duty is F-250/F-350
  if (result.vehicleModel === 'Super Duty') {
    result.vehicleModel = 'F-250'; // Default, could be F-350
    result.parseNotes.push('Super Duty defaulted to F-250');
  }
  
  // Bronco Raptor
  if (result.vehicleModel === 'Bronco' && upper.includes('RAPTOR')) {
    result.vehicleTrim = 'Raptor';
  }
  
  // GMC with model name fix
  if (result.vehicleMake === 'GMC') {
    if (result.vehicleModel?.includes('Sierra')) {
      result.vehicleModel = 'Sierra 1500';
      if (upper.includes('2500')) result.vehicleModel = 'Sierra 2500';
      if (upper.includes('3500')) result.vehicleModel = 'Sierra 3500';
    }
  }
  
  // Chevrolet Silverado model number
  if (result.vehicleMake === 'Chevrolet' && result.vehicleModel?.includes('Silverado')) {
    if (upper.includes('2500') || upper.includes('2500HD')) {
      result.vehicleModel = 'Silverado 2500 HD';
    } else if (upper.includes('3500') || upper.includes('3500HD')) {
      result.vehicleModel = 'Silverado 3500 HD';
    } else if (!result.vehicleModel.includes(' ')) {
      result.vehicleModel = 'Silverado 1500';
    }
  }
  
  // Calculate confidence
  if (result.parseNotes.length === 0 && result.vehicleMake && result.vehicleModel && result.wheelModel) {
    result.confidence = 'high';
  } else if (result.vehicleMake && result.vehicleModel) {
    result.confidence = 'medium';
  } else {
    result.confidence = 'low';
  }
  
  return result;
}

/**
 * Infer vehicle type from parsed data
 */
function inferVehicleType(parsed) {
  const make = parsed.vehicleMake?.toLowerCase();
  const model = parsed.vehicleModel?.toLowerCase() || '';
  
  if (parsed.isDually) return 'dually';
  
  // Trucks
  if (model.includes('f-150') || model.includes('f-250') || model.includes('f-350') ||
      model.includes('silverado') || model.includes('sierra') ||
      model.includes('ram') || model.includes('1500') || model.includes('2500') ||
      model.includes('tundra') || model.includes('tacoma') || model.includes('ranger') ||
      model.includes('colorado') || model.includes('gladiator') ||
      model.includes('super duty')) {
    return 'truck';
  }
  
  // Jeeps
  if (make === 'jeep' || model.includes('wrangler')) {
    return 'jeep';
  }
  
  // SUVs
  if (model.includes('bronco') || model.includes('4runner') ||
      model.includes('tahoe') || model.includes('suburban') ||
      model.includes('yukon') || model.includes('escalade') ||
      model.includes('sequoia') || model.includes('land cruiser') ||
      model.includes('gx') || model.includes('amarok')) {
    return 'suv';
  }
  
  // Cadillac is usually SUV
  if (make === 'cadillac') {
    return 'suv';
  }
  
  return 'unknown';
}

/**
 * Title case helper
 */
function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}


// ============================================================================
// PILOT ALBUM LIST
// ============================================================================

/**
 * Pilot batch: 30 albums covering various edge cases
 */
const PILOT_ALBUMS = [
  // Standard trucks
  'BLADE 2024 FORD BRONCO',
  'BLITZ 2020 RAM 1500',
  'REBEL TOYOTA TACOMA',
  'COVERT FORD F350 TREMOR',
  'CATALYST 2021 FORD BRONCO',
  
  // With years
  'BRAWL 2022 DODGE RAM TRX',
  'BRAWL 2024 CHEVROLET SILVERADO',
  'GAMBIT 2022 GMC SIERRA DENALI',
  'REBEL 2020 FORD F150 RAPTOR',
  'COVERT 2024 GMC SIERRA AT4',
  
  // Dually
  'FLUX DUALLY 2024 FORD F350',
  'FLUX DUALLY 2024 CHEVROLET 3500HD',
  'ARC DUALLY CHEVROLET 3500',
  'ARC DUALLY FORD F350',
  'BLITZ DODGE RAM 2500 DUALLY',
  
  // Special trims
  'CHARGER FORD F150 RAPTOR',
  'BURN 2022 FORD F150 RAPTOR',
  'CATALYST 2023 FORD F150 RAPTOR',
  'FLUX FORD F150 ROUSH',
  'REBAR FORD F150 LIGHTNING',
  
  // Jeeps
  'BURN 2019 JEEP WRANGLER',
  'FORTRESS JEEP WRANGLER',
  'COVERT JEEP GLADIATOR',
  'MILITIA JEEP WRANGLER',
  
  // SUVs
  'DARKSTAR CADILLAC ESCALADE',
  'BRAWL 2021 CADILLAC ESCALADE',
  'CYCLE GMC YUKON DENALI',
  'REVOLT CHEVROLET TAHOE',
  'HARDLINE TOYOTA 4RUNNER',
  
  // Edge cases
  'FLAME 6 FORD F150 LARIAT',
  'FLAME 8 FORD F250',
  'RUNNER OR FORD BRONCO',
  'CHARGER GMC SIERRA DENALI',
  'MUTINY 2025 LEXUS GX550',
];


// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Create gallery_assets table if not exists
 */
async function ensureTable(pool) {
  const schemaPath = path.join(__dirname, '../../src/lib/db/schema/gallery-assets.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  console.log('[db] Running gallery_assets schema...');
  await pool.query(schema);
  console.log('[db] ✓ Table ready');
}

/**
 * Insert a gallery asset record
 */
async function insertAsset(pool, asset) {
  const query = `
    INSERT INTO gallery_assets (
      source_asset_id, source_album_name, source_url, media_type,
      wheel_brand, wheel_model, 
      vehicle_year, vehicle_make, vehicle_model, vehicle_trim, vehicle_type,
      parse_confidence, parse_notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (source_asset_id, wheel_brand) DO UPDATE SET
      source_album_name = EXCLUDED.source_album_name,
      vehicle_year = EXCLUDED.vehicle_year,
      vehicle_make = EXCLUDED.vehicle_make,
      vehicle_model = EXCLUDED.vehicle_model,
      vehicle_trim = EXCLUDED.vehicle_trim,
      vehicle_type = EXCLUDED.vehicle_type,
      parse_confidence = EXCLUDED.parse_confidence,
      parse_notes = EXCLUDED.parse_notes,
      updated_at = NOW()
    RETURNING id
  `;
  
  const values = [
    asset.sourceAssetId,
    asset.sourceAlbumName,
    asset.sourceUrl,
    asset.mediaType || 'image',
    asset.wheelBrand,
    asset.wheelModel,
    asset.vehicleYear,
    asset.vehicleMake,
    asset.vehicleModel,
    asset.vehicleTrim,
    asset.vehicleType,
    asset.parseConfidence,
    asset.parseNotes?.join('; ') || null
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0]?.id;
}


// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isValidate = args.includes('--validate');
  const isPilot = args.includes('--pilot');
  
  console.log('='.repeat(60));
  console.log('WheelPros Canto Gallery Asset Importer');
  console.log('='.repeat(60));
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : isValidate ? 'VALIDATE' : isPilot ? 'PILOT IMPORT' : 'PARSE ONLY'}`);
  console.log('');
  
  // Parse all pilot albums
  const results = [];
  const parseIssues = [];
  
  for (const albumName of PILOT_ALBUMS) {
    const parsed = parseAlbumName(albumName, 'Fuel');
    results.push(parsed);
    
    if (parsed.parseNotes.length > 0 || parsed.confidence !== 'high') {
      parseIssues.push(parsed);
    }
  }
  
  // Show parsing results
  console.log('PARSING RESULTS');
  console.log('-'.repeat(60));
  console.log('');
  
  console.log('| Album Name | Wheel | Year | Make | Model | Trim | Type | Conf |');
  console.log('|------------|-------|------|------|-------|------|------|------|');
  
  for (const r of results) {
    console.log(`| ${r.raw.substring(0, 35).padEnd(35)} | ${(r.wheelModel || '-').padEnd(12)} | ${(r.vehicleYear || '-').toString().padEnd(4)} | ${(r.vehicleMake || '-').padEnd(10)} | ${(r.vehicleModel || '-').padEnd(15)} | ${(r.vehicleTrim || '-').padEnd(10)} | ${(r.vehicleType || '-').padEnd(6)} | ${r.confidence.padEnd(6)} |`);
  }
  
  console.log('');
  console.log('STATISTICS');
  console.log('-'.repeat(60));
  
  const highConf = results.filter(r => r.confidence === 'high').length;
  const medConf = results.filter(r => r.confidence === 'medium').length;
  const lowConf = results.filter(r => r.confidence === 'low').length;
  
  console.log(`Total albums:       ${results.length}`);
  console.log(`High confidence:    ${highConf} (${(highConf/results.length*100).toFixed(1)}%)`);
  console.log(`Medium confidence:  ${medConf} (${(medConf/results.length*100).toFixed(1)}%)`);
  console.log(`Low confidence:     ${lowConf} (${(lowConf/results.length*100).toFixed(1)}%)`);
  console.log('');
  
  // Show issues
  if (parseIssues.length > 0) {
    console.log('PARSE ISSUES / EDGE CASES');
    console.log('-'.repeat(60));
    
    for (const issue of parseIssues) {
      console.log(`\n[${issue.confidence.toUpperCase()}] ${issue.raw}`);
      if (issue.parseNotes.length > 0) {
        issue.parseNotes.forEach(note => console.log(`  ⚠ ${note}`));
      }
      console.log(`  → Parsed: ${issue.wheelModel} | ${issue.vehicleYear || 'N/A'} ${issue.vehicleMake} ${issue.vehicleModel} ${issue.vehicleTrim || ''} (${issue.vehicleType})`);
    }
  }
  
  // Vehicle type distribution
  console.log('\n\nVEHICLE TYPE DISTRIBUTION');
  console.log('-'.repeat(60));
  const types = {};
  for (const r of results) {
    types[r.vehicleType] = (types[r.vehicleType] || 0) + 1;
  }
  for (const [type, count] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(10)}: ${count}`);
  }
  
  // Make distribution
  console.log('\n\nMAKE DISTRIBUTION');
  console.log('-'.repeat(60));
  const makes = {};
  for (const r of results) {
    if (r.vehicleMake) makes[r.vehicleMake] = (makes[r.vehicleMake] || 0) + 1;
  }
  for (const [make, count] of Object.entries(makes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${make.padEnd(12)}: ${count}`);
  }
  
  // If pilot mode, write to database
  if (isPilot && !isDryRun) {
    console.log('\n\nDATABASE IMPORT');
    console.log('-'.repeat(60));
    
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ No POSTGRES_URL or DATABASE_URL configured');
      process.exit(1);
    }
    
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      // Create table
      await ensureTable(pool);
      
      // Insert pilot records (simulated - using album name as asset ID for now)
      let inserted = 0;
      for (const parsed of results) {
        // Generate a fake asset ID from album name (for pilot testing)
        const fakeAssetId = `pilot_${parsed.raw.toLowerCase().replace(/\s+/g, '_').substring(0, 50)}`;
        
        const id = await insertAsset(pool, {
          sourceAssetId: fakeAssetId,
          sourceAlbumName: parsed.raw,
          sourceUrl: `https://wheelpros.canto.com/album/${fakeAssetId}`,
          mediaType: 'image',
          wheelBrand: parsed.wheelBrand,
          wheelModel: parsed.wheelModel,
          vehicleYear: parsed.vehicleYear,
          vehicleMake: parsed.vehicleMake,
          vehicleModel: parsed.vehicleModel,
          vehicleTrim: parsed.vehicleTrim,
          vehicleType: parsed.vehicleType,
          parseConfidence: parsed.confidence,
          parseNotes: parsed.parseNotes
        });
        
        if (id) {
          inserted++;
          console.log(`  ✓ Inserted: ${parsed.raw} (id: ${id})`);
        }
      }
      
      console.log(`\n✅ Imported ${inserted} pilot records`);
      
      // Show sample query
      console.log('\n\nSAMPLE RECORDS');
      console.log('-'.repeat(60));
      const sample = await pool.query(`
        SELECT id, source_album_name, wheel_model, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, vehicle_type, parse_confidence
        FROM gallery_assets
        ORDER BY id DESC
        LIMIT 10
      `);
      console.table(sample.rows);
      
    } finally {
      await pool.end();
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
