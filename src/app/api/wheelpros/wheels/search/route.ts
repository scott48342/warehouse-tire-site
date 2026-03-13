import { NextResponse } from "next/server";
import { getTechfeedWheelBySku } from "@/lib/techfeed/wheels";

export const runtime = "nodejs";

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

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.WHEELPROS_WRAPPER_API_KEY) {
    headers["x-api-key"] = process.env.WHEELPROS_WRAPPER_API_KEY;
  }

  const res = await fetch(upstream.toString(), { headers, cache: "no-store" });
  const ct = res.headers.get("content-type") || "application/json";

  let data: WheelProsSearchResponse | null = null;
  try {
    data = (await res.json()) as WheelProsSearchResponse;
  } catch {
    // If upstream didn't return JSON for some reason, just proxy through.
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { "content-type": ct } });
  }

  if (res.ok && data?.results?.length) {
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

        // MSRP: you asked to apply MSRP for WheelPros wheels.
        if (tf.msrp) {
          it.prices = it.prices || {};
          it.prices.msrp = [{ currencyAmount: String(tf.msrp), currencyCode: "USD" }];
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
    const sp = url.searchParams;
    const shouldFilterNoImage =
      sp.has("sku") ||
      sp.has("q") ||
      sp.has("brand_cd") ||
      sp.has("boltPattern") ||
      sp.has("diameter") ||
      sp.has("width") ||
      sp.has("minOffset") ||
      sp.has("maxOffset") ||
      sp.has("centerbore");

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
  }

  return NextResponse.json(data, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
