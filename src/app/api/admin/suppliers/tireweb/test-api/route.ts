import { NextResponse } from "next/server";
import { getTirewireCredentials, getEnabledConnections } from "@/lib/tirewire/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const creds = await getTirewireCredentials();
    const connections = await getEnabledConnections();
    
    if (!creds) {
      return NextResponse.json({ error: "No credentials", connections: connections.length });
    }
    
    if (connections.length === 0) {
      return NextResponse.json({ error: "No connections", hasCreds: true });
    }
    
    // Test API call
    const connectionId = connections[0].connectionId;
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${creds.accessKey}</prod:AccessKey>
        <prod:GroupToken>${creds.groupToken}</prod:GroupToken>
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
      // Get sample tire
      const tireMatch = text.match(/<Tire>([\s\S]*?)<\/Tire>/);
      let sample = null;
      if (tireMatch) {
        const extract = (tag: string) => {
          const m = tireMatch[1].match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
          return m ? m[1] : null;
        };
        sample = {
          make: extract("Make"),
          pattern: extract("Pattern"),
          imageUrl: extract("ImageURL"),
        };
      }
      return NextResponse.json({ 
        success: true, 
        tireCount, 
        sample,
        accessKeyPreview: creds.accessKey.slice(0, 8) + "...",
        connectionId,
      });
    } else {
      const fault = text.match(/<faultstring>([^<]+)</);
      return NextResponse.json({ 
        error: fault?.[1] || text.slice(0, 300),
        status: res.status,
        accessKeyLen: creds.accessKey.length,
        groupTokenLen: creds.groupToken.length,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
