import { NextResponse } from "next/server";
import { wpVehicleGetJson } from "@/lib/wheelprosVehicle";

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
    // Vehicle API: /vehicles/v1/years/{year}/makes/{make}/models/{model}/submodels
    const path = `/vehicles/v1/years/${encodeURIComponent(year)}/makes/${encodeURIComponent(make)}/models/${encodeURIComponent(model)}/submodels`;
    const data = await wpVehicleGetJson<string[]>(path);
    const results = Array.isArray(data) ? data.map((s) => ({ value: String(s), label: String(s) })) : [];
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
