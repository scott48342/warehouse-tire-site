import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.PACKAGE_ENGINE_URL;
  if (!base) {
    return NextResponse.json({ error: "Missing PACKAGE_ENGINE_URL" }, { status: 500 });
  }

  const upstream = new URL("/v1/vehicles/search", base);
  url.searchParams.forEach((v, k) => {
    // FitmentSelector may store a composite modification value to keep trim options unique.
    if (k === "modification" && typeof v === "string" && v.includes("__")) {
      upstream.searchParams.set(k, v.split("__")[0]);
      return;
    }
    upstream.searchParams.set(k, v);
  });

  const res = await fetch(upstream, { cache: "no-store" });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}
