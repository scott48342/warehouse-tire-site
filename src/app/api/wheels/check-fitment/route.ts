import { NextResponse } from "next/server";
import { getTechfeedWheelBySku } from "@/lib/techfeed/wheels";

export const runtime = "nodejs";

/**
 * Check if a specific wheel fits a vehicle.
 * 
 * GET /api/wheels/check-fitment?sku=MO813BD20906710&year=2024&make=Ford&model=F-150
 * Returns: { fits: true, reason?: string }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sku = url.searchParams.get("sku");
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  if (!sku || !year || !make || !model) {
    return NextResponse.json(
      { fits: false, error: "sku, year, make, model required" },
      { status: 400 }
    );
  }

  try {
    // Get wheel bolt pattern from techfeed
    const wheel = await getTechfeedWheelBySku(sku);
    if (!wheel) {
      return NextResponse.json({ fits: false, reason: "wheel_not_found" });
    }

    const wheelBoltPattern = wheel.bolt_pattern_metric || wheel.bolt_pattern_standard || "";
    if (!wheelBoltPattern) {
      // Can't verify - assume it might fit, let them proceed
      return NextResponse.json({ fits: true, reason: "no_bolt_pattern_data" });
    }

    // Get vehicle fitment data
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
      // No vehicle bolt pattern data - can't verify
      return NextResponse.json({ fits: true, reason: "no_vehicle_bolt_pattern" });
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

    const wheelPatterns = normalizePattern(wheelBoltPattern);
    const vehiclePatterns = normalizePattern(vehicleBoltPattern);

    // Check if any wheel pattern matches any vehicle pattern
    const fits = wheelPatterns.some((wp) =>
      vehiclePatterns.some((vp) => wp === vp || wp.includes(vp) || vp.includes(wp))
    );

    return NextResponse.json({
      fits,
      wheelBoltPattern,
      vehicleBoltPattern,
      reason: fits ? "bolt_pattern_match" : "bolt_pattern_mismatch",
    });
  } catch (err) {
    console.error("[check-fitment] Error:", err);
    // On error, be permissive - let them proceed
    return NextResponse.json({ fits: true, reason: "check_failed" });
  }
}
