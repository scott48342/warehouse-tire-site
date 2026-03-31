/**
 * Import Toyota Tundra fitment data from generation cache files
 * 
 * Usage: npx tsx scripts/import-tundra.ts
 */

import * as fs from "fs";
import * as path from "path";
import { importFromJson, type FitmentInput } from "../src/lib/fitment-db/fitmentManualImport";

const CACHE_DIR = path.join(process.cwd(), "..", "fitment-research", "cache", "Toyota", "Tundra");
const GEN_FILE = path.join(process.cwd(), "..", "fitment-research", "generations", "Toyota", "Tundra.json");

interface GenerationData {
  make: string;
  model: string;
  generations: Record<string, {
    name: string;
    years: number[];
    trims: string[];
    fitment: {
      bolt_pattern: string;
      center_bore_mm: number;
      thread_size: string;
      seat_type: string;
      offset_min_mm: number;
      offset_max_mm: number;
      oem_wheel_sizes: Array<{ size: string; offset: number; tires: string[] }>;
      oem_tire_sizes: string[];
    };
  }>;
}

async function main() {
  console.log("=== Toyota Tundra Fitment Import ===\n");

  // Read generation file
  if (!fs.existsSync(GEN_FILE)) {
    console.error(`Generation file not found: ${GEN_FILE}`);
    process.exit(1);
  }

  const genData: GenerationData = JSON.parse(fs.readFileSync(GEN_FILE, "utf-8"));
  const fitmentInputs: FitmentInput[] = [];

  // Process each generation
  for (const [genKey, gen] of Object.entries(genData.generations)) {
    console.log(`Processing ${gen.name}...`);
    console.log(`  Years: ${gen.years.join(", ")}`);
    console.log(`  Bolt Pattern: ${gen.fitment.bolt_pattern}`);
    console.log(`  Trims: ${gen.trims.join(", ")}`);

    // Create a fitment record for each year + trim combination
    for (const year of gen.years) {
      for (const trim of gen.trims) {
        fitmentInputs.push({
          year,
          make: genData.make,
          model: genData.model,
          trim,
          displayTrim: trim,
          submodel: gen.name,
          boltPattern: gen.fitment.bolt_pattern,
          centerBoreMm: gen.fitment.center_bore_mm,
          threadSize: gen.fitment.thread_size,
          seatType: gen.fitment.seat_type,
          offsetMinMm: gen.fitment.offset_min_mm,
          offsetMaxMm: gen.fitment.offset_max_mm,
          oemWheelSizes: gen.fitment.oem_wheel_sizes.map(w => w.size),
          oemTireSizes: gen.fitment.oem_tire_sizes,
          source: "generation_import",
          sourceNotes: `Imported from ${genKey} generation data`,
          confidence: "high",
        });
      }
    }
    console.log("");
  }

  console.log(`Total records to import: ${fitmentInputs.length}\n`);

  // Import
  console.log("Importing to database...");
  const result = await importFromJson(fitmentInputs);

  console.log("\n=== Import Results ===");
  console.log(`Total: ${result.total}`);
  console.log(`Inserted: ${result.inserted}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    for (const err of result.errors.slice(0, 10)) {
      console.log(`  Row ${err.row}: ${err.vehicle} - ${err.error}`);
    }
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more errors`);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
