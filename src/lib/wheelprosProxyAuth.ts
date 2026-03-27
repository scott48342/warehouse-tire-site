/**
 * WheelPros Proxy Authentication Module
 * Token management for the WheelPros API proxy routes.
 * 
 * Separate from wheelprosAuth.ts to avoid conflicts with existing auth logic.
 */

const AUTH_BASE_URL = process.env.WHEELPROS_AUTH_BASE_URL || "https://api.wheelpros.com/auth";
const USERNAME = process.env.WHEELPROS_USERNAME || "";
const PASSWORD = process.env.WHEELPROS_PASSWORD || "";
const TOKEN_SKEW_MS = 60_000;

export const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let refreshPromise: Promise<string> | null = null;

export function hasValidToken(): boolean {
  return !!cachedToken && Date.now() < (tokenExpiresAt - TOKEN_SKEW_MS);
}

export async function refreshToken(): Promise<{ accessToken: string; expiresIn: number }> {
  if (refreshPromise) {
    const token = await refreshPromise;
    return { accessToken: token, expiresIn: Math.round((tokenExpiresAt - Date.now()) / 1000) };
  }

  refreshPromise = (async () => {
    console.log("[WheelPros Proxy] Refreshing token...");

    const res = await fetch(`${AUTH_BASE_URL}/v1/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ userName: USERNAME, password: PASSWORD }),
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
    const token = await refreshPromise;
    return { accessToken: token, expiresIn: Math.round((tokenExpiresAt - Date.now()) / 1000) };
  } finally {
    refreshPromise = null;
  }
}

export async function getToken(): Promise<string> {
  if (hasValidToken()) return cachedToken!;
  const result = await refreshToken();
  return result.accessToken;
}

export function getCredentialsConfigured(): boolean {
  return !!(USERNAME && PASSWORD);
}
