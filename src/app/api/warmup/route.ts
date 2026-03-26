import { NextResponse } from "next/server";
import { warmTechfeedWheelCache } from "@/lib/techfeed/wheels";
import { warmBrowseCache } from "@/lib/techfeed/wheels-browse";
import { runPrewarmJob, PREWARM_TARGETS } from "@/lib/availabilityPrewarm";
import { getCacheStats } from "@/lib/availabilityCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes max for full warmup

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  // Include availability pre-warm (slower but comprehensive)
  const includeAvailabilityParam = url.searchParams.get("availability") === "1";
  // Quick mode: just techfeed + browse, skip WheelPros API calls
  const quick = url.searchParams.get("quick") === "1";
  // Priority filter: only warm priority 1 (fastest), 1-2 (medium), or all (slowest)
  const priorityParam = url.searchParams.get("priority");
  const maxPriority = priorityParam ? parseInt(priorityParam, 10) : 2;
  
  // Auto-detect cold cache: if cache hit rate is very low, automatically include availability
  const cacheStats = await getCacheStats();
  const totalRequests = cacheStats.hits + cacheStats.misses;
  const hitRate = cacheStats.hitRate; // Already computed in cacheStats
  const isCacheCold = totalRequests < 100 || hitRate < 0.3;
  
  // Only auto-prewarm on production (preview deployments don't have WheelPros credentials)
  const isProduction = process.env.VERCEL_ENV === "production" || 
                       process.env.NODE_ENV === "production" && !process.env.VERCEL_URL?.includes("-");
  
  // Include availability if explicitly requested OR (cache is cold AND we're on production)
  const includeAvailability = includeAvailabilityParam || (isCacheCold && !quick && isProduction);

  const t0 = Date.now();
  
  // Warm techfeed SKU lookup cache
  const tf0 = Date.now();
  const tf = await warmTechfeedWheelCache();
  const techfeedMs = Date.now() - tf0;

  // Warm the new fast browse cache (builds style index)
  const browse0 = Date.now();
  const browse = await warmBrowseCache();
  const browseMs = Date.now() - browse0;

  let wheelsUrl = "";
  let wheelsStatus = 0;
  let wheelsMs = 0;

  if (!quick) {
    // Warm the WheelPros wheels search path (wrapper + our in-memory cache).
    const base = getBaseUrl();
    const wp0 = Date.now();
    wheelsUrl = `${base}/api/wheelpros/wheels/search?page=1&pageSize=8&fields=images&priceType=msrp&currencyCode=USD&boltPattern=5x115${debug ? "&debug=1" : ""}`;
    try {
      const res = await fetch(wheelsUrl, { cache: "no-store" });
      wheelsStatus = res.status;
      // Drain body to avoid leaking sockets
      await res.arrayBuffer();
    } catch {
      wheelsStatus = 0;
    }
    wheelsMs = Date.now() - wp0;
  }

  // Optionally pre-warm availability cache (full job)
  let availabilityResult = null;
  let availabilityMs = 0;
  if (includeAvailability) {
    const avail0 = Date.now();
    try {
      availabilityResult = await runPrewarmJob({
        // Filter targets by priority (1 = fastest, 3 = slowest)
        targets: PREWARM_TARGETS.filter(t => t.priority <= maxPriority),
        // Limit SKUs based on priority for faster warmup
        maxSkusPerPattern: maxPriority <= 1 ? 50 : maxPriority <= 2 ? 100 : 150,
      });
    } catch (e: any) {
      availabilityResult = { error: e?.message || String(e) };
    }
    availabilityMs = Date.now() - avail0;
  }

  const totalMs = Date.now() - t0;

  return NextResponse.json(
    {
      ok: true,
      techfeed: { ...tf, ms: techfeedMs },
      browse: { ...browse, ms: browseMs },
      wheelpros: quick ? { skipped: true } : { url: wheelsUrl, status: wheelsStatus, ms: wheelsMs },
      availability: includeAvailability 
        ? { 
            ...availabilityResult, 
            ms: availabilityMs,
            autoTriggered: isCacheCold && !includeAvailabilityParam,
            maxPriority,
          }
        : { 
            skipped: true, 
            hint: "Add ?availability=1 to pre-warm availability cache (auto-triggers when cache is cold)",
            cacheStats: getCacheStats(),
            cacheColdDetected: isCacheCold,
            hitRate: Math.round(hitRate * 100) + "%",
          },
      totalMs,
      at: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
        ...(debug
          ? {
              "x-wt-techfeed-ms": String(techfeedMs),
              "x-wt-browse-ms": String(browseMs),
              "x-wt-wheelpros-ms": String(wheelsMs),
              "x-wt-availability-ms": String(availabilityMs),
              "x-wt-total-ms": String(totalMs),
              "server-timing": `techfeed;dur=${techfeedMs}, browse;dur=${browseMs}, wheelpros;dur=${wheelsMs}, availability;dur=${availabilityMs}, total;dur=${totalMs}`,
            }
          : null),
      },
    }
  );
}
