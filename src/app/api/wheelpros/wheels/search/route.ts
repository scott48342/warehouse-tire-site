import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.WHEELPROS_WRAPPER_URL;
  if (!base) {
    return NextResponse.json(
      { error: "Missing WHEELPROS_WRAPPER_URL" },
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
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}
