/**
 * Import Accessories from WheelPros
 * 
 * Sources (in order of preference):
 * 1. Local TechFeed CSV (if available)
 * 2. WheelPros SFTP TechFeed
 * 3. WheelPros API (limited, fallback)
 * 
 * Usage:
 *   node scripts/import-accessories.mjs [--source=api|sftp|csv] [--csv-path=path]
 */

import dotenv from 'dotenv';
import pg from 'pg';
import Client from 'ssh2-sftp-client';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

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

// Sub-type refinement
const SUB_TYPE_MAP = {
  'wheel lock': 'wheel_lock',
  'lug kit': 'lug_kit',
  'lug nut': 'lug_nut',
  'led pod': 'led_pod',
  'light bar': 'light_bar',
  'rock light': 'rock_light',
  'hub centric': 'hub_centric_ring',
  'center cap': 'center_cap',
};

// Brand code to full name
const BRAND_NAMES = {
  'GO': 'Gorilla Automotive',
  'MO': 'Moto Metal',
  'FU': 'Fuel',
  'KM': 'KMC',
  'XD': 'XD',
  'HE': 'Helo',
  'AS': 'Asanti',
  'BA': 'Baja Boss',
  'AR': 'American Racing',
  'AT': 'ATX',
  'BF': 'Baja Boss',
};

/**
 * Parse thread size from title
 * Examples: "14-1.5", "M14x1.5", "12-1.25", "1/2-20"
 */
function parseThreadSize(title) {
  const t = title.toUpperCase();
  
  // Metric: 14-1.5, M14x1.5, 14X1.5
  const metric = t.match(/[M ]?(\d{2})[X-](\d\.\d+)/);
  if (metric) {
    return `M${metric[1]}x${metric[2]}`;
  }
  
  // SAE: 1/2-20, 7/16-20
  const sae = t.match(/(\d\/\d+)[- ]?(\d+)/);
  if (sae) {
    return `${sae[1]}-${sae[2]}`;
  }
  
  return null;
}

/**
 * Parse seat type from title
 */
function parseSeatType(title) {
  const t = title.toUpperCase();
  
  if (t.includes('BALL') || t.includes('RADIUS') || t.includes('SPHERICAL')) return 'ball';
  if (t.includes('MAG') || t.includes('SHANK')) return 'mag';
  if (t.includes('FLAT') || t.includes('WASHER')) return 'flat';
  if (t.includes('ACORN') || t.includes('BULGE') || t.includes('CONICAL') || t.includes('TAPER')) return 'conical';
  
  return null;
}

/**
 * Parse hub ring dimensions from title
 * Example: "70 OD-54.06 ID", "73.1-56.1", "HUB RING 73.1/64.1"
 */
function parseHubRing(title) {
  const t = title.toUpperCase();
  
  // Pattern: "70 OD-54.06 ID" or "73.1OD 56.1ID"
  const odId = t.match(/(\d+(?:\.\d+)?)\s*OD[- ]?(\d+(?:\.\d+)?)\s*ID/);
  if (odId) {
    return { outer: parseFloat(odId[1]), inner: parseFloat(odId[2]) };
  }
  
  // Pattern: "73.1-56.1" or "73.1/64.1"
  const simple = t.match(/(\d{2,3}(?:\.\d+)?)[\/\-](\d{2,3}(?:\.\d+)?)/);
  if (simple && parseFloat(simple[1]) > parseFloat(simple[2])) {
    return { outer: parseFloat(simple[1]), inner: parseFloat(simple[2]) };
  }
  
  return null;
}

/**
 * Parse bolt pattern from title
 * Example: "8X170", "6x139.7", "5-127"
 */
function parseBoltPattern(title) {
  const t = title.toUpperCase();
  
  const bp = t.match(/(\d)[X-](\d{3}(?:\.\d)?)/);
  if (bp) {
    return `${bp[1]}x${bp[2]}`;
  }
  
  return null;
}

/**
 * Parse wheel brand from title
 * Example: "MOTO CAP" -> "Moto Metal", "FUEL CAP" -> "Fuel"
 */
