import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import pg from "pg";
const { Pool } = pg;

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  // Check records with legacy 15" sizes
  const { rows: legacy15 } = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE oem_tire_sizes::text LIKE '%R15%'
  `);
  
  console.log("Records with 15\" tires (225/75R15 or 235/75R15):", legacy15[0].cnt);
  
  // Check Corvette specifically  
  const { rows: corvette } = await pool.query(`
    SELECT year, display_trim, oem_tire_sizes, source
    FROM vehicle_fitments
    WHERE make = 'chevrolet' AND model = 'corvette'
    ORDER BY year DESC
    LIMIT 5
  `);
  
  console.log("\nCorvette fitments:");
  for (const r of corvette) {
    console.log(`  ${r.year} ${r.display_trim}`);
    console.log(`    Sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
    console.log(`    Source: ${r.source || "none"}`);
  }
  
  // Check sources distribution
  const { rows: sources } = await pool.query(`
    SELECT source, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE year >= 2020
    GROUP BY source
    ORDER BY cnt DESC
  `);
  
  console.log("\nData sources (2020+):");
  for (const r of sources) {
    console.log(`  ${r.source || "null"}: ${r.cnt}`);
  }
  
  // Check a vehicle that should have correct data
  const { rows: model3 } = await pool.query(`
    SELECT year, display_trim, oem_tire_sizes, source
    FROM vehicle_fitments  
    WHERE make = 'tesla' AND model = 'model-3' AND year >= 2024
    ORDER BY year DESC
    LIMIT 3
  `);
  
  console.log("\nTesla Model 3 (should have 18/19/20\" wheels):");
  for (const r of model3) {
    console.log(`  ${r.year} ${r.display_trim}`);
    console.log(`    Sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
    console.log(`    Source: ${r.source || "none"}`);
  }
  
  await pool.end();
}

check().catch(console.error);
