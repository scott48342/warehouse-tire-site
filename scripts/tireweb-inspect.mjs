/**
 * TireWeb Response Inspector
 * 
 * Inspect what fields TireWeb actually returns for a specific tire/size.
 * Usage: node scripts/tireweb-inspect.mjs <size> [productId]
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ACCESS_KEY = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
const GROUP_TOKEN = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;

if (!ACCESS_KEY || !GROUP_TOKEN) {
  console.error('Missing TIREWEB credentials');
  process.exit(1);
}

const PRODUCTS_SERVICE_URL = "http://ws.tirewire.com/connectionscenter/productsservice.asmx";

// Default connections - check all three
const CONNECTIONS = [
  { provider: "tireweb_atd", connectionId: 488677 },
  { provider: "tireweb_ntw", connectionId: 488546 },
  { provider: "tireweb_usautoforce", connectionId: 488548 },
];

function buildGetTiresRequest(connectionId, tireSize, detailLevel = 10) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${ACCESS_KEY}</prod:AccessKey>
        <prod:GroupToken>${GROUP_TOKEN}</prod:GroupToken>
        <prod:ConnectionID>${connectionId}</prod:ConnectionID>
        <prod:TireSize>${tireSize}</prod:TireSize>
        <prod:DetailLevel>${detailLevel}</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;
}

async function callApi(body) {
  const res = await fetch(PRODUCTS_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      "SOAPAction": "http://ws.tirewire.com/connectionscenter/productsservice/GetTires",
    },
    body,
  });
  return res.text();
}

function extractTireXml(xml) {
  const tires = [];
  const matches = xml.matchAll(/<Tire>([\s\S]*?)<\/Tire>/g);
  for (const m of matches) {
    tires.push(m[1]);
  }
  return tires;
}

function extractField(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : null;
}

// List of all fields we care about
const SPEC_FIELDS = [
  'ID', 'ProductCode', 'ClientProductCode', 'Name', 'Make', 'MakeID',
  'Pattern', 'PatternID', 'Description', 'ImageURL',
  'Width', 'AspectRatio', 'Rim', 'Weight',
  'SpeedRating', 'LoadRating', 'PlyRating', 'LoadRange',
  'UTQG', 'Sidewall', 'TreadDepth', 'Warranty',
  'Features', 'Benefits',
  'BuyPrice', 'SellPrice', 'Quantity', 'QuantitySecondary',
  // Additional potential fields
  'Category', 'SubCategory', 'TireCategory', 'TreadCategory',
  'SeasonType', 'PerformanceType', 'TerrainType',
  'OverallDiameter', 'TreadWidth', 'SectionWidth',
  'MaxLoad', 'MaxPressure', 'RunFlat',
  'SupplierSystemID', 'SupplierProductCode',
];

async function main() {
  const size = process.argv[2] || '2256517'; // Default: 225/65R17
  const targetProductId = process.argv[3] || null;
  
  console.log(`\n=== TireWeb Response Inspector ===`);
  console.log(`Size: ${size}`);
  if (targetProductId) console.log(`Looking for Product ID: ${targetProductId}`);
  console.log();
  
  for (const conn of CONNECTIONS) {
    console.log(`\n--- ${conn.provider} (ID: ${conn.connectionId}) ---\n`);
    
    const body = buildGetTiresRequest(conn.connectionId, size, 10);
    const xml = await callApi(body);
    
    // Check for errors
    const errorCode = extractField(xml, 'ErrorCode');
    const errorMsg = extractField(xml, 'ErrorMessage');
    if (errorCode && errorCode !== '0') {
      console.log(`ERROR ${errorCode}: ${errorMsg}`);
      continue;
    }
    
    const tireXmls = extractTireXml(xml);
    console.log(`Found ${tireXmls.length} tires\n`);
    
    // Find target tire or show first few
    let tiresToShow = [];
    if (targetProductId) {
      for (const t of tireXmls) {
        const id = extractField(t, 'ID');
        const productCode = extractField(t, 'ProductCode');
        if (id === targetProductId || productCode === targetProductId) {
          tiresToShow.push(t);
          break;
        }
      }
      if (tiresToShow.length === 0) {
        console.log(`Product ${targetProductId} not found. Showing first tire instead.`);
        tiresToShow = tireXmls.slice(0, 1);
      }
    } else {
      tiresToShow = tireXmls.slice(0, 2); // Show first 2
    }
    
    for (const tireXml of tiresToShow) {
      console.log('='.repeat(60));
      
      // Extract all fields
      const fields = {};
      for (const field of SPEC_FIELDS) {
        const val = extractField(tireXml, field);
        if (val !== null) {
          fields[field] = val;
        }
      }
      
      // Show key identification
      console.log(`ID: ${fields.ID || 'N/A'}`);
      console.log(`ProductCode: ${fields.ProductCode || 'N/A'}`);
      console.log(`Make: ${fields.Make || 'N/A'}`);
      console.log(`Pattern: ${fields.Pattern || 'N/A'}`);
      console.log(`PatternID: ${fields.PatternID || 'N/A'}`);
      console.log(`Name: ${fields.Name || 'N/A'}`);
      console.log();
      
      // Spec fields we care about
      console.log('--- SPECS ---');
      console.log(`UTQG: ${fields.UTQG || '(empty)'}`);
      console.log(`Warranty: ${fields.Warranty || '(empty)'}`);
      console.log(`TreadDepth: ${fields.TreadDepth || '(empty)'}`);
      console.log(`LoadRange: ${fields.LoadRange || '(empty)'}`);
      console.log(`SpeedRating: ${fields.SpeedRating || '(empty)'}`);
      console.log(`LoadRating: ${fields.LoadRating || '(empty)'}`);
      console.log(`Sidewall: ${fields.Sidewall || '(empty)'}`);
      console.log(`Weight: ${fields.Weight || '(empty)'}`);
      console.log();
      
      // Additional potential fields
      console.log('--- CATEGORY FIELDS ---');
      console.log(`Category: ${fields.Category || '(not present)'}`);
      console.log(`SubCategory: ${fields.SubCategory || '(not present)'}`);
      console.log(`TireCategory: ${fields.TireCategory || '(not present)'}`);
      console.log(`TreadCategory: ${fields.TreadCategory || '(not present)'}`);
      console.log(`SeasonType: ${fields.SeasonType || '(not present)'}`);
      console.log(`PerformanceType: ${fields.PerformanceType || '(not present)'}`);
      console.log(`TerrainType: ${fields.TerrainType || '(not present)'}`);
      console.log();
      
      console.log('--- FEATURES/BENEFITS ---');
      console.log(`Features: ${fields.Features?.slice(0, 200) || '(empty)'}`);
      console.log(`Benefits: ${fields.Benefits?.slice(0, 200) || '(empty)'}`);
      console.log(`Description: ${fields.Description?.slice(0, 200) || '(empty)'}`);
      console.log();
      
      // Show raw XML for one tire for debugging
      if (process.argv.includes('--raw')) {
        console.log('--- RAW XML ---');
        console.log(tireXml);
        console.log();
      }
      
      // Show ALL fields present in the XML
      if (process.argv.includes('--all')) {
        console.log('--- ALL FIELDS IN XML ---');
        const allFields = tireXml.matchAll(/<([A-Za-z]+)>([^<]*)<\/\1>/g);
        for (const m of allFields) {
          console.log(`${m[1]}: ${m[2].slice(0, 100)}`);
        }
        console.log();
      }
    }
    
    // Summary of what's populated across all tires
    console.log('\n=== FIELD POPULATION SUMMARY ===');
    const fieldCounts = {};
    const uniqueMakes = new Set();
    for (const t of tireXmls) {
      const make = extractField(t, 'Make');
      if (make) uniqueMakes.add(make);
      for (const field of SPEC_FIELDS) {
        const val = extractField(t, field);
        if (val) {
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        }
      }
    }
    
    const total = tireXmls.length;
    for (const field of ['UTQG', 'Warranty', 'TreadDepth', 'Category', 'TreadCategory', 'Features', 'Benefits']) {
      const count = fieldCounts[field] || 0;
      const pct = total > 0 ? Math.round(100 * count / total) : 0;
      console.log(`${field}: ${count}/${total} (${pct}%)`);
    }
    
    console.log(`\n=== UNIQUE MAKES (${uniqueMakes.size}) ===`);
    console.log([...uniqueMakes].sort().join(', '));
  }
}

main().catch(console.error);
