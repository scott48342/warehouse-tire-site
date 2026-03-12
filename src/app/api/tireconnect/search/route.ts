import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Best-effort TireConnect scrape endpoint.
 * This is NOT an official API.
 *
 * Query:
 *  - size: e.g. 2455018 or 245/50R18
 */

function toRawSize(size: string) {
  const s = String(size || "").trim();
  const m = s.match(/(\d{3})\s*\/?\s*(\d{2})\s*[A-Z]*\s*R\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  if (/^\d{7}$/.test(s)) return s;
  return "";
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const widgetId = (process.env.TIRECONNECT_WIDGET_ID || "5448d7b7233d7696b3bf2ca8a762dd06").trim();
  const baseUrl = (process.env.TIRECONNECT_BASE_URL || "https://app.tireconnect.ca/instore").trim();

  const sizeRaw = url.searchParams.get("size") || url.searchParams.get("tireSize") || "";
  const rawSize = toRawSize(sizeRaw);
  if (!rawSize) {
    return NextResponse.json(
      { error: "size_required", hint: "Example: 245/50R18" },
      { status: 400 }
    );
  }

  // Try to hit the results page. In many cases this will require extra params (location_id) or a session.
  const target = `${baseUrl}/${widgetId}#!results?size=${encodeURIComponent(rawSize)}&search_by=rawSize`;

  const res = await fetch(target, {
    headers: {
      // Pretend to be a normal browser
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });

  const text = await res.text();

  // We can't guarantee a stable parse without knowing the exact response; return debug payload.
  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    url: target,
    // return only a small slice so we don't bloat responses
    htmlSnippet: text.slice(0, 2000),
  });
}
