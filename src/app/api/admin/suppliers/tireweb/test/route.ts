import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";

const { Pool } = pg;

function getPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

/**
 * Test a TireWeb connection
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { provider } = body;

  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    // Get credentials
    const { rows: configRows } = await pool.query(`
      SELECT key, value FROM tireweb_config WHERE key IN ('access_key', 'group_token')
    `);

    const accessKeyRow = configRows.find((r: any) => r.key === "access_key");
    const groupTokenRow = configRows.find((r: any) => r.key === "group_token");

    if (!accessKeyRow?.value || !groupTokenRow?.value) {
      await updateTestStatus(pool, provider, "error", "TireWeb credentials not configured");
      return NextResponse.json({ ok: false, error: "Credentials not configured" });
    }

    // Get connection ID
    const { rows: connRows } = await pool.query(`
      SELECT connection_id FROM tireweb_connections WHERE provider = $1
    `, [provider]);

    const connectionId = connRows[0]?.connection_id;
    if (!connectionId) {
      await updateTestStatus(pool, provider, "error", "Connection ID not set");
      return NextResponse.json({ ok: false, error: "Connection ID not set" });
    }

    // TODO: Actually test the Tirewire API connection
    // For now, just validate that we have all the required config
    // When Tirewire credentials come through, implement actual SOAP call to ValidateGroupToken
    
    // Simulated test - in production, this would call the Tirewire API
    const testResult = await testTirewireConnection(
      accessKeyRow.value,
      groupTokenRow.value,
      connectionId
    );

    await updateTestStatus(
      pool,
      provider,
      testResult.success ? "success" : "error",
      testResult.message
    );

    return NextResponse.json({ ok: testResult.success, message: testResult.message });
  } catch (err: any) {
    console.error("[tireweb/test] POST Error:", err);
    await updateTestStatus(pool, provider, "error", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

async function updateTestStatus(pool: pg.Pool, provider: string, status: string, message: string) {
  await pool.query(`
    UPDATE tireweb_connections 
    SET last_test_at = NOW(), last_test_status = $2, last_test_message = $3
    WHERE provider = $1
  `, [provider, status, message]);
}

async function testTirewireConnection(
  encryptedAccessKey: string,
  encryptedGroupToken: string,
  connectionId: number
): Promise<{ success: boolean; message: string }> {
  // TODO: Implement actual Tirewire API test
  // This would:
  // 1. Decrypt the credentials
  // 2. Call ValidateGroupToken SOAP endpoint
  // 3. Call GetConnectionsByGroup to verify connectionId exists
  // 4. Optionally do a simple product query to verify data flows

  // For now, return a placeholder result
  // The actual implementation will look something like:
  /*
  const { accessKey, groupToken } = decryptCredentials(encryptedAccessKey, encryptedGroupToken);
  
  const validateXml = `
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <ValidateGroupToken xmlns="http://ws.tirewire.com/connectionscenter/commonservice">
          <groupToken>${groupToken}</groupToken>
        </ValidateGroupToken>
      </soap:Body>
    </soap:Envelope>
  `;
  
  const res = await fetch('http://ws.tirewire.com/connectionscenter/commonservice.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      'SOAPAction': 'http://ws.tirewire.com/connectionscenter/commonservice/ValidateGroupToken',
    },
    body: validateXml,
  });
  
  // Parse response and check if valid
  */

  return {
    success: true,
    message: "Configuration saved. Actual API test will be available once Tirewire provides credentials.",
  };
}
