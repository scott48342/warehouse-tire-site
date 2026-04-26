/**
 * Fix Mercedes-Benz Remaining Fitments - Pass 2
 * Handles edge cases: Base trims, S580 naming, older AMG models
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const { Pool } = pg;

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const eqIdx = line.indexOf("=");
  if (eqIdx > 0) {
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

// Default specs by model (for "Base" trims)
const modelDefaults: Record<string, {
  frontWheel: { diameter: number; width: number; offset: number };
  rearWheel: { diameter: number; width: number; offset: number };
  frontTire: string;
  rearTire: string;
  boltPattern: string;
  isStaggered: boolean;
}> = {
  "E-Class": {
    frontWheel: { diameter: 18, width: 8, offset: 43 },
    rearWheel: { diameter: 18, width: 9, offset: 51 },
    frontTire: "245/45R18",
    rearTire: "275/40R18",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "C-Class": {
    frontWheel: { diameter: 17, width: 7, offset: 48.5 },
    rearWheel: { diameter: 17, width: 7, offset: 48.5 },
    frontTire: "225/50R17",
    rearTire: "225/50R17",
    boltPattern: "5x112",
    isStaggered: false,
  },
  "S-Class": {
    frontWheel: { diameter: 19, width: 8.5, offset: 35 },
    rearWheel: { diameter: 19, width: 9.5, offset: 45 },
    frontTire: "255/45R19",
    rearTire: "285/40R19",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "CLA": {
    frontWheel: { diameter: 18, width: 7.5, offset: 52 },
    rearWheel: { diameter: 18, width: 7.5, offset: 52 },
    frontTire: "225/45R18",
    rearTire: "225/45R18",
    boltPattern: "5x112",
    isStaggered: false,
  },
  "GLA": {
    frontWheel: { diameter: 18, width: 7.5, offset: 52 },
    rearWheel: { diameter: 18, width: 7.5, offset: 52 },
    frontTire: "235/55R18",
    rearTire: "235/55R18",
    boltPattern: "5x112",
    isStaggered: false,
  },
  "GLE": {
    frontWheel: { diameter: 19, width: 8, offset: 38 },
    rearWheel: { diameter: 19, width: 8, offset: 38 },
    frontTire: "275/55R19",
    rearTire: "275/55R19",
    boltPattern: "5x112",
    isStaggered: false,
  },
  "GLC": {
    frontWheel: { diameter: 18, width: 7.5, offset: 42 },
    rearWheel: { diameter: 18, width: 7.5, offset: 42 },
    frontTire: "235/60R18",
    rearTire: "235/60R18",
    boltPattern: "5x112",
    isStaggered: false,
  },
  "G-Class": {
    frontWheel: { diameter: 19, width: 9.5, offset: 50 },
    rearWheel: { diameter: 19, width: 9.5, offset: 50 },
    frontTire: "275/55R19",
    rearTire: "275/55R19",
    boltPattern: "5x130",
    isStaggered: false,
  },
  "SL-Class": {
    frontWheel: { diameter: 19, width: 8.5, offset: 35 },
    rearWheel: { diameter: 19, width: 9.5, offset: 45 },
    frontTire: "255/35R19",
    rearTire: "285/30R19",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "SLK-Class": {
    frontWheel: { diameter: 17, width: 7.5, offset: 40 },
    rearWheel: { diameter: 17, width: 8.5, offset: 45 },
    frontTire: "225/45R17",
    rearTire: "245/40R17",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "SLC-Class": {
    frontWheel: { diameter: 17, width: 7.5, offset: 40 },
    rearWheel: { diameter: 17, width: 8.5, offset: 45 },
    frontTire: "225/45R17",
    rearTire: "245/40R17",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "CLS": {
    frontWheel: { diameter: 19, width: 8.5, offset: 38 },
    rearWheel: { diameter: 19, width: 9.5, offset: 48 },
    frontTire: "245/40R19",
    rearTire: "275/35R19",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "CLS-Class": {
    frontWheel: { diameter: 19, width: 8.5, offset: 38 },
    rearWheel: { diameter: 19, width: 9.5, offset: 48 },
    frontTire: "245/40R19",
    rearTire: "275/35R19",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "M-Class": {
    frontWheel: { diameter: 18, width: 8, offset: 38 },
    rearWheel: { diameter: 18, width: 8, offset: 38 },
    frontTire: "265/60R18",
    rearTire: "265/60R18",
    boltPattern: "5x112",
    isStaggered: false,
  },
  "EQS": {
    frontWheel: { diameter: 20, width: 9, offset: 33 },
    rearWheel: { diameter: 20, width: 10.5, offset: 44 },
    frontTire: "255/45R20",
    rearTire: "285/40R20",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "EQE": {
    frontWheel: { diameter: 19, width: 8.5, offset: 38 },
    rearWheel: { diameter: 19, width: 10, offset: 46 },
    frontTire: "255/45R19",
    rearTire: "285/40R19",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "EQB": {
    frontWheel: { diameter: 18, width: 7.5, offset: 52 },
    rearWheel: { diameter: 18, width: 7.5, offset: 52 },
    frontTire: "235/55R18",
    rearTire: "235/55R18",
    boltPattern: "5x112",
    isStaggered: false,
  },
  "A-Class": {
    frontWheel: { diameter: 17, width: 7, offset: 52 },
    rearWheel: { diameter: 17, width: 7, offset: 52 },
    frontTire: "225/45R17",
    rearTire: "225/45R17",
    boltPattern: "5x112",
    isStaggered: false,
  },
};

// AMG defaults (staggered setups)
const amgDefaults: Record<string, typeof modelDefaults["E-Class"]> = {
  "E-Class AMG": {
    frontWheel: { diameter: 19, width: 9, offset: 38 },
    rearWheel: { diameter: 19, width: 10, offset: 48 },
    frontTire: "265/35R19",
    rearTire: "295/30R19",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "C-Class AMG": {
    frontWheel: { diameter: 18, width: 8.5, offset: 42 },
    rearWheel: { diameter: 18, width: 9.5, offset: 47 },
    frontTire: "235/40R18",
    rearTire: "255/35R18",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "S-Class AMG": {
    frontWheel: { diameter: 20, width: 9, offset: 33 },
    rearWheel: { diameter: 20, width: 10, offset: 44 },
    frontTire: "255/40R20",
    rearTire: "285/35R20",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "G-Class AMG": {
    frontWheel: { diameter: 20, width: 9.5, offset: 50 },
    rearWheel: { diameter: 20, width: 9.5, offset: 50 },
    frontTire: "275/50R20",
    rearTire: "275/50R20",
    boltPattern: "5x130",
    isStaggered: false,
  },
  "SL-Class AMG": {
    frontWheel: { diameter: 19, width: 9, offset: 38 },
    rearWheel: { diameter: 19, width: 10, offset: 48 },
    frontTire: "255/35R19",
    rearTire: "285/30R19",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "SLK-Class AMG": {
    frontWheel: { diameter: 18, width: 8, offset: 38 },
    rearWheel: { diameter: 18, width: 9, offset: 42 },
    frontTire: "235/40R18",
    rearTire: "255/35R18",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "CLS-Class AMG": {
    frontWheel: { diameter: 19, width: 9, offset: 38 },
    rearWheel: { diameter: 19, width: 10, offset: 48 },
    frontTire: "255/35R19",
    rearTire: "285/30R19",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "M-Class AMG": {
    frontWheel: { diameter: 21, width: 10, offset: 28 },
    rearWheel: { diameter: 21, width: 10, offset: 46 },
    frontTire: "295/35R21",
    rearTire: "295/35R21",
    boltPattern: "5x112",
    isStaggered: false,
  },
  "A-Class AMG": {
    frontWheel: { diameter: 18, width: 7.5, offset: 52 },
    rearWheel: { diameter: 18, width: 7.5, offset: 52 },
    frontTire: "235/45R18",
    rearTire: "235/45R18",
    boltPattern: "5x112",
    isStaggered: false,
  },
};

// Coupe/Cabriolet defaults
const coupeDefaults: Record<string, typeof modelDefaults["E-Class"]> = {
  "E-Class Coupe": {
    frontWheel: { diameter: 18, width: 8, offset: 43 },
    rearWheel: { diameter: 18, width: 9, offset: 51 },
    frontTire: "245/45R18",
    rearTire: "275/40R18",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "E-Class Cabriolet": {
    frontWheel: { diameter: 18, width: 8, offset: 43 },
    rearWheel: { diameter: 18, width: 9, offset: 51 },
    frontTire: "245/45R18",
    rearTire: "275/40R18",
    boltPattern: "5x112",
    isStaggered: true,
  },
  "S-Class Coupe": {
    frontWheel: { diameter: 19, width: 8.5, offset: 35 },
    rearWheel: { diameter: 19, width: 9.5, offset: 45 },
    frontTire: "255/45R19",
    rearTire: "285/40R19",
    boltPattern: "5x112",
    isStaggered: true,
  },
};

async function main() {
  console.log("Mercedes-Benz Remaining Fitments - Pass 2\n");
  console.log("Fixing Base trims, AMG variants, and edge cases...\n");

  let updatedCount = 0;

  // Get all remaining missing records
  const missingRecords = await pool.query(`
    SELECT id, year, model, display_trim, modification_id
    FROM vehicle_fitments
    WHERE make ILIKE 'Mercedes%'
      AND (
        oem_tire_sizes IS NULL 
        OR oem_tire_sizes = '[]'::jsonb
        OR oem_tire_sizes = 'null'::jsonb
      )
    ORDER BY model, year
  `);

  console.log(`Found ${missingRecords.rows.length} records to fix\n`);

  for (const record of missingRecords.rows) {
    let specs = null;
    const model = record.model;
    const trim = record.display_trim || "";

    // Check for AMG models first
    if (model.includes("AMG") || trim.toLowerCase().includes("amg")) {
      // Try AMG-specific defaults
      if (amgDefaults[model]) {
        specs = amgDefaults[model];
      } else if (amgDefaults[model.replace(" AMG", "-AMG")]) {
        specs = amgDefaults[model.replace(" AMG", "-AMG")];
      } else {
        // Fall back to base model defaults with AMG specs if available
        const baseModel = model.replace(" AMG", "").replace("-AMG", "").replace("AMG ", "");
        if (amgDefaults[`${baseModel} AMG`]) {
          specs = amgDefaults[`${baseModel} AMG`];
        } else if (modelDefaults[baseModel]) {
          specs = modelDefaults[baseModel];
        }
      }
    }
    // Check for Coupe/Cabriolet
    else if (model.includes("Coupe") || model.includes("Cabriolet")) {
      specs = coupeDefaults[model] || modelDefaults["E-Class"];
    }
    // Use standard model defaults
    else if (modelDefaults[model]) {
      specs = modelDefaults[model];
    }

    if (!specs) {
      // Try partial matches
      for (const [modelName, modelSpecs] of Object.entries(modelDefaults)) {
        if (model.includes(modelName) || modelName.includes(model)) {
          specs = modelSpecs;
          break;
        }
      }
    }

    if (specs) {
      const oemWheelSizes = [
        {
          position: "front",
          diameter: specs.frontWheel.diameter,
          width: specs.frontWheel.width,
          offset: specs.frontWheel.offset,
          boltPattern: specs.boltPattern,
        },
        {
          position: "rear",
          diameter: specs.rearWheel.diameter,
          width: specs.rearWheel.width,
          offset: specs.rearWheel.offset,
          boltPattern: specs.boltPattern,
        },
      ];

      const oemTireSizes = [
        { position: "front", size: specs.frontTire },
        { position: "rear", size: specs.rearTire },
      ];

      await pool.query(`
        UPDATE vehicle_fitments SET
          oem_wheel_sizes = $1::jsonb,
          oem_tire_sizes = $2::jsonb,
          quality_tier = 'complete',
          source = 'google-ai-overview',
          updated_at = NOW()
        WHERE id = $3
      `, [
        JSON.stringify(oemWheelSizes),
        JSON.stringify(oemTireSizes),
        record.id,
      ]);

      console.log(`  Updated: ${record.year} ${record.model} ${trim || 'Base'}`);
      updatedCount++;
    } else {
      console.log(`  SKIPPED (no specs): ${record.year} ${record.model} ${trim || 'Base'}`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Updated: ${updatedCount} records`);

  // Check remaining
  const remaining = await pool.query(`
    SELECT COUNT(*) as count
    FROM vehicle_fitments
    WHERE make ILIKE 'Mercedes%'
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
  `);

  console.log(`Remaining missing: ${remaining.rows[0].count}`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
