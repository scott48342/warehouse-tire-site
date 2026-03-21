import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and } from "drizzle-orm";
import { normalizeMake, normalizeModel, slugify, makePayloadChecksum } from "@/lib/fitment-db/keys";
import { normalizeTrimLabel } from "@/lib/trimNormalize";
import { applyOverrides } from "@/lib/fitment-db/applyOverrides";
import { fitmentSourceRecords } from "@/lib/fitment-db/schema";
import submodelSupplements from "@/data/submodel-supplements.json";

export const runtime = "nodejs";

// ============================================================================
// Types
// ============================================================================

type SubmodelEntry = { value: string; label: string };
type YearRangeMap = { [yearRange: string]: SubmodelEntry[] };
type ModelMap = { [model: string]: YearRangeMap };
type MakeMap = { [make: string]: ModelMap };

type TrimOption = { value: string; label: string };

interface TrimResponse {
  results: TrimOption[];
  source?: "db" | "api" | "supplement" | "empty";
  count?: number;
  overridesApplied?: boolean;
  cached?: boolean;
}

// ============================================================================
// Supplement Lookup (fallback for vehicles without good API data)
// ============================================================================

function getSubmodelSupplement(year: number, make: string, model: string): SubmodelEntry[] | null {
  const makeData = (submodelSupplements as MakeMap)[make.toLowerCase()];
  if (!makeData) return null;

  const modelData = makeData[model.toLowerCase()];
  if (!modelData) return null;

  for (const [range, entries] of Object.entries(modelData)) {
    const [startStr, endStr] = range.split("-");
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (year >= start && year <= end) {
      return entries;
    }
  }

  return null;
}

// ============================================================================
// Wheel-Size API
// ============================================================================

const WHEELSIZE_API_BASE = "https://api.wheel-size.com/v2/";

interface WheelSizeModification {
  slug: string;
  name?: string;
  trim?: string | { name?: string };
  engine?: string | { capacity?: string; type?: string };
  body?: string;
  regions?: string[];
}

function getApiKey(): string | null {
  return process.env.WHEELSIZE_API_KEY || null;
}

function safeString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name.trim();
    if (typeof obj.value === "string") return obj.value.trim();
    if (typeof obj.capacity === "string") return obj.capacity.trim();
    return "";
  }
  return "";
}

