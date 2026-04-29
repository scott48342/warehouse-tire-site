/**
 * US AutoForce Direct API Client (AIS - AutoForce Integration Service)
 * 
 * LOCAL DEV ONLY - Uses test credentials
 * Do not deploy to production until live credentials obtained
 * 
 * API Documentation: eTailer AIS Technical Documentation.docx
 * 
 * Endpoints:
 * - Test: https://servicesstage.usautoforce.com/integrationservice.asmx
 * - Prod: https://services.usautoforce.com/integrationservice.asmx
 */

import type {
  USAutoForceCredentials,
  USAutoForceConfig,
  USAutoForceStockCheckResponse,
  USAutoForceStockItem,
  USAutoForceOrderRequest,
  USAutoForceOrderResponse,
  USAutoForceFTPCredentials,
} from "./types";

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URLS = {
  test: "https://servicesstage.usautoforce.com/integrationservice.asmx",
  production: "https://services.usautoforce.com/integrationservice.asmx",
};

const SOAP_NAMESPACE = "https://services.usautoforce.com";

function getConfig(): USAutoForceConfig | null {
  const username = process.env.USAUTOFORCE_USERNAME;
  const password = process.env.USAUTOFORCE_PASSWORD;
  const account = process.env.USAUTOFORCE_ACCOUNT;
  
  if (!username || !password || !account) {
    console.warn("[usautoforce] Missing credentials in environment");
    return null;
  }
  
  const isTest = username.toLowerCase().includes("test");
  
  return {
    api: {
      username,
      password,
      accountNumber: account,
    },
    ftp: process.env.USAUTOFORCE_FTP_HOST ? {
      host: process.env.USAUTOFORCE_FTP_HOST,
      username: process.env.USAUTOFORCE_FTP_USERNAME || "",
      password: process.env.USAUTOFORCE_FTP_PASSWORD || "",
      path: "/USAutoForce/1180608_WarehouseTire",
    } : undefined,
    apiBaseUrl: isTest ? API_URLS.test : API_URLS.production,
    isTest,
  };
}

// ============================================================================
// SOAP HELPERS
// ============================================================================

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSoapEnvelope(method: string, body: string, creds: USAutoForceCredentials): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <Authentication xmlns="${SOAP_NAMESPACE}">
      <User>${escapeXml(creds.username)}</User>
      <Password>${escapeXml(creds.password)}</Password>
    </Authentication>
  </soap:Header>
  <soap:Body>
    <${method} xmlns="${SOAP_NAMESPACE}">
      ${body}
    </${method}>
  </soap:Body>
