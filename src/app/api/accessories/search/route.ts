/**
 * Generic Accessory Search API
 * 
 * GET /api/accessories/search?category=hub-ring&pageSize=50
 * 
 * Categories:
 * - lug-nut: Lug nuts and wheel locks
 * - hub-ring: Hub centric rings
 * - center-cap: Center caps
 * - lighting: LED lights, light bars
 * - tpms: TPMS sensors and kits
 * - valve-stem: Valve stems and caps
 * - spacer: Wheel spacers
 */

import { NextResponse } from "next/server";
import { searchAccessories, type WheelProsAccessoryResult } from "@/lib/wheelprosAccessory";
import { getSupplierCredentials } from "@/lib/supplierCredentialsSecure";
import { calculateWheelSellPrice } from "@/lib/pricing";

export const runtime = "nodejs";

// Category to WheelPros filter mapping
const CATEGORY_FILTERS: Record<string, string[]> = {
  "lug-nut": ["lug nut", "wheel lock"],
  "hub-ring": ["hub ring", "hub centric"],
  "center-cap": ["center cap"],
  "lighting": ["LED", "light bar", "rock light", "pod light"],
  "tpms": ["TPMS", "tire pressure"],
  "valve-stem": ["valve stem"],
  "spacer": ["wheel spacer", "adapter"],
};

type AccessoryItem = {
  sku: string;
  title: string;
  brand?: string;
  brandCode?: string;
  price: number;
  msrp?: number;
  map?: number;
  inStock: boolean;
  category: string;
  imageUrl?: string;
};

function extractPrice(result: WheelProsAccessoryResult): { price: number; msrp?: number; map?: number } {
  const msrp = result.prices?.msrp?.[0]?.currencyAmount;
  const map = result.prices?.map?.[0]?.currencyAmount;
  const nip = result.prices?.nip?.[0]?.currencyAmount;
  
  // Use our standard pricing: prefer calculated price from msrp/map
  const price = calculateWheelSellPrice({ msrp: msrp || null, map: map || null });
  
  // Fallback to NIP if no MSRP/MAP
  const finalPrice = price > 0 ? price : (nip || 0);
  
  return { price: finalPrice, msrp, map };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const query = url.searchParams.get("q");
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "50")));
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));

  if (!category && !query) {
    return NextResponse.json({ 
      error: "Missing category or q parameter",
      validCategories: Object.keys(CATEGORY_FILTERS),
    }, { status: 400 });
  }

  // Get supplier credentials
  const wpCreds = await getSupplierCredentials("wheelpros");
  const company = "1500"; // USD
  const customer = wpCreds.customerNumber || "1022165";

  try {
    // Build filters from category or use direct query
    const filters = category ? (CATEGORY_FILTERS[category] || [category]) : [query!];
    
    // Search all filters and combine results
    const allResults: AccessoryItem[] = [];
    const seenSkus = new Set<string>();

    for (const filter of filters) {
      const response = await searchAccessories({
        filter,
        fields: "inventory,price",
        priceType: "msrp,map,nip",
        company,
        customer,
        page,
        pageSize,
      });

      for (const r of response.results || []) {
        if (!r.sku || seenSkus.has(r.sku)) continue;
        seenSkus.add(r.sku);

        const { price, msrp, map } = extractPrice(r);
        const inStock = r.inventory?.some(i => i.type === "stocked") ?? false;
        
        // Extract image URL - check both media and images arrays
        const images = r.media || r.images || [];
        const primaryImage = images.find(img => img.type === "primary") || images[0];
        const imageUrl = primaryImage?.url;

        allResults.push({
          sku: r.sku,
          title: r.title || r.sku,
          brand: r.brand?.description,
          brandCode: r.brand?.code,
          price,
          msrp,
          map,
          inStock,
          category: category || "search",
          imageUrl,
        });
      }
    }

    // Sort by price (lowest first), then by in-stock
    allResults.sort((a, b) => {
      if (a.inStock !== b.inStock) return b.inStock ? 1 : -1;
      return a.price - b.price;
    });

    return NextResponse.json({
      results: allResults.slice(0, pageSize),
      total: allResults.length,
      category,
      query,
      page,
      pageSize,
    }, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    });

  } catch (err: any) {
    console.error("[accessories/search] Error:", err?.message || err);
    return NextResponse.json({ 
      error: "Failed to search accessories",
      detail: err?.message,
    }, { status: 500 });
  }
}
