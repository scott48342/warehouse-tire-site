import { NextResponse } from "next/server";
import { getTirewireCredentials, getEnabledConnections } from "@/lib/tirewire/client";
import pg from "pg";
import crypto from "crypto";

export const runtime = "nodejs";

const { Pool } = pg;
const PRODUCTS_SERVICE_URL = "http://ws.tirewire.com/connectionscenter/productsservice.asmx";

// Check encryption key
function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIALS_KEY || process.env.ADMIN_PASSWORD || "default-key-change-me";
  return crypto.scryptSync(key, "tireweb-salt", 32);
}

function decrypt(encrypted: string): string {
  try {
    const [ivHex, data] = encrypted.split(":");
    if (!ivHex || !data) return `[no-colon:${encrypted.slice(0,20)}...]`;
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err: any) {
    return `[decrypt-error:${err.message}]`;
  }
}

async function getRawCredentials() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
  try {
    const { rows } = await pool.query(`SELECT key, value FROM tireweb_config WHERE key IN ('access_key', 'group_token')`);
    return rows;
  } finally {
    await pool.end();
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

// Convert 32-char hex string to GUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
function toGuid(hex: string): string {
  if (hex.length !== 32) return hex;
  if (hex.includes("-")) return hex; // Already formatted
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

function toSimpleSize(s: string): string {
  const v = String(s || "").trim().toUpperCase();
  const m = v.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R?\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const m2 = v.match(/^(\d{7})$/);
  if (m2) return m2[1];
  return "";
}

/**
 * Debug endpoint to test TireWire API directly
 * GET /api/admin/suppliers/tireweb/debug?size=225/65R17
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const size = url.searchParams.get("size") || "225/65R17";
  const simpleSize = toSimpleSize(size);

  const debug: Record<string, any> = {
    size,
    simpleSize,
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Check raw credentials from database
    const rawCreds = await getRawCredentials();
    debug.rawCredentials = rawCreds?.map((r: any) => ({
      key: r.key,
      valueLength: r.value?.length || 0,
      hasColon: r.value?.includes(":") || false,
      valuePreview: r.value ? `${r.value.slice(0, 10)}...${r.value.slice(-10)}` : null,
    }));

    // 1b. Try decrypting manually
    const accessKeyRaw = rawCreds?.find((r: any) => r.key === "access_key")?.value;
    const groupTokenRaw = rawCreds?.find((r: any) => r.key === "group_token")?.value;
    
    const accessKeyDecrypted = accessKeyRaw ? decrypt(accessKeyRaw) : null;
    const groupTokenDecrypted = groupTokenRaw ? decrypt(groupTokenRaw) : null;
    
    debug.decryption = {
      accessKey: accessKeyDecrypted ? `${accessKeyDecrypted.slice(0, 4)}...${accessKeyDecrypted.slice(-4)} (len=${accessKeyDecrypted.length})` : null,
      groupToken: groupTokenDecrypted ? `${groupTokenDecrypted.slice(0, 4)}...${groupTokenDecrypted.slice(-4)} (len=${groupTokenDecrypted.length})` : null,
      envKeySource: process.env.CREDENTIALS_KEY ? "CREDENTIALS_KEY" : process.env.ADMIN_PASSWORD ? "ADMIN_PASSWORD" : "default",
    };

    // 2. Use the lib function
    const creds = await getTirewireCredentials();
    debug.credentials = creds
      ? {
          hasAccessKey: !!creds.accessKey,
          accessKeyLength: creds.accessKey?.length || 0,
          hasGroupToken: !!creds.groupToken,
          groupTokenLength: creds.groupToken?.length || 0,
          accessKeyPreview: creds.accessKey ? `${creds.accessKey.slice(0, 4)}...${creds.accessKey.slice(-4)}` : null,
          groupTokenPreview: creds.groupToken ? `${creds.groupToken.slice(0, 4)}...${creds.groupToken.slice(-4)}` : null,
        }
      : null;

    if (!creds) {
      debug.error = "No credentials found in database";
      return NextResponse.json(debug);
    }

    // 2. Check enabled connections
    const connections = await getEnabledConnections();
    debug.connections = connections;

    if (connections.length === 0) {
      debug.error = "No enabled connections found";
      return NextResponse.json(debug);
    }

    // 3. Try multiple SOAP request formats to find what works
    const conn = connections[0];
    
    // Format 1: GroupToken only (no AccessKey)
    const soapRequest1 = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:GroupToken>${escapeXml(creds.groupToken)}</prod:GroupToken>
        <prod:ConnectionID>${conn.connectionId}</prod:ConnectionID>
        <prod:TireSize>${escapeXml(simpleSize)}</prod:TireSize>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

    // Format 2: With empty AccessKey
    const soapRequest2 = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey></prod:AccessKey>
        <prod:GroupToken>${escapeXml(creds.groupToken)}</prod:GroupToken>
        <prod:ConnectionID>${conn.connectionId}</prod:ConnectionID>
        <prod:TireSize>${escapeXml(simpleSize)}</prod:TireSize>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

    // Format 3: GroupToken as AccessKey (in case they use same field)
    const soapRequest3 = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${escapeXml(creds.groupToken)}</prod:AccessKey>
        <prod:GroupToken>${escapeXml(creds.groupToken)}</prod:GroupToken>
        <prod:ConnectionID>${conn.connectionId}</prod:ConnectionID>
        <prod:TireSize>${escapeXml(simpleSize)}</prod:TireSize>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

    // Format 4: Both AccessKey and GroupToken (proper format)
    const soapRequest4 = `<?xml version="1.0" encoding="utf-8"?>
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

    // Format 5: AccessKey only (no GroupToken)
    const soapRequest5 = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${escapeXml(creds.accessKey)}</prod:AccessKey>
        <prod:ConnectionID>${conn.connectionId}</prod:ConnectionID>
        <prod:TireSize>${escapeXml(simpleSize)}</prod:TireSize>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

    // Format 6: AccessKey as GUID format
    const accessKeyGuid = toGuid(creds.accessKey);
    const soapRequest6 = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${escapeXml(accessKeyGuid)}</prod:AccessKey>
        <prod:GroupToken>${escapeXml(creds.groupToken)}</prod:GroupToken>
        <prod:ConnectionID>${conn.connectionId}</prod:ConnectionID>
        <prod:TireSize>${escapeXml(simpleSize)}</prod:TireSize>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

    debug.accessKeyGuid = accessKeyGuid ? `${accessKeyGuid.slice(0,8)}...` : null;

    const soapFormats = [
      { name: "AccessKey as GUID", body: soapRequest6 },
      { name: "Both keys (proper)", body: soapRequest4 },
      { name: "AccessKey only", body: soapRequest5 },
      { name: "GroupToken only", body: soapRequest1 },
    ];

    debug.soapTests = [];
    
    for (const format of soapFormats) {
      const startTime = Date.now();
      try {
        const res = await fetch(PRODUCTS_SERVICE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml;charset=UTF-8",
            "SOAPAction": "http://ws.tirewire.com/connectionscenter/productsservice/GetTires",
          },
          body: format.body,
        });
        
        const responseText = await res.text();
        const tireMatches = responseText.match(/<Tire>/g);
        const faultMatch = responseText.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
        
        debug.soapTests.push({
          format: format.name,
          status: res.status,
          durationMs: Date.now() - startTime,
          tireCount: tireMatches ? tireMatches.length : 0,
          fault: faultMatch ? faultMatch[1] : null,
          success: res.status === 200 && !faultMatch,
          bodyPreview: responseText.slice(0, 500),
        });
        
        // If this format works, stop testing
        if (res.status === 200 && !faultMatch && tireMatches && tireMatches.length > 0) {
          debug.workingFormat = format.name;
          break;
        }
      } catch (err: any) {
        debug.soapTests.push({
          format: format.name,
          error: err.message,
          durationMs: Date.now() - startTime,
        });
      }
    }

    debug.soapRequest = {
      url: PRODUCTS_SERVICE_URL,
      connectionId: conn.connectionId,
      provider: conn.provider,
      tireSize: simpleSize,
      groupTokenPreview: creds.groupToken ? `${creds.groupToken.slice(0, 8)}...` : null,
    };

    return NextResponse.json(debug);
  } catch (err: any) {
    debug.error = err.message;
    debug.stack = err.stack;
    return NextResponse.json(debug, { status: 500 });
  }
}
