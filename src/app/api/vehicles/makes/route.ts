import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = "https://api.wheel-size.com/v2/";

function getApiKey(): string {
  const key = process.env.WHEELSIZE_API_KEY;
  if (!key) throw new Error("Missing WHEELSIZE_API_KEY");
  return key;
}

/**
 * GET /api/vehicles/makes?year=2005
 * 
 * Returns available makes for a given year from Wheel-Size API directly.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");

  if (!year) {
    return NextResponse.json({ results: [] });
  }

  try {
    const apiUrl = new URL("makes/", BASE_URL);
    apiUrl.searchParams.set("user_key", getApiKey());

    const res = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[makes] Wheel-Size API error: ${res.status}`);
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();
    const allMakes = data?.data || [];

    // Wheel-Size returns all makes; filter to those with models for the given year
    // For efficiency, we just return all makes and let the models endpoint filter
    const results = allMakes
      .map((m: any) => m?.name || m?.slug)
      .filter(Boolean)
      .sort();

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error(`[makes] Error:`, err?.message || err);
    return NextResponse.json({ results: [] });
  }
}
