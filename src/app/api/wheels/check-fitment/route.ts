import { NextResponse } from "next/server";
import { getTechfeedWheelBySku, getTechfeedWheelsByStyle, searchWheelsByStyleFuzzy } from "@/lib/techfeed/wheels";
import { resolveOemOffset, computeWheelGeometry, type OemOffsetResult } from "@/lib/fitment/geometryValidator";
import { getFitmentProfileWithHdSupport } from "@/lib/fitment-db/profileService";
import { parseWheelSizes } from "@/lib/fitment-db/profileService";

export const runtime = "nodejs";

/**
 * Check if a wheel style fits a vehicle.
 * 
 * Checks if ANY variant of the wheel style fits the vehicle's bolt pattern,
 * not just one specific SKU. This handles wheels that come in multiple bolt patterns.
 * 
 * GET /api/wheels/check-fitment?sku=FC401BT20906718&year=2024&make=Ford&model=F-150
 * Or: /api/wheels/check-fitment?brand=Fuel&style=Rebel&year=2024&make=Ford&model=F-150
 * Returns: { fits: true, matchingSku?: string, reason?: string }
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    
    const fitmentRes = await fetch(
      `${baseUrl}/api/vehicles/search?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
      { cache: "no-store" }
    );

    if (!fitmentRes.ok) {
      // Can't verify - assume it might fit
      return NextResponse.json({ fits: true, reason: "fitment_lookup_failed" });
    }

    const fitmentData = await fitmentRes.json();
    const vehicleBoltPattern = fitmentData?.fitment?.boltPattern || fitmentData?.boltPattern || "";

    if (!vehicleBoltPattern) {
      // No vehicle bolt pattern data - fail closed per policy
      return NextResponse.json({ fits: false, reason: "no_vehicle_bolt_pattern", missingData: true });
    }

    // 2026-06-30: Also resolve geometry basis from the fitment DB
    // Only check geometry when a specific SKU is provided (not style-only checks)
    let checkOemOffset: OemOffsetResult | null = null;
    if (sku || (year && make && model)) {
      try {
        const profileResult = await getFitmentProfileWithHdSupport(
          Number(year ?? 0), make ?? "", model ?? "", "", {}
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

    // Normalize bolt patterns for comparison
    const normalizePattern = (bp: string): string[] => {
      // Handle dual patterns like "6X135/6X139.7"
      return bp
        .toUpperCase()
        .replace(/\s/g, "")
        .split("/")
        .map((p) => p.replace(/[×-]/g, "X").trim())
        .filter(Boolean);
    };

    const vehiclePatterns = normalizePattern(vehicleBoltPattern);

    // Helper to check if a wheel's bolt pattern matches the vehicle
    const checkMatch = (wheelBp: string): boolean => {
      if (!wheelBp) return false;
      const wheelPatterns = normalizePattern(wheelBp);
      return wheelPatterns.some((wp) =>
        vehiclePatterns.some((vp) => wp === vp || wp.includes(vp) || vp.includes(wp))
      );
    };

    // If we have a SKU, get its style and check ALL variants of that style
    let styleKey = style || "";
    let wheelBrand = brand || "";
    
    if (sku) {
      const wheel = await getTechfeedWheelBySku(sku);
      if (!wheel) {
        return NextResponse.json({ fits: false, reason: "wheel_not_found" });
      }
      styleKey = wheel.style || wheel.display_style_no || "";
      wheelBrand = wheel.brand_desc || wheel.brand_cd || "";
      
      // Quick check: does THIS specific SKU fit?
      const thisBp = wheel.bolt_pattern_metric || wheel.bolt_pattern_standard || "";
      if (thisBp && checkMatch(thisBp)) {
        // Bolt pattern matches; also run geometry check when OEM basis available
        let geometryPass = true;
        let geometryNote: string | undefined;
        if (checkOemOffset && !checkOemOffset.missing) {
          const ww = Number(wheel.width) || checkOemOffset.width_in;
          const wo = Number(wheel.offset);
          if (!isNaN(wo)) {
            const geo = computeWheelGeometry(
              { width_in: ww, offset_mm: wo },
              { width_in: checkOemOffset.width_in, offset_mm: checkOemOffset.offset_mm },
            );
            if (geo.exceedsSafetyCeiling || !geo.passesAggressive) {
              geometryPass = false;
              geometryNote = `Geometry unsafe: delta_backspacing=${geo.delta_backspacing_mm.toFixed(1)}mm`;
            }
          }
        }
        return NextResponse.json({
          fits: geometryPass,
          matchingSku: sku,
          vehicleBoltPattern,
          wheelBoltPattern: thisBp,
          reason: geometryPass ? "exact_sku_match" : "geometry_rejected",
          geometryNote,
        });
      }
    }

    // Check ALL variants of this style for any that fit
    // First try exact match, then fuzzy match
    let allVariants: Awaited<ReturnType<typeof getTechfeedWheelsByStyle>> = [];
    
    if (styleKey) {
      allVariants = await getTechfeedWheelsByStyle(styleKey);
    }
    
    // If no exact match, try fuzzy search (e.g., "Rebel" → "D679 REBEL")
    if ((!allVariants || allVariants.length === 0) && style) {
      allVariants = await searchWheelsByStyleFuzzy(style, brand || undefined);
    }
    
    if (allVariants && allVariants.length > 0) {
      for (const variant of allVariants) {
        const variantBp = variant.bolt_pattern_metric || variant.bolt_pattern_standard || "";
        if (variantBp && checkMatch(variantBp)) {
          // Found a variant that fits!
          return NextResponse.json({
            fits: true,
            matchingSku: variant.sku,
            vehicleBoltPattern,
            wheelBoltPattern: variantBp,
            reason: "style_variant_match",
            checkedVariants: allVariants.length,
          });
        }
      }
      
      // No variants fit
      return NextResponse.json({
        fits: false,
        vehicleBoltPattern,
        reason: "no_matching_bolt_pattern",
        checkedVariants: allVariants.length,
      });
    }

    // Fallback: if we can't find style variants, be permissive
    return NextResponse.json({ fits: true, reason: "no_style_data" });
  } catch (err) {
    console.error("[check-fitment] Error:", err);
    // On error, be permissive - let them proceed
    return NextResponse.json({ fits: true, reason: "check_failed" });
  }
}
