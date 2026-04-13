/**
 * Test Configuration Reader
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { vehicleFitmentConfigurations } from "../../src/lib/fitment-db/schema";
import { eq, and } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

interface TestCase {
  name: string;
  year: number;
  make: string;
  model: string;
  expectedDiameters: number[];
  shouldShowStep: boolean;
}

const TEST_CASES: TestCase[] = [
  // SEEDED VEHICLES - should use config table
  {
    name: "2022 Cadillac Escalade",
    year: 2022,
    make: "cadillac",
    model: "escalade",
    expectedDiameters: [22, 24],
    shouldShowStep: true,
  },
  {
    name: "2022 GMC Yukon",
    year: 2022,
    make: "gmc",
    model: "yukon",
    expectedDiameters: [20, 22, 24],
    shouldShowStep: true,
  },
  {
    name: "2022 Ford Expedition",
    year: 2022,
    make: "ford",
    model: "expedition",
    expectedDiameters: [20, 22],
    shouldShowStep: true,
  },
  {
    name: "2022 Ram 1500",
    year: 2022,
    make: "ram",
    model: "1500",
    expectedDiameters: [20, 22],
    shouldShowStep: true,
  },
  // NON-SEEDED VEHICLES - should fall back to legacy
  {
    name: "2022 Toyota Camry",
    year: 2022,
    make: "toyota",
    model: "camry",
    expectedDiameters: [], // No config rows
    shouldShowStep: false, // Should skip due to low confidence fallback
  },
  {
    name: "2022 Honda Civic",
    year: 2022,
    make: "honda",
    model: "civic",
    expectedDiameters: [], // No config rows
    shouldShowStep: false,
  },
];

async function testVehicle(tc: TestCase) {
  const makeKey = tc.make.toLowerCase();
  const modelKey = tc.model.toLowerCase().replace(/\s+/g, "-");
  
  const configs = await db
    .select()
    .from(vehicleFitmentConfigurations)
    .where(
      and(
        eq(vehicleFitmentConfigurations.year, tc.year),
        eq(vehicleFitmentConfigurations.makeKey, makeKey),
        eq(vehicleFitmentConfigurations.modelKey, modelKey)
      )
    );
  
  const diameters = [...new Set(configs.map(c => c.wheelDiameter))].sort((a, b) => a - b);
  const hasConfigs = configs.length > 0;
  const confidence = configs[0]?.sourceConfidence || "none";
  
  const diameterMatch = JSON.stringify(diameters) === JSON.stringify(tc.expectedDiameters);
  const passed = diameterMatch;
  
  console.log(`\n${passed ? "✅" : "❌"} ${tc.name}`);
  console.log(`   Config rows: ${configs.length}`);
  console.log(`   Diameters: ${diameters.length > 0 ? diameters.join(", ") : "(none)"}`);
  console.log(`   Expected: ${tc.expectedDiameters.length > 0 ? tc.expectedDiameters.join(", ") : "(none)"}`);
  console.log(`   Confidence: ${confidence}`);
  console.log(`   Has multiple: ${diameters.length > 1}`);
  
  return passed;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("CONFIGURATION READER TEST");
  console.log("═══════════════════════════════════════════════════════════════");
  
  let passed = 0;
  let failed = 0;
  
  for (const tc of TEST_CASES) {
    const result = await testVehicle(tc);
    if (result) passed++;
    else failed++;
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════════");
  
  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
