#!/usr/bin/env node
/**
 * Get tire by TireLibrary ID using GetTires endpoint
 * According to docs, GetTires can accept ID instead of TireSize
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PRODUCTS_SERVICE_URL = "http://ws.tirewire.com/connectionscenter/productsservice.asmx";

const accessKey = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
const groupToken = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;

const tireLibraryId = process.argv[2] || "256674"; // Hankook Kinergy ST H735
const connectionId = process.argv[3] || "488677"; // ATD

function buildRequest(id, connId) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${accessKey}</prod:AccessKey>
        <prod:GroupToken>${groupToken}</prod:GroupToken>
        <prod:ConnectionID>${connId}</prod:ConnectionID>
        <prod:ID>${id}</prod:ID>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;
}

async function main() {
  console.log(`Fetching TireLibrary ID ${tireLibraryId} from connection ${connectionId}`);
  console.log(`AccessKey: ${accessKey?.slice(0, 6)}...`);
  console.log();

  const body = buildRequest(tireLibraryId, connectionId);
  
  const res = await fetch(PRODUCTS_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      "SOAPAction": "http://ws.tirewire.com/connectionscenter/productsservice/GetTires",
    },
    body,
  });

  const xml = await res.text();
  
  // Extract key fields
  const extract = (tag) => {
    const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return match ? match[1].trim() : null;
  };
  
  console.log("=== Response ===");
  console.log(`Status: ${res.status}`);
  console.log(`ErrorCode: ${extract("ErrorCode")}`);
  console.log(`ErrorMessage: ${extract("ErrorMessage")}`);
  console.log();
  
  // Check for tire data
  const tireMatch = xml.match(/<Tire>([\s\S]*?)<\/Tire>/);
  if (tireMatch) {
    const t = tireMatch[1];
    const ex = (tag) => {
      const m = t.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].trim() : "(empty)";
    };
    
    console.log("=== Tire Found ===");
    console.log(`ID: ${ex("ID")}`);
    console.log(`Name: ${ex("Name")}`);
    console.log(`Make: ${ex("Make")}`);
    console.log(`Pattern: ${ex("Pattern")}`);
    console.log();
    console.log("=== Specs ===");
    console.log(`UTQG: ${ex("UTQG")}`);
    console.log(`Warranty: ${ex("Warranty")}`);
    console.log(`TreadDepth: ${ex("TreadDepth")}`);
    console.log(`Features: ${ex("Features")}`);
    console.log(`Benefits: ${ex("Benefits")}`);
    console.log(`SpeedRating: ${ex("SpeedRating")}`);
    console.log(`LoadRating: ${ex("LoadRating")}`);
    console.log();
    console.log("=== RAW XML ===");
    console.log(t.slice(0, 2000));
  } else {
    console.log("No tire found in response");
    console.log();
    console.log("=== Full Response (truncated) ===");
    console.log(xml.slice(0, 2000));
  }
}

main().catch(console.error);
