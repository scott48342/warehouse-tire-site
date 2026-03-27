import { NextRequest, NextResponse } from "next/server";
import { getToken, refreshToken, getCredentialsConfigured, USER_AGENT } from "@/lib/wheelprosAuth";

const PRODUCTS_BASE_URL = process.env.WHEELPROS_PRODUCTS_BASE_URL || "https://api.wheelpros.com/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function doSearch(searchParams: URLSearchParams, retry = true): Promise<Response> {
  const token = await getToken();

  // Set defaults
  if (!searchParams.has("page")) searchParams.set("page", "1");
  if (!searchParams.has("pageSize")) searchParams.set("pageSize", "20");

  const url = new URL("/v1/search/wheel", PRODUCTS_BASE_URL);
  searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": USER_AGENT,
      "Authorization": `Bearer ${token}`,
    },
    cache: "no-store",
  });

  // Retry once on 401/403
  if ((res.status === 401 || res.status === 403) && retry) {
    console.log("[WheelPros Proxy] Got 401/403 on search, refreshing token...");
    await refreshToken();
    return doSearch(searchParams, false);
  }

  return res;
}

export async function GET(request: NextRequest) {
  if (!getCredentialsConfigured()) {
    return NextResponse.json(
      { error: "WheelPros credentials not configured" },
      { status: 500 }
    );
  }

  try {
    const searchParams = new URLSearchParams(request.nextUrl.searchParams);
    const res = await doSearch(searchParams);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("[WheelPros Proxy] Search error:", err);
    return NextResponse.json(
      { error: err?.message || "Search failed" },
      { status: 500 }
    );
  }
}
