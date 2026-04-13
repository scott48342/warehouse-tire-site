/**
 * Backfill Fitment Configurations
 * 
 * Populates vehicle_fitment_configurations table from existing fitment data.
 * 
 * RULES:
 * - Only create configuration rows when wheel/tire pairing is trustworthy
 * - Do NOT guess aggressively
 * - If pairing is ambiguous, skip and log
 * - Do NOT overwrite existing data
 * - Script must be idempotent (safe to run multiple times)
 * 
 * Usage:
 *   npx tsx scripts/fitment-config/backfill-configurations.ts
 *   npx tsx scripts/fitment-config/backfill-configurations.ts --dry-run
 *   npx tsx scripts/fitment-config/backfill-configurations.ts --make=cadillac
 */

// Load environment variables first
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { vehicleFitments, vehicleFitmentConfigurations } from "../../src/lib/fitment-db/schema";

// Create dedicated pool with explicit SSL
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);
import { eq, and, inArray, sql } from "drizzle-orm";
import { extractRimDiameter } from "../../src/lib/tires/wheelDiameterFilter";

// ============================================================================
// Configuration
// ============================================================================

interface VerifiedVehicleConfig {
  make: string;
  model: string;
  years: { min: number; max: number };
  configurations: {
    key: string;
    label: string;
    wheelDiameter: number;
    wheelWidth?: number;
    wheelOffsetMm?: number;
    tireSizes: string[];
    isDefault?: boolean;
    isOptional?: boolean;
  }[];
  notes?: string;
}

/**
 * Verified OEM configurations for high-value platforms.
 * These are KNOWN correct pairings from manufacturer data.
 * 
 * ADD MORE PLATFORMS HERE as they are verified.
 */
