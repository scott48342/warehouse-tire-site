import { NextResponse } from "next/server";
import { getTechfeedWheelBySku } from "@/lib/techfeed/wheels";
import { getInventoryForSku } from "@/lib/inventoryCache";
import { calculateWheelSellPrice, resolveWheelMsrp } from "@/lib/pricing";
import { getPool } from "@/lib/vehicleFitment";

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
    // Try WheelPros/techfeed first
    const wheel = await getTechfeedWheelBySku(sku);

    if (wheel) {
      // ── WheelPros path (existing behavior) ─────────────────────────────────
      const inventory = await getInventoryForSku(sku);
      const mapValue = inventory?.mapPrice ?? (wheel.map_price ? Number(wheel.map_price) : null);
      const rawMsrp  = inventory?.msrp ?? (wheel.msrp ? Number(wheel.msrp) : null);
      const correctedMsrp = !mapValue
        ? resolveWheelMsrp({ sku: wheel.sku, brandCd: wheel.brand_cd ?? wheel.brand_desc, diameter: wheel.diameter, msrp: rawMsrp })
        : rawMsrp;
      const price = calculateWheelSellPrice({ sku: wheel.sku, map: mapValue, msrp: correctedMsrp });

      return NextResponse.json({
        sku:        wheel.sku,
        title:      wheel.product_desc || wheel.sku,
        brand:      wheel.brand_desc || wheel.brand_cd || "Unknown",
        brandCode:  wheel.brand_cd,
        model:      wheel.product_desc,
        finish:     wheel.abbreviated_finish_desc || wheel.fancy_finish_desc,
        diameter:   wheel.diameter,
        width:      wheel.width,
        offset:     wheel.offset,
        boltPattern: wheel.bolt_pattern_metric || wheel.bolt_pattern_standard,
        centerbore: wheel.centerbore,
        price,
        msrp:      wheel.msrp ? Number(wheel.msrp) : null,
        images:    wheel.images || [],
        styleKey:  wheel.style || wheel.display_style_no,
        supplier:  "wheelpros",
        inventory: inventory ? { totalQty: inventory.totalQty, inventoryType: inventory.inventoryType } : null,
      });
    }

    // ── Wheel-1 fallback ──────────────────────────────────────────────────────
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT sku, brand, name, style_number, description, short_description,
              diameter, wheel_width, offset_mm, hub, pcd1, pcd2,
              finish, color, msrp, map_price, has_map,
              image1, image2, image3, image4, image1_source,
              load_rating, tpms_compatible, structure_warranty, finish_warranty,
              bullet_points, sales_description, upc, country_of_origin
       FROM wheel1_products WHERE sku = $1 AND is_discontinued = FALSE`,
      [sku]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Wheel not found" }, { status: 404 });
    }

    const w = rows[0];
    const msrpNum  = w.msrp  ? Number(w.msrp)      : null;
    const mapNum   = w.map_price && Number(w.map_price) > 0 ? Number(w.map_price) : null;
    const w1Price  = calculateWheelSellPrice({ sku: w.sku, map: mapNum, msrp: msrpNum });
    const finish   = w.finish || w.color || null;
    const images   = [w.image1 || w.image1_source, w.image2, w.image3, w.image4].filter(Boolean);
    const bullets  = w.bullet_points ? w.bullet_points.split(";").map((s: string) => s.trim()).filter(Boolean) : [];

    return NextResponse.json({
      sku:           w.sku,
      title:         w.description || `${w.brand} ${w.name || ""} ${finish || ""}`.trim(),
      brand:         w.brand,
      brandCode:     w.brand.toUpperCase().replace(/\s+/g, ""),
      model:         w.name || w.style_number,
      finish,
      diameter:      w.diameter,
      width:         w.wheel_width,
      offset:        w.offset_mm,
      boltPattern:   w.pcd1,
      boltPattern2:  w.pcd2 || null,
      centerbore:    w.hub,
      price:         w1Price,
      msrp:          msrpNum,
      mapPrice:      mapNum,
      images,
      styleKey:      w.style_number,
      supplier:      "wheel1",
      // Wheel-1 extra spec fields
      loadRating:    w.load_rating,
      tpmsCompatible: w.tpms_compatible,
      structureWarranty: w.structure_warranty,
      finishWarranty: w.finish_warranty,
      bulletPoints:  bullets,
      salesDescription: w.sales_description,
      upc:           w.upc,
      countryOfOrigin: w.country_of_origin,
      // Wheel-1 has no live SFTP inventory yet — synthetic availability
      inventory: { totalQty: 4, inventoryType: "ST" },
    });
  } catch (err) {
    console.error("[wheels/sku] Error:", err);
    return NextResponse.json({ error: "Failed to fetch wheel" }, { status: 500 });
  }
}