function parseWheelBrand(title, brandCode) {
  const t = title.toUpperCase();
  
  if (t.includes('MOTO') || brandCode === 'MO') return 'Moto Metal';
  if (t.includes('FUEL') || brandCode === 'FU') return 'Fuel';
  if (t.includes('XD') || brandCode === 'XD') return 'XD';
  if (t.includes('KMC') || brandCode === 'KM') return 'KMC';
  if (t.includes('HELO') || brandCode === 'HE') return 'Helo';
  if (t.includes('ASANTI') || brandCode === 'AS') return 'Asanti';
  if (t.includes('AMERICAN RACING') || brandCode === 'AR') return 'American Racing';
  
  return null;
}

/**
 * Categorize product from sub_type and title
 */
function categorize(subType, title) {
  const st = (subType || '').toUpperCase();
  const t = (title || '').toUpperCase();
  
  // Check sub_type first
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (st.includes(key)) {
      return { category: cat, subType: SUB_TYPE_MAP[key.toLowerCase()] || st.toLowerCase() };
    }
  }
  
  // Fall back to title analysis
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
 * Calculate sell price (30% margin on cost, capped at MSRP)
 */
function calculateSellPrice(cost, msrp, map) {
  if (cost && cost > 0) {
    const target = cost * 1.30;
    return msrp && msrp > 0 ? Math.min(target, msrp) : target;
  }
  if (map && map > 0) return map;
  if (msrp && msrp > 0) return msrp * 0.975; // Fallback
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
 * Import from local CSV file
 */
async function importFromCSV(pool, csvPath) {
  console.log('Importing from CSV:', csvPath);
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  
  const header = parseCSVLine(lines[0]);
  console.log('CSV columns:', header.join(', '));
  
  const accessories = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row = {};
    header.forEach((h, j) => row[h.toLowerCase().replace(/ /g, '_')] = cols[j]);
    
    // Map CSV columns to our schema
    const sku = row.sku || row.part_number;
    const title = row.product_desc || row.title || row.description;
    const brandCode = row.brand_code_3 || row.brand_code;
    const subTypeRaw = row.sub_type || row.category;
    const msrp = parseFloat(row.msrp) || null;
    const map = parseFloat(row.map_price || row.map) || null;
    const imageUrl = row.image_url || row.image_url1;
    const upc = row.upc;
    
    if (!sku || !title) continue;
    
    const { category, subType } = categorize(subTypeRaw, title);
    const brand = BRAND_NAMES[brandCode] || row.brand_desc || brandCode;
    
    // Parse specs from title
    const threadSize = parseThreadSize(title);
    const seatType = parseSeatType(title);
    const hubRing = parseHubRing(title);
    const boltPattern = parseBoltPattern(title);
    const wheelBrand = parseWheelBrand(title, brandCode);
    
    // Estimate cost as MSRP * 0.75 if not provided
    const cost = msrp ? msrp * 0.75 : null;
    const sellPrice = calculateSellPrice(cost, msrp, map);
    
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
      imageUrl2: row.image_url2,
      imageUrl3: row.image_url3,
      upc,
      threadSize,
      seatType,
      outerDiameter: hubRing?.outer,
      innerDiameter: hubRing?.inner,
      boltPattern,
      wheelBrand,
    });
  }
  
  console.log(`Parsed ${accessories.length} accessories`);
  
  // Insert into database
  await insertAccessories(pool, accessories);
  
  return accessories.length;
}

/**
 * Import from SFTP TechFeed
 * 
 * Downloads from:
 * - /TechFeed/ACCESSORIES/Accessory_TechGuide.csv (primary - has images)
 * - /CommonFeed/USD/ACCESSORIES/accessoriesInvPriceData.csv (supplement - more SKUs)
 */
