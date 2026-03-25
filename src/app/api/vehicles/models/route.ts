import { NextResponse } from "next/server";
import { getModels, findMake } from "@/lib/wheelSizeApi";

export const runtime = "nodejs";

/**
 * GET /api/vehicles/models?year=2005&make=Cadillac
 * 
 * Returns available models from Wheel-Size API (with in-memory caching) 
 * and package engine fallback.
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
    // Rate limited or other API error - fall through to package engine
    console.error(`[models] Wheel-Size error:`, err?.message);
  }

  // Fallback to package engine
  const pkgUrl = process.env.PACKAGE_ENGINE_URL;
  console.log(`[models] Package engine URL: ${pkgUrl ? "SET" : "MISSING"}`);
  
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

  console.log(`[models] No results from any source, returning empty`);
  return NextResponse.json({ results: [] });
}
