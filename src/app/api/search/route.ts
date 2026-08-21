import { NextRequest, NextResponse } from "next/server";
import { getInventoryBulk } from "@/lib/inventoryCache";

export const runtime = "nodejs"; // Need nodejs for XML parsing

interface SearchResult {
  type: "wheel" | "tire" | "accessory";
  sku: string;
  name: string;
  brand: string;
  image?: string;
  price?: number;
  url: string;
  inStock?: boolean; // Added 2026-08-21: inventory status
}

/**
 * Universal part number / SKU search
 * GET /api/search?q=LXST2071755030
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  
  if (!query || query.length < 3) {
    return NextResponse.json({ results: [], query: query || "" });
  }
  
  const results: SearchResult[] = [];
  const upperQuery = query.toUpperCase();
  
  // Search wheels via WheelPros (supports SKU and UPC lookup)
  const wheelResults = await searchWheels(upperQuery);
  
  // Enrich wheel results with inventory status (2026-08-21)
  if (wheelResults.length > 0) {
    const skus = wheelResults.map(r => r.sku);
    const inventoryMap = await getInventoryBulk(skus);
    const ORDERABLE_TYPES = new Set(["ST", "BW", "NW", "SO", "CS"]);
    const MIN_QTY = 4;
    
    for (const result of wheelResults) {
      const inv = inventoryMap.get(result.sku);
      if (inv) {
        result.inStock = ORDERABLE_TYPES.has(inv.inventoryType) && inv.totalQty >= MIN_QTY;
      } else {
        // No inventory data = assume out of stock (safer than assuming in stock)
        result.inStock = false;
      }
    }
  }
  
  results.push(...wheelResults);
  
  // Note: Tire part number search is not currently supported.
  // USAF requires brand code (lineCode) which we don't have from just a part number.
  // TireWeb/K&M don't support part number search (only tire sizes).
  // Future: Index USAF FTP inventory to enable tire part number search.
  
  // Sort: exact matches first, then by relevance
  results.sort((a, b) => {
    const aExact = a.sku.toUpperCase() === upperQuery ? 0 : 1;
    const bExact = b.sku.toUpperCase() === upperQuery ? 0 : 1;
    return aExact - bExact;
  });
  
  // If no results and query looks like a tire part number (all digits), add a hint
  const looksLikeTirePartNumber = /^\d{6,10}$/.test(query);
  const hint = results.length === 0 && looksLikeTirePartNumber
    ? "Tire part number lookup requires brand info. Try searching by tire size (e.g., 245/50R16) or use the vehicle selector."
    : undefined;
  
  return NextResponse.json({ 
    results: results.slice(0, 10), 
    query,
    total: results.length,
    ...(hint && { hint })
  });
}

async function searchWheels(query: string): Promise<SearchResult[]> {
  try {
    const userName = process.env.WHEELPROS_USERNAME;
    const password = process.env.WHEELPROS_PASSWORD;
    
    if (!userName || !password) {
      console.log("[search] WheelPros credentials not configured");
      return [];
    }
    
    // Get auth token (username/password auth)
    const authRes = await fetch("https://api.wheelpros.com/auth/v1/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ userName, password }),
    });
    
    if (!authRes.ok) {
      console.error("[search] WheelPros auth failed:", authRes.status);
      return [];
    }
    const authData = await authRes.json();
    const access_token = authData.accessToken || authData.token;
    
    // Search by SKU first (most common for part number search)
    const searchRes = await fetch(
      `https://api.wheelpros.com/products/v1/search/wheel?sku=${encodeURIComponent(query)}&limit=5`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.results?.length > 0) {
        return mapWheelResults(data.results || []);
      }
    }
    
    // UPC search - but only return exact matches
    // WheelPros API does fuzzy search, so we need to filter client-side
    const upcRes = await fetch(
      `https://api.wheelpros.com/products/v1/search/wheel?upc=${encodeURIComponent(query)}&limit=10`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    
    if (upcRes.ok) {
      const upcData = await upcRes.json();
      if (upcData.results?.length > 0) {
        // Filter to only wheels where UPC matches exactly
        const exactMatches = upcData.results.filter((w: any) => 
          w.upc?.toUpperCase() === query || w.sku?.toUpperCase() === query
        );
        return mapWheelResults(exactMatches);
      }
    }
    
    return [];
  } catch (err) {
    console.error("[search] Wheel search error:", err);
    return [];
  }
}

function mapWheelResults(wheels: any[]): SearchResult[] {
  return wheels.map((w: any) => {
    // Extract fields from WheelPros API response format
    const sku = w.sku || w.upc || "";
    const brandName = w.brand?.description || w.brand?.parent || w.brand_name || "";
    const modelName = w.properties?.model || w.title || w.style_description || "";
    const displayName = modelName || `${brandName} ${sku}`;
    const imageUrl = w.images?.[0]?.imageUrlMedium || w.images?.[0]?.imageUrlOriginal || w.image_url_main;
    const msrp = w.prices?.msrp?.[0]?.currencyAmount || w.msrp;
    
    return {
      type: "wheel" as const,
      sku,
      name: displayName,
      brand: brandName,
      image: imageUrl,
      price: msrp ? parseFloat(msrp) : undefined,
      url: `/wheels/${sku}`,
    };
  });
}

// Note: USAF tire part number search requires brand code (lineCode) which we don't have.
// Tire part number search is not supported until we index USAF FTP inventory.
// See backlog: USAF FTP Inventory Indexing

// Note: TireWeb doesn't support part number search (only tire size queries via GetTires SOAP API)
// K&M direct API was disabled 2026-04-13 (SQL errors from their server)

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractXmlValue(xml: string, tag: string): string | null {
  // Try both with and without namespace prefix
  const patterns = [
    new RegExp(`<(?:ns:)?${tag}>([^<]*)<\/(?:ns:)?${tag}>`, "i"),
    new RegExp(`<${tag}>([^<]*)<\/${tag}>`, "i"),
  ];
  
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}
