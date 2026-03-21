import { NextResponse } from "next/server";
import { isInCooldown, record429, recordSuccess, getCacheStats } from "@/lib/fitmentCache";
import { normalizeTrimLabel } from "@/lib/trimNormalize";

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

  // Check if we're in 429 cooldown
  // NOTE: Only skip API call during cooldown - still try package engine fallback
  const inCooldown = isInCooldown();
  if (inCooldown) {
    console.log(`[trims] In cooldown, skipping Wheel-Size API, trying fallback`);
  }

  // Try Wheel-Size API first (skip if in cooldown)
  if (apiKey && !inCooldown) {
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

      // Handle 429 rate limit
      if (res.status === 429) {
        record429();
        return NextResponse.json({ 
          results: [],
          error: "Rate limited",
          cacheStats: getCacheStats(),
        });
      }

      if (res.ok) {
        recordSuccess();
        const data = await res.json();
        const allMods: Modification[] = data?.data || [];
        
        if (allMods.length > 0) {
          const usMods = allMods.filter(m => m.regions?.includes("usdm"));
          const mods = usMods.length > 0 ? usMods : allMods;

          const results = mods.map((m) => {
            // Safely extract string values - API sometimes returns objects
            const safeStr = (v: unknown): string => {
              if (v === null || v === undefined) return "";
              if (typeof v === "string") return v.trim();
              if (typeof v === "number") return String(v);
              if (typeof v === "object") {
                const obj = v as Record<string, unknown>;
                // Try common string properties
                if (typeof obj.name === "string") return obj.name.trim();
                if (typeof obj.value === "string") return obj.value.trim();
                if (typeof obj.label === "string") return obj.label.trim();
                return ""; // Don't use [object Object]
              }
              return "";
            };
            
            const trimStr = safeStr(m.trim);
            const engineStr = safeStr(m.engine);
            
            // Build display label - normalize engine codes to friendly trim names
            // Pass engineStr to normalizer so it can map "5.7i" → "Z28"
            const normalized = normalizeTrimLabel(trimStr, engineStr, year, make, model);
            
            // Never show modification IDs or raw engine codes
            const label = normalized || "Base";
            
            return { value: m.slug, label };
          });

          // Dedupe by label
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
          const trimLevel = it.trimLevel || it.trim || "";
          const engineCode = it.engineCode || "";
          const value = mod ? `${mod}__${String(trimLevel).replace(/\s+/g, "-").toLowerCase()}__${engineCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
          
          // Normalize engine codes to friendly trim names
          const label = normalizeTrimLabel(String(trimLevel), String(engineCode), year, make, model) || "Base";
          
          if (!value) return null;
          return { value, label };
        }).filter(Boolean);

        // Dedupe by label
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
