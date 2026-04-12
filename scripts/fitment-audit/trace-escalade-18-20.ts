import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import pg from "pg";
const { Pool } = pg;

async function trace() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("    TRACING ESCALADE 18\"/20\" TIRE SIZE ORIGIN                  ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Get the 2026 Escalade record with 18"/20"
  const { rows: escalade2026 } = await pool.query(`
    SELECT year, display_trim, modification_id, oem_tire_sizes, source, created_at, updated_at
    FROM vehicle_fitments
    WHERE make = 'cadillac' AND model = 'escalade' AND year = 2026
      AND oem_tire_sizes::text LIKE '%R18%'
  `);

  console.log("2026 Escalade record with 18\"/20\":\n");
  for (const r of escalade2026) {
    console.log(`ModID: ${r.modification_id}`);
    console.log(`Source: ${r.source}`);
    console.log(`Created: ${r.created_at}`);
    console.log(`Updated: ${r.updated_at}`);
    console.log(`Sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
    console.log("");
  }

  // Check older Escalade records for 18"/20" sizes
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("    CHECKING OLDER ESCALADE RECORDS                             ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const { rows: olderEscalade } = await pool.query(`
    SELECT year, display_trim, oem_tire_sizes, source
    FROM vehicle_fitments
    WHERE make = 'cadillac' AND model = 'escalade'
      AND (oem_tire_sizes::text LIKE '%R18%' OR oem_tire_sizes::text LIKE '%R20%')
    ORDER BY year ASC
    LIMIT 15
  `);

  console.log("Escalade records with 18\" or 20\" tires:\n");
  for (const r of olderEscalade) {
    console.log(`${r.year} "${r.display_trim}"`);
    console.log(`  Source: ${r.source}`);
    console.log(`  Sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
    console.log("");
  }

  // Check what the generation_template source actually contains
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("    CHECKING GENERATION_TEMPLATE SOURCE RECORDS                 ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const { rows: genTemplate } = await pool.query(`
    SELECT year, make, model, display_trim, oem_tire_sizes
    FROM vehicle_fitments
    WHERE source = 'generation_template' 
      AND make = 'cadillac'
    ORDER BY year DESC
    LIMIT 10
  `);

  console.log("Cadillac generation_template records:\n");
  for (const r of genTemplate) {
    console.log(`${r.year} ${r.make} ${r.model} "${r.display_trim}"`);
    console.log(`  Sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
    console.log("");
  }

  await pool.end();
}

trace().catch(console.error);
