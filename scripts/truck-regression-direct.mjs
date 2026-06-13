/**
 * Truck Regression Tests - Direct DB Test
 * Tests that HD truck queries resolve correctly in the DB
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

async function testVehicle(year, make, model, expectedBolt) {
  // Simulate resolver logic - try multiple model variants
  const modelLower = model.toLowerCase().trim();
  const modelSlug = model.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  
  // Model variants to try (similar to resolver logic)
  const variants = [model, modelLower, modelSlug];
  
  // HD truck specific variants
  if (modelSlug.includes("silverado-2500") || modelSlug.includes("silverado 2500")) {
    variants.unshift("Silverado 2500HD", "Silverado 2500");
  }
  if (modelSlug.includes("sierra-2500") || modelSlug.includes("sierra 2500")) {
    variants.unshift("Sierra 2500HD", "Sierra 2500");
  }
  if (modelSlug.includes("ram-2500") || model === "2500") {
    variants.unshift("2500", "Ram 2500");
  }
  if (modelSlug.includes("f-250") || modelSlug === "f250") {
    variants.unshift("F-250", "F250", "F-250 Super Duty");
  }
  if (modelSlug.includes("f-150") || modelSlug === "f150") {
    variants.unshift("F-150", "F150");
  }
  
  // Normalize make
  const makeLower = make.toLowerCase();
  const makeNorm = makeLower === "chevy" ? "Chevrolet" : make;
  
  for (const variant of variants) {
    const result = await db.execute(sql`
      SELECT year, make, model, bolt_pattern, center_bore_mm
      FROM vehicle_fitments
      WHERE certification_status = 'certified'
        AND year = ${year}
        AND make ILIKE ${`%${makeNorm}%`}
        AND model ILIKE ${variant}
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const boltMatch = !expectedBolt || row.bolt_pattern === expectedBolt;
      return {
        success: true,
        boltMatch,
        found: `${row.model}`,
        boltPattern: row.bolt_pattern,
        variant: variant
      };
    }
  }
  
  return { success: false, error: "No match found" };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("TRUCK REGRESSION TESTS - Direct DB Query");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  const testCases = [
    // Silverado variants (input → expected bolt pattern)
    { year: 2023, make: "Chevrolet", model: "Silverado 2500 HD", bolt: "8x180" },
    { year: 2023, make: "Chevrolet", model: "Silverado 2500HD", bolt: "8x180" },
    { year: 2023, make: "Chevrolet", model: "silverado-2500-hd", bolt: "8x180" },
    { year: 2023, make: "Chevrolet", model: "silverado-2500hd", bolt: "8x180" },
    { year: 2023, make: "Chevrolet", model: "Silverado 3500HD", bolt: "8x180" },
    { year: 2020, make: "Chevrolet", model: "Silverado 1500", bolt: "6x139.7" },
    
    // Sierra variants
    { year: 2023, make: "GMC", model: "Sierra 2500HD", bolt: "8x180" },
    { year: 2023, make: "GMC", model: "sierra-2500-hd", bolt: "8x180" },
    { year: 2023, make: "GMC", model: "Sierra 3500HD", bolt: "8x180" },
    { year: 2020, make: "GMC", model: "Sierra 1500", bolt: "6x139.7" },
    
    // Ram variants
    { year: 2023, make: "Ram", model: "2500", bolt: "8x165.1" },
    { year: 2023, make: "Ram", model: "ram-2500", bolt: "8x165.1" },
    { year: 2023, make: "Ram", model: "3500", bolt: "8x165.1" },
    { year: 2023, make: "Ram", model: "1500", bolt: "6x139.7" },
    
    // F-Series variants
    { year: 2023, make: "Ford", model: "F-250", bolt: "8x170" },
    { year: 2023, make: "Ford", model: "f-250", bolt: "8x170" },
    { year: 2023, make: "Ford", model: "F-350", bolt: "8x170" },
    { year: 2023, make: "Ford", model: "F-150", bolt: "6x135" },
    { year: 2023, make: "Ford", model: "f-150", bolt: "6x135" },
  ];
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (const tc of testCases) {
    const result = await testVehicle(tc.year, tc.make, tc.model, tc.bolt);
    
    if (result.success && result.boltMatch) {
      passed++;
      console.log(`✓ ${tc.year} ${tc.make} ${tc.model} → ${result.found} (${result.boltPattern})`);
    } else if (result.success && !result.boltMatch) {
      failed++;
      console.log(`✗ ${tc.year} ${tc.make} ${tc.model} → BOLT MISMATCH: expected ${tc.bolt}, got ${result.boltPattern}`);
      failures.push({ ...tc, result });
    } else {
      failed++;
      console.log(`✗ ${tc.year} ${tc.make} ${tc.model} → NOT FOUND`);
      failures.push({ ...tc, result });
    }
  }
  
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`RESULTS: ${passed}/${testCases.length} passed (${((passed/testCases.length)*100).toFixed(1)}%)`);
  console.log("═══════════════════════════════════════════════════════════\n");
  
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
