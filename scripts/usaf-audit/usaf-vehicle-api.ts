/**
 * USAF GetVehicleOptions API
 * 
 * Queries USAF for OEM tire fitment data by vehicle.
 * 
 * TODO: Confirm exact SOAP structure with Scott
 */

import type { UsafVehicleOption, UsafVehicleOptionsResponse } from '../../src/lib/usaf-fitment';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URLS = {
  test: "https://servicesstage.usautoforce.com/integrationservice.asmx",
  production: "https://services.usautoforce.com/integrationservice.asmx",
};

const SOAP_NAMESPACE = "https://services.usautoforce.com";

function getConfig() {
  const username = process.env.USAUTOFORCE_USERNAME;
  const password = process.env.USAUTOFORCE_PASSWORD;
  const account = process.env.USAUTOFORCE_ACCOUNT;
  
  if (!username || !password || !account) {
    throw new Error("Missing USAUTOFORCE credentials");
  }
  
  const isTest = username.toLowerCase().includes("test");
  
  return {
    username,
    password,
    account,
    apiUrl: isTest ? API_URLS.test : API_URLS.production,
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

function buildSoapEnvelope(method: string, body: string, creds: { username: string; password: string }): string {
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
// GetVehicleOptions
// ============================================================================

/**
 * Query USAF for vehicle tire options
 * 
 * NOTE: The exact SOAP structure needs verification.
 * This is based on the pattern of other USAF methods.
 */
export async function getVehicleOptions(
  year: number,
  make: string,
  model: string,
  options: {
    trim?: string;
    branch?: string;
  } = {}
): Promise<UsafVehicleOptionsResponse> {
  const config = getConfig();
  const transactionId = `VEH-${Date.now()}`;
  const branch = options.branch || "4101";
  
  // Build request body
  // TODO: Confirm exact structure with Scott
  const body = `<request>
    <revision>1.0</revision>
    <transactionId>${transactionId}</transactionId>
    <accountNumber>${escapeXml(config.account)}</accountNumber>
    <branch>${escapeXml(branch)}</branch>
    <year>${year}</year>
    <make>${escapeXml(make)}</make>
    <model>${escapeXml(model)}</model>
    ${options.trim ? `<trim>${escapeXml(options.trim)}</trim>` : ''}
  </request>`;
  
  const envelope = buildSoapEnvelope("GetVehicleOptions", body, {
    username: config.username,
    password: config.password,
  });
  
  try {
    console.log(`[usaf] GetVehicleOptions: ${year} ${make} ${model}`);
    const response = await callSoapApi(config.apiUrl, "GetVehicleOptions", envelope);
    
    const errorCode = extractXmlValue(response, "errorCode");
    const errorMessage = extractXmlValue(response, "errorMessage");
    
    if (errorCode !== "success") {
      return {
        success: false,
        errorCode: errorCode || undefined,
        errorMessage: errorMessage || "Unknown error",
        year: String(year),
        make,
        model,
      };
    }
    
    // Parse vehicle options
    const vehicleOptions = parseVehicleOptions(response);
    
    return {
      success: true,
      year: String(year),
      make,
      model,
      options: vehicleOptions,
    };
    
  } catch (error) {
    console.error("[usaf] GetVehicleOptions error:", error);
    return {
      success: false,
      errorMessage: String(error),
      year: String(year),
      make,
      model,
    };
  }
}

/**
 * Parse vehicle options from SOAP response
 * 
 * TODO: Adjust field names based on actual response structure
 */
function parseVehicleOptions(xml: string): UsafVehicleOption[] {
  const options: UsafVehicleOption[] = [];
  
  // Look for option elements - adjust tag name as needed
  const optionMatches = xml.matchAll(/<(?:VehicleOptionDto|OptionDto|TireOption)>([\s\S]*?)<\/(?:VehicleOptionDto|OptionDto|TireOption)>/g);
  
  for (const match of optionMatches) {
    const optXml = match[1];
    
    const option: UsafVehicleOption = {
      optionCode: extractXmlValue(optXml, "optionCode") || extractXmlValue(optXml, "code") || "",
      optionDescription: extractXmlValue(optXml, "optionDescription") || extractXmlValue(optXml, "description") || "",
      tireSize: extractXmlValue(optXml, "tireSize") || extractXmlValue(optXml, "size") || "",
      rimDiameter: extractXmlNumber(optXml, "rimDiameter") || extractXmlNumber(optXml, "rim") || 0,
      rimWidth: extractXmlNumber(optXml, "rimWidth") || extractXmlNumber(optXml, "width") || 0,
      aspectRatio: extractXmlNumber(optXml, "aspectRatio") || 0,
      sectionWidth: extractXmlNumber(optXml, "sectionWidth") || extractXmlNumber(optXml, "width") || 0,
      loadIndex: extractXmlValue(optXml, "loadIndex") || "",
      speedRating: extractXmlValue(optXml, "speedRating") || "",
      loadRange: extractXmlValue(optXml, "loadRange") || undefined,
      position: parsePosition(extractXmlValue(optXml, "position")),
      isOE: extractXmlValue(optXml, "isOE") === "true" || extractXmlValue(optXml, "oe") === "Y",
    };
    
    // Only add if we have a tire size
    if (option.tireSize) {
      options.push(option);
    }
  }
  
  return options;
}

function parsePosition(pos: string | null): 'front' | 'rear' | 'all' | undefined {
  if (!pos) return undefined;
  const p = pos.toLowerCase();
  if (p.includes('front')) return 'front';
  if (p.includes('rear')) return 'rear';
  if (p.includes('all')) return 'all';
  return undefined;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { getVehicleOptions as default };
