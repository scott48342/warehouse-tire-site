import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

// Dynamic import of the resolver (needs to be compiled first)
// For now, let's manually trace the query flow

import postgres from 'postgres';
const sql = postgres(process.env.POSTGRES_URL);

// Simulate the resolver's query
const year = 2024;
const make = 'Mercedes-Benz';
const normalizedMake = 'mercedes-benz';
const modelVariants = ['e-class']; // from getModelVariants("E-Class")
const requestedTrim = 'E350';

for (const modelName of modelVariants) {
  console.log(`\n=== Trying model variant: "${modelName}" ===`);
  
  // Step 2: Exact canonical displayTrim match
  const exactTrimMatch = await sql`
    SELECT id, display_trim, oem_tire_sizes
    FROM vehicle_fitments
    WHERE year = ${year}
      AND make ILIKE ${normalizedMake}
      AND model ILIKE ${modelName}
      AND display_trim = ${requestedTrim}
      AND certification_status = 'certified'
    LIMIT 1
  `;
  
  if (exactTrimMatch.length > 0) {
    console.log(`Step 2 FOUND: "${exactTrimMatch[0].display_trim}" → ${JSON.stringify(exactTrimMatch[0].oem_tire_sizes)}`);
    // This should return immediately with exact_canonical_trim
  } else {
    console.log(`Step 2: No exact match for "${requestedTrim}"`);
    
    // Step 3: Get all records
    const allRecords = await sql`
      SELECT id, display_trim, oem_tire_sizes
      FROM vehicle_fitments
      WHERE year = ${year}
        AND make ILIKE ${normalizedMake}
        AND model ILIKE ${modelName}
        AND certification_status = 'certified'
      LIMIT 50
    `;
    
    console.log(`Step 3: Found ${allRecords.length} candidates`);
    for (const rec of allRecords) {
      const matchesExact = rec.display_trim.toLowerCase() === requestedTrim.toLowerCase();
      const normalized = rec.display_trim.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const matchesNormalized = normalized === requestedTrim.toLowerCase().replace(/[^a-z0-9]+/g, '');
      console.log(`  "${rec.display_trim}" exact=${matchesExact} norm=${matchesNormalized} sizes=${JSON.stringify(rec.oem_tire_sizes)}`);
    }
  }
}

await sql.end();
