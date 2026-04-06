/**
 * Product Popularity API
 * 
 * Returns popularity signals for products based on real cart behavior.
 * Supports single SKU and batch requests.
 * 
 * GET /api/analytics/popularity?sku=XXX&type=tire
 * GET /api/analytics/popularity?skus=SKU1,SKU2&type=wheel
 * 
 * @created 2026-04-06
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getPopularitySignal,
  getPopularitySignalsBatch,
  getCacheStatus,
  type ProductType,
} from "@/lib/analytics/productPopularity";

export const runtime = "nodejs";

// Cache control: allow CDN/browser caching for 60 seconds
const CACHE_MAX_AGE = 60;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const productType = searchParams.get("type") as ProductType;
  const sku = searchParams.get("sku");
  const skusParam = searchParams.get("skus");
  const status = searchParams.get("status"); // For monitoring

  // Status endpoint
  if (status === "1") {
    const cacheStatus = getCacheStatus();
    return NextResponse.json({ status: "ok", cache: cacheStatus });
  }

  // Validate product type
  if (!productType || (productType !== "tire" && productType !== "wheel")) {
    return NextResponse.json(
      { error: "Invalid or missing 'type' parameter. Use 'tire' or 'wheel'." },
      { status: 400 }
    );
  }

  // Batch request
  if (skusParam) {
    const skus = skusParam.split(",").filter(Boolean).slice(0, 100); // Max 100 SKUs
    if (skus.length === 0) {
      return NextResponse.json({ error: "No valid SKUs provided" }, { status: 400 });
    }

    try {
      const signals = await getPopularitySignalsBatch(productType, skus);
      
      // Convert Map to plain object for JSON
      const result: Record<string, any> = {};
      signals.forEach((signal, key) => {
        result[key] = signal;
      });

      return NextResponse.json(
        { signals: result, count: signals.size },
        {
          headers: {
            "Cache-Control": `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_MAX_AGE * 2}`,
          },
        }
      );
    } catch (err) {
      console.error("[popularity-api] Batch error:", err);
      return NextResponse.json({ signals: {}, count: 0 });
    }
  }

  // Single SKU request
  if (!sku) {
    return NextResponse.json(
      { error: "Missing 'sku' or 'skus' parameter" },
      { status: 400 }
    );
  }

  try {
    const signal = await getPopularitySignal(productType, sku);
    
    return NextResponse.json(
      { sku, productType, signal },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_MAX_AGE * 2}`,
        },
      }
    );
  } catch (err) {
    console.error("[popularity-api] Error:", err);
    // Graceful degradation - return null signal
    return NextResponse.json({ sku, productType, signal: null });
  }
}
