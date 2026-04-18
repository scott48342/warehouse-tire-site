import Client from 'ssh2-sftp-client';
import { parse } from 'csv-parse/sync';

const sftp = new Client();

// Vehicle patterns for parsing descriptions
const MAKE_ALIASES = {
  'GM': ['Chevrolet', 'GMC'],
  'CHEVY': ['Chevrolet'],
  'CHEVROLET': ['Chevrolet'],
  'GMC': ['GMC'],
  'FORD': ['Ford'],
  'RAM': ['Ram'],
  'DODGE': ['Ram', 'Dodge'],
  'TOYOTA': ['Toyota'],
  'JEEP': ['Jeep'],
  'NISSAN': ['Nissan'],
};

const MODEL_PATTERNS = [
  // GM trucks - multiple patterns to catch variations
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
  
  // Jeep (explicit model names, codes handled separately)
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
  
  // Other brands
  { pattern: /LAND\s*ROVER/i, make: 'Land Rover', model: () => 'Defender' },
  { pattern: /DEFENDER/i, make: 'Land Rover', model: () => 'Defender' },
  { pattern: /DISCOVERY/i, make: 'Land Rover', model: () => 'Discovery' },
];

// Jeep generation codes → year ranges
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
  
  // JL variants (diesel, etc.)
  'JLDEH': { make: 'Jeep', model: 'Wrangler JL Diesel', yearStart: 2020, yearEnd: 2026 },
  'JLDEF': { make: 'Jeep', model: 'Wrangler JL Diesel', yearStart: 2020, yearEnd: 2026 },
  'JLU': { make: 'Jeep', model: 'Wrangler JL Unlimited', yearStart: 2018, yearEnd: 2026 },
  '392': { make: 'Jeep', model: 'Wrangler 392', yearStart: 2021, yearEnd: 2026 },
  
  // Gladiator (JT) variants
  'JTED': { make: 'Jeep', model: 'Gladiator Diesel', yearStart: 2021, yearEnd: 2026 },
  'JTEH': { make: 'Jeep', model: 'Gladiator', yearStart: 2020, yearEnd: 2026 },
};

// Year range patterns (order matters - most specific first)
const YEAR_PATTERNS = [
  { re: /[''](\d{2})\s*[-–]\s*['']?(\d{2})(?!\d)/g, type: '2digit' },   // '98-11, '80-96
  { re: /(\d{4})\s*[-–]\s*(\d{4})/g, type: '4digit' },                   // 2019-2023
  { re: /(\d{4})\s*[-–]\s*(\d{2})(?!\d)/g, type: 'mixed' },              // 2014-15, 2020-24
  { re: /(\d{4})\s*[-–]\s*(?:CURRENT|PRESENT|NEWER|NEW)/gi, type: 'open' },  // 2019-Current
  { re: /(\d{4})\s*\+/g, type: 'plus' },                                  // 2019+
  { re: /(\d{4})\s*(?:AND\s*(?:UP|NEWER)|UP)/gi, type: 'open' },         // 2019 and Up
  { re: /(?:^|[^0-9])(\d{4})(?:[^0-9]|$)/g, type: 'single' },            // Just 2019 (not part of larger number)
];

