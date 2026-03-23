import { NextResponse } from "next/server";
import { getTirewireCredentials, getEnabledConnections } from "@/lib/tirewire/client";

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
    // 1. Check credentials
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

    // 3. Try a direct SOAP call to the first connection
    const conn = connections[0];
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

    debug.soapRequest = {
      url: PRODUCTS_SERVICE_URL,
      connectionId: conn.connectionId,
      provider: conn.provider,
      tireSize: simpleSize,
    };

    const startTime = Date.now();
    const res = await fetch(PRODUCTS_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        "SOAPAction": "http://ws.tirewire.com/connectionscenter/productsservice/GetTires",
      },
      body: soapRequest,
    });

    debug.soapResponse = {
      status: res.status,
      statusText: res.statusText,
      durationMs: Date.now() - startTime,
    };

    const responseText = await res.text();
    debug.soapResponse.bodyLength = responseText.length;
    debug.soapResponse.bodyPreview = responseText.slice(0, 2000);

    // Check for errors in response
    if (responseText.includes("<faultstring>")) {
      const faultMatch = responseText.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
      debug.soapResponse.fault = faultMatch ? faultMatch[1] : "Unknown fault";
    }

    // Count tires in response
    const tireMatches = responseText.match(/<Tire>/g);
    debug.soapResponse.tireCount = tireMatches ? tireMatches.length : 0;

    // Extract message if present
    const messageMatch = responseText.match(/<Message>([\s\S]*?)<\/Message>/);
    if (messageMatch) {
      debug.soapResponse.message = messageMatch[1];
    }

    return NextResponse.json(debug);
  } catch (err: any) {
    debug.error = err.message;
    debug.stack = err.stack;
    return NextResponse.json(debug, { status: 500 });
  }
}
