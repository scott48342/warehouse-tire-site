import { NextResponse } from "next/server";
import * as catalogStore from "@/lib/catalog-store";
import { normalizeMake } from "@/lib/fitment-db/keys";

// ============================================================================
// WHEEL-SIZE API REMOVED (Phase A - DB-First Architecture)
// All vehicle data comes from local catalog. No external API calls.
// ============================================================================

export const runtime = "nodejs";

// Static fallback for when API/catalog unavailable
// Includes both current models and classic/defunct vehicles with fitment data
const COMMON_MODELS: Record<string, string[]> = {
  // Current manufacturers
  ford: ["Bronco", "Bronco Sport", "Edge", "Escape", "Expedition", "Explorer", "F-150", "F-250", "F-350", "Fusion", "Maverick", "Mustang", "Ranger", "Transit"],
  chevrolet: [
    // Current
    "Blazer", "Camaro", "Colorado", "Corvette", "Equinox", "Malibu", 
    "Silverado 1500", "Silverado 2500 HD", "Silverado 3500 HD", 
    "Suburban", "Tahoe", "Trailblazer", "Traverse",
    // Classic
    "Cavalier", "Chevelle", "Cobalt", "Caprice", "Impala", 
    "Lumina", "Monte Carlo", "Cruze"
  ],
  ram: ["1500", "2500", "3500", "ProMaster"],
  toyota: ["4Runner", "Camry", "Corolla", "GR86", "Highlander", "Land Cruiser", "Prius", "RAV4", "Sequoia", "Sienna", "Tacoma", "Tundra"],
  honda: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Passport", "Pilot", "Ridgeline"],
  nissan: ["370Z", "Altima", "Armada", "Frontier", "Kicks", "Maxima", "Murano", "Pathfinder", "Rogue", "Sentra", "Titan", "Versa", "Z"],
  jeep: ["Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Grand Cherokee L", "Grand Wagoneer", "Renegade", "Wagoneer", "Wrangler"],
  gmc: [
    // Current
    "Acadia", "Canyon", "Sierra 1500", "Sierra 2500 HD", "Sierra 3500 HD", 
    "Terrain", "Yukon", "Yukon XL"
  ],
  dodge: ["Challenger", "Charger", "Durango", "Hornet", "Ram 1500"],
  hyundai: ["Elantra", "Ioniq 5", "Ioniq 6", "Kona", "Palisade", "Santa Cruz", "Santa Fe", "Sonata", "Tucson", "Venue"],
  kia: ["Carnival", "EV6", "Forte", "K5", "Niro", "Rio", "Seltos", "Sorento", "Soul", "Sportage", "Stinger", "Telluride"],
  subaru: ["Ascent", "BRZ", "Crosstrek", "Forester", "Impreza", "Legacy", "Outback", "Solterra", "WRX"],
  mazda: ["3", "CX-30", "CX-5", "CX-50", "CX-9", "CX-90", "MX-5 Miata"],
  volkswagen: ["Atlas", "Atlas Cross Sport", "Golf", "Golf GTI", "Golf R", "ID.4", "Jetta", "Passat", "Taos", "Tiguan"],
  bmw: ["2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "8 Series", "iX", "X1", "X3", "X4", "X5", "X6", "X7", "Z4"],
  "mercedes-benz": ["A-Class", "C-Class", "CLA", "CLE", "E-Class", "GLA", "GLB", "GLC", "GLE", "GLS", "S-Class"],
  mercedes: ["A-Class", "C-Class", "CLA", "CLE", "E-Class", "GLA", "GLB", "GLC", "GLE", "GLS", "S-Class"],
  audi: ["A3", "A4", "A5", "A6", "A7", "A8", "e-tron", "Q3", "Q4 e-tron", "Q5", "Q7", "Q8", "RS 3", "RS 5", "RS 6", "RS 7", "S3", "S4", "S5", "TT"],
  lexus: ["ES", "GX", "IS", "LC", "LS", "LX", "NX", "RC", "RX", "RZ", "TX", "UX"],
  acura: ["ILX", "Integra", "MDX", "RDX", "TLX"],
  infiniti: ["Q50", "Q60", "QX50", "QX55", "QX60", "QX80"],
  cadillac: [
    // Current
    "CT4", "CT5", "Escalade", "Escalade ESV", "Lyriq", "XT4", "XT5", "XT6",
    // Classic
    "CTS", "DeVille", "Eldorado", "Seville", "STS"
  ],
  lincoln: ["Aviator", "Corsair", "Nautilus", "Navigator", "Town Car", "Continental", "MKZ"],
  buick: [
    // Current
    "Enclave", "Encore", "Encore GX", "Envision",
    // Classic
    "Century", "LeSabre", "Park Avenue", "Regal", "Riviera", "Skylark"
  ],
  chrysler: ["300", "Pacifica", "Voyager", "PT Cruiser", "Sebring", "Town & Country"],
  tesla: ["Model 3", "Model S", "Model X", "Model Y"],
  porsche: ["718 Boxster", "718 Cayman", "911", "Cayenne", "Macan", "Panamera", "Taycan"],
  "land-rover": ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar"],
  volvo: ["C40 Recharge", "S60", "S90", "V60", "V90", "XC40", "XC60", "XC90"],
  mini: ["Clubman", "Convertible", "Countryman", "Hardtop 2 Door", "Hardtop 4 Door"],
  mitsubishi: ["Eclipse Cross", "Mirage", "Outlander", "Outlander Sport", "Eclipse", "Lancer"],
  
  // Defunct/classic brands
  pontiac: [
    "Firebird", "Trans Am", "GTO", "Grand Am", "Grand Prix", "Bonneville",
    "Sunfire", "G6", "G8", "Solstice", "Vibe", "Aztek", "Montana"
  ],
  oldsmobile: [
    "442", "Alero", "Aurora", "Bravada", "Cutlass", "Cutlass Supreme",
    "Delta 88", "Intrigue", "Silhouette", "Toronado"
  ],
  saturn: [
    "Astra", "Aura", "Ion", "L-Series", "Outlook", "Relay", 
    "S-Series", "SC", "SL", "SW", "Sky", "Vue"
  ],
  mercury: [
    "Cougar", "Grand Marquis", "Mariner", "Milan", "Montego",
    "Monterey", "Mountaineer", "Sable", "Tracer", "Villager"
  ],
  plymouth: [
    "Barracuda", "Breeze", "Duster", "Fury", "Grand Voyager",
    "Neon", "Prowler", "Road Runner", "Sundance", "Voyager"
  ],
  hummer: ["H1", "H2", "H3", "H3T"],
  scion: ["FR-S", "iA", "iM", "iQ", "tC", "xA", "xB", "xD"],
};

/**
 * GET /api/vehicles/models?make=Buick&year=2006
 * 
 * Returns available models from catalog, filtered by year when provided.
 * Populates catalog on API fetch for future requests.
 * 
 * IMPORTANT: When year is provided, only returns models that were produced in that year.
 * This prevents invalid combinations like "2006 Buick Encore" (Encore started in 2013).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const make = url.searchParams.get("make");
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : null;

  if (!make) {
    return NextResponse.json({ results: [] });
  }

  const makeSlug = normalizeMake(make);

  /**
   * Filter models by year if provided.
   * Each model has a `years` array containing valid production years.
   */
  function filterByYear(models: { name: string; years?: number[] }[]): string[] {
    if (!year || isNaN(year)) {
      // No year filter - return all models
      return models.map(m => m.name).sort();
    }
    
    // Filter to only models that have this year in their valid years array
    const filtered = models
      .filter(m => {
        const years = m.years || [];
        // If no years data, include it (fallback behavior)
        if (years.length === 0) return true;
        return years.includes(year);
      })
      .map(m => m.name)
      .sort();
    
    console.log(`[models] Year filter: ${year} ${make} → ${filtered.length}/${models.length} models`);
    return filtered;
  }

  // Try year-specific catalog query first (most efficient)
  if (year && !isNaN(year)) {
    const yearModels = await catalogStore.getModelsByYear(makeSlug, year);
    
    // Also check vehicle_fitments for locally imported data
    const fitmentModels = await catalogStore.getFitmentModelsByYear(year, makeSlug);
    
    // Merge results (deduped)
    const modelSet = new Set<string>();
    
    // Helper to normalize model names for deduping
    const normalizeForDedupe = (name: string): string => {
      return name.toLowerCase()
        .replace(/super-?duty/gi, "")  // Remove "super duty" variants
        .replace(/[-\s]+/g, " ")        // Normalize spaces/dashes
        .trim();
    };
    
    const seenNormalized = new Set<string>();
    const addModel = (displayName: string) => {
      const normalized = normalizeForDedupe(displayName);
      if (!seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        modelSet.add(displayName);
      }
    };
    
    for (const m of yearModels) addModel(m.name);
    for (const m of fitmentModels) {
      // Convert slug to display name
      const displayName = m.split("-").map((w: string) => 
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join(" ");
      addModel(displayName);
    }
    
    if (modelSet.size > 0) {
      const models = Array.from(modelSet).sort();
      console.log(`[models] YEAR-SPECIFIC: ${year} ${make} → ${models.length} models (catalog: ${yearModels.length}, fitment: ${fitmentModels.length})`);
      return NextResponse.json({ 
        results: models,
        source: "catalog",
        yearFiltered: true,
      }, {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
      });
    }
  }

  // Fallback: Try full catalog (no year filter or no year-specific data)
  const catalogModels = await catalogStore.getModels(makeSlug);
  if (catalogModels.length > 0) {
    const filtered = filterByYear(catalogModels);
    console.log(`[models] CATALOG HIT: ${year || "all"} ${make} → ${filtered.length} models`);
    return NextResponse.json({ 
      results: filtered,
      source: "catalog",
      yearFiltered: !!year,
    }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  }

  // REMOVED: Wheel-Size API fallback (Phase A - DB-first architecture)
  // All vehicle data must come from local catalog/static lists
  console.log(`[models] CATALOG MISS: ${make} - no API fallback (DB-first mode)`);

  // Final fallback: static list (no year filtering available)
  const staticKey = makeSlug.replace(/-/g, "");
  const staticModels = COMMON_MODELS[staticKey] || COMMON_MODELS[makeSlug];
  if (staticModels) {
    console.log(`[models] STATIC fallback: ${make} → ${staticModels.length} models (no year filter)`);
    return NextResponse.json({ 
      results: staticModels,
      source: "static",
      yearFiltered: false,
      warning: year ? "Year filtering not available for static fallback" : undefined,
    }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  }

  console.warn(`[models] No data for ${make}`);
  return NextResponse.json({ results: [] });
}
