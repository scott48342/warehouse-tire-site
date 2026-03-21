import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = "https://api.wheel-size.com/v2/";

function getApiKey(): string | null {
  return process.env.WHEELSIZE_API_KEY || null;
}

/**
 * GET /api/vehicles/models?year=2005&make=Cadillac
 * 
 * Returns available models from Wheel-Size API with package engine fallback.
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

  const apiKey = getApiKey();
  const makeSlug = make.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  console.log(`[models] apiKey=${apiKey ? "SET" : "MISSING"}, makeSlug=${makeSlug}`);

  // Try Wheel-Size API first
  if (apiKey) {
    try {
      const apiUrl = new URL("models/", BASE_URL);
      apiUrl.searchParams.set("user_key", apiKey);
      apiUrl.searchParams.set("make", makeSlug);
      apiUrl.searchParams.set("year", year);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(apiUrl.toString(), {
        headers: { Accept: "application/json" },
        next: { revalidate: 86400 },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      console.log(`[models] Wheel-Size response: status=${res.status}`);
      
      if (res.ok) {
        const data = await res.json();
        const models = data?.data || [];
        console.log(`[models] Wheel-Size returned ${models.length} models`);
        
        if (models.length > 0) {
          const results = models.map((m: any) => m?.name || m?.slug).filter(Boolean).sort();
          console.log(`[models] Returning ${results.length} results from Wheel-Size`);
          return NextResponse.json({ results }, {
            headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
          });
        }
      }
      
      // If rate limited or empty, fall through to package engine
      if (res.status === 429) {
        console.log(`[models] Wheel-Size rate limited (429)`);
      } else {
        console.log(`[models] Wheel-Size returned ${res.status} or empty, trying fallback`);
      }
    } catch (err: any) {
      console.error(`[models] Wheel-Size error:`, err?.message);
    }
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
