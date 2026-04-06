/**
 * Cart Popularity Admin API
 * 
 * GET /api/admin/cart-popularity?type=tire|wheel
 * Returns top products by add-to-cart count with conversion metrics.
 * 
 * Query params:
 * - type: 'tire' or 'wheel' (required)
 * - limit: number of results (default: 50)
 * - offset: pagination offset (default: 0)
 * - days: lookback period in days (default: 30)
 * - brand: filter by brand (optional)
 * - includeTest: include test data (default: false)
 * 
 * @created 2026-04-05
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  getTopProducts, 
  getCartEventStats, 
  getBrands,
  type ProductType 
} from "@/lib/cart/cartAddEventService";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Get query params
    const type = searchParams.get("type") as ProductType | null;
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const daysParam = searchParams.get("days");
    const brand = searchParams.get("brand") || undefined;
    const includeTest = searchParams.get("includeTest") === "true";
    const action = searchParams.get("action");

    // Handle different actions
    if (action === "stats") {
      // Return summary stats
      const stats = await getCartEventStats({
        days: daysParam ? parseInt(daysParam, 10) : 30,
        includeTest,
      });
      return NextResponse.json(stats);
    }

    if (action === "brands") {
      // Return brand list for filtering
      if (!type || !["tire", "wheel"].includes(type)) {
        return NextResponse.json(
          { error: "type must be 'tire' or 'wheel'" },
          { status: 400 }
        );
      }
      const brands = await getBrands(type);
      return NextResponse.json({ brands });
    }

    // Default: return top products
    if (!type || !["tire", "wheel"].includes(type)) {
      return NextResponse.json(
        { error: "type query param must be 'tire' or 'wheel'" },
        { status: 400 }
      );
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    // Validate limits
    if (limit < 1 || limit > 500) {
      return NextResponse.json(
        { error: "limit must be between 1 and 500" },
        { status: 400 }
      );
    }

    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: "days must be between 1 and 365" },
        { status: 400 }
      );
    }

    const report = await getTopProducts({
      productType: type,
      limit,
      offset,
      days,
      brand,
      includeTest,
    });

    return NextResponse.json(report);
  } catch (err: any) {
    console.error("[admin/cart-popularity] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to get cart popularity data" },
      { status: 500 }
    );
  }
}
