import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const base = process.env.PACKAGE_ENGINE_URL;
  if (!base) {
    return NextResponse.json(
      { error: "Missing PACKAGE_ENGINE_URL" },
      { status: 500 }
    );
  }

  const upstream = new URL("/v1/vehicles/years", base);
  const res = await fetch(upstream, { cache: "no-store" });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}
