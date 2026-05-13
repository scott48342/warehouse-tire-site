#!/usr/bin/env node
/**
 * USAF Fitment Audit Script
 * 
 * Compares US AutoForce GetVehicleOptions data against our WTD database.
 * Does NOT modify runtime fitment - audit/enrichment only.
 * 
 * Usage:
 *   node scripts/usaf-fitment-audit.mjs                    # Audit all vehicles
 *   node scripts/usaf-fitment-audit.mjs --year=2024        # Audit specific year
 *   node scripts/usaf-fitment-audit.mjs --make=Ford        # Audit specific make
 *   node scripts/usaf-fitment-audit.mjs --sample=50        # Random sample
 *   node scripts/usaf-fitment-audit.mjs --export           # Export USAF data to JSON
 * 
 * Output:
 *   scripts/usaf-audit-results/YYYY-MM-DD-HHmmss.json
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

// ============================================================================
// SOAP CLIENT (inline to avoid ESM import issues)
// ============================================================================

const API_URL = "https://services.usautoforce.com/integrationservice.asmx";
const SOAP_NAMESPACE = "https://services.usautoforce.com";

function getCredentials() {
  // Always use production credentials for audit
  // Local .env.local has test creds, but audit needs production
  // Set USAF_AUDIT_USE_ENV=1 to override with env vars
  if (process.env.USAF_AUDIT_USE_ENV) {
    return {
      username: process.env.USAUTOFORCE_USERNAME,
      password: process.env.USAUTOFORCE_PASSWORD,
    };
  }
  
  // Production credentials for audit
  return {
    username: "warehousetire",
    password: "!-C02X!l7Kpehwx",
  };
}

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSoapEnvelope(method, body) {
  const creds = getCredentials();
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <Authentication xmlns="${SOAP_NAMESPACE}">
      <User>${escapeXml(creds.username)}</User>
      <Password>${escapeXml(creds.password)}</Password>
    </Authentication>
  </soap:Header>
  <soap:Body>
    <${method} xmlns="${SOAP_NAMESPACE}">
      ${body}
    </${method}>
  </soap:Body>
</soap:Envelope>`;
}

async function callSoapApi(soapAction, envelope) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `${SOAP_NAMESPACE}/${soapAction}`,
    },
    body: envelope,
  });
  
  if (!response.ok) {
    throw new Error(`SOAP API error: ${response.status} ${response.statusText}`);
  }
  
  return response.text();
}

async function getVehicleYears() {
  const envelope = buildSoapEnvelope("GetVehicleYears", "");
  const response = await callSoapApi("GetVehicleYears", envelope);
  const yearMatches = response.matchAll(/<int>(\d{4})<\/int>/g);
  return Array.from(yearMatches, m => parseInt(m[1])).sort((a, b) => b - a);
}

async function getVehicleMakes(year) {
  const body = `<year>${year}</year>`;
  const envelope = buildSoapEnvelope("GetVehicleMakes", body);
  const response = await callSoapApi("GetVehicleMakes", envelope);
  const makeMatches = response.matchAll(/<string>([^<]+)<\/string>/g);
  return Array.from(makeMatches, m => m[1]).sort();
}

async function getVehicleModels(year, make) {
  const body = `<year>${year}</year>
    <make>${escapeXml(make)}</make>`;
  const envelope = buildSoapEnvelope("GetVehicleModels", body);
  const response = await callSoapApi("GetVehicleModels", envelope);
  const modelMatches = response.matchAll(/<string>([^<]+)<\/string>/g);
  return Array.from(modelMatches, m => m[1]).sort();
}

async function getVehicleOptions(year, make, model) {
  const body = `<year>${year}</year>
    <make>${escapeXml(make)}</make>
    <model>${escapeXml(model)}</model>`;
  const envelope = buildSoapEnvelope("GetVehicleOptions", body);
  const response = await callSoapApi("GetVehicleOptions", envelope);
  // USAF returns tire sizes in <TireSize> elements, not <string>
  const sizeMatches = response.matchAll(/<TireSize>([^<]+)<\/TireSize>/g);
  return [...new Set(Array.from(sizeMatches, m => m[1]))];
}

// ============================================================================
// TIRE SIZE NORMALIZATION
// ============================================================================

function normalizeTireSize(size) {
  if (!size) return null;
  
  // Handle LT prefix, C/D/E suffix
  let s = size.toUpperCase().trim();
  
  // Extract just width/aspect/rim, ignore load rating suffix
  // "LT315/70R17/C" -> "315/70R17"
  // "245/70R17" -> "245/70R17"
  // "37x12.50R17LT/C" -> "37x12.50R17" (flotation)
  
  // Standard: "P?LT?(\d{3})/(\d{2,3})R?(\d{2})"
  const stdMatch = s.match(/^P?(LT)?(\d{3})\/(\d{2,3})R?(\d{2})/i);
  if (stdMatch) {
    const [, lt, width, aspect, rim] = stdMatch;
    return `${lt || ""}${width}/${aspect}R${rim}`.toUpperCase();
  }
  
  // Flotation: "(\d{2,3})x(\d{1,2}\.?\d*)R?(\d{2})"
  const flotMatch = s.match(/^(\d{2,3})x(\d{1,2}\.?\d*)R?(\d{2})/i);
  if (flotMatch) {
    const [, diameter, width, rim] = flotMatch;
    return `${diameter}x${width}R${rim}`.toUpperCase();
  }
  
  return s;
}

function sizesMatch(size1, size2) {
  const n1 = normalizeTireSize(size1);
  const n2 = normalizeTireSize(size2);
  if (!n1 || !n2) return false;
  return n1 === n2;
}

// ============================================================================
// DATABASE QUERIES
// ============================================================================

async function getWTDVehicles(filters = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;
  
  if (filters.year) {
    conditions.push(`year = $${paramIdx++}`);
    params.push(parseInt(filters.year));
  }
  if (filters.make) {
    conditions.push(`LOWER(make) = LOWER($${paramIdx++})`);
    params.push(filters.make);
  }
  if (filters.model) {
    conditions.push(`LOWER(model) = LOWER($${paramIdx++})`);
    params.push(filters.model);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const query = `
    SELECT DISTINCT year, make, model
    FROM vehicle_fitments
    ${whereClause}
    ORDER BY year DESC, make ASC, model ASC
  `;
  
  const result = await pool.query(query, params);
  return result.rows;
}

async function getWTDTireSizesForVehicle(year, make, model) {
  const query = `
    SELECT display_trim, oem_tire_sizes
    FROM vehicle_fitments
    WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
  `;
  
  const result = await pool.query(query, [parseInt(year), make, model]);
  
  const sizes = new Set();
  const trims = [];
  
  for (const row of result.rows) {
    if (row.display_trim) trims.push(row.display_trim);
    // oem_tire_sizes is a JSONB array of strings
    const tireSizes = row.oem_tire_sizes || [];
    for (const ts of tireSizes) {
      if (ts && typeof ts === 'string') {
        const normalized = normalizeTireSize(ts);
        if (normalized) sizes.add(normalized);
      }
    }
  }
  
  return {
    sizes: [...sizes].filter(Boolean),
    trims: trims.filter(Boolean),
  };
}

// ============================================================================
// AUDIT LOGIC
// ============================================================================

async function auditVehicle(year, make, model) {
  const result = {
    year,
    make,
    model,
    wtd: { sizes: [], trims: [] },
    usaf: { sizes: [] },
    comparison: {
      match: false,
      wtdOnly: [],
      usafOnly: [],
      common: [],
    },
    error: null,
  };
  
  try {
    // Get WTD data
    const wtdData = await getWTDTireSizesForVehicle(year, make, model);
    result.wtd = wtdData;
    
    // Get USAF data
    const usafSizes = await getVehicleOptions(year, make, model);
    result.usaf.sizes = usafSizes.map(normalizeTireSize).filter(Boolean);
    
    // Compare
    const wtdSet = new Set(result.wtd.sizes);
    const usafSet = new Set(result.usaf.sizes);
    
    result.comparison.common = [...wtdSet].filter(s => usafSet.has(s));
    result.comparison.wtdOnly = [...wtdSet].filter(s => !usafSet.has(s));
    result.comparison.usafOnly = [...usafSet].filter(s => !wtdSet.has(s));
    result.comparison.match = 
      result.comparison.wtdOnly.length === 0 && 
      result.comparison.usafOnly.length === 0 &&
      result.comparison.common.length > 0;
    
  } catch (error) {
    result.error = error.message;
  }
  
  return result;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  
  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    flags[key] = value || true;
  }
  
  console.log("🔍 USAF Fitment Audit");
  console.log("=" .repeat(60));
  
  // Verify credentials
  try {
    getCredentials();
    console.log("✅ USAF credentials found");
  } catch (e) {
    console.error("❌ " + e.message);
    process.exit(1);
  }
  
  // If --export, just dump USAF data
  if (flags.export) {
    console.log("\n📤 Exporting USAF vehicle data...");
    await exportUSAFData(flags.year);
    return;
  }
  
  // Get WTD vehicles to audit
  const wtdVehicles = await getWTDVehicles({
    year: flags.year,
    make: flags.make,
    model: flags.model,
  });
  
  console.log(`\n📊 Found ${wtdVehicles.length} vehicles in WTD database`);
  
  // Apply sample limit if specified
  let toAudit = wtdVehicles;
  if (flags.sample) {
    const sampleSize = parseInt(flags.sample);
    toAudit = wtdVehicles.sort(() => Math.random() - 0.5).slice(0, sampleSize);
    console.log(`📊 Sampling ${toAudit.length} vehicles`);
  }
  
  // Run audit
  const results = {
    timestamp: new Date().toISOString(),
    filters: flags,
    summary: {
      total: toAudit.length,
      matched: 0,
      partial: 0,
      wtdOnly: 0,
      usafOnly: 0,
      errors: 0,
    },
    vehicles: [],
  };
  
  let processed = 0;
  for (const v of toAudit) {
    const result = await auditVehicle(v.year, v.make, v.model);
    results.vehicles.push(result);
    
    // Update summary
    if (result.error) {
      results.summary.errors++;
    } else if (result.comparison.match) {
      results.summary.matched++;
    } else if (result.comparison.common.length > 0) {
      results.summary.partial++;
    } else if (result.usaf.sizes.length === 0) {
      results.summary.wtdOnly++;
    } else {
      results.summary.usafOnly++;
    }
    
    processed++;
    if (processed % 10 === 0) {
      process.stdout.write(`\r  Progress: ${processed}/${toAudit.length}`);
    }
    
    // Rate limit: 200ms between requests
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\r  Progress: ${processed}/${toAudit.length} ✅`);
  
  // Print summary
  console.log("\n" + "=" .repeat(60));
  console.log("📊 SUMMARY");
  console.log("=" .repeat(60));
  console.log(`  Total vehicles:     ${results.summary.total}`);
  console.log(`  ✅ Exact match:     ${results.summary.matched}`);
  console.log(`  ⚠️  Partial match:   ${results.summary.partial}`);
  console.log(`  📥 WTD only:        ${results.summary.wtdOnly} (not in USAF)`);
  console.log(`  📤 USAF only:       ${results.summary.usafOnly} (we're missing sizes)`);
  console.log(`  ❌ Errors:          ${results.summary.errors}`);
  
  // Show top discrepancies
  const discrepancies = results.vehicles
    .filter(v => v.comparison.usafOnly.length > 0 && !v.error)
    .sort((a, b) => b.comparison.usafOnly.length - a.comparison.usafOnly.length)
    .slice(0, 10);
  
  if (discrepancies.length > 0) {
    console.log("\n🔍 TOP DISCREPANCIES (USAF has sizes we're missing):");
    for (const d of discrepancies) {
      console.log(`  ${d.year} ${d.make} ${d.model}`);
      console.log(`    WTD: ${d.wtd.sizes.join(", ") || "(none)"}`);
      console.log(`    USAF missing: ${d.comparison.usafOnly.join(", ")}`);
    }
  }
  
  // Save results
  const outDir = path.join(process.cwd(), 'scripts/usaf-audit-results');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(outDir, `${timestamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outFile}`);
  
  await pool.end();
}

async function exportUSAFData(yearFilter) {
  const years = yearFilter ? [parseInt(yearFilter)] : await getVehicleYears();
  console.log(`📅 Years: ${years.slice(0, 5).join(", ")}${years.length > 5 ? ` ... (${years.length} total)` : ""}`);
  
  const data = { timestamp: new Date().toISOString(), vehicles: [] };
  
  for (const year of years.slice(0, 3)) { // Limit to 3 years for testing
    const makes = await getVehicleMakes(year);
    console.log(`  ${year}: ${makes.length} makes`);
    
    for (const make of makes.slice(0, 5)) { // Limit for testing
      const models = await getVehicleModels(year, make);
      
      for (const model of models) {
        const sizes = await getVehicleOptions(year, make, model);
        data.vehicles.push({ year, make, model, tireSizes: sizes });
        
        await new Promise(r => setTimeout(r, 150)); // Rate limit
      }
    }
  }
  
  const outDir = path.join(process.cwd(), 'scripts/usaf-audit-results');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const outFile = path.join(outDir, `usaf-export-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log(`\n💾 Export saved to: ${outFile}`);
}

main().catch(console.error);
