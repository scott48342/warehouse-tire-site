import { NextResponse } from "next/server";
import crypto from "crypto";
import { normalizeMake, normalizeModel, normalizeModelForApi, slugify } from "@/lib/fitment-db/keys";
import * as wheelSizeApi from "@/lib/wheelSizeApi";
import { normalizeTrimLabel } from "@/lib/trimNormalize";
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
  source?: "api" | "supplement" | "fallback";
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

  // If catalog resolution fails, fall back to our best-guess slugs (still try the API).
  const fallbackResolved: ResolvedWheelSize = {
    makeSlug: normalizeMake(make),
    modelSlug: normalizeModelForApi(model),
  };

  const chosen = resolved || fallbackResolved;

  // Get modifications via the shared API client.
  let mods = await wheelSizeApi.getModifications(chosen.makeSlug, chosen.modelSlug, year);

  // Prefer USDM if available
  const us = mods.filter(m => m.regions?.includes("usdm"));
  mods = us.length > 0 ? us : mods;

  return { resolved: chosen, modifications: mods };
}

// ============================================================================
// Transform API modifications to TrimOptions
// ============================================================================

function modificationsToTrimOptions(
  modifications: WheelSizeModification[],
  year: number,
  make: string,
  model: string
): TrimOption[] {
  const results: TrimOption[] = [];
  const seenModIds = new Set<string>();
  
  for (const mod of modifications) {
    const modificationId = slugify(mod.slug);
    
    // Dedupe by modificationId
    if (seenModIds.has(modificationId)) continue;
    seenModIds.add(modificationId);
    
    // Build display label
    const trimStr = safeString(mod.trim);
    const engineStr = safeString(mod.engine);
    const nameStr = safeString(mod.name);
    
    // Use trim_levels if available (added in previous fix)
    let displayTrim: string;
    if (mod.trim_levels && Array.isArray(mod.trim_levels) && mod.trim_levels.length > 0) {
      displayTrim = mod.trim_levels[0];
    } else {
      displayTrim = normalizeTrimLabel(trimStr, engineStr, nameStr, String(year), make, model) || "Base";
    }
    
    results.push({
      value: modificationId,
      label: displayTrim,
      modificationId,
      rawTrim: trimStr || engineStr || nameStr || undefined,
    });
  }
  
  // Check for label collisions and disambiguate
  const labelCounts = new Map<string, number>();
  results.forEach(r => {
    const key = r.label.toLowerCase();
    labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
  });
  
  const labelIndexes = new Map<string, number>();
  for (const result of results) {
    const key = result.label.toLowerCase();
    if ((labelCounts.get(key) || 0) > 1) {
      const idx = (labelIndexes.get(key) || 0) + 1;
      labelIndexes.set(key, idx);
      if (result.rawTrim && result.rawTrim.toLowerCase() !== result.label.toLowerCase()) {
        result.label = `${result.label} (${result.rawTrim})`;
      } else {
        result.label = `${result.label} #${idx}`;
      }
    }
  }
  
  return results;
}

/**
 * Check if results have meaningful trim names (not just "Base" or engine codes)
 */
function hasGoodSubmodels(results: TrimOption[]): boolean {
  return results.some(r => {
    const label = r.label.toLowerCase();
    // Skip "Base", "Standard", or labels starting with "Base ("
    if (label === "base" || label === "standard" || label.startsWith("base (")) return false;
    // Skip engine codes like "5.3i", "6.0i", "2.0 PHEV"
    if (/^\d+\.\d+\s*\w*/.test(label)) return false;
    // Skip labels that are ONLY engine codes in parens: "Base (5.3i)"
    if (/^base\s*\([^)]+\)$/i.test(label)) return false;
    return true;
  });
}

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

  // -------------------------------------------------------------------------
  // Step 1: Call Wheel-Size API
  // -------------------------------------------------------------------------

  try {
    console.log(`[trims] API FETCH: ${year} ${make} ${model}`);

    const { resolved, modifications } = await fetchWheelSizeModificationsResolved(year, make, model);

    if (modifications.length === 0) {
      console.log(`[trims] API returned 0 modifications (resolved make=${resolved.makeSlug} model=${resolved.modelSlug})`);
      
      // Check supplements before giving up
      const supplement = getSubmodelSupplement(year, make, model);
      if (supplement && supplement.length > 0) {
        console.log(`[trims] SUPPLEMENT fallback: ${year} ${make} ${model} → ${supplement.length} options`);
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
      
      return NextResponse.json({
        results: [],
        source: "api",
        count: 0,
        overridesApplied: false,
        cached: false,
        ...(debug ? { debug: { resolved, apiModCount: 0 } } : {}),
      } as any);
    }

    // Transform API results
    const results = modificationsToTrimOptions(modifications, year, make, model);
    
    // Check if API returned good trim names
    if (!hasGoodSubmodels(results)) {
      // API only has "Base" or engine codes - check supplements
      const supplement = getSubmodelSupplement(year, make, model);
      if (supplement && supplement.length > 0) {
        console.log(`[trims] API has poor data, using SUPPLEMENT: ${year} ${make} ${model} → ${supplement.length} options`);
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

    console.log(`[trims] Returning ${results.length} options from API`);
    
    return NextResponse.json({
      results,
      source: "api",
      count: results.length,
      overridesApplied: false,
      cached: false,
      ...(debug ? { debug: { resolved, apiModCount: modifications.length } } : {}),
    } as any, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });

  } catch (apiErr: any) {
    const errorMsg = apiErr?.name === "AbortError" 
      ? "API timeout (15s)" 
      : apiErr?.message || String(apiErr);
    console.error(`[trims] API error for ${year} ${make} ${model}:`, errorMsg);
    
    // Check supplements as fallback
    const supplement = getSubmodelSupplement(year, make, model);
    if (supplement && supplement.length > 0) {
      console.log(`[trims] Using SUPPLEMENT after API error: ${year} ${make} ${model} → ${supplement.length} options`);
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
    
    // Return a "Base" fallback trim so users can still proceed
    const fallbackModificationId = makeSupplementId(year, make, model, "base");
    console.log(`[trims] Returning Base fallback due to API error`);
    
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
      apiError: errorMsg,
    });
  }
}
