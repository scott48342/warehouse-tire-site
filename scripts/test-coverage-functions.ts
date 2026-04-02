import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { hasYearCoverage, getTrimsWithCoverage, getYearsWithCoverage } from "../src/lib/fitment-db/coverage";

async function main() {
  console.log("Testing Ford F-350 (should alias to f-350-super-duty):\n");
  
  // Test hasYearCoverage
  console.log("hasYearCoverage(2015, ford, f-350):");
  const has = await hasYearCoverage(2015, "ford", "f-350");
  console.log("  Result:", has);
  
  // Test getTrimsWithCoverage
  console.log("\ngetTrimsWithCoverage(2015, ford, f-350):");
  const trims = await getTrimsWithCoverage(2015, "ford", "f-350");
  console.log("  Result:", trims);
  
  // Test getYearsWithCoverage
  console.log("\ngetYearsWithCoverage(ford, f-350):");
  const years = await getYearsWithCoverage("ford", "f-350");
  console.log("  Result:", years.years.slice(0, 10), "...");
  
  // Compare with direct query
  console.log("\n--- Direct f-350-super-duty ---");
  console.log("hasYearCoverage(2015, ford, f-350-super-duty):");
  const hasDirect = await hasYearCoverage(2015, "ford", "f-350-super-duty");
  console.log("  Result:", hasDirect);
  
  process.exit(0);
}

main().catch(console.error);
