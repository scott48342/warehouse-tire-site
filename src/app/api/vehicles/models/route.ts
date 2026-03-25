import { NextResponse } from "next/server";
import { getModels, findMake } from "@/lib/wheelSizeApi";

export const runtime = "nodejs";

// Static fallback for common makes - used when API is unavailable/rate-limited
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
  "land rover": ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar"],
  volvo: ["C40 Recharge", "S60", "S90", "V60", "V90", "XC40", "XC60", "XC90"],
  mini: ["Clubman", "Convertible", "Countryman", "Hardtop 2 Door", "Hardtop 4 Door"],
  mitsubishi: ["Eclipse Cross", "Mirage", "Outlander", "Outlander Sport"],
};

function getStaticModels(make: string): string[] | null {
  const key = make.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return COMMON_MODELS[key] || null;
}

/**
 * GET /api/vehicles/models?year=2005&make=Cadillac
 * 
 * Returns available models from Wheel-Size API (with in-memory caching) 
 * with static fallback for common makes when API unavailable.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");

  console.log(`[models] Request: year=${year}, make=${make}`);

  if (!year || !make) {
    console.log(`[models] Missing params, returning empty`);
    return NextResponse.json({ results: [] });
  }

  // Try Wheel-Size API first (uses cached wheelSizeApi module)
  try {
    // Resolve make to slug first
    const foundMake = await findMake(make);
    if (foundMake) {
      const models = await getModels(foundMake.slug);
      console.log(`[models] Wheel-Size returned ${models.length} models for ${foundMake.slug}`);
      
      if (models.length > 0) {
        const results = models.map((m: any) => m?.name || m?.slug).filter(Boolean).sort();
        console.log(`[models] Returning ${results.length} results from Wheel-Size`);
        return NextResponse.json({ results }, {
          headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
        });
      }
    } else {
      console.log(`[models] Make "${make}" not found in Wheel-Size`);
    }
  } catch (err: any) {
    // Rate limited or other API error - fall through to fallbacks
    console.error(`[models] Wheel-Size error:`, err?.message);
  }

  // Fallback to package engine (if configured)
  const pkgUrl = process.env.PACKAGE_ENGINE_URL;
  
  if (pkgUrl) {
    try {
      const upstream = new URL("/v1/vehicles/models", pkgUrl);
      upstream.searchParams.set("year", year);
      upstream.searchParams.set("make", make);
      console.log(`[models] Calling package engine: ${upstream.toString()}`);

      const res = await fetch(upstream.toString(), { cache: "no-store" });
      console.log(`[models] Package engine response: status=${res.status}`);
      
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data?.results) ? data.results.length : 0;
        console.log(`[models] Package engine returned ${count} results`);
        return NextResponse.json(data);
      }
    } catch (err: any) {
      console.error(`[models] Package engine error:`, err?.message);
    }
  }

  // Final fallback: static common models list
  const staticModels = getStaticModels(make);
  if (staticModels) {
    console.log(`[models] Using static fallback for ${make}: ${staticModels.length} models`);
    return NextResponse.json({ results: staticModels, source: "static" }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  }

  console.log(`[models] No results from any source, returning empty`);
  return NextResponse.json({ results: [] });
}
