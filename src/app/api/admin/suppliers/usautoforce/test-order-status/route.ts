import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SOAP_NAMESPACE = "https://services.usautoforce.com";

/**
 * Test USAF OrderStatusDetail API call
 * GET /api/admin/suppliers/usautoforce/test-order-status?orderNumber=HDS26692934
 * 
 * Returns raw request and response for debugging with USAF support
 */
export async function GET(request: NextRequest) {
  const orderNumber = request.nextUrl.searchParams.get("orderNumber");
  
  if (!orderNumber) {
    return NextResponse.json({ error: "orderNumber required" }, { status: 400 });
  }

  const username = process.env.USAUTOFORCE_USERNAME;
  const password = process.env.USAUTOFORCE_PASSWORD;
  const account = process.env.USAUTOFORCE_ACCOUNT;

  if (!username || !password || !account) {
    return NextResponse.json({ 
      error: "Missing credentials",
      hasUsername: !!username,
      hasPassword: !!password,
      hasAccount: !!account,
    }, { status: 500 });
  }

  // Determine API URL - production unless username contains "test"
  const isTest = username.toLowerCase().includes("test");
  const apiUrl = isTest 
    ? "https://servicesstage.usautoforce.com/integrationservice.asmx"
    : "https://services.usautoforce.com/integrationservice.asmx";

  const transactionId = Date.now().toString();

  // Build SOAP envelope
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <Authentication xmlns="${SOAP_NAMESPACE}">
      <User>${escapeXml(username)}</User>
      <Password>${escapeXml(password)}</Password>
    </Authentication>
  </soap:Header>
  <soap:Body>
    <OrderStatusDetail xmlns="${SOAP_NAMESPACE}">
      <request>
        <revision>1.0</revision>
        <transactionId>${transactionId}</transactionId>
        <accountNumber>${escapeXml(account)}</accountNumber>
        <orderNumber>${escapeXml(orderNumber)}</orderNumber>
        <orderType>invoiced</orderType>
      </request>
    </OrderStatusDetail>
  </soap:Body>
</soap:Envelope>`;

  // Log request (mask password)
  const maskedEnvelope = envelope.replace(
    /<Password>[^<]+<\/Password>/,
    "<Password>***MASKED***</Password>"
  );

  console.log(`[usautoforce-test] Calling OrderStatusDetail`);
  console.log(`[usautoforce-test] URL: ${apiUrl}`);
  console.log(`[usautoforce-test] Account: ${account}`);
  console.log(`[usautoforce-test] Order: ${orderNumber}`);
  console.log(`[usautoforce-test] Is Test: ${isTest}`);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": `${SOAP_NAMESPACE}/OrderStatusDetail`,
      },
      body: envelope,
    });

    const responseText = await response.text();

    console.log(`[usautoforce-test] Response status: ${response.status}`);
    console.log(`[usautoforce-test] Response: ${responseText.substring(0, 1000)}...`);

    // Parse out key values
    const errorCode = extractXmlValue(responseText, "errorCode");
    const errorMessage = extractXmlValue(responseText, "errorMessage");
    const status = extractXmlValue(responseText, "status");
    const invoiceNumber = extractXmlValue(responseText, "invoiceNumber");
    
    // Extract tracking numbers (look for multiple patterns)
    const trackingNumbers: string[] = [];
    
    // Pattern 1: <trackingNumber>xxx</trackingNumber>
    const trackingMatches1 = responseText.matchAll(/<trackingNumber>([^<]+)<\/trackingNumber>/gi);
    for (const m of trackingMatches1) trackingNumbers.push(m[1]);
    
    // Pattern 2: <string>xxx</string> where xxx looks like a tracking number (12+ digits)
    const trackingMatches2 = responseText.matchAll(/<string>(\d{12,})<\/string>/g);
    for (const m of trackingMatches2) {
      if (!trackingNumbers.includes(m[1])) trackingNumbers.push(m[1]);
    }

    return NextResponse.json({
      success: errorCode === "success",
      environment: isTest ? "TEST" : "PRODUCTION",
      apiUrl,
      accountNumber: account,
      orderNumber,
      parsed: {
        errorCode,
        errorMessage,
        status,
        invoiceNumber,
        trackingNumbers,
      },
      request: maskedEnvelope,
      response: responseText,
    });
  } catch (err) {
    console.error("[usautoforce-test] Error:", err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      environment: isTest ? "TEST" : "PRODUCTION",
      apiUrl,
      request: maskedEnvelope,
    }, { status: 500 });
  }
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractXmlValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : null;
}
