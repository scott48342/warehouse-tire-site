import { NextRequest, NextResponse } from "next/server";
import { browseWheels } from "@/lib/techfeed/wheels-browse";

export const runtime = "nodejs";

/**
 * Get wheel styles/models, optionally filtered by brand
 * GET /api/wheels/styles?brand=Fuel
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const brand = url.searchParams.get("brand");

  try {
    // Get all styles (large page to get all)
    const result = await browseWheels(
      brand ? { brandCode: brand } : {},
      1,
      1000
    );

    // Extract unique style names with their first image
    const stylesMap = new Map<string, { name: string; imageUrl?: string; brand: string; skuExample: string }>();
    
    for (const style of result.styles) {
      if (!stylesMap.has(style.model)) {
        stylesMap.set(style.model, {
          name: style.model,
          imageUrl: style.imageUrl,
          brand: style.brand,
          skuExample: style.skus[0]?.sku || '',
        });
      }
    }

    const styles = Array.from(stylesMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({ styles });
  } catch (error) {
    console.error("[wheels/styles] Error:", error);
    return NextResponse.json({ error: "Failed to fetch styles" }, { status: 500 });
  }
}
