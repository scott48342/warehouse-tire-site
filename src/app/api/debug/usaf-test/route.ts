/**
 * Debug endpoint to test USAF API connectivity from Vercel
 * DELETE THIS AFTER DEBUGGING
 */
import { NextResponse } from "next/server";

const PROD_URL = 'https://services.usautoforce.com/integrationservice.asmx';
const SOAP_NS = 'https://services.usautoforce.com';

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
  
  let envelope: string;
  let soapAction: string;
  
  if (action === 'service') {
    // ServiceCheck - auth test
    envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ServiceCheck xmlns="${SOAP_NS}">
      <request>
        <username>${username}</username>
        <password>${password}</password>
        <accountNumber>${account}</accountNumber>
      </request>
    </ServiceCheck>
  </soap:Body>
</soap:Envelope>`;
    soapAction = `${SOAP_NS}/ServiceCheck`;
  } else {
    // StockCheck
    envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <StockCheck xmlns="${SOAP_NS}">
      <request>
        <username>${username}</username>
        <password>${password}</password>
        <accountNumber>${account}</accountNumber>
        <branchId>4101</branchId>
        <tireSize>${simpleSize}</tireSize>
        <quantity>4</quantity>
      </request>
    </StockCheck>
  </soap:Body>
</soap:Envelope>`;
    soapAction = `${SOAP_NS}/StockCheck`;
  }
  
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
    const errorMatch = xml.match(/<errorCode>(\d+)<\/errorCode>/);
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
      // Include raw response if error
      rawResponse: response.status !== 200 ? xml.substring(0, 500) : undefined,
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
