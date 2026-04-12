/**
 * Fix Corvette C5 (1997-2004) tire sizes
 * 
 * These records have inherited C4 generation 15" sizes which are wrong.
 * C5 came with 17" front / 18" rear as standard.
 * 
 * Usage: npx tsx scripts/fitment-audit/fix-corvette-c5.ts [--dry-run]
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";

const { Pool } = pg;

// C5 Corvette correct tire sizes
const C5_TIRE_SIZES: Record<string, string[]> = {
  // Base models 1997-2004
  "Base": ["P245/45ZR17", "P275/40ZR18"],
  "Z51": ["P245/45ZR17", "P275/40ZR18"],
  
  // Z06 (2001-2004) had wider tires
  "Z06": ["P265/40ZR17", "P295/35ZR18"],
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║          FIX CORVETTE C5 (1997-2004) TIRE SIZES                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE (will modify data)"}\n`);

  try {
    // Get all C5 Corvette records
    const { rows } = await pool.query(`
      SELECT id, year, make, model, display_trim, oem_tire_sizes, source
      FROM vehicle_fitments
      WHERE make = 'chevrolet' 
        AND model = 'corvette' 
        AND year >= 1997 
        AND year <= 2004
      ORDER BY year, display_trim
    `);
    
    console.log(`Found ${rows.length} Corvette C5 records\n`);
    
    let fixed = 0;
    
    for (const row of rows) {
      const currentSizes = row.oem_tire_sizes || [];
      
      // Check if current sizes are wrong (only 15" or empty)
      const has17or18 = currentSizes.some((s: string) => {
        const match = s.match(/R(\d+)/);
        return match && (parseInt(match[1]) >= 17);
      });
      
      if (!has17or18) {
        // Determine correct sizes based on trim
        const trimKey = row.display_trim.includes('Z06') ? 'Z06' : 
                        row.display_trim.includes('Z51') ? 'Z51' : 'Base';
        const correctSizes = C5_TIRE_SIZES[trimKey];
        
        console.log(`${row.year} ${row.display_trim}`);
        console.log(`  Current: ${currentSizes.join(", ") || "(empty)"}`);
        console.log(`  Fix to:  ${correctSizes.join(", ")}`);
        
        if (!dryRun) {
          await pool.query(
            `UPDATE vehicle_fitments 
             SET oem_tire_sizes = $1::jsonb,
                 source = 'cleanup_corvette_c5',
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(correctSizes), row.id]
          );
          fixed++;
        }
      } else {
        console.log(`${row.year} ${row.display_trim} - OK (has 17/18" sizes)`);
      }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`TOTAL RECORDS FIXED: ${dryRun ? "N/A (dry run)" : fixed}`);
    
    if (dryRun) {
      console.log(`\n💡 Run without --dry-run to apply changes`);
    }
    
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
