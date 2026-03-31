import { NextResponse } from "next/server";
import { getTirewireCredentials, getEnabledConnections } from "@/lib/tirewire/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const results: Record<string, unknown> = {};
    
    // Check DB URL
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
    results.dbUrlPrefix = dbUrl.slice(0, 30) + "...";
  
  try {
    // Get credentials
    const creds = await getTirewireCredentials();
    results.hasCredentials = !!creds;
    results.accessKeyPreview = creds ? `${creds.accessKey.slice(0, 8)}...${creds.accessKey.slice(-4)}` : null;
    results.accessKeyLength = creds?.accessKey?.length || 0;
    results.groupTokenLength = creds?.groupToken?.length || 0;
  } catch (err: any) {
    results.credentialsError = err.message;
  }
  
  try {
    // Get connections
    const connections = await getEnabledConnections();
    results.connections = connections.map(c => ({ provider: c.provider, id: c.connectionId, enabled: c.enabled }));
    results.connectionCount = connections.length;
  } catch (err: any) {
    results.connectionsError = err.message;
  }
  
  // Test API if we have both
  if (results.hasCredentials && results.connectionCount && results.connectionCount > 0) {
    try {
      const creds = await getTirewireCredentials();
      const connections = await getEnabledConnections();
      const connectionId = connections[0].connectionId;
      
      const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${creds!.accessKey}</prod:AccessKey>
        <prod:GroupToken>${creds!.groupToken}</prod:GroupToken>
        <prod:ConnectionID>${connectionId}</prod:ConnectionID>
        <prod:TireSize>2656020</prod:TireSize>
        <prod:DetailLevel>6</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

      const res = await fetch("http://ws.tirewire.com/connectionscenter/productsservice.asmx", {
        method: "POST",
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          "SOAPAction": "http://ws.tirewire.com/connectionscenter/productsservice/GetTires",
        },
        body: soapRequest,
      });
      
      const text = await res.text();
      if (res.ok && !text.includes("<faultstring>")) {
        const tireCount = (text.match(/<Tire>/g) || []).length;
        results.apiTest = `OK: ${tireCount} tires`;
      } else {
        const fault = text.match(/<faultstring>([^<]+)</);
        results.apiTest = `FAIL: ${res.status} - ${fault?.[1] || text.slice(0, 200)}`;
      }
    } catch (err: any) {
      results.apiTestError = err.message;
    }
  } else {
    results.apiTest = "skipped (no creds or connections)";
  }
  
    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ fatalError: err.message, stack: err.stack?.split('\n').slice(0, 5) }, { status: 200 });
  }
}
