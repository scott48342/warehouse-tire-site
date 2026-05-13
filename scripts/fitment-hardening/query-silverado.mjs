/**
 * Query 2011 Silverado 3500 HD fitment data
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, ilike } from "drizzle-orm";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env.local") });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Missing POSTGRES_URL");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function main() {
  try {
    // Query all 2011 Silverado 3500 variants
    const results = await client`
      SELECT 
        id,
        year,
        make,
        model,
        display_trim,
        bolt_pattern,
        center_bore_mm,
        offset_min_mm,
        offset_max_mm,
        oem_wheel_sizes,
        oem_tire_sizes,
        source,
        quality_tier
      FROM vehicle_fitments
      WHERE year = 2011 
        AND make = 'Chevrolet' 
        AND model ILIKE '%Silverado%3500%'
      ORDER BY display_trim
    `;
    
    console.log(`Found ${results.length} records:\n`);
    
    for (const row of results) {
      console.log(`─────────────────────────────────────────`);
      console.log(`ID: ${row.id}`);
      console.log(`Vehicle: ${row.year} ${row.make} ${row.model}`);
      console.log(`Trim: ${row.display_trim}`);
      console.log(`Bolt Pattern: ${row.bolt_pattern}`);
      console.log(`Center Bore: ${row.center_bore_mm}`);
      console.log(`Offset Range: ${row.offset_min_mm} to ${row.offset_max_mm}`);
      console.log(`Wheel Sizes: ${JSON.stringify(row.oem_wheel_sizes)}`);
      console.log(`Tire Sizes: ${JSON.stringify(row.oem_tire_sizes)}`);
      console.log(`Source: ${row.source}`);
      console.log(`Quality Tier: ${row.quality_tier}`);
    }
    
    // Also check for all 3500 HD trucks with center bore for reference
    console.log(`\n\n═════════════════════════════════════════`);
    console.log(`REFERENCE: Other Silverado 3500 HD center bores:`);
    console.log(`═════════════════════════════════════════\n`);
    
    const reference = await client`
      SELECT DISTINCT
        year,
        bolt_pattern,
        center_bore_mm,
        COUNT(*) as count
      FROM vehicle_fitments
      WHERE make = 'Chevrolet' 
        AND model ILIKE '%Silverado%3500%'
        AND center_bore_mm IS NOT NULL
      GROUP BY year, bolt_pattern, center_bore_mm
      ORDER BY year, bolt_pattern
    `;
    
    for (const row of reference) {
      console.log(`${row.year}: ${row.bolt_pattern} / ${row.center_bore_mm}mm (${row.count} records)`);
    }
    
  } finally {
    await client.end();
  }
}

main().catch(console.error);
