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
  regions?: string[];
};

/**
 * GET /api/vehicles/trims?year=2005&make=Cadillac&model=CTS
 * 
 * Returns available trims from Wheel-Size API with package engine fallback.
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
  const makeSlug = make.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  const modelSlug = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");

  // Try Wheel-Size API first
  if (apiKey) {
    try {
      const apiUrl = new URL("modifications/", BASE_URL);
      apiUrl.searchParams.set("user_key", apiKey);
      apiUrl.searchParams.set("make", makeSlug);
      apiUrl.searchParams.set("model", modelSlug);
      apiUrl.searchParams.set("year", year);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(apiUrl.toString(), {
        headers: { Accept: "application/json" },
        next: { revalidate: 86400 },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const allMods: Modification[] = data?.data || [];
        
        if (allMods.length > 0) {
          const usMods = allMods.filter(m => m.regions?.includes("usdm"));
          const mods = usMods.length > 0 ? usMods : allMods;

          const results = mods.map((m) => {
            const parts: string[] = [];
            if (m.trim) parts.push(m.trim);
            if (m.engine) parts.push(m.engine);
            if (m.body) parts.push(m.body);
            const label = parts.length > 0 ? parts.join(" / ") : m.name || m.slug;
            return { value: m.slug, label };
          });

          // Dedupe
          const seen = new Set<string>();
          const deduped = results.filter(r => {
            const k = r.label.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });

          return NextResponse.json({ results: deduped }, {
            headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
          });
        }
      }
    } catch (err: any) {
      console.error(`[trims] Wheel-Size error:`, err?.message);
    }
  }

  // Fallback to package engine
  const pkgUrl = process.env.PACKAGE_ENGINE_URL;
  if (pkgUrl) {
    try {
      const upstream = new URL("/v1/vehicles/trims", pkgUrl);
      upstream.searchParams.set("year", year);
      upstream.searchParams.set("make", make);
      upstream.searchParams.set("model", model);

      const res = await fetch(upstream.toString(), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data?.results) ? data.results : [];

        const mapped = raw.map((it: any) => {
          if (!it || typeof it !== "object") return null;
          const mod = it.modification ? String(it.modification) : "";
          const baseLabel = it.trimLevel || it.trim || it.modification;
          const engineCode = (it.engineCode || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          const value = mod ? `${mod}__${String(baseLabel).replace(/\s+/g, "-").toLowerCase()}__${engineCode}` : "";
          const label = baseLabel ? String(baseLabel) : "";
          if (!value || !label) return null;
          return { value, label };
        }).filter(Boolean);

        const seen = new Set<string>();
        const results = mapped.filter((r: any) => {
          const k = r.label.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        return NextResponse.json({ results });
      }
    } catch (err: any) {
      console.error(`[trims] Package engine error:`, err?.message);
    }
  }

  return NextResponse.json({ results: [] });
}
