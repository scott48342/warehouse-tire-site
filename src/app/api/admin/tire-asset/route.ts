import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const base = process.env.PACKAGE_ENGINE_URL;
  if (!base) {
    return NextResponse.json({ error: "Missing PACKAGE_ENGINE_URL" }, { status: 500 });
  }

  const adminKey = (process.env.ADMIN_KEY || "").trim();
  if (!adminKey) {
    return NextResponse.json(
      { error: "Missing ADMIN_KEY (set in Vercel env)" },
      { status: 500 }
    );
  }

  const got = req.headers.get("x-admin-key") || "";
  if (got !== adminKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const upstream = new URL("/v1/assets/tire", base);
  const res = await fetch(upstream, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}
