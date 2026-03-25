/**
 * Tirewire Connections Center WHEEL API Client
 * 
 * Queries wheel inventory from suppliers (ATD, NTW, US AutoForce)
 * via the Tirewire SOAP API. Mirrors tire client structure.
 * 
 * Uses same credentials as tire API (GroupToken, AccessKey, ConnectionID).
 */

import { getTirewireCredentials, getEnabledConnections, type TirewireConnection } from "./client";

// ============ Types ============

export interface TirewireWheel {
  id: number;
  productCode: string;
  clientProductCode: string;
  style: string;
  brand: string;
  finish: string;
  size: string;
  description: string;
  boltPatterns: string;
  bore: number | null;
  offset: number | null;
  backside: number | null;
  rimDiameter: number | null;
  rimWidth: number | null;
  loadRating: number | null;
  weight: number | null;
  lugType: string | null;
  imageUrl: string | null;
  capPartNumber: string | null;
  quantity: number;
  quantitySecondary: number;
  buyPrice: number;
  sellPrice: number;
  msrp: number;
  map: number;
  tax: number;
  connectionId: number;
}

export interface TirewireWheelSearchResult {
  wheels: TirewireWheel[];
  message: string | null;
  connectionId: number;
  provider: string;
}

export interface WheelSearchOptions {
  rimDiameter?: number;
  rimWidth?: number;
  boltPattern?: string;
  offset?: number;
  offsetMin?: number;
  offsetMax?: number;
  bore?: number;
  brand?: string;
  finish?: string;
  excludeZeroStock?: boolean;
}

// ============ SOAP API ============

const WHEELS_SERVICE_URL = "http://ws.tirewire.com/connectionscenter/wheelsservice.asmx";

