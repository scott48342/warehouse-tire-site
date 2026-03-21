import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = "https://api.wheel-size.com/v2/";

function getApiKey(): string {
  const key = process.env.WHEELSIZE_API_KEY;
  if (!key) throw new Error("Missing WHEELSIZE_API_KEY");
  return key;
}

/**
 * GET /api/vehicles/models?year=2005&make=Cadillac
 * 
 * Returns available models for a given year/make from Wheel-Size API directly.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");

  if (!year || !make) {
    return NextResponse.json({ results: [] });
  }

  // Convert make to slug format (lowercase, dashes)
  const makeSlug = make.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");

  try {
    const apiUrl = new URL("models/", BASE_URL);
    apiUrl.searchParams.set("user_key", getApiKey());
    apiUrl.searchParams.set("make", makeSlug);
    apiUrl.searchParams.set("year", year);

    const res = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[models] Wheel-Size API error: ${res.status} for ${makeSlug}/${year}`);
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();
    const models = data?.data || [];

    // Return model names, sorted alphabetically
    const results = models
      .map((m: any) => m?.name || m?.slug)
      .filter(Boolean)
      .sort();

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error(`[models] Error:`, err?.message || err);
    return NextResponse.json({ results: [] });
  }
}
