import { NextResponse } from "next/server";
import { getTechfeedWheelBySku, getTechfeedWheelsByStyle, searchWheelsByStyleFuzzy } from "@/lib/techfeed/wheels";
import { resolveOemOffset, computeWheelGeometry, type OemOffsetResult, type OemOffsetResolved, type VehicleClass } from "@/lib/fitment/geometryValidator";
import { getFitmentProfileWithHdSupport } from "@/lib/fitment-db/profileService";
import { parseWheelSizes } from "@/lib/fitment-db/profileService";

export const runtime = "nodejs";

/**
 * Bolt pattern -> canonical keys (2026-09-18, audit F13).
 * "5x120.65" -> ["5X120.65"]; "6X135/6x139.7" -> ["6X135","6X139.7"]; "5 x 120.0" -> ["5X120"].
 * Unparseable input yields [] so callers fail closed. Exported for tests.
 */
export function parseBoltPatternKeys(bp: string | null | undefined): string[] {
  if (!bp) return [];
  return String(bp)
    .split(/[\/,]/)
    .map((part) => {
      const m = part.replace(/\s+/g, "").match(/^(\d+)[xX\u00d7-](\d+(?:\.\d+)?)$/);
      if (!m) return null;
      const lugs = parseInt(m[1], 10);
      const pcd = Math.round(parseFloat(m[2]) * 100) / 100;
      if (!Number.isFinite(lugs) || !Number.isFinite(pcd) || lugs <= 0 || pcd <= 0) return null;
      return `${lugs}X${pcd}`;
    })
    .filter((k): k is string => k !== null);
}
/** null/undefined/blank -> null; finite numbers and numeric strings (incl. 0 / "0") -> number; else null. Exported for tests. */
export function strictNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Check if a wheel style fits a vehicle.
 * 
 * Checks if ANY variant of the wheel style fits the vehicle's bolt pattern,
 * not just one specific SKU. This handles wheels that come in multiple bolt patterns.
 * 
 * GET /api/wheels/check-fitment?sku=FC401BT20906718&year=2024&make=Ford&model=F-150
 * Or: /api/wheels/check-fitment?brand=Fuel&style=Rebel&year=2024&make=Ford&model=F-150
 * Returns: { fits: true|false|null, matchingSku?: string, reason?: string, boltPatternCompatible?: boolean|null }
 *   fits:null = UNVERIFIED (trim required, wheel not in style data, lookup/check failed). Never treat null as a fit.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sku = url.searchParams.get("sku");
  const brand = url.searchParams.get("brand");
  const style = url.searchParams.get("style");
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  if ((!sku && !style) || !year || !make || !model) {
    return NextResponse.json(
      { fits: false, error: "sku (or brand+style), year, make, model required" },
      { status: 400 }
    );
  }

  try {
    // Get vehicle fitment data first
    // 2026-09-18 (audit F13): resolve against THIS server's origin first so an
    // isolated preview (:3002) or self-hosted instance never hard-codes :3000.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : url.origin);
    
    const fitmentRes = await fetch(
      `${baseUrl}/api/vehicles/search?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
      { cache: "no-store" }
    );

    if (!fitmentRes.ok) {
      // 2026-09-18 (audit F13): cannot verify -> NOT a fit claim. fits:null = unverified.
      return NextResponse.json({ fits: null, reason: "fitment_lookup_failed", boltPatternCompatible: null });
    }

    const fitmentData = await fitmentRes.json();

    // 2026-09-18 (audit F7/F13, R3): trim omitted and the certified trims do
    // not fully agree. Rules:
    //   - bolt pattern NOT shared by every trim  -> fits:null, reason:"trim_required"
    //   - bolt shared, wheel bolt mismatches    -> fits:false (safe rejection), boltPatternCompatible:false
    //   - bolt shared, wheel bolt matches       -> fits:null, reason:"trim_required_for_geometry",
    //                                              boltPatternCompatible:true  (NEVER fits:true)
    // Partial agreement is never a fit certification.
    let trimRequiredNote:
      | { trimRequired: true; certifiable: false; conflictingFields: string[]; unknownFields: string[]; candidateTrims: unknown[] }
      | null = null;
    if (fitmentData?.trimRequired || fitmentData?.certifiable === false) {
      trimRequiredNote = {
        trimRequired: true,
        certifiable: false,
        conflictingFields: fitmentData.conflictingFields ?? [],
        unknownFields: fitmentData.unknownFields ?? [],
        candidateTrims: fitmentData.candidateTrims ?? [],
      };
      const sharedBp = fitmentData?.sharedSpecs?.boltPattern || fitmentData?.sharedFitment?.boltPattern || "";
      if (!sharedBp) {
        return NextResponse.json({
          fits: null,
          reason: "trim_required",
          boltPatternCompatible: null,
          ...trimRequiredNote,
        });
      }
    }

    const vehicleBoltPattern = trimRequiredNote
      ? (fitmentData?.sharedSpecs?.boltPattern || fitmentData?.sharedFitment?.boltPattern || "")
      : (fitmentData?.fitment?.boltPattern || fitmentData?.boltPattern || "");

    if (!vehicleBoltPattern) {
      // No vehicle bolt pattern data - fail closed per policy
      return NextResponse.json({ fits: false, reason: "no_vehicle_bolt_pattern", missingData: true });
    }

    // 2026-06-30: Also resolve geometry basis from the fitment DB
    // Only check geometry when a specific SKU is provided (not style-only checks)
    let checkOemOffset: OemOffsetResult | null = null;
    // Skip when the trim is ambiguous: offsets/wheel sizes are per-trim data.
    if (!trimRequiredNote && (sku || (year && make && model))) {
      try {
        const profileResult = await getFitmentProfileWithHdSupport(
          Number(year ?? 0), make ?? "", model ?? "", "", { trimOmitted: true }
        );
        if (profileResult.profile?.boltPattern) {
          const rawSizes = parseWheelSizes(profileResult.profile.oemWheelSizes ?? []) as Array<{diameter?:number;width?:number;offset?:number|null;axle?:string}>;
          const sizes = rawSizes.map(s => ({ diameter: s.diameter ?? 0, width: s.width ?? 0, offset: s.offset ?? null, axle: (s.axle ?? 'both') as 'front'|'rear'|'both' }));
          checkOemOffset = resolveOemOffset({
            offsetMinMm: profileResult.profile.offsetMinMm,
            offsetMaxMm: profileResult.profile.offsetMaxMm,
            oemWheelSizes: sizes,
          });
        }
      } catch {
        // geometry check is best-effort; bolt pattern check still runs
      }
    }

    // 2026-09-18 (audit F13): EXACT bolt-pattern equality. The previous
    // substring test certified 5x120 wheels on 5x120.65 hubs (and vice versa).
    // Each side may be a dual pattern ("6X135/6X139.7"); a match requires one
    // wheel pattern to equal one vehicle pattern after numeric normalisation.
    const vehiclePatterns = parseBoltPatternKeys(vehicleBoltPattern);

    const checkMatch = (wheelBp: string): boolean => {
      if (!wheelBp) return false;
      const wheelPatterns = parseBoltPatternKeys(wheelBp);
      if (wheelPatterns.length === 0 || vehiclePatterns.length === 0) return false;
      return wheelPatterns.some((wp) => vehiclePatterns.includes(wp));
    };

    // Certify ONE concrete wheel record whose bolt pattern already matched.
    //   - trim unresolved                                   -> fits:null  trim_required_for_geometry
    //   - OEM offset/width or wheel width/offset unavailable -> fits:null  geometry_unverified
    //   - geometry computed and safe                        -> fits:true
    //   - geometry computed and unsafe                      -> fits:false geometry_rejected
    // Missing geometry is UNVERIFIED, never a certification (2026-09-18, audit F13).
    const certifyWheel = (
      w: { sku: string; width: unknown; offset: unknown },
      wheelBp: string,
      okReason: "exact_sku_match" | "style_variant_match",
      extra: Record<string, unknown> = {},
    ): Record<string, unknown> & { fits: boolean | null } => {
      if (trimRequiredNote) {
        return ({
          fits: null,
          reason: "trim_required_for_geometry",
          boltPatternCompatible: true,
          matchingSku: w.sku,
          vehicleBoltPattern,
          wheelBoltPattern: wheelBp,
          ...extra,
          ...trimRequiredNote,
        });
      }
      // Strict: null/undefined/blank are ABSENT (Number(null) === 0 would fake an offset of 0).
      // Real numeric 0 and the string "0" are preserved as a legitimate 0mm offset.
      const ww = strictNumber(w.width);
      const wo = strictNumber(w.offset);
      const oemMissing = !checkOemOffset || checkOemOffset.missing;
      if (oemMissing || ww === null || ww <= 0 || wo === null) {
        return ({
          fits: null,
          reason: "geometry_unverified",
          boltPatternCompatible: true,
          matchingSku: w.sku,
          vehicleBoltPattern,
          wheelBoltPattern: wheelBp,
          geometryNote: oemMissing
            ? "OEM offset/width basis unavailable for this vehicle"
            : "Wheel width/offset unavailable",
          ...extra,
        });
      }
      // 2026-09-18: vehicleClass was never passed before, so passesAggressive was
      // always undefined and every geometry-checked wheel was rejected. Class is
      // derived like fitment-search does when vehicleType is unknown (6x/8x -> truck,
      // else car = strictest thresholds). Certification uses the daily_driver profile.
      const geoVehicleClass: VehicleClass =
        /^(6|8)x/i.test(vehicleBoltPattern.trim()) ? "truck" : "car";
      const geo = computeWheelGeometry(
        { width_in: ww, offset_mm: wo },
        { width_in: (checkOemOffset as OemOffsetResolved).width_in, offset_mm: (checkOemOffset as OemOffsetResolved).offset_mm },
        geoVehicleClass,
      );
      const geometryPass = geo.passesDailyDriver === true && !geo.exceedsSafetyCeiling;
      return ({
        fits: geometryPass,
        boltPatternCompatible: true,
        matchingSku: w.sku,
        vehicleBoltPattern,
        wheelBoltPattern: wheelBp,
        reason: geometryPass ? okReason : "geometry_rejected",
        geometryProfile: "daily_driver",
        geometryVehicleClass: geoVehicleClass,
        geometryNote: geometryPass ? undefined : `Geometry unsafe: delta_backspacing=${geo.delta_backspacing_mm.toFixed(1)}mm`,
        ...extra,
      });
    };

    let styleKey = style || "";
    let wheelBrand = brand || "";

    if (sku) {
      // 2026-09-18 (audit F13): a REQUESTED SKU is judged on its own record.
      // Another SKU of the same style fitting does not certify this one; at
      // most it is reported as alternativeSku alongside fits:false.
      const wheel = await getTechfeedWheelBySku(sku);
      if (!wheel) {
        return NextResponse.json({ fits: false, reason: "wheel_not_found" });
      }
      styleKey = wheel.style || wheel.display_style_no || "";
      wheelBrand = wheel.brand_desc || wheel.brand_cd || "";
      const thisBp = wheel.bolt_pattern_metric || wheel.bolt_pattern_standard || "";

      if (!thisBp) {
        return NextResponse.json({
          fits: null,
          reason: "sku_bolt_pattern_unknown",
          boltPatternCompatible: null,
          matchingSku: sku,
          vehicleBoltPattern,
          ...(trimRequiredNote ?? {}),
        });
      }
      if (checkMatch(thisBp)) {
        return NextResponse.json(certifyWheel({ sku, width: wheel.width, offset: wheel.offset }, thisBp, "exact_sku_match"));
      }

      // Requested SKU does not fit. A sibling is only a suggestion.
      let alternativeSku: string | undefined;
      let checkedVariants = 0;
      if (styleKey) {
        const siblings = await getTechfeedWheelsByStyle(styleKey);
        checkedVariants = siblings?.length ?? 0;
        const alt = (siblings ?? []).find((v) => {
          const vbp = v.bolt_pattern_metric || v.bolt_pattern_standard || "";
          return v.sku !== sku && !!vbp && checkMatch(vbp);
        });
        alternativeSku = alt?.sku;
      }
      return NextResponse.json({
        fits: false,
        reason: "sku_bolt_pattern_mismatch",
        boltPatternCompatible: false,
        vehicleBoltPattern,
        wheelBoltPattern: thisBp,
        checkedVariants,
        ...(alternativeSku ? { alternativeSku } : {}),
        ...(trimRequiredNote ?? {}),
      });
    }

    // Style-only request (brand+style): any variant of the style may satisfy it.
    let allVariants: Awaited<ReturnType<typeof getTechfeedWheelsByStyle>> = [];
    if (styleKey) {
      allVariants = await getTechfeedWheelsByStyle(styleKey);
    }
    if ((!allVariants || allVariants.length === 0) && style) {
      allVariants = await searchWheelsByStyleFuzzy(style, wheelBrand || undefined);
    }

    if (allVariants && allVariants.length > 0) {
      // 2026-09-18: scan EVERY bolt-compatible variant. A geometry rejection on
      // one variant must not reject the style while a later variant passes.
      // Outcome precedence: any fits:true > any unverified (null) > all rejected.
      let firstNull: Record<string, unknown> | null = null;
      let firstFalse: Record<string, unknown> | null = null;
      let compatible = 0;
      for (const variant of allVariants) {
        const variantBp = variant.bolt_pattern_metric || variant.bolt_pattern_standard || "";
        if (!variantBp || !checkMatch(variantBp)) continue;
        compatible++;
        const body = certifyWheel(
          { sku: variant.sku, width: variant.width, offset: variant.offset },
          variantBp,
          "style_variant_match",
          { checkedVariants: allVariants.length },
        );
        if (body.fits === true) {
          return NextResponse.json({ ...body, compatibleVariants: compatible });
        }
        if (body.fits === null && !firstNull) firstNull = body;
        if (body.fits === false && !firstFalse) firstFalse = body;
      }
      if (firstNull) return NextResponse.json({ ...firstNull, compatibleVariants: compatible });
      if (firstFalse) return NextResponse.json({ ...firstFalse, compatibleVariants: compatible });
      // No variants share the bolt pattern (a rejection on a bolt pattern shared by every trim is safe)
      return NextResponse.json({
        fits: false,
        vehicleBoltPattern,
        reason: "no_matching_bolt_pattern",
        checkedVariants: allVariants.length,
        ...(trimRequiredNote ? { boltPatternCompatible: false, ...trimRequiredNote } : {}),
      });
    }

    // Fallback: if we can't find style variants, be permissive - but never
    // certify when the trim is unresolved.
    if (trimRequiredNote) {
      return NextResponse.json({ fits: null, reason: "trim_required", boltPatternCompatible: null, ...trimRequiredNote });
    }
    // 2026-09-18 (audit F13): wheel not in our style data -> unverified, never fits:true
    return NextResponse.json({ fits: null, reason: "style_not_found", boltPatternCompatible: null });
  } catch (err) {
    console.error("[check-fitment] Error:", err);
    // 2026-09-18 (audit F13): fail CLOSED. An error is not evidence of fit.
    return NextResponse.json({ fits: null, reason: "check_failed", boltPatternCompatible: null });
  }
}
