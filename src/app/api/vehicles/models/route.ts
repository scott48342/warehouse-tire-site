import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = "https://api.wheel-size.com/v2/";

function getApiKey(): string | null {
  return process.env.WHEELSIZE_API_KEY || null;
}

/**
 * GET /api/vehicles/models?year=2005&make=Cadillac
 * 
 * Returns available models for a given year/make from Wheel-Size API.
 * Caches responses for 24 hours.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");

  if (!year || !make) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("[models] Missing WHEELSIZE_API_KEY");
    return NextResponse.json({ results: [], error: "API not configured" });
  }

  // Convert make to slug format (lowercase, dashes)
  const makeSlug = make.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");

  try {
    const apiUrl = new URL("models/", BASE_URL);
    apiUrl.searchParams.set("user_key", apiKey);
    apiUrl.searchParams.set("make", makeSlug);
    apiUrl.searchParams.set("year", year);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json" },
      // Cache at edge for 24 hours
      next: { revalidate: 86400 },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.status === 429) {
      console.error(`[models] Rate limited for ${makeSlug}/${year}`);
      return NextResponse.json(
        { results: [], error: "Rate limited - please try again in a minute" },
        { 
          status: 200,
          headers: { "Retry-After": "60" }
        }
      );
    }

    if (!res.ok) {
      console.error(`[models] API error: ${res.status} for ${makeSlug}/${year}`);
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();
    const models = data?.data || [];

    const results = models
      .map((m: any) => m?.name || m?.slug)
      .filter(Boolean)
      .sort();

    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      }
    );
  } catch (err: any) {
    console.error(`[models] Error:`, err?.message || err);
    return NextResponse.json({ results: [] });
  }
}
