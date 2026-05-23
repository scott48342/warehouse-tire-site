import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // Need nodejs for XML parsing

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
  
  // Search in parallel
  const [wheelResults, tireResults] = await Promise.all([
    searchWheels(upperQuery),
    searchTiresUSAF(upperQuery),
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
    
    // Search by UPC/part number
    const searchRes = await fetch(
      `https://api.wheelpros.com/products/v1/search/wheel?upc=${encodeURIComponent(query)}&limit=5`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    
    if (!searchRes.ok) {
      // Try style name search as fallback
      const styleRes = await fetch(
        `https://api.wheelpros.com/products/v1/search/wheel?style_description=${encodeURIComponent(query)}&limit=5`,
        { headers: { Authorization: `Bearer ${access_token}` } }
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

/**
 * Search tires via US AutoForce StockCheck API
 * Uses part number search with wildcard matching
 */
async function searchTiresUSAF(query: string): Promise<SearchResult[]> {
  try {
    const username = process.env.USAUTOFORCE_USERNAME;
    const password = process.env.USAUTOFORCE_PASSWORD;
    const account = process.env.USAUTOFORCE_ACCOUNT;
    
    if (!username || !password || !account) {
      console.log("[search] USAF credentials not configured");
      return [];
    }
    
    const isTest = username.toLowerCase().includes("test");
    const apiUrl = isTest 
      ? "https://servicesstage.usautoforce.com/integrationservice.asmx"
      : "https://services.usautoforce.com/integrationservice.asmx";
    
    // Build SOAP request for StockCheck with part number
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="https://services.usautoforce.com">
  <soap:Body>
    <ns:StockCheck>
      <ns:request>
        <ns:username>${escapeXml(username)}</ns:username>
        <ns:password>${escapeXml(password)}</ns:password>
        <ns:accountNumber>${escapeXml(account)}</ns:accountNumber>
        <ns:tires>
          <ns:TireDto>
            <ns:partNumber>${escapeXml(query)}</ns:partNumber>
          </ns:TireDto>
        </ns:tires>
      </ns:request>
    </ns:StockCheck>
  </soap:Body>
</soap:Envelope>`;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "https://services.usautoforce.com/StockCheck",
      },
      body: soapBody,
    });
    
    if (!res.ok) {
      console.error("[search] USAF API error:", res.status);
      return [];
    }
    
    const xml = await res.text();
    
    // Parse response - extract tire data
    const results: SearchResult[] = [];
    
    // Extract individual tire results using regex (simple parsing)
    const tireMatches = xml.matchAll(/<TireResultDto>([\s\S]*?)<\/TireResultDto>/g);
    
    for (const match of tireMatches) {
      const tireXml = match[1];
      const partNumber = extractXmlValue(tireXml, "partNumber") || extractXmlValue(tireXml, "PartNumber");
      const brand = extractXmlValue(tireXml, "brand") || extractXmlValue(tireXml, "Brand");
      const model = extractXmlValue(tireXml, "model") || extractXmlValue(tireXml, "Model") || extractXmlValue(tireXml, "description");
      const size = extractXmlValue(tireXml, "size") || extractXmlValue(tireXml, "Size");
      const price = extractXmlValue(tireXml, "cost") || extractXmlValue(tireXml, "price");
      
      if (partNumber) {
        results.push({
          type: "tire",
          sku: partNumber,
          name: [brand, model, size].filter(Boolean).join(" ").trim() || partNumber,
          brand: brand || "Unknown",
          price: price ? parseFloat(price) : undefined,
          url: `/tires/${partNumber}`,
        });
      }
    }
    
    return results.slice(0, 5);
  } catch (err) {
    console.error("[search] Tire search error:", err);
    return [];
  }
}

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
