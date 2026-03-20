import { NextResponse } from "next/server";
import { warmTechfeedWheelCache } from "@/lib/techfeed/wheels";
import { warmBrowseCache } from "@/lib/techfeed/wheels-browse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  const t0 = Date.now();
  
  // Warm techfeed SKU lookup cache
  const tf0 = Date.now();
  const tf = await warmTechfeedWheelCache();
  const techfeedMs = Date.now() - tf0;

  // Warm the new fast browse cache (builds style index)
  const browse0 = Date.now();
  const browse = await warmBrowseCache();
  const browseMs = Date.now() - browse0;

  // Warm the WheelPros wheels search path (wrapper + our in-memory cache).
  const base = getBaseUrl();
  const wp0 = Date.now();
  const wheelsUrl = `${base}/api/wheelpros/wheels/search?page=1&pageSize=8&fields=images&priceType=msrp&currencyCode=USD&boltPattern=5x115${debug ? "&debug=1" : ""}`;
  let wheelsStatus = 0;
  try {
    const res = await fetch(wheelsUrl, { cache: "no-store" });
    wheelsStatus = res.status;
    // Drain body to avoid leaking sockets
    await res.arrayBuffer();
  } catch {
    wheelsStatus = 0;
  }
  const wheelsMs = Date.now() - wp0;

  const totalMs = Date.now() - t0;

  return NextResponse.json(
    {
      ok: true,
      techfeed: { ...tf, ms: techfeedMs },
      browse: { ...browse, ms: browseMs },
      wheelpros: { url: wheelsUrl, status: wheelsStatus, ms: wheelsMs },
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
              "x-wt-total-ms": String(totalMs),
              "server-timing": `techfeed;dur=${techfeedMs}, browse;dur=${browseMs}, wheelpros;dur=${wheelsMs}, total;dur=${totalMs}`,
            }
          : null),
      },
    }
  );
}