</soap:Envelope>`;
}

async function callSoapApi(url: string, soapAction: string, envelope: string): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `${SOAP_NAMESPACE}/${soapAction}`,
    },
    body: envelope,
  });
  
  if (!response.ok) {
    throw new Error(`SOAP API error: ${response.status} ${response.statusText}`);
  }
  
  return response.text();
}

function extractXmlValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : null;
}

function extractXmlNumber(xml: string, tag: string): number | null {
  const str = extractXmlValue(xml, tag);
  if (!str) return null;
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// ============================================================================
// SERVICE CHECK (Ping)
// ============================================================================

export interface ServiceCheckResult {
  success: boolean;
  dateTime?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Ping the service to verify connectivity and credentials
 */
export async function serviceCheck(): Promise<ServiceCheckResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, errorMessage: "Missing credentials" };
  }
  
  const transactionId = Date.now().toString();
  
  const body = `<request>
    <revision>1.0</revision>
    <transactionId>${transactionId}</transactionId>
    <accountNumber>${escapeXml(config.api.accountNumber)}</accountNumber>
  </request>`;
  
  const envelope = buildSoapEnvelope("ServiceCheck", body, config.api);
  
  try {
    console.log(`[usautoforce] ServiceCheck to ${config.apiBaseUrl}`);
    const response = await callSoapApi(config.apiBaseUrl!, "ServiceCheck", envelope);
    
    const errorCode = extractXmlValue(response, "errorCode");
    const errorMessage = extractXmlValue(response, "errorMessage");
    const dateTime = extractXmlValue(response, "dateTime");
    
    return {
      success: errorCode === "success",
      dateTime: dateTime || undefined,
      errorCode: errorCode || undefined,
      errorMessage: errorMessage || undefined,
    };
  } catch (error) {
    console.error("[usautoforce] ServiceCheck error:", error);
    return {
      success: false,
      errorMessage: String(error),
    };
  }
}

// ============================================================================
// STOCK CHECK
// ============================================================================

/**
 * Check stock by tire size
 * 
 * @param tireSize - Size like "225/60R16" or "2256016"
 * @param options.branch - Primary warehouse code (e.g., "4101")
 * @param options.alternateBranches - Additional warehouses to check
 * @param options.quantity - Quantity needed (default: 4)
 */
export async function checkStockBySize(
  tireSize: string,
  options: { 
    branch?: string; 
    alternateBranches?: string[];
    quantity?: number;
  } = {}
): Promise<USAutoForceStockCheckResponse> {
  const config = getConfig();
  if (!config) {
    return { success: false, branch: "", items: [], errorMessage: "Missing credentials" };
  }
  
  // Normalize tire size: "225/60R16" -> "2256016"
  const simpleSize = normalizeSize(tireSize);
  const parts = parseSize(simpleSize);
  
  if (!parts) {
    return { success: false, branch: "", items: [], errorMessage: `Invalid tire size: ${tireSize}` };
  }
  
  const transactionId = Date.now().toString();
  const branch = options.branch || "4101"; // Default to Appleton
  const quantity = options.quantity || 4;
  
  // Build alternate branches XML
  let alternateBranchesXml = "";
  if (options.alternateBranches && options.alternateBranches.length > 0) {
    alternateBranchesXml = `<alternateBranches>
      ${options.alternateBranches.map(code => `<BranchDto><code>${escapeXml(code)}</code></BranchDto>`).join("\n")}
    </alternateBranches>`;
  }
  
  const body = `<request>
    <revision>1.0</revision>
    <transactionId>${transactionId}</transactionId>
    <accountNumber>${escapeXml(config.api.accountNumber)}</accountNumber>
    <alternateFlag>no</alternateFlag>
    <branch>${escapeXml(branch)}</branch>
    <dataSource>manual</dataSource>
    ${alternateBranchesXml}
    <tires>
      <TireDto>
        <lineNumber>1</lineNumber>
        <width>${parts.width}</width>
        <aspectRatio>${parts.aspect}</aspectRatio>
        <rim>${parts.rim}</rim>
        <tireSize>${simpleSize}</tireSize>
        <quantityRequested>${quantity}</quantityRequested>
      </TireDto>
    </tires>
  </request>`;
  
  const envelope = buildSoapEnvelope("StockCheck", body, config.api);
  
  try {
    console.log(`[usautoforce] StockCheck for ${simpleSize} at branch ${branch}`);
    const response = await callSoapApi(config.apiBaseUrl!, "StockCheck", envelope);
    
    // Log raw response for debugging
    console.log(`[usautoforce] StockCheck response length: ${response.length}`);
    
    const errorCode = extractXmlValue(response, "errorCode");
    const errorMessage = extractXmlValue(response, "errorMessage");
    
    if (errorCode !== "success") {
      return {
        success: false,
        branch,
        items: [],
        errorCode: errorCode || undefined,
        errorMessage: errorMessage || "Unknown error",
      };
    }
    
    // Parse tire results
    const items = parseTireStockResults(response, branch);
    
    return {
      success: true,
      branch,
      items,
    };
  } catch (error) {
    console.error("[usautoforce] StockCheck error:", error);
    return {
      success: false,
      branch,
      items: [],
      errorMessage: String(error),
    };
  }
}

/**
 * Check stock by part number
 */
export async function checkStockByPartNumber(
  partNumber: string,
  lineCode: string,
  options: { 
    branch?: string; 
    alternateBranches?: string[];
    quantity?: number;
  } = {}
): Promise<USAutoForceStockCheckResponse> {
  const config = getConfig();
  const branch = options.branch || "4101";
  if (!config) {
    return { success: false, branch, items: [], errorMessage: "Missing credentials" };
  }
  
  const transactionId = Date.now().toString();
  const quantity = options.quantity || 1;
  
  let alternateBranchesXml = "";
  if (options.alternateBranches && options.alternateBranches.length > 0) {
    alternateBranchesXml = `<alternateBranches>
      ${options.alternateBranches.map(code => `<BranchDto><code>${escapeXml(code)}</code></BranchDto>`).join("\n")}
    </alternateBranches>`;
  }
  
  const body = `<request>
    <revision>1.0</revision>
    <transactionId>${transactionId}</transactionId>
    <accountNumber>${escapeXml(config.api.accountNumber)}</accountNumber>
    <alternateFlag>no</alternateFlag>
    <branch>${escapeXml(branch)}</branch>
    <dataSource>manual</dataSource>
    ${alternateBranchesXml}
    <parts>
      <PartDto>
        <lineNumber>1</lineNumber>
        <lineCode>${escapeXml(lineCode)}</lineCode>
        <partNumber>${escapeXml(partNumber)}</partNumber>
        <quantityRequested>${quantity}</quantityRequested>
      </PartDto>
    </parts>
  </request>`;
  
  const envelope = buildSoapEnvelope("StockCheck", body, config.api);
  
  try {
    console.log(`[usautoforce] StockCheck for part# ${partNumber}`);
    const response = await callSoapApi(config.apiBaseUrl!, "StockCheck", envelope);
    
    const errorCode = extractXmlValue(response, "errorCode");
    const errorMessage = extractXmlValue(response, "errorMessage");
    
    if (errorCode !== "success") {
      return {
        success: false,
        branch,
        items: [],
        errorCode: errorCode || undefined,
        errorMessage: errorMessage || "Unknown error",
      };
    }
    
    // TODO: Parse part results (similar to tire but different fields)
    return {
      success: true,
      branch,
      items: [],
      errorMessage: "Part stock check parsing not yet implemented",
    };
  } catch (error) {
    console.error("[usautoforce] StockCheck error:", error);
    return {
      success: false,
      branch,
      items: [],
      errorMessage: String(error),
    };
  }
}

