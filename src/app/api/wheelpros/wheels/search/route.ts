import { NextResponse } from "next/server";
import { getTechfeedWheelBySku } from "@/lib/techfeed/wheels";
import { calculateWheelSellPrice } from "@/lib/pricing";
import { getInventoryForSku } from "@/lib/inventoryCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Simple in-memory cache (best-effort; per-server instance).
// Helps a lot because WheelPros responses are relatively static.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<
  string,
  { expiresAt: number; status: number; headers: Record<string, string>; data: any }
>();

type WheelProsSearchResponse = {
  results?: any[];
  [k: string]: any;
};

function toWheelProsImages(urls: string[]) {
  return urls
    .filter(Boolean)
    .map((u) => ({
      imageUrlLarge: u,
      imageUrlMedium: u,
      imageUrlSmall: u,
      imageUrlThumbnail: u,
    }));
}

function hasAnyImage(it: any) {
  const imgs = Array.isArray(it?.images) ? it.images : [];
  return imgs.some((img: any) => {
    const u =
      img?.imageUrlLarge ||
      img?.imageUrlMedium ||
      img?.imageUrlOriginal ||
      img?.imageUrlSmall ||
      img?.imageUrlThumbnail;
    return typeof u === "string" && u.trim().length > 0;
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1" || process.env.WT_DIAGNOSTICS === "1";
  const t0 = debug ? Date.now() : 0;
  const base =
    process.env.WHEELPROS_WRAPPER_URL ||
    process.env.NEXT_PUBLIC_WHEELPROS_API_BASE_URL;
  if (!base) {
    return NextResponse.json(
      { error: "Missing WHEELPROS_WRAPPER_URL (or NEXT_PUBLIC_WHEELPROS_API_BASE_URL)" },
      { status: 500 }
    );
  }

  const upstream = new URL("/wheels/search", base);
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  // NOTE: The Railway wrapper appears to block "bot"/default Node fetch user agents (403 Forbidden).
  // Send a browser-like UA so server-to-server calls from Vercel/Node runtimes succeed.
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  };
  if (process.env.WHEELPROS_WRAPPER_API_KEY) {
    headers["x-api-key"] = process.env.WHEELPROS_WRAPPER_API_KEY;
  }

  const cacheKey = upstream.toString();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    const totalMs = debug ? Date.now() - t0 : 0;
    if (debug) {
      try {
        console.info("[api wheelpros/wheels/search] HIT", {
          totalMs,
          q: url.searchParams.get("q") || "",
          sku: url.searchParams.get("sku") || "",
          brand_cd: url.searchParams.get("brand_cd") || "",
          boltPattern: url.searchParams.get("boltPattern") || "",
          diameter: url.searchParams.get("diameter") || "",
          width: url.searchParams.get("width") || "",
          page: url.searchParams.get("page") || "",
          pageSize: url.searchParams.get("pageSize") || "",
        });
      } catch {
        // ignore
      }
    }

    return NextResponse.json(cached.data, {
      status: cached.status,
      headers: {
        "content-type": cached.headers["content-type"] || "application/json",
        "x-wt-cache": "HIT",
        ...(debug
          ? {
              "x-wt-total-ms": String(totalMs),
              "server-timing": `total;dur=${totalMs}`,
            }
          : null),
      },
    });
  }

  const tUp0 = debug ? Date.now() : 0;
  const res = await fetch(upstream.toString(), { headers, cache: "no-store" });
  const upstreamMs = debug ? Date.now() - tUp0 : 0;
  const ct = res.headers.get("content-type") || "application/json";

  let data: WheelProsSearchResponse | null = null;
  try {
    data = (await res.json()) as WheelProsSearchResponse;
  } catch {
    // If upstream didn't return JSON for some reason, just proxy through.
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { "content-type": ct } });
  }

  let enrichMs = debug ? 0 : 0;
  if (res.ok && data?.results?.length) {
    const tEn0 = debug ? Date.now() : 0;
    const enriched = await Promise.all(
      data.results.map(async (it) => {
        const sku = it?.sku ? String(it.sku) : "";
        if (!sku) return it;

        const tf = await getTechfeedWheelBySku(sku);
        if (!tf) return it;

        // Attach techfeed metadata for UI grouping.
        (it as any).techfeed = {
          style: tf.style || tf.display_style_no || "",
          finish:
            tf.abbreviated_finish_desc ||
            tf.fancy_finish_desc ||
            tf.box_label_desc ||
            tf.product_desc ||
            "",
          images: tf.images || [],
        };

        // Ensure properties are populated (WheelPros API sometimes returns blanks).
        it.properties = it.properties || {};
        if (tf.diameter && !it.properties.diameter) it.properties.diameter = tf.diameter;
        if (tf.width && !it.properties.width) it.properties.width = tf.width;
        if (tf.offset && !it.properties.offset) it.properties.offset = tf.offset;
        if (tf.centerbore && !it.properties.centerbore) it.properties.centerbore = tf.centerbore;

        // bolt patterns
        if (tf.bolt_pattern_metric && !it.properties.boltPatternMetric)
          it.properties.boltPatternMetric = tf.bolt_pattern_metric;
        if (tf.bolt_pattern_standard && !it.properties.boltPattern)
          it.properties.boltPattern = tf.bolt_pattern_standard;

        // finish (best effort)
        if (tf.abbreviated_finish_desc && !it.properties.finish)
          it.properties.finish = tf.abbreviated_finish_desc;

        // Apply pricing service for consistent pricing across all surfaces.
        // Priority: API pricing (fresh) > techfeed pricing (can be stale)
        // WheelPros API returns current MSRP; techfeed CSV may have outdated values.
        const apiMsrp = it.prices?.msrp?.[0]?.currencyAmount 
          ? Number(it.prices.msrp[0].currencyAmount) 
          : null;
        const apiMap = it.prices?.map?.[0]?.currencyAmount
          ? Number(it.prices.map[0].currencyAmount)
          : null;
        
        // Use API pricing when available, fall back to techfeed
        const sellPrice = calculateWheelSellPrice({
          map: apiMap ?? (tf.map_price ? Number(tf.map_price) : null),
          msrp: apiMsrp ?? (tf.msrp ? Number(tf.msrp) : null),
        });
        if (sellPrice !== null) {
          it.prices = it.prices || {};
          it.prices.msrp = [{ currencyAmount: String(sellPrice), currencyCode: "USD" }];
        }

        // Images: use techfeed when WheelPros images are missing.
        const urls = tf.images || [];
        if (urls.length && (!Array.isArray(it.images) || it.images.length === 0)) {
          it.images = toWheelProsImages(urls);
        }

        return it;
      })
    );

    // Remove products that have no images at all.
    // NOTE: Only do this when the caller is applying some kind of search/filter.
    // A completely unfiltered WheelPros browse can legitimately return many items
    // without images (or omit image fields), which would otherwise yield 0 results.
    enrichMs = debug ? Date.now() - tEn0 : 0;

    const sp = url.searchParams;
    // Only hide no-image items for explicitly targeted searches.
    // If we hide no-image items for fitment-derived filters (bolt pattern/diameter/offset),
    // we can drastically undercount results vs DealerLineX because WheelPros often omits
    // image fields even for valid SKUs.
    const shouldFilterNoImage = sp.has("sku") || sp.has("q") || sp.has("brand_cd");

    if (shouldFilterNoImage) {
      const filtered = enriched.filter((it) => hasAnyImage(it));

      // Heuristic: don't let the "hide no-image" filter collapse a page to only a couple
      // of results (WheelPros sometimes omits image fields even for valid SKUs).
      // If filtering would leave too few items, keep the unfiltered enriched list.
      const minKeep = Math.min(8, enriched.length);
      data.results = filtered.length >= minKeep ? filtered : enriched;
    } else {
      data.results = enriched;
    }
    
    // INVENTORY VERIFICATION: Filter out SKUs not in SFTP inventory feed
    // This removes discontinued/stale products that WheelPros API may still return
    const verifyInventory = sp.has("sku"); // Only strict verify for single-SKU lookups
    if (verifyInventory && data.results?.length) {
      const verified = await Promise.all(
        data.results.map(async (it) => {
          const sku = it?.sku ? String(it.sku) : "";
          if (!sku) return null;
          const inv = await getInventoryForSku(sku);
          // SKU must exist in inventory feed (indicates it's an active product)
          return inv ? it : null;
        })
      );
      const beforeCount = data.results.length;
      data.results = verified.filter(Boolean);
      
      if (debug && data.results.length < beforeCount) {
        console.log(`[wheelpros/search] ⚠️ Inventory verify filtered ${beforeCount - data.results.length} SKUs not in SFTP feed`);
      }
    }
  }

  const totalMs = debug ? Date.now() - t0 : 0;

  if (debug) {
    try {
      console.info("[api wheelpros/wheels/search] MISS", {
        status: res.status,
        upstreamMs,
        enrichMs,
        totalMs,
        q: url.searchParams.get("q") || "",
        sku: url.searchParams.get("sku") || "",
        brand_cd: url.searchParams.get("brand_cd") || "",
        boltPattern: url.searchParams.get("boltPattern") || "",
        diameter: url.searchParams.get("diameter") || "",
        width: url.searchParams.get("width") || "",
        page: url.searchParams.get("page") || "",
        pageSize: url.searchParams.get("pageSize") || "",
        results: Array.isArray(data?.results) ? data.results.length : null,
      });
    } catch {
      // ignore
    }
  }

  const out = NextResponse.json(data, {
    status: res.status,
    headers: {
      "content-type": "application/json",
      "x-wt-cache": "MISS",
      ...(debug
        ? {
            "x-wt-upstream-ms": String(upstreamMs),
            "x-wt-enrich-ms": String(enrichMs),
            "x-wt-total-ms": String(totalMs),
            "server-timing": `upstream;dur=${upstreamMs}, enrich;dur=${enrichMs}, total;dur=${totalMs}`,
          }
        : null),
    },
  });

  // Cache only successful JSON bodies.
  if (res.ok && data) {
    cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      status: res.status,
      headers: { "content-type": "application/json" },
      data,
    });

    // basic cap
    if (cache.size > 200) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  }

  return out;
}
