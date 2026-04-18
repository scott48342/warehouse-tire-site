/**
 * Import Suspension/Lift Kit Fitments from WheelPros Accessory TechGuide
 * 
 * Downloads Accessory_TechGuide.csv from SFTP, parses vehicle fitment from
 * product descriptions, and imports into suspension_fitments table.
 * 
 * Usage: node scripts/import-suspension-fitments.mjs
 */

import Client from 'ssh2-sftp-client';
import { parse } from 'csv-parse/sync';
import pg from 'pg';

const { Pool } = pg;

// ============================================================================
// Configuration
// ============================================================================

const SFTP_CONFIG = {
  host: 'sftp.wheelpros.com',
  port: 22,
  username: 'Warehouse1',
  password: process.env.WHEELPROS_SFTP_PASS || 'Websters1!',
};

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!DATABASE_URL) throw new Error('Missing DATABASE_URL or POSTGRES_URL');

// ============================================================================
// Jeep Generation Codes
// ============================================================================

const JEEP_CODES = {
  // Wrangler
  'TJ': { make: 'Jeep', model: 'Wrangler TJ', yearStart: 1997, yearEnd: 2006 },
  'LJ': { make: 'Jeep', model: 'Wrangler LJ', yearStart: 2004, yearEnd: 2006 },
  'JK': { make: 'Jeep', model: 'Wrangler JK', yearStart: 2007, yearEnd: 2018 },
  'JK2': { make: 'Jeep', model: 'Wrangler JK 2-Door', yearStart: 2007, yearEnd: 2018 },
  'JK4': { make: 'Jeep', model: 'Wrangler JK 4-Door', yearStart: 2007, yearEnd: 2018 },
  'JKU': { make: 'Jeep', model: 'Wrangler JK Unlimited', yearStart: 2007, yearEnd: 2018 },
  'JL': { make: 'Jeep', model: 'Wrangler JL', yearStart: 2018, yearEnd: 2026 },
  'JL2': { make: 'Jeep', model: 'Wrangler JL 2-Door', yearStart: 2018, yearEnd: 2026 },
  'JL4': { make: 'Jeep', model: 'Wrangler JL 4-Door', yearStart: 2018, yearEnd: 2026 },
  'JT': { make: 'Jeep', model: 'Gladiator', yearStart: 2020, yearEnd: 2026 },
  'JLDEH': { make: 'Jeep', model: 'Wrangler JL Diesel', yearStart: 2020, yearEnd: 2026 },
  'JLDEF': { make: 'Jeep', model: 'Wrangler JL Diesel', yearStart: 2020, yearEnd: 2026 },
  'JLU': { make: 'Jeep', model: 'Wrangler JL Unlimited', yearStart: 2018, yearEnd: 2026 },
  'JTED': { make: 'Jeep', model: 'Gladiator Diesel', yearStart: 2021, yearEnd: 2026 },
  'JTEH': { make: 'Jeep', model: 'Gladiator', yearStart: 2020, yearEnd: 2026 },
  
  // Cherokee / Grand Cherokee
  'XJ': { make: 'Jeep', model: 'Cherokee XJ', yearStart: 1984, yearEnd: 2001 },
  'KJ': { make: 'Jeep', model: 'Liberty KJ', yearStart: 2002, yearEnd: 2007 },
  'KK': { make: 'Jeep', model: 'Liberty KK', yearStart: 2008, yearEnd: 2012 },
  'KL': { make: 'Jeep', model: 'Cherokee KL', yearStart: 2014, yearEnd: 2026 },
  'ZJ': { make: 'Jeep', model: 'Grand Cherokee ZJ', yearStart: 1993, yearEnd: 1998 },
  'WJ': { make: 'Jeep', model: 'Grand Cherokee WJ', yearStart: 1999, yearEnd: 2004 },
  'WK': { make: 'Jeep', model: 'Grand Cherokee WK', yearStart: 2005, yearEnd: 2010 },
  'WK2': { make: 'Jeep', model: 'Grand Cherokee WK2', yearStart: 2011, yearEnd: 2021 },
  'WL': { make: 'Jeep', model: 'Grand Cherokee WL', yearStart: 2022, yearEnd: 2026 },
  
  // Compass / Patriot / Renegade
  'MK': { make: 'Jeep', model: 'Compass/Patriot MK', yearStart: 2007, yearEnd: 2017 },
  'MP': { make: 'Jeep', model: 'Compass MP', yearStart: 2017, yearEnd: 2026 },
  'BU': { make: 'Jeep', model: 'Renegade BU', yearStart: 2015, yearEnd: 2026 },
};