async function importFromSFTP(pool) {
  console.log('Connecting to WheelPros SFTP...');
  
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
  
  // Download TechGuide (has images!)
  console.log('Downloading TechFeed/ACCESSORIES/Accessory_TechGuide.csv...');
  const techPath = './data/Accessory_TechGuide.csv';
  await sftp.get('/TechFeed/ACCESSORIES/Accessory_TechGuide.csv', techPath);
  
  // Download CommonFeed (more SKUs, inventory data)
  console.log('Downloading CommonFeed/USD/ACCESSORIES/accessoriesInvPriceData.csv...');
  const commonPath = './data/accessoriesInvPriceData.csv';
  await sftp.get('/CommonFeed/USD/ACCESSORIES/accessoriesInvPriceData.csv', commonPath);
  
  await sftp.end();
  console.log('Downloaded!');
  
  // Parse TechGuide first (has images, product details)
  const techContent = fs.readFileSync(techPath, 'utf8');
  const techLines = techContent.split('\n').filter(l => l.trim());
  const techHeader = parseCSVLine(techLines[0]);
  console.log('TechGuide rows:', techLines.length - 1);
  
  // Parse CommonFeed (more SKUs, inventory)
  const commonContent = fs.readFileSync(commonPath, 'utf8');
  const commonLines = commonContent.split('\n').filter(l => l.trim());
  const commonHeader = parseCSVLine(commonLines[0]);
  console.log('CommonFeed rows:', commonLines.length - 1);
  
  // Build accessory list
  const accessories = [];
  const seenSkus = new Set();
  
  // First: TechGuide (has images)
  for (let i = 1; i < techLines.length; i++) {
    const cols = parseCSVLine(techLines[i]);
    const row = {};
    techHeader.forEach((h, j) => row[h.toLowerCase().replace(/ /g, '_')] = cols[j]);
    
    const sku = row.sku;
    if (!sku || seenSkus.has(sku)) continue;
    seenSkus.add(sku);
    
    const title = row.product_desc || '';
    const brandCode = row.brand_code_3 || row.brand_code || '';
    const subTypeRaw = row.product_sub_type || row.sub_type || '';
    const msrp = parseFloat(row.msrp) || null;
    const map = parseFloat(row.map_price) || null;
    const imageUrl = row.image_url || row.image_url1 || '';
    
    const { category, subType } = categorize(subTypeRaw, title);
    const brand = BRAND_NAMES[brandCode] || row.brand_desc || brandCode;
    const cost = msrp ? msrp * 0.75 : null;
    const sellPrice = calculateSellPrice(cost, msrp, map);
    
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
      imageUrl: imageUrl || null,
      imageUrl2: row.image_url2 || null,
      imageUrl3: row.image_url3 || null,
      upc: row.upc,
      threadSize: parseThreadSize(title),
      seatType: parseSeatType(title),
      outerDiameter: parseHubRing(title)?.outer,
      innerDiameter: parseHubRing(title)?.inner,
      boltPattern: parseBoltPattern(title),
      wheelBrand: parseWheelBrand(title, brandCode),
    });
  }
  
  // Second: CommonFeed (fills gaps, has inventory)
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
    const imageUrl = row.imageurl || row.image_url || '';
    
    const { category, subType } = categorize('', title);
    const brand = BRAND_NAMES[brandCode] || brandCode;
    const cost = msrp ? msrp * 0.75 : null;
    const sellPrice = calculateSellPrice(cost, msrp, map);
    
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
      imageUrl: imageUrl || null,
      threadSize: parseThreadSize(title),
      seatType: parseSeatType(title),
      outerDiameter: parseHubRing(title)?.outer,
      innerDiameter: parseHubRing(title)?.inner,
      boltPattern: parseBoltPattern(title),
      wheelBrand: parseWheelBrand(title, brandCode),
    });
  }
  
  console.log(`Total unique accessories: ${accessories.length}`);
  console.log(`With images: ${accessories.filter(a => a.imageUrl).length}`);
  
  // Insert into database
  await insertAccessories(pool, accessories);
  
  return accessories.length;
}

/**
 * Import from WheelPros API (limited fallback)
 */
