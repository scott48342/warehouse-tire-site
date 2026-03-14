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
    // Vehicle API (as confirmed in Postman): /vehicle/v1/submodels?year=YYYY&make=...&model=...
    const data = await wpVehicleGetJson<string[]>("/vehicle/v1/submodels", { year, make, model });
    const results = Array.isArray(data) ? data.map((s) => ({ value: String(s), label: String(s) })) : [];
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
