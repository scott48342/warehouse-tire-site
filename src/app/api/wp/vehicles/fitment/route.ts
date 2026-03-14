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
    // Vehicle details (as confirmed in Postman)
    // /vehicle/v1/details?year=YYYY&make=...&model=...&subModel=...
    const data = await wpVehicleGetJson<any>("/vehicle/v1/details", { year, make, model, subModel: submodel });

    // Map minimal details into our fitment schema.
    const boltPattern = data?.boltPattern ? String(data.boltPattern) : undefined;
    const hub = data?.hub != null ? Number(data.hub) : NaN;
    const offset = data?.offset != null ? Number(data.offset) : NaN;

    const fitment = {
      boltPattern,
      centerBoreMm: Number.isFinite(hub) ? hub : undefined,
      offsetRangeMm: Number.isFinite(offset) ? [offset, offset] : undefined,
    };

    return NextResponse.json({ raw: data, fitment });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
