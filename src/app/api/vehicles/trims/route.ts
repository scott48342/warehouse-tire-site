import { NextResponse } from "next/server";
import crypto from "crypto";
import { normalizeMake, normalizeModel, slugify } from "@/lib/fitment-db/keys";
import * as catalogStore from "@/lib/catalog-store";
import submodelSupplements from "@/data/submodel-supplements.json";
import { listLocalFitments } from "@/lib/fitment-db/getFitment";

// ============================================================================
// WHEEL-SIZE API REMOVED (Phase A - DB-First Architecture)
// All trim data comes from local fitment DB or supplements. No external API calls.
// ============================================================================

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
  source?: "api" | "supplement" | "fallback" | "local";
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
// WHEEL-SIZE API HELPERS REMOVED (Phase A - DB-First Architecture)
// All API-dependent code has been removed. Local DB + supplements are authoritative.
// ============================================================================

// ============================================================================
// Main Route Handler
// ============================================================================

/**
 * GET /api/vehicles/trims?year=2022&make=Ford&model=F-150
 * 
 * Wheel-Size API first, supplements as fallback for poor data.
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

  const debug = url.searchParams.get("debug") === "1";
  const makeSlug = normalizeMake(make);

  // -------------------------------------------------------------------------
  // Step 0: Check local fitment DB FIRST (for manually imported data)
  // Local fitment is authoritative - bypass catalog validation if we have data
  // -------------------------------------------------------------------------
  
  try {
    const localFitments = await listLocalFitments(year, make, model);
    
    if (localFitments.length > 0) {
      console.log(`[trims] LOCAL DB HIT: ${year} ${make} ${model} → ${localFitments.length} local fitment(s)`);
      
      const localResults: TrimOption[] = localFitments.map(f => ({
        value: f.modificationId,
        label: f.displayTrim || "Base",
        modificationId: f.modificationId,
        rawTrim: f.displayTrim || undefined,
      }));
      
      // Check if local only has "Base" trim - if so, try supplements for better data
      const onlyBase = localResults.length === 1 && localResults[0].label === "Base";
      if (onlyBase) {
        const supplement = getSubmodelSupplement(year, make, model);
        if (supplement && supplement.length > 0) {
          console.log(`[trims] Local only has Base, using SUPPLEMENT: ${year} ${make} ${model} → ${supplement.length} options`);
          const supplementWithIds: TrimOption[] = supplement.map(s => {
            const modificationId = makeSupplementId(year, make, model, s.value);
            return {
              value: modificationId,
              label: s.label,
              modificationId,
              rawTrim: s.value,
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
      }
      
      return NextResponse.json({
        results: localResults,
        source: "local",
        count: localResults.length,
        overridesApplied: false,
        cached: true,
        ...(debug ? { debug: { localFitmentIds: localFitments.map(f => f.modificationId) } } : {}),
      } as TrimResponse);
    }
  } catch (localErr: any) {
    console.warn(`[trims] Local fitment lookup failed: ${localErr?.message}`);
  }

  // -------------------------------------------------------------------------
  // Step 1: Validate year against catalog (only for vehicles without local fitment)
  // This prevents invalid combos like 2006 Buick Encore
  // -------------------------------------------------------------------------
  
  const catalogModel = await catalogStore.findModel(makeSlug, model);
  if (catalogModel && catalogModel.years.length > 0) {
    if (!catalogModel.years.includes(year)) {
      console.warn(`[trims] INVALID YEAR: ${year} ${make} ${model} - valid years: ${catalogModel.years.slice(0, 5).join(", ")}...`);
      return NextResponse.json({
        results: [],
        source: "invalid",
        error: `${year} is not a valid year for ${make} ${model}`,
        validYears: catalogModel.years.slice(0, 10),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: No local fitment found - try supplements then fallback
  // REMOVED: Wheel-Size API call (Phase A - DB-first architecture)
  // -------------------------------------------------------------------------
  
  console.log(`[trims] NO LOCAL FITMENT: ${year} ${make} ${model} - checking supplements (DB-first mode)`);
  
  // Check supplements
  const supplement = getSubmodelSupplement(year, make, model);
  if (supplement && supplement.length > 0) {
    console.log(`[trims] SUPPLEMENT: ${year} ${make} ${model} → ${supplement.length} options`);
    const supplementWithIds: TrimOption[] = supplement.map(s => {
      const modificationId = makeSupplementId(year, make, model, s.value);
      return {
        value: modificationId,
        label: s.label,
        modificationId,
        rawTrim: s.value,
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
  
  // No local data, no supplements - return Base fallback
  const fallbackModificationId = makeSupplementId(year, make, model, "base");
  console.log(`[trims] FALLBACK to Base: ${year} ${make} ${model} (no local fitment or supplements)`);
  
  return NextResponse.json({ 
    results: [{
      value: fallbackModificationId,
      label: "Base",
      modificationId: fallbackModificationId,
      rawTrim: "base",
    }], 
    source: "fallback" as const,
    count: 1,
    overridesApplied: false,
    cached: false,
    warning: "No fitment data available - using Base fallback",
  });
}
