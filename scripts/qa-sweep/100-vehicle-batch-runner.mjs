/**
 * 100-Vehicle QA - Batch Runner
 * Runs in 4 batches of 25 with longer timeouts
 */

import postgres from "postgres";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync, readFileSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env.local") });

const connectionString = process.env.POSTGRES_URL;
const client = postgres(connectionString, { max: 3 });
const BASE_URL = process.env.BASE_URL || "https://shop.warehousetiredirect.com";

const batchNum = parseInt(process.argv[2] || "1");
const batchSize = 25;

console.log(`\n100-Vehicle QA - Batch ${batchNum}/4`);
console.log(`Base URL: ${BASE_URL}\n`);

// Fetch with longer timeout
async function fetchWithTimeout(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// Test a single vehicle
async function testVehicle(vehicle, category) {
  const result = {
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.display_trim,
    category,
    passed: true,
    failures: [],
    wheels: 0,
    tires: 0,
  };

  // Test wheel fitment
  try {
    const wheelUrl = `${BASE_URL}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&trim=${encodeURIComponent(vehicle.display_trim)}`;
    const wheelRes = await fetchWithTimeout(wheelUrl);
    const wheelData = await wheelRes.json();
    const wheels = wheelData.results || wheelData.wheels || [];
    result.wheels = wheels.length;
    if (wheels.length === 0) {
      result.failures.push("NO_WHEELS");
    }
  } catch (err) {
    result.failures.push(`WHEEL_ERROR: ${err.message}`);
  }

  // Test tire search
  try {
    const tireUrl = `${BASE_URL}/api/tires/search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&trim=${encodeURIComponent(vehicle.display_trim)}`;
    const tireRes = await fetchWithTimeout(tireUrl);
    const tireData = await tireRes.json();
    const tires = tireData.results || tireData.tires || [];
    result.tires = tires.length;
    if (tires.length === 0 && !tireData.error) {
      result.failures.push("NO_TIRES");
    }
    if (tireData.error) {
      result.failures.push(`TIRE_ERROR: ${tireData.error}`);
    }
  } catch (err) {
    result.failures.push(`TIRE_FETCH_ERROR: ${err.message}`);
  }

  result.passed = result.wheels > 0 || result.tires > 0;
  return result;
}

async function main() {
  // Gather vehicles
  const normalVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE confidence_tag IN ('HIGH', 'MEDIUM')
      AND bolt_pattern IS NOT NULL
      AND make IN ('Toyota', 'Honda', 'Ford', 'Chevrolet', 'Hyundai', 'Kia', 'Nissan', 'Mazda', 'Subaru', 'Volkswagen')
      AND year BETWEEN 2015 AND 2024
      AND display_trim NOT LIKE '%,%'
    ORDER BY RANDOM() LIMIT 35
  `;

  const truckSuvVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE confidence_tag IN ('HIGH', 'MEDIUM')
      AND bolt_pattern IS NOT NULL
      AND (model ILIKE '%F-150%' OR model ILIKE '%Silverado%' OR model ILIKE '%Tacoma%' 
        OR model ILIKE '%4Runner%' OR model ILIKE '%Explorer%' OR model ILIKE '%Wrangler%')
      AND year BETWEEN 2018 AND 2026
    ORDER BY RANDOM() LIMIT 15
  `;

  const staggeredVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL
      AND source = 'merged-staggered'
      AND year = 2018
    ORDER BY RANDOM() LIMIT 15
  `;

  const hdVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL
      AND (model ILIKE '%2500%' OR model ILIKE '%3500%' OR model ILIKE '%Super Duty%')
      AND year BETWEEN 2018 AND 2026
    ORDER BY RANDOM() LIMIT 10
  `;

  const evVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL
      AND (make = 'Tesla' OR model ILIKE '%Electric%' OR model ILIKE '%Mach-E%' OR model ILIKE '%Lightning%')
      AND year BETWEEN 2018 AND 2026
    ORDER BY RANDOM() LIMIT 10
  `;

  const liftedVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL
      AND (model ILIKE '%Wrangler%' OR model ILIKE '%Gladiator%' OR model ILIKE '%Bronco%' OR model ILIKE '%Raptor%')
      AND year BETWEEN 2018 AND 2026
    ORDER BY RANDOM() LIMIT 10
  `;

  const olderVehicles = await client`
    SELECT * FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL
      AND year BETWEEN 2000 AND 2014
    ORDER BY RANDOM() LIMIT 5
  `;

  // Combine and tag
  const allVehicles = [
    ...normalVehicles.map(v => ({ ...v, category: 'normal' })),
    ...truckSuvVehicles.map(v => ({ ...v, category: 'truck_suv' })),
    ...staggeredVehicles.map(v => ({ ...v, category: 'staggered' })),
    ...hdVehicles.map(v => ({ ...v, category: 'hd' })),
    ...evVehicles.map(v => ({ ...v, category: 'ev' })),
    ...liftedVehicles.map(v => ({ ...v, category: 'lifted' })),
    ...olderVehicles.map(v => ({ ...v, category: 'older' })),
  ];

  // Get batch slice
  const start = (batchNum - 1) * batchSize;
  const end = Math.min(start + batchSize, allVehicles.length);
  const batchVehicles = allVehicles.slice(start, end);

  console.log(`Testing vehicles ${start + 1}-${end} of ${allVehicles.length}\n`);

  const results = [];
  for (let i = 0; i < batchVehicles.length; i++) {
    const v = batchVehicles[i];
    const label = `${v.year} ${v.make} ${v.model} ${v.display_trim || ''}`.trim();
    process.stdout.write(`  ${start + i + 1}. ${label.substring(0, 40).padEnd(40)} `);
    
    const result = await testVehicle(v, v.category);
    results.push(result);
    
    console.log(result.passed ? '✅' : `❌ ${result.failures.join(', ')}`);
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Batch ${batchNum}: ${passed}/${results.length} passed (${(passed/results.length*100).toFixed(1)}%)`);
  console.log(`${'─'.repeat(60)}\n`);

  // Save results
  const outPath = join(__dirname, `results-100v-batch${batchNum}-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify({ batchNum, results, passed, failed }, null, 2));
  console.log(`Results saved: ${outPath}`);

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