const VERIFIED_CONFIGURATIONS: VerifiedVehicleConfig[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CADILLAC ESCALADE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: "cadillac",
    model: "escalade",
    years: { min: 2021, max: 2026 },
    configurations: [
      {
        key: "22-standard",
        label: '22" Standard',
        wheelDiameter: 22,
        wheelWidth: 9.0,
        wheelOffsetMm: 28,
        tireSizes: ["P275/50R22", "275/50R22"],
        isDefault: true,
      },
      {
        key: "22-sport",
        label: '22" Sport',
        wheelDiameter: 22,
        wheelWidth: 9.0,
        wheelOffsetMm: 28,
        tireSizes: ["P285/45R22", "285/45R22"],
        isOptional: true,
      },
      {
        key: "24-premium",
        label: '24" Premium',
        wheelDiameter: 24,
        wheelWidth: 10.0,
        wheelOffsetMm: 24,
        tireSizes: ["P285/40R24", "285/40R24"],
        isOptional: true,
      },
    ],
    notes: "Verified from GM OEM specs",
  },
  {
    make: "cadillac",
    model: "escalade esv",
    years: { min: 2021, max: 2026 },
    configurations: [
      {
        key: "22-standard",
        label: '22" Standard',
        wheelDiameter: 22,
        wheelWidth: 9.0,
        wheelOffsetMm: 28,
        tireSizes: ["P275/50R22", "275/50R22"],
        isDefault: true,
      },
      {
        key: "24-premium",
        label: '24" Premium',
        wheelDiameter: 24,
        wheelWidth: 10.0,
        wheelOffsetMm: 24,
        tireSizes: ["P285/40R24", "285/40R24"],
        isOptional: true,
      },
    ],
    notes: "Verified from GM OEM specs",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GMC YUKON
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: "gmc",
    model: "yukon",
    years: { min: 2021, max: 2026 },
    configurations: [
      {
        key: "20-standard",
        label: '20" Standard',
        wheelDiameter: 20,
        wheelWidth: 9.0,
        wheelOffsetMm: 24,
        tireSizes: ["P275/60R20", "275/60R20"],
        isDefault: true,
      },
      {
        key: "22-denali",
        label: '22" Denali',
        wheelDiameter: 22,
        wheelWidth: 9.0,
        wheelOffsetMm: 28,
        tireSizes: ["P275/50R22", "275/50R22", "P285/45R22", "285/45R22"],
        isOptional: true,
      },
      {
        key: "24-denali-ultimate",
        label: '24" Denali Ultimate',
        wheelDiameter: 24,
        wheelWidth: 10.0,
        wheelOffsetMm: 24,
        tireSizes: ["P285/40R24", "285/40R24"],
        isOptional: true,
      },
    ],
    notes: "Verified from GM OEM specs",
  },
  {
    make: "gmc",
    model: "yukon xl",
    years: { min: 2021, max: 2026 },
    configurations: [
      {
        key: "20-standard",
        label: '20" Standard',
        wheelDiameter: 20,
        wheelWidth: 9.0,
        wheelOffsetMm: 24,
        tireSizes: ["P275/60R20", "275/60R20"],
        isDefault: true,
      },
      {
        key: "22-denali",
        label: '22" Denali',
        wheelDiameter: 22,
        wheelWidth: 9.0,
        wheelOffsetMm: 28,
        tireSizes: ["P275/50R22", "275/50R22"],
        isOptional: true,
      },
    ],
    notes: "Verified from GM OEM specs",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CHEVROLET TAHOE / SUBURBAN
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: "chevrolet",
    model: "tahoe",
    years: { min: 2021, max: 2026 },
    configurations: [
      {
        key: "20-standard",
        label: '20" Standard',
        wheelDiameter: 20,
        wheelWidth: 9.0,
        wheelOffsetMm: 24,
        tireSizes: ["P275/60R20", "275/60R20"],
        isDefault: true,
      },
      {
        key: "22-rst",
        label: '22" RST/High Country',
        wheelDiameter: 22,
        wheelWidth: 9.0,
        wheelOffsetMm: 28,
        tireSizes: ["P275/50R22", "275/50R22", "P285/45R22", "285/45R22"],
        isOptional: true,
      },
      {
        key: "24-high-country",
        label: '24" High Country',
        wheelDiameter: 24,
        wheelWidth: 10.0,
        wheelOffsetMm: 24,
        tireSizes: ["P285/40R24", "285/40R24"],
        isOptional: true,
      },
    ],
    notes: "Verified from GM OEM specs",
  },
  {
    make: "chevrolet",
    model: "suburban",
    years: { min: 2021, max: 2026 },
    configurations: [
      {
        key: "20-standard",
        label: '20" Standard',
        wheelDiameter: 20,
        wheelWidth: 9.0,
        wheelOffsetMm: 24,
        tireSizes: ["P275/60R20", "275/60R20"],
        isDefault: true,
      },
      {
        key: "22-high-country",
        label: '22" High Country',
        wheelDiameter: 22,
        wheelWidth: 9.0,
        wheelOffsetMm: 28,
        tireSizes: ["P275/50R22", "275/50R22"],
        isOptional: true,
      },
    ],
    notes: "Verified from GM OEM specs",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LINCOLN NAVIGATOR
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: "lincoln",
    model: "navigator",
    years: { min: 2018, max: 2026 },
    configurations: [
      {
        key: "22-standard",
        label: '22" Standard',
        wheelDiameter: 22,
        wheelWidth: 9.5,
        wheelOffsetMm: 44,
        tireSizes: ["P285/45R22", "285/45R22"],
        isDefault: true,
      },
      {
        key: "24-black-label",
        label: '24" Black Label',
        wheelDiameter: 24,
        wheelWidth: 10.0,
        wheelOffsetMm: 44,
        tireSizes: ["P285/40R24", "285/40R24"],
        isOptional: true,
      },
    ],
    notes: "Verified from Ford OEM specs",
  },
  {
    make: "lincoln",
    model: "navigator l",
    years: { min: 2018, max: 2026 },
    configurations: [
      {
        key: "22-standard",
        label: '22" Standard',
        wheelDiameter: 22,
        wheelWidth: 9.5,
        wheelOffsetMm: 44,
        tireSizes: ["P285/45R22", "285/45R22"],
        isDefault: true,
      },
      {
        key: "24-black-label",
        label: '24" Black Label',
        wheelDiameter: 24,
        wheelWidth: 10.0,
        wheelOffsetMm: 44,
        tireSizes: ["P285/40R24", "285/40R24"],
        isOptional: true,
      },
    ],
    notes: "Verified from Ford OEM specs",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FORD EXPEDITION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: "ford",
    model: "expedition",
    years: { min: 2018, max: 2026 },
    configurations: [
      {
        key: "20-standard",
        label: '20" Standard',
        wheelDiameter: 20,
        wheelWidth: 8.5,
        wheelOffsetMm: 44,
        tireSizes: ["P275/55R20", "275/55R20"],
        isDefault: true,
      },
      {
        key: "22-platinum",
        label: '22" Platinum',
        wheelDiameter: 22,
        wheelWidth: 9.5,
        wheelOffsetMm: 44,
        tireSizes: ["P285/45R22", "285/45R22"],
        isOptional: true,
      },
    ],
    notes: "Verified from Ford OEM specs",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RAM 1500
  // ═══════════════════════════════════════════════════════════════════════════
  {
    make: "ram",
    model: "1500",
    years: { min: 2019, max: 2026 },
    configurations: [
      {
        key: "20-standard",
        label: '20" Standard',
        wheelDiameter: 20,
        wheelWidth: 9.0,
        wheelOffsetMm: 19,
        tireSizes: ["P275/55R20", "275/55R20", "275/60R20"],
        isDefault: true,
      },
      {
        key: "22-limited",
        label: '22" Limited/Longhorn',
        wheelDiameter: 22,
        wheelWidth: 9.0,
        wheelOffsetMm: 19,
        tireSizes: ["P285/45R22", "285/45R22"],
        isOptional: true,
      },
    ],
    notes: "Verified from Ram OEM specs",
  },
];

