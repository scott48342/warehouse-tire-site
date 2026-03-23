/**
 * Shared Wheel Pros auth token helper.
 * Used by Product + Accessory API clients.
 * 
 * Credentials are loaded from:
 * 1. admin_suppliers.credentials (encrypted, admin-managed)
 * 2. Environment variables (fallback)
 */

import { getSupplierCredentials } from "@/lib/supplierCredentialsSecure";

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getWheelProsToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token;

  // Get credentials from admin settings (with env fallback)
  const creds = await getSupplierCredentials("wheelpros");
  
  const userName = creds.username;
  const password = creds.password;
  if (!userName || !password) {
    throw new Error("Missing WheelPros credentials. Configure in Admin → Settings → Suppliers.");
  }

  const authUrl = creds.authUrl || "https://api.wheelpros.com/auth/token";
  
  const res = await fetch(authUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ userName, password }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`WheelPros auth failed: HTTP ${res.status}`);
  const data = (await res.json()) as any;

  const token = data?.accessToken || data?.token || data?.access_token || data?.tokenString;
  const expiresIn = Number(data?.expiresIn || data?.expires_in || data?.expiresInSeconds || 3600);
  if (!token) throw new Error("WheelPros auth: missing token in response");

  tokenCache = { token: String(token), expiresAt: now + Math.max(60, expiresIn) * 1000 };
  return tokenCache.token;
}

/**
 * Clear the cached token (call after credentials update)
 */
export function clearWheelProsTokenCache() {
  tokenCache = null;
}
