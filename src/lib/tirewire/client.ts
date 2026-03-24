/**
 * Tirewire Connections Center API Client
 * 
 * Queries tire inventory from multiple suppliers (ATD, NTW, US AutoForce)
 * via the Tirewire SOAP API. Returns TireLibrary-enriched data including
 * images, specs, and pricing.
 */

import crypto from "crypto";
import pg from "pg";

const { Pool } = pg;

// ============ Types ============

export interface TirewireCredentials {
  accessKey: string;
  groupToken: string;
}

export interface TirewireConnection {
  provider: string;
  connectionId: number;
  enabled: boolean;
}

export interface TirewireTire {
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

export interface TirewireSearchResult {
  tires: TirewireTire[];
  unmappedCount: number;
  message: string | null;
  connectionId: number;
  provider: string;
}

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
let _tirewirePool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (_tirewirePool) return _tirewirePool;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  _tirewirePool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return _tirewirePool;
}

// OPTIMIZATION: Cache credentials and connections for 5 minutes
let _credsCache: { data: TirewireCredentials | null; expiresAt: number } | null = null;
let _connsCache: { data: TirewireConnection[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getTirewireCredentials(): Promise<TirewireCredentials | null> {
  // Return from cache if valid
  if (_credsCache && _credsCache.expiresAt > Date.now()) {
    return _credsCache.data;
  }
  
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

    const result = {
      accessKey: decrypt(accessKeyRow.value),
      groupToken: decrypt(groupTokenRow.value),
    };
    _credsCache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  } catch (err) {
    console.error("[tirewire] Failed to get credentials:", err);
    return null;
  }
  // NOTE: No longer ending pool - it's reused
}

export async function getEnabledConnections(): Promise<TirewireConnection[]> {
  // Return from cache if valid
  if (_connsCache && _connsCache.expiresAt > Date.now()) {
    return _connsCache.data;
  }
  
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
    console.error("[tirewire] Failed to get connections:", err);
    return [];
  }
  // NOTE: No longer ending pool - it's reused
}

// ============ SOAP API ============

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

async function callTirewireApi(soapBody: string): Promise<string> {
  const res = await fetch(PRODUCTS_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      "SOAPAction": "http://ws.tirewire.com/connectionscenter/productsservice/GetTires",
    },
    body: soapBody,
  });

  if (!res.ok) {
    throw new Error(`Tirewire API error: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

function parseGetTiresResponse(xml: string, connectionId: number, provider: string): TirewireSearchResult {
  const tires: TirewireTire[] = [];
  
  // Extract Tire elements
  const tireMatches = xml.matchAll(/<Tire>([\s\S]*?)<\/Tire>/g);
  
  for (const match of tireMatches) {
    const tireXml = match[1];
    
    const tire: TirewireTire = {
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

export async function searchTiresTirewire(
  tireSize: string // e.g., "225/60R16" or "2256016"
): Promise<TirewireSearchResult[]> {
  // Normalize size to simple format (2256016)
  const simpleSize = toSimpleSize(tireSize);
  if (!simpleSize) {
    console.warn("[tirewire] Invalid tire size:", tireSize);
    return [];
  }
  
  // Get credentials
  const creds = await getTirewireCredentials();
  if (!creds) {
    console.warn("[tirewire] No credentials configured");
    return [];
  }
  
  // Get enabled connections
  const connections = await getEnabledConnections();
  if (connections.length === 0) {
    console.warn("[tirewire] No enabled connections");
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
      
      const response = await callTirewireApi(soapRequest);
      return parseGetTiresResponse(response, conn.connectionId, conn.provider);
    })
  );
  
  // Collect successful results
  const successfulResults: TirewireSearchResult[] = [];
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      successfulResults.push(result.value);
    } else {
      console.error(`[tirewire] Connection ${connections[i].provider} failed:`, result.reason);
    }
  }
  
  return successfulResults;
}

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
  source: string; // "tirewire:atd", "tirewire:ntw", "km", etc.
  badges: {
    terrain: string | null;
    construction: string | null;
    warrantyMiles: number | null;
    loadIndex: string | null;
    speedRating: string | null;
    utqg: string | null;
  };
}

export function tirewireTireToUnified(tire: TirewireTire, provider: string): UnifiedTire {
  const size = `${Math.round(tire.width)}/${Math.round(tire.aspectRatio)}R${Math.round(tire.rim)}`;
  
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
    imageUrl: tire.imageUrl || null,
    size,
    simpleSize: `${Math.round(tire.width)}${Math.round(tire.aspectRatio)}${Math.round(tire.rim)}`,
    rimDiameter: Math.round(tire.rim),
    tireLibraryId: tire.id || null,
    source: `tirewire:${provider.replace("tireweb_", "")}`,
    badges: {
      terrain: null, // Tirewire doesn't have terrain classification
      construction: null,
      warrantyMiles: tire.warranty ? parseInt(tire.warranty) || null : null,
      loadIndex: tire.loadRating || null,
      speedRating: tire.speedRating || null,
      utqg: tire.utqg || null,
    },
  };
}
