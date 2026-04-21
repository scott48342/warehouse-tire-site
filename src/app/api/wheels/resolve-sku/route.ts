import { NextResponse } from "next/server";
import { browseWheels } from "@/lib/techfeed/wheels-browse";

export const runtime = "nodejs";

/**
 * Resolve a wheel brand + style (model name) to a specific SKU.
 * Used by the gallery to link directly to PDPs even when exact SKU isn't stored.
 * 
 * GET /api/wheels/resolve-sku?brand=Moto+Metal&style=MO813
 * Returns: { sku: "MO813BD20906710" } or { sku: null }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const brand = url.searchParams.get("brand")?.trim();
  const style = url.searchParams.get("style")?.trim();

  if (!brand && !style) {
    return NextResponse.json({ sku: null, error: "brand or style required" }, { status: 400 });
  }

  try {
    // Use the existing browse function with brand/style filters
    const result = await browseWheels(
      {
        brandCode: brand || undefined,
        style: style || undefined,
      },
      1, // page
      1  // just need one result
    );

    if (result.styles.length > 0 && result.styles[0].skus.length > 0) {
      // Return the first SKU from this style
      const firstSku = result.styles[0].skus[0].sku;
      return NextResponse.json({ sku: firstSku });
    }

    return NextResponse.json({ sku: null });
  } catch (err) {
    console.error("[resolve-sku] Error:", err);
    return NextResponse.json({ sku: null, error: "lookup failed" }, { status: 500 });
  }
}