// ============================================================================
// Backfill Logic
// ============================================================================

interface BackfillStats {
  totalVehicles: number;
  configurationsCreated: number;
  vehiclesSkipped: number;
  vehiclesWithExistingConfigs: number;
  errors: string[];
}

async function backfillConfigurations(options: {
  dryRun?: boolean;
  makeFilter?: string;
}): Promise<BackfillStats> {
  const { dryRun = false, makeFilter } = options;
  
  const stats: BackfillStats = {
    totalVehicles: 0,
    configurationsCreated: 0,
    vehiclesSkipped: 0,
    vehiclesWithExistingConfigs: 0,
    errors: [],
  };
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("FITMENT CONFIGURATION BACKFILL");
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`Make filter: ${makeFilter || "all"}`);
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  // Filter configurations if make specified
  const configs = makeFilter
    ? VERIFIED_CONFIGURATIONS.filter(c => c.make.toLowerCase() === makeFilter.toLowerCase())
    : VERIFIED_CONFIGURATIONS;
  
  for (const vehicleConfig of configs) {
    console.log(`\n[${vehicleConfig.make.toUpperCase()} ${vehicleConfig.model.toUpperCase()}]`);
    console.log(`  Years: ${vehicleConfig.years.min}-${vehicleConfig.years.max}`);
    console.log(`  Configurations: ${vehicleConfig.configurations.length}`);
    
    // Process each year
    for (let year = vehicleConfig.years.min; year <= vehicleConfig.years.max; year++) {
      stats.totalVehicles++;
      
      const makeKey = vehicleConfig.make.toLowerCase();
      const modelKey = vehicleConfig.model.toLowerCase().replace(/\s+/g, "-");
      
      // Check for existing configs
      const existingConfigs = await db
        .select({ count: sql<number>`count(*)` })
        .from(vehicleFitmentConfigurations)
        .where(
          and(
            eq(vehicleFitmentConfigurations.year, year),
            eq(vehicleFitmentConfigurations.makeKey, makeKey),
            eq(vehicleFitmentConfigurations.modelKey, modelKey)
          )
        );
      
      if (existingConfigs[0]?.count > 0) {
        console.log(`    ${year}: SKIP (${existingConfigs[0].count} configs exist)`);
        stats.vehiclesWithExistingConfigs++;
        continue;
      }
      
      // Find matching fitment record (optional - configs can exist without it)
      const fitmentRecord = await db
        .select({ id: vehicleFitments.id })
        .from(vehicleFitments)
        .where(
          and(
            eq(vehicleFitments.year, year),
            eq(sql`lower(${vehicleFitments.make})`, makeKey),
            eq(sql`lower(${vehicleFitments.model})`, modelKey)
          )
        )
        .limit(1);
      
      const fitmentId = fitmentRecord[0]?.id ?? null;
      
      // Create configuration rows
      const rowsToInsert = [];
      
      for (const config of vehicleConfig.configurations) {
        // For each tire size in the config, create a row
        for (const tireSize of config.tireSizes) {
          rowsToInsert.push({
            vehicleFitmentId: fitmentId,
            year,
            makeKey,
            modelKey,
            modificationId: null, // Will be linked later when trim-specific
            displayTrim: null,
            configurationKey: config.key,
            configurationLabel: config.label,
            wheelDiameter: config.wheelDiameter,
            wheelWidth: config.wheelWidth?.toString() ?? null,
            wheelOffsetMm: config.wheelOffsetMm?.toString() ?? null,
            tireSize,
            axlePosition: "square",
            isDefault: config.isDefault ?? false,
            isOptional: config.isOptional ?? false,
            source: "manual",
            sourceConfidence: "high",
            sourceNotes: vehicleConfig.notes ?? null,
          });
        }
      }
      
      if (dryRun) {
        console.log(`    ${year}: WOULD CREATE ${rowsToInsert.length} configs`);
        stats.configurationsCreated += rowsToInsert.length;
      } else {
        try {
          await db.insert(vehicleFitmentConfigurations).values(rowsToInsert);
          console.log(`    ${year}: CREATED ${rowsToInsert.length} configs`);
          stats.configurationsCreated += rowsToInsert.length;
        } catch (err) {
          const errMsg = `${year} ${vehicleConfig.make} ${vehicleConfig.model}: ${err}`;
          console.error(`    ${year}: ERROR - ${err}`);
          stats.errors.push(errMsg);
        }
      }
    }
  }
  
  return stats;
}

