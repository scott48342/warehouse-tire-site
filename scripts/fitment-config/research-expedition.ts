/**
 * Ford Expedition Fitment Research
 * 
 * Re-researches Expedition with explicit trim names to replace null-trim configs.
 * Uses tiresize.com as verified source.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Ford Expedition OEM specs by trim (verified from multiple sources)
// 4th Gen: 2018-2024
const EXPEDITION_SPECS: Record<string, {
  years: number[];
  trims: Record<string, { wheelDiameter: number; wheelWidth: number; tireSize: string; isDefault: boolean }[]>;
}> = {
  "expedition": {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: {
      // Base trims - 18" standard
      "XL": [
        { wheelDiameter: 18, wheelWidth: 8.5, tireSize: "275/65R18", isDefault: true },
      ],
      "XLT": [
        { wheelDiameter: 18, wheelWidth: 8.5, tireSize: "275/65R18", isDefault: true },
      ],
      // Mid trims - 20" standard
      "Limited": [
        { wheelDiameter: 20, wheelWidth: 8.5, tireSize: "275/55R20", isDefault: true },
      ],
      // Premium trims - 22" standard
      "King Ranch": [
        { wheelDiameter: 22, wheelWidth: 9, tireSize: "285/45R22", isDefault: true },
      ],
      "Platinum": [
        { wheelDiameter: 22, wheelWidth: 9, tireSize: "285/45R22", isDefault: true },
      ],
      // Special trims
      "Timberline": [
        { wheelDiameter: 18, wheelWidth: 8.5, tireSize: "275/65R18", isDefault: true },
      ],
      "Stealth Edition": [
        { wheelDiameter: 22, wheelWidth: 9, tireSize: "285/45R22", isDefault: true },
      ],
    }
  },
  "expedition-max": {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: {
      "XL": [
        { wheelDiameter: 18, wheelWidth: 8.5, tireSize: "275/65R18", isDefault: true },
      ],
      "XLT": [
        { wheelDiameter: 18, wheelWidth: 8.5, tireSize: "275/65R18", isDefault: true },
      ],
      "Limited": [
        { wheelDiameter: 20, wheelWidth: 8.5, tireSize: "275/55R20", isDefault: true },
      ],
      "King Ranch": [
        { wheelDiameter: 22, wheelWidth: 9, tireSize: "285/45R22", isDefault: true },
      ],
      "Platinum": [
        { wheelDiameter: 22, wheelWidth: 9, tireSize: "285/45R22", isDefault: true },
      ],
    }
  }
};

async function deleteNullTrimConfigs(): Promise<number> {
  const result = await pool.query(`
    DELETE FROM vehicle_fitment_configurations
    WHERE make_key = 'ford' 
    AND model_key IN ('expedition', 'expedition-max')
    AND (display_trim IS NULL OR display_trim = '')
    RETURNING id
  `);
  return result.rowCount || 0;
}

async function insertTrimConfig(
  year: number,
  model: string,
  trim: string,
  config: { wheelDiameter: number; wheelWidth: number; tireSize: string; isDefault: boolean }
): Promise<boolean> {
  // Check if already exists
  const existing = await pool.query(`
    SELECT id FROM vehicle_fitment_configurations
    WHERE year = $1 AND make_key = 'ford' AND model_key = $2 AND display_trim = $3 AND wheel_diameter = $4
  `, [year, model, trim, config.wheelDiameter]);
  
  if (existing.rows.length > 0) {
    return false; // Skip duplicate
  }
  
  const configKey = `web-research-${year}-ford-${model}-${trim.toLowerCase().replace(/\s+/g, '-')}-${config.wheelDiameter}`;
  const configLabel = `${config.wheelDiameter}" (Web Research)`;
  
  await pool.query(`
    INSERT INTO vehicle_fitment_configurations (
      year, make_key, model_key, display_trim, modification_id,
      configuration_key, configuration_label,
      wheel_diameter, wheel_width, tire_size,
      axle_position, is_default, is_optional,
      source, source_confidence, source_notes,
      created_at, updated_at
    ) VALUES (
      $1, 'ford', $2, $3, NULL,
      $4, $5,
      $6, $7, $8,
      'square', $9, $10,
      'web_research', 'high', 'Ford Expedition OEM specs - tiresize.com verified',
      NOW(), NOW()
    )
  `, [
    year, model, trim,
    configKey, configLabel,
    config.wheelDiameter, config.wheelWidth, config.tireSize,
    config.isDefault, !config.isDefault
  ]);
  
  return true;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Ford Expedition Fitment Research");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log("");
  
  if (!dryRun) {
    // Delete null-trim configs first
    const deleted = await deleteNullTrimConfigs();
    console.log(`Deleted ${deleted} null-trim Expedition configs`);
    console.log("");
  }
  
  let inserted = 0;
  let skipped = 0;
  
  for (const [model, data] of Object.entries(EXPEDITION_SPECS)) {
    console.log(`\n${model.toUpperCase()}:`);
    
    for (const year of data.years) {
      for (const [trim, configs] of Object.entries(data.trims)) {
        for (const config of configs) {
          if (dryRun) {
            console.log(`  [DRY] ${year} ${trim}: ${config.wheelDiameter}" / ${config.tireSize}`);
            inserted++;
          } else {
            const success = await insertTrimConfig(year, model, trim, config);
            if (success) {
              console.log(`  ✅ ${year} ${trim}: ${config.wheelDiameter}" / ${config.tireSize}`);
              inserted++;
            } else {
              console.log(`  ⏭️  ${year} ${trim}: already exists`);
              skipped++;
            }
          }
        }
      }
    }
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped:  ${skipped}`);
  
  if (dryRun) {
    console.log("\n  Run without --dry-run to insert records.");
  }
  
  await pool.end();
}

main().catch(console.error);
