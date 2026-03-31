/**
 * Fix Mercedes Make Name
 * 
 * The import stored "mercedes-benz" but lookups expect "mercedes"
 * due to alias in keys.ts. This script updates the database.
 * 
 * Run: npx tsx scripts/fix-mercedes-make.ts
 */

import { db, schema } from "../src/lib/fitment-db";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("FIXING MERCEDES MAKE NAME");
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("");
  
  // Check current state
  const before = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.vehicleFitments)
    .where(eq(schema.vehicleFitments.make, "mercedes-benz"));
  
  console.log(`Records with make="mercedes-benz": ${before[0].count}`);
  
  if (before[0].count === 0) {
    console.log("No records to fix.");
    process.exit(0);
  }
  
  // Update to "mercedes"
  console.log("Updating to make='mercedes'...");
  
  const result = await db
    .update(schema.vehicleFitments)
    .set({ make: "mercedes" })
    .where(eq(schema.vehicleFitments.make, "mercedes-benz"));
  
  // Verify
  const after = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.vehicleFitments)
    .where(eq(schema.vehicleFitments.make, "mercedes"));
  
  console.log(`Records with make="mercedes" after fix: ${after[0].count}`);
  
  console.log("");
  console.log("✅ Fix completed!");
  
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
