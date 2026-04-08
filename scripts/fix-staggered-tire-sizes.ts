/**
 * Fix Staggered OEM Tire Sizes
 * 
 * This script:
 * 1. Finds all vehicles with staggered OEM wheel sizes
 * 2. Identifies which are missing OEM tire sizes
 * 3. Updates them with correct tire sizes
 * 
 * Run: npx tsx scripts/fix-staggered-tire-sizes.ts
 */

import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// Known staggered performance vehicles with their correct OEM tire sizes
// Format: modificationId pattern -> { front: "size", rear: "size" }
const KNOWN_STAGGERED_TIRES: Record<string, { front: string; rear: string; note?: string }> = {
  // Corvette (C8)
  "chevrolet-corvette-stingray": { front: "245/35ZR19", rear: "305/30ZR20", note: "C8 Stingray base" },
  "chevrolet-corvette-z06": { front: "275/30ZR20", rear: "345/25ZR21", note: "C8 Z06" },
  "chevrolet-corvette-e-ray": { front: "275/30ZR20", rear: "345/25ZR21", note: "C8 E-Ray" },
  
  // Mustang
  "ford-mustang-gt-performance": { front: "255/40ZR19", rear: "275/40ZR19", note: "GT Performance Pack" },
  "ford-mustang-shelby-gt350": { front: "295/35ZR19", rear: "305/35ZR19", note: "Shelby GT350" },
  "ford-mustang-shelby-gt500": { front: "305/30ZR20", rear: "315/30ZR20", note: "Shelby GT500" },
  "ford-mustang-dark-horse": { front: "305/30ZR19", rear: "315/30ZR19", note: "Dark Horse" },
  "ford-mustang-mach-1": { front: "305/30ZR19", rear: "315/30ZR19", note: "Mach 1" },
  
  // Camaro
  "chevrolet-camaro-ss-1le": { front: "285/30ZR20", rear: "305/30ZR20", note: "SS 1LE Track Pack" },
  "chevrolet-camaro-zl1": { front: "285/30ZR20", rear: "305/30ZR20", note: "ZL1" },
  "chevrolet-camaro-zl1-1le": { front: "305/30ZR19", rear: "325/30ZR19", note: "ZL1 1LE" },
  
  // Challenger/Charger Widebody
  "dodge-challenger-widebody": { front: "305/35ZR20", rear: "305/35ZR20", note: "Widebody square setup" },
  "dodge-challenger-hellcat": { front: "275/40ZR20", rear: "315/35ZR20", note: "Hellcat standard" },
  "dodge-charger-widebody": { front: "305/35ZR20", rear: "305/35ZR20", note: "Widebody square setup" },
  
  // BMW M cars
  "bmw-m3": { front: "275/35ZR19", rear: "285/35ZR19", note: "G80 M3" },
  "bmw-m4": { front: "275/35ZR19", rear: "285/35ZR19", note: "G82 M4" },
  "bmw-m5": { front: "275/35ZR20", rear: "285/35ZR20", note: "F90 M5" },
  
  // Mercedes AMG
  "mercedes-benz-amg-gt": { front: "265/35ZR19", rear: "295/35ZR19", note: "AMG GT" },
  "mercedes-benz-c63-amg": { front: "255/35ZR19", rear: "285/30ZR20", note: "C63 AMG" },
  
  // Porsche
  "porsche-911-carrera": { front: "245/35ZR20", rear: "305/30ZR21", note: "992 Carrera" },
  "porsche-911-turbo": { front: "255/35ZR20", rear: "315/30ZR21", note: "992 Turbo" },
  "porsche-718-cayman": { front: "235/35ZR20", rear: "265/35ZR20", note: "718 Cayman" },
  "porsche-718-boxster": { front: "235/35ZR20", rear: "265/35ZR20", note: "718 Boxster" },
  
  // Nissan
  "nissan-gt-r": { front: "255/40ZR20", rear: "285/35ZR20", note: "R35 GT-R" },
  "nissan-370z": { front: "245/40ZR19", rear: "275/35ZR19", note: "370Z Nismo" },
  "nissan-z": { front: "255/40ZR19", rear: "275/35ZR19", note: "New Z" },
};

