import { NextResponse } from "next/server";
import { isWheelSizeEnabled } from "@/lib/wheelSizeApi";

export const runtime = "nodejs";

const BASE_URL = "https://api.wheel-size.com/v2/";

function getApiKey(): string {
  const key = process.env.WHEELSIZE_API_KEY;
  if (!key) throw new Error("Missing WHEELSIZE_API_KEY");
  return key;
}

type WheelSetup = {
  is_stock: boolean;
  front: {
    tire: string;
    rim_diameter: number;
    rim_width: number;
    rim_offset: number;
  };
  rear?: {
    tire: string;
    rim_diameter?: number;
    rim_width?: number;
    rim_offset?: number;
  };
};

type VehicleData = {
  wheels?: WheelSetup[];
  technical?: {
    bolt_pattern?: string;
    centre_bore?: string;
  };
};

type Modification = {
  slug: string;
  name: string;
  trim?: string;
  regions?: string[];
};

/**
 * GET /api/vehicles/search?year=2024&make=Ford&model=F-150&modification=s_abc123
 * 
 * Returns vehicle fitment data (bolt pattern, tire sizes, wheel specs) from Wheel-Size API.
 * 
 * Params:
 * - modification: canonical fitment identity (preferred)
 * - trim: legacy param, falls back if modification not provided
 */
export async function GET(req: Request) {
  // ═══════════════════════════════════════════════════════════════════════════
  // KILL SWITCH - Block ALL Wheel-Size API calls when disabled
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isWheelSizeEnabled()) {
    console.warn("[vehicles/search] Wheel-Size API DISABLED - returning null fitment");
    return NextResponse.json({
      fitment: null,
      error: "Wheel-Size API is temporarily disabled",
      disabled: true,
    });
  }

  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  
  // PARAM SEPARATION: prefer modification, fall back to trim for backward compat
  const modificationParam = url.searchParams.get("modification") || "";
  const trimParam = url.searchParams.get("trim") || "";
  const modificationRaw = modificationParam || trimParam;
  
  if (!modificationParam && trimParam) {
    console.warn(`[vehicles/search] DEPRECATION: Using 'trim' param. Migrate to 'modification=${trimParam}'`);
  }
  
  // Handle composite modification values like "bfd36e8a76__xlt__"
  const modification = modificationRaw.includes("__") 
    ? modificationRaw.split("__")[0] 
    : modificationRaw;

  if (!year || !make || !model) {
    return NextResponse.json({
      fitment: null,
      error: "Missing required params: year, make, model",
    });
  }

  // Convert to slug format
  const makeSlug = make.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  const modelSlug = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");

  try {
    // Step 1: Get modifications to find the right one
    const modsUrl = new URL("modifications/", BASE_URL);
    modsUrl.searchParams.set("user_key", getApiKey());
    modsUrl.searchParams.set("make", makeSlug);
    modsUrl.searchParams.set("model", modelSlug);
    modsUrl.searchParams.set("year", year);

    const modsRes = await fetch(modsUrl.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!modsRes.ok) {
      return NextResponse.json({ fitment: null, error: "Failed to fetch modifications" });
    }

    const modsData = await modsRes.json();
    const allMods: Modification[] = modsData?.data || [];
    
    // Prefer US market modifications
    const usMods = allMods.filter(m => m.regions?.includes("usdm"));
    const mods = usMods.length > 0 ? usMods : allMods;

    if (mods.length === 0) {
      return NextResponse.json({ fitment: null, error: "No modifications found" });
    }

    // Find the requested modification or use first one
    let selectedMod = modification ? mods.find(m => m.slug === modification) : null;
    if (!selectedMod) selectedMod = mods[0];

    // Step 2: Get vehicle data with wheel/tire info
    const vehicleUrl = new URL("search/by_model/", BASE_URL);
    vehicleUrl.searchParams.set("user_key", getApiKey());
    vehicleUrl.searchParams.set("make", makeSlug);
    vehicleUrl.searchParams.set("model", modelSlug);
    vehicleUrl.searchParams.set("year", year);
    vehicleUrl.searchParams.set("modification", selectedMod.slug);

    const vehicleRes = await fetch(vehicleUrl.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!vehicleRes.ok) {
      return NextResponse.json({ fitment: null, error: "Failed to fetch vehicle data" });
    }

    const vehicleData = await vehicleRes.json();
    const vehicle: VehicleData = vehicleData?.data?.[0];

    if (!vehicle) {
      return NextResponse.json({ fitment: null, error: "No vehicle data found" });
    }

    // Extract fitment info
    const tireSizes: string[] = [];
    const wheelDiameters: number[] = [];
    const wheelWidths: number[] = [];
    const wheelOffsets: number[] = [];

    for (const wheel of (vehicle.wheels || [])) {
      if (wheel.front?.tire) {
        tireSizes.push(normalizeTireSize(wheel.front.tire));
      }
      if (wheel.rear?.tire && wheel.rear.tire !== wheel.front?.tire) {
        tireSizes.push(normalizeTireSize(wheel.rear.tire));
      }
      if (wheel.front?.rim_diameter) wheelDiameters.push(wheel.front.rim_diameter);
      if (wheel.front?.rim_width) wheelWidths.push(wheel.front.rim_width);
      if (wheel.front?.rim_offset != null) wheelOffsets.push(wheel.front.rim_offset);
    }

    // Dedupe and sort
    const uniqueTireSizes = [...new Set(tireSizes)];
    const uniqueDiameters = [...new Set(wheelDiameters)].sort((a, b) => a - b);
    const uniqueWidths = [...new Set(wheelWidths)].sort((a, b) => a - b);
    const uniqueOffsets = [...new Set(wheelOffsets)].sort((a, b) => a - b);

    const fitment = {
      boltPattern: vehicle.technical?.bolt_pattern || null,
      centerBore: vehicle.technical?.centre_bore || null,
      tireSizes: uniqueTireSizes,
      wheelDiameterRangeIn: uniqueDiameters.length > 0 ? [uniqueDiameters[0], uniqueDiameters[uniqueDiameters.length - 1]] : null,
      wheelWidthRangeIn: uniqueWidths.length > 0 ? [uniqueWidths[0], uniqueWidths[uniqueWidths.length - 1]] : null,
      offsetRangeMm: uniqueOffsets.length > 0 ? [uniqueOffsets[0], uniqueOffsets[uniqueOffsets.length - 1]] : null,
      modification: {
        slug: selectedMod.slug,
        name: selectedMod.name,
      },
    };

    return NextResponse.json({ fitment });
  } catch (err: any) {
    console.error(`[vehicles/search] Error:`, err?.message || err);
    return NextResponse.json({ fitment: null, error: err?.message || "Unknown error" });
  }
}

function normalizeTireSize(size: string): string {
  if (!size) return "";
  let s = size.trim().toUpperCase();
  s = s.replace(/^LT/, "");
  const match = s.match(/(\d{3})\/(\d{2,3})R(\d{2})/);
  if (match) return `${match[1]}/${match[2]}R${match[3]}`;
  return size.trim();
}
