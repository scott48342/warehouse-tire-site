import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = "https://api.wheel-size.com/v2/";

function getApiKey(): string | null {
  return process.env.WHEELSIZE_API_KEY || null;
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
 * Returns available trims/modifications from Wheel-Size API.
 * Caches responses for 24 hours.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  if (!year || !make || !model) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("[trims] Missing WHEELSIZE_API_KEY");
    return NextResponse.json({ results: [], error: "API not configured" });
  }

  // Convert to slug format
  const makeSlug = make.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  const modelSlug = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");

  try {
    const apiUrl = new URL("modifications/", BASE_URL);
    apiUrl.searchParams.set("user_key", apiKey);
    apiUrl.searchParams.set("make", makeSlug);
    apiUrl.searchParams.set("model", modelSlug);
    apiUrl.searchParams.set("year", year);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.status === 429) {
      console.error(`[trims] Rate limited for ${makeSlug}/${modelSlug}/${year}`);
      return NextResponse.json(
        { results: [], error: "Rate limited - please try again" },
        { 
          status: 200,
          headers: { "Retry-After": "60" }
        }
      );
    }

    if (!res.ok) {
      console.error(`[trims] API error: ${res.status}`);
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();
    const allMods: Modification[] = data?.data || [];

    // Prefer US market modifications
    const usMods = allMods.filter(m => m.regions?.includes("usdm"));
    const mods = usMods.length > 0 ? usMods : allMods;

    // Build trim options
    const results = mods.map((m) => {
      const parts: string[] = [];
      if (m.trim) parts.push(m.trim);
      if (m.engine) parts.push(m.engine);
      if (m.body) parts.push(m.body);
      
      const label = parts.length > 0 ? parts.join(" / ") : m.name || m.slug;
      
      return {
        value: m.slug,
        label: label,
      };
    });

    // Deduplicate by label
    const seen = new Set<string>();
    const dedupedResults: Array<{ value: string; label: string }> = [];
    for (const r of results) {
      const k = r.label.trim().toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      dedupedResults.push(r);
    }

    return NextResponse.json(
      { results: dedupedResults },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      }
    );
  } catch (err: any) {
    console.error(`[trims] Error:`, err?.message || err);
    return NextResponse.json({ results: [] });
  }
}
