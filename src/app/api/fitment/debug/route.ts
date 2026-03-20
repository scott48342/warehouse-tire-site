import { NextResponse } from "next/server";
import * as wheelSizeApi from "@/lib/wheelSizeApi";

export const runtime = "nodejs";

/**
 * GET /api/fitment/debug
 * Debug endpoint to test Wheel-Size API connection
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "makes";
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const year = url.searchParams.get("year");

  try {
    let result: any;

    switch (action) {
      case "makes":
        result = await wheelSizeApi.getMakes();
        return NextResponse.json({ action, count: result.length, data: result.slice(0, 20) });

      case "models":
        if (!make) return NextResponse.json({ error: "Missing make param" }, { status: 400 });
        result = await wheelSizeApi.getModels(make);
        return NextResponse.json({ action, make, count: result.length, data: result });

      case "years":
        if (!make || !model) return NextResponse.json({ error: "Missing make/model params" }, { status: 400 });
        result = await wheelSizeApi.getYears(make, model);
        return NextResponse.json({ action, make, model, count: result.length, data: result });

      case "mods":
        if (!make || !model || !year) return NextResponse.json({ error: "Missing make/model/year params" }, { status: 400 });
        result = await wheelSizeApi.getModifications(make, model, Number(year));
        return NextResponse.json({ action, make, model, year, count: result.length, data: result });

      case "vehicle":
        if (!make || !model || !year) return NextResponse.json({ error: "Missing make/model/year params" }, { status: 400 });
        const mod = url.searchParams.get("mod");
        if (!mod) {
          // Get first USDM modification automatically
          const mods = await wheelSizeApi.getUSModifications(make, model, Number(year));
          if (mods.length === 0) {
            return NextResponse.json({ error: "No modifications found for this vehicle" }, { status: 404 });
          }
          result = await wheelSizeApi.getVehicleData(make, model, Number(year), mods[0].slug);
          return NextResponse.json({ action, make, model, year, mod: mods[0].slug, autoSelected: true, data: result });
        }
        result = await wheelSizeApi.getVehicleData(make, model, Number(year), mod);
        return NextResponse.json({ action, make, model, year, mod, data: result });

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[fitment/debug] Error:", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
