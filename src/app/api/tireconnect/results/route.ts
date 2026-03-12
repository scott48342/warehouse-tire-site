import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toRawSize(size: string) {
  const s = String(size || "").trim();
  const m = s.match(/(\d{3})\s*\/?\s*(\d{2})\s*[A-Z]*\s*R\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  if (/^\d{7}$/.test(s)) return s;
  return "";
}

/**
 * Returns the TireConnect widget HTML (not the data API).
 * Used to iteratively discover how the widget fetches results.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  const widgetId = (process.env.TIRECONNECT_WIDGET_ID || "5448d7b7233d7696b3bf2ca8a762dd06").trim();
  const baseUrl = (process.env.TIRECONNECT_BASE_URL || "https://app.tireconnect.ca/instore").trim();

  const sizeRaw = url.searchParams.get("size") || "";
  const rawSize = toRawSize(sizeRaw);
  const locationId = (url.searchParams.get("location_id") || "").trim();

  if (!rawSize) return NextResponse.json({ error: "size_required" }, { status: 400 });
  if (!locationId) return NextResponse.json({ error: "location_id_required" }, { status: 400 });

  const target = `${baseUrl}/${widgetId}#!results?size=${encodeURIComponent(rawSize)}&location_id=${encodeURIComponent(locationId)}&search_by=rawSize&display=full&page=1&min_quantity=1`;

  const res = await fetch(target, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });

  const text = await res.text();
  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    url: target,
    htmlSnippet: text.slice(0, 4000),
  });
}
