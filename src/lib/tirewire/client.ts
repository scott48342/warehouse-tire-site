/**
 * TireWeb Connections Center API Client
 * 
 * Queries tire inventory from multiple suppliers (ATD, NTW, US AutoForce)
 * via the TireWeb SOAP API (ws.tirewire.com). Returns TireLibrary-enriched 
 * data including images, specs, and pricing.
 * 
 * NOTE: The API domain is "tirewire.com" but the product is "TireWeb".
 * We use "TireWeb" internally for consistency with the admin UI.
 */

import crypto from "crypto";
import pg from "pg";

const { Pool } = pg;

// ============ Types ============

export interface TireWebCredentials {
  accessKey: string;
  groupToken: string;
}

export interface TireWebConnection {
  provider: string;
  connectionId: number;
  enabled: boolean;
}

export interface TireWebTire {
  id: number; // TireLibrary ID
  productCode: string;
  clientProductCode: string;
  name: string;
  make: string;
  makeId: number;
  pattern: string;
  patternId: number;
  description: string;
  imageUrl: string | null;
  width: number;
  aspectRatio: number;
  rim: number;
  weight: number | null;
  speedRating: string | null;
  loadRating: string | null;
  plyRating: string | null;
  utqg: string | null;
  loadRange: string | null;
  sidewall: string | null;
  treadDepth: string | null;
  warranty: string | null;
  features: string | null;
  benefits: string | null;
  buyPrice: number;
  sellPrice: number | null;
  tax: number;
  quantity: number;
  quantitySecondary: number;
  connectionId: number;
  supplierSystemId: number;
}

export interface TireWebSearchResult {
  tires: TireWebTire[];
  unmappedCount: number;
  message: string | null;
  connectionId: number;
  provider: string;
}

// ============ Legacy type aliases (for backward compatibility) ============
/** @deprecated Use TireWebCredentials instead */
export type TirewireCredentials = TireWebCredentials;
/** @deprecated Use TireWebConnection instead */
export type TirewireConnection = TireWebConnection;
/** @deprecated Use TireWebTire instead */
export type TirewireTire = TireWebTire;
/** @deprecated Use TireWebSearchResult instead */
export type TirewireSearchResult = TireWebSearchResult;

// ============ Encryption ============

function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIALS_KEY || process.env.ADMIN_PASSWORD || "default-key-change-me";
  return crypto.scryptSync(key, "tireweb-salt", 32);
}

function decrypt(encrypted: string): string {
  try {
    const [ivHex, data] = encrypted.split(":");
    if (!ivHex || !data) return encrypted; // Not encrypted
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encrypted; // Return as-is if decryption fails
  }
}

// ============ Database ============

// OPTIMIZATION: Reuse pool instead of creating/destroying per call
let _tirewebPool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (_tirewebPool) return _tirewebPool;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  _tirewebPool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return _tirewebPool;
}

