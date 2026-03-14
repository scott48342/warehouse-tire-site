let tokenCache: { token: string; expiresAt: number } | null = null;

function baseUrl() {
  // Base host for WheelPros Vehicle API
  return process.env.WHEELPROS_VEHICLE_API_BASE_URL || "https://api.wheelpros.com";
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token;

  const userName = process.env.WHEELPROS_PDP_USERNAME;
  const password = process.env.WHEELPROS_PDP_PASSWORD;
  if (!userName || !password) {
    throw new Error("Missing WHEELPROS_PDP_USERNAME/WHEELPROS_PDP_PASSWORD");
  }

  // WheelPros auth endpoint isn't documented in static HTML we can fetch here.
  // Many accounts use /catalog/v1/auth/token or similar; we keep it configurable.
  const authUrl = process.env.WHEELPROS_AUTH_URL;
  if (!authUrl) {
    throw new Error("Missing WHEELPROS_AUTH_URL (WheelPros Authentication API endpoint)");
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

export async function wpVehicleGetJson<T>(path: string, qs?: Record<string, string | undefined>): Promise<T> {
  const token = await getToken();
  const url = new URL(path, baseUrl());
  if (qs) {
    for (const [k, v] of Object.entries(qs)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {}
    throw new Error(`WheelPros vehicle API failed: ${url.pathname} HTTP ${res.status}${detail ? ` :: ${detail}` : ""}`);
  }
  return (await res.json()) as T;
}

export type NormalizedFitment = {
  boltPattern?: string;
  centerBoreMm?: number;
  wheelDiameterRangeIn?: [number, number];
  wheelWidthRangeIn?: [number, number];
  offsetRangeMm?: [number, number];
};

export function normalizeWpVehicleInfoToFitment(data: any): NormalizedFitment {
  // Try to normalize from typical Vehicle API response shape (axles.front.*)
  const front = data?.axles?.front || data?.front || null;

  const bpMm = front?.boltPatternMm;
  const lugCnt = front?.lug?.lugCnt;
  const boltPattern = lugCnt && bpMm ? `${lugCnt}x${bpMm}` : undefined;

  const cb = front?.centerBoreMm != null ? Number(front.centerBoreMm) : undefined;

  const minD = front?.diameter?.minDiameterIn != null ? Number(front.diameter.minDiameterIn) : NaN;
  const maxD = front?.diameter?.maxDiameterIn != null ? Number(front.diameter.maxDiameterIn) : NaN;

  const minW = front?.oeWidthIn != null ? Number(front.oeWidthIn) : NaN;
  const maxW = front?.maxWidthIn != null ? Number(front.maxWidthIn) : NaN;

  const offMin = front?.offset?.offsetMinMm != null ? Number(front.offset.offsetMinMm) : NaN;
  const offMax = front?.offset?.offsetMaxMm != null ? Number(front.offset.offsetMaxMm) : NaN;

  return {
    boltPattern,
    centerBoreMm: Number.isFinite(cb as number) ? (cb as number) : undefined,
    wheelDiameterRangeIn: Number.isFinite(minD) && Number.isFinite(maxD) ? [minD, maxD] : undefined,
    wheelWidthRangeIn: Number.isFinite(minW) && Number.isFinite(maxW) ? [minW, maxW] : undefined,
    offsetRangeMm: Number.isFinite(offMin) && Number.isFinite(offMax) ? [offMin, offMax] : undefined,
  };
}