async function main() {
  const DATABASE_URL = process.env.POSTGRES_URL;
  if (!DATABASE_URL) {
    console.error("Missing POSTGRES_URL environment variable");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("🔍 Finding vehicles with staggered OEM wheel sizes...\n");

    // Find all vehicles with multiple OEM wheel sizes (potential staggered)
    const { rows: staggeredVehicles } = await pool.query(`
      SELECT 
        modification_id,
        display_trim,
        bolt_pattern,
        oem_wheel_sizes,
        oem_tire_sizes,
        source
      FROM vehicle_fitments
      WHERE oem_wheel_sizes IS NOT NULL 
        AND jsonb_array_length(oem_wheel_sizes) >= 2
      ORDER BY modification_id
    `);

    console.log(`Found ${staggeredVehicles.length} vehicles with multiple OEM wheel sizes\n`);

    // Categorize vehicles
    const missingTireSizes: typeof staggeredVehicles = [];
    const hasTireSizes: typeof staggeredVehicles = [];
    const actuallyStaggered: typeof staggeredVehicles = [];

    for (const v of staggeredVehicles) {
      const wheels = v.oem_wheel_sizes || [];
      const tires = v.oem_tire_sizes || [];
      
      // Check if actually staggered (different diameters or widths)
      const diameters = new Set(wheels.map((w: any) => w.diameter));
      const widths = new Set(wheels.map((w: any) => w.width));
      const isStaggered = diameters.size > 1 || widths.size > 1;
      
      if (isStaggered) {
        actuallyStaggered.push(v);
        if (!tires || tires.length === 0) {
          missingTireSizes.push(v);
        } else {
          hasTireSizes.push(v);
        }
      }
    }

    console.log("📊 Summary:");
    console.log(`   Total with 2+ wheel sizes: ${staggeredVehicles.length}`);
    console.log(`   Actually staggered (diff dia/width): ${actuallyStaggered.length}`);
    console.log(`   With tire sizes: ${hasTireSizes.length}`);
    console.log(`   MISSING tire sizes: ${missingTireSizes.length}\n`);

    // Show vehicles missing tire sizes
    if (missingTireSizes.length > 0) {
      console.log("🚨 Staggered vehicles MISSING tire sizes:\n");
      for (const v of missingTireSizes) {
        const wheels = v.oem_wheel_sizes || [];
        const wheelStr = wheels.map((w: any) => `${w.diameter}"x${w.width}"`).join(", ");
        console.log(`   ${v.modification_id}`);
        console.log(`      Trim: ${v.display_trim || 'N/A'}`);
        console.log(`      Wheels: ${wheelStr}`);
        console.log(`      Bolt: ${v.bolt_pattern}`);
        console.log("");
      }
    }

    // Update known vehicles with tire sizes
    console.log("\n🔧 Updating known staggered vehicles with tire sizes...\n");
    
    let updated = 0;
    let notFound = 0;

    for (const [pattern, tires] of Object.entries(KNOWN_STAGGERED_TIRES)) {
      // Find matching modification IDs
      const { rows: matches } = await pool.query(`
        SELECT modification_id, display_trim, oem_wheel_sizes, oem_tire_sizes
        FROM vehicle_fitments
        WHERE modification_id ILIKE $1
          AND (oem_tire_sizes IS NULL OR jsonb_array_length(oem_tire_sizes) = 0)
      `, [`%${pattern}%`]);

      if (matches.length === 0) {
        notFound++;
        continue;
      }

      for (const match of matches) {
        const tireSizesJson = JSON.stringify([tires.front, tires.rear]);
        
        await pool.query(`
          UPDATE vehicle_fitments
          SET oem_tire_sizes = $1::jsonb,
              updated_at = NOW()
          WHERE modification_id = $2
        `, [tireSizesJson, match.modification_id]);

        console.log(`   ✅ Updated: ${match.modification_id}`);
        console.log(`      Added tires: ${tires.front} / ${tires.rear} (${tires.note})`);
        updated++;
      }
    }

    console.log(`\n📈 Results:`);
    console.log(`   Updated: ${updated} vehicles`);
    console.log(`   Patterns not found: ${notFound}`);

    // Show remaining vehicles without tire sizes
    const { rows: stillMissing } = await pool.query(`
      SELECT modification_id, display_trim, oem_wheel_sizes
      FROM vehicle_fitments
      WHERE oem_wheel_sizes IS NOT NULL 
        AND jsonb_array_length(oem_wheel_sizes) >= 2
        AND (oem_tire_sizes IS NULL OR jsonb_array_length(oem_tire_sizes) = 0)
      ORDER BY modification_id
    `);

    // Filter to only actually staggered
    const stillMissingStaggered = stillMissing.filter(v => {
      const wheels = v.oem_wheel_sizes || [];
      const diameters = new Set(wheels.map((w: any) => w.diameter));
      const widths = new Set(wheels.map((w: any) => w.width));
      return diameters.size > 1 || widths.size > 1;
    });

    if (stillMissingStaggered.length > 0) {
      console.log(`\n⚠️  Still missing tire sizes (${stillMissingStaggered.length} staggered vehicles):`);
      for (const v of stillMissingStaggered.slice(0, 20)) {
        const wheels = v.oem_wheel_sizes || [];
        const wheelStr = wheels.map((w: any) => `${w.diameter}"x${w.width}"`).join(", ");
        console.log(`   - ${v.modification_id} (${wheelStr})`);
      }
      if (stillMissingStaggered.length > 20) {
        console.log(`   ... and ${stillMissingStaggered.length - 20} more`);
      }
    }

  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
