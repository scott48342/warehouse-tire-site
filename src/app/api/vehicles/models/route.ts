import { NextResponse } from "next/server";
import * as catalogStore from "@/lib/catalog-store";
import { normalizeMake, normalizeModel, modelToDisplayName, getCanonicalModelKey } from "@/lib/fitment-db/keys";

export const runtime = "nodejs";

// Static fallback for when catalog is empty
// Includes both current models and classic/defunct vehicles with fitment data
const COMMON_MODELS: Record<string, string[]> = {
  // Current manufacturers
  ford: ["Bronco", "Bronco Sport", "Edge", "Escape", "Expedition", "Explorer", "F-150", "F-250", "F-350", "Fusion", "Maverick", "Mustang", "Ranger", "Transit"],
  chevrolet: [
    "Blazer", "Camaro", "Colorado", "Corvette", "Equinox", "Malibu", 
    "Silverado 1500", "Silverado 2500 HD", "Silverado 3500 HD", 
    "Suburban", "Tahoe", "Trailblazer", "Traverse",
    "Cavalier", "Chevelle", "Cobalt", "Caprice", "Impala", 
    "Lumina", "Monte Carlo", "Cruze"
  ],
  ram: ["1500", "2500", "3500", "ProMaster"],
  toyota: ["4Runner", "Camry", "Corolla", "GR86", "Highlander", "Land Cruiser", "Prius", "RAV4", "Sequoia", "Sienna", "Tacoma", "Tundra"],
  honda: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Passport", "Pilot", "Ridgeline"],
  nissan: ["370Z", "Altima", "Armada", "Frontier", "Kicks", "Maxima", "Murano", "Pathfinder", "Rogue", "Sentra", "Titan", "Versa", "Z"],
  jeep: ["Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Grand Cherokee L", "Grand Wagoneer", "Renegade", "Wagoneer", "Wrangler"],
  gmc: ["Acadia", "Canyon", "Sierra 1500", "Sierra 2500 HD", "Sierra 3500 HD", "Terrain", "Yukon", "Yukon XL"],
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
  cadillac: ["CT4", "CT5", "Escalade", "Escalade ESV", "Lyriq", "XT4", "XT5", "XT6", "CTS", "DeVille", "Eldorado", "Seville", "STS"],
  lincoln: ["Aviator", "Corsair", "Nautilus", "Navigator", "Town Car", "Continental", "MKZ"],
  buick: ["Enclave", "Encore", "Encore GX", "Envision", "Century", "LeSabre", "Park Avenue", "Regal", "Riviera", "Skylark"],
  chrysler: ["300", "Pacifica", "Voyager", "PT Cruiser", "Sebring", "Town & Country"],
  tesla: ["Model 3", "Model S", "Model X", "Model Y"],
  porsche: ["718 Boxster", "718 Cayman", "911", "Cayenne", "Macan", "Panamera", "Taycan"],
  "land-rover": ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar"],
  volvo: ["C40 Recharge", "S60", "S90", "V60", "V90", "XC40", "XC60", "XC90"],
  mini: ["Clubman", "Convertible", "Countryman", "Hardtop 2 Door", "Hardtop 4 Door"],
  mitsubishi: ["Eclipse Cross", "Mirage", "Outlander", "Outlander Sport", "Eclipse", "Lancer"],
  // Defunct/classic brands
  pontiac: ["Firebird", "Trans Am", "GTO", "Grand Am", "Grand Prix", "Bonneville", "Sunfire", "G6", "G8", "Solstice", "Vibe", "Aztek", "Montana"],
  oldsmobile: ["442", "Alero", "Aurora", "Bravada", "Cutlass", "Cutlass Supreme", "Delta 88", "Intrigue", "Silhouette", "Toronado"],
  saturn: ["Astra", "Aura", "Ion", "L-Series", "Outlook", "Relay", "S-Series", "SC", "SL", "SW", "Sky", "Vue"],
  mercury: ["Cougar", "Grand Marquis", "Mariner", "Milan", "Montego", "Monterey", "Mountaineer", "Sable", "Tracer", "Villager"],
  plymouth: ["Barracuda", "Breeze", "Duster", "Fury", "Grand Voyager", "Neon", "Prowler", "Road Runner", "Sundance", "Voyager"],
  hummer: ["H1", "H2", "H3", "H3T"],
  scion: ["FR-S", "iA", "iM", "iQ", "tC", "xA", "xB", "xD"],
};

/**
 * GET /api/vehicles/models?make=Buick&year=2006
 * 
 * Returns available models from database catalog, filtered by year when provided.
 * DB-only - no external API calls.
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
   * Filter models by year if provided, with proper deduplication.
   */
  function filterByYear(models: { name: string; years?: number[] }[]): string[] {
    const modelMap = new Map<string, string>();
    
    for (const m of models) {
      // Year filter
      if (year && !isNaN(year)) {
        const years = m.years || [];
        if (years.length > 0 && !years.includes(year)) continue;
      }
      
      // Dedupe by canonical key
      const key = getCanonicalModelKey(m.name);
      const displayName = modelToDisplayName(m.name);
      
      // Skip null display names (suppressed) and don't override existing
      if (displayName && !modelMap.has(key)) {
        modelMap.set(key, displayName);
      }
    }
    
    const result = Array.from(modelMap.values()).sort();
    console.log(`[models] Year filter: ${year || "all"} ${make} → ${result.length}/${models.length} models`);
    return result;
  }

  // Try year-specific catalog query first (most efficient)
  if (year && !isNaN(year)) {
    const yearModels = await catalogStore.getModelsByYear(makeSlug, year);
    
    // Also check vehicle_fitments for locally imported data
    const fitmentModels = await catalogStore.getFitmentModelsByYear(year, makeSlug);
    
    // Merge results using canonical keys for deduplication
    // Map: canonical key → display name
    const modelMap = new Map<string, string>();
    
    // Add catalog models (use name as-is, but dedupe by canonical key)
    for (const m of yearModels) {
      const key = getCanonicalModelKey(m.name);
      const displayName = modelToDisplayName(m.name);
      // Skip null display names (suppressed models like "Silverado HD")
      if (displayName && !modelMap.has(key)) {
        modelMap.set(key, displayName);
      }
    }
    
    // Add fitment models (convert slugs to display names)
    for (const slug of fitmentModels) {
      const key = getCanonicalModelKey(slug);
      const displayName = modelToDisplayName(slug);
      // Skip null display names and don't override existing entries
      if (displayName && !modelMap.has(key)) {
        modelMap.set(key, displayName);
      }
    }
    
    if (modelMap.size > 0) {
      const models = Array.from(modelMap.values()).sort();
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

  // Fallback: Try full catalog (no year filter)
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
