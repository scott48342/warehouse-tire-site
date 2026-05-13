#!/usr/bin/env node
/**
 * Production Smoke Test for tire-sizes API
 */

const BASE_URL = "https://shop.warehousetiredirect.com";

const testCases = [
  // F-150 Lightning
  { year: 2022, make: "Ford", model: "F-150 Lightning", trim: "Pro", expected: ["275/65R18"] },
  { year: 2023, make: "Ford", model: "F-150 Lightning", trim: "Lariat", expected: ["275/60R20"] },
  // Silverado 2500 HD
  { year: 2024, make: "Chevrolet", model: "Silverado 2500 HD", trim: "LT", expected: null },
  // GMC Envoy (fixed)
  { year: 2006, make: "GMC", model: "Envoy", trim: "Denali", expected: ["255/55R18"] },
  { year: 2007, make: "GMC", model: "Envoy", trim: "SLE (17\")", expected: ["245/65R17"] },
  // Pontiac Firebird (fixed)
  { year: 1997, make: "Pontiac", model: "Firebird", trim: "Trans Am", expected: ["P275/40ZR17", "P305/35ZR17"] },
  { year: 1998, make: "Pontiac", model: "Firebird", trim: "Firehawk", expected: ["P275/40ZR17", "P305/35ZR17"] },
  // Cadillac Escalade Base (has valid sizes)
  { year: 2007, make: "Cadillac", model: "Escalade", trim: "Base", expected: ["265/65R18"] },
  { year: 2008, make: "Cadillac", model: "Escalade", trim: "Base", expected: ["265/65R18"] },
  // Tacoma
  { year: 2024, make: "Toyota", model: "Tacoma", trim: "TRD Off-Road", expected: null },
  // Corvette
  { year: 2024, make: "Chevrolet", model: "Corvette", trim: "Stingray", expected: null },
];

async function testVehicle(tc) {
  const params = new URLSearchParams({
    year: tc.year.toString(),
    make: tc.make,
    model: tc.model,
    modification: tc.trim || "",
    trim: tc.trim || "",
  });
  
  const url = `${BASE_URL}/api/vehicles/tire-sizes?${params}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    const tireSizes = data.tireSizes || [];
    const source = data.source || "unknown";
    
    // Check if expected sizes are present (if specified)
    let expectedMatch = true;
    if (tc.expected) {
      expectedMatch = tc.expected.every(size => tireSizes.includes(size));
    }
    
    return {
      label: `${tc.year} ${tc.make} ${tc.model} ${tc.trim || ""}`.trim(),
      status: res.status,
      tireSizes,
      source,
      expected: tc.expected,
      expectedMatch,
      pass: res.status === 200 && tireSizes.length > 0 && expectedMatch,
    };
  } catch (err) {
    return {
      label: `${tc.year} ${tc.make} ${tc.model} ${tc.trim || ""}`.trim(),
      status: 0,
      error: err.message,
      pass: false,
    };
  }
}

async function run() {
  console.log(`\n🔍 Production Smoke Test: ${BASE_URL}\n`);
  console.log("═══════════════════════════════════════════════════════════════");

  let passCount = 0;
  let failCount = 0;

  for (const tc of testCases) {
    const result = await testVehicle(tc);
    
    const icon = result.pass ? "✅" : "❌";
    console.log(`${icon} ${result.label}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Sizes: ${result.tireSizes?.join(", ") || "(none)"}`);
    console.log(`   Source: ${result.source || "N/A"}`);
    if (result.expected) {
      console.log(`   Expected: ${result.expected.join(", ")}`);
      console.log(`   Match: ${result.expectedMatch ? "✓" : "✗"}`);
    }
    if (result.error) console.log(`   Error: ${result.error}`);
    console.log("");
    
    if (result.pass) passCount++;
    else failCount++;
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed\n`);
  
  process.exit(failCount > 0 ? 1 : 0);
}

run();
