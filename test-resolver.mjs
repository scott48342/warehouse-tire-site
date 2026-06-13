import { config } from 'dotenv';
config({ path: '.env.local' });

// Import the resolver
const { resolveUniversalFitment } = await import('./src/lib/fitment/universalFitmentResolver.ts');

// Test cases
const testCases = [
  { year: 2023, make: "Chevrolet", model: "Silverado 2500 HD" },
  { year: 2023, make: "Chevrolet", model: "Silverado 2500HD" },
  { year: 2023, make: "Chevrolet", model: "silverado-2500hd" },
  { year: 2023, make: "GMC", model: "Sierra 2500 HD" },
  { year: 2023, make: "Ram", model: "1500" },
  { year: 2023, make: "Ram", model: "Ram 1500" },
];

console.log("Testing Universal Fitment Resolver\n" + "=".repeat(50));

for (const tc of testCases) {
  console.log(`\nTest: ${tc.year} ${tc.make} ${tc.model}`);
  try {
    const result = await resolveUniversalFitment(tc);
    console.log(`  Found: ${result.found}`);
    console.log(`  Matched model: ${result.normalized.matchedVariant}`);
    console.log(`  Bolt pattern: ${result.boltPattern}`);
    console.log(`  Center bore: ${result.centerBore}mm`);
    console.log(`  Tire sizes: ${result.oemTireSizes.slice(0, 3).join(", ")}${result.oemTireSizes.length > 3 ? "..." : ""}`);
    console.log(`  Trims available: ${result.availableTrims.length}`);
    console.log(`  Confidence: ${result.confidence}`);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
  }
}

console.log("\n" + "=".repeat(50));
console.log("Done!");
process.exit(0);