// ============================================================================
// ORDER PLACEMENT
// ============================================================================

/**
 * Place an order with US AutoForce
 * 
 * Delivery methods:
 * - "FedEx-Grou" - FedEx Ground
 * - "UPS-Grou" - UPS Ground
 * - "USPS-Mail" - USPS
 * 
 * Ship-to code 99999 = US AutoForce generates shipping label
 */
export async function placeOrder(
  request: USAutoForceOrderRequest
): Promise<USAutoForceOrderResponse> {
  const config = getConfig();
  if (!config) {
    return { success: false, errorMessage: "Missing credentials" };
  }
  
  if (!request.items || request.items.length === 0) {
    return { success: false, errorMessage: "No items in order" };
  }
  
  if (!request.shipTo) {
    return { success: false, errorMessage: "Ship-to address required" };
  }
  
  const transactionId = Date.now().toString();
  const branch = request.warehouseCode || "4101";
  
  // Build tires XML (assuming tire order for now)
  // Note: lineCode is the brand code (e.g., "TOY", "GEN", "BFG")
  const tiresXml = request.items.map((item, idx) => `
    <TireDto>
      <lineNumber>${idx + 1}</lineNumber>
      ${item.lineCode ? `<lineCode>${escapeXml(item.lineCode)}</lineCode>` : ""}
      <partNumber>${escapeXml(item.partNumber)}</partNumber>
      <quantityRequested>${item.quantity}</quantityRequested>
    </TireDto>
  `).join("");
  
  const body = `<request>
    <revision>1.0</revision>
    <transactionId>${transactionId}</transactionId>
    <accountNumber>${escapeXml(config.api.accountNumber)}</accountNumber>
    <fillFlag>backord</fillFlag>
    <branch>${escapeXml(branch)}</branch>
    <poNumber>${escapeXml(request.purchaseOrderNumber)}</poNumber>
    <deliveryMethod>FedEx-Grou</deliveryMethod>
    <shipTo>
      <shipToCode>99999</shipToCode>
      <customerName>${escapeXml(request.shipTo.name)}</customerName>
      <address1>${escapeXml(request.shipTo.address1)}</address1>
      ${request.shipTo.address2 ? `<address2>${escapeXml(request.shipTo.address2)}</address2>` : ""}
      <city>${escapeXml(request.shipTo.city)}</city>
      <state>${escapeXml(request.shipTo.state)}</state>
      <zip>${escapeXml(request.shipTo.zip)}</zip>
    </shipTo>
    <billTo>
      <billToCode>${escapeXml(config.api.accountNumber)}</billToCode>
    </billTo>
    <tires>
      ${tiresXml}
    </tires>
    ${request.notes ? `<comments><CommentDto><type>vehicle</type><text>${escapeXml(request.notes)}</text></CommentDto></comments>` : ""}
  </request>`;
  
  const envelope = buildSoapEnvelope("Order", body, config.api);
  
  try {
    console.log(`[usautoforce] Order placement: ${request.items.length} items to ${request.shipTo.city}, ${request.shipTo.state}`);
    const response = await callSoapApi(config.apiBaseUrl!, "Order", envelope);
    
    const errorCode = extractXmlValue(response, "errorCode");
    const errorMessage = extractXmlValue(response, "errorMessage");
    const orderNumber = extractXmlValue(response, "orderNumber");
    const status = extractXmlValue(response, "status");
    
    return {
      success: errorCode === "success",
      orderNumber: orderNumber || undefined,
      branch,
      errorCode: errorCode !== "success" ? (errorCode || undefined) : undefined,
      errorMessage: errorCode !== "success" ? errorMessage || undefined : undefined,
    };
  } catch (error) {
    console.error("[usautoforce] Order error:", error);
    return {
      success: false,
      errorMessage: String(error),
    };
  }
}

