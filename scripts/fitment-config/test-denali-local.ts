import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getFitmentConfigurations } from "../../src/lib/fitment-db/getFitmentConfigurations";

async function test() {
  console.log("Testing GMC Yukon Denali lookup with requestedTrim...\n");
  
  // Test without requestedTrim (should get SLE = 18")
  console.log("1. Without requestedTrim:");
  const result1 = await getFitmentConfigurations(2022, "gmc", "yukon", "manual_84a11862fac8");
  console.log("   Diameters:", result1.uniqueDiameters);
  console.log("   Tire sizes:", [...new Set(result1.configurations.map(c => c.tireSize))]);
  
  // Test with requestedTrim = "Denali" (should get Denali = 22")
  console.log("\n2. With requestedTrim='Denali':");
  const result2 = await getFitmentConfigurations(2022, "gmc", "yukon", "manual_84a11862fac8", "Denali");
  console.log("   Diameters:", result2.uniqueDiameters);
  console.log("   Tire sizes:", [...new Set(result2.configurations.map(c => c.tireSize))]);
  
  // Test with requestedTrim = "SLE" (should get SLE = 18")
  console.log("\n3. With requestedTrim='SLE':");
  const result3 = await getFitmentConfigurations(2022, "gmc", "yukon", "manual_84a11862fac8", "SLE");
  console.log("   Diameters:", result3.uniqueDiameters);
  console.log("   Tire sizes:", [...new Set(result3.configurations.map(c => c.tireSize))]);
  
  process.exit(0);
}

test().catch(console.error);
