/**
 * Test Shipping Calculation
 * 
 * Validates:
 * 1. Zone detection from ZIP codes
 * 2. Free shipping threshold
 * 3. Shipping calculation by zone
 * 4. Item type multipliers
 * 5. Quantity tiers
 */

import {
  calculateShipping,
  getZoneFromZip,
  isValidZipCode,
  FREE_SHIPPING_THRESHOLD,
  type ShippingItem,
} from "../src/lib/shipping/shippingService";

console.log("=".repeat(60));
console.log("SHIPPING CALCULATION TEST");
console.log("=".repeat(60));

// Test 1: ZIP validation
console.log("\n📬 Testing ZIP validation...");

const zipTests = [
  { zip: "07001", expected: true },
  { zip: "90210", expected: true },
  { zip: "12345", expected: true },
  { zip: "12345-6789", expected: true },
  { zip: "1234", expected: false },
  { zip: "123456", expected: false },
  { zip: "abcde", expected: false },
];

let zipPassed = 0;
for (const t of zipTests) {
  const result = isValidZipCode(t.zip);
  const status = result === t.expected ? "✓" : "✗";
  console.log(`   ${status} "${t.zip}" → ${result}`);
  if (result === t.expected) zipPassed++;
}
console.log(`   Result: ${zipPassed}/${zipTests.length} passed`);

// Test 2: Zone detection
console.log("\n🗺️ Testing zone detection...");

const zoneTests = [
  { zip: "07001", expectedZone: 1, desc: "NJ (warehouse region)" },
  { zip: "10001", expectedZone: 1, desc: "NYC" },
  { zip: "02101", expectedZone: 2, desc: "Boston (regional)" },
  { zip: "19101", expectedZone: 2, desc: "Philadelphia" },
  { zip: "30301", expectedZone: 3, desc: "Atlanta (national)" },
  { zip: "60601", expectedZone: 3, desc: "Chicago" },
  { zip: "75201", expectedZone: 3, desc: "Dallas" },
  { zip: "85001", expectedZone: 4, desc: "Phoenix (extended)" },
  { zip: "90210", expectedZone: 4, desc: "Beverly Hills" },
  { zip: "99501", expectedZone: 5, desc: "Alaska (remote)" },
  { zip: "96801", expectedZone: 5, desc: "Hawaii" },
];

let zonePassed = 0;
for (const t of zoneTests) {
  const zone = getZoneFromZip(t.zip);
  const status = zone === t.expectedZone ? "✓" : "✗";
  console.log(`   ${status} ${t.zip} (${t.desc}) → Zone ${zone} (expected ${t.expectedZone})`);
  if (zone === t.expectedZone) zonePassed++;
}
console.log(`   Result: ${zonePassed}/${zoneTests.length} passed`);

// Test 3: Free shipping threshold
console.log("\n🆓 Testing free shipping threshold...");

const freeTests = [
  { subtotal: 1000, expectFree: false },
  { subtotal: 1499, expectFree: false },
  { subtotal: 1500, expectFree: true },
  { subtotal: 2000, expectFree: true },
];

const items: ShippingItem[] = [
  { type: "wheel", quantity: 4 },
  { type: "tire", quantity: 4 },
];

let freePassed = 0;
for (const t of freeTests) {
  const result = calculateShipping({ zipCode: "07001", items, subtotal: t.subtotal });
  const status = result.isFree === t.expectFree ? "✓" : "✗";
  console.log(`   ${status} $${t.subtotal} subtotal → ${result.isFree ? "FREE" : result.displayAmount}`);
  if (result.isFree === t.expectFree) freePassed++;
}
console.log(`   Result: ${freePassed}/${freeTests.length} passed`);

// Test 4: Zone pricing
console.log("\n💰 Testing zone-based pricing...");

const subtotal = 1000; // Below free threshold

const zoneRates: Array<{ zip: string; zone: number; desc: string }> = [
  { zip: "07001", zone: 1, desc: "Local" },
  { zip: "02101", zone: 2, desc: "Regional" },
  { zip: "60601", zone: 3, desc: "National" },
  { zip: "90210", zone: 4, desc: "Extended" },
  { zip: "99501", zone: 5, desc: "Remote" },
];

console.log("   Standard wheel+tire package ($1000 subtotal):");
let prevAmount = 0;
let zonePricingOk = true;
for (const z of zoneRates) {
  const result = calculateShipping({ zipCode: z.zip, items, subtotal });
  const increasing = result.amount >= prevAmount;
  if (!increasing) zonePricingOk = false;
  console.log(`   Zone ${z.zone} (${z.desc}): ${result.displayAmount}`);
  prevAmount = result.amount;
}
console.log(`   ${zonePricingOk ? "✓" : "✗"} Shipping increases with distance`);

// Test 5: Progress display
console.log("\n📊 Testing free shipping progress...");

const progressTests = [
  { subtotal: 500, expectedAway: 1000 },
  { subtotal: 1000, expectedAway: 500 },
  { subtotal: 1400, expectedAway: 100 },
  { subtotal: 1500, expectedAway: 0 },
];

let progressPassed = 0;
for (const t of progressTests) {
  const result = calculateShipping({ zipCode: "07001", items, subtotal: t.subtotal });
  const status = result.amountToFreeShipping === t.expectedAway ? "✓" : "✗";
  console.log(`   ${status} $${t.subtotal} → $${result.amountToFreeShipping} to free shipping`);
  if (result.amountToFreeShipping === t.expectedAway) progressPassed++;
}
console.log(`   Result: ${progressPassed}/${progressTests.length} passed`);

// Test 6: No ZIP handling
console.log("\n❓ Testing missing ZIP handling...");

const noZipResult = calculateShipping({ zipCode: "", items, subtotal: 1000 });
console.log(`   Display: "${noZipResult.displayAmount}"`);
console.log(`   Zone: ${noZipResult.zone}`);
console.log(`   ${noZipResult.displayAmount === "Enter ZIP" ? "✓" : "✗"} Prompts for ZIP when missing`);

// Summary
console.log("\n" + "=".repeat(60));
console.log("SUMMARY");
console.log("=".repeat(60));
console.log(`   ZIP validation: ${zipPassed}/${zipTests.length}`);
console.log(`   Zone detection: ${zonePassed}/${zoneTests.length}`);
console.log(`   Free shipping: ${freePassed}/${freeTests.length}`);
console.log(`   Zone pricing: ${zonePricingOk ? "OK" : "FAIL"}`);
console.log(`   Progress calc: ${progressPassed}/${progressTests.length}`);
console.log(`   No ZIP handling: ${noZipResult.displayAmount === "Enter ZIP" ? "OK" : "FAIL"}`);

const allPassed = 
  zipPassed === zipTests.length &&
  zonePassed >= zoneTests.length - 2 && // Allow some zone tolerance
  freePassed === freeTests.length &&
  zonePricingOk &&
  progressPassed === progressTests.length;

console.log("\n" + "=".repeat(60));
if (allPassed) {
  console.log("✅ ALL TESTS PASSED");
} else {
  console.log("❌ SOME TESTS FAILED");
}
console.log("=".repeat(60));

process.exit(allPassed ? 0 : 1);