async function importFromAPI(pool) {
  console.log('Importing from WheelPros API (limited)...');
  
  const baseUrl = process.env.WHEELPROS_WRAPPER_URL || 'https://shop.warehousetiredirect.com/api/wheelpros-proxy';
  
  const categories = [
    { filter: 'lug nut', category: 'lug_nut' },
    { filter: 'hub ring', category: 'hub_ring' },
    { filter: 'center cap', category: 'center_cap' },
    { filter: 'LED', category: 'lighting' },
    { filter: 'light bar', category: 'lighting' },
    { filter: 'TPMS', category: 'tpms' },
    { filter: 'valve stem', category: 'valve_stem' },
    { filter: 'wheel spacer', category: 'spacer' },
  ];
  
  const accessories = [];
  
  for (const cat of categories) {
    try {
      // Use the local search endpoint which wraps WheelPros
      const url = `https://shop.warehousetiredirect.com/api/accessories/search?q=${encodeURIComponent(cat.filter)}&pageSize=100`;
      const res = await fetch(url);
      const data = await res.json();
      
      for (const item of (data.results || [])) {
        const { category, subType } = categorize(cat.filter, item.title);
        const threadSize = parseThreadSize(item.title);
        const seatType = parseSeatType(item.title);
        const hubRing = parseHubRing(item.title);
        const boltPattern = parseBoltPattern(item.title);
        const wheelBrand = parseWheelBrand(item.title, item.brandCode);
        
        accessories.push({
          sku: item.sku,
          title: item.title,
          brand: item.brand,
          brandCode: item.brandCode,
          category,
          subType,
          msrp: item.msrp,
          map: item.map,
          cost: item.msrp ? item.msrp * 0.75 : null,
          sellPrice: item.price || calculateSellPrice(item.msrp * 0.75, item.msrp, item.map),
          imageUrl: item.imageUrl,
          inStock: item.inStock,
          threadSize,
          seatType,
          outerDiameter: hubRing?.outer,
          innerDiameter: hubRing?.inner,
          boltPattern,
          wheelBrand,
        });
      }
      
      console.log(`  ${cat.filter}: ${data.results?.length || 0} items`);
    } catch (err) {
      console.warn(`  ${cat.filter}: ERROR - ${err.message}`);
    }
  }
  
  // Dedupe by SKU
  const uniqueSkus = new Map();
  for (const acc of accessories) {
    if (acc.sku && !uniqueSkus.has(acc.sku)) {
      uniqueSkus.set(acc.sku, acc);
    }
  }
  
  const deduped = Array.from(uniqueSkus.values());
  console.log(`Total unique accessories: ${deduped.length}`);
  
  await insertAccessories(pool, deduped);
  
  return deduped.length;
}

/**
 * Insert accessories into database
 */
async function insertAccessories(pool, accessories) {
  if (accessories.length === 0) {
    console.log('No accessories to insert');
    return;
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Upsert each accessory
    let inserted = 0, updated = 0;
    
    for (const acc of accessories) {
      const result = await client.query(`
        INSERT INTO accessories (
          sku, title, brand, brand_code, category, sub_type,
          msrp, map_price, sell_price, cost,
          image_url, image_url_2, image_url_3,
          in_stock, upc,
          thread_size, seat_type,
          outer_diameter, inner_diameter,
          bolt_pattern, wheel_brand
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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
          in_stock = COALESCE(EXCLUDED.in_stock, accessories.in_stock),
          thread_size = COALESCE(EXCLUDED.thread_size, accessories.thread_size),
          seat_type = COALESCE(EXCLUDED.seat_type, accessories.seat_type),
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
        acc.inStock || false,
        acc.upc,
        acc.threadSize,
        acc.seatType,
        acc.outerDiameter,
        acc.innerDiameter,
        acc.boltPattern,
        acc.wheelBrand,
      ]);
      
      if (result.rows[0]?.inserted) {
        inserted++;
      } else {
        updated++;
      }
    }
    
    await client.query('COMMIT');
    console.log(`Inserted: ${inserted}, Updated: ${updated}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const sourceArg = args.find(a => a.startsWith('--source='))?.split('=')[1] || 'auto';
  const csvPath = args.find(a => a.startsWith('--csv-path='))?.split('=')[1];
  
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });
  
  try {
    // Create table if needed
    const schema = fs.readFileSync('./src/lib/db/schema/accessories.sql', 'utf8');
    await pool.query(schema);
    console.log('Schema ready');
    
    let count = 0;
    
    if (sourceArg === 'csv' && csvPath) {
      count = await importFromCSV(pool, csvPath);
    } else if (sourceArg === 'sftp') {
      count = await importFromSFTP(pool);
    } else if (sourceArg === 'api') {
      count = await importFromAPI(pool);
    } else {
      // Auto: try SFTP first, fall back to API
      try {
        count = await importFromSFTP(pool);
      } catch (sftpErr) {
        console.warn('SFTP failed:', sftpErr.message);
        console.log('Falling back to API...');
        count = await importFromAPI(pool);
      }
    }
    
    console.log(`\nImport complete! ${count} accessories processed.`);
    
    // Show category counts
    const stats = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM accessories 
      GROUP BY category 
      ORDER BY count DESC
    `);
    console.log('\nCategory breakdown:');
    for (const row of stats.rows) {
      console.log(`  ${row.category}: ${row.count}`);
    }
    
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