// ============================================================================
// Vehicle Model Patterns
// ============================================================================

const MODEL_PATTERNS = [
  // GM trucks
  { pattern: /SILVERADO\s*(\d+)/i, make: 'Chevrolet', model: m => `Silverado ${m[1]}` },
  { pattern: /SIERRA\s*(\d+)/i, make: 'GMC', model: m => `Sierra ${m[1]}` },
  { pattern: /GM\s*1500/i, make: 'Chevrolet', model: () => 'Silverado 1500', altMake: 'GMC', altModel: 'Sierra 1500' },
  { pattern: /GM\s*2500/i, make: 'Chevrolet', model: () => 'Silverado 2500HD', altMake: 'GMC', altModel: 'Sierra 2500HD' },
  { pattern: /GM\s*3500/i, make: 'Chevrolet', model: () => 'Silverado 3500HD', altMake: 'GMC', altModel: 'Sierra 3500HD' },
  { pattern: /CHEVY\s*(?:\/\s*)?GMC/i, make: 'Chevrolet', model: () => 'Silverado 1500', altMake: 'GMC', altModel: 'Sierra 1500' },
  { pattern: /GMC\s*DENALI/i, make: 'GMC', model: () => 'Sierra 1500 Denali' },
  { pattern: /DENALI/i, make: 'GMC', model: () => 'Sierra Denali' },
  { pattern: /TAHOE/i, make: 'Chevrolet', model: () => 'Tahoe' },
  { pattern: /YUKON/i, make: 'GMC', model: () => 'Yukon' },
  { pattern: /SUBURBAN/i, make: 'Chevrolet', model: () => 'Suburban' },
  { pattern: /AVALANCHE/i, make: 'Chevrolet', model: () => 'Avalanche' },
  { pattern: /COLORADO/i, make: 'Chevrolet', model: () => 'Colorado' },
  { pattern: /CANYON/i, make: 'GMC', model: () => 'Canyon' },
  { pattern: /HUMMER\s*H2/i, make: 'Hummer', model: () => 'H2' },
  { pattern: /HUMMER\s*H3/i, make: 'Hummer', model: () => 'H3' },
  { pattern: /ESCALADE/i, make: 'Cadillac', model: () => 'Escalade' },
  
  // Ford trucks
  { pattern: /F-?150/i, make: 'Ford', model: () => 'F-150' },
  { pattern: /FORD\s*150/i, make: 'Ford', model: () => 'F-150' },
  { pattern: /F-?250/i, make: 'Ford', model: () => 'F-250' },
  { pattern: /F-?350/i, make: 'Ford', model: () => 'F-350' },
  { pattern: /F-?450/i, make: 'Ford', model: () => 'F-450' },
  { pattern: /RANGER/i, make: 'Ford', model: () => 'Ranger' },
  { pattern: /BRONCO\s*SPORT/i, make: 'Ford', model: () => 'Bronco Sport' },
  { pattern: /BRONCO/i, make: 'Ford', model: () => 'Bronco' },
  { pattern: /RAPTOR/i, make: 'Ford', model: () => 'F-150 Raptor' },
  { pattern: /SUPER\s*DUTY/i, make: 'Ford', model: () => 'Super Duty' },
  { pattern: /FORD\s*SD/i, make: 'Ford', model: () => 'Super Duty' },
  { pattern: /EXCURSION/i, make: 'Ford', model: () => 'Excursion' },
  { pattern: /EXPEDITION|EXPED\b/i, make: 'Ford', model: () => 'Expedition' },
  { pattern: /EXPLORER/i, make: 'Ford', model: () => 'Explorer' },
  
  // Ram / Dodge trucks
  { pattern: /RAM\s*(?:AIR\s*)?1500/i, make: 'Ram', model: () => '1500' },
  { pattern: /RAM\s*2500/i, make: 'Ram', model: () => '2500' },
  { pattern: /RAM\s*3500/i, make: 'Ram', model: () => '3500' },
  { pattern: /POWER\s*WAGON/i, make: 'Ram', model: () => 'Power Wagon' },
  { pattern: /DAKOTA/i, make: 'Dodge', model: () => 'Dakota' },
  { pattern: /DURANGO/i, make: 'Dodge', model: () => 'Durango' },
  
  // Toyota
  { pattern: /TUNDRA/i, make: 'Toyota', model: () => 'Tundra' },
  { pattern: /TACOMA/i, make: 'Toyota', model: () => 'Tacoma' },
  { pattern: /4RUNNER/i, make: 'Toyota', model: () => '4Runner' },
  { pattern: /SEQUOIA/i, make: 'Toyota', model: () => 'Sequoia' },
  { pattern: /LAND\s*CRUISER/i, make: 'Toyota', model: () => 'Land Cruiser' },
  { pattern: /FJ\s*CRUISER/i, make: 'Toyota', model: () => 'FJ Cruiser' },
  { pattern: /HILUX/i, make: 'Toyota', model: () => 'Hilux' },
  { pattern: /TY\s*RAV4|RAV4|RAV-4/i, make: 'Toyota', model: () => 'RAV4' },
  { pattern: /LEXUS\s*GX/i, make: 'Lexus', model: () => 'GX' },
  { pattern: /LEXUS\s*LX/i, make: 'Lexus', model: () => 'LX' },
  
  // Subaru
  { pattern: /SUBARU\s*FORESTER|FORESTER/i, make: 'Subaru', model: () => 'Forester' },
  { pattern: /SUBARU\s*ASCENT|ASCENT/i, make: 'Subaru', model: () => 'Ascent' },
  { pattern: /SUBARU\s*OUTBACK|OUTBACK/i, make: 'Subaru', model: () => 'Outback' },
  { pattern: /SUBARU\s*CROSSTREK|CROSSTREK/i, make: 'Subaru', model: () => 'Crosstrek' },
  
  // Hyundai / Kia
  { pattern: /SANTA\s*CRUZ/i, make: 'Hyundai', model: () => 'Santa Cruz' },
  { pattern: /PALISADE/i, make: 'Hyundai', model: () => 'Palisade' },
  { pattern: /TUCSON/i, make: 'Hyundai', model: () => 'Tucson' },
  { pattern: /TELLURIDE/i, make: 'Kia', model: () => 'Telluride' },
  { pattern: /SORENTO/i, make: 'Kia', model: () => 'Sorento' },
  
  // Jeep (explicit model names)
  { pattern: /WRANGLER\s*JK/i, make: 'Jeep', model: () => 'Wrangler JK' },
  { pattern: /WRANGLER\s*JL/i, make: 'Jeep', model: () => 'Wrangler JL' },
  { pattern: /WRANGLER\s*TJ/i, make: 'Jeep', model: () => 'Wrangler TJ' },
  { pattern: /WRANGLER/i, make: 'Jeep', model: () => 'Wrangler' },
  { pattern: /GLADIATOR/i, make: 'Jeep', model: () => 'Gladiator' },
  { pattern: /GRAND\s*CHEROKEE/i, make: 'Jeep', model: () => 'Grand Cherokee' },
  { pattern: /CHEROKEE/i, make: 'Jeep', model: () => 'Cherokee' },
  { pattern: /LIBERTY/i, make: 'Jeep', model: () => 'Liberty' },
  { pattern: /COMMANDER/i, make: 'Jeep', model: () => 'Commander' },
  { pattern: /COMPASS/i, make: 'Jeep', model: () => 'Compass' },
  { pattern: /PATRIOT/i, make: 'Jeep', model: () => 'Patriot' },
  { pattern: /RENEGADE/i, make: 'Jeep', model: () => 'Renegade' },
  
  // Nissan
  { pattern: /TITAN\s*XD/i, make: 'Nissan', model: () => 'Titan XD' },
  { pattern: /TITAN/i, make: 'Nissan', model: () => 'Titan' },
  { pattern: /FRONTIER/i, make: 'Nissan', model: () => 'Frontier' },
  { pattern: /PATHFINDER/i, make: 'Nissan', model: () => 'Pathfinder' },
  { pattern: /XTERRA/i, make: 'Nissan', model: () => 'Xterra' },
  { pattern: /ARMADA/i, make: 'Nissan', model: () => 'Armada' },
  
  // Other
  { pattern: /LAND\s*ROVER/i, make: 'Land Rover', model: () => 'Defender' },
  { pattern: /DEFENDER/i, make: 'Land Rover', model: () => 'Defender' },
  { pattern: /DISCOVERY/i, make: 'Land Rover', model: () => 'Discovery' },
];

