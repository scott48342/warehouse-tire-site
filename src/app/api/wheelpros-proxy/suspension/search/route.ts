import { NextRequest, NextResponse } from "next/server";
import { getWheelProsToken } from "@/lib/wheelprosAuth";

const PRODUCTS_BASE_URL = process.env.WHEELPROS_PRODUCTS_BASE_URL || "https://api.wheelpros.com/products";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function doSearch(searchParams: URLSearchParams, retry = true): Promise<Response> {
  const token = await getWheelProsToken();

  // Set defaults
  if (!searchParams.has("page")) searchParams.set("page", "1");
  if (!searchParams.has("pageSize")) searchParams.set("pageSize", "20");

  // Ensure proper URL construction
  const baseUrl = PRODUCTS_BASE_URL.endsWith("/") ? PRODUCTS_BASE_URL : PRODUCTS_BASE_URL + "/";
  const url = new URL("v1/search/suspension", baseUrl);
  searchParams.forEach((v, k) => url.searchParams.set(k, v));

  console.log("[WheelPros Suspension] Fetching:", url.toString());

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": USER_AGENT,
      "Authorization": `Bearer ${token}`,
    },
    cache: "no-store",
  });

  console.log("[WheelPros Suspension] Response:", res.status);

  // Retry once on 401/403
  if ((res.status === 401 || res.status === 403) && retry) {
    console.log("[WheelPros Suspension] Got 401/403, retrying with fresh token...");
    return doSearch(searchParams, false);
  }

  return res;
}

export async function GET(request: NextRequest) {

  try {
    const searchParams = new URLSearchParams(request.nextUrl.searchParams);
    const res = await doSearch(searchParams);
    
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("[WheelPros Suspension] Non-JSON response:", text.slice(0, 500));
      return NextResponse.json(
        { error: "Invalid response from WheelPros", raw: text.slice(0, 200) },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("[WheelPros Suspension] Search error:", err);
    return NextResponse.json(
      { error: err?.message || "Search failed" },
      { status: 500 }
    );
  }
}
