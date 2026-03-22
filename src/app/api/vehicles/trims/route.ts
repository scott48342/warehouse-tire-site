import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and } from "drizzle-orm";
import { normalizeMake, normalizeModel, normalizeModelForApi, slugify, makePayloadChecksum } from "@/lib/fitment-db/keys";
import * as wheelSizeApi from "@/lib/wheelSizeApi";
import { normalizeTrimLabel } from "@/lib/trimNormalize";
import { applyOverrides } from "@/lib/fitment-db/applyOverrides";
import { fitmentSourceRecords } from "@/lib/fitment-db/schema";
import submodelSupplements from "@/data/submodel-supplements.json";

/**
 * Generate a canonical modificationId for supplement data.
 * Since supplements don't have API slugs, we generate a deterministic
 * hash-based ID that's unique per vehicle+trim combination.
 * 
 * Format: s_{8-char-hash} where hash is based on year:make:model:trimValue
 */
function makeSupplementId(year: number, make: string, model: string, trimValue: string): string {
  const input = `${year}:${normalizeMake(make)}:${normalizeModel(model)}:${slugify(trimValue)}`;
  const hash = crypto.createHash("sha256").update(input).digest("hex").slice(0, 8);
  return `s_${hash}`;
}

export const runtime = "nodejs";

// ============================================================================
// Types
// ============================================================================

type SubmodelEntry = { value: string; label: string };
type YearRangeMap = { [yearRange: string]: SubmodelEntry[] };
type ModelMap = { [model: string]: YearRangeMap };
type MakeMap = { [make: string]: ModelMap };

/**
 * TrimOption returned to the selector
 * - value: backwards-compatible, same as modificationId
 * - label: customer-facing display text
 * - modificationId: canonical fitment identity (REQUIRED for downstream)
 * - rawTrim: original value from source (for debugging)
 */
type TrimOption = {
  value: string;
  label: string;
  modificationId: string;
  rawTrim?: string;
};

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
// Wheel-Size API helpers
// ============================================================================

type WheelSizeModification = wheelSizeApi.WheelSizeModification;

type ResolvedWheelSize = {
  makeSlug: string;
  modelSlug: string;
  modelName?: string;
};

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

/**
 * Resolve make/model slugs using the Wheel-Size catalog (more reliable than local slug guesses).
 * Includes a couple of Mercedes-specific fallbacks for "*-Class" names.
 */
async function resolveWheelSizeMakeModel(make: string, model: string): Promise<ResolvedWheelSize | null> {
  const foundMake = await wheelSizeApi.findMake(make);
  if (!foundMake) return null;

  // First try the shared resolver (matches by slug/name plus normalizeModelForApi alias).
  let foundModel = await wheelSizeApi.findModel(foundMake.slug, model);

  // If not found, try some pragmatic fallbacks.
  if (!foundModel) {
    const models = await wheelSizeApi.getModels(foundMake.slug);
    const needle = slugify(model).toLowerCase();
    const base = normalizeModelForApi(model).toLowerCase();

    const candidates: wheelSizeApi.WheelSizeModel[] = [];

    // Mercedes frequently uses "XYZ-Class" or "XYZ-Class Coupe".
    if (foundMake.slug === "mercedes" || foundMake.slug === "mercedes-benz") {
      const mercedesTries = [
        `${base}-class`,
        `${base}-class-coupe`,
        `${base}-class-suv`,
      ];
      for (const t of mercedesTries) {
        const hit = models.find(m => (m.slug || "").toLowerCase() === t);
        if (hit) candidates.push(hit);
      }
    }

    // Generic fuzzy: startsWith base/needle
    const fuzzy = models.filter(m => {
      const slug = (m.slug || "").toLowerCase();
      const name = (m.name || "").toLowerCase();
      return (
        slug === needle ||
        slug === base ||
        slug.startsWith(`${base}-`) ||
        slug.startsWith(`${needle}-`) ||
        name === needle ||
        name.startsWith(base) ||
        name.startsWith(needle)
      );
    });

    candidates.push(...fuzzy);

    // Prefer *-class* matches when present.
    foundModel = candidates.find(m => (m.slug || "").toLowerCase().includes("-class")) || candidates[0] || null;
  }

  if (!foundModel) return null;

  return { makeSlug: foundMake.slug, modelSlug: foundModel.slug, modelName: foundModel.name };
}

