import { NextResponse } from "next/server";
import { getTechfeedWheelBySku } from "@/lib/techfeed/wheels";
import { getInventoryForSku } from "@/lib/inventoryCache";
import { calculateWheelSellPrice, resolveWheelMsrp } from "@/lib/pricing";

export const runtime = "nodejs";

/**
 * Get a single wheel by SKU from techfeed data
 * 
 * GET /api/wheels/sku/[sku]
 * Returns wheel data including price and inventory
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ sku: string }> }
) {
  const { sku } = await params;
  
  if (!sku) {
    return NextResponse.json({ error: "SKU required" }, { status: 400 });
  }

  try {
    const wheel = await getTechfeedWheelBySku(sku);
    
    if (!wheel) {
      return NextResponse.json({ error: "Wheel not found" }, { status: 404 });
    }

    // Get inventory data
    const inventory = await getInventoryForSku(sku);
    
    // Calculate sell price.
    const mapValue = inventory?.mapPrice ?? (wheel.map_price ? Number(wheel.map_price) : null);
    const rawMsrp = inventory?.msrp ?? (wheel.msrp ? Number(wheel.msrp) : null);
    // DATA QUALITY GUARD (2026-06-18): correct corrupt MSRPs before markup.
    const correctedMsrp = !mapValue
      ? resolveWheelMsrp({ sku: wheel.sku, brandCd: wheel.brand_cd ?? wheel.brand_desc, diameter: wheel.diameter, msrp: rawMsrp })
      : rawMsrp;
    const price = calculateWheelSellPrice({
      sku: wheel.sku,
      map: mapValue,
      msrp: correctedMsrp,
    });

    return NextResponse.json({
      sku: wheel.sku,
      title: wheel.product_desc || wheel.sku,
      brand: wheel.brand_desc || wheel.brand_cd || "Unknown",
      brandCode: wheel.brand_cd,
      model: wheel.product_desc,
      finish: wheel.abbreviated_finish_desc || wheel.fancy_finish_desc,
      diameter: wheel.diameter,
      width: wheel.width,
      offset: wheel.offset,
      boltPattern: wheel.bolt_pattern_metric || wheel.bolt_pattern_standard,
      centerbore: wheel.centerbore,
      price,
      msrp: wheel.msrp ? Number(wheel.msrp) : null,
      images: wheel.images || [],
      styleKey: wheel.style || wheel.display_style_no,
      inventory: inventory ? {
        totalQty: inventory.totalQty,
        inventoryType: inventory.inventoryType,
      } : null,
    });
  } catch (err) {
    console.error("[wheels/sku] Error:", err);
    return NextResponse.json({ error: "Failed to fetch wheel" }, { status: 500 });
  }
}
