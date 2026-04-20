/**
 * WheelPros Canto Gallery Import - Full Version
 * 
 * Phase 2: Import all FUEL vehicle albums with real asset URLs
 * 
 * Usage:
 *   node scripts/gallery/import-canto-full.mjs --dry-run   # Test, show stats, no DB writes
 *   node scripts/gallery/import-canto-full.mjs --import    # Full import to DB
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
// CANTO API CONFIG
// ============================================================================

const CANTO_BASE = 'https://wheelpros.canto.com';
const PORTAL_ID = 'WheelPros';

const API = {
  album: (albumPath) => `${CANTO_BASE}/rest/v/${PORTAL_ID}/album/${albumPath}`,
  thumbnail: (assetId) => `${CANTO_BASE}/rest/v/${PORTAL_ID}/binary/image/${assetId}/800`,
  fullSize: (assetId) => `${CANTO_BASE}/rest/v/${PORTAL_ID}/binary/image/${assetId}`,
};


// ============================================================================
// ALBUM NAME PARSER
// ============================================================================

const FUEL_WHEEL_MODELS = [
  'ARC', 'ASCEND', 'ASSAULT', 'BLADE', 'BLITZ', 'BRAWL', 'BURN', 
  'CATALYST', 'CATAYLST', 'CELSIUS', 'CHARGER', 'CHISEL', 'CIRCUIT', 'CLASH', 
  'CONTRA', 'CORE', 'COVERT', 'CRUSH', 'CYCLE', 'DARKSTAR', 'DYNAMO',
  'FFC122', 'FLAME', 'FLOW', 'FLUX', 'FORTRESS', 'GAMBIT', 'GRIP',
  'HAMMER', 'HAMMERHEAD', 'HARDLINE', 'HAVOC', 'HEATER', 'HEATHEN',
  'HOSTAGE', 'HURRICANE', 'HYPE', 'IMS', 'INJECTOR', 'KRANK', 'LETHAL',
  'LOCKDOWN', 'LYNX', 'MAVERICK', 'MILITIA', 'MUTINY', 'OXIDE', 'PISTON',
  'QUAKE', 'RAIL', 'REACTION', 'REBAR', 'REBEL', 'REVOLT', 'RINCON',
  'ROGUE', 'RUNNER', 'RUNNER OR', 'RUSH', 'SABER', 'SCEPTER', 'SFJ',
  'SHOK', 'SIGMA', 'SINISTER', 'SLAYER', 'SLEDGE', 'SPUR', 'STRIKE',
  'SUPER C', 'SURGE', 'SYNDICATE', 'TALON', 'TANTRUM', 'TRACKER', 
  'TRACTION', 'TRAX', 'TRIGGER', 'UNIT', 'VAPOR', 'VARIANT', 'VECTOR',
  'WARP', 'ZEPHYR'
];

const MAKE_NORMALIZATIONS = {
  'CHEVY': 'Chevrolet', 'CHEVROLET': 'Chevrolet',
  'DODGE': 'Dodge', 'FORD': 'Ford', 'GMC': 'GMC',
  'JEEP': 'Jeep', 'LEXUS': 'Lexus', 'RAM': 'RAM',
  'TOYOTA': 'Toyota', 'VW': 'Volkswagen', 'VOLKSWAGEN': 'Volkswagen',
  'CADILLAC': 'Cadillac', 'SUBURU': 'Subaru', 'SUBARU': 'Subaru',
};

const MODEL_NORMALIZATIONS = {
  'F150': 'F-150', 'F250': 'F-250', 'F350': 'F-350', 'F450': 'F-450',
  'BRONCO': 'Bronco', 'RANGER': 'Ranger', 'RAPTOR': 'F-150 Raptor',
  'SUPER DUTY': 'Super Duty', 'SUPERDUTY': 'Super Duty', 'SUEPR DUTY': 'Super Duty',
  'SILVERADO': 'Silverado', 'TAHOE': 'Tahoe', 'SUBURBAN': 'Suburban',
  'COLORADO': 'Colorado', '2500HD': '2500 HD', '3500HD': '3500 HD', '3500': '3500 HD',
  'SIERRA': 'Sierra', 'YUKON': 'Yukon',
  '1500': '1500', '2500': '2500',
  'TACOMA': 'Tacoma', 'TUNDRA': 'Tundra', '4RUNNER': '4Runner',
  'SEQUOIA': 'Sequoia', 'LAND CRUISER': 'Land Cruiser', 'FJ': 'FJ Cruiser',
  'WRANGLER': 'Wrangler', 'GLADIATOR': 'Gladiator', 'JK': 'Wrangler JK',
  'RUBICON': 'Wrangler Rubicon',
  'ESCALADE': 'Escalade', 'GX550': 'GX 550', 'GX460': 'GX 460', 'GX': 'GX',
  'OUTBACK': 'Outback', 'AMAROK': 'Amarok',
};

const TRIM_KEYWORDS = [
  'RAPTOR R', 'RAPTOR', 'TRX', 'DENALI', 'TREMOR', 'AT4', 'TRAIL BOSS',
  'LARIAT', 'PLATINUM', 'LIMITED', 'ROUSH', 'LIGHTNING', 'BIGHORN',
  'RUBICON', 'MOJAVE', 'WILDTRAK', 'TRD', 'REBEL', 'APOCALYPSE'
];

const DUALLY_KEYWORDS = ['DUALLY', 'DRW', '3500', 'F350', 'F450'];

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
  
  const upper = albumName.toUpperCase();
  const parts = upper.split(/\s+/);
  
  let wheelModelEndIdx = 0;
  
  // Two-word wheel models
  for (const model of FUEL_WHEEL_MODELS) {
    if (model.includes(' ') && upper.startsWith(model + ' ')) {
      result.wheelModel = titleCase(model);
      wheelModelEndIdx = model.split(' ').length;
      break;
    }
  }
  
  // Single-word wheel models
  if (!result.wheelModel) {
    for (const model of FUEL_WHEEL_MODELS) {
      if (!model.includes(' ') && parts[0] === model) {
        result.wheelModel = titleCase(model);
        wheelModelEndIdx = 1;
        break;
      }
    }
  }
  
  // Numbered variants (e.g., FLAME 6, FLUX 8)
  if (result.wheelModel && parts[wheelModelEndIdx]?.match(/^\d$/)) {
    result.wheelModel += ' ' + parts[wheelModelEndIdx];
    wheelModelEndIdx++;
  }
  
  // Beadlock variants
  if (parts[wheelModelEndIdx] === 'BEADLOCK' || parts[wheelModelEndIdx] === 'BL' || parts[wheelModelEndIdx] === 'SBL') {
    result.wheelModel += ' ' + parts[wheelModelEndIdx];
    wheelModelEndIdx++;
  }
  
  if (!result.wheelModel) {
    result.parseNotes.push(`Unknown wheel: ${parts[0]}`);
    result.wheelModel = titleCase(parts[0]);
    wheelModelEndIdx = 1;
  }
  
  const remaining = parts.slice(wheelModelEndIdx);
  
  result.isDually = DUALLY_KEYWORDS.some(kw => upper.includes(kw));
  if (result.isDually && upper.includes('DUALLY')) {
    const duallyIdx = remaining.indexOf('DUALLY');
    if (duallyIdx !== -1) remaining.splice(duallyIdx, 1);
  }
  
  // Year
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].match(/^(19|20)\d{2}$/)) {
      result.vehicleYear = parseInt(remaining[i]);
      remaining.splice(i, 1);
      break;
    }
  }
  
  // Make
  for (let i = 0; i < remaining.length; i++) {
    const normalized = MAKE_NORMALIZATIONS[remaining[i]];
    if (normalized) {
      result.vehicleMake = normalized;
      remaining.splice(i, 1);
      break;
    }
  }
  
  // Trim
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
  
  // Model
  if (remaining.length > 0) {
    let modelStr = remaining.join(' ');
    let matched = false;
    for (const [pattern, normalized] of Object.entries(MODEL_NORMALIZATIONS)) {
      if (modelStr.includes(pattern)) {
        result.vehicleModel = normalized;
        matched = true;
        break;
      }
    }
    if (!matched && modelStr.trim()) {
      result.vehicleModel = titleCase(modelStr);
      result.parseNotes.push(`Model not normalized: ${modelStr}`);
    }
  }
  
  // Special case handling
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
  if (result.vehicleModel === 'Raptor' || result.vehicleModel === 'F-150 Raptor') {
    result.vehicleModel = 'F-150';
    result.vehicleTrim = 'Raptor';
  }
  if (result.vehicleModel?.includes('Raptor')) {
    result.vehicleModel = result.vehicleModel.replace(' Raptor', '').replace('Raptor', 'F-150').trim() || 'F-150';
    result.vehicleTrim = result.vehicleTrim || 'Raptor';
  }
  if (upper.includes('RAPTOR R')) result.vehicleTrim = 'Raptor R';
  if (result.vehicleModel === 'Bronco' && upper.includes('RAPTOR')) result.vehicleTrim = 'Raptor';
  if (result.vehicleModel === 'Super Duty') {
    result.vehicleModel = 'F-250';
    result.parseNotes.push('Super Duty defaulted to F-250');
  }
  
  // Sierra/Silverado model numbers
  if (result.vehicleMake === 'GMC' && result.vehicleModel?.includes('Sierra')) {
    result.vehicleModel = 'Sierra 1500';
    if (upper.includes('2500')) result.vehicleModel = 'Sierra 2500';
    if (upper.includes('3500')) result.vehicleModel = 'Sierra 3500';
  }
  if (result.vehicleMake === 'Chevrolet' && result.vehicleModel?.includes('Silverado')) {
    if (upper.includes('2500') || upper.includes('2500HD')) {
      result.vehicleModel = 'Silverado 2500 HD';
    } else if (upper.includes('3500') || upper.includes('3500HD')) {
      result.vehicleModel = 'Silverado 3500 HD';
    } else if (!result.vehicleModel.includes(' ')) {
      result.vehicleModel = 'Silverado 1500';
    }
  }
  
  // Infer make from model if missing
  if (!result.vehicleMake && result.vehicleModel) {
    const model = result.vehicleModel.toLowerCase();
    if (model.includes('wrangler') || model.includes('gladiator') || model.includes('rubicon')) {
      result.vehicleMake = 'Jeep';
    } else if (model.includes('bronco') || model.includes('f-150') || model.includes('f-250') || model.includes('f-350') || model.includes('ranger')) {
      result.vehicleMake = 'Ford';
    } else if (model.includes('tacoma') || model.includes('tundra') || model.includes('4runner') || model.includes('land cruiser') || model.includes('sequoia')) {
      result.vehicleMake = 'Toyota';
    }
  }
  
  // Vehicle type
  result.vehicleType = inferVehicleType(result);
  
  // Confidence
  if (result.parseNotes.length === 0 && result.vehicleMake && result.vehicleModel && result.wheelModel) {
    result.confidence = 'high';
  } else if (result.vehicleMake && result.vehicleModel) {
    result.confidence = 'medium';
  } else {
    result.confidence = 'low';
  }
  
  return result;
}

function inferVehicleType(parsed) {
  const make = parsed.vehicleMake?.toLowerCase();
  const model = parsed.vehicleModel?.toLowerCase() || '';
  
  if (parsed.isDually) return 'dually';
  
  if (model.includes('f-150') || model.includes('f-250') || model.includes('f-350') ||
      model.includes('silverado') || model.includes('sierra') ||
      model.includes('ram') || model.includes('1500') || model.includes('2500') ||
      model.includes('tundra') || model.includes('tacoma') || model.includes('ranger') ||
      model.includes('colorado') || model.includes('gladiator') ||
      model.includes('super duty')) {
    return 'truck';
  }
  
  if (make === 'jeep' || model.includes('wrangler') || model.includes('rubicon')) return 'jeep';
  
  if (model.includes('bronco') || model.includes('4runner') ||
      model.includes('tahoe') || model.includes('suburban') ||
      model.includes('yukon') || model.includes('escalade') ||
      model.includes('sequoia') || model.includes('land cruiser') ||
      model.includes('gx') || model.includes('amarok') ||
      model.includes('outback')) {
    return 'suv';
  }
  
  if (make === 'cadillac') return 'suv';
  
  return 'unknown';
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}


// ============================================================================
// CANTO API CLIENT
// ============================================================================

async function fetchAlbumMetadata(albumPath) {
  const url = API.album(albumPath);
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Canto API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Extract preview asset ID from previewURI
  const previewUri = data.data?.previewURI?.[0] || null;
  const previewAssetId = previewUri ? previewUri.match(/\/([a-z0-9]+)$/)?.[1] : null;
  
  return {
    albumPath: data.path,
    displayName: data.displayName,
    imageCount: parseInt(data.data?.size?.[0] || '0'),
    previewAssetId,
    thumbnailUrl: previewAssetId ? API.thumbnail(previewAssetId) : null,
    fullSizeUrl: previewAssetId ? API.fullSize(previewAssetId) : null,
    width: parseInt(data.data?.width?.[0] || '0'),
    height: parseInt(data.data?.height?.[0] || '0'),
  };
}


// ============================================================================
// DATABASE
// ============================================================================

async function ensureTable(pool) {
  const schemaPath = path.join(__dirname, '../../src/lib/db/schema/gallery-assets.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);
  console.log('[db] ✓ Table ready');
}

async function insertAsset(pool, asset) {
  const query = `
    INSERT INTO gallery_assets (
      source_asset_id, source_album_name, source_url, thumbnail_url,
      media_type, width, height,
      wheel_brand, wheel_model, 
      vehicle_year, vehicle_make, vehicle_model, vehicle_trim, vehicle_type,
      parse_confidence, parse_notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (source_asset_id, wheel_brand) DO UPDATE SET
      source_album_name = EXCLUDED.source_album_name,
      source_url = EXCLUDED.source_url,
      thumbnail_url = EXCLUDED.thumbnail_url,
      width = EXCLUDED.width,
      height = EXCLUDED.height,
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
    asset.thumbnailUrl,
    asset.mediaType || 'image',
    asset.width,
    asset.height,
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
  const doImport = args.includes('--import');
  
  console.log('='.repeat(70));
  console.log('WheelPros Canto Gallery Import - Full Version');
  console.log('='.repeat(70));
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : doImport ? 'FULL IMPORT' : 'INFO ONLY'}`);
  console.log('');
  
  // Load album list from JSON
  const albumsPath = path.join(__dirname, 'fuel-albums.json');
  const albums = JSON.parse(fs.readFileSync(albumsPath, 'utf-8'));
  console.log(`[data] Loaded ${albums.length} albums from fuel-albums.json\n`);
  
  // Fetch metadata for each album (with rate limiting)
  const results = [];
  const errors = [];
  
  console.log('[canto] Fetching album metadata from Canto API...');
  console.log('        (This may take a few minutes with rate limiting)\n');
  
  for (let i = 0; i < albums.length; i++) {
    const album = albums[i];
    
    try {
      // Rate limit: 200ms between requests
      if (i > 0) await new Promise(r => setTimeout(r, 200));
      
      const metadata = await fetchAlbumMetadata(album.path);
      const parsed = parseAlbumName(album.name, 'Fuel');
      
      results.push({
        ...album,
        ...metadata,
        parsed
      });
      
      // Progress indicator
      if ((i + 1) % 25 === 0 || i === albums.length - 1) {
        console.log(`  [${i + 1}/${albums.length}] ${album.name}`);
      }
      
    } catch (err) {
      errors.push({ album: album.name, error: err.message });
      console.error(`  ✗ Error: ${album.name} - ${err.message}`);
    }
  }
  
  console.log('');
  
  // Stats
  const withImages = results.filter(r => r.previewAssetId);
  const withoutImages = results.filter(r => !r.previewAssetId);
  
  const highConf = results.filter(r => r.parsed.confidence === 'high').length;
  const medConf = results.filter(r => r.parsed.confidence === 'medium').length;
  const lowConf = results.filter(r => r.parsed.confidence === 'low').length;
  
  console.log('STATISTICS');
  console.log('-'.repeat(70));
  console.log(`Total albums:       ${results.length}`);
  console.log(`With preview image: ${withImages.length}`);
  console.log(`Without image:      ${withoutImages.length}`);
  console.log(`Errors:             ${errors.length}`);
  console.log('');
  console.log(`High confidence:    ${highConf} (${(highConf/results.length*100).toFixed(1)}%)`);
  console.log(`Medium confidence:  ${medConf} (${(medConf/results.length*100).toFixed(1)}%)`);
  console.log(`Low confidence:     ${lowConf} (${(lowConf/results.length*100).toFixed(1)}%)`);
  console.log('');
  
  // Distribution stats
  const vehicleTypes = {};
  const makes = {};
  const wheels = {};
  
  for (const r of results) {
    const vt = r.parsed.vehicleType || 'unknown';
    vehicleTypes[vt] = (vehicleTypes[vt] || 0) + 1;
    
    const make = r.parsed.vehicleMake || 'Unknown';
    makes[make] = (makes[make] || 0) + 1;
    
    const wheel = r.parsed.wheelModel || 'Unknown';
    wheels[wheel] = (wheels[wheel] || 0) + 1;
  }
  
  console.log('VEHICLE TYPE DISTRIBUTION');
  console.log('-'.repeat(70));
  for (const [type, count] of Object.entries(vehicleTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(12)}: ${count}`);
  }
  console.log('');
  
  console.log('MAKE DISTRIBUTION');
  console.log('-'.repeat(70));
  for (const [make, count] of Object.entries(makes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${make.padEnd(14)}: ${count}`);
  }
  console.log('');
  
  console.log('TOP 15 WHEEL MODELS');
  console.log('-'.repeat(70));
  const topWheels = Object.entries(wheels).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [wheel, count] of topWheels) {
    console.log(`  ${wheel.padEnd(18)}: ${count}`);
  }
  console.log('');
  
  // Sample URLs
  console.log('SAMPLE ASSET URLS');
  console.log('-'.repeat(70));
  for (const r of results.filter(x => x.thumbnailUrl).slice(0, 3)) {
    console.log(`${r.name}:`);
    console.log(`  Thumbnail: ${r.thumbnailUrl}`);
    console.log(`  Full size: ${r.fullSizeUrl}`);
    console.log('');
  }
  
  // Import to DB
  if (doImport) {
    console.log('DATABASE IMPORT');
    console.log('-'.repeat(70));
    
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
      await ensureTable(pool);
      
      // Delete old pilot data
      await pool.query(`DELETE FROM gallery_assets WHERE source_asset_id LIKE 'pilot_%'`);
      console.log('[db] Cleaned up pilot data');
      
      let inserted = 0;
      let skipped = 0;
      let failed = 0;
      
      for (const r of results) {
        // Skip albums without preview images
        if (!r.previewAssetId) {
          skipped++;
          continue;
        }
        
        try {
          const id = await insertAsset(pool, {
            sourceAssetId: r.previewAssetId,
            sourceAlbumName: r.name,
            sourceUrl: r.fullSizeUrl,
            thumbnailUrl: r.thumbnailUrl,
            mediaType: 'image',
            width: r.width,
            height: r.height,
            wheelBrand: r.parsed.wheelBrand,
            wheelModel: r.parsed.wheelModel,
            vehicleYear: r.parsed.vehicleYear,
            vehicleMake: r.parsed.vehicleMake,
            vehicleModel: r.parsed.vehicleModel,
            vehicleTrim: r.parsed.vehicleTrim,
            vehicleType: r.parsed.vehicleType,
            parseConfidence: r.parsed.confidence,
            parseNotes: r.parsed.parseNotes
          });
          
          if (id) inserted++;
        } catch (err) {
          failed++;
          console.error(`  ✗ Failed: ${r.name} - ${err.message}`);
        }
      }
      
      console.log(`\n✅ Imported: ${inserted}`);
      console.log(`⏭  Skipped (no image): ${skipped}`);
      if (failed > 0) console.log(`❌ Failed: ${failed}`);
      
      // Show sample records
      console.log('\nSAMPLE RECORDS');
      console.log('-'.repeat(70));
      const sampleRows = await pool.query(`
        SELECT id, source_album_name, wheel_model, vehicle_year, vehicle_make, 
               vehicle_model, vehicle_trim, vehicle_type, parse_confidence
        FROM gallery_assets
        WHERE wheel_brand = 'Fuel'
        ORDER BY id DESC
        LIMIT 10
      `);
      console.table(sampleRows.rows);
      
      // Final counts
      const counts = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT wheel_model) as unique_wheels,
          COUNT(DISTINCT vehicle_make) as unique_makes,
          COUNT(DISTINCT vehicle_model) as unique_models,
          COUNT(CASE WHEN thumbnail_url IS NOT NULL THEN 1 END) as with_thumbnail
        FROM gallery_assets
        WHERE wheel_brand = 'Fuel'
      `);
      console.log('\nFINAL COUNTS');
      console.log('-'.repeat(70));
      console.log(`Total assets:       ${counts.rows[0].total}`);
      console.log(`With thumbnail:     ${counts.rows[0].with_thumbnail}`);
      console.log(`Unique wheels:      ${counts.rows[0].unique_wheels}`);
      console.log(`Unique makes:       ${counts.rows[0].unique_makes}`);
      console.log(`Unique models:      ${counts.rows[0].unique_models}`);
      
    } finally {
      await pool.end();
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
