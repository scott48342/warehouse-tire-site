import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check if different trims of same year/model have different wheel sizes
  // This would show if trim-level matching is working
  
  const result = await pool.query(`
    SELECT 
      make, model, year,
      display_trim,
      oem_wheel_sizes
    FROM vehicle_fitments
    WHERE source = 'google-ai-overview'
      AND oem_wheel_sizes IS NOT NULL
      AND oem_wheel_sizes != '[]'::jsonb
    ORDER BY make, model, year, display_trim
  `);
  
  // Group by year/make/model
  const grouped: Record<string, any[]> = {};
  for (const row of result.rows) {
    const key = `${row.year} ${row.make} ${row.model}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }
  
  // Find vehicles where ALL trims have the SAME wheel size (bad)
  // vs vehicles where trims have DIFFERENT wheel sizes (good)
  let sameCount = 0;
  let diffCount = 0;
  const examples: {same: string[], diff: string[]} = {same: [], diff: []};
  
  for (const [key, rows] of Object.entries(grouped)) {
    if (rows.length < 2) continue; // Need multiple trims to compare
    
    const sizes = rows.map(r => {
      const wheels = Array.isArray(r.oem_wheel_sizes) ? r.oem_wheel_sizes : [];
      return wheels[0]?.diameter || 'N/A';
    });
    
    const uniqueSizes = [...new Set(sizes)];
    
    if (uniqueSizes.length === 1) {
      sameCount++;
      if (examples.same.length < 5) {
        examples.same.push(`${key}: all trims = ${uniqueSizes[0]}"`);
      }
    } else {
      diffCount++;
      if (examples.diff.length < 5) {
        const trims = rows.map(r => `${r.display_trim}=${sizes[rows.indexOf(r)]}"`).join(', ');
        examples.diff.push(`${key}: ${trims}`);
      }
    }
  }
  
  console.log("=== Trim Consistency Check ===\n");
  console.log(`Vehicles where all trims have SAME wheel size: ${sameCount}`);
  console.log(`Vehicles where trims have DIFFERENT wheel sizes: ${diffCount}`);
  console.log(`\nPercentage with trim differentiation: ${((diffCount / (sameCount + diffCount)) * 100).toFixed(1)}%`);
  
  console.log("\n--- Examples: All trims same (BAD) ---");
  for (const ex of examples.same) {
    console.log(`  ${ex}`);
  }
  
  console.log("\n--- Examples: Trims different (GOOD) ---");
  for (const ex of examples.diff) {
    console.log(`  ${ex}`);
  }
  
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
