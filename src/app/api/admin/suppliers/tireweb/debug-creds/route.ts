import { NextResponse } from "next/server";
import { getTirewireCredentials, getEnabledConnections } from "@/lib/tirewire/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const creds = await getTirewireCredentials();
    const connections = await getEnabledConnections();
    
    // Test the API directly
    let apiTestResult = "not tested";
    if (creds && connections.length > 0) {
      const testSize = "2656020";
      const connectionId = connections[0].connectionId;
      
      const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${creds.accessKey}</prod:AccessKey>
        <prod:GroupToken>${creds.groupToken}</prod:GroupToken>
        <prod:ConnectionID>${connectionId}</prod:ConnectionID>
        <prod:TireSize>${testSize}</prod:TireSize>
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
        apiTestResult = `OK: ${tireCount} tires`;
      } else {
        const fault = text.match(/<faultstring>([^<]+)</);
        apiTestResult = `FAIL: ${res.status} - ${fault?.[1] || text.slice(0, 200)}`;
      }
    }
    
    return NextResponse.json({
      hasCredentials: !!creds,
      accessKeyPreview: creds ? `${creds.accessKey.slice(0, 8)}...${creds.accessKey.slice(-4)}` : null,
      accessKeyLength: creds?.accessKey?.length || 0,
      groupTokenLength: creds?.groupToken?.length || 0,
      connections: connections.map(c => ({ provider: c.provider, id: c.connectionId })),
      apiTestResult,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
