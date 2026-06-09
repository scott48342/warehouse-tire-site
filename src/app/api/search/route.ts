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
  
  // Search in parallel across all suppliers
  // Note: TireWeb doesn't support part number search (only tire sizes)
  // K&M direct API was disabled 2026-04-13 (SQL errors)
  const [wheelResults, usafResults] = await Promise.all([
    searchWheels(upperQuery),
    searchTiresUSAF(upperQuery),
  ]);
  
  results.push(...wheelResults, ...usafResults);
  
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

/**
 * Search tires via US AutoForce StockCheck API
 * 
 * USAF requires <parts>/<PartDto> with lineCode (brand code) for part number search.
 * Since we don't know the brand, we try common codes until we find a match.
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
    
    // Common brand codes to try (in order of popularity)
    const brandCodesToTry = ["GEN", "FAL", "CON", "COP", "TOY", "BFG", "MIC", "GDY", "HAN", "YOK"];
    
    for (const lineCode of brandCodesToTry) {
      // Build SOAP request with parts/PartDto (required for part number search)
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="https://services.usautoforce.com">
  <soap:Body>
    <ns:StockCheck>
      <ns:request>
        <ns:username>${escapeXml(username)}</ns:username>
        <ns:password>${escapeXml(password)}</ns:password>
        <ns:accountNumber>${escapeXml(account)}</ns:accountNumber>
        <ns:parts>
          <ns:PartDto>
            <ns:lineNumber>1</ns:lineNumber>
            <ns:lineCode>${escapeXml(lineCode)}</ns:lineCode>
            <ns:partNumber>${escapeXml(query)}</ns:partNumber>
            <ns:quantityRequested>4</ns:quantityRequested>
          </ns:PartDto>
        </ns:parts>
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
      
      if (!res.ok) continue;
      
      const xml = await res.text();
      
      // Check for success and results
      const errorCode = extractXmlValue(xml, "errorCode");
      if (errorCode && errorCode !== "success") continue;
      
      // Extract part result
      const partMatches = xml.matchAll(/<PartResultDto>([\s\S]*?)<\/PartResultDto>/g);
      const results: SearchResult[] = [];
      
      for (const match of partMatches) {
        const partXml = match[1];
        const partNumber = extractXmlValue(partXml, "partNumber");
        const brand = extractXmlValue(partXml, "brand") || extractXmlValue(partXml, "brandName");
        const description = extractXmlValue(partXml, "description") || extractXmlValue(partXml, "model");
        const size = extractXmlValue(partXml, "tireSize") || extractXmlValue(partXml, "size");
        const cost = extractXmlValue(partXml, "cost");
        
        if (partNumber) {
          const costNum = cost ? parseFloat(cost) : 0;
          const sellPrice = costNum > 0 ? costNum + 40 : undefined;
          
          results.push({
            type: "tire",
            sku: partNumber,
            name: [brand, description, size].filter(Boolean).join(" ").trim() || partNumber,
            brand: brand || "Unknown",
            price: sellPrice,
            url: `/tires/${partNumber}?source=usautoforce${size ? `&size=${encodeURIComponent(size)}` : ""}`,
          });
        }
      }
      
      if (results.length > 0) {
        console.log(`[search] USAF found ${results.length} results with lineCode=${lineCode}`);
        return results.slice(0, 5);
      }
    }
    
    console.log("[search] USAF: no results found for part number");
    return [];
  } catch (err) {
    console.error("[search] Tire search error:", err);
    return [];
  }
}

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
