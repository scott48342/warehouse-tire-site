/**
 * Fitment API — Landing-page live demo proxy
 *
 * GET /api/fitment-api/demo/{years|makes|models|trims|specs}?...
 *
 * Lets visitors on /fitment-api try the real data without an API key.
 * Calls the same service layer the public API uses (no key, no quota),
 * but is deliberately hobbled so it can't be used as a free API:
 *   - per-IP rate limit (in-memory, per-instance)
 *   - short edge cache on the cheap endpoints
 *   - same-origin only (Referer/Origin check) — soft, not a security boundary
 *   - no-store on specs so scrapers can't lean on the CDN
 *
 * Anyone who wants to use the data for real needs a key.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getPublicYears,
  getPublicMakes,
  getPublicModels,
  getPublicTrims,
  getPublicSpecs,
} from "@/lib/api/public-fitment-service";

export const runtime = "nodejs";

// ---- per-IP limiter (per serverless instance; good enough for a demo) ----
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60; // ~a full cascade is 5 calls; 12 lookups/min is plenty
const hits = new Map<string, { n: number; reset: number }>();

function limited(ip: string): { ok: boolean; remaining: number; resetSec: number } {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || cur.reset < now) {
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    if (hits.size > 5000) hits.clear(); // crude memory guard
    return { ok: true, remaining: MAX_PER_WINDOW - 1, resetSec: 60 };
  }
  cur.n += 1;
  return {
    ok: cur.n <= MAX_PER_WINDOW,
    remaining: Math.max(0, MAX_PER_WINDOW - cur.n),
    resetSec: Math.ceil((cur.reset - now) / 1000),
  };
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function sameOrigin(req: NextRequest): boolean {
  const host = req.headers.get("host") || "";
  const ref = req.headers.get("referer") || req.headers.get("origin") || "";
  if (!ref) return true; // browsers may strip; don't punish
  try {
    return new URL(ref).host === host;
  } catch {
    return false;
  }
}

function fail(status: number, code: string, message: string, extra?: Record<string, string>) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store", ...(extra || {}) } },
  );
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ endpoint: string }> }) {
  const { endpoint } = await ctx.params;

  if (!sameOrigin(req)) {
    return fail(403, "DEMO_ONLY", "This demo endpoint is for the landing page. Get an API key for programmatic access.");
  }

  const rl = limited(clientIp(req));
  if (!rl.ok) {
    return fail(429, "DEMO_RATE_LIMITED", "Demo limit reached — grab an API key for unlimited access.", {
      "Retry-After": String(rl.resetSec),
    });
  }

  const q = req.nextUrl.searchParams;
  const yearRaw = q.get("year");
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : undefined;
  const make = q.get("make") || undefined;
  const model = q.get("model") || undefined;
  const trim = q.get("trim") || q.get("trimId") || undefined;

  try {
    let data: unknown;
    let cache = "public, s-maxage=3600, stale-while-revalidate=86400";

    switch (endpoint) {
      case "years":
        data = await getPublicYears();
        break;
      case "makes":
        data = await getPublicMakes(year);
        break;
      case "models":
        if (!make) return fail(400, "MISSING_PARAM", "make is required");
        data = await getPublicModels(make, year);
        break;
      case "trims":
        if (!year || !make || !model) return fail(400, "MISSING_PARAM", "year, make and model are required");
        data = await getPublicTrims(year, make, model);
        break;
      case "specs":
        if (!year || !make || !model || !trim) return fail(400, "MISSING_PARAM", "year, make, model and trim are required");
        data = await getPublicSpecs(year, make, model, trim);
        cache = "no-store"; // the valuable bit — don't let the CDN hand it out for free
        if (!data) return fail(404, "NOT_FOUND", "No fitment data for that vehicle");
        break;
      default:
        return fail(404, "UNKNOWN_ENDPOINT", `Unknown endpoint: ${endpoint}`);
    }

    const count = Array.isArray(data) ? data.length : undefined;
    return NextResponse.json(
      { success: true, data, meta: { demo: true, ...(count !== undefined ? { count } : {}) } },
      {
        headers: {
          "Cache-Control": cache,
          "X-Demo-Remaining": String(rl.remaining),
        },
      },
    );
  } catch (err) {
    console.error(`[fitment-api/demo/${endpoint}]`, err);
    return fail(500, "INTERNAL", "Demo temporarily unavailable");
  }
}