async function fetchWheelSizeModificationsResolved(
  year: number,
  make: string,
  model: string
): Promise<{ resolved: ResolvedWheelSize; modifications: WheelSizeModification[] }> {
  const resolved = await resolveWheelSizeMakeModel(make, model);
  if (!resolved) return { resolved: { makeSlug: normalizeMake(make), modelSlug: normalizeModelForApi(model) }, modifications: [] };

  // Get modifications via the shared API client.
  let mods = await wheelSizeApi.getModifications(resolved.makeSlug, resolved.modelSlug, year);

  // Prefer USDM if available
  const us = mods.filter(m => m.regions?.includes("usdm"));
  mods = us.length > 0 ? us : mods;

  return { resolved, modifications: mods };
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

      // Dedupe by modificationId (preserve all unique mods, even with same displayTrim)
      const seenModIds = new Set<string>();
      const deduped = withOverrides.filter(f => {
        if (seenModIds.has(f.modificationId)) return false;
        seenModIds.add(f.modificationId);
        return true;
      });

      // Check for displayTrim collisions and disambiguate labels
      const labelCounts = new Map<string, number>();
      deduped.forEach(f => {
        const key = f.displayTrim.toLowerCase();
        labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
      });

      const results: TrimOption[] = [];
      const labelIndexes = new Map<string, number>();
      for (const fitment of deduped) {
        const key = fitment.displayTrim.toLowerCase();
        let label = fitment.displayTrim;
        
        // If multiple mods share the same displayTrim, disambiguate with rawTrim or index
        if ((labelCounts.get(key) || 0) > 1) {
          const idx = (labelIndexes.get(key) || 0) + 1;
          labelIndexes.set(key, idx);
          // Use rawTrim for disambiguation if available, otherwise use index
          if (fitment.rawTrim && fitment.rawTrim !== fitment.displayTrim) {
            label = `${fitment.displayTrim} (${fitment.rawTrim})`;
          } else {
            label = `${fitment.displayTrim} #${idx}`;
          }
        }
        
        results.push({
          value: fitment.modificationId,
          label,
          modificationId: fitment.modificationId,
          rawTrim: fitment.rawTrim || undefined,
        });
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
    // Generate canonical modificationIds for supplement entries
    const supplementWithIds: TrimOption[] = supplement.map(s => {
      const modificationId = makeSupplementId(year, make, model, s.value);
      return {
        value: modificationId, // Use canonical ID for value (backwards compat - consumers should use modificationId)
        label: s.label,
        modificationId, // Canonical fitment identity
        rawTrim: s.value, // Original supplement value for debugging
      };
    });
    return NextResponse.json({
      results: supplementWithIds,
      source: "supplement",
      count: supplementWithIds.length,
      overridesApplied: false,
      cached: false,
    } as TrimResponse);
  }

  // -------------------------------------------------------------------------
  // Step 3: Call Wheel-Size API and import to database
  // -------------------------------------------------------------------------

  try {
    console.log(`[trims] API FETCH (resolved): ${year} ${make} ${model}`);
    apiCalled = true;

    const { resolved, modifications } = await fetchWheelSizeModificationsResolved(year, make, model);

    if (modifications.length === 0) {
      console.log(`[trims] API returned 0 modifications (resolved make=${resolved.makeSlug} model=${resolved.modelSlug})`);
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

    // Dedupe by modificationId (preserve all unique mods)
    const seenModIds = new Set<string>();
    const deduped = withOverrides.filter(f => {
      if (seenModIds.has(f.modificationId)) return false;
      seenModIds.add(f.modificationId);
      return true;
    });

    // Check for displayTrim collisions and disambiguate labels
    const labelCounts = new Map<string, number>();
    deduped.forEach(f => {
      const key = f.displayTrim.toLowerCase();
      labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
    });

    const results: TrimOption[] = [];
    const labelIndexes = new Map<string, number>();
    for (const fitment of deduped) {
      const key = fitment.displayTrim.toLowerCase();
      let label = fitment.displayTrim;
      
      // Disambiguate when multiple mods share same displayTrim
      if ((labelCounts.get(key) || 0) > 1) {
        const idx = (labelIndexes.get(key) || 0) + 1;
        labelIndexes.set(key, idx);
        if (fitment.rawTrim && fitment.rawTrim !== fitment.displayTrim) {
          label = `${fitment.displayTrim} (${fitment.rawTrim})`;
        } else {
          label = `${fitment.displayTrim} #${idx}`;
        }
      }
      
      results.push({
        value: fitment.modificationId,
        label,
        modificationId: fitment.modificationId,
        rawTrim: fitment.rawTrim || undefined,
      });
    }

    // Filter out poor labels (but preserve unique mods)
    const goodResults = results.filter(r => {
      const baseLabel = r.label.toLowerCase().replace(/\s*\(.*\)$/, '').replace(/\s*#\d+$/, '');
      if (baseLabel === "base" && results.length > 1) return false;
      if (/^\d+\.\d+\s+\w+$/.test(baseLabel)) return false;
      return true;
    });

    // If only poor results, return "Base" as a fallback
    const finalResults = goodResults.length > 0 ? goodResults : 
      (results.length > 0 ? [{
        value: results[0].value,
        label: "Base",
        modificationId: results[0].modificationId,
        rawTrim: results[0].rawTrim,
      }] : []);

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
    const errorMsg = apiErr?.name === "AbortError" 
      ? "API timeout (15s)" 
      : apiErr?.message || String(apiErr);
    console.error(`[trims] API error for ${year} ${make} ${model}:`, errorMsg);
    return NextResponse.json({ 
      results: [], 
      source: "error" as const,
      error: errorMsg,
    });
  }
}