function parseDescription(desc) {
  if (!desc) return null;
  
  const result = {
    raw: desc,
    vehicles: [],
    yearStart: null,
    yearEnd: null,
    liftHeight: null,
    productType: null,
  };
  
  // Extract lift height - look for X" LIFT or X'' LIFT patterns
  // Must come before "LIFT" or "LEVELING" or "SPACER" to avoid grabbing years
  const liftPatterns = [
    /(\d+(?:\.\d+)?)\s*[''"""]\s*(?:LIFT|LEVELING|SPACER|COIL|SPRING|BLOCK|STRUT)/i,
    /(\d+(?:\.\d+)?)\s*(?:INCH|IN)\s*(?:LIFT|LEVELING)/i,
    /(\d+(?:\.\d+)?)[''"""]\s+(?:REAR|FRONT|F\/R|R\/F)/i,  // 2" REAR
    /(?:LIFT|LEVELING|RAISE).*?(\d+(?:\.\d+)?)\s*[''"""]/i,
  ];
  
  for (const lp of liftPatterns) {
    const liftMatch = desc.match(lp);
    if (liftMatch) {
      const val = parseFloat(liftMatch[1]);
      if (val > 0 && val <= 12) {  // Reasonable lift height range
        result.liftHeight = val;
        break;
      }
    }
  }
  
  // Check for Jeep generation codes FIRST (before other patterns)
  for (const [code, info] of Object.entries(JEEP_CODES)) {
    // Match code at word boundary (JK, JK2, JK4, TJ, etc.)
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
    re.lastIndex = 0;  // Reset regex state
    const match = re.exec(desc);
    if (match) {
      if (type === '2digit') {
        // Convert 2-digit years: '98 → 1998, '11 → 2011
        let y1 = parseInt(match[1]);
        let y2 = parseInt(match[2]);
        y1 = y1 >= 50 ? 1900 + y1 : 2000 + y1;
        y2 = y2 >= 50 ? 1900 + y2 : 2000 + y2;
        result.yearStart = y1;
        result.yearEnd = y2;
      } else if (type === 'mixed') {
        // 2014-15 → 2014-2015, 2020-24 → 2020-2024
        const y1 = parseInt(match[1]);
        let y2 = parseInt(match[2]);
        const century = Math.floor(y1 / 100) * 100; // 2000
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
        // Only use if it looks like a model year (1980-2030 range)
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
      // Add alternate vehicle if exists (e.g., GM = Chevy + GMC)
      if (mp.altMake) {
        result.vehicles.push({
          make: mp.altMake,
          model: mp.altModel,
        });
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

async function analyzeSuspension() {
  await sftp.connect({
    host: 'sftp.wheelpros.com',
    port: 22,
    username: 'Warehouse1',
    password: process.env.WHEELPROS_SFTP_PASS || 'Websters1!'
  });
  
  console.log('Downloading Accessory_TechGuide.csv...');
  const csv = await sftp.get('/TechFeed/ACCESSORIES/Accessory_TechGuide.csv');
  const rows = parse(csv, { columns: true, skip_empty_lines: true });
  
  // Filter to suspension parts only
  const suspensionParts = rows.filter(r => {
    const str = JSON.stringify(r).toLowerCase();
    return str.includes('lift') || str.includes('suspension') || str.includes('leveling');
  });
  
  console.log(`\nTotal suspension parts: ${suspensionParts.length}`);
  
  // Parse all descriptions
  const parsed = suspensionParts.map(r => ({
    sku: r.sku,
    desc: r.product_desc,
    brand: r.brand_desc,
    ...parseDescription(r.product_desc),
  }));
  
  // Stats
  const withVehicle = parsed.filter(p => p.vehicles?.length > 0);
  const withYears = parsed.filter(p => p.yearStart);
  const withBoth = parsed.filter(p => p.vehicles?.length > 0 && p.yearStart);
  const withLift = parsed.filter(p => p.liftHeight);
  
  console.log(`\n=== Parsing Results ===`);
  console.log(`Total suspension parts: ${parsed.length}`);
  console.log(`Parts with vehicle match: ${withVehicle.length} (${(100*withVehicle.length/parsed.length).toFixed(1)}%)`);
  console.log(`Parts with year range: ${withYears.length} (${(100*withYears.length/parsed.length).toFixed(1)}%)`);
  console.log(`Parts with BOTH (usable): ${withBoth.length} (${(100*withBoth.length/parsed.length).toFixed(1)}%)`);
  console.log(`Parts with lift height: ${withLift.length} (${(100*withLift.length/parsed.length).toFixed(1)}%)`);
  
  // Sample successful parses
  console.log(`\n=== Sample Parsed (with YMM) ===`);
  withBoth.slice(0, 15).forEach(p => {
    console.log(`\n${p.sku}: "${p.desc}"`);
    console.log(`  Vehicles: ${p.vehicles.map(v => `${v.make} ${v.model}`).join(', ')}`);
    console.log(`  Years: ${p.yearStart}-${p.yearEnd}`);
    if (p.liftHeight) console.log(`  Lift: ${p.liftHeight}"`);
  });
  
  // Sample failures - categorize them
  const failed = parsed.filter(p => p.vehicles?.length === 0);
  const failedWithYears = failed.filter(p => p.yearStart);
  const failedNoYears = failed.filter(p => !p.yearStart);
  
  console.log(`\n=== Failed to Parse: ${failed.length} parts ===`);
  console.log(`  With years but no vehicle: ${failedWithYears.length}`);
  console.log(`  No years and no vehicle: ${failedNoYears.length}`);
  
  console.log(`\n=== Failed WITH years (fixable) ===`);
  failedWithYears.slice(0, 15).forEach(p => {
    console.log(`${p.sku}: "${p.desc}" [${p.yearStart}-${p.yearEnd}]`);
  });
  
  console.log(`\n=== Failed NO years (universal parts?) ===`);
  failedNoYears.slice(0, 10).forEach(p => {
    console.log(`${p.sku}: "${p.desc}"`);
  });
  
  // Vehicle coverage
  console.log(`\n=== Vehicle Coverage ===`);
  const vehicleCounts = {};
  withVehicle.forEach(p => {
    p.vehicles.forEach(v => {
      const key = `${v.make} ${v.model}`;
      vehicleCounts[key] = (vehicleCounts[key] || 0) + 1;
    });
  });
  Object.entries(vehicleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([v, c]) => console.log(`  ${v}: ${c}`));
  
  await sftp.end();
}

analyzeSuspension().catch(e => console.error(e.message));
