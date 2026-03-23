import { NextResponse } from "next/server";
import { wpVehicleGetJson } from "@/lib/wheelprosVehicle";
import { normalizeTrims } from "@/lib/trimNormalize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year") || "";
  const make = url.searchParams.get("make") || "";
  const model = url.searchParams.get("model") || "";

  if (!year || !make || !model) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Vehicle API (per WheelPros Vehicle OpenAPI):
    // GET https://api.wheelpros.com/vehicles/v1/years/{year}/makes/{make}/models/{model}/submodels
    const path = `/v1/years/${encodeURIComponent(year)}/makes/${encodeURIComponent(make)}/models/${encodeURIComponent(model)}/submodels`;
    const data = await wpVehicleGetJson<string[]>(path);
    const raw = Array.isArray(data) ? data.map((s) => String(s)) : [];
    // Normalize engine codes to friendly trim names (e.g., 5.7i → Z28)
    const results = normalizeTrims(raw, year, make, model);
    return NextResponse.json({ results });
  } catch (e: any) {
    console.error("[wp/submodels] Error:", e?.message || e);
    // Return empty results instead of 500 to allow graceful degradation
    return NextResponse.json({ results: [], _error: e?.message || String(e) });
  }
}
