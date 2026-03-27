/**
 * WheelPros API Proxy
 * 
 * Proxies requests to WheelPros API with automatic token management.
 * Replaces the Railway wrapper to avoid IP blocking.
 * 
 * Endpoints:
 * - GET  /api/wheelpros-proxy/health
 * - POST /api/wheelpros-proxy/auth/refresh
 * - GET  /api/wheelpros-proxy/wheels/search
 * - GET  /api/wheelpros-proxy/wheels/:sku
 * - GET  /api/wheelpros-proxy/brands
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// Configuration
// ============================================================================

const AUTH_BASE_URL = process.env.WHEELPROS_AUTH_BASE_URL || "https://api.wheelpros.com/auth";
const PRODUCTS_BASE_URL = process.env.WHEELPROS_PRODUCTS_BASE_URL || "https://api.wheelpros.com/products";
const USERNAME = process.env.WHEELPROS_USERNAME || "";
const PASSWORD = process.env.WHEELPROS_PASSWORD || "";
const TOKEN_SKEW_MS = 60_000; // Refresh 60s before expiry

// Browser-like User-Agent to avoid bot detection
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// ============================================================================
// Token Cache (in-memory, per-instance)
// For Vercel serverless, this resets on cold starts, which is fine since
// tokens are cheap to refresh and last 60 minutes.
// ============================================================================

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let refreshPromise: Promise<string> | null = null;

function hasValidToken(): boolean {
  return !!cachedToken && Date.now() < (tokenExpiresAt - TOKEN_SKEW_MS);
}

async function refreshToken(): Promise<string> {
  // Dedupe concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    console.log("[WheelPros Proxy] Refreshing token...");

    const res = await fetch(`${AUTH_BASE_URL}/v1/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        userName: USERNAME,
        password: PASSWORD,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[WheelPros Proxy] Auth failed:", res.status, text);
      throw new Error(`WheelPros auth failed: ${res.status}`);
    }

    const data = await res.json();
    if (!data.accessToken) {
      throw new Error("WheelPros auth did not return accessToken");
    }

    cachedToken = data.accessToken;
    const expiresInSec = Number(data.expiresIn ?? 3600);
    tokenExpiresAt = Date.now() + expiresInSec * 1000;

    console.log(`[WheelPros Proxy] Token refreshed, expires in ${expiresInSec}s`);
    return cachedToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function getToken(): Promise<string> {
  if (hasValidToken()) return cachedToken!;
  return refreshToken();
}

// ============================================================================
// Products API Request Helper
// ============================================================================

async function requestProducts(
  path: string,
  params: URLSearchParams,
  retryOnAuth = true
): Promise<Response> {
  const token = await getToken();

  const url = new URL(path, PRODUCTS_BASE_URL);
  params.forEach((v, k) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": USER_AGENT,
      "Authorization": `Bearer ${token}`,
    },
    cache: "no-store",
  });

  // Retry once on 401/403 (token may have been revoked)
  if ((res.status === 401 || res.status === 403) && retryOnAuth) {
    console.log("[WheelPros Proxy] Got 401/403, refreshing token and retrying...");
    await refreshToken();
    return requestProducts(path, params, false);
  }

  return res;
}

// ============================================================================
// Route Handler
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const searchParams = request.nextUrl.searchParams;

  // Health check
  if (pathStr === "health") {
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  }

  // Validate credentials
  if (!USERNAME || !PASSWORD) {
    return NextResponse.json(
      { error: "WheelPros credentials not configured" },
      { status: 500 }
    );
  }

  try {
    // /wheels/search
    if (pathStr === "wheels/search") {
      // Set defaults
      if (!searchParams.has("page")) searchParams.set("page", "1");
      if (!searchParams.has("pageSize")) searchParams.set("pageSize", "20");

      const res = await requestProducts("/v1/search/wheel", searchParams);
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    // /wheels/:sku
    if (pathStr.startsWith("wheels/") && path.length === 2) {
      const sku = path[1];
      const res = await requestProducts(`/v1/details/${encodeURIComponent(sku)}`, searchParams);
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    // /brands
    if (pathStr === "brands") {
      if (!searchParams.has("page")) searchParams.set("page", "1");
      if (!searchParams.has("pageSize")) searchParams.set("pageSize", "50");

      const res = await requestProducts("/v1/brands", searchParams);
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err: any) {
    console.error("[WheelPros Proxy] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");

  // /auth/refresh - Force token refresh
  if (pathStr === "auth/refresh") {
    if (!USERNAME || !PASSWORD) {
      return NextResponse.json(
        { error: "WheelPros credentials not configured" },
        { status: 500 }
      );
    }

    try {
      await refreshToken();
      return NextResponse.json({
        ok: true,
        expiresIn: Math.round((tokenExpiresAt - Date.now()) / 1000),
        tokenType: "Bearer",
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || "Auth failed" },
        { status: 403 }
      );
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
