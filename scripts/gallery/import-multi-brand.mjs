/**
 * Multi-Brand Gallery Importer
 * 
 * Imports extracted album data from KMC, XD, Moto Metal, Black Rhino, etc.
 * Uses CloudFront URLs extracted via browser automation.
 * 
 * Usage:
 *   node scripts/gallery/import-multi-brand.mjs --dry-run   # Test, show stats
 *   node scripts/gallery/import-multi-brand.mjs --import    # Import to DB
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const { Pool } = pg;

// ============================================================================
// BRAND-SPECIFIC WHEEL MODEL LISTS
// ============================================================================

const KMC_WHEEL_MODELS = [
  'ARCHER', 'KM235', 'KM236', 'KM237', 'KM238', 'KM239', 
  'KM444', 'KM445', 'KM446', 'KM447', 'KM450', 'KM451', 'KM452',
  'KM541', 'KM542', 'KM544', 'KM545', 'KM547', 'KM548', 'KM549',
  'KM550', 'KM551', 'KM552', 'KM553', 'KM554', 'KM555', 'KM556',
  'KM708', 'KM716', 'KM717', 'KM718', 'KM719', 'KM722', 'KM723',
  'KM724', 'KM725', 'KM727', 'KM728', 'KM729', 'KM730', 'KM733',
  'MESA FORGED'
];

const XD_WHEEL_MODELS = [
  'XD775', 'XD778', 'XD779', 'XD795', 'XD797', 'XD811', 'XD818',
  'XD820', 'XD822', 'XD825', 'XD827', 'XD829', 'XD831', 'XD833',
  'XD835', 'XD837', 'XD838', 'XD840', 'XD841', 'XD842', 'XD843',
  'XD844', 'XD845', 'XD846', 'XD847', 'XD849', 'XD850', 'XD851',
  'XD852', 'XD854', 'XD855', 'XD858', 'XD860', 'XD861', 'XD862',
  'XD863', 'XD864', 'XD865', 'XD867', 'XD870', 'XD875', 'XD880'
];

const MOTO_METAL_WHEEL_MODELS = [
  'MO962', 'MO963', 'MO970', 'MO972', 'MO977', 'MO978', 'MO982',
  'MO983', 'MO984', 'MO985', 'MO987', 'MO988', 'MO990', 'MO991',
  'MO992', 'MO993', 'MO995', 'MO997', 'MO998', 'MO999', 'MO802'
];

const BLACK_RHINO_WHEEL_MODELS = [
  'ARSENAL', 'ARMORY', 'BARSTOW', 'BOXER', 'CINCO', 'DUGGER',
  'HIGHLAND', 'KELSO', 'MINT', 'OGDEN', 'OVERLAND', 'PRIMM',
  'PISMO', 'RENO', 'RIDGE', 'RUMBLE', 'SANDSTORM', 'STADIUM',
  'TANAY', 'TRABUCO', 'UNIT', 'VENTURE', 'YORK'
];

const BRAND_WHEEL_MODELS = {
  'KMC': KMC_WHEEL_MODELS,
  'XD': XD_WHEEL_MODELS,
  'MOTO METAL': MOTO_METAL_WHEEL_MODELS,
  'BLACK RHINO': BLACK_RHINO_WHEEL_MODELS
};

// ============================================================================
// VEHICLE PARSING (shared with Fuel importer)
// ============================================================================

const MAKE_NORMALIZATIONS = {
  'CHEVY': 'Chevrolet', 'CHEVROLET': 'Chevrolet',
  'DODGE': 'Dodge', 'FORD': 'Ford', 'GMC': 'GMC',
  'JEEP': 'Jeep', 'LEXUS': 'Lexus', 'RAM': 'RAM',
  'TOYOTA': 'Toyota', 'VW': 'Volkswagen', 'VOLKSWAGEN': 'Volkswagen',
  'CADILLAC': 'Cadillac', 'SUBURU': 'Subaru', 'SUBARU': 'Subaru',
  'MAZDA': 'Mazda', 'NISSAN': 'Nissan', 'SUZUKI': 'Suzuki'
};

const MODEL_NORMALIZATIONS = {
  'F150': 'F-150', 'F250': 'F-250', 'F350': 'F-350', 'F450': 'F-450',
  'BRONCO': 'Bronco', 'RANGER': 'Ranger', 'RAPTOR': 'F-150 Raptor',
  'SUPER DUTY': 'Super Duty', 'SUPERDUTY': 'Super Duty',
  'SILVERADO': 'Silverado', 'TAHOE': 'Tahoe', 'SUBURBAN': 'Suburban',
  'COLORADO': 'Colorado', '2500HD': '2500 HD', '3500HD': '3500 HD',
  'SIERRA': 'Sierra', 'YUKON': 'Yukon',
  '1500': '1500', '2500': '2500',
  'TACOMA': 'Tacoma', 'TUNDRA': 'Tundra', '4RUNNER': '4Runner',
  'SEQUOIA': 'Sequoia', 'LAND CRUISER': 'Land Cruiser', 'FJ': 'FJ Cruiser',
  'WRANGLER': 'Wrangler', 'GLADIATOR': 'Gladiator', 'JK': 'Wrangler JK',
  'RUBICON': 'Wrangler Rubicon',
  'ESCALADE': 'Escalade', 'GX550': 'GX 550', 'GX460': 'GX 460', 'GX470': 'GX 470',
  'OUTBACK': 'Outback', 'AMAROK': 'Amarok', 'RAV4': 'RAV4', 'ROGUE': 'Rogue',
  'JIMNY': 'Jimny', 'CUV': 'CX-50', 'DENALI': 'Sierra Denali',
  'POWER WAGON': '2500 Power Wagon'
};

const TRIM_KEYWORDS = [
  'RAPTOR R', 'RAPTOR', 'TRX', 'DENALI', 'TREMOR', 'AT4', 'AT4X', 'TRAIL BOSS',
  'LARIAT', 'PLATINUM', 'LIMITED', 'ROUSH', 'LIGHTNING', 'BIGHORN',
  'RUBICON', 'MOJAVE', 'WILDTRAK', 'TRD', 'REBEL', 'APOCALYPSE', 'TROPHY TRUCK'
];

const DUALLY_KEYWORDS = ['DUALLY', 'DRW', '3500', 'F350', 'F450'];

function parseAlbumName(albumName, wheelBrand) {
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
  const parts = upper.split(/[\s_]+/);
  
  // Find wheel model for this brand
  const brandModels = BRAND_WHEEL_MODELS[wheelBrand] || [];
  let wheelModelEndIdx = 0;
  
  // Multi-word wheel models first
  for (const model of brandModels) {
    if (model.includes(' ') && upper.startsWith(model + ' ')) {
      result.wheelModel = titleCase(model);
      wheelModelEndIdx = model.split(' ').length;
      break;
    }
  }
  
  // Single-word wheel models
  if (!result.wheelModel) {
    for (const model of brandModels) {
      if (!model.includes(' ') && parts[0] === model) {
        result.wheelModel = model; // Keep original case for wheel models like KM235
        wheelModelEndIdx = 1;
        break;
      }
    }
  }
  
  // If still no match, use first part as wheel model
  if (!result.wheelModel) {
    result.wheelModel = parts[0];
    wheelModelEndIdx = 1;
    result.parseNotes.push(`Unknown wheel model: ${parts[0]}`);
  }
  
  const remaining = parts.slice(wheelModelEndIdx).filter(p => p && p !== '_');
  
  // Dually detection
  result.isDually = DUALLY_KEYWORDS.some(kw => upper.includes(kw));
  
  // Year (4-digit starting with 19 or 20)
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
  
  // Model (everything left)
  if (remaining.length > 0) {
    let modelStr = remaining.join(' ');
    for (const [pattern, normalized] of Object.entries(MODEL_NORMALIZATIONS)) {
      if (modelStr.includes(pattern)) {
        result.vehicleModel = normalized;
        break;
      }
    }
    if (!result.vehicleModel && modelStr.trim()) {
      result.vehicleModel = titleCase(modelStr);
    }
  }
  
  // Infer make from model if missing
  if (!result.vehicleMake && result.vehicleModel) {
    const model = result.vehicleModel.toLowerCase();
    if (model.includes('wrangler') || model.includes('gladiator') || model.includes('rubicon')) {
      result.vehicleMake = 'Jeep';
    } else if (model.includes('bronco') || model.includes('f-') || model.includes('ranger')) {
      result.vehicleMake = 'Ford';
    } else if (model.includes('tacoma') || model.includes('tundra') || model.includes('4runner') || model.includes('rav4')) {
      result.vehicleMake = 'Toyota';
    } else if (model.includes('silverado') || model.includes('colorado')) {
      result.vehicleMake = 'Chevrolet';
    } else if (model.includes('sierra') || model.includes('denali')) {
      result.vehicleMake = 'GMC';
    } else if (model.includes('ram') || model.includes('power wagon')) {
      result.vehicleMake = 'RAM';
    }
  }
  
  // Vehicle type
  result.vehicleType = inferVehicleType(result);
  
  // Confidence
  if (result.parseNotes.length === 0 && result.vehicleMake && result.vehicleModel && result.wheelModel) {
    result.confidence = 'high';
  } else if (result.vehicleMake || result.vehicleModel) {
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
      model.includes('colorado') || model.includes('gladiator') || model.includes('power wagon')) {
    return 'truck';
  }
  
  if (make === 'jeep' || model.includes('wrangler') || model.includes('rubicon')) return 'jeep';
  
  if (model.includes('bronco') || model.includes('4runner') ||
      model.includes('tahoe') || model.includes('suburban') ||
      model.includes('yukon') || model.includes('escalade') ||
      model.includes('sequoia') || model.includes('land cruiser') ||
      model.includes('gx') || model.includes('rav4')) {
    return 'suv';
  }
  
  return 'unknown';
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
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
  // Extract asset ID from CloudFront URL
  // URL format: https://d3opzdukpbxlns.cloudfront.net/TENANT/ASSET_ID.800.jpg?...
  const urlMatch = asset.sourceUrl.match(/cloudfront\.net\/[^\/]+\/([a-f0-9]+)\./);
  const assetId = urlMatch ? urlMatch[1] : `${asset.wheelBrand}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
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
      updated_at = NOW()
    RETURNING id
  `;
  
  const values = [
    assetId,
    asset.sourceAlbumName,
    asset.sourceUrl,
    asset.thumbnailUrl || asset.sourceUrl.replace('.800.', '.240.'),
    'image',
    null, // width (not available from CloudFront URL)
    null, // height
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
  console.log('Multi-Brand Gallery Importer');
  console.log('='.repeat(70));
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : doImport ? 'FULL IMPORT' : 'INFO ONLY'}`);
  console.log('');
  
  // Find all extracted JSON files
  const extractedDir = path.join(__dirname, 'extracted');
  if (!fs.existsSync(extractedDir)) {
    console.error('No extracted directory found. Run batch extraction first.');
    process.exit(1);
  }
  
  const files = fs.readdirSync(extractedDir).filter(f => f.endsWith('.json') && !f.includes('progress') && !f.includes('sample'));
  console.log(`Found ${files.length} album files to process\\n`);
  
  let allAlbums = [];
  
  for (const file of files) {
    const filePath = path.join(extractedDir, file);
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Handle both formats:
    // Old format: array of {brand, name, path, assets}
    // New format: {brand, albums: [{name, code, images}]}
    let albums;
    let brand;
    
    if (Array.isArray(rawData)) {
      // Old format
      albums = rawData;
      brand = rawData[0]?.brand || 'Unknown';
    } else if (rawData.albums) {
      // New format from sub-agent extraction
      brand = rawData.brand;
      albums = rawData.albums.map(a => ({
        brand: brand,
        name: a.name,
        path: a.code,
        assetCount: a.imageCount || a.images?.length || 0,
        assets: (a.images || []).map(img => ({
          url: img.url,
          alt: img.alt
        }))
      }));
    } else {
      console.log(`  ${file}: Unknown format, skipping`);
      continue;
    }
    
    const totalAssets = albums.reduce((sum, a) => sum + (a.assets?.length || 0), 0);
    console.log(`  ${file}: ${albums.length} albums, ${totalAssets} assets (${brand})`);
    allAlbums = allAlbums.concat(albums);
  }
  
  console.log(`\\nTotal albums: ${allAlbums.length}\\n`);
  
  // Process each album
  const results = [];
  
  for (const album of allAlbums) {
    const parsed = parseAlbumName(album.name, album.brand);
    
    // Add each asset as a separate result
    for (const asset of album.assets || []) {
      results.push({
        brand: album.brand,
        albumName: album.name,
        albumCode: album.path,
        url: asset.url,
        filename: asset.alt,
        parsed
      });
    }
  }
  
  console.log(`Total assets to import: ${results.length}\\n`);
  
  // Stats
  const byBrand = {};
  const byVehicleType = {};
  const byMake = {};
  
  for (const r of results) {
    byBrand[r.brand] = (byBrand[r.brand] || 0) + 1;
    byVehicleType[r.parsed.vehicleType] = (byVehicleType[r.parsed.vehicleType] || 0) + 1;
    if (r.parsed.vehicleMake) byMake[r.parsed.vehicleMake] = (byMake[r.parsed.vehicleMake] || 0) + 1;
  }
  
  console.log('BY BRAND');
  console.log('-'.repeat(40));
  for (const [brand, count] of Object.entries(byBrand)) {
    console.log(`  ${brand}: ${count} assets`);
  }
  
  console.log('\\nBY VEHICLE TYPE');
  console.log('-'.repeat(40));
  for (const [type, count] of Object.entries(byVehicleType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
  
  console.log('\\nBY MAKE');
  console.log('-'.repeat(40));
  for (const [make, count] of Object.entries(byMake).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${make}: ${count}`);
  }
  
  // Import
  if (doImport) {
    console.log('\\nDATABASE IMPORT');
    console.log('-'.repeat(70));
    
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ No POSTGRES_URL configured');
      process.exit(1);
    }
    
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      await ensureTable(pool);
      
      let inserted = 0;
      let failed = 0;
      
      for (const r of results) {
        try {
          const id = await insertAsset(pool, {
            sourceUrl: r.url,
            sourceAlbumName: r.albumName,
            wheelBrand: r.brand,
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
          if (failed <= 5) console.error(`  ✗ Failed: ${r.albumName} - ${err.message}`);
        }
      }
      
      console.log(`\\n✅ Inserted: ${inserted}`);
      if (failed > 0) console.log(`❌ Failed: ${failed}`);
      
      // Show counts by brand
      const counts = await pool.query(`
        SELECT wheel_brand, COUNT(*) as count 
        FROM gallery_assets 
        GROUP BY wheel_brand 
        ORDER BY count DESC
      `);
      console.log('\\nFINAL COUNTS BY BRAND');
      console.table(counts.rows);
      
    } finally {
      await pool.end();
    }
  }
  
  console.log('\\n' + '='.repeat(70));
  console.log('Done!');
}

main().catch(console.error);
