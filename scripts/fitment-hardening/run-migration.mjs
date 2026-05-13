/**
 * Run the confidence tag migration
 */

import postgres from "postgres";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env.local") });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Missing POSTGRES_URL");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });

async function main() {
  console.log("Running confidence tag migration...\n");
  
  try {
    // Add the column
    await client`
      ALTER TABLE vehicle_fitments 
      ADD COLUMN IF NOT EXISTS confidence_tag VARCHAR(20) DEFAULT 'MEDIUM'
    `;
    console.log("✓ Added confidence_tag column");
    
    // Create index
    await client`
      CREATE INDEX IF NOT EXISTS vehicle_fitments_confidence_idx 
      ON vehicle_fitments (confidence_tag)
    `;
    console.log("✓ Created confidence index");
    
    // Add comment
    await client`
      COMMENT ON COLUMN vehicle_fitments.confidence_tag IS 
      'Data quality indicator: HIGH (complete OEM), MEDIUM (partial/inferred), LOW (needs review)'
    `;
    console.log("✓ Added column comment");
    
    // Check current state
    const stats = await client`
      SELECT confidence_tag, COUNT(*) as count 
      FROM vehicle_fitments 
      GROUP BY confidence_tag
    `;
    console.log("\nCurrent distribution:");
    for (const row of stats) {
      console.log(`  ${row.confidence_tag || 'NULL'}: ${row.count}`);
    }
    
  } finally {
    await client.end();
  }
  
  console.log("\n✓ Migration complete");
}

main().catch(console.error);