// OPTIMIZATION: Cache credentials and connections for 5 minutes
let _credsCache: { data: TireWebCredentials | null; expiresAt: number } | null = null;
let _connsCache: { data: TireWebConnection[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getTireWebCredentials(): Promise<TireWebCredentials | null> {
  // Return from cache if valid
  if (_credsCache && _credsCache.expiresAt > Date.now()) {
    return _credsCache.data;
  }
  
  // PRIORITY 1: Check environment variables (works in Vercel serverless)
  // Support both TIREWEB_* (preferred) and TIREWIRE_* (legacy) env var names
  const envAccessKey = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
  const envGroupToken = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;
  
  if (envAccessKey && envGroupToken) {
    console.log("[tireweb] Using credentials from env vars");
    const result = { accessKey: envAccessKey, groupToken: envGroupToken };
    _credsCache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  }
  
  // PRIORITY 2: Fall back to database (for local dev if env vars not set)
  const pool = getPool();
  try {
    const { rows } = await pool.query(`
      SELECT key, value FROM tireweb_config WHERE key IN ('access_key', 'group_token')
    `);

    const accessKeyRow = rows.find((r: any) => r.key === "access_key");
    const groupTokenRow = rows.find((r: any) => r.key === "group_token");

    if (!accessKeyRow?.value || !groupTokenRow?.value) {
      _credsCache = { data: null, expiresAt: Date.now() + CACHE_TTL_MS };
      return null;
    }

    const decryptedAccessKey = decrypt(accessKeyRow.value);
    const decryptedGroupToken = decrypt(groupTokenRow.value);
    
    // Log credential status (not the actual values)
    console.log("[tireweb] Credentials loaded from DB:", {
      accessKeyLength: decryptedAccessKey?.length || 0,
      groupTokenLength: decryptedGroupToken?.length || 0,
      accessKeyPreview: decryptedAccessKey ? `${decryptedAccessKey.slice(0, 4)}...` : "null",
    });
    
    const result = {
      accessKey: decryptedAccessKey,
      groupToken: decryptedGroupToken,
    };
    _credsCache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  } catch (err) {
    console.error("[tireweb] Failed to get credentials from DB:", err);
    return null;
  }
  // NOTE: No longer ending pool - it's reused
}

// Legacy alias for backward compatibility
/** @deprecated Use getTireWebCredentials instead */
export const getTirewireCredentials = getTireWebCredentials;

// Default connections when using env var credentials (avoids DB query)
const DEFAULT_CONNECTIONS: TireWebConnection[] = [
  { provider: "tireweb_atd", connectionId: 488677, enabled: true },
  { provider: "tireweb_ntw", connectionId: 488546, enabled: true },
  { provider: "tireweb_usautoforce", connectionId: 488548, enabled: true },
];

export async function getEnabledConnections(): Promise<TireWebConnection[]> {
  // Return from cache if valid
  if (_connsCache && _connsCache.expiresAt > Date.now()) {
    return _connsCache.data;
  }
  
  // PRIORITY 1: Use defaults if env var credentials are set (avoids DB)
  const hasEnvCreds = (process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY) && 
                      (process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN);
  if (hasEnvCreds) {
    console.log("[tireweb] Using default connections (env var mode)");
    _connsCache = { data: DEFAULT_CONNECTIONS, expiresAt: Date.now() + CACHE_TTL_MS };
    return DEFAULT_CONNECTIONS;
  }
  
  // PRIORITY 2: Query database
  const pool = getPool();
  try {
    const { rows } = await pool.query(`
      SELECT provider, connection_id, enabled 
      FROM tireweb_connections 
      WHERE enabled = true AND connection_id IS NOT NULL
    `);

    const result = rows.map((r: any) => ({
      provider: r.provider,
      connectionId: r.connection_id,
      enabled: r.enabled,
    }));
    _connsCache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  } catch (err) {
    console.error("[tireweb] Failed to get connections from DB:", err);
    return [];
  }
  // NOTE: No longer ending pool - it's reused
}

// ============ SOAP API ============

// NOTE: API domain is "tirewire.com" but product name is "TireWeb"
const PRODUCTS_SERVICE_URL = "http://ws.tirewire.com/connectionscenter/productsservice.asmx";

function buildGetTiresRequest(
  accessKey: string,
  groupToken: string,
  connectionId: number,
  tireSize: string, // e.g., "2256016"
  detailLevel: number = 10 // 0=min, 6=standard, 10=all
): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${escapeXml(accessKey)}</prod:AccessKey>
        <prod:GroupToken>${escapeXml(groupToken)}</prod:GroupToken>
        <prod:ConnectionID>${connectionId}</prod:ConnectionID>
        <prod:TireSize>${escapeXml(tireSize)}</prod:TireSize>
        <prod:DetailLevel>${detailLevel}</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function callTireWebApi(soapBody: string): Promise<string> {
  const res = await fetch(PRODUCTS_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      "SOAPAction": "http://ws.tirewire.com/connectionscenter/productsservice/GetTires",
    },
    body: soapBody,
  });

  if (!res.ok) {
    throw new Error(`TireWeb API error: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

function parseGetTiresResponse(xml: string, connectionId: number, provider: string): TireWebSearchResult {
  const tires: TireWebTire[] = [];
  
  // Check for error response
  const errorCode = extractInt(xml, "ErrorCode");
  const errorMessage = extractString(xml, "ErrorMessage");
  if (errorCode && errorCode !== 0) {
    console.log(`[tireweb] API response length: ${xml.length}`);
    console.log(`[tireweb] FULL response:`, xml);
    console.log(`[tireweb] Connection ${provider} returned ${tires.length} tires`);
    return { tires: [], unmappedCount: 0, message: errorMessage, connectionId, provider };
  }
  
  // Extract Tire elements
  const tireMatches = xml.matchAll(/<Tire>([\s\S]*?)<\/Tire>/g);
  
  for (const match of tireMatches) {
    const tireXml = match[1];
    
    const tire: TireWebTire = {
      id: extractInt(tireXml, "ID") || 0,
      productCode: extractString(tireXml, "ProductCode") || "",
      clientProductCode: extractString(tireXml, "ClientProductCode") || "",
      name: extractString(tireXml, "Name") || "",
      make: extractString(tireXml, "Make") || "",
      makeId: extractInt(tireXml, "MakeID") || 0,
      pattern: extractString(tireXml, "Pattern") || "",
      patternId: extractInt(tireXml, "PatternID") || 0,
      description: extractString(tireXml, "Description") || "",
      imageUrl: extractString(tireXml, "ImageURL") || null,
      width: extractFloat(tireXml, "Width") || 0,
      aspectRatio: extractFloat(tireXml, "AspectRatio") || 0,
      rim: extractFloat(tireXml, "Rim") || 0,
      weight: extractFloat(tireXml, "Weight"),
      speedRating: extractString(tireXml, "SpeedRating"),
      loadRating: extractString(tireXml, "LoadRating"),
      plyRating: extractString(tireXml, "PlyRating"),
      utqg: extractString(tireXml, "UTQG"),
      loadRange: extractString(tireXml, "LoadRange"),
      sidewall: extractString(tireXml, "Sidewall"),
      treadDepth: extractString(tireXml, "TreadDepth"),
      warranty: extractString(tireXml, "Warranty"),
      features: extractString(tireXml, "Features"),
      benefits: extractString(tireXml, "Benefits"),
      buyPrice: extractFloat(tireXml, "BuyPrice") || 0,
      sellPrice: extractFloat(tireXml, "SellPrice"),
      tax: extractFloat(tireXml, "Tax") || 0,
      quantity: extractInt(tireXml, "Quantity") || 0,
      quantitySecondary: extractInt(tireXml, "QuantitySecondary") || 0,
      connectionId,
      supplierSystemId: extractInt(tireXml, "SupplierSystemID") || 0,
    };
    
    tires.push(tire);
  }
  
  const unmappedCount = extractInt(xml, "UnmappedCount") || 0;
  const message = extractString(xml, "Message");
  
  return { tires, unmappedCount, message, connectionId, provider };
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

export async function searchTiresTireWeb(
  tireSize: string // e.g., "225/60R16" or "2256016"
): Promise<TireWebSearchResult[]> {
  // Normalize size to simple format (2256016)
  const simpleSize = toSimpleSize(tireSize);
  if (!simpleSize) {
    console.warn("[tireweb] Invalid tire size:", tireSize);
    return [];
  }
  
  // Get credentials
  const creds = await getTireWebCredentials();
  if (!creds) {
    console.warn("[tireweb] No credentials configured");
    return [];
  }
  
  // Get enabled connections
  const connections = await getEnabledConnections();
  if (connections.length === 0) {
    console.warn("[tireweb] No enabled connections");
    return [];
  }
  
  // Query each connection in parallel
  const results = await Promise.allSettled(
    connections.map(async (conn) => {
      const soapRequest = buildGetTiresRequest(
        creds.accessKey,
        creds.groupToken,
        conn.connectionId,
        simpleSize
      );
      
      const response = await callTireWebApi(soapRequest);
      return parseGetTiresResponse(response, conn.connectionId, conn.provider);
    })
  );
  
  // Collect successful results
  const successfulResults: TireWebSearchResult[] = [];
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      successfulResults.push(result.value);
    } else {
      console.error(`[tireweb] Connection ${connections[i].provider} failed:`, result.reason);
    }
  }
  
  return successfulResults;
}

// Legacy alias for backward compatibility
/** @deprecated Use searchTiresTireWeb instead */
export const searchTiresTirewire = searchTiresTireWeb;

function toSimpleSize(s: string): string {
  const v = String(s || "").trim().toUpperCase();
  const m = v.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R?\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const m2 = v.match(/^(\d{7})$/);
  if (m2) return m2[1];
  return "";
}

// ============ Utility: Convert to unified format ============

export interface UnifiedTire {
  partNumber: string;
  mfgPartNumber: string;
  brand: string | null;
  model: string | null;
  description: string;
  cost: number | null;
  price: number | null;
  quantity: { primary: number; alternate: number; national: number };
  imageUrl: string | null;
  size: string;
  simpleSize: string;
  rimDiameter: number | null;
  tireLibraryId: number | null;
  source: string; // "tireweb:atd", "tireweb:ntw", "km", etc.
  badges: {
    terrain: string | null;
    construction: string | null;
    warrantyMiles: number | null;
    loadIndex: string | null;
    speedRating: string | null;
    utqg: string | null;
  };
}

export function tireWebTireToUnified(tire: TireWebTire, provider: string): UnifiedTire {
  const size = `${Math.round(tire.width)}/${Math.round(tire.aspectRatio)}R${Math.round(tire.rim)}`;
  
  // Image URL will be resolved later via getCachedTireImage()
  // Store the patternId for batch lookup in the caller
  // Fall back to TireLibrary URL for now (service will swap for cached version)
  let imageUrl = tire.imageUrl || null;
  if (tire.patternId && tire.patternId > 0) {
    imageUrl = `https://tireweb.tirelibrary.com/images/Products/${tire.patternId}.jpg`;
  }
  
  return {
    partNumber: tire.clientProductCode || tire.productCode,
    mfgPartNumber: tire.productCode,
    brand: tire.make || null,
    model: tire.pattern || null,
    description: tire.name || tire.description || `${tire.make} ${tire.pattern}`.trim(),
    cost: tire.buyPrice > 0 ? tire.buyPrice : null,
    price: tire.sellPrice && tire.sellPrice > 0 ? tire.sellPrice : null,
    quantity: {
      primary: tire.quantity,
      alternate: tire.quantitySecondary,
      national: tire.quantity + tire.quantitySecondary,
    },
    imageUrl,
    size,
    simpleSize: `${Math.round(tire.width)}${Math.round(tire.aspectRatio)}${Math.round(tire.rim)}`,
    rimDiameter: Math.round(tire.rim),
    tireLibraryId: tire.id || null,
    source: `tireweb:${provider.replace("tireweb_", "")}`, // FIXED: "tireweb:atd" not "tirewire:atd"
    badges: {
      terrain: null, // TireWeb doesn't have terrain classification
      construction: null,
      warrantyMiles: tire.warranty ? parseInt(tire.warranty) || null : null,
      loadIndex: tire.loadRating || null,
      speedRating: tire.speedRating || null,
      utqg: tire.utqg || null,
    },
  };
}

// Legacy alias for backward compatibility
/** @deprecated Use tireWebTireToUnified instead */
export const tirewireTireToUnified = tireWebTireToUnified;
