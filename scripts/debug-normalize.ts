import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { normalizeModel } from "../src/lib/fitment-db/keys";
import { db } from "../src/lib/fitment-db/db";
import { sql, inArray, eq, and } from "drizzle-orm";
import { vehicleFitments } from "../src/lib/fitment-db/schema";

// Copy the alias logic from coverage.ts
const MODEL_ALIASES: Record<string, string[]> = {
  "f-250": ["f-250-super-duty"],
  "f-350": ["f-350-super-duty"],
  "f-450": ["f-450-super-duty"],
  "300": ["300c", "300s", "300m"],
  "300c": ["300"],
  "silverado": ["silverado-1500"],
  "sierra": ["sierra-1500"],
  "ram": ["ram-1500"],
};

function getModelVariants(model: string): string[] {
  const normalized = normalizeModel(model);
  const aliases = MODEL_ALIASES[normalized] || [];
  return [normalized, ...aliases.map(a => normalizeModel(a))];
}

async function main() {
  console.log("=== Normalize Debug ===\n");
  
  // Test normalization
  console.log("normalizeModel('f-350'):", normalizeModel("f-350"));
  console.log("normalizeModel('f-350-super-duty'):", normalizeModel("f-350-super-duty"));
  
  // Test variant lookup
  console.log("\ngetModelVariants('f-350'):", getModelVariants("f-350"));
  
  // Test the actual query
  const variants = getModelVariants("f-350");
  console.log("\nTesting query with variants:", variants);
  
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, 2015),
        eq(vehicleFitments.make, "ford"),
        inArray(vehicleFitments.model, variants)
      )
    )
    .limit(1);
  
  console.log("Query result:", result);
  console.log("Count:", result[0]?.count);
  
  process.exit(0);
}

main().catch(console.error);
