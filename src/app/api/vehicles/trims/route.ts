import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = "https://api.wheel-size.com/v2/";

function getApiKey(): string {
  const key = process.env.WHEELSIZE_API_KEY;
  if (!key) throw new Error("Missing WHEELSIZE_API_KEY");
  return key;
}

type Modification = {
  slug: string;
  name: string;
  trim?: string;
  engine?: string;
  body?: string;
  generation?: string;
  regions?: string[];
};

/**
 * GET /api/vehicles/trims?year=2005&make=Cadillac&model=CTS
 * 
 * Returns available trims/modifications for a vehicle from Wheel-Size API directly.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  if (!year || !make || !model) {
    return NextResponse.json({ results: [] });
  }

  // Convert to slug format
  const makeSlug = make.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  const modelSlug = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");

  try {
    const apiUrl = new URL("modifications/", BASE_URL);
    apiUrl.searchParams.set("user_key", getApiKey());
    apiUrl.searchParams.set("make", makeSlug);
    apiUrl.searchParams.set("model", modelSlug);
    apiUrl.searchParams.set("year", year);

    const res = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[trims] Wheel-Size API error: ${res.status} for ${makeSlug}/${modelSlug}/${year}`);
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();
    const allMods: Modification[] = data?.data || [];

    // Prefer US market modifications
    const usMods = allMods.filter(m => m.regions?.includes("usdm"));
    const mods = usMods.length > 0 ? usMods : allMods;

    // Build trim options with slug as value and descriptive label
    const results = mods.map((m) => {
      // Build a descriptive label
      const parts: string[] = [];
      if (m.trim) parts.push(m.trim);
      if (m.engine) parts.push(m.engine);
      if (m.body) parts.push(m.body);
      
      const label = parts.length > 0 ? parts.join(" / ") : m.name || m.slug;
      
      // Value format: slug (for Wheel-Size API compatibility)
      // The tire-sizes and other endpoints can use this slug directly
      return {
        value: m.slug,
        label: label,
      };
    });

    // Deduplicate by label (keep first)
    const seen = new Set<string>();
    const dedupedResults: Array<{ value: string; label: string }> = [];
    for (const r of results) {
      const k = r.label.trim().toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      dedupedResults.push(r);
    }

    return NextResponse.json({ results: dedupedResults });
  } catch (err: any) {
    console.error(`[trims] Error:`, err?.message || err);
    return NextResponse.json({ results: [] });
  }
}