// Year range patterns
const YEAR_PATTERNS = [
  { re: /[''](\d{2})\s*[-–]\s*['']?(\d{2})(?!\d)/g, type: '2digit' },
  { re: /(\d{4})\s*[-–]\s*(\d{4})/g, type: '4digit' },
  { re: /(\d{4})\s*[-–]\s*(\d{2})(?!\d)/g, type: 'mixed' },
  { re: /(\d{4})\s*[-–]\s*(?:CURRENT|PRESENT|NEWER|NEW)/gi, type: 'open' },
  { re: /(\d{4})\s*\+/g, type: 'plus' },
  { re: /(\d{4})\s*(?:AND\s*(?:UP|NEWER)|UP)/gi, type: 'open' },
  { re: /(?:^|[^0-9])(\d{4})(?:[^0-9]|$)/g, type: 'single' },
];

// ============================================================================
// Parser Functions
// ============================================================================

function parseDescription(desc) {
  if (!desc) return null;
  
  const result = {
    vehicles: [],
    yearStart: null,
    yearEnd: null,
    liftHeight: null,
  };
  
  // Extract lift height
  const liftPatterns = [
    /(\d+(?:\.\d+)?)\s*[''"""]\s*(?:LIFT|LEVELING|SPACER|COIL|SPRING|BLOCK|STRUT)/i,
    /(\d+(?:\.\d+)?)\s*(?:INCH|IN)\s*(?:LIFT|LEVELING)/i,
    /(\d+(?:\.\d+)?)[''"""]\s+(?:REAR|FRONT|F\/R|R\/F)/i,
    /(?:LIFT|LEVELING|RAISE).*?(\d+(?:\.\d+)?)\s*[''"""]/i,
  ];
  
  for (const lp of liftPatterns) {
    const liftMatch = desc.match(lp);
    if (liftMatch) {
      const val = parseFloat(liftMatch[1]);
      if (val > 0 && val <= 12) {
        result.liftHeight = val;
        break;
      }
    }
  }
  
  // Check for Jeep generation codes
  for (const [code, info] of Object.entries(JEEP_CODES)) {
    const codeRe = new RegExp(`\\b${code}\\b`, 'i');
    if (codeRe.test(desc)) {
      result.vehicles.push({ make: info.make, model: info.model });
      if (!result.yearStart) {
        result.yearStart = info.yearStart;
        result.yearEnd = info.yearEnd;
      }
    }
  }
  
  // Extract year range
  for (const { re, type } of YEAR_PATTERNS) {
    re.lastIndex = 0;
    const match = re.exec(desc);
    if (match) {
      if (type === '2digit') {
        let y1 = parseInt(match[1]);
        let y2 = parseInt(match[2]);
        y1 = y1 >= 50 ? 1900 + y1 : 2000 + y1;
        y2 = y2 >= 50 ? 1900 + y2 : 2000 + y2;
        result.yearStart = y1;
        result.yearEnd = y2;
      } else if (type === 'mixed') {
        const y1 = parseInt(match[1]);
        let y2 = parseInt(match[2]);
        const century = Math.floor(y1 / 100) * 100;
        y2 = century + y2;
        result.yearStart = y1;
        result.yearEnd = y2;
      } else if (type === '4digit') {
        result.yearStart = parseInt(match[1]);
        result.yearEnd = parseInt(match[2]);
      } else if (type === 'open' || type === 'plus') {
        result.yearStart = parseInt(match[1]);
        result.yearEnd = 2026;
      } else if (type === 'single') {
        const yr = parseInt(match[1]);
        if (yr >= 1980 && yr <= 2030 && !result.yearStart) {
          result.yearStart = yr;
          result.yearEnd = yr;
        }
      }
      if (result.yearStart) break;
    }
  }
  
  // Extract vehicles from model patterns
  for (const mp of MODEL_PATTERNS) {
    const match = desc.match(mp.pattern);
    if (match) {
      result.vehicles.push({
        make: mp.make,
        model: typeof mp.model === 'function' ? mp.model(match) : mp.model,
      });
      if (mp.altMake) {
        result.vehicles.push({ make: mp.altMake, model: mp.altModel });
      }
    }
  }
  
  // Dedupe vehicles
  const seen = new Set();
  result.vehicles = result.vehicles.filter(v => {
    const key = `${v.make}|${v.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  return result;
}

// ============================================================================
// Main Import
// ============================================================================

async function main() {
  console.log('🔧 Suspension Fitment Import\n');
  
  // Connect to SFTP
  const sftp = new Client();
  console.log('📡 Connecting to SFTP...');
  await sftp.connect(SFTP_CONFIG);
  
  // Download techfeed
  console.log('📥 Downloading Accessory_TechGuide.csv...');
  const csv = await sftp.get('/TechFeed/ACCESSORIES/Accessory_TechGuide.csv');
  await sftp.end();
  
  // Parse CSV
  const rows = parse(csv, { columns: true, skip_empty_lines: true });
  console.log(`📄 Total rows: ${rows.length}`);
  
  // Filter to suspension parts
  const suspensionParts = rows.filter(r => {
    const str = JSON.stringify(r).toLowerCase();
    return str.includes('lift') || str.includes('suspension') || str.includes('leveling');
  });
  console.log(`🔩 Suspension parts: ${suspensionParts.length}`);
  
  // Parse and prepare records
  const records = [];
  for (const row of suspensionParts) {
    const parsed = parseDescription(row.product_desc);
    if (!parsed || parsed.vehicles.length === 0 || !parsed.yearStart) continue;
    
    for (const vehicle of parsed.vehicles) {
      records.push({
        sku: row.sku,
        product_desc: row.product_desc,
        brand: row.brand_desc,
        product_type: row.product_sub_type,
        lift_height: parsed.liftHeight,
        make: vehicle.make,
        model: vehicle.model,
        year_start: parsed.yearStart,
        year_end: parsed.yearEnd,
        msrp: parseFloat(row.msrp) || null,
        map_price: parseFloat(row.map_price) || null,
        image_url: row.image_url || null,
      });
    }
  }
  
  console.log(`✅ Parsed records: ${records.length}`);
  
  // Connect to database
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  // Create table if needed
  console.log('\n📊 Creating table if not exists...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS suspension_fitments (
      id SERIAL PRIMARY KEY,
      sku VARCHAR(50) NOT NULL,
      product_desc TEXT,
      brand VARCHAR(100),
      product_type VARCHAR(50),
      lift_height DECIMAL(4,2),
      make VARCHAR(50) NOT NULL,
      model VARCHAR(100) NOT NULL,
      year_start INTEGER NOT NULL,
      year_end INTEGER NOT NULL,
      msrp DECIMAL(10,2),
      map_price DECIMAL(10,2),
      image_url TEXT,
      source VARCHAR(50) DEFAULT 'wheelpros_techfeed',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(sku, make, model, year_start, year_end)
    )
  `);
  
  // Create indexes
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_suspension_fitments_ymm ON suspension_fitments (make, model, year_start, year_end)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_suspension_fitments_sku ON suspension_fitments (sku)`);
  
  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await pool.query(`DELETE FROM suspension_fitments WHERE source = 'wheelpros_techfeed'`);
  
  // Insert records in batches
  console.log(`📤 Inserting ${records.length} records...`);
  const BATCH_SIZE = 100;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    const values = batch.map((r, idx) => {
      const offset = idx * 12;
      return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10}, $${offset+11}, $${offset+12})`;
    }).join(', ');
    
    const params = batch.flatMap(r => [
      r.sku, r.product_desc, r.brand, r.product_type, r.lift_height,
      r.make, r.model, r.year_start, r.year_end,
      r.msrp, r.map_price, r.image_url,
    ]);
    
    await pool.query(`
      INSERT INTO suspension_fitments (sku, product_desc, brand, product_type, lift_height, make, model, year_start, year_end, msrp, map_price, image_url)
      VALUES ${values}
      ON CONFLICT (sku, make, model, year_start, year_end) DO UPDATE SET
        product_desc = EXCLUDED.product_desc,
        brand = EXCLUDED.brand,
        product_type = EXCLUDED.product_type,
        lift_height = EXCLUDED.lift_height,
        msrp = EXCLUDED.msrp,
        map_price = EXCLUDED.map_price,
        image_url = EXCLUDED.image_url,
        updated_at = NOW()
    `, params);
    
    inserted += batch.length;
    if (inserted % 500 === 0) {
      console.log(`  ... ${inserted} records`);
    }
  }
  
  // Final stats
  const { rows: stats } = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT sku) as unique_skus,
      COUNT(DISTINCT make || ' ' || model) as unique_vehicles
    FROM suspension_fitments
  `);
  
  console.log(`\n✅ Import complete!`);
  console.log(`   Total records: ${stats[0].total}`);
  console.log(`   Unique SKUs: ${stats[0].unique_skus}`);
  console.log(`   Unique vehicles: ${stats[0].unique_vehicles}`);
  
  // Sample query
  console.log(`\n📋 Sample: Lift kits for 2022 Silverado 1500:`);
  const { rows: sample } = await pool.query(`
    SELECT sku, product_desc, lift_height, msrp
    FROM suspension_fitments
    WHERE make = 'Chevrolet' AND model = 'Silverado 1500'
      AND year_start <= 2022 AND year_end >= 2022
    ORDER BY lift_height NULLS LAST
    LIMIT 5
  `);
  sample.forEach(r => console.log(`   ${r.sku}: ${r.product_desc?.slice(0, 50)}... $${r.msrp}`));
  
  await pool.end();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
