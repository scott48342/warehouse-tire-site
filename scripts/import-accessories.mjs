/**
 * Import Accessories from WheelPros TechFeed
 * 
 * 1. Fetches available images from S3 bucket
 * 2. Downloads fresh TechFeed from SFTP (or uses local CSV)
 * 3. Imports with validated image URLs only
 * 
 * Usage:
 *   node scripts/import-accessories.mjs [--source=sftp|csv] [--csv-path=path] [--skip-s3]
 */

import dotenv from 'dotenv';
import pg from 'pg';
import Client from 'ssh2-sftp-client';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const S3_BUCKET = 'https://wp-media-assets.s3-us-west-2.amazonaws.com';
const S3_PREFIX = 'Accessories/';

// Category mapping from sub_type codes
const CATEGORY_MAP = {
  'CAP': 'center_cap',
  'LUG': 'lug_nut',
  'LUG NUT': 'lug_nut',
  'WHEEL LOCK': 'lug_nut',
  'HUB': 'hub_ring',
  'HUB RING': 'hub_ring',
  'LED': 'lighting',
  'LIGHT': 'lighting',
  'POD': 'lighting',
  'TPMS': 'tpms',
  'VALVE': 'valve_stem',
  'SPACER': 'spacer',
};

// Brand code to full name
const BRAND_NAMES = {
  'GO': 'Gorilla Automotive',
  'GOR': 'Gorilla Automotive',
  'MO': 'Moto Metal',
  'MTO': 'Moto Metal',
  'FU': 'Fuel',
  'FUE': 'Fuel',
  'KM': 'KMC',
  'KMC': 'KMC',
  'XD': 'XD',
  'XDS': 'XD',
  'HE': 'Helo',
  'HLO': 'Helo',
  'AS': 'Asanti',
  'AR': 'American Racing',
  'ARV': 'American Racing Vintage',
  'ATX': 'ATX',
  'AX': 'ATX',
  'DUB': 'DUB',
  'NIC': 'Niche',
  'MSA': 'Misc Accessories',
};

/**
 * List all keys from S3 bucket with pagination
 */
