/**
 * Shared Wheel Pros auth token helper.
 * Used by Product + Accessory API clients.
 */

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getWheelProsToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token;

  const userName = process.env.WHEELPROS_PDP_USERNAME;
  const password = process.env.WHEELPROS_PDP_PASSWORD;
  if (!userName || !password) {
    throw new Error("Missing WHEELPROS_PDP_USERNAME/WHEELPROS_PDP_PASSWORD");
  }

  const authUrl = process.env.WHEELPROS_AUTH_URL;
  if (!authUrl) {
    throw new Error("Missing WHEELPROS_AUTH_URL");
  }

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
