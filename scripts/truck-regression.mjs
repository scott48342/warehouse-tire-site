/**
 * Truck Regression Tests for Universal Fitment Resolver
 * Tests HD trucks: Silverado, Sierra, Ram, F-Series
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

const BASE_URL = process.env.BASE_URL || "https://shop.warehousetiredirect.com";

async function testResolver(year, make, model, trim = null) {
  const params = new URLSearchParams({ year, make, model });
  if (trim) params.append("trim", trim);
  
  try {
    const resp = await fetch(`${BASE_URL}/api/vehicles/fitment?${params}`);
    const data = await resp.json();
    return {
      success: data.found === true,
      boltPattern: data.boltPattern,
      confidence: data.confidence,
      model: data.model,
      error: data.found ? null : "Not found"
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("TRUCK REGRESSION TESTS - Universal Fitment Resolver");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  const testCases = [
    // Silverado variants
    { year: 2023, make: "Chevrolet", model: "Silverado 2500 HD", expected: { boltPattern: "8x180" } },
    { year: 2023, make: "Chevrolet", model: "Silverado 2500HD", expected: { boltPattern: "8x180" } },
    { year: 2023, make: "Chevrolet", model: "silverado-2500-hd", expected: { boltPattern: "8x180" } },
    { year: 2023, make: "Chevrolet", model: "silverado-2500hd", expected: { boltPattern: "8x180" } },
    { year: 2020, make: "Chevrolet", model: "Silverado 1500", expected: { boltPattern: "6x139.7" } },
    
    // Sierra variants
    { year: 2023, make: "GMC", model: "Sierra 2500HD", expected: { boltPattern: "8x180" } },
    { year: 2023, make: "GMC", model: "sierra-2500-hd", expected: { boltPattern: "8x180" } },
    { year: 2020, make: "GMC", model: "Sierra 1500", expected: { boltPattern: "6x139.7" } },
    
    // Ram variants
    { year: 2023, make: "Ram", model: "2500", expected: { boltPattern: "8x165.1" } },
    { year: 2023, make: "Ram", model: "ram-2500", expected: { boltPattern: "8x165.1" } },
    { year: 2023, make: "Ram", model: "1500", expected: { boltPattern: "6x139.7" } },
    { year: 2020, make: "Dodge", model: "Ram 1500", expected: { boltPattern: "6x139.7" } },
    
    // F-Series variants
    { year: 2023, make: "Ford", model: "F-250", expected: { boltPattern: "8x170" } },
    { year: 2023, make: "Ford", model: "f-250", expected: { boltPattern: "8x170" } },
    { year: 2023, make: "Ford", model: "F-150", expected: { boltPattern: "6x135" } },
    { year: 2023, make: "Ford", model: "f-150", expected: { boltPattern: "6x135" } },
  ];
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (const tc of testCases) {
    const result = await testResolver(tc.year, tc.make, tc.model, tc.trim);
    
    const boltMatch = !tc.expected.boltPattern || result.boltPattern === tc.expected.boltPattern;
    const testPassed = result.success && boltMatch;
    
    if (testPassed) {
      passed++;
      console.log(`✓ ${tc.year} ${tc.make} ${tc.model} → ${result.boltPattern} (${result.confidence})`);
    } else {
      failed++;
      const reason = !result.success ? result.error : `Expected ${tc.expected.boltPattern}, got ${result.boltPattern}`;
      console.log(`✗ ${tc.year} ${tc.make} ${tc.model} → FAILED: ${reason}`);
      failures.push({ ...tc, result, reason });
    }
  }
  
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`RESULTS: ${passed}/${testCases.length} passed (${((passed/testCases.length)*100).toFixed(1)}%)`);
  
  if (failures.length > 0) {
    console.log("\nFAILURES:");
    failures.forEach(f => console.log(`  - ${f.year} ${f.make} ${f.model}: ${f.reason}`));
  }
  
  console.log("═══════════════════════════════════════════════════════════\n");
  
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
