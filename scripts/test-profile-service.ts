import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getFitmentProfile } from "../src/lib/fitment-db/profileService";

async function main() {
  console.log("Testing getFitmentProfile for 2015 Ford F-250 XLT:\n");
  
  const result = await getFitmentProfile(2015, "Ford", "F-250", "XLT");
  
  console.log("Result:");
  console.log("  Resolution path:", result.resolutionPath);
  console.log("  Profile found:", result.profile ? "YES" : "NO");
  
  if (result.profile) {
    console.log("\nProfile details:");
    console.log("  Bolt pattern:", result.profile.boltPattern);
    console.log("  Center bore:", result.profile.centerBoreMm);
    console.log("  Thread size:", result.profile.threadSize);
    console.log("  Display trim:", result.profile.displayTrim);
    console.log("  Wheel sizes:", result.profile.oemWheelSizes?.length || 0, "entries");
  } else {
    console.log("\nERROR: No profile returned!");
    console.log("Full result:", JSON.stringify(result, null, 2));
  }
  
  process.exit(0);
}

main().catch(console.error);