async function fetchWheelSizeModifications(
  apiKey: string,
  year: number,
  make: string,
  model: string
): Promise<WheelSizeModification[]> {
  const makeSlug = make.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const modelSlug = model.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const url = new URL("modifications/", WHEELSIZE_API_BASE);
  url.searchParams.set("user_key", apiKey);
  url.searchParams.set("make", makeSlug);
  url.searchParams.set("model", modelSlug);
  url.searchParams.set("year", String(year));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const allMods: WheelSizeModification[] = data?.data || [];
    
    // Prefer USDM models
    const usMods = allMods.filter(m => m.regions?.includes("usdm"));
    return usMods.length > 0 ? usMods : allMods;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ============================================================================
// Import to Database
// ============================================================================

async function importModificationsToDb(
  year: number,
  make: string,
  model: string,
  modifications: WheelSizeModification[]
): Promise<{ imported: number; skipped: number }> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  let imported = 0;
  let skipped = 0;

  for (const mod of modifications) {
    try {
      const sourceId = mod.slug;
      const checksum = makePayloadChecksum(mod);
      const modificationId = slugify(mod.slug);

      // Check if source record exists with same checksum
      const existingSource = await db.query.fitmentSourceRecords.findFirst({
        where: and(
          eq(fitmentSourceRecords.source, "wheelsize"),
          eq(fitmentSourceRecords.sourceId, sourceId)
        ),
      });

      if (existingSource && existingSource.checksum === checksum) {
        skipped++;
        continue;
      }

      // Upsert source record
      let sourceRecordId: string;
      if (existingSource) {
        await db
          .update(fitmentSourceRecords)
          .set({
            rawPayload: mod as any,
            checksum,
            fetchedAt: new Date(),
          })
          .where(eq(fitmentSourceRecords.id, existingSource.id));
        sourceRecordId = existingSource.id;
      } else {
        const [inserted] = await db
          .insert(fitmentSourceRecords)
          .values({
            source: "wheelsize",
            sourceId,
            year,
            make: normalizedMake,
            model: normalizedModel,
            rawPayload: mod as any,
            checksum,
          })
          .returning({ id: fitmentSourceRecords.id });
        sourceRecordId = inserted.id;
      }

      // Build normalized fitment
      const trimStr = safeString(mod.trim);
      const engineStr = safeString(mod.engine);
      const nameStr = safeString(mod.name);
      const displayTrim = normalizeTrimLabel(trimStr, engineStr, nameStr, String(year), make, model) || "Base";

      // Check if fitment exists
      const existingFitment = await db.query.vehicleFitments.findFirst({
        where: and(
          eq(vehicleFitments.year, year),
          eq(vehicleFitments.make, normalizedMake),
          eq(vehicleFitments.model, normalizedModel),
          eq(vehicleFitments.modificationId, modificationId)
        ),
      });

      if (existingFitment) {
        await db
          .update(vehicleFitments)
          .set({
            rawTrim: trimStr || engineStr || nameStr || null,
            displayTrim,
            sourceRecordId,
            updatedAt: new Date(),
          })
          .where(eq(vehicleFitments.id, existingFitment.id));
      } else {
        await db.insert(vehicleFitments).values({
          year,
          make: normalizedMake,
          model: normalizedModel,
          modificationId,
          rawTrim: trimStr || engineStr || nameStr || null,
          displayTrim,
          source: "wheelsize",
          sourceRecordId,
          oemWheelSizes: [],
          oemTireSizes: [],
        });
      }

      imported++;
    } catch (err: any) {
      console.error(`[trims] Import error for ${mod.slug}:`, err?.message);
    }
  }

  return { imported, skipped };
}

// ============================================================================
// Main Route Handler
// ============================================================================

