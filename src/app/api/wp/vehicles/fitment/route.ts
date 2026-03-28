import { NextResponse } from "next/server";
import { normalizeWpVehicleInfoToFitment, wpVehicleGetJson } from "@/lib/wheelprosVehicle";
import { getFitmentFromRules } from "@/lib/fitment-db/vehicleFitmentRules";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1" || process.env.WT_DIAGNOSTICS === "1";
  const t0 = debug ? Date.now() : 0;
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
    const tUp0 = debug ? Date.now() : 0;
    const data = await wpVehicleGetJson<any>(path);
    const upstreamMs = debug ? Date.now() - tUp0 : 0;

    // Normalize as much as possible (axle ranges if present).
    const normalized = normalizeWpVehicleInfoToFitment(data);

    // Also map some common "flat" keys many accounts return.
    const boltPattern = data?.boltPattern ? String(data.boltPattern) : undefined;
    const hub = data?.hub != null ? Number(data.hub) : NaN;
    const offset = data?.offset != null ? Number(data.offset) : NaN;

    let fitment = {
      ...normalized,
      boltPattern: normalized.boltPattern || boltPattern,
      centerBoreMm: normalized.centerBoreMm || (Number.isFinite(hub) ? hub : undefined),
      offsetRangeMm:
        normalized.offsetRangeMm || (Number.isFinite(offset) ? ([offset, offset] as [number, number]) : undefined),
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL: Apply fitment rules to override incorrect WheelPros data
    // This handles cases like RAM 1500 Classic vs 5th Gen where bolt pattern differs.
    // ═══════════════════════════════════════════════════════════════════════════
    const ruleOverride = getFitmentFromRules({
      year: Number(year),
      make,
      model,
      rawModel: model,
      trim: submodel,
      modificationId: submodel,
    });
    
    if (ruleOverride) {
      if (ruleOverride.boltPattern && ruleOverride.boltPattern !== fitment.boltPattern) {
        console.log(`[wp/vehicles/fitment] 🔧 RULE OVERRIDE: ${year} ${make} ${model} submodel=${submodel}`);
        console.log(`  Bolt pattern: ${fitment.boltPattern} → ${ruleOverride.boltPattern}`);
        console.log(`  Reason: ${ruleOverride.notes || "Fitment rule match"}`);
        fitment.boltPattern = ruleOverride.boltPattern;
      }
      if (ruleOverride.centerBoreMm !== undefined) {
        fitment.centerBoreMm = ruleOverride.centerBoreMm;
      }
      if (ruleOverride.offsetMin !== undefined && ruleOverride.offsetMax !== undefined) {
        fitment.offsetRangeMm = [ruleOverride.offsetMin, ruleOverride.offsetMax];
      }
    }

    const totalMs = debug ? Date.now() - t0 : 0;
    if (debug) {
      try {
        console.info("[api wp/vehicles/fitment] OK", {
          upstreamMs,
          totalMs,
          year,
          make,
          model,
          submodel,
        });
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      { raw: data, fitment },
      {
        headers: debug
          ? {
              "x-wt-upstream-ms": String(upstreamMs),
              "x-wt-total-ms": String(totalMs),
              "server-timing": `upstream;dur=${upstreamMs}, total;dur=${totalMs}`,
            }
          : undefined,
      }
    );
  } catch (e: any) {
    const totalMs = debug ? Date.now() - t0 : 0;
    if (debug) {
      try {
        console.info("[api wp/vehicles/fitment] ERR", {
          totalMs,
          year,
          make,
          model,
          submodel,
          error: e?.message || String(e),
        });
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      { error: e?.message || String(e) },
      {
        status: 500,
        headers: debug
          ? {
              "x-wt-total-ms": String(totalMs),
              "server-timing": `total;dur=${totalMs}`,
            }
          : undefined,
      }
    );
  }
}
