/**
 * Safe Promotion of Verified Fitment Data
 * 
 * RULES:
 * - Insert ONLY records with conflictStatus === "none"
 * - Skip any records that already exist in the config table
 * - Skip and log any constraint violations (don't force)
 * - Full audit log of all actions
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { vehicleFitmentConfigurations } from "../../src/lib/fitment-db/schema";
import { normalizeMake, normalizeModel } from "../../src/lib/fitment-db/keys";
import { eq, and } from "drizzle-orm";
import * as fs from "fs/promises";

// Create pool - Prisma Postgres handles SSL via connection string
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});
const db = drizzle(pool);

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
  metadata: {
    trimCount: number;
    conflictCount: number;
  };
  candidates: StagedRecord[];
}

interface AuditLog {
  promotedAt: string;
  mode: "dry-run" | "live";
  totalCandidates: number;
  conflictsExcluded: number;
  insertedRecords: Array<{
    year: number;
    make: string;
    model: string;
    trim: string;
    tireSize: string;
    wheelDiameter: number;
  }>;
  skippedExisting: Array<{
    year: number;
    make: string;
    model: string;
    trim: string;
    wheelDiameter: number;
    reason: string;
  }>;
  errors: Array<{
    year: number;
    make: string;
    model: string;
    trim: string;
    error: string;
  }>;
  summary: {
    inserted: number;
    skippedExisting: number;
    skippedConflict: number;
    errors: number;
  };
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
  console.log(`  SAFE FITMENT PROMOTION ${dryRun ? "(DRY RUN)" : "(LIVE)"}`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\nRules:");
  console.log("  • Insert ONLY conflictStatus === 'none' records");
  console.log("  • Skip existing records (no overwrite)");
  console.log("  • Log all errors, don't force inserts");
  console.log("");

  // Load staged data
  const stagingPath = path.join(__dirname, "staging", "pilot-results.json");
  const data = JSON.parse(await fs.readFile(stagingPath, "utf-8")) as PilotOutput;
  
  // Separate conflicts from non-conflicts
  const nonConflicting = data.candidates.filter(r => r.conflictStatus === "none");
  const conflicts = data.candidates.filter(r => r.conflictStatus !== "none");

  console.log(`Total candidates: ${data.candidates.length}`);
  console.log(`Non-conflicting: ${nonConflicting.length}`);
  console.log(`Conflicts EXCLUDED: ${conflicts.length}`);
  console.log("");

  const auditLog: AuditLog = {
    promotedAt: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "live",
    totalCandidates: data.candidates.length,
    conflictsExcluded: conflicts.length,
    insertedRecords: [],
    skippedExisting: [],
    errors: [],
    summary: {
      inserted: 0,
      skippedExisting: 0,
      skippedConflict: conflicts.length,
      errors: 0,
    },
  };

  let processed = 0;
  for (const record of nonConflicting) {
    processed++;
    if (processed % 50 === 0) {
      console.log(`  Processing ${processed}/${nonConflicting.length}...`);
    }

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
      auditLog.skippedExisting.push({
        year: record.year,
        make: record.make,
        model: record.model,
        trim: record.trim,
        wheelDiameter: record.wheelDiameter,
        reason: "already_exists",
      });
      auditLog.summary.skippedExisting++;
      continue;
    }

    if (dryRun) {
      auditLog.insertedRecords.push({
        year: record.year,
        make: record.make,
        model: record.model,
        trim: record.trim,
        tireSize: record.tireSize,
        wheelDiameter: record.wheelDiameter,
      });
      auditLog.summary.inserted++;
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
          isDefault: true,
          isOptional: false,
          source: "web_research",
          sourceConfidence: record.confidence,
          sourceNotes: `Researched via Claude, ${record.sourceCount} sources verified`,
        });
        auditLog.insertedRecords.push({
          year: record.year,
          make: record.make,
          model: record.model,
          trim: record.trim,
          tireSize: record.tireSize,
          wheelDiameter: record.wheelDiameter,
        });
        auditLog.summary.inserted++;
      } catch (err: any) {
        auditLog.errors.push({
          year: record.year,
          make: record.make,
          model: record.model,
          trim: record.trim,
          error: err.message || String(err),
        });
        auditLog.summary.errors++;
        console.log(`  ⚠️ Error (skipped): ${record.year} ${record.make} ${record.model} ${record.trim}: ${err.message}`);
      }
    }
  }

  // Save audit log
  const auditPath = path.join(__dirname, "staging", `promotion-audit-${dryRun ? "dry" : "live"}-${Date.now()}.json`);
  await fs.writeFile(auditPath, JSON.stringify(auditLog, null, 2));

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  ${dryRun ? "Would insert" : "Inserted"}: ${auditLog.summary.inserted}`);
  console.log(`  Skipped (already exists): ${auditLog.summary.skippedExisting}`);
  console.log(`  Conflicts excluded: ${auditLog.summary.skippedConflict}`);
  console.log(`  Errors: ${auditLog.summary.errors}`);
  console.log(`\n  Audit log: ${auditPath}`);

  // Sample inserted records
  if (auditLog.insertedRecords.length > 0) {
    console.log("\n  Sample inserted records:");
    const samples = auditLog.insertedRecords.slice(0, 10);
    for (const r of samples) {
      console.log(`    ${r.year} ${r.make} ${r.model} ${r.trim} → ${r.tireSize} (${r.wheelDiameter}")`);
    }
    if (auditLog.insertedRecords.length > 10) {
      console.log(`    ... and ${auditLog.insertedRecords.length - 10} more`);
    }
  }

  if (dryRun) {
    console.log("\n  Run with --live to actually insert records.");
  }

  await pool.end();
}

// Parse args
const args = process.argv.slice(2);
const isLive = args.includes("--live");

promote(!isLive).catch(err => {
  console.error(err);
  process.exit(1);
});