function escapeXml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildGetWheelsByWheelElementsRequest(
  accessKey: string,
  groupToken: string,
  connectionId: number,
  options: WheelSearchOptions
): string {
  // Build nullable decimal elements - must use xsi:nil="true" for null values
  const rimDia = options.rimDiameter != null 
    ? `<wheels:RimDiameter>${options.rimDiameter}</wheels:RimDiameter>`
    : `<wheels:RimDiameter xsi:nil="true" />`;
  
  const rimWidth = options.rimWidth != null
    ? `<wheels:RimWidth>${options.rimWidth}</wheels:RimWidth>`
    : `<wheels:RimWidth xsi:nil="true" />`;
  
  const offset = options.offset != null
    ? `<wheels:Offset>${options.offset}</wheels:Offset>`
    : `<wheels:Offset xsi:nil="true" />`;
  
  const offsetMin = options.offsetMin != null
    ? `<wheels:OffsetMinimum>${options.offsetMin}</wheels:OffsetMinimum>`
    : `<wheels:OffsetMinimum xsi:nil="true" />`;
  
  const offsetMax = options.offsetMax != null
    ? `<wheels:OffsetMaximum>${options.offsetMax}</wheels:OffsetMaximum>`
    : `<wheels:OffsetMaximum xsi:nil="true" />`;
  
  const bore = options.bore != null
    ? `<wheels:Bore>${options.bore}</wheels:Bore>`
    : `<wheels:Bore xsi:nil="true" />`;
  
  const loadRating = `<wheels:LoadRating xsi:nil="true" />`;
  
  // Rear values (not used for now, but required by schema)
  const rearNulls = `
    <wheels:OffsetRear xsi:nil="true" />
    <wheels:OffsetMinimumRear xsi:nil="true" />
    <wheels:OffsetMaximumRear xsi:nil="true" />
    <wheels:RimDiameterRear xsi:nil="true" />
    <wheels:RimWidthRear xsi:nil="true" />
    <wheels:BoreRear xsi:nil="true" />
  `;

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope 
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
  xmlns:wheels="http://ws.tirewire.com/connectionscenter/wheelsservice"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soap:Body>
    <wheels:GetWheelsByWheelElements>
      <wheels:options>
        <wheels:ConnectionID>${connectionId}</wheels:ConnectionID>
        <wheels:AccessKey>${escapeXml(accessKey)}</wheels:AccessKey>
        <wheels:GroupToken>${escapeXml(groupToken)}</wheels:GroupToken>
        <wheels:ExcludeZeroStock>${options.excludeZeroStock !== false}</wheels:ExcludeZeroStock>
        <wheels:VehicleFitmentSearch>false</wheels:VehicleFitmentSearch>
        <wheels:VehicleSizeRangeSearch>false</wheels:VehicleSizeRangeSearch>
        <wheels:InventoryOption>Positive</wheels:InventoryOption>
        <wheels:Brand>${options.brand ? escapeXml(options.brand) : ""}</wheels:Brand>
        <wheels:BoltPattern>${options.boltPattern ? escapeXml(options.boltPattern) : ""}</wheels:BoltPattern>
        <wheels:Finish>${options.finish ? escapeXml(options.finish) : ""}</wheels:Finish>
        ${rimDia}
        ${rimWidth}
        ${offset}
        ${offsetMin}
        ${offsetMax}
        ${bore}
        ${loadRating}
        ${rearNulls}
        <wheels:ProductCodeSearch>false</wheels:ProductCodeSearch>
        <wheels:ProductCodeSearchLikeness>false</wheels:ProductCodeSearchLikeness>
        <wheels:UseCustomerProductCode>false</wheels:UseCustomerProductCode>
      </wheels:options>
    </wheels:GetWheelsByWheelElements>
  </soap:Body>
</soap:Envelope>`;
}

async function callWheelsApi(soapBody: string, action: string): Promise<string> {
  const res = await fetch(WHEELS_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      "SOAPAction": `http://ws.tirewire.com/connectionscenter/wheelsservice/${action}`,
    },
    body: soapBody,
  });

  if (!res.ok) {
    throw new Error(`Tirewire Wheels API error: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

function parseGetWheelsResponse(xml: string, connectionId: number, provider: string): TirewireWheelSearchResult {
  const wheels: TirewireWheel[] = [];
  
  // Extract Wheel elements
  const wheelMatches = xml.matchAll(/<Wheel>([\s\S]*?)<\/Wheel>/g);
  
  for (const match of wheelMatches) {
    const wheelXml = match[1];
    
    const wheel: TirewireWheel = {
      id: extractInt(wheelXml, "ID") || 0,
      productCode: extractString(wheelXml, "ProductCode") || "",
      clientProductCode: extractString(wheelXml, "ClientProductCode") || "",
      style: extractString(wheelXml, "Style") || "",
      brand: extractString(wheelXml, "Brand") || "",
      finish: extractString(wheelXml, "Finish") || "",
      size: extractString(wheelXml, "Size") || "",
      description: extractString(wheelXml, "Description") || "",
      boltPatterns: extractString(wheelXml, "BoltPatterns") || "",
      bore: extractFloat(wheelXml, "Bore"),
      offset: extractFloat(wheelXml, "Offset"),
      backside: extractFloat(wheelXml, "Backside"),
      rimDiameter: extractFloat(wheelXml, "RimDiameter"),
      rimWidth: extractFloat(wheelXml, "RimWidth"),
      loadRating: extractFloat(wheelXml, "LoadRating"),
      weight: extractFloat(wheelXml, "Weight"),
      lugType: extractString(wheelXml, "LugType"),
      imageUrl: extractString(wheelXml, "ImageUrl"),
      capPartNumber: extractString(wheelXml, "CapPartNumber"),
      quantity: extractInt(wheelXml, "Quantity") || 0,
      quantitySecondary: extractInt(wheelXml, "QuantitySecondary") || 0,
      buyPrice: extractFloat(wheelXml, "BuyPrice") || 0,
      sellPrice: extractFloat(wheelXml, "SellPrice") || 0,
      msrp: extractFloat(wheelXml, "MSRP") || 0,
      map: extractFloat(wheelXml, "MAP") || 0,
      tax: extractFloat(wheelXml, "Tax") || 0,
      connectionId,
    };
    
    wheels.push(wheel);
  }
  
  const message = extractString(xml, "Message");
  
  return { wheels, message, connectionId, provider };
}

function extractString(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) return null;
  const value = match[1].trim();
  return value || null;
}

function extractInt(xml: string, tag: string): number | null {
  const str = extractString(xml, tag);
  if (!str) return null;
  const num = parseInt(str, 10);
  return isNaN(num) ? null : num;
}

function extractFloat(xml: string, tag: string): number | null {
  const str = extractString(xml, tag);
  if (!str) return null;
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// ============ Main Search Function ============

export async function searchWheelsTirewire(
  options: WheelSearchOptions
): Promise<TirewireWheelSearchResult[]> {
  // Get credentials
  const creds = await getTirewireCredentials();
  if (!creds) {
    console.warn("[tirewire-wheels] No credentials configured");
    return [];
  }
  
  // Get enabled connections
  const connections = await getEnabledConnections();
  if (connections.length === 0) {
    console.warn("[tirewire-wheels] No enabled connections");
    return [];
  }
  
  console.log(`[tirewire-wheels] Searching ${connections.length} connections:`, 
    connections.map(c => c.provider).join(", "));
  
  // Query each connection in parallel
  const results = await Promise.allSettled(
    connections.map(async (conn) => {
      const soapRequest = buildGetWheelsByWheelElementsRequest(
        creds.accessKey,
        creds.groupToken,
        conn.connectionId,
        options
      );
      
      const response = await callWheelsApi(soapRequest, "GetWheelsByWheelElements");
      return parseGetWheelsResponse(response, conn.connectionId, conn.provider);
    })
  );
  
  // Collect successful results
  const successfulResults: TirewireWheelSearchResult[] = [];
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      console.log(`[tirewire-wheels] ${connections[i].provider}: ${result.value.wheels.length} wheels`);
      successfulResults.push(result.value);
    } else {
      console.error(`[tirewire-wheels] ${connections[i].provider} failed:`, result.reason);
    }
  }
  
  return successfulResults;
}

// ============ Unified Format ============

export interface UnifiedWheel {
  sku: string;
  mfgPartNumber: string;
  brand: string;
  model: string; // style
  finish: string;
  size: string;
  description: string;
  boltPattern: string;
  bore: number | null;
  offset: number | null;
  backspace: number | null;
  diameter: number | null;
  width: number | null;
  loadRating: number | null;
  weight: number | null;
  imageUrl: string | null;
  cost: number | null;
  price: number | null;
  msrp: number | null;
  map: number | null;
  quantity: { primary: number; alternate: number };
  source: string; // "tirewire:atd", "tirewire:ntw", etc.
}

export function tirewireWheelToUnified(wheel: TirewireWheel, provider: string): UnifiedWheel {
  return {
    sku: wheel.clientProductCode || wheel.productCode,
    mfgPartNumber: wheel.productCode,
    brand: wheel.brand,
    model: wheel.style,
    finish: wheel.finish,
    size: wheel.size,
    description: wheel.description || `${wheel.brand} ${wheel.style} ${wheel.finish}`.trim(),
    boltPattern: wheel.boltPatterns,
    bore: wheel.bore,
    offset: wheel.offset,
    backspace: wheel.backside,
    diameter: wheel.rimDiameter,
    width: wheel.rimWidth,
    loadRating: wheel.loadRating,
    weight: wheel.weight,
    imageUrl: wheel.imageUrl,
    cost: wheel.buyPrice > 0 ? wheel.buyPrice : null,
    price: wheel.sellPrice > 0 ? wheel.sellPrice : null,
    msrp: wheel.msrp > 0 ? wheel.msrp : null,
    map: wheel.map > 0 ? wheel.map : null,
    quantity: {
      primary: wheel.quantity,
      alternate: wheel.quantitySecondary,
    },
    source: `tirewire:${provider.replace("tireweb_", "")}`,
  };
}

// ============ Test/Debug ============

export async function testWheelConnection(connectionId: number): Promise<{
  success: boolean;
  wheelCount: number;
  sampleBrands: string[];
  error?: string;
}> {
  try {
    const creds = await getTirewireCredentials();
    if (!creds) {
      return { success: false, wheelCount: 0, sampleBrands: [], error: "No credentials" };
    }
    
    // Search for 20" wheels as a test
    const soapRequest = buildGetWheelsByWheelElementsRequest(
      creds.accessKey,
      creds.groupToken,
      connectionId,
      { rimDiameter: 20, excludeZeroStock: true }
    );
    
    const response = await callWheelsApi(soapRequest, "GetWheelsByWheelElements");
    const result = parseGetWheelsResponse(response, connectionId, "test");
    
    const brands = [...new Set(result.wheels.map(w => w.brand).filter(Boolean))];
    
    return {
      success: true,
      wheelCount: result.wheels.length,
      sampleBrands: brands.slice(0, 10),
    };
  } catch (err: any) {
    return {
      success: false,
      wheelCount: 0,
      sampleBrands: [],
      error: err.message,
    };
  }
}
