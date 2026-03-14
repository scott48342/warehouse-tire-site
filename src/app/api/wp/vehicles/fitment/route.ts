import { NextResponse } from "next/server";
import { normalizeWpVehicleInfoToFitment, wpVehicleGetJson } from "@/lib/wheelprosVehicle";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year") || "";
  const make = url.searchParams.get("make") || "";
  const model = url.searchParams.get("model") || "";
  const submodel = url.searchParams.get("submodel") || "";

  if (!year || !make || !model || !submodel) {
    return NextResponse.json({ error: "Missing year/make/model/submodel" }, { status: 400 });
  }

  try {
    // Vehicle API: GET Vehicle - Sub-Model Info
    const path = `/vehicles/v1/years/${encodeURIComponent(year)}/makes/${encodeURIComponent(make)}/models/${encodeURIComponent(model)}/submodels/${encodeURIComponent(submodel)}`;
    const data = await wpVehicleGetJson<any>(path);
    const fitment = normalizeWpVehicleInfoToFitment(data);
    return NextResponse.json({ raw: data, fitment });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
