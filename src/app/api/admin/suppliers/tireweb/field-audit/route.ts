/**
 * TireWeb Field Audit Endpoint
 * 
 * Captures RAW XML response and identifies ALL fields returned by TireWeb API.
 * Used for diagnostic purposes only - to understand what data is available
 * from the TireLibrary.
 * 
 * GET /api/admin/suppliers/tireweb/field-audit?size=275/55R20&limit=3
 */

import { NextResponse } from "next/server";
import { getTireWebCredentials, getEnabledConnections } from "@/lib/tirewire/client";

export const runtime = "nodejs";

const PRODUCTS_SERVICE_URL = "http://ws.tirewire.com/connectionscenter/productsservice.asmx";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toSimpleSize(s: string): string {
  const v = String(s || "").trim().toUpperCase();
  const m = v.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R?\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const m2 = v.match(/^(\d{7})$/);
  if (m2) return m2[1];
  return "";
}

// Extract ALL XML tags from a tire element
function extractAllFields(tireXml: string): Record<string, string | null> {
  const fields: Record<string, string | null> = {};
  
  // Match all XML tags
  const tagRegex = /<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g;
  let match;
  
  while ((match = tagRegex.exec(tireXml)) !== null) {
    const [, tagName, value] = match;
    fields[tagName] = value.trim() || null;
  }
  
  // Also check for self-closing or empty tags
  const emptyTagRegex = /<([A-Za-z0-9_]+)\s*\/>/g;
  while ((match = emptyTagRegex.exec(tireXml)) !== null) {
    const tagName = match[1];
    if (!(tagName in fields)) {
      fields[tagName] = null;
    }
  }
  
  return fields;
}

// Classify field as populated, empty, or missing
function classifyFields(
  allTires: Record<string, string | null>[],
  expectedFields: string[]
): {
  populated: { field: string; sampleValues: string[] }[];
  empty: string[];
  missing: string[];
  unexpected: { field: string; sampleValues: string[] }[];
} {
  const populated: { field: string; sampleValues: string[] }[] = [];
  const empty: string[] = [];
  const missing: string[] = [];
  const unexpected: { field: string; sampleValues: string[] }[] = [];
  
  // Get all unique field names across all tires
  const allFields = new Set<string>();
  for (const tire of allTires) {
    for (const key of Object.keys(tire)) {
      allFields.add(key);
    }
  }
  
  // Check expected fields
  for (const field of expectedFields) {
    const values = allTires.map(t => t[field]).filter((v): v is string => v != null && v !== '');
    if (values.length > 0) {
      populated.push({ 
        field, 
        sampleValues: [...new Set(values)].slice(0, 3) 
      });
    } else if (allTires.some(t => field in t)) {
      empty.push(field);
    } else {
      missing.push(field);
    }
  }
  
  // Check for unexpected fields (returned but not in expected list)
  const expectedSet = new Set(expectedFields);
  for (const field of allFields) {
    if (!expectedSet.has(field)) {
      const values = allTires.map(t => t[field]).filter((v): v is string => v != null && v !== '');
      if (values.length > 0) {
        unexpected.push({ 
          field, 
          sampleValues: [...new Set(values)].slice(0, 3) 
        });
      }
    }
  }
  
  return { populated, empty, missing, unexpected };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const size = url.searchParams.get("size") || "275/55R20";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "5"), 20);
  const simpleSize = toSimpleSize(size);
  const connectionFilter = url.searchParams.get("connection"); // "atd", "ntw", or "usautoforce"
  
  const audit: Record<string, any> = {
    timestamp: new Date().toISOString(),
    queryParams: { size, simpleSize, limit, connectionFilter },
  };

  try {
    // Get credentials
    const creds = await getTireWebCredentials();
    if (!creds) {
      return NextResponse.json({ error: "No TireWeb credentials configured" }, { status: 500 });
    }

    // Get connections
    let connections = await getEnabledConnections();
    if (connectionFilter) {
      connections = connections.filter(c => c.provider.includes(connectionFilter));
    }
    
    if (connections.length === 0) {
      return NextResponse.json({ error: "No matching connections" }, { status: 400 });
    }

    // Expected fields based on TireLibrary documentation
    const EXPECTED_FIELDS = [
      // Identifiers
      "ID", "ProductCode", "ClientProductCode", "SupplierSystemID",
      
      // Product info
      "Name", "Make", "MakeID", "Pattern", "PatternID", "Description",
      
      // Size specs
      "Width", "AspectRatio", "Rim", "Weight",
      
      // Performance specs
      "SpeedRating", "LoadRating", "LoadIndex", "PlyRating", "LoadRange",
      
      // UTQG (what we want!)
      "UTQG", "Treadwear", "Traction", "Temperature",
      
      // Tire characteristics
      "Sidewall", "TreadDepth", "Construction", "TireType", "Terrain", "Season",
      
      // Warranty & features
      "Warranty", "WarrantyMiles", "MileageRating", "Features", "Benefits",
      
      // Marketing
      "MarketingDescription", "LongDescription", "ShortDescription",
      
      // Images
      "ImageURL", "PatternImageURL", "SideImageURL", "ProductImageURL",
      
      // Pricing
      "BuyPrice", "SellPrice", "MAP", "MSRP", "Cost", "Tax",
      
      // Inventory
      "Quantity", "QuantitySecondary", "QuantityTotal", "InStock",
      
      // Reviews (if available)
      "ReviewRating", "ReviewCount", "ReviewAverage", "Rating", "Reviews",
      
      // Rebates
      "RebateAmount", "RebateExpiration", "HasRebate",
      
      // Flags
      "RunFlat", "OEMarking", "XL", "Reinforced", "3PMSF",
    ];

    const connectionResults: any[] = [];

    for (const conn of connections) {
      // Build SOAP request with DetailLevel=10 (maximum detail)
      const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${escapeXml(creds.accessKey)}</prod:AccessKey>
        <prod:GroupToken>${escapeXml(creds.groupToken)}</prod:GroupToken>
        <prod:ConnectionID>${conn.connectionId}</prod:ConnectionID>
        <prod:TireSize>${escapeXml(simpleSize)}</prod:TireSize>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

      try {
        const startTime = Date.now();
        const res = await fetch(PRODUCTS_SERVICE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml;charset=UTF-8",
            "SOAPAction": "http://ws.tirewire.com/connectionscenter/productsservice/GetTires",
          },
          body: soapRequest,
        });

        const responseText = await res.text();
        const durationMs = Date.now() - startTime;

        // Check for fault
        const faultMatch = responseText.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
        if (faultMatch) {
          connectionResults.push({
            connection: conn.provider,
            connectionId: conn.connectionId,
            error: faultMatch[1],
            durationMs,
          });
          continue;
        }

        // Extract tire elements
        const tireMatches = [...responseText.matchAll(/<Tire>([\s\S]*?)<\/Tire>/g)];
        const totalTires = tireMatches.length;

        // Extract ALL fields from first N tires
        const sampledTires: Record<string, string | null>[] = [];
        for (let i = 0; i < Math.min(limit, tireMatches.length); i++) {
          const fields = extractAllFields(tireMatches[i][1]);
          sampledTires.push(fields);
        }

        // Classify fields
        const fieldClassification = classifyFields(sampledTires, EXPECTED_FIELDS);

        // Get raw XML snippet for one tire (for sending to TireWeb)
        const rawTireSample = tireMatches.length > 0 
          ? `<Tire>${tireMatches[0][1]}</Tire>` 
          : null;

        connectionResults.push({
          connection: conn.provider,
          connectionId: conn.connectionId,
          totalTires,
          sampledCount: sampledTires.length,
          durationMs,
          
          // Field analysis
          fieldClassification: {
            populatedFields: fieldClassification.populated,
            emptyFields: fieldClassification.empty,
            missingFields: fieldClassification.missing,
            unexpectedFields: fieldClassification.unexpected,
          },
          
          // Sample data
          sampleTires: sampledTires,
          
          // Raw XML for one tire (for TireWeb support)
          rawTireSampleXml: rawTireSample,
        });

      } catch (err: any) {
        connectionResults.push({
          connection: conn.provider,
          connectionId: conn.connectionId,
          error: err.message,
        });
      }
    }

    audit.connections = connectionResults;

    // Summary across all connections
    const allPopulatedFields = new Set<string>();
    const allMissingFields = new Set<string>(EXPECTED_FIELDS);
    
    for (const result of connectionResults) {
      if (result.fieldClassification) {
        for (const f of result.fieldClassification.populatedFields) {
          allPopulatedFields.add(f.field);
          allMissingFields.delete(f.field);
        }
      }
    }

    audit.summary = {
      requestedSize: size,
      normalizedSize: simpleSize,
      connectionsQueried: connections.length,
      totalTiresFound: connectionResults.reduce((sum, r) => sum + (r.totalTires || 0), 0),
      fieldsReturnedWithData: [...allPopulatedFields].sort(),
      fieldsNotReturned: [...allMissingFields].sort(),
    };

    // Generate TireWeb support message
    audit.tirewebSupportMessage = generateSupportMessage(audit);

    return NextResponse.json(audit);

  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}

