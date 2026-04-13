/**
 * Promote Staged Fitment Data to Production
 * 
 * Takes verified, promotion-ready records from staging and inserts
 * them into the vehicle_fitment_configurations table.
 * 
 * Safety checks:
 * - Only promotes records with sourceCount >= 2
 * - Only promotes records with conflictStatus = "none"
 * - Skips records that already exist in config table
 * - Dry-run mode by default
 */

// Load env vars first
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { vehicleFitmentConfigurations } from "../../src/lib/fitment-db/schema";
import { normalizeMake, normalizeModel } from "../../src/lib/fitment-db/keys";
import { eq, and } from "drizzle-orm";
import * as fs from "fs/promises";
import * as path from "path";

// Create dedicated pool with explicit SSL
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);
import * as path from "path";

interface StagedRecord {
  year: number;
  make: string;
  model: string;
  trim: string;
  tireSize: string;
  wheelDiameter: number;
  wheelWidth: number | null;
  sourceCount: number;
  confidence: "high" | "medium" | "low";
  conflictStatus: "none" | "minor" | "major";
}

interface PilotOutput {
  promotionReady: StagedRecord[];
}

async function checkExisting(
  year: number,
  makeKey: string,
  modelKey: string,
  trim: string,
  wheelDiameter: number
): Promise<boolean> {
  const existing = await db
    .select({ id: vehicleFitmentConfigurations.id })
    .from(vehicleFitmentConfigurations)
    .where(
      and(
        eq(vehicleFitmentConfigurations.year, year),
        eq(vehicleFitmentConfigurations.makeKey, makeKey),
        eq(vehicleFitmentConfigurations.modelKey, modelKey),
        eq(vehicleFitmentConfigurations.displayTrim, trim),
        eq(vehicleFitmentConfigurations.wheelDiameter, wheelDiameter)
      )
    )
    .limit(1);
  
  return existing.length > 0;
}

async function promote(dryRun: boolean = true) {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  PROMOTE STAGED FITMENT DATA ${dryRun ? "(DRY RUN)" : "(LIVE)"}`);
  console.log("═══════════════════════════════════════════════════════════════");

  // Load staged data
  const stagingPath = path.join(__dirname, "staging", "pilot-results.json");
  
  try {
    await fs.access(stagingPath);
  } catch {
    console.error("❌ No staging data found. Run research-pilot.ts first.");
    process.exit(1);
  }

  const data = JSON.parse(await fs.readFile(stagingPath, "utf-8")) as PilotOutput;
  const records = data.promotionReady;

  console.log(`\nFound ${records.length} promotion-ready records\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    const makeKey = normalizeMake(record.make);
    const modelKey = normalizeModel(record.model);

    // Check if already exists
    const exists = await checkExisting(
      record.year,
      makeKey,
      modelKey,
      record.trim,
      record.wheelDiameter
    );

    if (exists) {
      console.log(`  ⏭️ SKIP (exists): ${record.year} ${record.make} ${record.model} ${record.trim} ${record.wheelDiameter}"`);
      skipped++;
      continue;
    }

    // Validate
    if (record.sourceCount < 2) {
      console.log(`  ⚠️ SKIP (sourceCount < 2): ${record.year} ${record.make} ${record.model} ${record.trim}`);
      skipped++;
      continue;
    }

    if (record.conflictStatus !== "none") {
      console.log(`  ⚠️ SKIP (conflict): ${record.year} ${record.make} ${record.model} ${record.trim}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  🔍 WOULD INSERT: ${record.year} ${record.make} ${record.model} ${record.trim} → ${record.tireSize} (${record.wheelDiameter}")`);
      inserted++;
    } else {
      try {
        await db.insert(vehicleFitmentConfigurations).values({
          year: record.year,
          makeKey,
          modelKey,
          displayTrim: record.trim,
          configurationKey: `web-research-${record.year}-${makeKey}-${modelKey}-${record.trim.toLowerCase().replace(/\s+/g, "-")}-${record.wheelDiameter}`,
          configurationLabel: `${record.wheelDiameter}" (Web Research)`,
          wheelDiameter: record.wheelDiameter,
          wheelWidth: record.wheelWidth ? String(record.wheelWidth) : null,
          tireSize: record.tireSize,
          axlePosition: "square",
          isDefault: true, // Web research gives us the stock/default size
          isOptional: false,
          source: "web_research",
          sourceConfidence: record.confidence,
          sourceNotes: `Researched via Claude, ${record.sourceCount} sources verified`,
        });
        console.log(`  ✅ INSERTED: ${record.year} ${record.make} ${record.model} ${record.trim} → ${record.tireSize}`);
        inserted++;
      } catch (err) {
        console.error(`  ❌ ERROR: ${record.year} ${record.make} ${record.model} ${record.trim}:`, err);
        errors++;
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  ${dryRun ? "Would insert" : "Inserted"}: ${inserted}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  
  if (dryRun) {
    console.log("\n  Run with --live to actually insert records.");
  }
}

// Parse args
const args = process.argv.slice(2);
const isLive = args.includes("--live");

promote(!isLive).catch(console.error);