// ============================================================================
// Audit Report
// ============================================================================

async function generateAuditReport(): Promise<void> {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("CONFIGURATION AUDIT REPORT");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  // Count configs by make
  const configsByMake = await db
    .select({
      make: vehicleFitmentConfigurations.makeKey,
      count: sql<number>`count(*)`,
    })
    .from(vehicleFitmentConfigurations)
    .groupBy(vehicleFitmentConfigurations.makeKey)
    .orderBy(sql`count(*) desc`);
  
  console.log("Configurations by Make:");
  for (const row of configsByMake) {
    console.log(`  ${row.make}: ${row.count}`);
  }
  
  // Count by confidence level
  const configsByConfidence = await db
    .select({
      confidence: vehicleFitmentConfigurations.sourceConfidence,
      count: sql<number>`count(*)`,
    })
    .from(vehicleFitmentConfigurations)
    .groupBy(vehicleFitmentConfigurations.sourceConfidence);
  
  console.log("\nConfigurations by Confidence:");
  for (const row of configsByConfidence) {
    console.log(`  ${row.confidence}: ${row.count}`);
  }
  
  // Vehicles with multiple configs (good!)
  const multiConfigVehicles = await db
    .select({
      year: vehicleFitmentConfigurations.year,
      make: vehicleFitmentConfigurations.makeKey,
      model: vehicleFitmentConfigurations.modelKey,
      diameters: sql<string>`array_agg(distinct ${vehicleFitmentConfigurations.wheelDiameter})`,
      count: sql<number>`count(distinct ${vehicleFitmentConfigurations.wheelDiameter})`,
    })
    .from(vehicleFitmentConfigurations)
    .groupBy(
      vehicleFitmentConfigurations.year,
      vehicleFitmentConfigurations.makeKey,
      vehicleFitmentConfigurations.modelKey
    )
    .having(sql`count(distinct ${vehicleFitmentConfigurations.wheelDiameter}) > 1`)
    .limit(20);
  
  console.log("\nVehicles with Multiple Wheel Diameters (sample):");
  for (const row of multiConfigVehicles) {
    console.log(`  ${row.year} ${row.make} ${row.model}: ${row.diameters}`);
  }
  
  // Total summary
  const total = await db
    .select({ count: sql<number>`count(*)` })
    .from(vehicleFitmentConfigurations);
  
  console.log(`\nTotal Configuration Rows: ${total[0]?.count ?? 0}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const makeArg = args.find(a => a.startsWith("--make="));
  const makeFilter = makeArg?.split("=")[1];
  const auditOnly = args.includes("--audit");
  
  if (auditOnly) {
    await generateAuditReport();
    process.exit(0);
  }
  
  const stats = await backfillConfigurations({ dryRun, makeFilter });
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("BACKFILL SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Total vehicles processed: ${stats.totalVehicles}`);
  console.log(`Configurations created: ${stats.configurationsCreated}`);
  console.log(`Vehicles skipped (existing): ${stats.vehiclesWithExistingConfigs}`);
  console.log(`Errors: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log("\nErrors:");
    for (const err of stats.errors) {
      console.log(`  - ${err}`);
    }
  }
  
  if (dryRun) {
    console.log("\n⚠️  DRY RUN - No changes were made. Run without --dry-run to apply.");
  }
  
  // Generate audit report
  await generateAuditReport();
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Fatal error:", err);
    await pool.end();
    process.exit(1);
  });
