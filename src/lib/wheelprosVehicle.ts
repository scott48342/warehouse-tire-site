import { getWheelProsToken } from "@/lib/wheelprosAuth";

function baseUrl() {
  // Base URL for WheelPros Vehicle API (per their OpenAPI spec)
  return process.env.WHEELPROS_VEHICLE_API_BASE_URL || "https://api.wheelpros.com/vehicles";
}

export async function wpVehicleGetJson<T>(path: string, qs?: Record<string, string | undefined>): Promise<T> {
  const token = await getWheelProsToken();
  // Construct URL properly - path should be appended to base, not replace it
  const base = baseUrl().replace(/\/$/, "");
  const url = new URL(`${base}${path}`);
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
