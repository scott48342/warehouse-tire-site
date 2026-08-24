/**
 * Diagnostic script to trace tire price doubling issue.
 * 
 * Tests:
 * 1. Normal tire search API result
 * 2. lookupTireDirect result (used by Saved Quotes)
 * 3. Side-by-side comparison
 * 
 * Run with: npx tsx scripts/test-tire-pricing-diagnostic.ts
 */

import { lookupTireDirect, getTirePrice, STANDARD_TIRE_ADDER, COMMERCIAL_TIRE_ADDER, isCommercialTruckSize, calculateTireSellPrice } from "../src/lib/tires/tirePricingService";

const TEST_SKU = "LXST2031655020";
const TEST_SIZE = "215/55R16";

async function runDiagnostic() {
  console.log("=".repeat(60));
  console.log("TIRE PRICING DIAGNOSTIC");
  console.log("=".repeat(60));
  console.log(`\nTest SKU: ${TEST_SKU}`);
  console.log(`Test Size: ${TEST_SIZE}`);
  console.log(`\nPricing Constants:`);
  console.log(`  STANDARD_TIRE_ADDER: ${STANDARD_TIRE_ADDER}`);
  console.log(`  COMMERCIAL_TIRE_ADDER: ${COMMERCIAL_TIRE_ADDER}`);
  console.log(`  isCommercialTruckSize("${TEST_SIZE}"): ${isCommercialTruckSize(TEST_SIZE)}`);
  
  console.log("\n" + "-".repeat(60));
  console.log("1. NORMAL TIRE SEARCH API RESULT");
  console.log("-".repeat(60));
  
  try {
    const apiResponse = await fetch(`http://localhost:3001/api/tires/search?partNumber=${TEST_SKU}&size=${encodeURIComponent(TEST_SIZE)}&limit=1`);
    const apiData = await apiResponse.json();
    const apiResult = apiData.results?.[0];
    
    if (apiResult) {
      console.log(`  partNumber: ${apiResult.partNumber}`);
      console.log(`  cost: $${apiResult.cost}`);
      console.log(`  price: $${apiResult.price}`);
      console.log(`  source: ${apiResult.source}`);
      console.log(`  size: ${apiResult.size}`);
    } else {
      console.log("  No result from API");
    }
  } catch (err) {
    console.log(`  API call failed: ${err}`);
  }
  
  console.log("\n" + "-".repeat(60));
  console.log("2. lookupTireDirect RESULT (used by Saved Quotes)");
  console.log("-".repeat(60));
  
  // This will trigger the diagnostic logging in lookupTireDirect
  const directResult = await lookupTireDirect(TEST_SKU, TEST_SIZE);
  
  if (directResult) {
    console.log(`\n[Final lookupTireDirect Result]`);
    console.log(`  found: ${directResult.found}`);
    console.log(`  partNumber: ${directResult.partNumber}`);
    console.log(`  cost: $${directResult.cost}`);
    console.log(`  price: $${directResult.price}`);
    console.log(`  source: ${directResult.source}`);
    console.log(`  size: ${directResult.size}`);
  } else {
    console.log("  No result from lookupTireDirect");
  }
  
  console.log("\n" + "-".repeat(60));
  console.log("3. getTirePrice RESULT");
  console.log("-".repeat(60));
  
  const finalPrice = await getTirePrice(TEST_SKU, TEST_SIZE);
  console.log(`  getTirePrice result: $${finalPrice}`);
  
  console.log("\n" + "-".repeat(60));
  console.log("4. MANUAL CALCULATION CHECK");
  console.log("-".repeat(60));
  
  if (directResult?.cost) {
    const manualPrice = calculateTireSellPrice(directResult.cost, TEST_SIZE);
    console.log(`  Input cost: $${directResult.cost}`);
    console.log(`  calculateTireSellPrice output: $${manualPrice}`);
    console.log(`  Expected: cost + STANDARD_TIRE_ADDER = $${directResult.cost} + $${STANDARD_TIRE_ADDER} = $${directResult.cost + STANDARD_TIRE_ADDER}`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("DIAGNOSTIC COMPLETE");
  console.log("=".repeat(60));
}

runDiagnostic().catch(console.error);
