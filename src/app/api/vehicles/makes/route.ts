import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.PACKAGE_ENGINE_URL;
  if (!base) {
    return NextResponse.json(
      { error: "Missing PACKAGE_ENGINE_URL" },
      { status: 500 }
    );
  }

  const upstream = new URL("/v1/vehicles/makes", base);
  // forward querystring (expects year)
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(upstream, { cache: "no-store", signal: controller.signal });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch {
    return NextResponse.json({ results: [] }, { status: 200, headers: { "cache-control": "no-store" } });
  } finally {
    clearTimeout(timeout);
  }
}