// ============================================================================
// ORDER STATUS
// ============================================================================

export interface OrderStatusResult {
  success: boolean;
  status?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  poNumber?: string;
  trackingNumbers?: string[];
  totalCost?: number;
  errorMessage?: string;
}

/**
 * Get order status details
 */
export async function getOrderStatus(orderNumber: string): Promise<OrderStatusResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, errorMessage: "Missing credentials" };
  }
  
  const transactionId = Date.now().toString();
  
  const body = `<request>
    <revision>1.0</revision>
    <transactionId>${transactionId}</transactionId>
    <accountNumber>${escapeXml(config.api.accountNumber)}</accountNumber>
    <orderNumber>${escapeXml(orderNumber)}</orderNumber>
    <orderType>invoiced</orderType>
  </request>`;
  
  const envelope = buildSoapEnvelope("OrderStatusDetail", body, config.api);
  
  try {
    console.log(`[usautoforce] OrderStatusDetail for ${orderNumber}`);
    const response = await callSoapApi(config.apiBaseUrl!, "OrderStatusDetail", envelope);
    
    const errorCode = extractXmlValue(response, "errorCode");
    const errorMessage = extractXmlValue(response, "errorMessage");
    
    if (errorCode !== "success") {
      return {
        success: false,
        errorMessage: errorMessage || "Unknown error",
      };
    }
    
    // Extract tracking numbers
    const trackingMatches = response.matchAll(/<string>([^<]+)<\/string>/g);
    const trackingNumbers = Array.from(trackingMatches, m => m[1]);
    
    return {
      success: true,
      status: extractXmlValue(response, "status") || undefined,
      orderNumber: extractXmlValue(response, "orderNumber") || undefined,
      invoiceNumber: extractXmlValue(response, "invoiceNumber") || undefined,
      poNumber: extractXmlValue(response, "poNumber") || undefined,
      trackingNumbers: trackingNumbers.length > 0 ? trackingNumbers : undefined,
      totalCost: extractXmlNumber(response, "totalCost") || undefined,
    };
  } catch (error) {
    console.error("[usautoforce] OrderStatusDetail error:", error);
    return {
      success: false,
      errorMessage: String(error),
    };
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Normalize tire size to simple format: "225/60R16" -> "2256016"
 */
function normalizeSize(size: string): string {
  const v = String(size || "").trim().toUpperCase();
  
  // Already simple format
  const simple = v.match(/^(\d{6,7})$/);
  if (simple) return simple[1];
  
  // Standard format: 225/60R16
  const standard = v.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R?\s*(\d{2})/i);
  if (standard) return `${standard[1]}${standard[2]}${standard[3]}`;
  
  return v;
}

