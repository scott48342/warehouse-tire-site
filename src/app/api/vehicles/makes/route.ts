import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = "https://api.wheel-size.com/v2/";

// Common makes as fallback (covers ~95% of US market)
const FALLBACK_MAKES = [
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick",
  "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford",
  "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
  "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lotus", "Maserati",
  "Mazda", "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan",
  "Polestar", "Porsche", "Ram", "Rivian", "Rolls-Royce", "Subaru", "Tesla",
  "Toyota", "Volkswagen", "Volvo"
].sort();

function getApiKey(): string | null {
  return process.env.WHEELSIZE_API_KEY || null;
}

/**
 * GET /api/vehicles/makes?year=2005
 * 
 * Returns available makes for a given year.
 * Tries Wheel-Size API first, falls back to hardcoded list.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");

  if (!year) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = getApiKey();
  
  // If no API key, return fallback immediately
  if (!apiKey) {
    console.log("[makes] No API key, using fallback makes list");
    return NextResponse.json({ results: FALLBACK_MAKES });
  }

  try {
    const apiUrl = new URL("makes/", BASE_URL);
    apiUrl.searchParams.set("user_key", apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[makes] Wheel-Size API error: ${res.status}, using fallback`);
      return NextResponse.json({ results: FALLBACK_MAKES });
    }

    const data = await res.json();
    const allMakes = data?.data || [];

    if (allMakes.length === 0) {
      console.log("[makes] Empty response from API, using fallback");
      return NextResponse.json({ results: FALLBACK_MAKES });
    }

    const results = allMakes
      .map((m: any) => m?.name || m?.slug)
      .filter(Boolean)
      .sort();

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error(`[makes] Error: ${err?.message}, using fallback`);
    return NextResponse.json({ results: FALLBACK_MAKES });
  }
}
