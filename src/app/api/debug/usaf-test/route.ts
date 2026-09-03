/**
 * Debug endpoint to test USAF API connectivity from Vercel
 * DELETE THIS AFTER DEBUGGING
 */
import { NextResponse } from "next/server";

const PROD_URL = 'https://services.usautoforce.com/integrationservice.asmx';
const SOAP_NS = 'https://services.usautoforce.com';

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const size = searchParams.get('size') || '285/70R17';
  const action = searchParams.get('action') || 'stock';
  
  const username = process.env.USAUTOFORCE_USERNAME;
  const password = process.env.USAUTOFORCE_PASSWORD;
  const account = process.env.USAUTOFORCE_ACCOUNT;
  
  if (!username || !password || !account) {
    return NextResponse.json({
      error: 'Missing USAF credentials',
      hasUsername: !!username,
      hasPassword: !!password,
      hasAccount: !!account,
    }, { status: 500 });
  }
  
  // Simple size normalization
  const simpleSize = size.replace(/[^0-9]/g, '');
  
  let bodyContent: string;
  let soapAction: string;
  
  if (action === 'service') {
    // ServiceCheck - auth test
    bodyContent = `<ServiceCheck xmlns="${SOAP_NS}">
      <request>
        <revision>1.0</revision>
        <transactionId>${Date.now()}</transactionId>
        <accountNumber>${escapeXml(account)}</accountNumber>
      </request>
    </ServiceCheck>`;
    soapAction = `${SOAP_NS}/ServiceCheck`;
  } else {
    // StockCheck - use TireDto structure like the actual client
    // Parse size: "2857017" -> width=285, aspect=70, rim=17
    const width = simpleSize.slice(0, 3);
    const aspect = simpleSize.slice(3, 5);
    const rim = simpleSize.slice(5);
    
    bodyContent = `<StockCheck xmlns="${SOAP_NS}">
      <request>
        <revision>1.0</revision>
        <transactionId>${Date.now()}</transactionId>
        <accountNumber>${escapeXml(account)}</accountNumber>
        <alternateFlag>no</alternateFlag>
        <branch>4101</branch>
        <dataSource>manual</dataSource>

        <tires>
          <TireDto>
            <lineNumber>1</lineNumber>
            <width>${width}</width>
            <aspectRatio>${aspect}</aspectRatio>
            <rim>${rim}</rim>
            <tireSize>${escapeXml(simpleSize)}</tireSize>
            <quantityRequested>4</quantityRequested>
          </TireDto>
        </tires>
      </request>
    </StockCheck>`;
    soapAction = `${SOAP_NS}/StockCheck`;
  }
  
  // Build envelope with credentials in SOAP Header (like the actual client does!)
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <Authentication xmlns="${SOAP_NS}">
      <User>${escapeXml(username)}</User>
      <Password>${escapeXml(password)}</Password>
    </Authentication>
  </soap:Header>
  <soap:Body>
    ${bodyContent}
  </soap:Body>
</soap:Envelope>`;
  
  try {
    const response = await fetch(PROD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': soapAction,
      },
      body: envelope,
    });
    
    const xml = await response.text();
    
    // Extract error info
    const errorMatch = xml.match(/<errorCode>([^<]*)<\/errorCode>/);
    const errorMsgMatch = xml.match(/<errorMessage>([^<]*)<\/errorMessage>/);
    
    // Count tires if stock check
    const tireCount = (xml.match(/<TireDto>/g) || []).length;
    
    // Extract first few part numbers
    const partNumbers: string[] = [];
    const pnMatches = xml.matchAll(/<partNumber>([^<]+)<\/partNumber>/g);
    for (const m of pnMatches) {
      if (partNumbers.length < 10) partNumbers.push(m[1]);
    }
    
    return NextResponse.json({
      action,
      size,
      simpleSize,
      httpStatus: response.status,
      responseLength: xml.length,
      errorCode: errorMatch?.[1] || null,
      errorMessage: errorMsgMatch?.[1] || null,
      tireCount,
      samplePartNumbers: partNumbers,
      // Include raw response if error or short
      rawResponse: response.status !== 200 || xml.length < 2000 ? xml.substring(0, 1000) : undefined,
      credentials: {
        username,
        account,
        passwordLength: password.length,
      },
    });
    
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      stack: err.stack,
    }, { status: 500 });
  }
}