/**
 * Parse size into components
 */
function parseSize(simpleSize: string): { width: number; aspect: number; rim: number } | null {
  // Format: WWWAARR (e.g., 2256016 = 225/60R16)
  if (simpleSize.length === 7) {
    return {
      width: parseInt(simpleSize.slice(0, 3)),
      aspect: parseInt(simpleSize.slice(3, 5)),
      rim: parseInt(simpleSize.slice(5, 7)),
    };
  }
  
  // Format: WWAARR (e.g., 205516 = 205/55R16)
  if (simpleSize.length === 6) {
    return {
      width: parseInt(simpleSize.slice(0, 2) + "0"), // Assume 3-digit width
      aspect: parseInt(simpleSize.slice(2, 4)),
      rim: parseInt(simpleSize.slice(4, 6)),
    };
  }
  
  return null;
}

/**
 * Parse tire stock results from SOAP response
 * 
 * Based on actual API response structure (tested 2026-04-29)
 */
function parseTireStockResults(xml: string, branch: string): USAutoForceStockItem[] {
  const items: USAutoForceStockItem[] = [];
  
  // Extract TireDto elements
  const tireMatches = xml.matchAll(/<TireDto>([\s\S]*?)<\/TireDto>/g);
  
  for (const match of tireMatches) {
    const tireXml = match[1];
    
    // Extract brand from lineCodes
    const brandMatch = tireXml.match(/<lineCodes><string>([^<]+)<\/string>/);
    const brandCode = brandMatch ? brandMatch[1] : "";
    
    // Extract speed rating from speedRatings
    const speedMatch = tireXml.match(/<speedRatings><string>([^<]+)<\/string>/);
    const speedRating = speedMatch ? speedMatch[1] : "";
    
    // Extract tire type from tireTypes
    const typeMatch = tireXml.match(/<tireTypes><string>([^<]+)<\/string>/);
    const tireType = typeMatch ? typeMatch[1] : "";
    
    // Extract sales class from salesClasses
    const classMatch = tireXml.match(/<salesClasses><string>([^<]+)<\/string>/);
    const salesClass = classMatch ? classMatch[1] : "";
    
    // Extract warehouse availability
    const availability: Array<{
      code: string;
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      quantityAvailable: number;
      transferRequired: boolean;
    }> = [];
    
    const branchMatches = tireXml.matchAll(/<BranchDto>([\s\S]*?)<\/BranchDto>/g);
    for (const branchMatch of branchMatches) {
      const branchXml = branchMatch[1];
      availability.push({
        code: extractXmlValue(branchXml, "code") || "",
        name: extractXmlValue(branchXml, "name") || "",
        address: extractXmlValue(branchXml, "address") || "",
        city: extractXmlValue(branchXml, "city") || "",
        state: extractXmlValue(branchXml, "state") || "",
        zip: extractXmlValue(branchXml, "zip") || "",
        quantityAvailable: extractXmlNumber(branchXml, "quantityAvailable") || 0,
        transferRequired: extractXmlValue(branchXml, "transferRequired") === "true",
      });
    }
    
    // Total quantity from first availability entry
    const totalQty = availability.length > 0 ? availability[0].quantityAvailable : 0;
    
    const item: USAutoForceStockItem = {
      // Identifiers
      partNumber: extractXmlValue(tireXml, "partNumber") || "",
      lineNumber: extractXmlNumber(tireXml, "lineNumber") || 0,
      brandCode,
      
      // Product info
      description: extractXmlValue(tireXml, "description") || "",
      model: extractXmlValue(tireXml, "model") || "",
      tireType,
      salesClass,
      
      // Size info
      width: extractXmlNumber(tireXml, "width") || 0,
      aspectRatio: extractXmlNumber(tireXml, "aspectRatio") || 0,
      rimDiameter: extractXmlNumber(tireXml, "rim") || 0,
      tireSize: extractXmlValue(tireXml, "tireSize") || "",
      
      // Pricing
      cost: extractXmlNumber(tireXml, "cost") || 0,
      map: extractXmlNumber(tireXml, "map") || 0,
      list: extractXmlNumber(tireXml, "list") || 0,
      retailPrice: extractXmlNumber(tireXml, "retailPrice") || 0,
      gmCost: extractXmlNumber(tireXml, "gmCost") || 0,
      gmRetail: extractXmlNumber(tireXml, "gmRetail") || 0,
      fet: extractXmlNumber(tireXml, "fet") || 0,
      
      // Specs
      speedRating,
      loadIndex: extractXmlValue(tireXml, "loadIndex") || "",
      loadRange: extractXmlValue(tireXml, "loadRange") || "",
      utqg: extractXmlValue(tireXml, "utqg") || "",
      treadDepth: extractXmlNumber(tireXml, "treadDepth") || 0,
      weight: extractXmlNumber(tireXml, "weight") || 0,
      sidewall: extractXmlValue(tireXml, "sideWall") || "",
      warranty: extractXmlNumber(tireXml, "warranty") || 0,
      oeFit: extractXmlValue(tireXml, "oeFit") || "",
      
      // Media
      imageUrl: extractXmlValue(tireXml, "imageUrl") || null,
      specUrl: extractXmlValue(tireXml, "url") || null,
      
      // Availability
      quantityRequested: extractXmlNumber(tireXml, "quantityRequested") || 0,
      availability,
      
      // Flags
      onSpecial: extractXmlValue(tireXml, "onSpecial") === "Y",
      isSSP: extractXmlValue(tireXml, "isSSP") === "true",
    };
    
    items.push(item);
  }
  
  return items;
}