async function listAllS3Keys() {
  const keys = new Map(); // sku -> full URL
  let marker = '';
  let pageCount = 0;
  
  console.log('Fetching S3 image listing...');
  
  while (true) {
    const url = `${S3_BUCKET}/?prefix=${S3_PREFIX}&max-keys=1000${marker ? `&marker=${marker}` : ''}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`S3 list failed: ${res.status}`);
    }
    
    const xml = await res.text();
    const keyMatches = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)];
    
    if (keyMatches.length === 0) break;
    
    for (const match of keyMatches) {
      const key = match[1]; // e.g., "Accessories/70028S.png"
      const filename = key.replace(S3_PREFIX, '');
      const sku = filename.replace(/\.(png|jpg|jpeg)$/i, '');
      
      // Prefer PNG over JPG
      if (!keys.has(sku) || filename.endsWith('.png')) {
        keys.set(sku, `${S3_BUCKET}/${key}`);
      }
    }
    
    if (!xml.includes('<IsTruncated>true</IsTruncated>')) break;
    
    marker = encodeURIComponent(keyMatches[keyMatches.length - 1][1]);
    pageCount++;
    
    if (pageCount % 10 === 0) {
      console.log(`  ... fetched ${keys.size} images (page ${pageCount})`);
    }
  }
  
  console.log(`Found ${keys.size} total images in S3`);
  return keys;
}

/**
 * Validate image URL - returns valid URL or null
 */
function validateImageUrl(url, s3Images) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  
  // Check if SKU has an S3 image (preferred)
  // Extract SKU from URL
  const skuMatch = trimmed.match(/\/([^\/]+)\.(png|jpg|jpeg)$/i);
  if (skuMatch) {
    const sku = skuMatch[1];
    if (s3Images.has(sku)) {
      return s3Images.get(sku);
    }
  }
  
  // Accept assets.wheelpros.com URLs (new CDN)
  if (trimmed.includes('assets.wheelpros.com')) {
    return trimmed;
  }
  
  // Reject images.wheelpros.com URLs (all 404)
  if (trimmed.includes('images.wheelpros.com')) {
    return null;
  }
  
  // Keep other URLs
  if (trimmed.startsWith('http')) {
    return trimmed;
  }
  
  return null;
}

/**
 * Calculate sell price (30% margin on cost, capped at MSRP)
 */
function calculateSellPrice(cost, msrp, map) {
  if (cost && cost > 0) {
    const target = cost * 1.30;
    return msrp && msrp > 0 ? Math.min(target, msrp) : target;
  }
  if (map && map > 0) return map;
  if (msrp && msrp > 0) return msrp * 0.975;
  return null;
}

/**
 * Parse CSV line handling quotes
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Categorize product from sub_type and title
 */
function categorize(subType, title) {
  const st = (subType || '').toUpperCase();
  const t = (title || '').toUpperCase();
  
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (st.includes(key)) {
      return { category: cat, subType: st.toLowerCase() };
    }
  }
  
  if (t.includes('CAP') && (t.includes('CENTER') || t.includes('WHEEL'))) {
    return { category: 'center_cap', subType: 'center_cap' };
  }
  if (t.includes('LUG') && (t.includes('KIT') || t.includes('LOCK'))) {
    return { category: 'lug_nut', subType: t.includes('LOCK') ? 'wheel_lock' : 'lug_kit' };
  }
  if (t.includes('LUG')) {
    return { category: 'lug_nut', subType: 'lug_nut' };
  }
  if (t.includes('HUB') && (t.includes('RING') || t.includes('CENTRIC'))) {
    return { category: 'hub_ring', subType: 'hub_centric_ring' };
  }
  if (t.includes('LED') || t.includes('LIGHT')) {
    let subType = 'lighting';
    if (t.includes('POD')) subType = 'led_pod';
    if (t.includes('BAR')) subType = 'light_bar';
    if (t.includes('ROCK')) subType = 'rock_light';
    return { category: 'lighting', subType };
  }
  if (t.includes('TPMS') || t.includes('TIRE PRESSURE')) {
    return { category: 'tpms', subType: 'tpms' };
  }
  if (t.includes('VALVE')) {
    return { category: 'valve_stem', subType: 'valve_stem' };
  }
  if (t.includes('SPACER')) {
    return { category: 'spacer', subType: 'spacer' };
  }
  
  return { category: 'other', subType: null };
}

/**
 * Parse specs from title
 */
function parseThreadSize(title) {
  const t = title.toUpperCase();
  const metric = t.match(/[M ]?(\d{2})[X-](\d\.\d+)/);
  if (metric) return `M${metric[1]}x${metric[2]}`;
  const sae = t.match(/(\d\/\d+)[- ]?(\d+)/);
  if (sae) return `${sae[1]}-${sae[2]}`;
  return null;
}

function parseSeatType(title) {
  const t = title.toUpperCase();
  if (t.includes('BALL') || t.includes('RADIUS')) return 'ball';
  if (t.includes('MAG') || t.includes('SHANK')) return 'mag';
  if (t.includes('FLAT') || t.includes('WASHER')) return 'flat';
  if (t.includes('ACORN') || t.includes('BULGE') || t.includes('CONICAL')) return 'conical';
  return null;
}

function parseHubRing(title) {
  const t = title.toUpperCase();
  const odId = t.match(/(\d+(?:\.\d+)?)\s*OD[- ]?(\d+(?:\.\d+)?)\s*ID/);
  if (odId) return { outer: parseFloat(odId[1]), inner: parseFloat(odId[2]) };
  const simple = t.match(/(\d{2,3}(?:\.\d+)?)[\/\-](\d{2,3}(?:\.\d+)?)/);
  if (simple && parseFloat(simple[1]) > parseFloat(simple[2])) {
    return { outer: parseFloat(simple[1]), inner: parseFloat(simple[2]) };
  }
  return null;
}

function parseBoltPattern(title) {
  const t = title.toUpperCase();
  const bp = t.match(/(\d)[X-](\d{3}(?:\.\d)?)/);
  if (bp) return `${bp[1]}x${bp[2]}`;
  return null;
}

function parseWheelBrand(title, brandCode) {
  const t = title.toUpperCase();
  if (t.includes('MOTO') || brandCode === 'MO' || brandCode === 'MTO') return 'Moto Metal';
  if (t.includes('FUEL') || brandCode === 'FU' || brandCode === 'FUE') return 'Fuel';
  if (t.includes('XD') || brandCode === 'XD' || brandCode === 'XDS') return 'XD';
  if (t.includes('KMC') || brandCode === 'KM' || brandCode === 'KMC') return 'KMC';
  if (t.includes('HELO') || brandCode === 'HE' || brandCode === 'HLO') return 'Helo';
  if (t.includes('AMERICAN RACING') || brandCode === 'AR' || brandCode === 'ARV') return 'American Racing';
  return null;
}

/**
 * Parse additional lug nut filter attributes
 */
function parseMaterial(title) {
  const t = title.toUpperCase();
  if (t.includes('BLACK CHROME')) return 'Black Chrome';
  if (t.includes('CHROME')) return 'Chrome';
  if (t.includes('ZINC')) return 'Zinc';
  if (t.includes('STAINLESS') || t.includes('SS ')) return 'Stainless Steel';
  if (t.includes('GUNMETAL')) return 'Gunmetal';
  if (t.includes('BLACK')) return 'Black';
  if (t.includes('RED')) return 'Red';
  if (t.includes('BLUE')) return 'Blue';
  return null;
}

function parseClosedEnd(title) {
  const t = title.toUpperCase();
  if (t.includes('CLOSED') || t.includes('CL END')) return true;
  if (t.includes('OPEN') || t.includes('OP END') || t.includes('OPEN END')) return false;
  return null;
}

function parseIsBolt(title) {
  const t = title.toUpperCase();
  if (t.includes(' BOLT') || t.includes('BOLTS')) return true;
  if (t.includes(' NUT') || t.includes('NUTS')) return false;
  return null;
}

function parseLugStyle(title) {
  const t = title.toUpperCase();
  if (t.includes('SPLINE')) return 'Spline';
  if (t.includes('TUNER')) return 'Tuner';
  if (t.includes('BULGE')) return 'Bulge';
  if (t.includes('ACORN')) return 'Acorn';
  if (t.includes('ET')) return 'ET';
  if (t.includes('SHANK')) return 'Mag Shank';
  if (t.includes('6 POINT') || t.includes('6-POINT')) return '6-Point';
  return null;
}

function parsePackageType(title) {
  const t = title.toUpperCase();
  if (t.includes('KIT') || t.includes('SET')) return 'Kit';
  if (t.includes('BULK')) return 'Bulk';
  if (t.includes('CARDED')) return 'Carded';
  if (t.includes('BAG')) return 'Bag';
  if (t.includes('PKG') || t.includes('PACK')) return 'Pack';
  return null;
}

function parsePieceCount(title) {
  const t = title.toUpperCase();
  // Match patterns like "20 PC", "24PC", "(4PK)", "6PK"
  const pcMatch = t.match(/(\d+)\s*(?:PC|PK|PIECE|PACK|CT)/);
  if (pcMatch) return parseInt(pcMatch[1]);
  // Match "SET OF X"
  const setMatch = t.match(/SET\s*(?:OF\s*)?(\d+)/);
  if (setMatch) return parseInt(setMatch[1]);
  return null;
}

function parseHexSize(title) {
  const t = title.toUpperCase();
  // Metric hex: 17MM, 19MM, 21MM
  const mm = t.match(/(\d{2})\s*MM/);
  if (mm) return `${mm[1]}mm`;
  // SAE hex: 3/4", 13/16"
  const sae = t.match(/(\d+\/\d+)"/);
  if (sae) return `${sae[1]}"`;
  return null;
}

/**
 * Download fresh TechFeed from SFTP
 */
async function downloadFromSFTP() {
  console.log('\nConnecting to WheelPros SFTP...');
  
  const sftp = new Client();
  await sftp.connect({
    host: 'ftp.wheelpros.com',
    port: 22,
    username: 'Warehouse1',
    password: process.env.WHEELPROS_SFTP_PASS || 'Websters1!',
    retries: 3,
    retry_factor: 2,
    retry_minTimeout: 2000,
  });
  
  if (!fs.existsSync('./data')) fs.mkdirSync('./data');
  
  console.log('Downloading TechFeed/ACCESSORIES/Accessory_TechGuide.csv...');
  const techPath = './data/Accessory_TechGuide.csv';
  await sftp.get('/TechFeed/ACCESSORIES/Accessory_TechGuide.csv', techPath);
  
  console.log('Downloading CommonFeed/USD/ACCESSORIES/accessoriesInvPriceData.csv...');
  const commonPath = './data/accessoriesInvPriceData.csv';
  await sftp.get('/CommonFeed/USD/ACCESSORIES/accessoriesInvPriceData.csv', commonPath);
  
  await sftp.end();
  console.log('Downloaded!');
  
  return { techPath, commonPath };
}

/**
 * Parse accessories from CSV files
 */
function parseAccessories(techPath, commonPath, s3Images) {
  const accessories = [];
  const seenSkus = new Set();
  
  // Parse TechGuide (primary - has product details)
  console.log('\nParsing TechGuide...');
  const techContent = fs.readFileSync(techPath, 'utf8');
  const techLines = techContent.split('\n').filter(l => l.trim());
  const techHeader = parseCSVLine(techLines[0]);
  
  for (let i = 1; i < techLines.length; i++) {
    const cols = parseCSVLine(techLines[i]);
    const row = {};
    techHeader.forEach((h, j) => row[h.toLowerCase().replace(/ /g, '_')] = cols[j]);
    
    const sku = row.sku;
    if (!sku || seenSkus.has(sku)) continue;
    seenSkus.add(sku);
    
    const title = row.product_desc || '';
    const brandCode = row.brand_code_3 || row.brand_code || row.brand_cd || '';
    const subTypeRaw = row.product_sub_type || row.sub_type || '';
    const msrp = parseFloat(row.msrp) || null;
    const map = parseFloat(row.map_price) || null;
    const rawImageUrl = row.image_url || row.image_url1 || '';
    
    const { category, subType } = categorize(subTypeRaw, title);
    const brand = BRAND_NAMES[brandCode] || row.brand_desc || brandCode;
    const cost = msrp ? msrp * 0.75 : null;
    const sellPrice = calculateSellPrice(cost, msrp, map);
    
    // Check S3 first for image, then validate TechFeed URL
    let imageUrl = s3Images.get(sku) || validateImageUrl(rawImageUrl, s3Images);
    
    accessories.push({
      sku,
      title,
      brand,
      brandCode,
      category,
      subType,
      msrp,
      map,
      cost,
      sellPrice,
      imageUrl,
      imageUrl2: validateImageUrl(row.image_url2, s3Images),
      imageUrl3: validateImageUrl(row.image_url3, s3Images),
      upc: row.upc,
      threadSize: parseThreadSize(title),
      seatType: parseSeatType(title),
      outerDiameter: parseHubRing(title)?.outer,
      innerDiameter: parseHubRing(title)?.inner,
      boltPattern: parseBoltPattern(title),
      wheelBrand: parseWheelBrand(title, brandCode),
      // New filter attributes
      material: parseMaterial(title),
      closedEnd: parseClosedEnd(title),
      isBolt: parseIsBolt(title),
      style: parseLugStyle(title),
      packageType: parsePackageType(title),
      pieceCount: parsePieceCount(title),
      hexSize: parseHexSize(title),
    });
  }
  
  console.log(`  Parsed ${seenSkus.size} from TechGuide`);
  
  // Parse CommonFeed (fills gaps)
  if (fs.existsSync(commonPath)) {
    console.log('Parsing CommonFeed...');
    const commonContent = fs.readFileSync(commonPath, 'utf8');
    const commonLines = commonContent.split('\n').filter(l => l.trim());
    const commonHeader = parseCSVLine(commonLines[0]);
    let added = 0;
    
    for (let i = 1; i < commonLines.length; i++) {
      const cols = parseCSVLine(commonLines[i]);
      const row = {};
      commonHeader.forEach((h, j) => row[h.toLowerCase().replace(/ /g, '_')] = cols[j]);
      
      const sku = row.partnumber || row.sku;
      if (!sku || seenSkus.has(sku)) continue;
      seenSkus.add(sku);
      
      const title = row.partdescription || row.product_desc || '';
      const brandCode = row.brand || '';
      const msrp = parseFloat(row.msrp_usd || row.msrp) || null;
      const map = parseFloat(row.map_usd || row.map_price) || null;
      const rawImageUrl = row.imageurl || row.image_url || '';
      
      const { category, subType } = categorize('', title);
      const brand = BRAND_NAMES[brandCode] || brandCode;
      const cost = msrp ? msrp * 0.75 : null;
      const sellPrice = calculateSellPrice(cost, msrp, map);
      
      let imageUrl = s3Images.get(sku) || validateImageUrl(rawImageUrl, s3Images);
      
      accessories.push({
        sku,
        title,
        brand,
        brandCode,
        category,
        subType,
        msrp,
        map,
        cost,
        sellPrice,
        imageUrl,
        threadSize: parseThreadSize(title),
        seatType: parseSeatType(title),
        outerDiameter: parseHubRing(title)?.outer,
        innerDiameter: parseHubRing(title)?.inner,
        boltPattern: parseBoltPattern(title),
        wheelBrand: parseWheelBrand(title, brandCode),
        // New filter attributes
        material: parseMaterial(title),
        closedEnd: parseClosedEnd(title),
        isBolt: parseIsBolt(title),
        style: parseLugStyle(title),
        packageType: parsePackageType(title),
        pieceCount: parsePieceCount(title),
        hexSize: parseHexSize(title),
      });
      added++;
    }
    
    console.log(`  Added ${added} from CommonFeed`);
  }
  
  const withImages = accessories.filter(a => a.imageUrl).length;
  console.log(`\nTotal: ${accessories.length} accessories (${withImages} with images)`);
  
  return accessories;
}

/**
 * Insert accessories into database
 */
async function insertAccessories(pool, accessories) {
  if (accessories.length === 0) {
    console.log('No accessories to insert');
    return;
  }
  
  console.log('\nInserting into database...');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    let inserted = 0, updated = 0;
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < accessories.length; i++) {
      const acc = accessories[i];
      
      const result = await client.query(`
        INSERT INTO accessories (
          sku, title, brand, brand_code, category, sub_type,
          msrp, map_price, sell_price, cost,
          image_url, image_url_2, image_url_3,
          in_stock, upc,
          thread_size, seat_type, hex_size,
          outer_diameter, inner_diameter,
          bolt_pattern, wheel_brand,
          material, closed_end, is_bolt, style, package_type, piece_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
        ON CONFLICT (sku) DO UPDATE SET
          title = EXCLUDED.title,
          brand = EXCLUDED.brand,
          brand_code = EXCLUDED.brand_code,
          category = EXCLUDED.category,
          sub_type = EXCLUDED.sub_type,
          msrp = EXCLUDED.msrp,
          map_price = EXCLUDED.map_price,
          sell_price = EXCLUDED.sell_price,
          cost = EXCLUDED.cost,
          image_url = EXCLUDED.image_url,
          image_url_2 = EXCLUDED.image_url_2,
          image_url_3 = EXCLUDED.image_url_3,
          thread_size = COALESCE(EXCLUDED.thread_size, accessories.thread_size),
          seat_type = COALESCE(EXCLUDED.seat_type, accessories.seat_type),
          hex_size = COALESCE(EXCLUDED.hex_size, accessories.hex_size),
          material = COALESCE(EXCLUDED.material, accessories.material),
          closed_end = COALESCE(EXCLUDED.closed_end, accessories.closed_end),
          is_bolt = COALESCE(EXCLUDED.is_bolt, accessories.is_bolt),
          style = COALESCE(EXCLUDED.style, accessories.style),
          package_type = COALESCE(EXCLUDED.package_type, accessories.package_type),
          piece_count = COALESCE(EXCLUDED.piece_count, accessories.piece_count),
          outer_diameter = COALESCE(EXCLUDED.outer_diameter, accessories.outer_diameter),
          inner_diameter = COALESCE(EXCLUDED.inner_diameter, accessories.inner_diameter),
          bolt_pattern = COALESCE(EXCLUDED.bolt_pattern, accessories.bolt_pattern),
          wheel_brand = COALESCE(EXCLUDED.wheel_brand, accessories.wheel_brand),
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
      `, [
        acc.sku,
        acc.title,
        acc.brand,
        acc.brandCode,
        acc.category,
        acc.subType,
        acc.msrp,
        acc.map,
        acc.sellPrice,
        acc.cost,
        acc.imageUrl,
        acc.imageUrl2,
        acc.imageUrl3,
        false, // in_stock - updated by inventory sync
        acc.upc,
        acc.threadSize,
        acc.seatType,
        acc.hexSize,
        acc.outerDiameter,
        acc.innerDiameter,
        acc.boltPattern,
        acc.wheelBrand,
        acc.material,
        acc.closedEnd,
        acc.isBolt,
        acc.style,
        acc.packageType,
        acc.pieceCount,
      ]);
      
      if (result.rows[0]?.inserted) {
        inserted++;
      } else {
        updated++;
      }
      
      if ((i + 1) % 1000 === 0) {
        console.log(`  ... processed ${i + 1}/${accessories.length}`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`\nInserted: ${inserted}, Updated: ${updated}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const sourceArg = args.find(a => a.startsWith('--source='))?.split('=')[1] || 'sftp';
  const csvPath = args.find(a => a.startsWith('--csv-path='))?.split('=')[1];
  const skipS3 = args.includes('--skip-s3');
  
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });
  
  try {
    // Step 1: Fetch S3 image listing
    let s3Images = new Map();
    if (!skipS3) {
      s3Images = await listAllS3Keys();
    }
    
    // Step 2: Get TechFeed data
    let techPath, commonPath;
    
    if (sourceArg === 'csv' && csvPath) {
      techPath = csvPath;
      commonPath = csvPath.replace('TechGuide', 'InvPriceData');
    } else if (sourceArg === 'sftp') {
      const paths = await downloadFromSFTP();
      techPath = paths.techPath;
      commonPath = paths.commonPath;
    } else {
      // Default to local files if they exist
      techPath = './data/Accessory_TechGuide.csv';
      commonPath = './data/accessoriesInvPriceData.csv';
      if (!fs.existsSync(techPath)) {
        console.log('No local CSV found, downloading from SFTP...');
        const paths = await downloadFromSFTP();
        techPath = paths.techPath;
        commonPath = paths.commonPath;
      }
    }
    
    // Step 3: Parse accessories
    const accessories = parseAccessories(techPath, commonPath, s3Images);
    
    // Step 4: Insert into database
    await insertAccessories(pool, accessories);
    
    // Step 5: Show stats
    const stats = await pool.query(`
      SELECT 
        category, 
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE image_url IS NOT NULL) as with_images
      FROM accessories 
      GROUP BY category 
      ORDER BY count DESC
    `);
    
    console.log('\nCategory breakdown:');
    for (const row of stats.rows) {
      console.log(`  ${row.category}: ${row.count} (${row.with_images} with images)`);
    }
    
    console.log('\nDone!');
    
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
