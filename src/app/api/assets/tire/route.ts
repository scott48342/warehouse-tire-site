import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.PACKAGE_ENGINE_URL;
  if (!base) {
    return NextResponse.json({ error: "Missing PACKAGE_ENGINE_URL" }, { status: 500 });
  }

  const upstream = new URL("/v1/assets/tire", base);
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  // Vercel functions hard-timeout at 300s; fail fast so the whole page doesn't hang
  // if the package engine is slow/unreachable.
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
  } catch (err) {
    // Fail-open: UI can load without images.
    return NextResponse.json(
      { error: "tire_asset_upstream_unavailable" },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } finally {
    clearTimeout(timeout);
  }
}
