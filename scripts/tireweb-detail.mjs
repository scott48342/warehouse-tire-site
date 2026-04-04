/**
 * TireWeb GetTireByID Detail Endpoint Test
 * 
 * Test whether GetTireByID returns richer spec data than GetTires search.
 * Usage: node scripts/tireweb-detail.mjs <tireLibraryId>
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

function buildGetTireByIDRequest(id, getFullDetails = true, useAccessKey = false) {
  // Try both keys - AccessKey is for authentication, GroupToken is for connection grouping
  const key = useAccessKey ? ACCESS_KEY : GROUP_TOKEN;
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTireByID xmlns="http://ws.tirewire.com/connectionscenter/productsservice">
      <key>${key}</key>
      <id>${id}</id>
      <getFullDetails>${getFullDetails}</getFullDetails>
    </GetTireByID>
  </soap:Body>
</soap:Envelope>`;
}

async function callApi(body, soapAction) {
  const res = await fetch(PRODUCTS_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      "SOAPAction": soapAction,
    },
    body,
  });
  return res.text();
}

function extractField(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : null;
}

// All the detailed spec fields we want to check
const DETAIL_FIELDS = [
  'ID', 'ProductCode', 'Make', 'Pattern', 'PatternID', 'Name',
  'UTQG', 'Warranty', 'TreadDepth', 'Features', 'Benefits',
  'MeasuredOD', 'SectionWidth', 'RevsPerMile',
  'MaxLoadSingle', 'MaxLoadDual', 'MaxInflationPressure',
  'ApprovedRimWidth', 'MeasuringRimWidth',
  'Sidewall', 'LoadRange', 'LoadCapacity',
  'SpeedRating', 'LoadRating', 'PlyRating', 'Weight',
  'TireClasses', 'Description'
];

async function main() {
  const tireId = parseInt(process.argv[2]) || 287070; // Default: Michelin Primacy A/S from earlier test
  
  console.log(`\n=== TireWeb GetTireByID Test ===`);
  console.log(`TireLibrary ID: ${tireId}`);
  console.log(`getFullDetails: true`);
  console.log();
  
  // Test with getFullDetails = true, try AccessKey first
  console.log('Trying with AccessKey...');
  let body = buildGetTireByIDRequest(tireId, true, true);
  let xml = await callApi(body, "http://ws.tirewire.com/connectionscenter/productsservice/GetTireByID");
  
  // Check if AccessKey worked
  let errorCode = extractField(xml, 'ErrorCode');
  if (errorCode && errorCode !== '0') {
    console.log(`AccessKey failed (${errorCode}), trying GroupToken...`);
    body = buildGetTireByIDRequest(tireId, true, false);
    xml = await callApi(body, "http://ws.tirewire.com/connectionscenter/productsservice/GetTireByID");
  }
  
  // Check for errors (reuse errorCode from above)
  errorCode = extractField(xml, 'ErrorCode');
  const errorMsg = extractField(xml, 'ErrorMessage');
  if (errorCode && errorCode !== '0') {
    console.log(`ERROR ${errorCode}: ${errorMsg}`);
    console.log('\n--- Raw Response (first 2000 chars) ---');
    console.log(xml.slice(0, 2000));
    return;
  }
  
  // Check if we got a tire
  const tireXml = xml.match(/<Tire>([\s\S]*?)<\/Tire>/);
  if (!tireXml) {
    console.log('No tire found in response');
    console.log('\n--- Raw Response ---');
    console.log(xml.slice(0, 3000));
    return;
  }
  
  console.log('=== TIRE DETAILS ===\n');
  
  // Extract and display all detail fields
  const tire = tireXml[1];
  for (const field of DETAIL_FIELDS) {
    const value = extractField(tire, field);
    if (value && value !== '-1' && value !== '0') {
      console.log(`${field}: ${value.slice(0, 200)}`);
    } else if (['UTQG', 'Warranty', 'TreadDepth', 'Features', 'Benefits'].includes(field)) {
      // Always show these key fields
      console.log(`${field}: (empty/null)`);
    }
  }
  
  // Show all fields present in XML for comprehensive check
  if (process.argv.includes('--raw')) {
    console.log('\n--- ALL FIELDS IN RESPONSE ---');
    const allFields = tire.matchAll(/<([A-Za-z]+)>([^<]*)<\/\1>/g);
    for (const m of allFields) {
      if (m[2].trim()) {
        console.log(`${m[1]}: ${m[2].slice(0, 100)}`);
      }
    }
  }
  
  // Compare with getFullDetails = false
  console.log('\n\n=== COMPARISON: getFullDetails=false ===\n');
  const bodySimple = buildGetTireByIDRequest(tireId, false);
  const xmlSimple = await callApi(bodySimple, "http://ws.tirewire.com/connectionscenter/productsservice/GetTireByID");
  const tireXmlSimple = xmlSimple.match(/<Tire>([\s\S]*?)<\/Tire>/);
  
  if (tireXmlSimple) {
    const tireSimple = tireXmlSimple[1];
    for (const field of ['UTQG', 'Warranty', 'TreadDepth', 'Features', 'Benefits', 'MeasuredOD']) {
      const value = extractField(tireSimple, field);
      console.log(`${field}: ${value || '(empty/null)'}`);
    }
  }
}

main().catch(console.error);
