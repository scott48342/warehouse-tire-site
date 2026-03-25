import { NextResponse } from "next/server";
import * as catalogStore from "@/lib/catalog-store";
import * as wheelSizeApi from "@/lib/wheelSizeApi";
import { normalizeMake } from "@/lib/fitment-db/keys";

export const runtime = "nodejs";

// Static fallback for when API/catalog unavailable
const COMMON_MODELS: Record<string, string[]> = {
  ford: ["Bronco", "Bronco Sport", "Edge", "Escape", "Expedition", "Explorer", "F-150", "F-250", "F-350", "Fusion", "Maverick", "Mustang", "Ranger", "Transit"],
  chevrolet: ["Blazer", "Camaro", "Colorado", "Corvette", "Equinox", "Malibu", "Silverado 1500", "Silverado 2500", "Silverado 3500", "Suburban", "Tahoe", "Trailblazer", "Traverse"],
  ram: ["1500", "2500", "3500", "ProMaster"],
  toyota: ["4Runner", "Camry", "Corolla", "GR86", "Highlander", "Land Cruiser", "Prius", "RAV4", "Sequoia", "Sienna", "Tacoma", "Tundra"],
  honda: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Passport", "Pilot", "Ridgeline"],
  nissan: ["370Z", "Altima", "Armada", "Frontier", "Kicks", "Maxima", "Murano", "Pathfinder", "Rogue", "Sentra", "Titan", "Versa", "Z"],
  jeep: ["Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Grand Cherokee L", "Grand Wagoneer", "Renegade", "Wagoneer", "Wrangler"],
  gmc: ["Acadia", "Canyon", "Sierra 1500", "Sierra 2500", "Sierra 3500", "Terrain", "Yukon", "Yukon XL"],
  dodge: ["Challenger", "Charger", "Durango", "Hornet"],
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
  cadillac: ["CT4", "CT5", "Escalade", "Escalade ESV", "Lyriq", "XT4", "XT5", "XT6"],
  lincoln: ["Aviator", "Corsair", "Nautilus", "Navigator"],
  buick: ["Enclave", "Encore", "Encore GX", "Envision"],
  chrysler: ["300", "Pacifica", "Voyager"],
  tesla: ["Model 3", "Model S", "Model X", "Model Y"],
  porsche: ["718 Boxster", "718 Cayman", "911", "Cayenne", "Macan", "Panamera", "Taycan"],
  "land-rover": ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar"],
  volvo: ["C40 Recharge", "S60", "S90", "V60", "V90", "XC40", "XC60", "XC90"],
  mini: ["Clubman", "Convertible", "Countryman", "Hardtop 2 Door", "Hardtop 4 Door"],
  mitsubishi: ["Eclipse Cross", "Mirage", "Outlander", "Outlander Sport"],
};

/**
 * GET /api/vehicles/models?make=Buick
 * 
 * Returns available models from catalog, with API fallback.
 * Populates catalog on API fetch for future requests.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const make = url.searchParams.get("make");

  if (!make) {
    return NextResponse.json({ results: [] });
  }

  const makeSlug = normalizeMake(make);

  // Try catalog first
  const catalogModels = catalogStore.getModels(makeSlug);
  if (catalogModels.length > 0) {
    console.log(`[models] CATALOG HIT: ${make} → ${catalogModels.length} models`);
    return NextResponse.json({ 
      results: catalogModels.map(m => m.name).sort(),
      source: "catalog",
    }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  }

  // Catalog miss - try API
  try {
    const foundMake = await wheelSizeApi.findMake(make);
    if (foundMake) {
      // Populate catalog with models AND their valid years
      const count = await catalogStore.populateModels(foundMake.slug);
      if (count > 0) {
        const models = catalogStore.getModels(foundMake.slug);
        console.log(`[models] API → CATALOG: ${make} → ${models.length} models (with years)`);
        return NextResponse.json({ 
          results: models.map(m => m.name).sort(),
          source: "api",
        }, {
          headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
        });
      }
    }
  } catch (err: any) {
    console.error(`[models] API error for ${make}:`, err?.message);
  }

  // Final fallback: static list
  const staticKey = makeSlug.replace(/-/g, "");
  const staticModels = COMMON_MODELS[staticKey] || COMMON_MODELS[makeSlug];
  if (staticModels) {
    console.log(`[models] STATIC fallback: ${make} → ${staticModels.length} models`);
    return NextResponse.json({ 
      results: staticModels,
      source: "static",
    }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  }

  console.warn(`[models] No data for ${make}`);
  return NextResponse.json({ results: [] });
}
