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
    // Vehicle API (per WheelPros Vehicle OpenAPI):
    // GET https://api.wheelpros.com/vehicles/v1/years/{year}/makes/{make}/models/{model}/submodels/{submodel}
    const path = `/v1/years/${encodeURIComponent(year)}/makes/${encodeURIComponent(make)}/models/${encodeURIComponent(model)}/submodels/${encodeURIComponent(submodel)}`;
    const data = await wpVehicleGetJson<any>(path);

    // Normalize as much as possible (axle ranges if present).
    const normalized = normalizeWpVehicleInfoToFitment(data);

    // Also map some common "flat" keys many accounts return.
    const boltPattern = data?.boltPattern ? String(data.boltPattern) : undefined;
    const hub = data?.hub != null ? Number(data.hub) : NaN;
    const offset = data?.offset != null ? Number(data.offset) : NaN;

    const fitment = {
      ...normalized,
      boltPattern: normalized.boltPattern || boltPattern,
      centerBoreMm: normalized.centerBoreMm || (Number.isFinite(hub) ? hub : undefined),
      offsetRangeMm:
        normalized.offsetRangeMm || (Number.isFinite(offset) ? ([offset, offset] as [number, number]) : undefined),
    };

    return NextResponse.json({ raw: data, fitment });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