// ============================================================================
// DIAGNOSTIC / TEST
// ============================================================================

/**
 * Test credentials and connectivity
 */
export async function testConnection(): Promise<{
  credentialsPresent: boolean;
  apiUrlConfigured: boolean;
  ftpConfigured: boolean;
  isTestMode: boolean;
  serviceCheckResult?: ServiceCheckResult;
  message: string;
}> {
  const config = getConfig();
  
  if (!config) {
    return {
      credentialsPresent: false,
      apiUrlConfigured: false,
      ftpConfigured: false,
      isTestMode: false,
      message: "No credentials configured. Set USAUTOFORCE_USERNAME, USAUTOFORCE_PASSWORD, USAUTOFORCE_ACCOUNT in .env.local",
    };
  }
  
  // Try service check
  const serviceCheckResult = await serviceCheck();
  
  return {
    credentialsPresent: true,
    apiUrlConfigured: true, // We now auto-select based on test/prod
    ftpConfigured: !!config.ftp?.host,
    isTestMode: config.isTest,
    serviceCheckResult,
    message: serviceCheckResult.success 
      ? `Connected to ${config.apiBaseUrl}${config.isTest ? " (TEST)" : " (PRODUCTION)"}`
      : `Connection failed: ${serviceCheckResult.errorMessage}`,
  };
}

/**
 * Get current configuration status (safe - no secrets)
 */
export function getStatus(): {
  configured: boolean;
  hasCredentials: boolean;
  hasApiUrl: boolean;
  hasFtp: boolean;
  isTestMode: boolean;
  apiUrl: string | null;
} {
  const config = getConfig();
  return {
    configured: !!config,
    hasCredentials: !!config?.api.username && !!config?.api.password,
    hasApiUrl: true, // Always true now - auto-selected
    hasFtp: !!config?.ftp?.host,
    isTestMode: config?.isTest ?? false,
    apiUrl: config?.apiBaseUrl || null,
  };
}
