import { NextRequest, NextResponse } from "next/server";
import { getCoAddedProducts, getCoAddedForCart, getCacheStatus } from "@/lib/analytics/coPurchase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/co-purchase
 * 
 * Returns co-purchase recommendations for a product or cart.
 * 
 * Query params:
 * - sku: Single SKU to get recommendations for
 * - skus: Comma-separated SKUs (for cart)
 * - limit: Max recommendations (default 4)
 * - status: If "1", return cache status only
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  
  // Status check
  if (sp.get("status") === "1") {
    const status = getCacheStatus();
    return NextResponse.json({
      status: "ok",
      cache: status,
    });
  }

  const sku = sp.get("sku");
  const skusParam = sp.get("skus");
  const limit = Math.min(parseInt(sp.get("limit") || "4", 10), 10);

  try {
    // Single SKU lookup
    if (sku) {
      const products = await getCoAddedProducts(sku, { limit });
      return NextResponse.json({
        sku,
        products,
        count: products.length,
      });
    }

    // Cart (multiple SKUs)
    if (skusParam) {
      const skus = skusParam.split(",").filter(Boolean).slice(0, 50);
      if (skus.length === 0) {
        return NextResponse.json({ products: [], count: 0 });
      }

      const products = await getCoAddedForCart(skus, { limit });
      return NextResponse.json({
        cartSkus: skus,
        products,
        count: products.length,
      });
    }

    return NextResponse.json(
      { error: "Missing sku or skus parameter" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[API co-purchase] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch recommendations", products: [] },
      { status: 500 }
    );
  }
}
