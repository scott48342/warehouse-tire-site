/**
 * Test script to check if TireWeb returns review data
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=][^=]*)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  });
} catch (e) {}

const PRODUCTS_SERVICE_URL = "https://ws.tirewire.com/connectionscenter/productsservice.asmx";

const accessKey = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
const groupToken = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;

if (!accessKey || !groupToken) {
  console.error("Missing credentials");
  process.exit(1);
}

// REAL connection IDs from database
const TEST_CONNECTIONS = [
  { id: 488677, name: "ATD" },
  { id: 488546, name: "NTW" },
  { id: 488548, name: "US AutoForce" },
];

const testSize = "2256016"; // 225/60R16

async function searchTires(connectionId, connectionName) {
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${accessKey}</prod:AccessKey>
        <prod:GroupToken>${groupToken}</prod:GroupToken>
        <prod:ConnectionID>${connectionId}</prod:ConnectionID>
        <prod:TireSize>${testSize}</prod:TireSize>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

  console.log(`\n─── Testing: ${connectionName} (ID: ${connectionId}) ───`);

  try {
    const res = await fetch(PRODUCTS_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        "SOAPAction": "http://ws.tirewire.com/connectionscenter/productsservice/GetTires",
      },
      body: soap,
    });

    const xml = await res.text();
    
    const faultMatch = xml.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
    if (faultMatch) {
      console.log(`❌ Error: ${faultMatch[1].substring(0, 100)}`);
      return null;
    }

    const tireMatches = [...xml.matchAll(/<Tire>([\s\S]*?)<\/Tire>/g)];
    console.log(`✓ Found ${tireMatches.length} tires`);

    if (tireMatches.length === 0) return null;

    // Extract ALL field names
    const allFields = new Set();
    const sampleTire = tireMatches[0][1];
    
    const fieldMatches = sampleTire.matchAll(/<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g);
    for (const fm of fieldMatches) {
      allFields.add(fm[1]);
    }

    // Look for review-related fields
    const reviewFields = [...allFields].filter(f => 
      /review/i.test(f) || 
      (/rating/i.test(f) && !/load|speed|ply/i.test(f))
    );

    return {
      tireCount: tireMatches.length,
      allFields: [...allFields].sort(),
      reviewFields,
      sampleXml: sampleTire.substring(0, 2000)
    };

  } catch (err) {
    console.log(`❌ Failed: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("🔍 Testing TireWeb API for Review Data");
  console.log(`   Size: ${testSize}\n`);
  
  for (const conn of TEST_CONNECTIONS) {
    const result = await searchTires(conn.id, conn.name);
    
    if (result) {
      console.log(`   Total fields: ${result.allFields.length}`);
      
      if (result.reviewFields.length > 0) {
        console.log(`\n   ✅ REVIEW FIELDS FOUND: ${result.reviewFields.join(', ')}`);
      } else {
        console.log(`\n   ❌ No review fields in response`);
      }
      
      console.log(`\n   📋 ALL FIELDS:`);
      console.log(`   ${result.allFields.join(', ')}`);
      
      // Only need one successful test
      break;
    }
  }
}

main().catch(console.error);
