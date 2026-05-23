import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface SearchResult {
  type: "wheel" | "tire" | "accessory";
  sku: string;
  name: string;
  brand: string;
  image?: string;
  price?: number;
  url: string;
}

/**
 * Universal part number / SKU search
 * GET /api/search?q=KM54989063518
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [], query: query || "" });
  }
  
  const results: SearchResult[] = [];
  const upperQuery = query.toUpperCase();
  
  // Search in parallel
  const [wheelResults, tireResults] = await Promise.all([
    searchWheels(upperQuery),
    searchTires(query),
  ]);
  
  results.push(...wheelResults, ...tireResults);
  
  // Sort: exact matches first, then by relevance
  results.sort((a, b) => {
    const aExact = a.sku.toUpperCase() === upperQuery ? 0 : 1;
    const bExact = b.sku.toUpperCase() === upperQuery ? 0 : 1;
    return aExact - bExact;
  });
  
  return NextResponse.json({ 
    results: results.slice(0, 10), 
    query,
    total: results.length 
  });
}

async function searchWheels(query: string): Promise<SearchResult[]> {
  try {
    // Try WheelPros product lookup by SKU
    const wpApiKey = process.env.WHEELPROS_API_KEY;
    const wpApiSecret = process.env.WHEELPROS_API_SECRET;
    
    if (!wpApiKey || !wpApiSecret) return [];
    
    // Get auth token
    const authRes = await fetch("https://api.wheelpros.com/auth/v1/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: wpApiKey,
        client_secret: wpApiSecret,
      }),
    });
    
    if (!authRes.ok) return [];
    const { access_token } = await authRes.json();
    
    // Search by part number
    const searchRes = await fetch(
      `https://api.wheelpros.com/products/v1/search/wheel?upc=${encodeURIComponent(query)}&limit=5`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );
    
    if (!searchRes.ok) {
      // Try searching by style name if UPC lookup fails
      const styleRes = await fetch(
        `https://api.wheelpros.com/products/v1/search/wheel?style_description=${encodeURIComponent(query)}&limit=5`,
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );
      
      if (!styleRes.ok) return [];
      const styleData = await styleRes.json();
      return mapWheelResults(styleData.data || []);
    }
    
    const data = await searchRes.json();
    return mapWheelResults(data.data || []);
  } catch (err) {
    console.error("[search] Wheel search error:", err);
    return [];
  }
}

function mapWheelResults(wheels: any[]): SearchResult[] {
  return wheels.map((w: any) => ({
    type: "wheel" as const,
    sku: w.upc || w.part_number || "",
    name: `${w.brand_name || ""} ${w.style_description || ""}`.trim(),
    brand: w.brand_name || "",
    image: w.image_url_main,
    price: w.msrp ? parseFloat(w.msrp) : undefined,
    url: `/wheels/${w.upc || w.part_number}`,
  }));
}

async function searchTires(query: string): Promise<SearchResult[]> {
  try {
    // Try TireWeb search by part number
    const accessKey = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
    const groupToken = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;
    
    if (!accessKey || !groupToken) return [];
    
    const res = await fetch(
      `https://ws.tirewire.com/webservice/PartLookup?` +
      `accessKey=${accessKey}&groupToken=${groupToken}&partNumber=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } }
    );
    
    if (!res.ok) return [];
    
    const data = await res.json();
    const items = data.Items || data.items || [];
    
    return items.slice(0, 5).map((t: any) => ({
      type: "tire" as const,
      sku: t.PartNumber || t.partNumber || "",
      name: `${t.Brand || t.brand || ""} ${t.Model || t.model || ""} ${t.Size || t.size || ""}`.trim(),
      brand: t.Brand || t.brand || "",
      image: t.ImageUrl || t.imageUrl,
      price: t.SellPrice || t.sellPrice || t.Price || t.price,
      url: `/tires/${t.PartNumber || t.partNumber}`,
    }));
  } catch (err) {
    console.error("[search] Tire search error:", err);
    return [];
  }
}
