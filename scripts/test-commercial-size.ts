/**
 * Test isCommercialTruckSize function directly
 */

import { isCommercialTruckSize, STANDARD_TIRE_ADDER, COMMERCIAL_TIRE_ADDER } from "../src/lib/tires/tirePricingService";

const TEST_SIZES = [
  "215/55R16",      // Should be FALSE (standard passenger)
  "225/70R19.5",    // Should be TRUE (medium truck)
  "11R22.5",        // Should be TRUE (medium truck)
  "LT265/70R17",    // Should be TRUE (light truck)
  "ST225/75R15",    // Should be TRUE (trailer)
  "2155516",        // Should be FALSE (compact passenger)
  "22570195",       // Should be TRUE (compact medium truck)
  "11225",          // Should be TRUE (compact medium truck)
  "37X12.50R22",    // Should be FALSE (flotation, under 40)
  "44X19.50R26",    // Should be TRUE (flotation, 40+)
];

console.log("isCommercialTruckSize Test Results:");
console.log("=====================================");
console.log(`STANDARD_TIRE_ADDER: $${STANDARD_TIRE_ADDER}`);
console.log(`COMMERCIAL_TIRE_ADDER: $${COMMERCIAL_TIRE_ADDER}`);
console.log("");

for (const size of TEST_SIZES) {
  const result = isCommercialTruckSize(size);
  console.log(`"${size.padEnd(15)}" => ${result}`);
}
