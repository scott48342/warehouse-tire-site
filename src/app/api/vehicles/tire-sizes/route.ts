import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL = "https://api.wheel-size.com/v2/";

function getApiKey(): string {
  const key = process.env.WHEELSIZE_API_KEY;
  if (!key) throw new Error("Missing WHEELSIZE_API_KEY");
  return key;
}

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("user_key", getApiKey());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Wheel-Size API error: ${res.status}`);
  }

  return res.json();
}

type WheelSetup = {
  is_stock: boolean;
  front: {
    tire: string;
    tire_full?: string;
    rim_diameter: number;
  };
  rear?: {
    tire: string;
    tire_full?: string;
    rim_diameter?: number;
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
 * GET /api/vehicles/tire-sizes?year=2024&make=Ford&model=F-150&modification=bfd36e8a76
 * 
 * Returns tire sizes for a vehicle by querying Wheel-Size API directly.
 * This bypasses the package engine which has database issues.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const modificationRaw = url.searchParams.get("modification") || "";
  
  // Handle composite modification values like "bfd36e8a76__xlt__"
  const modification = modificationRaw.includes("__") 
    ? modificationRaw.split("__")[0] 
    : modificationRaw;

  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }

  // Convert to slugs (lowercase, replace special chars)
  // Wheel-Size API uses slugs like "town-and-country" not "town & country"
  const makeSlug = make.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const modelSlug = model.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const debug: any = {
    input: { year, make, model, modification, modificationRaw },
    slugs: { makeSlug, modelSlug },
  };

  try {
    // Step 1: Get available modifications for this vehicle
    const modsResponse = await apiGet<{ data: Modification[] }>("modifications/", {
      make: makeSlug,
      model: modelSlug,
      year,
    });
    const allMods = modsResponse.data || [];
    
    // Filter to US market mods
    const usMods = allMods.filter(m => m.regions?.includes("usdm"));
    const mods = usMods.length > 0 ? usMods : allMods;

    debug.modifications = {
      total: allMods.length,
      usMarket: usMods.length,
      available: mods.map(m => ({ slug: m.slug, name: m.name, trim: m.trim })),
    };

    if (mods.length === 0) {
      return NextResponse.json({
        tireSizes: [],
        tireSizesStrict: [],
        tireSizesAgg: [],
        debug,
        error: "No modifications found for this vehicle",
      });
    }

    // Step 2: Find the right modification to use
    let selectedMod: Modification | null = null;
    
    if (modification) {
      // Try to match the provided modification slug
      selectedMod = mods.find(m => m.slug === modification) || null;
    }
    
    // If no match, use the first US market modification
    if (!selectedMod) {
      selectedMod = mods[0];
    }

    debug.selectedModification = selectedMod;

    // Step 3: Get vehicle data with tire sizes
    const vehicleResponse = await apiGet<{ data: VehicleData[] }>("search/by_model/", {
      make: makeSlug,
      model: modelSlug,
      year,
      modification: selectedMod.slug,
    });

    const vehicleData = vehicleResponse.data?.[0];
    debug.vehicleDataFound = !!vehicleData;
    debug.wheelsCount = vehicleData?.wheels?.length || 0;

    if (!vehicleData?.wheels?.length) {
      return NextResponse.json({
        tireSizes: [],
        tireSizesStrict: [],
        tireSizesAgg: [],
        debug,
        error: "No wheel/tire data found for this modification",
      });
    }

    // Step 4: Extract tire sizes from wheels array
    const tireSizesSet = new Set<string>();
    const stockTireSizes: string[] = [];
    const allTireSizes: string[] = [];

    for (const wheel of vehicleData.wheels) {
      const frontTire = wheel.front?.tire;
      const rearTire = wheel.rear?.tire;

      if (frontTire && frontTire.trim()) {
        const normalized = normalizeTireSize(frontTire);
        if (normalized) {
          allTireSizes.push(normalized);
          tireSizesSet.add(normalized);
          if (wheel.is_stock) {
            stockTireSizes.push(normalized);
          }
        }
      }

      if (rearTire && rearTire.trim() && rearTire !== frontTire) {
        const normalized = normalizeTireSize(rearTire);
        if (normalized) {
          allTireSizes.push(normalized);
          tireSizesSet.add(normalized);
          if (wheel.is_stock) {
            stockTireSizes.push(normalized);
          }
        }
      }
    }

    // Step 5: Also fetch other modifications to get aggregate sizes
    const aggTireSizes: string[] = [];
    
    // Limit to first 3 additional mods to avoid rate limits
    const otherMods = mods.filter(m => m.slug !== selectedMod?.slug).slice(0, 3);
    
    for (const mod of otherMods) {
      try {
        const otherResponse = await apiGet<{ data: VehicleData[] }>("search/by_model/", {
          make: makeSlug,
          model: modelSlug,
          year,
          modification: mod.slug,
        });
        
        const otherData = otherResponse.data?.[0];
        if (otherData?.wheels) {
          for (const wheel of otherData.wheels) {
            const frontTire = wheel.front?.tire;
            if (frontTire) {
              const normalized = normalizeTireSize(frontTire);
              if (normalized && !tireSizesSet.has(normalized)) {
                aggTireSizes.push(normalized);
                tireSizesSet.add(normalized);
              }
            }
          }
        }
      } catch {
        // Ignore errors for aggregate data
      }
    }

    debug.rawTireSizes = {
      stock: stockTireSizes,
      all: allTireSizes,
      aggregate: aggTireSizes,
    };

    // Final tire sizes (deduplicated)
    const tireSizes = Array.from(tireSizesSet);

    // Also include bolt pattern and other fitment data
    const fitment = {
      boltPattern: vehicleData.technical?.bolt_pattern,
      centerBore: vehicleData.technical?.centre_bore,
    };

    return NextResponse.json({
      tireSizes,
      tireSizesStrict: stockTireSizes.length > 0 ? [...new Set(stockTireSizes)] : allTireSizes,
      tireSizesAgg: aggTireSizes,
      fitment,
      selectedModification: {
        slug: selectedMod.slug,
        name: selectedMod.name,
      },
      debug,
    });

  } catch (err: any) {
    debug.error = err?.message || String(err);
    return NextResponse.json(
      { 
        tireSizes: [],
        tireSizesStrict: [],
        tireSizesAgg: [],
        error: err?.message || String(err),
        debug,
      },
      { status: 500 }
    );
  }
}

/**
 * Normalize tire size to standard format (e.g., "LT315/70R17" -> "315/70R17")
 */
function normalizeTireSize(size: string): string | null {
  if (!size) return null;
  
  let s = size.trim().toUpperCase();
  
  // Remove LT prefix for light truck sizes
  s = s.replace(/^LT/, "");
  
  // Handle flotation sizes like "37x12.50R17LT" -> keep as-is for now
  if (s.match(/^\d+X[\d.]+R\d+/i)) {
    return s;
  }
  
  // Standard metric sizes: 315/70R17, 275/55R20, etc.
  const match = s.match(/(\d{3})\/(\d{2,3})R(\d{2})/);
  if (match) {
    return `${match[1]}/${match[2]}R${match[3]}`;
  }
  
  // Return original if can't normalize
  return size.trim();
}