function generateSupportMessage(audit: any): string {
  const summary = audit.summary;
  const firstResult = audit.connections?.[0];
  
  const message = `
=== TIREWEB DATA DIAGNOSTIC REPORT ===
Generated: ${audit.timestamp}

QUERY DETAILS:
- Tire Size: ${summary?.requestedSize} (normalized: ${summary?.normalizedSize})
- Connections Tested: ${summary?.connectionsQueried}
- Total Tires Returned: ${summary?.totalTiresFound}

FIELDS SUCCESSFULLY RECEIVED WITH DATA:
${(summary?.fieldsReturnedWithData || []).map((f: string) => `  ✓ ${f}`).join('\n')}

FIELDS NOT RETURNED OR EMPTY:
${(summary?.fieldsNotReturned || []).map((f: string) => `  ✗ ${f}`).join('\n')}

SPECIFICALLY LOOKING FOR:
- UTQG breakdown: Treadwear, Traction, Temperature
- Mileage Warranty: WarrantyMiles, MileageRating
- Product Features: Features, Benefits
- Review Data: ReviewRating, ReviewCount
- Product Images: PatternImageURL, SideImageURL
- Rebate Data: RebateAmount, HasRebate

QUESTIONS FOR TIREWEB:
1. Is our account enabled for full TireLibrary enrichment data?
2. Are UTQG components (Treadwear, Traction, Temperature) returned separately or only as combined UTQG string?
3. Are review ratings/counts available in our access tier?
4. Is there a separate endpoint for enhanced product data?
5. Are we using the correct DetailLevel parameter for maximum data?

SAMPLE RAW RESPONSE:
${firstResult?.rawTireSampleXml?.slice(0, 2000) || '(no sample available)'}
`.trim();

  return message;
}
