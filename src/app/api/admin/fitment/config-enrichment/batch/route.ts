/**
 * Batch Config-Table Enrichment Analysis
 * 
 * Analyzes multiple vehicles at once to identify which ones
 * need config-table enrichment.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitmentConfigurations, vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import { normalizeMake, normalizeModel } from "@/lib/fitment-db/keys";

export const runtime = "nodejs";
export const maxDuration = 120;

interface VehicleSummary {
  year: number;
  make: string;
  model: string;
  configTableRows: number;
  legacyRows: number;
  legacyUniqueSizes: number;
  configUniqueSizes: number;
  potentialEnrichments: number;
  status: "complete" | "needs_enrichment" | "no_config" | "legacy_only";
  source: "config" | "legacy" | "none";
}

interface BatchAnalysisResult {
  totalVehicles: number;
  needsEnrichment: number;
  complete: number;
  noConfig: number;
  vehicles: VehicleSummary[];
}

// List of vehicles from our USAF enrichment
const ENRICHED_VEHICLES = [
  { year: 2024, make: "Acura", model: "mdx" },
  { year: 2024, make: "Chevrolet", model: "tahoe" },
  { year: 2024, make: "Chevrolet", model: "traverse" },
  { year: 2024, make: "Dodge", model: "hornet" },
  { year: 2024, make: "GMC", model: "Sierra 1500" },
  { year: 2024, make: "Kia", model: "sportage" },
  { year: 2024, make: "Maserati", model: "granturismo" },
  { year: 2024, make: "Nissan", model: "pathfinder" },
  { year: 2024, make: "Nissan", model: "z" },
  { year: 2024, make: "Toyota", model: "Tacoma" },
  { year: 2024, make: "Volkswagen", model: "atlas" },
  { year: 2024, make: "Volvo", model: "s90" },
  { year: 2025, make: "Acura", model: "mdx" },
  { year: 2025, make: "Ford", model: "bronco" },
  { year: 2025, make: "Ford", model: "Bronco Sport" },
  { year: 2025, make: "Hyundai", model: "tucson" },
  { year: 2025, make: "Lincoln", model: "aviator" },
  { year: 2025, make: "Maserati", model: "granturismo" },
  { year: 2025, make: "Nissan", model: "pathfinder" },
  { year: 2025, make: "Nissan", model: "z" },
  { year: 2025, make: "Toyota", model: "4Runner" },
  { year: 2025, make: "Toyota", model: "Tacoma" },
  { year: 2025, make: "Volkswagen", model: "atlas" },
  { year: 2025, make: "Volkswagen", model: "tiguan" },
  { year: 2025, make: "Volvo", model: "s90" },
  { year: 2026, make: "Acura", model: "mdx" },
  { year: 2026, make: "Chevrolet", model: "traverse" },
  { year: 2026, make: "Ford", model: "bronco" },
  { year: 2026, make: "Lincoln", model: "aviator" },
  { year: 2026, make: "Maserati", model: "granturismo" },
  { year: 2026, make: "Nissan", model: "pathfinder" },
  { year: 2026, make: "Nissan", model: "z" },
  { year: 2026, make: "Toyota", model: "4runner" },
  { year: 2026, make: "Toyota", model: "Tacoma" },
  { year: 2026, make: "Volkswagen", model: "atlas" },
  { year: 2026, make: "Volkswagen", model: "tiguan" },
];

async function analyzeVehicle(
  year: number,
  make: string,
  model: string
): Promise<VehicleSummary> {
  const makeKey = normalizeMake(make);
  const modelKey = normalizeModel(model);

  // Count config table rows
  const configResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(vehicleFitmentConfigurations)
    .where(
      and(
        eq(vehicleFitmentConfigurations.year, year),
        eq(vehicleFitmentConfigurations.makeKey, makeKey),
        eq(vehicleFitmentConfigurations.modelKey, modelKey)
      )
    );
  const configTableRows = Number(configResult[0]?.count || 0);

  // Get unique config tire sizes
  const configSizesResult = await db
    .selectDistinct({ tireSize: vehicleFitmentConfigurations.tireSize })
    .from(vehicleFitmentConfigurations)
    .where(
      and(
        eq(vehicleFitmentConfigurations.year, year),
        eq(vehicleFitmentConfigurations.makeKey, makeKey),
        eq(vehicleFitmentConfigurations.modelKey, modelKey)
      )
    );
  const configUniqueSizes = configSizesResult.length;
  const configSizeSet = new Set(configSizesResult.map((r) => r.tireSize));

  // Count legacy fitment rows
  const legacyResult = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, year),
        ilike(vehicleFitments.make, makeKey),
        ilike(vehicleFitments.model, modelKey)
      )
    );
  const legacyRows = Number(legacyResult[0]?.count || 0);

  // Get unique legacy tire sizes
  const legacySizesResult = await db
    .select({ oemTireSizes: vehicleFitments.oemTireSizes })
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, year),
        ilike(vehicleFitments.make, makeKey),
        ilike(vehicleFitments.model, modelKey)
      )
    )
    .limit(50);

  const legacySizeSet = new Set<string>();
  for (const row of legacySizesResult) {
    const sizes = row.oemTireSizes as string[] | null;
    if (sizes) {
      for (const size of sizes) {
        legacySizeSet.add(size);
      }
    }
  }
  const legacyUniqueSizes = legacySizeSet.size;

  // Count potential enrichments (sizes in legacy but not in config)
  let potentialEnrichments = 0;
  for (const size of legacySizeSet) {
    if (!configSizeSet.has(size)) {
      potentialEnrichments++;
    }
  }

  // Determine status
  let status: VehicleSummary["status"];
  let source: VehicleSummary["source"];

  if (configTableRows === 0) {
    if (legacyRows > 0) {
      status = "legacy_only";
      source = "legacy";
    } else {
      status = "no_config";
      source = "none";
    }
  } else if (potentialEnrichments === 0) {
    status = "complete";
    source = "config";
  } else {
    status = "needs_enrichment";
    source = "config";
  }

  return {
    year,
    make,
    model,
    configTableRows,
    legacyRows,
    legacyUniqueSizes,
    configUniqueSizes,
    potentialEnrichments,
    status,
    source,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "enriched";

  let vehiclesToAnalyze = ENRICHED_VEHICLES;

  // Could expand to other scopes in future
  if (scope === "all") {
    // TODO: Fetch all vehicles from DB
    vehiclesToAnalyze = ENRICHED_VEHICLES;
  }

  const results: VehicleSummary[] = [];

  for (const v of vehiclesToAnalyze) {
    try {
      const summary = await analyzeVehicle(v.year, v.make, v.model);
      results.push(summary);
    } catch (error) {
      console.error(`Failed to analyze ${v.year} ${v.make} ${v.model}:`, error);
      results.push({
        year: v.year,
        make: v.make,
        model: v.model,
        configTableRows: 0,
        legacyRows: 0,
        legacyUniqueSizes: 0,
        configUniqueSizes: 0,
        potentialEnrichments: 0,
        status: "no_config",
        source: "none",
      });
    }
  }

  // Sort by status priority
  const statusPriority: Record<string, number> = {
    needs_enrichment: 0,
    legacy_only: 1,
    complete: 2,
    no_config: 3,
  };
  results.sort(
    (a, b) => statusPriority[a.status] - statusPriority[b.status]
  );

  const batchResult: BatchAnalysisResult = {
    totalVehicles: results.length,
    needsEnrichment: results.filter((r) => r.status === "needs_enrichment").length,
    complete: results.filter((r) => r.status === "complete").length,
    noConfig: results.filter(
      (r) => r.status === "no_config" || r.status === "legacy_only"
    ).length,
    vehicles: results,
  };

  return NextResponse.json(batchResult);
}