/**
 * GET /api/vehicles/trims?year=2022&make=Ford&model=F-150
 * 
 * DB-first lookup with Wheel-Size API fallback.
 * Priority:
 * 1. Check database (vehicle_fitments)
 * 2. If not found, call Wheel-Size API and import
 * 3. Fall back to static supplements for trucks/SUVs
 * 4. Apply overrides before returning
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const yearStr = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  if (!yearStr || !make || !model) {
    return NextResponse.json({ results: [] });
  }

  const year = parseInt(yearStr, 10);
  if (isNaN(year)) {
    return NextResponse.json({ results: [] });
  }

  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  let source: "db" | "api" | "supplement" | "empty" = "empty";
  let overridesApplied = false;
  let apiCalled = false;

  // -------------------------------------------------------------------------
  // Step 1: Check database first
  // -------------------------------------------------------------------------
  
  try {
    const dbFitments = await db.query.vehicleFitments.findMany({
      where: and(
        eq(vehicleFitments.year, year),
        eq(vehicleFitments.make, normalizedMake),
        eq(vehicleFitments.model, normalizedModel)
      ),
      orderBy: [vehicleFitments.displayTrim],
    });

    if (dbFitments.length > 0) {
      console.log(`[trims] DB HIT: ${year} ${make} ${model} → ${dbFitments.length} records`);
      
      // Apply overrides
      const withOverrides = await Promise.all(dbFitments.map(f => applyOverrides(f)));
      overridesApplied = withOverrides.some((f, i) => f.displayTrim !== dbFitments[i].displayTrim);

      // Dedupe by displayTrim
      const seen = new Set<string>();
      const results: TrimOption[] = [];
      for (const fitment of withOverrides) {
        const labelKey = fitment.displayTrim.toLowerCase();
        if (!seen.has(labelKey)) {
          seen.add(labelKey);
          results.push({
            value: fitment.modificationId,
            label: fitment.displayTrim,
          });
        }
      }

      // Check if results are good (not just "Base" or engine codes)
      const hasGoodSubmodels = results.some(r => {
        const label = r.label.toLowerCase();
        if (label === "base" || label === "standard") return false;
        if (/^\d+\.\d+\s+\w+/.test(label)) return false;
        return true;
      });

      if (hasGoodSubmodels) {
        console.log(`[trims] Returning ${results.length} options from DB (overrides: ${overridesApplied})`);
        return NextResponse.json({
          results,
          source: "db",
          count: results.length,
          overridesApplied,
          cached: true,
        } as TrimResponse);
      }
      
      // DB has only poor data, continue to check supplements
      console.log(`[trims] DB has poor data, checking supplements...`);
    }
  } catch (dbErr: any) {
    console.error(`[trims] DB error:`, dbErr?.message);
    // Continue to API fallback
  }

  // -------------------------------------------------------------------------
  // Step 2: Check static supplements (trucks, SUVs, etc.)
  // -------------------------------------------------------------------------

  const supplement = getSubmodelSupplement(year, make, model);
  if (supplement && supplement.length > 0) {
    console.log(`[trims] SUPPLEMENT: ${year} ${make} ${model} → ${supplement.length} options`);
    return NextResponse.json({
      results: supplement,
      source: "supplement",
      count: supplement.length,
      overridesApplied: false,
      cached: false,
    } as TrimResponse);
  }

  // -------------------------------------------------------------------------
  // Step 3: Call Wheel-Size API and import to database
  // -------------------------------------------------------------------------

  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(`[trims] No API key, returning empty`);
    return NextResponse.json({ results: [], source: "empty" } as TrimResponse);
  }

  try {
    console.log(`[trims] API FETCH: ${year} ${make} ${model}`);
    apiCalled = true;

    const modifications = await fetchWheelSizeModifications(apiKey, year, make, model);

    if (modifications.length === 0) {
      console.log(`[trims] API returned 0 modifications`);
      return NextResponse.json({ results: [], source: "api", count: 0 } as TrimResponse);
    }

    // Import to database
    const importResult = await importModificationsToDb(year, make, model, modifications);
    console.log(`[trims] Imported: ${importResult.imported}, Skipped: ${importResult.skipped}`);

    // Re-fetch from database to get normalized data with overrides
    const dbFitments = await db.query.vehicleFitments.findMany({
      where: and(
        eq(vehicleFitments.year, year),
        eq(vehicleFitments.make, normalizedMake),
        eq(vehicleFitments.model, normalizedModel)
      ),
      orderBy: [vehicleFitments.displayTrim],
    });

    // Apply overrides
    const withOverrides = await Promise.all(dbFitments.map(f => applyOverrides(f)));
    overridesApplied = withOverrides.some((f, i) => f.displayTrim !== dbFitments[i].displayTrim);

    // Dedupe by displayTrim
    const seen = new Set<string>();
    const results: TrimOption[] = [];
    for (const fitment of withOverrides) {
      const labelKey = fitment.displayTrim.toLowerCase();
      if (!seen.has(labelKey)) {
        seen.add(labelKey);
        results.push({
          value: fitment.modificationId,
          label: fitment.displayTrim,
        });
      }
    }

    // Filter out poor labels
    const goodResults = results.filter(r => {
      const label = r.label.toLowerCase();
      if (label === "base" && results.length > 1) return false;
      if (/^\d+\.\d+\s+\w+/.test(label)) return false;
      return true;
    });

    // If only poor results, return "Base" as a fallback
    const finalResults = goodResults.length > 0 ? goodResults : 
      (results.length > 0 ? [{ value: results[0].value, label: "Base" }] : []);

    console.log(`[trims] Returning ${finalResults.length} options from API import (overrides: ${overridesApplied})`);
    
    return NextResponse.json({
      results: finalResults,
      source: "api",
      count: finalResults.length,
      overridesApplied,
      cached: false,
    } as TrimResponse, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });

  } catch (apiErr: any) {
    console.error(`[trims] API error:`, apiErr?.message);
    return NextResponse.json({ results: [], source: "empty" } as TrimResponse);
  }
}
