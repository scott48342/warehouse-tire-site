#!/usr/bin/env node
/**
 * Test tire-sizes API for problem vehicles
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

const testVehicles = [
  { year: 2022, make: "Ford", model: "F-150 Lightning", trim: "Pro" },
  { year: 2023, make: "Ford", model: "F-150 Lightning", trim: "Lariat" },
  { year: 2024, make: "Ford", model: "F-150", trim: "XLT" },
  { year: 2022, make: "Chevrolet", model: "Silverado 2500 HD", trim: "LT" },
  { year: 2024, make: "Toyota", model: "Tacoma", trim: "TRD Off-Road" },
  { year: 2024, make: "Chevrolet", model: "Corvette", trim: "Stingray" },
];

async function testVehicle(vehicle) {
  const params = new URLSearchParams({
    year: vehicle.year.toString(),
    make: vehicle.make,
    model: vehicle.model,
    modification: vehicle.trim || "",
    trim: vehicle.trim || "",
  });
  
  const url = `${BASE_URL}/api/vehicles/tire-sizes?${params}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    return {
      vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}`.trim(),
      status: res.status,
      tireSizes: data.tireSizes || [],
      source: data.source,
      error: data.error || null,
    };
  } catch (err) {
    return {
      vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}`.trim(),
      status: 0,
      tireSizes: [],
      error: err.message,
    };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log(`Testing tire-sizes API at ${BASE_URL}\n`);
  console.log("═══════════════════════════════════════════════════════════════");
  
  for (const vehicle of testVehicles) {
    await sleep(500); // Small delay between requests
    const result = await testVehicle(vehicle);
    
    const statusIcon = result.status === 200 && result.tireSizes.length > 0 ? "✅" : "❌";
    console.log(`${statusIcon} ${result.vehicle}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Tire sizes: ${result.tireSizes.length > 0 ? result.tireSizes.join(", ") : "(none)"}`);
    console.log(`   Source: ${result.source || "N/A"}`);
    if (result.error) console.log(`   Error: ${result.error}`);
    console.log("");
  }
  
  console.log("═══════════════════════════════════════════════════════════════");
}

run();
